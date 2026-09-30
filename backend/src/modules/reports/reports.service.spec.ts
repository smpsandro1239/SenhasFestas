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