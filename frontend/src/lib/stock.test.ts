import { describe, it, expect } from 'vitest';
import {
  temControloStock,
  stockRestante,
  esgotado,
  podeAdicionar,
  type StockProduto,
} from './stock';

describe('stock — controlo de stock vs sem stock', () => {
  const prod = (stock?: number | null): StockProduto => ({ stock: stock === undefined ? undefined : stock });

  describe('temControloStock', () => {
    it('null é sem controlo (menu aberto)', () => {
      expect(temControloStock(prod(null))).toBe(false);
    });
    it('undefined também é sem controlo', () => {
      expect(temControloStock(prod(undefined))).toBe(false);
    });
    it('número — mesmo 0 — é com controlo', () => {
      expect(temControloStock(prod(0))).toBe(true);
      expect(temControloStock(prod(5))).toBe(true);
    });
  });

  describe('esgotado', () => {
    it('sem controlo nunca está esgotado', () => {
      expect(esgotado(prod(null))).toBe(false);
    });
    it('stock 0 está esgotado', () => {
      expect(esgotado(prod(0))).toBe(true);
    });
    it('stock negativo está esgotado', () => {
      expect(esgotado(prod(-1))).toBe(true);
    });
    it('stock positivo não está esgotado', () => {
      expect(esgotado(prod(3))).toBe(false);
    });
  });

  describe('stockRestante', () => {
    it('sem controlo devolve ilimitado (null)', () => {
      expect(stockRestante(prod(null), 10)).toBeNull();
    });
    it('desconta o que já está no carrinho', () => {
      expect(stockRestante(prod(5), 2)).toBe(3);
    });
    it('nunca devolve negativo', () => {
      expect(stockRestante(prod(2), 5)).toBe(0);
    });
  });

  describe('podeAdicionar', () => {
    it('sem controlo adiciona sempre', () => {
      expect(podeAdicionar(prod(null), 0)).toBe(true);
      expect(podeAdicionar(prod(null), 99)).toBe(true);
    });
    it('com stock suficiente adiciona', () => {
      expect(podeAdicionar(prod(5), 4)).toBe(true);
    });
    it('no limite do stock já não adiciona', () => {
      expect(podeAdicionar(prod(5), 5)).toBe(false);
    });
    it('esgotado não adiciona', () => {
      expect(podeAdicionar(prod(0), 0)).toBe(false);
    });
  });
});