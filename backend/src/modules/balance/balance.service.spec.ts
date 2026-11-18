import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException, ConflictException } from '@nestjs/common';
import { BalanceService } from './balance.service';
import { EventService } from '../event/event.service';
import { MovementType, BalanceMovementEntity, BalanceEntity, EventUserEntity } from '../../entities';

describe('BalanceService — guard de janela operacional', () => {
  const eventService = {
    assertEventOperavelById: vi.fn(),
    vincularCliente: vi.fn(),
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

    it('H2: cria vínculo EventUser (client) no load quando o cliente não é membro do evento', async () => {
      (balanceService as any).dataSource.transaction.mockImplementation(async (fn: any) =>
        fn({
          findOne: vi.fn().mockResolvedValue({ id: 'b1', currentBalance: 0, event: eventoAtivo }),
          create: vi.fn(),
          save: vi.fn().mockImplementation((_e, entity) => Promise.resolve(entity)),
        }),
      );

      await balanceService.loadBalance('u1', { amount: 10, eventId: 'evt1' } as any, { id: 'staff' });

      expect(eventService.vincularCliente).toHaveBeenCalledTimes(1);
      expect(eventService.vincularCliente).toHaveBeenCalledWith('u1', 'evt1');
    });

    it('H2: load num cliente que já é membro continua inalterado (vincularCliente é idempotente)', async () => {
      (balanceService as any).dataSource.transaction.mockImplementation(async (fn: any) =>
        fn({
          findOne: vi.fn().mockResolvedValue({ id: 'b1', currentBalance: 0, event: eventoAtivo }),
          create: vi.fn(),
          save: vi.fn().mockImplementation((_e, entity) => Promise.resolve(entity)),
        }),
      );

      const resultado = await balanceService.loadBalance('u1', { amount: 10, eventId: 'evt1' } as any, { id: 'staff' });

      expect(resultado.currentBalance).toBe(10);
      expect(eventService.vincularCliente).toHaveBeenCalledTimes(1);
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

    it('H2: cria vínculo EventUser (client) no deduct quando o cliente não é membro do evento', async () => {
      (balanceService as any).dataSource.transaction.mockImplementation(async (fn: any) =>
        fn({
          findOne: vi.fn().mockResolvedValue({ id: 'b1', currentBalance: 100 }),
          save: vi.fn().mockImplementation((_e, entity) => Promise.resolve(entity)),
          create: vi.fn(),
        }),
      );

      await balanceService.deductBalance('u1', { amount: 10, eventId: 'evt1' } as any, { id: 'staff' });

      expect(eventService.vincularCliente).toHaveBeenCalledTimes(1);
      expect(eventService.vincularCliente).toHaveBeenCalledWith('u1', 'evt1');
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
    it('acumula estornos parciais e o estorno final usa apenas o remanescente', async () => {
      const movimento: any = {
        id: 'mov-parcial',
        reversed: false,
        reversedAmount: 0,
        amount: 10,
        type: MovementType.LOAD,
        balance: { id: 'b1', user: { id: 'u1' }, event: eventoAtivo },
      };
      const saldo: any = { id: 'b1', currentBalance: 100 };
      const manager = {
        findOne: vi.fn().mockImplementation((entity: any) => {
          if (entity?.name === 'BalanceMovementEntity') return Promise.resolve(movimento);
          if (entity?.name === 'BalanceEntity') return Promise.resolve(saldo);
          return Promise.resolve(null);
        }),
        save: vi.fn().mockImplementation(async (_entity: any, value: any) => value),
        create: vi.fn().mockImplementation((_entity: any, value: any) => ({ ...value })),
      };
      (balanceService as any).dataSource.transaction.mockImplementation(async (fn: any) => fn(manager));

      await balanceService.reverseLoad(
        'u1',
        'mov-parcial',
        { id: 'root', role: 'superadmin' },
        { amount: 4 } as any,
      );

      expect(movimento.reversedAmount).toBe(4);
      expect(movimento.reversed).toBe(false);
      expect(saldo.currentBalance).toBe(96);

      await balanceService.reverseLoad(
        'u1',
        'mov-parcial',
        { id: 'root', role: 'superadmin' },
      );

      expect(movimento.reversedAmount).toBe(10);
      expect(movimento.reversed).toBe(true);
      expect(saldo.currentBalance).toBe(90);
      expect(manager.create).toHaveBeenCalledTimes(2);
    });

    it('não permite estornar mais do que o remanescente do carregamento', async () => {
      const movimento = {
        id: 'mov-parcial',
        reversed: false,
        reversedAmount: 7,
        amount: 10,
        type: MovementType.LOAD,
        balance: { id: 'b1', user: { id: 'u1' }, event: eventoAtivo },
      };
      const manager = {
        findOne: vi.fn().mockImplementation((entity: any) => {
          if (entity?.name === 'BalanceMovementEntity') return Promise.resolve(movimento);
          if (entity?.name === 'BalanceEntity') return Promise.resolve({ id: 'b1', currentBalance: 100 });
          return Promise.resolve(null);
        }),
        save: vi.fn(),
        create: vi.fn(),
      };
      (balanceService as any).dataSource.transaction.mockImplementation(async (fn: any) => fn(manager));

      await expect(
        balanceService.reverseLoad(
          'u1',
          'mov-parcial',
          { id: 'root', role: 'superadmin' },
          { amount: 4 } as any,
        ),
      ).rejects.toThrow('Valor a estornar excede o remanescente disponível');
      expect(manager.save).not.toHaveBeenCalled();
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

    function serviceCom(balanceRepository: any, membershipRole = 'cashier') {
      const queryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        withDeleted: vi.fn().mockReturnThis(),
        setLock: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockImplementation(() => balanceRepository.findOne({
          withDeleted: queryBuilder.withDeleted.mock.calls.length > 0,
        })),
      };
      const manager = {
        findOne: vi.fn().mockImplementation((entity: any) =>
          entity === EventUserEntity ? Promise.resolve({ id: 'membership', role: membershipRole }) : Promise.resolve(null),
        ),
        createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
        save: vi.fn().mockImplementation((_entity: any, balance: any) => balanceRepository.save(balance)),
      };
      const dataSource = { transaction: vi.fn().mockImplementation(async (callback: any) => callback(manager)) };
      const service = new BalanceService(balanceRepository, {} as any, {} as any, {} as any, {} as any, dataSource as any, eventService);
      (service as any).__manager = manager;
      (service as any).__queryBuilder = queryBuilder;
      return service;
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

    it('archiveExpiredBalances bloqueia e revalida cada saldo antes de arquivar/soft-delete', async () => {
      const now = new Date('2026-11-17T12:00:00.000Z');
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
      const atuais = new Map([
        ['b1', { ...vencido }],
        ['b2', { ...vigente }],
        ['b3', { ...antigo }],
      ]);
      const balanceRepository = {
        find: vi.fn().mockResolvedValue([vencido, vigente, antigo]),
      };
      const queryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        setLock: vi.fn().mockReturnThis(),
        withDeleted: vi.fn().mockReturnThis(),
        getOne: vi.fn()
          .mockResolvedValueOnce(atuais.get('b1'))
          .mockResolvedValueOnce(atuais.get('b2'))
          .mockResolvedValueOnce(atuais.get('b3')),
      };
      const manager = {
        createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
        save: vi.fn().mockImplementation(async (_entity: any, entity: any) => entity),
      };
      const dataSource = {
        transaction: vi.fn().mockImplementation(async (callback: any) => callback(manager)),
      };
      const service = new BalanceService(
        balanceRepository as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        dataSource as any,
        eventService,
      );

      const resultado = await service.archiveExpiredBalances(now);

      expect(resultado).toEqual({ arquivados: 1, removidos: 1 });
      expect(balanceRepository.find).toHaveBeenCalledWith(expect.objectContaining({ select: { id: true } }));
      expect(dataSource.transaction).toHaveBeenCalledTimes(3);
      expect(manager.createQueryBuilder).toHaveBeenCalledWith(BalanceEntity, 'saldo');
      expect(queryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write', undefined, ['saldo']);
      expect(queryBuilder.withDeleted).toHaveBeenCalledTimes(3);
      const guardados = manager.save.mock.calls.map((call: any[]) => call[1]);
      expect(guardados.map((balance: any) => balance.id)).toEqual(['b1', 'b3']);
      expect(guardados[0].archivedAt).toEqual(now);
      expect(guardados[1].deletedAt).toEqual(now);
    });

    it('archiveExpiredBalances não arquiva um saldo entretanto estendido', async () => {
      const now = new Date('2026-11-17T12:00:00.000Z');
      const candidatoDesactualizado = {
        id: 'b1',
        currentBalance: 10,
        archivedAt: null,
        deletedAt: null,
        event: eventoExpirado,
      };
      const saldoActual = {
        ...candidatoDesactualizado,
        extendedUntil: new Date('2099-01-01T00:00:00.000Z'),
      };
      const balanceRepository = { find: vi.fn().mockResolvedValue([candidatoDesactualizado]) };
      const queryBuilder = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        setLock: vi.fn().mockReturnThis(),
        withDeleted: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(saldoActual),
      };
      const manager = {
        createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
        save: vi.fn(),
      };
      const dataSource = {
        transaction: vi.fn().mockImplementation(async (callback: any) => callback(manager)),
      };
      const service = new BalanceService(
        balanceRepository as any,
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        dataSource as any,
        eventService,
      );

      const resultado = await service.archiveExpiredBalances(now);

      expect(resultado).toEqual({ arquivados: 0, removidos: 0 });
      expect(manager.save).not.toHaveBeenCalled();
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
        deletedAt: new Date('2026-11-14T05:00:00Z'),
        extendedUntil: null,
        notifiedAt: null,
        user: { id: 'u1' },
        event: evento,
      });
      const service = serviceCom(repo);

      const res = await service.extendBalance('u1', { eventId: 'evt1', until: '2099-01-01' }, { id: 'staff', role: 'cashier' });

      expect((service as any).__manager.findOne).toHaveBeenCalledWith(EventUserEntity, expect.objectContaining({ lock: { mode: 'pessimistic_read' } }));
      expect((service as any).__queryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write', undefined, ['saldo']);
      expect((service as any).__queryBuilder.withDeleted).toHaveBeenCalledTimes(1);
      expect(repo.save).toHaveBeenCalledTimes(1);
      const guardado = repo.save.mock.calls[0][0];
      expect(guardado.extendedUntil.toISOString()).toBe('2099-01-01T00:00:00.000Z');
      expect(guardado.archivedAt).toBeNull();
      expect(guardado.deletedAt).toBeNull();
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
        service.extendBalance('u1', { eventId: 'evt1', until: '2020-01-01' }, { id: 'staff', role: 'cashier' }),
      ).rejects.toThrow('Data de extensão tem de ser futura');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('unarchiveBalance limpa archivedAt', async () => {
      const repo = repoCom({
        id: 'b1',
        currentBalance: 10,
        archivedAt: new Date('2026-10-14T05:00:00Z'),
        deletedAt: new Date('2026-11-14T05:00:00Z'),
        extendedUntil: null,
        notifiedAt: null,
        user: { id: 'u1' },
        event: evento,
      });
      const service = serviceCom(repo);

      const res = await service.unarchiveBalance('u1', 'evt1', { id: 'staff', role: 'cashier' });

      expect((service as any).__manager.findOne).toHaveBeenCalledWith(EventUserEntity, expect.objectContaining({ lock: { mode: 'pessimistic_read' } }));
      expect((service as any).__queryBuilder.setLock).toHaveBeenCalledWith('pessimistic_write', undefined, ['saldo']);
      expect((service as any).__queryBuilder.withDeleted).toHaveBeenCalledTimes(1);
      const guardado = repo.save.mock.calls[0][0];
      expect(guardado.archivedAt).toBeNull();
      expect(guardado.deletedAt).toBeNull();
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

      const res = await service.markNotified('u1', 'evt1', { id: 'staff', role: 'cashier' });

      const guardado = repo.save.mock.calls[0][0];
      expect(guardado.notifiedAt).toBeInstanceOf(Date);
      expect(res.notifiedAt).toBeInstanceOf(Date);
    });

    it('recusa extensão se a role foi reduzida para client antes da escrita', async () => {
      const repo = repoCom({ id: 'b1', currentBalance: 10, event: evento });
      const service = serviceCom(repo, 'client');

      await expect(
        service.extendBalance('u1', { eventId: 'evt1', until: '2099-01-01' }, { id: 'staff', role: 'cashier' }),
      ).rejects.toThrow('A tua função neste evento não permite esta operação');
      expect(repo.save).not.toHaveBeenCalled();
      expect((service as any).__queryBuilder.getOne).not.toHaveBeenCalled();
    });

    it('operações de saldo inexistente → 404', async () => {
      const repo = repoCom(null);
      const service = serviceCom(repo);

      await expect(
        service.extendBalance('u1', { eventId: 'evt1', until: '2099-01-01' }, { id: 'staff', role: 'cashier' }),
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

describe('BalanceService — lista de saldos pendentes com estado de arquivo/aviso', () => {
  const evento = { id: 'evt1', endDate: '2026-10-10', balanceGraceDays: 3 };
  const eventService = {} as any;

  const build = (saldos: any[]) => {
    const balanceRepository = { find: vi.fn().mockResolvedValue(saldos) };
    const eventRepository = { findOne: vi.fn().mockResolvedValue(evento) };
    const service = new BalanceService(
      balanceRepository as any,
      {} as any,
      {} as any,
      eventRepository as any,
      {} as any,
      { transaction: vi.fn() } as any,
      eventService,
    );
    return service;
  };

  it('devolve archivedAt, notifiedAt e deadline por cliente', async () => {
    const service = build([
      {
        currentBalance: 12.5,
        archivedAt: new Date('2026-09-01T10:00:00Z'),
        notifiedAt: new Date('2026-10-01T09:00:00Z'),
        extendedUntil: null,
        user: { id: 'u1', name: 'Ana', email: 'ana@x.pt' },
      },
      {
        currentBalance: 5,
        archivedAt: null,
        notifiedAt: null,
        extendedUntil: new Date('2026-11-01T00:00:00Z'),
        user: { id: 'u2', name: 'Bruno' },
      },
    ]);

    const res = await service.listSaldosPendentes('evt1', { role: 'superadmin' });

    expect(res[0]).toMatchObject({
      userId: 'u1',
      name: 'Ana',
      email: 'ana@x.pt',
      balance: 12.5,
      archivedAt: '2026-09-01T10:00:00.000Z',
      notifiedAt: '2026-10-01T09:00:00.000Z',
      deadline: '2026-10-14T05:00:00.000Z',
    });
    expect(res[1].archivedAt).toBeNull();
    expect(res[1].notifiedAt).toBeNull();
    expect(res[1].deadline).toBe('2026-11-01T00:00:00.000Z');
  });

  it('evento inexistente → NotFound', async () => {
    const eventRepository = { findOne: vi.fn().mockResolvedValue(null) };
    const service = new BalanceService(
      {} as any,
      {} as any,
      {} as any,
      eventRepository as any,
      {} as any,
      { transaction: vi.fn() } as any,
      eventService,
    );
    await expect(
      service.listSaldosPendentes('nao-existe', { role: 'superadmin' }),
    ).rejects.toThrow('Evento não encontrado');
  });
});
describe('BalanceService — transferência entre eventos (melhoria #8)', () => {
  const eventService = {
    assertEventOperavelById: vi.fn().mockResolvedValue({ id: 'atual', name: 'Atual' }),
    vincularCliente: vi.fn().mockResolvedValue(undefined),
  } as unknown as EventService;

  const Novo = () =>
    new BalanceService(
      { find: vi.fn() } as any,
      {} as any,
      {} as any,
      { findOne: vi.fn() } as any,
      { find: vi.fn(), findOne: vi.fn() } as any,
      { transaction: vi.fn() } as any,
      eventService,
    );

  it('move o valor do evento de origem para o destino com movimentos CANCEL/LOAD', async () => {
    const svc = Novo();
    const eventos: any[] = [];
    (svc as any).eventRepository.findOne.mockResolvedValue({ id: 'magusto', name: 'Magusto' });
    eventService.assertEventOperavelById.mockResolvedValue({ id: 'atual', name: 'Atual' } as any);
    (svc as any).eventUserRepository.findOne.mockResolvedValue({ id: 'm1' });

    const origem = { id: 'b-origem', currentBalance: 100 };
    const destino = { id: 'b-destino', currentBalance: 20 };
    const manager = {
      findOne: vi.fn().mockImplementation((_entity: any, opts: any) => {
        const eventId = opts?.where?.event?.id;
        if (eventId === 'magusto') return Promise.resolve(origem);
        if (eventId === 'atual') return Promise.resolve(destino);
        return Promise.resolve(null);
      }),
      save: vi.fn().mockImplementation(async (_e: any, d: any) => {
        if (d?.currentBalance !== undefined) {
          eventos.push({ currentBalance: Number(d.currentBalance) });
        }
        return Promise.resolve(d);
      }),
      create: vi.fn().mockImplementation((_e: any, d: any) => d),
    };
    (svc as any).dataSource.transaction.mockImplementation(async (fn: any) => fn(manager));

    const r = await svc.transferBalance(
      'u1',
      { fromEventId: 'magusto', toEventId: 'atual', amount: 30 },
      { id: 'staff', role: 'cashier' },
    );

    expect(r.originBalance.currentBalance).toBe(70);
    expect(r.balance.currentBalance).toBe(50);
    expect(r.movement).toEqual(
      expect.objectContaining({
        type: MovementType.LOAD,
        amount: 30,
        description: 'Transferência de Magusto',
      }),
    );
    expect(manager.create).toHaveBeenNthCalledWith(
      1,
      BalanceMovementEntity,
      expect.objectContaining({
        type: MovementType.CANCEL,
        amount: 30,
        description: 'Transferência para Atual',
      }),
    );
    expect(manager.create).toHaveBeenNthCalledWith(
      2,
      BalanceMovementEntity,
      expect.objectContaining({
        type: MovementType.LOAD,
        amount: 30,
        description: 'Transferência de Magusto',
      }),
    );
    expect(eventService.vincularCliente).toHaveBeenCalledWith('u1', 'atual');
    expect(
      manager.findOne.mock.calls
        .filter(([entity]: any[]) => entity?.name === 'BalanceEntity')
        .map(([, options]: any[]) => options.where.event.id),
    ).toEqual(['atual', 'magusto']);
  });

  it('origem sem saldo suficiente → Forbidden', async () => {
    const svc = Novo();
    (svc as any).eventRepository.findOne.mockResolvedValue({ id: 'magusto', name: 'Magusto' });
    (svc as any).dataSource.transaction.mockImplementation(async (fn: any) =>
      fn({
        findOne: vi.fn().mockImplementation((_entity: any, opts: any) =>
          opts?.where?.event?.id === 'magusto'
            ? Promise.resolve({ id: 'b-origem', currentBalance: 10 })
            : Promise.resolve(null),
        ),
        save: vi.fn().mockImplementation(async (_e: any, d: any) => Promise.resolve(d)),
        create: vi.fn().mockImplementation((_e: any, d: any) => d),
      }),
    );
    await expect(
      svc.transferBalance('u1', { fromEventId: 'magusto', toEventId: 'atual', amount: 30 }, { role: 'superadmin' }),
    ).rejects.toThrow('Saldo insuficiente no evento de origem');
  });

  it('origem e destino iguais → Forbidden', async () => {
    const svc = Novo();
    await expect(
      svc.transferBalance('u1', { fromEventId: 'e', toEventId: 'e', amount: 5 }, { role: 'superadmin' }),
    ).rejects.toThrow('Origem e destino têm de ser eventos diferentes');
  });

  it('cria o saldo de destino quando ainda não existe', async () => {
    const svc = Novo();
    (svc as any).eventRepository.findOne.mockResolvedValue({ id: 'magusto', name: 'Magusto' });
    (svc as any).userRepository.findOne = vi.fn().mockResolvedValue({ id: 'u1', name: 'Ana' });
    const criaDestino = vi.fn();
    const manager = {
      findOne: vi.fn().mockImplementation((entity: any, opts: any) => {
        if (entity?.name === 'BalanceEntity' && opts?.where?.event?.id === 'magusto') {
          return Promise.resolve({ id: 'b-origem', currentBalance: 50 });
        }
        if (entity?.name === 'UserEntity') {
          return Promise.resolve({ id: 'u1', name: 'Ana' });
        }
        return Promise.resolve(null);
      }),
      save: vi.fn().mockImplementation(async (_e: any, d: any) => {
        if (d?.currentBalance === 0) criaDestino(d);
        return Promise.resolve(d);
      }),
      create: vi.fn().mockImplementation((_e: any, d: any) => d),
    };
    (svc as any).dataSource.transaction.mockImplementation(async (fn: any) => fn(manager));
    const r = await svc.transferBalance('u1', { fromEventId: 'magusto', toEventId: 'atual', amount: 10 }, { role: 'superadmin' });
    expect(r.originBalance.currentBalance).toBe(40);
    expect(r.balance.currentBalance).toBe(10);
    expect(criaDestino).toHaveBeenCalled();
  });

  it('listBalancesPorEvento lista só eventos do staff (non-superadmin)', async () => {
    const svc = Novo();
    (svc as any).balanceRepository.find.mockResolvedValue([
      { id: 'b1', currentBalance: 100, event: { id: 'magusto', name: 'Magusto' }, archivedAt: null, extendedUntil: null },
      { id: 'b2', currentBalance: 15, event: { id: 'outro', name: 'Outro' }, archivedAt: null, extendedUntil: null },
    ]);
    (svc as any).eventUserRepository.find.mockResolvedValue([
      { event: { id: 'magusto' } },
    ]);
    const res = await svc.listBalancesPorEvento('u1', { id: 'staff', role: 'cashier' });
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ eventId: 'magusto', eventName: 'Magusto', balance: 100 });
  });

  it('listBalancesPorEvento para superadmin ignora membroships', async () => {
    const svc = Novo();
    (svc as any).balanceRepository.find.mockResolvedValue([
      { id: 'b1', currentBalance: 7, event: { id: 'e1', name: 'E1' }, archivedAt: null, extendedUntil: null },
    ]);
    (svc as any).eventUserRepository.find = vi.fn();
    const res = await svc.listBalancesPorEvento('u1', { id: 'sa', role: 'superadmin' });
    expect(res).toHaveLength(1);
    expect((svc as any).eventUserRepository.find).not.toHaveBeenCalled();
  });
});

describe('BalanceService — snapshot anterior para auditoria (arquivar)', () => {
  const eventService = {
    assertEventOperavelById: vi.fn().mockResolvedValue({ id: 'atual', name: 'Atual' }),
    vincularCliente: vi.fn().mockResolvedValue(undefined),
  } as unknown as EventService;

  const Novo = () => {
    const balanceRepository = { find: vi.fn(), findOne: vi.fn(), save: vi.fn() };
    const eventUserRepository = { findOne: vi.fn().mockResolvedValue({ id: 'membership', role: 'cashier' }) };
    const queryBuilder = {
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      withDeleted: vi.fn().mockReturnThis(),
      setLock: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockImplementation(() => balanceRepository.findOne({
        withDeleted: queryBuilder.withDeleted.mock.calls.length > 0,
      })),
    };
    const manager = {
      findOne: vi.fn().mockImplementation((entity: any, options: any) =>
        entity === EventUserEntity ? eventUserRepository.findOne(options) : Promise.resolve(null),
      ),
      createQueryBuilder: vi.fn().mockReturnValue(queryBuilder),
      save: vi.fn().mockImplementation((_entity: any, balance: any) => balanceRepository.save(balance)),
    };
    const dataSource = { transaction: vi.fn().mockImplementation(async (callback: any) => callback(manager)) };
    return new BalanceService(
      balanceRepository as any,
      { findOne: vi.fn(), save: vi.fn() } as any,
      {} as any,
      { findOne: vi.fn() } as any,
      eventUserRepository as any,
      dataSource as any,
      eventService,
    );
  };

  beforeEach(() => vi.clearAllMocks());

  it('loadBalance arquiva o saldo anterior e o evento', async () => {
    const svc = Novo();
    (svc as any).dataSource.transaction.mockImplementation(async (fn: any) =>
      fn({
        findOne: vi.fn().mockResolvedValue({ id: 'b1', currentBalance: 40, event: { id: 'evt1' } }),
        create: vi.fn(),
        save: vi.fn().mockImplementation((_e: any, e: any) => Promise.resolve(e)),
      }),
    );
    const arquivar = vi.fn();

    await svc.loadBalance('u1', { amount: 10, eventId: 'evt1' } as any, { id: 'staff' }, arquivar);

    expect(arquivar).toHaveBeenCalledWith({
      antes: { currentBalance: 40 },
      eventId: 'evt1',
      entidadeId: 'b1',
      extras: { amount: 10, paymentMethod: 'Carregamento' },
    });
  });

  it('deductBalance arquiva o saldo anterior e o evento', async () => {
    const svc = Novo();
    (svc as any).dataSource.transaction.mockImplementation(async (fn: any) =>
      fn({
        findOne: vi
          .fn()
          .mockResolvedValue({ id: 'b1', currentBalance: 100, archivedAt: null, extendedUntil: null }),
        create: vi.fn().mockImplementation((_e: any, d: any) => d),
        save: vi.fn().mockImplementation((_e: any, e: any) => Promise.resolve(e)),
      }),
    );
    const arquivar = vi.fn();

    await svc.deductBalance('u1', { amount: 30, eventId: 'evt1' } as any, { id: 'staff' }, arquivar);

    expect(arquivar).toHaveBeenCalledWith({
      antes: { currentBalance: 100 },
      eventId: 'evt1',
      entidadeId: 'b1',
      extras: { amount: 30, description: 'Desconto de saldo (caixa)' },
    });
  });

  it('reverseLoad arquiva o saldo atual e o evento do movimento', async () => {
    const svc = Novo();
    const movimento = {
      id: 'mov1',
      reversed: false,
      amount: 10,
      type: 'load',
      balance: { id: 'b1', user: { id: 'u1' }, event: { id: 'evtA' } },
    };
    (svc as any).dataSource.transaction.mockImplementation(async (fn: any) =>
      fn({
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
        save: vi.fn().mockImplementation((_e: any, e: any) => Promise.resolve(e)),
        create: vi.fn().mockImplementation((_e: any, d: any) => d),
      }),
    );
    const arquivar = vi.fn();

    await svc.reverseLoad('u1', 'mov1', { id: 'root', role: 'superadmin' }, {} as any, arquivar);

    expect(arquivar).toHaveBeenCalledWith({
      antes: { currentBalance: 100 },
      eventId: 'evtA',
      entidadeId: 'b1',
      extras: {
        movementId: 'mov1',
        originalAmount: 10,
        alreadyReversedAmount: 0,
        reversalAmount: 10,
        fullyReversed: true,
      },
    });
  });

  it('transferBalance arquiva os dois lados, o evento destino e os extras', async () => {
    const svc = Novo();
    (svc as any).eventRepository.findOne.mockResolvedValue({ id: 'magusto', name: 'Magusto' });
    const origem = { id: 'b-origem', currentBalance: 100 };
    const destino = { id: 'b-destino', currentBalance: 20 };
    const manager = {
      findOne: vi.fn().mockResolvedValueOnce(destino).mockResolvedValueOnce(origem),
      save: vi.fn().mockImplementation((_e: any, d: any) => Promise.resolve(d)),
      create: vi.fn().mockImplementation((_e: any, d: any) => d),
    };
    (svc as any).dataSource.transaction.mockImplementation(async (fn: any) => fn(manager));
    const arquivar = vi.fn();

    await svc.transferBalance(
      'u1',
      { fromEventId: 'magusto', toEventId: 'atual', amount: 30 },
      { role: 'superadmin' },
      arquivar,
    );

    expect(arquivar).toHaveBeenCalledWith({
      antes: {
        originBalance: { id: 'b-origem', currentBalance: 100 },
        destinationBalance: { id: 'b-destino', currentBalance: 20 },
      },
      eventId: 'atual',
      entidadeId: 'b-origem',
      alvos: [
        { eventId: 'magusto', entidadeId: 'b-origem' },
        { eventId: 'atual', entidadeId: 'b-destino' },
      ],
      extras: {
        fromEventId: 'magusto',
        toEventId: 'atual',
        originBalanceId: 'b-origem',
        destinationBalanceId: 'b-destino',
        amount: 30,
      },
    });
  });

  it('extendBalance arquiva o estado anterior (extendedUntil/archivedAt)', async () => {
    const svc = Novo();
    (svc as any).balanceRepository.findOne.mockResolvedValue({
      id: 'b1',
      event: { id: 'evt1' },
      extendedUntil: null,
      archivedAt: new Date('2026-01-01'),
    });
    (svc as any).balanceRepository.save = vi.fn().mockImplementation((e: any) => Promise.resolve(e));
    const arquivar = vi.fn();

    await svc.extendBalance(
      'u1',
      { eventId: 'evt1', until: new Date(Date.now() + 86_400_000).toISOString() } as any,
      { id: 'staff', role: 'cashier' },
      arquivar,
    );

    expect(arquivar).toHaveBeenCalledWith({
      antes: { extendedUntil: null, archivedAt: new Date('2026-01-01') },
      eventId: 'evt1',
      entidadeId: 'b1',
      extras: { extendedUntil: expect.any(String) },
    });
  });

  it('unarchiveBalance arquiva o archivedAt anterior', async () => {
    const svc = Novo();
    const archivedAt = new Date('2026-01-01');
    (svc as any).balanceRepository.findOne.mockResolvedValue({ id: 'b1', event: { id: 'evt1' }, archivedAt });
    (svc as any).balanceRepository.save = vi.fn().mockImplementation((e: any) => Promise.resolve(e));
    const arquivar = vi.fn();

    await svc.unarchiveBalance('u1', 'evt1', { id: 'staff', role: 'cashier' }, arquivar);

    expect(arquivar).toHaveBeenCalledWith({
      antes: { archivedAt },
      eventId: 'evt1',
      entidadeId: 'b1',
    });
  });

  it('markNotified arquiva o notifiedAt anterior', async () => {
    const svc = Novo();
    (svc as any).balanceRepository.findOne.mockResolvedValue({ id: 'b1', event: { id: 'evt1' }, notifiedAt: null });
    (svc as any).balanceRepository.save = vi.fn().mockImplementation((e: any) => Promise.resolve(e));
    const arquivar = vi.fn();

    await svc.markNotified('u1', 'evt1', { id: 'staff', role: 'cashier' }, arquivar);

    expect(arquivar).toHaveBeenCalledWith({
      antes: { notifiedAt: null },
      eventId: 'evt1',
      entidadeId: 'b1',
    });
  });
});
