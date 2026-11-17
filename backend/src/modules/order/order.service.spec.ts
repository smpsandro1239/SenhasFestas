import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { OrderService } from './order.service';
import { EventService } from '../event/event.service';
import { BalanceMovementEntity, BalanceEntity, EventUserEntity, MovementType, OrderEntity, OrderItemEntity, ProductEntity } from '../../entities';

describe('OrderService — guard de janela operacional', () => {
  const eventService = {
    assertEventOperavel: vi.fn(),
  } as unknown as EventService;

  const orderService = new OrderService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {
      findOne: vi.fn().mockResolvedValue({ id: 'evt1', status: 'active' }),
    } as any,
    {} as any,
    {} as any,
    {
      generateOrderQRCode: vi.fn().mockResolvedValue('qr'),
    } as any,
    {
      emitOrderUpdate: vi.fn(),
    } as any,
    {
      notifyNewOrder: vi.fn().mockResolvedValue(undefined),
    } as any,
    eventService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    (orderService as any).findOne = vi.fn().mockResolvedValue({ id: 'order1' });
  });

  it('chama assertEventOperavel com o evento antes de criar', async () => {
    (orderService as any).eventUserRepository.findOne = vi.fn().mockResolvedValue({ id: 'membership' });
    const savedOrder = { id: 'order1', status: 'received' };
    (orderService as any).dataSource.transaction = vi.fn().mockImplementation(async (fn: any) =>
      fn({
        findBy: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockReturnValue(savedOrder),
        save: vi.fn().mockResolvedValue(savedOrder),
      }),
    );

    await orderService.create({ id: 'u1', role: 'client' }, { eventId: 'evt1', items: [], source: 'qr' } as any);

    expect(eventService.assertEventOperavel).toHaveBeenCalledTimes(1);
    expect(eventService.assertEventOperavel).toHaveBeenCalledWith({ id: 'evt1', status: 'active' });
  });

  it('bloqueia a criação quando a janela já fechou', async () => {
    (eventService.assertEventOperavel as any).mockRejectedValueOnce(
      new ForbiddenException('Fora da janela operacional'),
    );
    (orderService as any).dataSource.transaction = vi.fn();

    await expect(
      orderService.create({ id: 'u1', role: 'client' }, { eventId: 'evt1', items: [], source: 'qr' } as any),
    ).rejects.toThrow(ForbiddenException);
    expect((orderService as any).dataSource.transaction).not.toHaveBeenCalled();
  });
});

