import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { ReportsService } from './reports.service';

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
  );
}

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
});