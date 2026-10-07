import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { OrderService } from './order.service';
import { EventService } from '../event/event.service';
import { BalanceMovementEntity, MovementType } from '../../entities';

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
      findOne: vi.fn().mockResolvedValueOnce({
        id: 'o1',
        status: 'received',
        balanceId: 'b1',
        balanceUsed: 10,
      }),
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
});