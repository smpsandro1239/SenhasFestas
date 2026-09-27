import { describe, expect, it } from 'vitest';
import { getOrderTotal } from './order-total';
import type { CartItem } from './types';

describe('getOrderTotal', () => {
  it('soma preço × quantidade com lastOrder populado e cart vazio', () => {
    const lastOrder: CartItem[] = [
      { id: 'a', name: 'Sandes', price: 2, quantity: 1 },
      { id: 'b', name: 'Tosta', price: 5, quantity: 1 },
    ];
    const cart: CartItem[] = [];
    expect(getOrderTotal(lastOrder)).toBe(7);
    expect(getOrderTotal(cart)).toBe(0);
    expect(getOrderTotal(lastOrder.length ? lastOrder : cart)).toBe(7);
  });

  it('trata price como string (decimal do Postgres)', () => {
    expect(
      getOrderTotal([{ id: 'c', name: 'Bolo', price: '1.20', quantity: 3 }]),
    ).toBeCloseTo(3.6);
  });

  it('devolve 0 para lista vazia (sem NaN)', () => {
    expect(getOrderTotal([])).toBe(0);
  });
});