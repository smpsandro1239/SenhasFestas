import { describe, it, expect } from 'vitest';
import { numerosDeIntervalo, agruparFolhas, MAX_MESAS_LOTE } from './qr-lote';

describe('numerosDeIntervalo', () => {
  it('gera a sequência inclusiva', () => {
    expect(numerosDeIntervalo(1, 5)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('normaliza a ordem (inicio > fim)', () => {
    expect(numerosDeIntervalo(5, 3)).toEqual(['3', '4', '5']);
  });

  it('intervalo de um só número', () => {
    expect(numerosDeIntervalo(7, 7)).toEqual(['7']);
  });

  it('recusa valores não finitos', () => {
    expect(numerosDeIntervalo(NaN, 5)).toEqual([]);
    expect(numerosDeIntervalo(1, Infinity)).toEqual([]);
  });

  it('recusa intervalos acima do limite', () => {
    expect(numerosDeIntervalo(1, MAX_MESAS_LOTE + 1)).toEqual([]);
    expect(numerosDeIntervalo(1, MAX_MESAS_LOTE)).toHaveLength(MAX_MESAS_LOTE);
  });
});

describe('agruparFolhas', () => {
  it('divide em folhas do tamanho pedido', () => {
    expect(agruparFolhas(['1', '2', '3', '4', '5'], 2)).toEqual([
      ['1', '2'],
      ['3', '4'],
      ['5'],
    ]);
  });

  it('lista vazia devolve zero folhas', () => {
    expect(agruparFolhas([], 4)).toEqual([]);
  });

  it('porFolha inválido cai para 1 por folha', () => {
    expect(agruparFolhas(['a', 'b'], 0)).toEqual([['a'], ['b']]);
  });
});
