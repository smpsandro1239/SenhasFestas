import { describe, expect, it, vi } from 'vitest';
import { In } from 'typeorm';
import { OrderItemEntity, ProductEntity } from '../entities';
import { reporStockEmTransacao } from './order-stock';

describe('reporStockEmTransacao', () => {
  it('bloqueia produtos por ID ascendente e agrega linhas repetidas', async () => {
    const produtoA = { id: 'a', stock: 3 };
    const produtoB = { id: 'b', stock: 8 };
    const find = vi.fn()
      .mockResolvedValueOnce([
        { product: { id: 'b', stock: 8 }, quantity: 2 },
        { product: { id: 'a', stock: 3 }, quantity: 1 },
        { product: { id: 'a', stock: 3 }, quantity: 4 },
      ])
      .mockResolvedValueOnce([produtoA, produtoB]);
    const save = vi.fn().mockImplementation(async (_entity, value) => value);
    const manager = { find, save } as any;

    await reporStockEmTransacao(manager, 'order-1');

    expect(find).toHaveBeenNthCalledWith(1, OrderItemEntity, {
      where: { order: { id: 'order-1' } },
      relations: { product: true },
    });
    const lockQuery = find.mock.calls[1][1];
    expect(find.mock.calls[1][0]).toBe(ProductEntity);
    expect(lockQuery.order).toEqual({ id: 'ASC' });
    expect(lockQuery.lock).toEqual({ mode: 'pessimistic_write' });
    expect(lockQuery.where.id).toEqual(In(['b', 'a']));
    expect(produtoA.stock).toBe(8);
    expect(produtoB.stock).toBe(10);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('não altera produtos sem controlo de stock', async () => {
    const produto = { id: 'menu', stock: null };
    const manager = {
      find: vi.fn()
        .mockResolvedValueOnce([{ product: { id: 'menu' }, quantity: 3 }])
        .mockResolvedValueOnce([produto]),
      save: vi.fn(),
    } as any;

    await reporStockEmTransacao(manager, 'order-2');

    expect(produto.stock).toBeNull();
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('não consulta produtos quando o pedido não tem artigos associados', async () => {
    const manager = { find: vi.fn().mockResolvedValue([]), save: vi.fn() } as any;

    await reporStockEmTransacao(manager, 'order-3');

    expect(manager.find).toHaveBeenCalledTimes(1);
    expect(manager.save).not.toHaveBeenCalled();
  });
});
