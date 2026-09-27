import type { CartItem } from './types';

export function getOrderTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + (Number(item.price) || 0) * item.quantity, 0);
}