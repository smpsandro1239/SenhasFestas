import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { OrderService } from './order.service';
import { EventService } from '../event/event.service';

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