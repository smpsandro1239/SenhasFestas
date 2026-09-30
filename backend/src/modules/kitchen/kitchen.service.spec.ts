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

describe('KitchenService — 1A: só FINANCE_ROLES mexe em saldo (B2)', () => {
  const criarSvc = (orderRepository: any) => {
    const svc = new KitchenService(
      orderRepository,
      {
        assertMember: vi.fn(),
        eventIdsFor: vi.fn().mockResolvedValue(null),
        eventColumnFor: vi.fn().mockReturnValue(null),
      } as any,
      { emitOrderUpdate: vi.fn() } as any,
    );
    return svc;
  };

  it('bar não pode cancelar pedido com saldo via atualizarEstado', async () => {
    const orderRepository = {
      findOne: vi.fn().mockResolvedValue({
        id: 'o1',
        status: 'received',
        event: { id: 'evt1' },
        balanceId: 'b1',
        balanceUsed: 10,
      }),
      manager: { transaction: null as any },
    };
    orderRepository.manager.transaction = vi.fn().mockImplementation(async (fn: any) =>
      fn({
        findOne: vi.fn().mockResolvedValue({
          id: 'o1',
          status: 'received',
          balanceId: 'b1',
          balanceUsed: 10,
        }),
        save: vi.fn().mockImplementation((_entity: any, data: any) => Promise.resolve(data)),
        create: vi.fn().mockImplementation((_entity: any, data: any) => data),
      }),
    );

    await expect(
      criarSvc(orderRepository as any).atualizarEstado('o1', 'cancelled', { id: 'u1', role: 'bar' }),
    ).rejects.toThrow('A tua função não permite operações de saldo. Contacta o caixa ou o organizador.');
  });

  it('cashier pode cancelar pedido com saldo via atualizarEstado', async () => {
    const orderRepository = {
      findOne: vi.fn().mockResolvedValue({
        id: 'o1',
        status: 'received',
        event: { id: 'evt1' },
        balanceId: 'b1',
        balanceUsed: 10,
      }),
      manager: { transaction: null as any },
    };
    const balanceSave = vi.fn();
    orderRepository.manager.transaction = vi.fn().mockImplementation(async (fn: any) =>
      fn({
        findOne: vi
          .fn()
          .mockResolvedValueOnce({ id: 'o1', status: 'received', balanceId: 'b1', balanceUsed: 10 })
          .mockResolvedValueOnce({ id: 'b1', currentBalance: 5 }),
        save: vi.fn().mockImplementation((_entity: any, data: any) => {
          if (data?.currentBalance !== undefined) balanceSave(data);
          return Promise.resolve(data);
        }),
        create: vi.fn().mockImplementation((_entity: any, data: any) => data),
      }),
    );

    await criarSvc(orderRepository as any).atualizarEstado('o1', 'cancelled', { id: 'u1', role: 'cashier' });

    expect(balanceSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b1', currentBalance: 15 }),
    );
  });
});
describe('KitchenService — A12: KDS mostra os pedidos mais recentes (ordem DESC, sem corte a 20)', () => {
  const criarPedidos = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      id: `p${i + 1}`,
      status: 'received',
      createdAt: new Date(2026, 0, i + 1).toISOString(), // p25 é o mais recente
      items: [],
      event: { id: 'evt1' },
    }));

  function criarRepoComPedidos(pedidos: any[]) {
    let take = 20;
    let skip = 0;
    let dir = 'ASC';
    const qb: any = {
      leftJoinAndSelect: vi.fn(() => qb),
      orderBy: vi.fn((_col: string, d: string) => {
        dir = d;
        return qb;
      }),
      andWhere: vi.fn(() => qb),
      take: vi.fn((n: number) => {
        take = n;
        return qb;
      }),
      skip: vi.fn((n: number) => {
        skip = n;
        return qb;
      }),
      getManyAndCount: vi.fn(async () => {
        const sorted = [...pedidos].sort((a, b) =>
          dir === 'DESC'
            ? new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            : new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        const sliced = sorted.slice(skip, skip + take);
        return [sliced, pedidos.length];
      }),
    };
    return { createQueryBuilder: vi.fn(() => qb), qb };
  }

  const criarSvc = (repo: any) =>
    new KitchenService(
      repo,
      {
        assertMember: vi.fn(),
        eventIdsFor: vi.fn().mockResolvedValue(null),
        eventColumnFor: vi.fn().mockReturnValue(null),
      } as any,
      { emitOrderUpdate: vi.fn() } as any,
    );

  it('com 25 pedidos received, o mais recente aparece na primeira página', async () => {
    const pedidos = criarPedidos(25);
    const repo = criarRepoComPedidos(pedidos);
    const svc = criarSvc(repo);

    const resultado = await svc.obterPedidos({}, { id: 'u1', role: 'kitchen' });

    expect(resultado.items[0]?.id).toBe('p25');
    expect(resultado.total).toBe(25);
  });
});
