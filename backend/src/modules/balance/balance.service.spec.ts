import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, ConflictException } from '@nestjs/common';
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

    it('rejeita estorno cross-event: membro só de outro evento → 403', async () => {
      const movimento = {
        id: 'mov1',
        reversed: false,
        amount: 10,
        type: 'load',
        balance: { id: 'b1', user: { id: 'u1' }, event: { id: 'evtA' } },
      };
      (balanceService as any).dataSource.transaction.mockImplementation(async (fn: any) => {
        const manager = {
          findOne: vi.fn().mockImplementation((entity: any, opts: any) => {
            const name = entity?.name;
            if (name === 'BalanceMovementEntity' && opts?.where?.id === 'mov1') {
              return Promise.resolve(movimento);
            }
            // Membro só de evtB, não de evtA do movimento
            if (name === 'EventUserEntity') {
              return Promise.resolve(null);
            }
            return Promise.resolve(null);
          }),
          save: vi.fn().mockImplementation((_e, entity) => Promise.resolve(entity)),
          create: vi.fn().mockImplementation((_e, data) => data),
        };
        return fn(manager);
      });

      await expect(
        balanceService.reverseLoad('u1', 'mov1', { id: 'staff', role: 'cashier' }, {} as any),
      ).rejects.toThrow('Não pertence a este evento');
    });

    it('permite estorno cross-event a superadmin (bypass)', async () => {
      const movimento = {
        id: 'mov1',
        reversed: false,
        amount: 10,
        type: 'load',
        balance: { id: 'b1', user: { id: 'u1' }, event: { id: 'evtA' } },
      };
      (balanceService as any).dataSource.transaction.mockImplementation(async (fn: any) => {
        const manager = {
          findOne: vi.fn().mockImplementation((entity: any, opts: any) => {
            const name = entity?.name;
            if (name === 'BalanceMovementEntity' && opts?.where?.id === 'mov1') {
              return Promise.resolve(movimento);
            }
            if (name === 'BalanceEntity' && opts?.where?.id === 'b1') {
              return Promise.resolve({ id: 'b1', currentBalance: 100 });
            }
            return Promise.resolve(null);
          }),
          save: vi.fn().mockImplementation((_e, entity) => Promise.resolve(entity)),
          create: vi.fn().mockImplementation((_e, data) => data),
        };
        return fn(manager);
      });

      const resultado = await balanceService.reverseLoad(
        'u1',
        'mov1',
        { id: 'root', role: 'superadmin' },
        {} as any,
      );

      expect(resultado.reversedMovementId).toBe('mov1');
      expect(resultado.eventId).toBe('evtA');
    });
  });

  describe('arquivamento de saldo (Parte 2)', () => {
    const eventoExpirado = { id: 'evt1', endDate: '2026-09-01', balanceGraceDays: 3 };

    function managerComSaldo(balance: any) {
      return {
        findOne: vi.fn().mockImplementation((entity: any, opts: any) => {
          const name = entity?.name;
          if (name === 'BalanceMovementEntity' && opts?.where?.id === 'mov1') {
            return Promise.resolve({
              id: 'mov1',
              reversed: false,
              amount: 10,
              type: 'load',
              balance: { id: balance.id, user: { id: 'u1' }, event: eventoExpirado },
            });
          }
          if (name === 'BalanceEntity') return Promise.resolve(balance);
          if (name === 'EventEntity') return Promise.resolve(balance.event ?? null);
          if (name === 'EventUserEntity') return Promise.resolve({ id: 'm1' });
          return Promise.resolve(null);
        }),
        save: vi.fn().mockImplementation((_e: any, entity: any) => Promise.resolve(entity)),
        create: vi.fn().mockImplementation((_e: any, data: any) => data),
      };
    }

    function serviceCom(balanceRepository: any) {
      return new BalanceService(
        balanceRepository,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        { transaction: vi.fn() } as any,
        eventService,
      );
    }

    it('deductBalance RECUSA consumo de saldo arquivado → 409', async () => {
      const balance = {
        id: 'b1',
        currentBalance: 50,
        archivedAt: new Date('2026-10-02T10:00:00Z'),
        event: eventoExpirado,
      };
      (balanceService as any).dataSource.transaction.mockImplementation(async (fn: any) =>
        fn(managerComSaldo(balance)),
      );

      await expect(
        balanceService.deductBalance('u1', { amount: 10, eventId: 'evt1' } as any, { id: 'staff' }),
      ).rejects.toThrow('Saldo indisponível desde');
    });

    it('deductBalance RECUSA consumo quando o prazo venceu, mesmo sem archivedAt (lazy)', async () => {
      const balance = { id: 'b1', currentBalance: 50, archivedAt: null, event: eventoExpirado };
      (balanceService as any).dataSource.transaction.mockImplementation(async (fn: any) =>
        fn(managerComSaldo(balance)),
      );

      await expect(
        balanceService.deductBalance('u1', { amount: 10, eventId: 'evt1' } as any, { id: 'staff' }),
      ).rejects.toThrow(ConflictException);
    });

    it('deductBalance PERMITE consumo quando extendedUntil adia o fim do prazo', async () => {
      const balance = {
        id: 'b1',
        currentBalance: 50,
        archivedAt: null,
        extendedUntil: new Date('2099-01-01T00:00:00Z'),
        event: eventoExpirado,
      };
      (balanceService as any).dataSource.transaction.mockImplementation(async (fn: any) =>
        fn(managerComSaldo(balance)),
      );

      const resultado = await balanceService.deductBalance(
        'u1',
        { amount: 10, eventId: 'evt1' } as any,
        { id: 'staff' },
      );

      expect(resultado.currentBalance).toBe(40);
    });

    it('loadBalance RECUSA carregar saldo arquivado → 409 (evita dinheiro preso)', async () => {
      const balance = {
        id: 'b1',
        currentBalance: 50,
        archivedAt: new Date('2026-10-02T10:00:00Z'),
        event: eventoExpirado,
      };
      (balanceService as any).dataSource.transaction.mockImplementation(async (fn: any) =>
        fn(managerComSaldo(balance)),
      );

      await expect(
        balanceService.loadBalance('u1', { amount: 10, eventId: 'evt1' } as any, { id: 'staff' }),
      ).rejects.toThrow('Saldo indisponível desde');
    });

    it('reverseLoad CONTINUA PERMITIDO com saldo arquivado (estorno é sempre possível)', async () => {
      const balance = {
        id: 'b1',
        currentBalance: 100,
        archivedAt: new Date('2026-10-02T10:00:00Z'),
        event: eventoExpirado,
      };
      (balanceService as any).dataSource.transaction.mockImplementation(async (fn: any) =>
        fn(managerComSaldo(balance)),
      );

      const resultado = await balanceService.reverseLoad('u1', 'mov1', { id: 'root', role: 'superadmin' }, {} as any);

      expect(resultado.reversedMovementId).toBe('mov1');
      expect(resultado.balance.currentBalance).toBe(90);
    });

    it('archiveExpiredBalances arquiva vencidos, ignora os vigentes e soft-deleta os arquivados há 30+ dias', async () => {
      const vencido = {
        id: 'b1',
        currentBalance: 10,
        archivedAt: null,
        deletedAt: null,
        event: eventoExpirado,
      };
      const vigente = {
        id: 'b2',
        currentBalance: 20,
        archivedAt: null,
        deletedAt: null,
        event: { id: 'evt2', endDate: '2099-12-31', balanceGraceDays: 3 },
      };
      const antigo = {
        id: 'b3',
        currentBalance: 5,
        archivedAt: new Date('2026-08-01T10:00:00Z'),
        deletedAt: null,
        event: eventoExpirado,
      };
      const balanceRepository = {
        find: vi.fn().mockResolvedValue([vencido, vigente, antigo]),
        save: vi.fn().mockImplementation((entity: any) => Promise.resolve(entity)),
      };
      const service = serviceCom(balanceRepository);

      const resultado = await service.archiveExpiredBalances();

      expect(resultado).toEqual({ arquivados: 1, removidos: 1 });
      const guardados = balanceRepository.save.mock.calls.map((c: any[]) => c[0]);
      expect(guardados.map((b: any) => b.id)).toEqual(['b1', 'b3']);
      expect(guardados[0].archivedAt).toBeInstanceOf(Date);
      expect(guardados[1].deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('extensão, desarquivamento e notificação (Parte 3)', () => {
    const evento = { id: 'evt1', endDate: '2026-10-10', balanceGraceDays: 3 };

    function serviceCom(balanceRepository: any) {
      return new BalanceService(
        balanceRepository,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        { transaction: vi.fn() } as any,
        eventService,
      );
    }

    function repoCom(balance: any) {
      return {
        findOne: vi.fn().mockResolvedValue(balance),
        save: vi.fn().mockImplementation((entity: any) => Promise.resolve(entity)),
      };
    }

    it('extendBalance grava extendedUntil e revive saldo arquivado', async () => {
      const repo = repoCom({
        id: 'b1',
        currentBalance: 10,
        archivedAt: new Date('2026-10-14T05:00:00Z'),
        extendedUntil: null,
        notifiedAt: null,
        user: { id: 'u1' },
        event: evento,
      });
      const service = serviceCom(repo);

      const res = await service.extendBalance('u1', { eventId: 'evt1', until: '2099-01-01' });

      expect(repo.save).toHaveBeenCalledTimes(1);
      const guardado = repo.save.mock.calls[0][0];
      expect(guardado.extendedUntil.toISOString()).toBe('2099-01-01T00:00:00.000Z');
      expect(guardado.archivedAt).toBeNull();
      expect(res.deadline).toBe('2099-01-01T00:00:00.000Z');
    });

    it('extendBalance RECUSA data no passado → 400', async () => {
      const repo = repoCom({
        id: 'b1',
        archivedAt: null,
        user: { id: 'u1' },
        event: evento,
      });
      const service = serviceCom(repo);

      await expect(
        service.extendBalance('u1', { eventId: 'evt1', until: '2020-01-01' }),
      ).rejects.toThrow('Data de extensão tem de ser futura');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('unarchiveBalance limpa archivedAt', async () => {
      const repo = repoCom({
        id: 'b1',
        currentBalance: 10,
        archivedAt: new Date('2026-10-14T05:00:00Z'),
        extendedUntil: null,
        notifiedAt: null,
        user: { id: 'u1' },
        event: evento,
      });
      const service = serviceCom(repo);

      const res = await service.unarchiveBalance('u1', 'evt1');

      const guardado = repo.save.mock.calls[0][0];
      expect(guardado.archivedAt).toBeNull();
      expect(res.archivedAt).toBeNull();
    });

    it('markNotified grava notifiedAt', async () => {
      const repo = repoCom({
        id: 'b1',
        currentBalance: 10,
        archivedAt: null,
        extendedUntil: null,
        notifiedAt: null,
        user: { id: 'u1' },
        event: evento,
      });
      const service = serviceCom(repo);

      const res = await service.markNotified('u1', 'evt1');

      const guardado = repo.save.mock.calls[0][0];
      expect(guardado.notifiedAt).toBeInstanceOf(Date);
      expect(res.notifiedAt).toBeInstanceOf(Date);
    });

    it('operações de saldo inexistente → 404', async () => {
      const repo = repoCom(null);
      const service = serviceCom(repo);

      await expect(
        service.extendBalance('u1', { eventId: 'evt1', until: '2099-01-01' }),
      ).rejects.toThrow('Saldo não encontrado');
    });

    it('getBalance expõe deadline e archivedAt (aviso do cliente)', async () => {
      const balanceRepository = {
        findOne: vi.fn().mockResolvedValue({
          id: 'b1',
          currentBalance: 25,
          archivedAt: null,
          extendedUntil: null,
          user: { id: 'u1' },
          event: evento,
        }),
      };
      const movementRepository = { find: vi.fn().mockResolvedValue([]) };
      const service = new BalanceService(
        balanceRepository as any,
        {} as any,
        movementRepository as any,
        {} as any,
        {} as any,
        { transaction: vi.fn() } as any,
        eventService,
      );

      const res = await service.getBalance('u1', 'evt1');

      expect(res.deadline).toBe('2026-10-14T05:00:00.000Z');
      expect(res.archivedAt).toBeNull();
      expect(res.balance).toBe(25);
    });
  });
});