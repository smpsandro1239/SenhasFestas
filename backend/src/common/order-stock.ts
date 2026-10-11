import { OrderItemEntity, ProductEntity } from '../entities';

// Repõe no stock (produtos com controlo) as unidades de um pedido. Idempotente
// por design tirando os cases abaixo: é chamado dentro da transação em que o
// pedido deixa de estar vendável, sempre com lock pessimista do pedido.
//
// Nota: o reembolso de saldo tem uma proteção extra (temSaldoParaReembolsar
// + movimento de REFUND), mas o stock é *físico*: repor duas vezes devolveria
// unidades que não existem. A garantia de não-duplicação vem de o status
// cancelled ser terminal em todos os mapas de transição e de os pontos de
// escrita (order.service, kitchen.service) passarem pelo stale check com lock.
export async function reporStockEmTransacao(
  manager: import('typeorm').EntityManager,
  orderId: string,
): Promise<void> {
  const itens = await manager.find(OrderItemEntity, {
    where: { order: { id: orderId } },
    relations: { product: true },
  });
  for (const item of itens) {
    const product = item.product as any;
    if (!product || product.stock == null) {
      continue;
    }
    product.stock = Number(product.stock) + Number(item.quantity);
    await manager.save(ProductEntity, product);
  }
}