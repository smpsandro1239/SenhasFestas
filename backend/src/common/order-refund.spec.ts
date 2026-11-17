import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { BalanceEntity, BalanceMovementEntity, MovementType, OrderEntity } from '../entities';
import { reembolsarSaldoEmTransacao } from './order-refund';

describe('reembolsarSaldoEmTransacao — saldos soft-deleted', () => {
  it('restaura a visibilidade do saldo antes de registar o reembolso', async () => {
    const archivedAt = new Date('2026-10-01T10:00:00.000Z');
    const balance = {
      id: 'balance-1',
      currentBalance: 5,
      archivedAt,
      deletedAt: new Date('2026-11-01T10:00:00.000Z'),
    };
    const manager = {
      findOne: vi.fn().mockResolvedValue(balance),
      save: vi.fn().mockImplementation(async (_entity: any, value: any) => value),
      create: vi.fn().mockImplementation((_entity: any, value: any) => value),
    };

    await reembolsarSaldoEmTransacao(
      manager as any,
      { id: 'order-1', balanceId: 'balance-1', balanceUsed: 10 } as OrderEntity,
      'operator-1',
    );

    expect(manager.findOne).toHaveBeenCalledWith(BalanceEntity, {
      where: { id: 'balance-1' },
      lock: { mode: 'pessimistic_write' },
      withDeleted: true,
    });
    expect(balance.deletedAt).toBeNull();
    expect(balance.archivedAt).toEqual(archivedAt);
    expect(balance.currentBalance).toBe(15);
    expect(manager.save).toHaveBeenCalledWith(BalanceEntity, balance);
    expect(manager.save).toHaveBeenCalledWith(
      BalanceMovementEntity,
      expect.objectContaining({
        type: MovementType.REFUND,
        amount: 10,
        orderId: 'order-1',
      }),
    );
  });
});
