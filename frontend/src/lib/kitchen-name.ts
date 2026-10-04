/**
 * O que o ecrã da cozinha lê para um item de encomenda.
 *
 * `item.name` é o retrato do nome no momento em que a encomenda foi feita. O
 * `kitchenName` do produto é o que o admin escolheu para a cozinha, e passa à
 * frente: se o produto foi renomeado entretanto, é o retrato que fica a meio
 * e o nome da cozinha é o que interessa. Só sem `kitchenName` é que se cai no
 * retrato.
 */
export function kitchenDisplayName(item: {
  name?: string | null;
  product?: { name?: string | null; kitchenName?: string | null } | null;
}): string {
  return item.product?.kitchenName || item.name || item.product?.name || '';
}