describe('OrderService — 1A: só FINANCE_ROLES mexe em saldo (B2)', () => {
  it('bar não pode consumir saldo ao criar pedido', async () => {
    const eventRepository = {
      findOne: vi.fn().mockResolvedValue({ id: 'evt1', status: 'active' }),
    };
    const eventUserRepository = {
      findOne: vi.fn().mockResolvedValue({ id: 'm1' }),
    };
    const manager = {
      find: vi.fn().mockResolvedValue([{ id: 'p1', price: 100, isActive: true, event: { id: 'evt1' } }]),
      create: vi.fn().mockImplementation((_entity: any, data: any) => data),
      save: vi.fn().mockImplementation((_entity: any, data: any) => Promise.resolve(data)),
    };
    const dataSource = {
      transaction: vi.fn().mockImplementation(async (fn: any) => fn(manager)),
    };
    const svc = new OrderService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      eventRepository as any,
      eventUserRepository as any,
      dataSource as any,
      { generateOrderQRCode: vi.fn().mockResolvedValue('qr') } as any,
      { emitOrderUpdate: vi.fn() } as any,
      { notifyNewOrder: vi.fn().mockResolvedValue(undefined) } as any,
      { assertEventOperavel: vi.fn() } as any,
    );

    await expect(
      svc.create(
        { id: 'u1', role: 'bar' },
        {
          eventId: 'evt1',
          items: [{ productId: 'p1', quantity: 1 }],
          source: 'qr',
          paymentMethod: 'balance',
          balanceId: 'b1',
          balanceUsed: 100,
        } as any,
      ),
    ).rejects.toThrow('A tua função não permite operações de saldo. Contacta o caixa ou o organizador.');
  });

  it('bar não pode cancelar pedido com saldo via updateStatus', async () => {
    const orderRepository = {
      findOne: vi.fn().mockResolvedValue({
        id: 'o1',
        status: 'received',
        event: { id: 'evt1' },
        balanceId: 'b1',
        balanceUsed: 10,
      }),
    };
    const eventUserRepository = {
      findOne: vi.fn().mockResolvedValue({ id: 'm1' }),
    };
    const manager = {
      findOne: vi.fn().mockImplementation((entity: any) =>
        entity === EventUserEntity
          ? Promise.resolve({ id: 'm1' })
          : Promise.resolve({
              id: 'o1',
              status: 'received',
              balanceId: 'b1',
              balanceUsed: 10,
              event: { id: 'evt1' },
            }),
      ),
      save: vi.fn().mockImplementation((_entity: any, data: any) => Promise.resolve(data)),
      create: vi.fn().mockImplementation((_entity: any, data: any) => data),
    };
    const dataSource = {
      transaction: vi.fn().mockImplementation(async (fn: any) => fn(manager)),
    };
    const svc = new OrderService(
      orderRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      eventUserRepository as any,
      dataSource as any,
      { generateOrderQRCode: vi.fn() } as any,
      { emitOrderUpdate: vi.fn() } as any,
      { notifyNewOrder: vi.fn() } as any,
      { assertEventOperavel: vi.fn() } as any,
    );

    await expect(
      svc.updateStatus('o1', 'cancelled', { id: 'u1', role: 'bar' }),
    ).rejects.toThrow('A tua função não permite operações de saldo. Contacta o caixa ou o organizador.');
  });

  it('client não pode consumir saldo de outro utilizador', async () => {
    const eventRepository = {
      findOne: vi.fn().mockResolvedValue({ id: 'evt1', status: 'active' }),
    };
    const eventUserRepository = {
      findOne: vi.fn().mockResolvedValue({ id: 'm1' }),
    };
    const manager = {
      find: vi.fn().mockResolvedValue([{ id: 'p1', price: 100, isActive: true, event: { id: 'evt1' } }]),
      create: vi.fn().mockImplementation((_entity: any, data: any) => data),
      save: vi.fn().mockImplementation((_entity: any, data: any) => Promise.resolve(data)),
      findOne: vi.fn().mockResolvedValue({ id: 'b1', user: { id: 'u2' }, event: { id: 'evt1' } }),
    };
    const dataSource = {
      transaction: vi.fn().mockImplementation(async (fn: any) => fn(manager)),
    };
    const svc = new OrderService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      eventRepository as any,
      eventUserRepository as any,
      dataSource as any,
      { generateOrderQRCode: vi.fn().mockResolvedValue('qr') } as any,
      { emitOrderUpdate: vi.fn() } as any,
      { notifyNewOrder: vi.fn().mockResolvedValue(undefined) } as any,
      { assertEventOperavel: vi.fn() } as any,
    );

    await expect(
      svc.create(
        { id: 'u1', role: 'client' },
        {
          eventId: 'evt1',
          items: [{ productId: 'p1', quantity: 1 }],
          source: 'qr',
          paymentMethod: 'balance',
          balanceId: 'b1',
          balanceUsed: 100,
        } as any,
      ),
    ).rejects.toThrow('Não pode usar o saldo de outro utilizador');
  });

  it('pedido com saldo arquivado → 409 Saldo indisponível', async () => {
    const eventRepository = {
      findOne: vi.fn().mockResolvedValue({ id: 'evt1', status: 'active' }),
    };
    const eventUserRepository = {
      findOne: vi.fn().mockResolvedValue({ id: 'm1' }),
    };
    const manager = {
      find: vi.fn().mockResolvedValue([{ id: 'p1', price: 100, isActive: true, event: { id: 'evt1' } }]),
      create: vi.fn().mockImplementation((_entity: any, data: any) => data),
      save: vi.fn().mockImplementation((_entity: any, data: any) => Promise.resolve(data)),
      findOne: vi.fn().mockResolvedValue({
        id: 'b1',
        currentBalance: 100,
        archivedAt: new Date('2026-10-02T10:00:00Z'),
        user: { id: 'u1' },
        event: { id: 'evt1', endDate: '2026-09-01', balanceGraceDays: 3 },
      }),
    };
    const dataSource = {
      transaction: vi.fn().mockImplementation(async (fn: any) => fn(manager)),
    };
    const svc = new OrderService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      eventRepository as any,
      eventUserRepository as any,
      dataSource as any,
      { generateOrderQRCode: vi.fn().mockResolvedValue('qr') } as any,
      { emitOrderUpdate: vi.fn() } as any,
      { notifyNewOrder: vi.fn().mockResolvedValue(undefined) } as any,
      { assertEventOperavel: vi.fn() } as any,
    );

    await expect(
      svc.create(
        { id: 'u1', role: 'client' },
        {
          eventId: 'evt1',
          items: [{ productId: 'p1', quantity: 1 }],
          source: 'qr',
          paymentMethod: 'balance',
          balanceId: 'b1',
          balanceUsed: 100,
        } as any,
      ),
    ).rejects.toThrow('Saldo indisponível desde');
  });

  it('cashier pode cancelar pedido com saldo via updateStatus', async () => {
    const orderRepository = {
      findOne: vi.fn().mockResolvedValue({
        id: 'o1',
        status: 'received',
        event: { id: 'evt1' },
        balanceId: 'b1',
        balanceUsed: 10,
      }),
    };
    const balanceSave = vi.fn();
    const manager = {
      query: vi.fn().mockResolvedValue(undefined),
      find: vi.fn().mockResolvedValue([]),
      findOne: vi
        .fn()
        .mockResolvedValueOnce({ id: 'o1', status: 'received', balanceId: 'b1', balanceUsed: 10, event: { id: 'evt1' } })
        .mockResolvedValueOnce({ id: 'm1' })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'b1', currentBalance: 5 }),
      save: vi.fn().mockImplementation((_entity: any, data: any) => {
        if (data?.currentBalance !== undefined) balanceSave(data);
        return Promise.resolve(data);
      }),
      create: vi.fn().mockImplementation((_entity: any, data: any) => data),
    };
    const dataSource = {
      transaction: vi.fn().mockImplementation(async (fn: any) => fn(manager)),
    };
    const eventUserRepository = {
      findOne: vi.fn().mockResolvedValue({ id: 'm1' }),
    };
    const svc = new OrderService(
      orderRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      eventUserRepository as any,
      dataSource as any,
      { generateOrderQRCode: vi.fn() } as any,
      { emitOrderUpdate: vi.fn() } as any,
      { notifyNewOrder: vi.fn() } as any,
      { assertEventOperavel: vi.fn() } as any,
    );

    await svc.updateStatus('o1', 'cancelled', { id: 'u1', role: 'cashier' });

    expect(balanceSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b1', currentBalance: 15 }),
    );
    expect(manager.save).toHaveBeenCalledWith(
      BalanceMovementEntity,
      expect.objectContaining({ type: MovementType.REFUND, amount: 10, orderId: 'o1' }),
    );
  });
});

