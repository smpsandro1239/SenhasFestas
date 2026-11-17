import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { BalanceEntity, BalanceMovementEntity, EventEntity, MovementType } from '../../entities';
import { BalanceService } from './balance.service';

function criarService(manager: any) {
  const eventService = {
    assertEventOperavelById: vi.fn().mockResolvedValue({ id: 'evt1' }),
    vincularCliente: vi.fn().mockResolvedValue(undefined),
  };
  const dataSource = {
    transaction: vi.fn(async (callback: (tx: any) => Promise<any>) => callback(manager)),
  };
  const service = new BalanceService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    dataSource as any,
    eventService as any,
  );
  return { service, eventService, dataSource };
}

describe('BalanceService — idempotência de operações financeiras', () => {
  it('reproduz o carregamento confirmado sem voltar a creditar saldo', async () => {
    const balance = {
      id: 'balance-1',
      currentBalance: 75,
      user: { id: 'client-1', name: 'Cliente' },
      event: { id: 'evt1' },
    };
    const movement = {
      id: 'movement-1',
      type: MovementType.LOAD,
      createdById: 'cashier-1',
      idempotencyKey: 'load-key-123',
      requestHash: undefined as string | undefined,
      balance,
    };
    const manager = {
      query: vi.fn().mockResolvedValue(undefined),
      findOne: vi.fn().mockImplementation((entity: any, options: any) => {
        if (entity === EventEntity) return Promise.resolve({ id: 'evt1', status: 'active' });
        if (entity === BalanceMovementEntity) return Promise.resolve(movement);
        return Promise.resolve(null);
      }),
      save: vi.fn(),
      create: vi.fn(),
    };
    const { service, eventService } = criarService(manager);
    movement.requestHash = (service as any).hashOperacaoFinanceira(
      'load', 'cashier-1', 'client-1', 'evt1',
      { amount: 25, paymentMethod: 'cash' },
    );

    const result = await service.loadBalance(
      'client-1',
      { amount: 25, eventId: 'evt1', paymentMethod: 'cash' } as any,
      { id: 'cashier-1', role: 'cashier' },
      undefined,
      'load-key-123',
    );

    expect(result.id).toBe('balance-1');
    expect(result.currentBalance).toBe(75);
    expect(manager.query).toHaveBeenCalledTimes(1);
    expect(manager.save).not.toHaveBeenCalled();
    expect(eventService.vincularCliente).toHaveBeenCalledWith('client-1', 'evt1');
  });

  it('rejeita a mesma chave de carregamento quando o conteúdo mudou', async () => {
    const movement = {
      type: MovementType.LOAD,
      idempotencyKey: 'load-key-123',
      requestHash: 'hash-de-outro-pedido',
      balance: { id: 'balance-1', currentBalance: 75 },
    };
    const manager = {
      query: vi.fn(),
      findOne: vi.fn().mockImplementation((entity: any) =>
        Promise.resolve(entity === EventEntity ? { id: 'evt1', status: 'active' } : movement),
      ),
      save: vi.fn(),
      create: vi.fn(),
    };
    const { service } = criarService(manager);

    await expect(service.loadBalance(
      'client-1',
      { amount: 25, eventId: 'evt1', paymentMethod: 'cash' } as any,
      { id: 'cashier-1', role: 'cashier' },
      undefined,
      'load-key-123',
    )).rejects.toBeInstanceOf(ConflictException);
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('reproduz um desconto confirmado sem voltar a debitar saldo', async () => {
    const movement = {
      id: 'movement-2',
      type: MovementType.CONSUME,
      idempotencyKey: 'deduct-key-123',
      requestHash: undefined as string | undefined,
      balance: { id: 'balance-1', currentBalance: 40 },
    };
    const manager = {
      query: vi.fn().mockResolvedValue(undefined),
      findOne: vi.fn().mockImplementation((entity: any) =>
        Promise.resolve(entity === BalanceMovementEntity ? movement : null),
      ),
      save: vi.fn(),
      create: vi.fn(),
    };
    const { service, eventService } = criarService(manager);
    movement.requestHash = (service as any).hashOperacaoFinanceira(
      'deduct', 'cashier-1', 'client-1', 'evt1',
      { amount: 10, description: 'Desconto de saldo (caixa)' },
    );

    const result = await service.deductBalance(
      'client-1',
      { amount: 10, eventId: 'evt1' } as any,
      { id: 'cashier-1', role: 'cashier' },
      undefined,
      'deduct-key-123',
    );

    expect(result).toMatchObject({
      id: 'balance-1',
      currentBalance: 40,
      movement: { id: 'movement-2' },
    });
    expect(manager.query).toHaveBeenCalledTimes(1);
    expect(manager.save).not.toHaveBeenCalled();
    expect(eventService.vincularCliente).toHaveBeenCalledWith('client-1', 'evt1');
  });

  it('não aceita uma chave sem utilizador autenticado ou fora do formato', async () => {
    const manager = {
      query: vi.fn(),
      findOne: vi.fn(),
      save: vi.fn(),
      create: vi.fn(),
    };
    const { service } = criarService(manager);

    await expect(service.loadBalance(
      'client-1',
      { amount: 10, eventId: 'evt1' } as any,
      undefined,
      undefined,
      'invalid',
    )).rejects.toThrow('Idempotency-Key requer um utilizador autenticado');
    await expect(service.deductBalance(
      'client-1',
      { amount: 10, eventId: 'evt1' } as any,
      { id: 'cashier-1' },
      undefined,
      'invalid',
    )).rejects.toThrow('Idempotency-Key inválida');
  });
});
