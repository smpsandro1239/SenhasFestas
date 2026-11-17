import { describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderEntity } from '../../entities';

const USER = { id: 'user-1', role: 'client' };
const DTO = {
  eventId: 'event-1',
  source: 'qr',
  items: [],
};

function criarServico(existingOrders: any[] = []) {
  const orderRepository = {
    findOne: vi.fn(),
  };
  existingOrders.forEach((order) => orderRepository.findOne.mockResolvedValueOnce(order));
  const dataSource = { transaction: vi.fn() };
  const qrCodeService = { generateOrderQRCode: vi.fn().mockResolvedValue('qr-order') };
  const orderGateway = { emitOrderUpdate: vi.fn() };
  const notificationService = { notifyNewOrder: vi.fn().mockResolvedValue(undefined) };
  const eventRepository = { findOne: vi.fn().mockResolvedValue({ id: 'event-1', status: 'active' }) };
  const eventUserRepository = { findOne: vi.fn().mockResolvedValue({ id: 'membership-1' }) };
  const eventService = { assertEventOperavel: vi.fn().mockResolvedValue(undefined) };

  const service = new OrderService(
    orderRepository as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    eventRepository as any,
    eventUserRepository as any,
    dataSource as any,
    qrCodeService as any,
    orderGateway as any,
    notificationService as any,
    eventService as any,
  );
  (service as any).findOne = vi.fn().mockResolvedValue({ id: 'order-1', status: 'received' });

  return {
    service,
    orderRepository,
    dataSource,
    qrCodeService,
    orderGateway,
    notificationService,
    eventService,
  };
}

describe('OrderService — idempotência na criação', () => {
  it('devolve o pedido original sem repetir transação, stock, saldo ou notificações', async () => {
    const seed = criarServico();
    const requestHash = (seed.service as any).hashPedido(USER.id, DTO);
    const existing = {
      id: 'order-1',
      status: 'received',
      requestHash,
    };
    const { service, orderRepository, dataSource, qrCodeService, orderGateway, notificationService } =
      criarServico([existing]);

    const result = await service.create(USER, DTO as any, 'order-test-key-0001');

    expect(result).toEqual({ id: 'order-1', status: 'received', qrCode: 'qr-order' });
    expect(orderRepository.findOne).toHaveBeenCalledTimes(1);
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(qrCodeService.generateOrderQRCode).toHaveBeenCalledWith('order-1');
    expect(orderGateway.emitOrderUpdate).toHaveBeenCalledWith('order-1', 'received', 'event-1');
    expect(notificationService.notifyNewOrder).not.toHaveBeenCalled();
  });

  it('grava a chave e o hash na criação original e só emite os efeitos uma vez', async () => {
    const { service, dataSource, orderGateway, notificationService } = criarServico();
    const manager = {
      find: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockImplementation((_entity: any, data: any) => data),
      save: vi.fn().mockImplementation(async (_entity: any, data: any) => ({ ...data, id: 'order-1' })),
    };
    dataSource.transaction.mockImplementation(async (fn: any) => fn(manager));

    await service.create(USER, DTO as any, 'order-test-key-0001');

    expect(manager.create).toHaveBeenCalledWith(
      OrderEntity,
      expect.objectContaining({
        createdById: USER.id,
        idempotencyKey: 'order-test-key-0001',
        requestHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
    expect(orderGateway.emitOrderUpdate).toHaveBeenCalledTimes(1);
    expect(notificationService.notifyNewOrder).toHaveBeenCalledTimes(1);
  });

  it('rejeita a reutilização da mesma chave com payload diferente', async () => {
    const { service, dataSource } = criarServico([
      { id: 'order-1', status: 'received', requestHash: 'different-payload-hash' },
    ]);

    await expect(service.create(USER, DTO as any, 'order-test-key-0001')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('recupera o pedido vencedor quando duas transações competem pela mesma chave', async () => {
    const seed = criarServico();
    const requestHash = (seed.service as any).hashPedido(USER.id, DTO);
    const existing = { id: 'order-1', status: 'received', requestHash };
    const { service, orderRepository, dataSource, notificationService } = criarServico();
    orderRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    dataSource.transaction.mockRejectedValue({
      driverError: { code: '23505', constraint: 'UQ_orders_idempotency' },
    });

    const result = await service.create(USER, DTO as any, 'order-test-key-0001');

    expect(result.id).toBe('order-1');
    expect(orderRepository.findOne).toHaveBeenCalledTimes(2);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(notificationService.notifyNewOrder).not.toHaveBeenCalled();
  });

  it('rejeita chaves curtas ou com caracteres de controlo', async () => {
    const { service, orderRepository } = criarServico();

    await expect(service.create(USER, DTO as any, 'short')).rejects.toThrow('Idempotency-Key inválida');
    await expect(service.create(USER, DTO as any, 'invalid\nkey-123')).rejects.toThrow('Idempotency-Key inválida');
    expect(orderRepository.findOne).not.toHaveBeenCalled();
  });
  it('não trata outras violações UNIQUE como colisões de idempotência', async () => {
    const { service, orderRepository, dataSource } = criarServico();
    const erro = { driverError: { code: '23505', constraint: 'UQ_orders_other' } };
    dataSource.transaction.mockRejectedValue(erro);

    await expect(
      service.create(USER, DTO as any, 'order-test-key-0001'),
    ).rejects.toBe(erro);
    expect(orderRepository.findOne).toHaveBeenCalledTimes(1);
  });

});