describe('OrderService — cancelamento via updateStatus deve reembolsar saldo (B1)', () => {
  it('reembolsa o saldo consumido quando cancela por status (RED)', async () => {
    const orderRepository = {
      findOne: vi.fn().mockResolvedValue({
        id: 'o1',
        status: 'received',
        event: { id: 'evt1' },
        balanceId: 'b1',
        balanceUsed: 10,
      }),
    };
    const balanceSave = vi.fn();
    const manager = {
      query: vi.fn().mockResolvedValue(undefined),
      find: vi.fn().mockResolvedValue([]),
      findOne: vi
        .fn()
        .mockResolvedValueOnce({ id: 'o1', status: 'received', balanceId: 'b1', balanceUsed: 10 })
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'b1', currentBalance: 5 }),
      save: vi.fn().mockImplementation((_entity: any, data: any) => {
        if (data?.currentBalance !== undefined) balanceSave(data);
        return Promise.resolve(data);
      }),
      create: vi.fn().mockImplementation((_entity: any, data: any) => data),
    };
    const dataSource = {
      transaction: vi.fn().mockImplementation(async (fn: any) => fn(manager)),
    };
    const eventUserRepository = {
      findOne: vi.fn().mockResolvedValue({ id: 'm1' }),
    };
    const svc = new OrderService(
      orderRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      eventUserRepository as any,
      dataSource as any,
      { generateOrderQRCode: vi.fn() } as any,
      { emitOrderUpdate: vi.fn() } as any,
      { notifyNewOrder: vi.fn() } as any,
      { assertEventOperavel: vi.fn() } as any,
    );

    await svc.updateStatus('o1', 'cancelled', { id: 'u1', role: 'superadmin' });

    expect(balanceSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b1', currentBalance: 15 }),
    );
    expect(manager.save).toHaveBeenCalledWith(
      BalanceMovementEntity,
      expect.objectContaining({ type: MovementType.REFUND, amount: 10, orderId: 'o1' }),
    );
  });

  // NOTE (B1-concorrência): duas chamadas a updateStatus(cancelled) em paralelo
  // reembolsarem apenas uma vez é análise, não teste — os mocks de vitest não
  // exercitam corrida real entre transações. A garantia assenta em
  // cancelled/delivered serem terminais + stale check com lock pessimista
  // (ver common/order-refund.ts). Só um e2e com base real a pode confirmar;
  // por isso não deixamos it.todo a prometer mais do que conseguimos testar.
});

