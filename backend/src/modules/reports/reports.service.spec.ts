import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { BalanceEntity, BalanceMovementEntity, EventUserEntity } from '../../entities';

// RED(A5): exportOrdensCsv escreve valores sem sanitizar — um nome de produto
// começado por '=' acaba como fórmula no Excel/Sheets.

describe('ReportsService.exportOrdensCsv — sanitização contra injeção de fórmula (A5)', () => {
  function criarServiceComItens(itens: any[]) {
    const orderRepository = {
      createQueryBuilder: vi.fn().mockReturnValue({
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        take: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(itens),
      } as any),
    };
    return new ReportsService(
      orderRepository as any,
      {} as any,
      {} as any,
      {} as any,
      {
        eventIdsFor: vi.fn().mockResolvedValue(null),
        eventColumnFor: vi.fn().mockReturnValue(null),
      } as any,
      { transaction: vi.fn(async (callback: any) => callback({ findOne: vi.fn(), find: vi.fn() })) } as any,
    );
  }

  it('produto com nome =1+1 é exportado com apóstrofo (não como fórmula)', async () => {
    const svc = criarServiceComItens([
      {
        id: 'o1',
        createdAt: new Date('2026-09-01T10:00:00.000Z'),
        status: 'delivered',
        source: 'pos',
        tableNumber: null,
        station: null,
        total: 10.5,
        balanceUsed: 0,
        paymentMethod: 'cash',
        event: { id: 'evt1' },
        items: [
          {
            quantity: 1,
            subtotal: 10.5,
            product: { name: '=1+1' },
          },
        ],
      },
    ]);

    const csv = await svc.exportOrdensCsv({} as any, { id: 'u1', role: 'organizer' });

    expect(csv).toContain("'=1+1");
    expect(csv).not.toContain('"=1+1"');
  });
});

function makeService(mocks: {
  orderRepository?: any;
  orderItemRepository?: any;
  movementRepository?: any;
  balanceRepository?: any;
  membership?: any;
  dataSource?: any;
} = {}) {
  const orderRepo = mocks.orderRepository ?? {
    createQueryBuilder: vi.fn().mockReturnValue({
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([]),
    } as any),
  };
  return new ReportsService(
    orderRepo as any,
    (mocks.orderItemRepository ?? {}) as any,
    (mocks.movementRepository ?? {}) as any,
    (mocks.balanceRepository ?? {}) as any,
    (mocks.membership ?? {
      eventIdsFor: vi.fn().mockResolvedValue(null),
      eventColumnFor: vi.fn().mockReturnValue(null),
      roleEfetiva: vi.fn().mockResolvedValue('superadmin'),
    }) as any,
    (mocks.dataSource ?? { transaction: vi.fn(async (callback: any) => callback({ findOne: vi.fn(), find: vi.fn() })) }) as any,
  );
}

