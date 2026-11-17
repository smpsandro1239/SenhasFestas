import { In } from 'typeorm';
import { OrderItemEntity, ProductEntity } from '../entities';

// Repor stock dentro da transação que torna o pedido terminal.
// Todos os caminhos de escrita bloqueiam os produtos por ID ascendente,
// evitando ciclos entre vendas e cancelamentos com artigos em ordens distintas.
export async function reporStockEmTransacao(
  manager: import('typeorm').EntityManager,
  orderId: string,
): Promise<void> {
  const itens = await manager.find(OrderItemEntity, {
    where: { order: { id: orderId } },
    relations: { product: true },
  });

  const quantidadePorProduto = new Map<string, number>();
  for (const item of itens) {
    const productId = item.product?.id;
    if (!productId) continue;
    quantidadePorProduto.set(
      productId,
      (quantidadePorProduto.get(productId) ?? 0) + Number(item.quantity),
    );
  }

  const productIds = [...quantidadePorProduto.keys()];
  if (productIds.length === 0) return;

  // Não confiar na ordem dos itens persistidos: duas reposições concorrentes
  // têm de adquirir os locks exactamente pela mesma ordem.
  const produtosBloqueados = await manager.find(ProductEntity, {
    where: { id: In(productIds) },
    order: { id: 'ASC' },
    lock: { mode: 'pessimistic_write' },
  });

  for (const product of produtosBloqueados) {
    if (product.stock == null) continue;
    product.stock = Number(product.stock) + quantidadePorProduto.get(product.id)!;
    await manager.save(ProductEntity, product);
  }
}
