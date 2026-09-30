import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { EventService } from '../event/event.service';

describe('BalanceService — guard de janela operacional', () => {
  const eventService = {
    assertEventOperavelById: vi.fn(),
  } as unknown as EventService;

  const orderGateway = {
    emitOrderUpdate: vi.fn(),
  };

  const balanceService = new BalanceService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {
      transaction: vi.fn(),
    } as any,
    eventService,
  );

  const eventoAtivo = { id: 'evt1', status: 'active' };

  beforeEach(() => vi.clearAllMocks());

  it('NÃO depende do OrderGateway (A4: saldo não emite no canal de pedidos)', () => {
    expect((balanceService as any).orderGateway).toBeUndefined();
  });

  describe('loadBalance', () => {
    it('chama assertEventOperavelById quando há eventId', async () => {
      (balanceService as any).dataSource.transaction.mockImplementation(async (fn: any) =>
        fn({
          findOne: vi.fn().mockResolvedValue({ id: 'b1', currentBalance: 0, event: eventoAtivo }),
          create: vi.fn(),
          save: vi.fn().mockImplementation((_e, entity) => Promise.resolve(entity)),
        }),
      );

      await balanceService.loadBalance('u1', { amount: 10, eventId: 'evt1' } as any, { id: 'staff' });

      expect(eventService.assertEventOperavelById).toHaveBeenCalledTimes(1);
      expect(eventService.assertEventOperavelById).toHaveBeenCalledWith('evt1');
    });

    it('bloqueia o carregamento quando a janela fechou', async () => {
      (eventService.assertEventOperavelById as any).mockRejectedValueOnce(
        new ForbiddenException('Fora da janela'),
      );

      await expect(
        balanceService.loadBalance('u1', { amount: 10, eventId: 'evt1' } as any, { id: 'staff' }),
      ).rejects.toThrow(ForbiddenException);
      expect((balanceService as any).dataSource.transaction).not.toHaveBeenCalled();
    });

    it('RECUSA carregamento sem eventId (evita saldo sem scope de evento)', async () => {
      (balanceService as any).dataSource.transaction = vi.fn();

      await expect(
        balanceService.loadBalance('u1', { amount: 10 } as any, { id: 'staff' }),
      ).rejects.toThrow(ForbiddenException);
      expect((balanceService as any).dataSource.transaction).not.toHaveBeenCalled();
    });

    it('NÃO emite eventos de saldo no canal de pedidos (A4)', async () => {
      (balanceService as any).dataSource.transaction.mockImplementation(async (fn: any) =>
        fn({
          findOne: vi.fn().mockResolvedValue({ id: 'b1', currentBalance: 0, event: eventoAtivo }),
          create: vi.fn(),
          save: vi.fn().mockImplementation((_e, entity) => Promise.resolve(entity)),
        }),
      );

      await balanceService.loadBalance('u1', { amount: 10, eventId: 'evt1' } as any, { id: 'staff' });

      expect(orderGateway.emitOrderUpdate).not.toHaveBeenCalled();
    });
  });

  describe('deductBalance', () => {
    it('chama assertEventOperavelById quando há eventId', async () => {
      (balanceService as any).dataSource.transaction.mockImplementation(async (fn: any) =>
        fn({
          findOne: vi.fn().mockResolvedValue({ id: 'b1', currentBalance: 100 }),
          save: vi.fn().mockImplementation((_e, entity) => Promise.resolve(entity)),
          create: vi.fn(),
        }),
      );

      await balanceService.deductBalance('u1', { amount: 10, eventId: 'evt1' } as any, { id: 'staff' });

      expect(eventService.assertEventOperavelById).toHaveBeenCalledTimes(1);
      expect(eventService.assertEventOperavelById).toHaveBeenCalledWith('evt1');
    });

    it('bloqueia o desconto quando a janela fechou', async () => {
      (eventService.assertEventOperavelById as any).mockRejectedValueOnce(
        new ForbiddenException('Fora da janela'),
      );

      await expect(
        balanceService.deductBalance('u1', { amount: 10, eventId: 'evt1' } as any, { id: 'staff' }),
      ).rejects.toThrow(ForbiddenException);
      expect((balanceService as any).dataSource.transaction).not.toHaveBeenCalled();
    });

    it('RECUSA desconto sem eventId (evita saldo sem scope de evento)', async () => {
      (balanceService as any).dataSource.transaction = vi.fn();

      await expect(
        balanceService.deductBalance('u1', { amount: 10 } as any, { id: 'staff' }),
      ).rejects.toThrow(ForbiddenException);
      expect((balanceService as any).dataSource.transaction).not.toHaveBeenCalled();
    });

    it('NÃO emite eventos de saldo no canal de pedidos (A4)', async () => {
      (balanceService as any).dataSource.transaction.mockImplementation(async (fn: any) =>
        fn({
          findOne: vi.fn().mockResolvedValue({ id: 'b1', currentBalance: 100 }),
          save: vi.fn().mockImplementation((_e, entity) => Promise.resolve(entity)),
          create: vi.fn(),
        }),
      );

      await balanceService.deductBalance('u1', { amount: 10, eventId: 'evt1' } as any, { id: 'staff' });

      expect(orderGateway.emitOrderUpdate).not.toHaveBeenCalled();
    });
  });

  describe('reverseLoad', () => {
    it('NÃO emite eventos de saldo no canal de pedidos (A4)', async () => {
      const movimento = {
        id: 'mov1',
        reversed: false,
        amount: 10,
        type: 'load',
        balance: { id: 'b1', user: { id: 'u1' }, event: eventoAtivo },
      };
      (balanceService as any).dataSource.transaction.mockImplementation(async (fn: any) => {
        const manager = {
          findOne: vi.fn().mockImplementation((entity: any, opts: any) => {
            const name = entity?.name;
            const whereId = opts?.where?.id;
            if (name === 'BalanceMovementEntity' && whereId === 'mov1') {
              return Promise.resolve(movimento);
            }
            if (name === 'BalanceEntity' && whereId === 'b1') {
              return Promise.resolve({ id: 'b1', currentBalance: 100 });
            }
            if (name === 'EventUserEntity') {
              return Promise.resolve({ id: 'm1' });
            }
            return Promise.resolve(null);
          }),
          save: vi.fn().mockImplementation((_e, entity) => Promise.resolve(entity)),
          create: vi.fn().mockImplementation((_e, data) => data),
        };
        return fn(manager);
      });

      await balanceService.reverseLoad(
        'u1',
        'mov1',
        { id: 'staff', role: 'cashier' },
        {} as any,
      );

      expect(orderGateway.emitOrderUpdate).not.toHaveBeenCalled();
    });
  });
});