describe('ReportsService — Parte 3: expiring-balances', () => {
  function balanceRepoCom(rows: any[]) {
    return {
      createQueryBuilder: vi.fn().mockReturnValue({
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        leftJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(rows),
      } as any),
    };
  }

  const agora = new Date('2026-10-07T12:00:00.000Z');

  const linhas = [
    {
      id: 'b1',
      currentBalance: 20,
      archivedAt: null,
      extendedUntil: null,
      user: { id: 'u1', name: 'Ana' },
      event: { id: 'evt1', name: 'Festa A', endDate: '2026-10-10', balanceGraceDays: 3 },
    },
    {
      id: 'b2',
      currentBalance: 35,
      archivedAt: null,
      extendedUntil: null,
      user: { id: 'u2', name: 'Rui' },
      event: { id: 'evt2', name: 'Festa B', endDate: '2026-10-09', balanceGraceDays: 3 },
    },
    {
      id: 'b3',
      currentBalance: 10,
      archivedAt: null,
      extendedUntil: null,
      user: { id: 'u3', name: 'Sara' },
      event: { id: 'evt1', name: 'Festa A', endDate: '2026-10-10', balanceGraceDays: 3 },
    },
    {
      id: 'b4',
      currentBalance: 99,
      archivedAt: new Date('2026-10-14T05:00:00Z'),
      extendedUntil: null,
      user: { id: 'u4', name: 'Zé' },
      event: { id: 'evt1', name: 'Festa A', endDate: '2026-10-10', balanceGraceDays: 3 },
    },
    {
      id: 'b5',
      currentBalance: 50,
      archivedAt: null,
      extendedUntil: null,
      user: { id: 'u5', name: 'Longe' },
      event: { id: 'evt3', name: 'Festa Longe', endDate: '2027-01-01', balanceGraceDays: 3 },
    },
    {
      id: 'b6',
      currentBalance: 60,
      archivedAt: null,
      extendedUntil: null,
      user: { id: 'u6', name: 'Passado' },
      event: { id: 'evt4', name: 'Festa Passada', endDate: '2026-06-01', balanceGraceDays: 3 },
    },
  ];

  function svcCom(rows: any[]) {
    return makeService({ balanceRepository: balanceRepoCom(rows) });
  }

  it('agrupa por evento, exclui arquivados/vencidos/fora do prazo e ordena pelo prazo', async () => {
    const res = await svcCom(linhas).obterSaldosAExpirar(
      { dias: 7 },
      { id: 'admin', role: 'superadmin' },
      agora,
    );

    expect(res.eventos.map((e: any) => e.eventId)).toEqual(['evt2', 'evt1']);
    expect(res.eventos[1].clientes).toBe(2);
    expect(res.eventos[1].total).toBe(30);
    expect(res.eventos[0].total).toBe(35);
    expect(res.eventos[1].deadline).toBe('2026-10-14T05:00:00.000Z');
    expect(res.totalClientes).toBe(3);
    expect(res.total).toBe(65);
  });

  it('respeita limiteEventos (max 5 por omissão)', async () => {
    const res = await svcCom(linhas).obterSaldosAExpirar(
      { dias: 7, limiteEventos: 1 },
      { id: 'admin', role: 'superadmin' },
      agora,
    );

    expect(res.eventos).toHaveLength(1);
    expect(res.eventos[0].eventId).toBe('evt2');
  });

  it('só devolve eventos dentro da janela de dias', async () => {
    const res = await svcCom(linhas).obterSaldosAExpirar(
      { dias: 6 },
      { id: 'admin', role: 'superadmin' },
      agora,
    );

    // prazos: evt2 2026-10-13T05:00Z (<= agora+6d = 10-13T12:00Z ✓),
    //         evt1 2026-10-14T05:00Z (> 10-13T12:00Z ✗)
    expect(res.eventos.map((e: any) => e.eventId)).toEqual(['evt2']);
  });
});

describe('ReportsService — Fila B: balances', () => {
  it('retorna totais com loadedNet/consumedNet calculados a partir de cancel/refund', async () => {
    const movementRepo = {
      createQueryBuilder: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnThis(),
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        addGroupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue([
          { userId: 'u1', name: 'Ana', email: 'ana@test.com', phone: '123', tipo: 'load', total: '40.00', qty: 1 },
          { userId: 'u1', name: 'Ana', email: 'ana@test.com', phone: '123', tipo: 'cancel', total: '40.00', qty: 1 },
          { userId: 'u2', name: 'Rui', email: 'rui@test.com', phone: '456', tipo: 'load', total: '30.00', qty: 1 },
          { userId: 'u2', name: 'Rui', email: 'rui@test.com', phone: '456', tipo: 'consume', total: '15.00', qty: 1 },
        ]),
        getCount: vi.fn().mockResolvedValue(2),
      } as any),
    };
    const svc = makeService({ movementRepository: movementRepo });
    const res = await svc.obterBalancesPorEvento({ eventId: 'evt1' }, { id: 'admin', role: 'superadmin' });
    expect(res.eventId).toBe('evt1');
    expect(res.totals.loadedGross).toBe(70.0);
    expect(res.totals.loadedNet).toBe(30.0);
    expect(res.totals.consumedGross).toBe(15.0);
    expect(res.totals.consumedNet).toBe(15.0);
    expect(res.items).toHaveLength(2);
  });

  function movementRepoCom() {
    return {
      createQueryBuilder: vi.fn().mockReturnValue({
        leftJoin: vi.fn().mockReturnThis(),
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        addSelect: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        addGroupBy: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getRawMany: vi.fn().mockResolvedValue([]),
        getCount: vi.fn().mockResolvedValue(0),
      } as any),
    };
  }

  it('com ?eventId gera o predicado completo saldo.eventId = :eventId', async () => {
    const movementRepo = movementRepoCom();
    const svc = makeService({ movementRepository: movementRepo });
    await svc.obterBalancesPorEvento({ eventId: 'evt1' }, { id: 'admin', role: 'superadmin' });

    const predicates = movementRepo.createQueryBuilder.mock.results[0].value.andWhere.mock.calls.map((c: any[]) => String(c[0]));
    expect(predicates).toContainEqual('saldo.eventId = :eventId');
    expect(predicates.some((p: string) => p === 'saldo.eventId')).toBe(false);
  });

  it('sem ?eventId e com escopo de igualdade gera o predicado completo (bug do split)', async () => {
    const movementRepo = movementRepoCom();
    const svc = makeService({
      movementRepository: movementRepo,
      membership: {
        eventIdsFor: vi.fn().mockResolvedValue([]),
        eventColumnFor: vi.fn().mockReturnValue({
          column: 'eventId = :scopeNoEvent',
          params: { scopeNoEvent: '00000000-0000-0000-0000-000000000000' },
        }),
        roleEfetiva: vi.fn().mockResolvedValue('cashier'),
      },
    });
    await svc.obterBalancesPorEvento({}, { id: 'staff', role: 'cashier' });

    const predicates = movementRepo.createQueryBuilder.mock.results[0].value.andWhere.mock.calls.map((c: any[]) => String(c[0]));
    expect(predicates).toContainEqual('saldo.eventId = :scopeNoEvent');
    expect(predicates.some((p: string) => p === 'saldo.eventId')).toBe(false);
  });
});

