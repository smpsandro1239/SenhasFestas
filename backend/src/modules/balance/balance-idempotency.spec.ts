import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { BalanceMovementEntity, EventEntity, EventUserEntity, MovementType } from '../../entities';
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
  (service as any).eventRepository = {
    findOne: vi.fn().mockImplementation(({ where }: any) =>
      Promise.resolve({ id: where.id, status: 'active' }),
    ),
  };
  (service as any).eventUserRepository = {
    findOne: vi.fn().mockResolvedValue({ id: 'membership-1', role: 'cashier' }),
  };
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
      findOne: vi.fn().mockImplementation((entity: any) => {
        if (entity === EventEntity) return Promise.resolve({ id: 'evt1', status: 'active' });
        if (entity === EventUserEntity) return Promise.resolve({ id: 'membership-1' });
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
        Promise.resolve(
          entity === EventUserEntity ? { id: 'membership-1' }
            : entity === BalanceMovementEntity ? movement : null,
        ),
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

  it('reproduz um estorno confirmado sem voltar a reduzir o saldo', async () => {
    const actor = { id: 'cashier-1', role: 'cashier' };
    const balance = { id: 'balance-1', currentBalance: 65 };
    const original = {
      id: 'load-1',
      type: MovementType.LOAD,
      amount: 50,
      balance: { user: { id: 'client-1' }, event: { id: 'evt1' } },
    };
    const seedManager = {
      query: vi.fn(),
      findOne: vi.fn(),
      save: vi.fn(),
      create: vi.fn(),
    };
    const { service } = criarService(seedManager);
    const storedKey = (service as any).hashChaveIdempotencia('reverse', 'reverse-key-123');
    const requestHash = (service as any).hashOperacaoFinanceira(
      'reverse', actor.id, 'client-1', 'load-1', { amount: 20 },
    );
    const previous = {
      id: 'reverse-1',
      type: MovementType.CANCEL,
      amount: 20,
      idempotencyKey: storedKey,
      requestHash,
      balance: { id: balance.id },
    };
    seedManager.findOne.mockImplementation(async (entity: any, options: any) => {
      if (entity === BalanceMovementEntity) {
        if (options.where.id === 'load-1') return original;
        if (options.where.type === MovementType.CANCEL) return previous;
      }
      if (entity === EventUserEntity) return { id: 'membership-1', role: 'cashier' };
      if (entity.name === 'BalanceEntity') return balance;
      return null;
    });

    const result = await service.reverseLoad(
      'client-1', 'load-1', actor, { amount: 20 } as any, undefined, 'reverse-key-123',
    );

    expect(result.balance).toEqual({ id: 'balance-1', currentBalance: 65 });
    expect(result.movement.id).toBe('reverse-1');
    expect(result.reversedMovementId).toBe('load-1');
    expect(seedManager.query).toHaveBeenCalledTimes(1);
    expect(seedManager.save).not.toHaveBeenCalled();
    expect(seedManager.create).not.toHaveBeenCalled();
  });

  it('reproduz uma transferência confirmada sem repetir os dois movimentos', async () => {
    const actor = { id: 'cashier-1', role: 'cashier' };
    const origem = { id: 'balance-origin', currentBalance: 30 };
    const destino = { id: 'balance-destination', currentBalance: 40 };
    const seedManager = {
      query: vi.fn(),
      findOne: vi.fn(),
      save: vi.fn(),
      create: vi.fn(),
    };
    const { service, eventService } = criarService(seedManager);
    const storedKey = (service as any).hashChaveIdempotencia('transfer', 'transfer-key-123');
    const requestHash = (service as any).hashOperacaoFinanceira(
      'transfer', actor.id, 'client-1', 'evt1', { toEventId: 'evt2', amount: 10 },
    );
    const movementDestination = {
      id: 'movement-destination',
      type: MovementType.LOAD,
      amount: 10,
      idempotencyKey: storedKey,
      requestHash,
      balance: { id: destino.id },
    };
    const movementOrigin = {
      id: 'movement-origin',
      type: MovementType.CANCEL,
      amount: 10,
      idempotencyKey: storedKey,
      requestHash,
      balance: { id: origem.id },
    };
    seedManager.findOne.mockImplementation(async (entity: any, options: any) => {
      if (entity === EventUserEntity) return { id: 'membership-1', role: 'cashier' };
      if (entity === BalanceMovementEntity) {
        return options.where.type === MovementType.LOAD
          ? movementDestination
          : movementOrigin;
      }
      if (entity.name === 'BalanceEntity') {
        return options.where.id === origem.id ? origem : destino;
      }
      return null;
    });

    const result = await service.transferBalance(
      'client-1',
      { fromEventId: 'evt1', toEventId: 'evt2', amount: 10 } as any,
      actor,
      undefined,
      'transfer-key-123',
    );

    expect(result).toMatchObject({
      balance: { id: destino.id, currentBalance: 40 },
      originBalance: { id: origem.id, currentBalance: 30 },
      movement: { id: movementDestination.id },
      fromEventId: 'evt1',
      toEventId: 'evt2',
    });
    expect(seedManager.query).toHaveBeenCalledTimes(1);
    expect(seedManager.save).not.toHaveBeenCalled();
    expect(seedManager.create).not.toHaveBeenCalled();
    expect(eventService.assertEventOperavelById).not.toHaveBeenCalled();
  });

  it('rejeita reutilização da chave de estorno com outro montante', async () => {
    const actor = { id: 'cashier-1', role: 'cashier' };
    const original = {
      id: 'load-1',
      type: MovementType.LOAD,
      amount: 50,
      balance: { user: { id: 'client-1' }, event: { id: 'evt1' } },
    };
    let service: BalanceService;
    const manager = {
      query: vi.fn(),
      findOne: vi.fn().mockImplementation(async (entity: any, options: any) => {
        if (entity === BalanceMovementEntity) {
          if (options.where.id === 'load-1') return original;
          if (options.where.type === MovementType.CANCEL) {
            return {
              id: 'reverse-1',
              type: MovementType.CANCEL,
              idempotencyKey: (service as any).hashChaveIdempotencia('reverse', 'reverse-key-123'),
              requestHash: 'different-hash',
              balance: { id: 'balance-1' },
            };
          }
        }
        if (entity === EventUserEntity) return { id: 'membership-1', role: 'cashier' };
        return null;
      }),
      save: vi.fn(),
      create: vi.fn(),
    };
    service = criarService(manager).service;
    await expect(service.reverseLoad(
      'client-1', 'load-1', actor, { amount: 20 } as any, undefined, 'reverse-key-123',
    )).rejects.toBeInstanceOf(ConflictException);
    expect(manager.save).not.toHaveBeenCalled();
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
