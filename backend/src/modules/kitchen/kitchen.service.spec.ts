import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { KitchenService } from './kitchen.service';
import { BalanceMovementEntity, MovementType } from '../../entities';

describe('KitchenService — cancelamento via atualizarEstado deve reembolsar saldo (B1-kitchen)', () => {
  it('reembolsa o saldo consumido quando cancela por status (RED)', async () => {
    const orderRepository = {
      findOne: vi.fn().mockResolvedValue({
        id: 'o1',
        status: 'received',
        event: { id: 'evt1' },
      }),
      manager: {
        transaction: null as any,
      },
    };
    const balanceSave = vi.fn();
    const manager = {
      findOne: vi
        .fn()
        .mockResolvedValueOnce({ id: 'o1', status: 'received', balanceId: 'b1', balanceUsed: 10 })
        .mockResolvedValueOnce({ id: 'b1', currentBalance: 5 }),
      save: vi.fn().mockImplementation((_entity: any, data: any) => {
        if (data?.currentBalance !== undefined) balanceSave(data);
        return Promise.resolve(data);
      }),
      create: vi.fn().mockImplementation((_entity: any, data: any) => data),
    };
    orderRepository.manager.transaction = vi.fn().mockImplementation(async (fn: any) => fn(manager));

    const svc = new KitchenService(
      orderRepository as any,
      {
        assertMember: vi.fn(),
        eventIdsFor: vi.fn().mockResolvedValue(null),
        eventColumnFor: vi.fn().mockReturnValue(null),
      } as any,
      { emitOrderUpdate: vi.fn() } as any,
    );

    await svc.atualizarEstado('o1', 'cancelled', { id: 'u1', role: 'superadmin' });

    expect(balanceSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b1', currentBalance: 15 }),
    );
    expect(manager.save).toHaveBeenCalledWith(
      BalanceMovementEntity,
      expect.objectContaining({ type: MovementType.REFUND, amount: 10, orderId: 'o1' }),
    );
  });

  // NOTE (B1-concorrência): tal como no order.service, chamadas a
  // atualizarEstado(cancelled) em paralelo só podem reembolsar uma vez — mas é
  // análise, não teste (mocks não simulam corrida real). Ver common/order-refund.ts.
});