describe('OrderService — A8: valida produtos ativos, do evento e com stock (RED)', () => {
  function makeSvc(manager: any) {
    const eventRepository = {
      findOne: vi.fn().mockResolvedValue({ id: 'evt1', status: 'active' }),
    };
    const eventUserRepository = {
      findOne: vi.fn().mockResolvedValue({ id: 'm1' }),
    };
    const dataSource = {
      transaction: vi.fn().mockImplementation(async (fn: any) => fn(manager)),
    };
    return new OrderService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      eventRepository as any,
      eventUserRepository as any,
      dataSource as any,
      { generateOrderQRCode: vi.fn().mockResolvedValue('qr') } as any,
      { emitOrderUpdate: vi.fn() } as any,
      { notifyNewOrder: vi.fn().mockResolvedValue(undefined) } as any,
      { assertEventOperavel: vi.fn() } as any,
    );
  }

  function makeManager(products: any[]) {
    const find = vi.fn().mockResolvedValue(products);
    return {
      find,
      findBy: vi.fn().mockResolvedValue(products),
      create: vi.fn().mockImplementation((_entity: any, data: any) => data),
      save: vi.fn().mockImplementation((_entity: any, data: any) => Promise.resolve(data)),
    };
  }

  it('rejeita produto de outro evento', async () => {
    const manager = makeManager([{ id: 'p1', price: 100, isActive: true, event: { id: 'evt2' } }]);
    const svc = makeSvc(manager);

    await expect(
      svc.create({ id: 'u1', role: 'client' }, {
        eventId: 'evt1',
        items: [{ productId: 'p1', quantity: 1 }],
        source: 'qr',
      } as any),
    ).rejects.toThrow('Produto indisponível neste evento');
  });

  it('rejeita produto inativo', async () => {
    const manager = makeManager([{ id: 'p1', price: 100, isActive: false, event: { id: 'evt1' } }]);
    const svc = makeSvc(manager);

    await expect(
      svc.create({ id: 'u1', role: 'client' }, {
        eventId: 'evt1',
        items: [{ productId: 'p1', quantity: 1 }],
        source: 'qr',
      } as any),
    ).rejects.toThrow('Produto indisponível');
  });

  it('rejeita quantity acima do stock definido', async () => {
    const manager = makeManager([{ id: 'p1', price: 100, isActive: true, event: { id: 'evt1' }, stock: 1 }]);
    const svc = makeSvc(manager);

    await expect(
      svc.create({ id: 'u1', role: 'client' }, {
        eventId: 'evt1',
        items: [{ productId: 'p1', quantity: 5 }],
        source: 'qr',
      } as any),
    ).rejects.toThrow('Stock insuficiente');
  });

  it('agrega quantidades de linhas repetidas do mesmo produto antes de validar stock', async () => {
    const p1 = { id: 'p1', price: 100, isActive: true, event: { id: 'evt1' }, stock: 3 };
    const manager = makeManager([p1]);
    const svc = makeSvc(manager);

    await expect(
      svc.create({ id: 'u1', role: 'client' }, {
        eventId: 'evt1',
        items: [
          { productId: 'p1', quantity: 2, notes: 'sem gelo' },
          { productId: 'p1', quantity: 2, notes: 'com gelo' },
        ],
        source: 'qr',
      } as any),
    ).rejects.toThrow('Stock insuficiente');

    expect(manager.save).not.toHaveBeenCalledWith(ProductEntity, expect.anything());
  });

  it('aceita produto válido sem stock definido (regressão)', async () => {
    const manager = makeManager([{ id: 'p1', price: 100, isActive: true, event: { id: 'evt1' }, stock: null }]);
    const svc = makeSvc(manager);
    (svc as any).findOne = vi.fn().mockResolvedValue({ id: 'order1' });

    const result = await svc.create({ id: 'u1', role: 'client' }, {
      eventId: 'evt1',
      items: [{ productId: 'p1', quantity: 2 }],
      source: 'qr',
    } as any);

    expect(result).toBeDefined();
  });

  it('decrementa o stock dos produtos com controlo ao criar o pedido', async () => {
    const p1 = { id: 'p1', price: 100, isActive: true, event: { id: 'evt1' }, stock: 5 };
    const manager = makeManager([p1]);
    const svc = makeSvc(manager);
    (svc as any).findOne = vi.fn().mockResolvedValue({ id: 'order1' });

    await svc.create({ id: 'u1', role: 'client' }, {
      eventId: 'evt1',
      items: [{ productId: 'p1', quantity: 2 }],
      source: 'qr',
    } as any);

    expect(p1.stock).toBe(3);
    expect(manager.save).toHaveBeenCalledWith(ProductEntity, expect.objectContaining({ stock: 3 }));
  });

  it('mantém intocável o produto sem controlo de stock (stock null)', async () => {
    const p1 = { id: 'p1', price: 100, isActive: true, event: { id: 'evt1' }, stock: null };
    const manager = makeManager([p1]);
    const svc = makeSvc(manager);
    (svc as any).findOne = vi.fn().mockResolvedValue({ id: 'order1' });

    await svc.create({ id: 'u1', role: 'client' }, {
      eventId: 'evt1',
      items: [{ productId: 'p1', quantity: 4 }],
      source: 'qr',
    } as any);

    expect(manager.save).not.toHaveBeenCalledWith(ProductEntity, expect.anything());
  });

  it('relê os produtos com controlo com lock pessimista antes de validar', async () => {
    const p1 = { id: 'p1', price: 100, isActive: true, event: { id: 'evt1' }, stock: 5 };
    const manager = makeManager([p1]);
    const svc = makeSvc(manager);
    (svc as any).findOne = vi.fn().mockResolvedValue({ id: 'order1' });

    await svc.create({ id: 'u1', role: 'client' }, {
      eventId: 'evt1',
      items: [{ productId: 'p1', quantity: 1 }],
      source: 'qr',
    } as any);

    // call 0 = pre-load sem lock; call 1 = relock pessimista dos controlados
    const lockedCall = manager.find.mock.calls[1]?.[1];
    expect(lockedCall?.lock).toEqual({ mode: 'pessimistic_write' });
  });
});

