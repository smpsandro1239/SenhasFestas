import { describe, it, expect, vi } from 'vitest';
import { BalanceEntity, BalanceMovementEntity, MovementType, OrderEntity } from '../entities';
import { reembolsarSaldoEmTransacao } from './order-refund';

describe('reembolsarSaldoEmTransacao', () => {
  it('recupera o saldo soft-deleted e mantém-no visível na vista arquivada', async () => {
    const archivedAt = new Date('2026-01-01T00:00:00.000Z');
    const balance = {
      id: 'balance-1',
      currentBalance: 5,
      archivedAt,
      deletedAt: new Date('2026-02-01T00:00:00.000Z'),
    };
    const manager = {
      findOne: vi.fn().mockResolvedValue(balance),
      save: vi.fn().mockImplementation(async (_entity: unknown, value: unknown) => value),
      create: vi.fn().mockImplementation((_entity: unknown, value: unknown) => value),
    };

    await reembolsarSaldoEmTransacao(
      manager as any,
      { id: 'order-1', balanceId: 'balance-1', balanceUsed: 10 } as OrderEntity,
      'actor-1',
    );

    expect(manager.findOne).toHaveBeenCalledWith(
      BalanceEntity,
      expect.objectContaining({
        where: { id: 'balance-1' },
        lock: { mode: 'pessimistic_write' },
        withDeleted: true,
      }),
    );
    expect(balance.currentBalance).toBe(15);
    expect(balance.deletedAt).toBeNull();
    expect(balance.archivedAt).toBe(archivedAt);
    expect(manager.create).toHaveBeenCalledWith(
      BalanceMovementEntity,
      expect.objectContaining({
        balance,
        type: MovementType.REFUND,
        amount: 10,
        orderId: 'order-1',
        createdById: 'actor-1',
      }),
    );
    expect(manager.save).toHaveBeenCalledTimes(2);
  });

  it('não consulta a base de dados quando o pedido não tem saldo a reembolsar', async () => {
    const manager = {
      findOne: vi.fn(),
      save: vi.fn(),
      create: vi.fn(),
    };

    await reembolsarSaldoEmTransacao(
      manager as any,
      { id: 'order-2', balanceId: null, balanceUsed: 10 } as any,
    );

    expect(manager.findOne).not.toHaveBeenCalled();
    expect(manager.save).not.toHaveBeenCalled();
  });
});
