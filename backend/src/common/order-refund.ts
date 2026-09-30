import { OrderEntity, BalanceEntity, BalanceMovementEntity, MovementType } from '../entities';
import { centavos, soma } from './money';

// NOTE: "reembolso duplo impossível" (commit a438592) é análise, não teste.
// Depende de cancelled/delivered serem terminais e do stale check com lock
// dentro de cancelOrder e updateStatus (order.service) e atualizarEstado
// (kitchen.service). Se alguém alterar o mapa de transições ou o stale check,
// a promessa deixa de valer — escrever teste de paralelismo (todo no
// order.service.spec.ts: B1-concorrência).
export async function reembolsarSaldoEmTransacao(
  manager: import('typeorm').EntityManager,
  order: OrderEntity,
): Promise<void> {
  if (!order.balanceId || centavos(Number(order.balanceUsed)) <= 0) {
    return;
  }
  const balance = await manager.findOne(BalanceEntity, {
    where: { id: order.balanceId },
    lock: { mode: 'pessimistic_write' },
  });
  if (!balance) {
    return;
  }
  balance.currentBalance = soma(Number(balance.currentBalance), centavos(Number(order.balanceUsed)));
  await manager.save(BalanceEntity, balance);

  const refund = manager.create(BalanceMovementEntity, {
    balance,
    type: MovementType.REFUND,
    amount: centavos(Number(order.balanceUsed)),
    orderId: order.id,
    description: 'Reembolso por cancelamento',
  });
  await manager.save(BalanceMovementEntity, refund);
}