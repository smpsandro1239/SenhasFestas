import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderItemsProductOrderIndex1790700000000 } from './1790700000000-OrderItemsProductOrderIndex';

describe('OrderItemsProductOrderIndex1790700000000', () => {
  const queryRunner = { query: vi.fn().mockResolvedValue(undefined) } as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates the composite index used by product co-occurrence queries', async () => {
    await new OrderItemsProductOrderIndex1790700000000().up(queryRunner);

    expect(queryRunner.query).toHaveBeenCalledWith(
      'CREATE INDEX "IDX_order_items_product_order" ON "order_items" ("productId", "orderId")',
    );
  });

  it('removes the composite index on rollback', async () => {
    await new OrderItemsProductOrderIndex1790700000000().down(queryRunner);

    expect(queryRunner.query).toHaveBeenCalledWith(
      'DROP INDEX "IDX_order_items_product_order"',
    );
  });
});