describe('OrderService — cancelamento repõe stock (B1c)', () => {
  function makeSvc(manager: any) {
    const orderRepository = {
      findOne: vi.fn().mockResolvedValue({
        id: 'o1',
        status: 'received',
        event: { id: 'evt1' },
      }),
    };
    const eventUserRepository = {
      findOne: vi.fn().mockResolvedValue({ id: 'm1' }),
    };
    const dataSource = {
      transaction: vi.fn().mockImplementation(async (fn: any) => fn(manager)),
    };
    return new OrderService(
      orderRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      eventUserRepository as any,
      dataSource as any,
      { generateOrderQRCode: vi.fn() } as any,
      { emitOrderUpdate: vi.fn() } as any,
      { notifyNewOrder: vi.fn() } as any,
      { assertEventOperavel: vi.fn() } as any,
    );
  }

  function makeManager(produto: any) {
    const itens = [{ quantity: 2, product: { id: produto.id } }];
    return {
      find: vi.fn().mockImplementation((entity: any) =>
        entity === OrderItemEntity ? Promise.resolve(itens) :
        entity === ProductEntity ? Promise.resolve([produto]) :
        Promise.resolve([]),
      ),
      findOne: vi.fn().mockImplementation((entity: any) =>
        entity === EventUserEntity
          ? Promise.resolve({ id: 'm1' })
          : Promise.resolve({ id: 'o1', status: 'received', event: { id: 'evt1' } }),
      ),
      save: vi.fn().mockImplementation((_e: any, d: any) => Promise.resolve(d)),
      create: vi.fn().mockImplementation((_e: any, d: any) => d),
    };
  }

  it('devolve ao stock as unidades de produtos com controlo', async () => {
    const p1 = { id: 'p1', price: 100, isActive: true, event: { id: 'evt1' }, stock: 3 };
    const manager = makeManager(p1);
    const svc = makeSvc(manager);

    await svc.cancelOrder('o1', { id: 'u1', role: 'cashier' });

    expect(p1.stock).toBe(5);
    expect(manager.save).toHaveBeenCalledWith(ProductEntity, expect.objectContaining({ stock: 5 }));
  });

  it('revalida a membership dentro da transação antes de cancelar', async () => {
    const order = { id: 'o1', status: 'received', event: { id: 'evt1' } };
    const manager = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockImplementation((entity: any) =>
        entity === OrderEntity ? Promise.resolve(order) :
        entity === EventUserEntity ? Promise.resolve(null) :
        Promise.resolve(null),
      ),
      save: vi.fn().mockImplementation((_e: any, d: any) => Promise.resolve(d)),
      create: vi.fn().mockImplementation((_e: any, d: any) => d),
    };
    const svc = makeSvc(manager);

    await expect(svc.cancelOrder('o1', { id: 'u1', role: 'cashier' }))
      .rejects.toThrow('Não pertence a este evento');
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('revalida a titularidade do saldo do cliente dentro da transação', async () => {
    const order = {
      id: 'o1',
      status: 'received',
      event: { id: 'evt1' },
      balanceId: 'b1',
      balanceUsed: 10,
    };
    const orderRepository = { findOne: vi.fn().mockResolvedValue(order) };
    const balanceRepository = {
      findOne: vi.fn().mockResolvedValue({ id: 'b1', user: { id: 'u1' }, deletedAt: new Date('2026-02-01') }),
    };
    const manager = {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockImplementation((entity: any) =>
        entity === OrderEntity ? Promise.resolve(order) :
        entity === BalanceEntity ? Promise.resolve({ id: 'b1', user: { id: 'u2' }, deletedAt: new Date('2026-02-01') }) :
        Promise.resolve(null),
      ),
      save: vi.fn().mockImplementation((_e: any, d: any) => Promise.resolve(d)),
      create: vi.fn().mockImplementation((_e: any, d: any) => d),
    };
    const dataSource = { transaction: vi.fn().mockImplementation(async (fn: any) => fn(manager)) };
    const svc = new OrderService(
      orderRepository as any, {} as any, balanceRepository as any, {} as any, {} as any,
      {} as any, { findOne: vi.fn().mockResolvedValue({ id: 'm1', role: 'client' }) } as any, dataSource as any,
      {} as any, {} as any, {} as any, {} as any,
    );

    await expect(svc.cancelOrder('o1', { id: 'u1', role: 'client' }))
      .rejects.toThrow('Não pode cancelar o pedido de outro utilizador');
    expect(manager.save).not.toHaveBeenCalled();
    expect(balanceRepository.findOne).toHaveBeenCalledWith(expect.objectContaining({ withDeleted: true }));
    const consultaSaldo = manager.findOne.mock.calls.find((call: any[]) => call[0] === BalanceEntity);
    expect(consultaSaldo?.[1]).toEqual(expect.objectContaining({ withDeleted: true }));
  });

  it('não permite cancelar um pedido que já chegou a pronto', async () => {
    const orderRepository = {
      findOne: vi.fn().mockResolvedValue({ id: 'o1', status: 'ready', event: { id: 'evt1' } }),
    };
    const dataSource = { transaction: vi.fn() };
    const svc = new OrderService(
      orderRepository as any, {} as any, {} as any, {} as any, {} as any,
      {} as any, { findOne: vi.fn().mockResolvedValue({ id: 'm1' }) } as any,
      dataSource as any, {} as any, {} as any, {} as any, {} as any,
    );

    await expect(svc.cancelOrder('o1', { id: 'u1', role: 'cashier' }))
      .rejects.toThrow('Pedido não pode ser cancelado neste estado');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('não mexe em produtos sem controlo de stock', async () => {
    const p1 = { id: 'p1', price: 100, isActive: true, event: { id: 'evt1' }, stock: null };
    const manager = makeManager(p1);
    const svc = makeSvc(manager);

    await svc.cancelOrder('o1', { id: 'u1', role: 'cashier' });

    expect(manager.save).not.toHaveBeenCalledWith(ProductEntity, expect.anything());
  });
});

describe('OrderService — snapshot anterior para auditoria (arquivar)', () => {
  function svcCom(orderRepo: any, manager: any) {
    const dataSource = { transaction: vi.fn().mockImplementation(async (fn: any) => fn(manager)) };
    return new OrderService(
      orderRepo as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { findOne: vi.fn().mockResolvedValue({ id: 'm1' }) } as any,
      dataSource as any,
      { generateOrderQRCode: vi.fn() } as any,
      { emitOrderUpdate: vi.fn() } as any,
      {
        notifyNewOrder: vi.fn(),
        notifyOrderPrepared: vi.fn(),
        notifyOrderReady: vi.fn(),
        notifyOrderDelivered: vi.fn(),
      } as any,
      { assertEventOperavel: vi.fn() } as any,
    );
  }

  function managerBase() {
    return {
      find: vi.fn().mockResolvedValue([]),
      findOne: vi.fn().mockResolvedValue({ id: 'o1', status: 'received' }),
      save: vi.fn().mockImplementation((_e: any, d: any) => Promise.resolve(d)),
      create: vi.fn().mockImplementation((_e: any, d: any) => d),
    };
  }

  it('updateStatus arquiva o estado anterior e o evento', async () => {
    const orderRepo = {
      findOne: vi.fn().mockResolvedValue({
        id: 'o1',
        status: 'received',
        total: 12.5,
        balanceUsed: 0,
        paymentMethod: 'cash',
        balanceId: null,
        event: { id: 'evt1' },
      }),
    };
    const svc = svcCom(orderRepo, managerBase());
    const arquivar = vi.fn();

    await svc.updateStatus('o1', 'cancelled', { id: 'u1', role: 'superadmin' }, arquivar);

    expect(arquivar).toHaveBeenCalledWith({
      antes: {
        status: 'received',
        total: 12.5,
        balanceUsed: 0,
        paymentMethod: 'cash',
        balanceId: null,
      },
      eventId: 'evt1',
      extras: {
        transition: 'received -> cancelled',
        stockRestorationProcessed: true,
        refundAmount: 0,
      },
    });
  });

  it('cancelOrder arquiva o estado anterior e o evento', async () => {
    const orderRepo = {
      findOne: vi.fn().mockResolvedValue({
        id: 'o1',
        status: 'received',
        total: 12.5,
        balanceUsed: 0,
        paymentMethod: 'cash',
        balanceId: null,
        event: { id: 'evt1' },
      }),
    };
    const svc = svcCom(orderRepo, managerBase());
    const arquivar = vi.fn();

    await svc.cancelOrder('o1', { id: 'u1', role: 'superadmin' }, arquivar);

    expect(arquivar).toHaveBeenCalledWith({
      antes: {
        status: 'received',
        total: 12.5,
        balanceUsed: 0,
        paymentMethod: 'cash',
        balanceId: null,
      },
      eventId: 'evt1',
      extras: {
        stockRestorationProcessed: true,
        refundAmount: 0,
      },
    });
  });
});

describe('OrderService — integridade do saldo associado ao pedido', () => {
  function makeService(manager: any) {
    const eventRepository = {
      findOne: vi.fn().mockResolvedValue({ id: 'evt1', status: 'active' }),
    };
    const eventUserRepository = {
      findOne: vi.fn().mockResolvedValue({ id: 'membership-1' }),
    };
    const dataSource = {
      transaction: vi.fn().mockImplementation(async (callback: any) => callback(manager)),
    };
    return new OrderService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      eventRepository as any,
      eventUserRepository as any,
      dataSource as any,
      { generateOrderQRCode: vi.fn().mockResolvedValue('qr') } as any,
      { emitOrderUpdate: vi.fn() } as any,
      { notifyNewOrder: vi.fn().mockResolvedValue(undefined) } as any,
      { assertEventOperavel: vi.fn() } as any,
    );
  }

  function makeManager(balance: any) {
    return {
      find: vi.fn().mockResolvedValue([
        { id: 'p1', price: 100, isActive: true, event: { id: 'evt1' }, stock: null },
      ]),
      findOne: vi.fn().mockResolvedValue(balance),
      create: vi.fn().mockImplementation((_entity: any, data: any) => data),
      save: vi.fn().mockImplementation((_entity: any, data: any) => Promise.resolve(data)),
    };
  }

  it('rejeita balanceUsed positivo sem balanceId para não registar consumo sem movimento', async () => {
    const manager = makeManager(null);
    const service = makeService(manager);

    await expect(service.create(
      { id: 'u1', role: 'client' },
      {
        eventId: 'evt1',
        items: [{ productId: 'p1', quantity: 1 }],
        source: 'qr',
        paymentMethod: 'cash',
        balanceUsed: 25,
      } as any,
    )).rejects.toThrow('Usar saldo requer balanceId');

    expect(manager.create).not.toHaveBeenCalled();
    expect(manager.findOne).not.toHaveBeenCalled();
  });

  it('rejeita saldo legado sem evento associado', async () => {
    const manager = makeManager({
      id: 'b1',
      user: { id: 'u1' },
      event: null,
    });
    const service = makeService(manager);

    await expect(service.create(
      { id: 'u1', role: 'client' },
      {
        eventId: 'evt1',
        items: [{ productId: 'p1', quantity: 1 }],
        source: 'qr',
        paymentMethod: 'balance',
        balanceId: 'b1',
        balanceUsed: 100,
      } as any,
    )).rejects.toThrow('Saldo não pertence a este evento ou não tem evento associado');

    expect(manager.findOne).toHaveBeenCalledOnce();
  });

  it('rejeita saldo pertencente a outro evento', async () => {
    const manager = makeManager({
      id: 'b1',
      user: { id: 'u1' },
      event: { id: 'evt2' },
    });
    const service = makeService(manager);

    await expect(service.create(
      { id: 'u1', role: 'client' },
      {
        eventId: 'evt1',
        items: [{ productId: 'p1', quantity: 1 }],
        source: 'qr',
        paymentMethod: 'balance',
        balanceId: 'b1',
        balanceUsed: 100,
      } as any,
    )).rejects.toThrow('Saldo não pertence a este evento ou não tem evento associado');

    expect(manager.findOne).toHaveBeenCalledOnce();
  });
});