describe('ReportsService.obterSaldo — autorização e leitura transaccionais (T44)', () => {
  const balance = {
    id: 'balance-1',
    event: { id: 'event-1' },
  };
  const movements = [
    { id: 'movement-1', createdAt: new Date('2026-01-01T10:00:00.000Z') },
    { id: 'movement-2', createdAt: new Date('2026-01-01T11:00:00.000Z') },
  ];

  function serviceCom({
    saldo = balance,
    membership = { id: 'membership-1', role: 'cashier' },
    movimentos = movements,
  }: {
    saldo?: any;
    membership?: any;
    movimentos?: any[];
  } = {}) {
    const manager = {
      findOne: vi.fn(async (entity: any) => {
        if (entity === BalanceEntity) return saldo;
        if (entity === EventUserEntity) return membership;
        return null;
      }),
      find: vi.fn().mockResolvedValue(movimentos),
    };
    const dataSource = {
      transaction: vi.fn(async (callback: any) => callback(manager)),
    };
    const svc = makeService({ dataSource });
    return { svc, manager, dataSource };
  }

  it('consulta saldo e movimentos na mesma transacção e bloqueia a membership até terminar', async () => {
    const { svc, manager, dataSource } = serviceCom();

    const result = await svc.obterSaldo({ id: 'balance-1' } as any, { id: 'user-1', role: 'cashier' });

    expect(result).toEqual(movements);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.findOne).toHaveBeenNthCalledWith(1, BalanceEntity, expect.objectContaining({
      where: { id: 'balance-1' },
      relations: { event: true },
    }));
    expect(manager.findOne).toHaveBeenNthCalledWith(2, EventUserEntity, expect.objectContaining({
      where: { event: { id: 'event-1' }, user: { id: 'user-1' } },
      lock: { mode: 'pessimistic_read' },
    }));
    expect(manager.find).toHaveBeenCalledWith(BalanceMovementEntity, {
      where: { balance: { id: 'balance-1' } },
      order: { createdAt: 'ASC' },
    });
  });

  it('recusa a leitura quando a membership foi removida antes da transacção', async () => {
    const { svc, manager } = serviceCom({ membership: null });

    await expect(
      svc.obterSaldo({ id: 'balance-1' } as any, { id: 'user-1', role: 'cashier' }),
    ).rejects.toThrow(ForbiddenException);
    expect(manager.find).not.toHaveBeenCalled();
  });

  it('recusa a leitura quando a função foi reduzida para client', async () => {
    const { svc, manager } = serviceCom({ membership: { id: 'membership-1', role: 'client' } });

    await expect(
      svc.obterSaldo({ id: 'balance-1' } as any, { id: 'user-1', role: 'cashier' }),
    ).rejects.toThrow(/não permite consultar relatórios financeiros/i);
    expect(manager.find).not.toHaveBeenCalled();
  });

  it('permite superadmin sem membership, mantendo a consulta na transacção', async () => {
    const { svc, manager, dataSource } = serviceCom({ membership: null });

    const result = await svc.obterSaldo({ id: 'balance-1' } as any, { id: 'root-1', role: 'superadmin' });

    expect(result).toEqual(movements);
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(manager.findOne).toHaveBeenCalledTimes(1);
    expect(manager.find).toHaveBeenCalledTimes(1);
  });

  it('não consulta movimentos quando o saldo não existe', async () => {
    const { svc, manager } = serviceCom({ saldo: null });

    await expect(
      svc.obterSaldo({ id: 'missing' } as any, { id: 'root-1', role: 'superadmin' }),
    ).resolves.toEqual([]);
    expect(manager.find).not.toHaveBeenCalled();
  });

  it('não abre transacção quando não foi fornecido um identificador de saldo', async () => {
    const { svc, dataSource } = serviceCom();

    await expect(svc.obterSaldo({} as any, { id: 'user-1', role: 'cashier' })).resolves.toEqual([]);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
