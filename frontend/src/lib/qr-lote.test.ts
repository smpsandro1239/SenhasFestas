import { describe, it, expect } from 'vitest';
import {
  numerosDeIntervalo,
  agruparFolhas,
  agruparFolhasPorZona,
  normalizarLugares,
  aplicarLugaresTodas,
  totalLugares,
  MAX_MESAS_LOTE,
  MAX_LUGARES_MESA,
} from './qr-lote';

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

  it('trunca a parte decimal', () => {
    expect(numerosDeIntervalo(1.5, 3.9)).toEqual(['1', '2', '3']);
  });

  it('recusa mesa menor que 1', () => {
    expect(numerosDeIntervalo(0, 5)).toEqual([]);
    expect(numerosDeIntervalo(-3, 2)).toEqual([]);
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

describe('agruparFolhasPorZona', () => {
  it('põe cada zona na sua folha', () => {
    expect(
      agruparFolhasPorZona(
        [
          { titulo: 'Zona 1', mesas: ['1', '2'] },
          { titulo: 'Zona 2', mesas: ['3'] },
        ],
        4,
      ),
    ).toEqual([
      { titulo: 'Zona 1', mesas: ['1', '2'] },
      { titulo: 'Zona 2', mesas: ['3'] },
    ]);
  });

  it('uma zona que não cabe continua na folha seguinte com o título repetido', () => {
    expect(
      agruparFolhasPorZona([{ titulo: 'Zona 1', mesas: ['1', '2', '3'] }], 2),
    ).toEqual([
      { titulo: 'Zona 1', mesas: ['1', '2'] },
      { titulo: 'Zona 1', mesas: ['3'] },
    ]);
  });

  it('zona sem mesas não gera folha', () => {
    expect(
      agruparFolhasPorZona(
        [
          { titulo: 'Zona 1', mesas: [] },
          { titulo: 'Zona 2', mesas: ['7'] },
        ],
        4,
      ),
    ).toEqual([{ titulo: 'Zona 2', mesas: ['7'] }]);
  });

  it('sem grupos devolve zero folhas', () => {
    expect(agruparFolhasPorZona([], 4)).toEqual([]);
  });

  it('porFolha inválido cai para 1 por folha', () => {
    expect(
      agruparFolhasPorZona([{ titulo: 'Zona 1', mesas: ['a', 'b'] }], -3),
    ).toEqual([
      { titulo: 'Zona 1', mesas: ['a'] },
      { titulo: 'Zona 1', mesas: ['b'] },
    ]);
  });
});

describe('normalizarLugares', () => {
  it('trunca a parte decimal', () => {
    expect(normalizarLugares(8.9)).toBe(8);
  });

  it('nunca devolve negativo', () => {
    expect(normalizarLugares(-3)).toBe(0);
  });

  it('limita ao máximo', () => {
    expect(normalizarLugares(500)).toBe(MAX_LUGARES_MESA);
  });

  it('valores inválidos dão 0', () => {
    expect(normalizarLugares(NaN)).toBe(0);
    expect(normalizarLugares(Infinity)).toBe(0);
  });
});

describe('aplicarLugaresTodas', () => {
  it('aplica o mesmo valor a todas as mesas', () => {
    expect(aplicarLugaresTodas(['1', '2', 'VIP'], 6)).toEqual({
      '1': 6,
      '2': 6,
      VIP: 6,
    });
  });

  it('normaliza o valor aplicado', () => {
    expect(aplicarLugaresTodas(['1'], 150)).toEqual({ '1': MAX_LUGARES_MESA });
  });

  it('lista vazia devolve mapa vazio', () => {
    expect(aplicarLugaresTodas([], 6)).toEqual({});
  });
});

describe('totalLugares', () => {
  it('soma os lugares, ignorando mesas ausentes', () => {
    expect(totalLugares(['1', '2', '3'], { '1': 8, '2': 4 })).toBe(12);
  });

  it('devolve 0 sem mesas', () => {
    expect(totalLugares([], { '1': 8 })).toBe(0);
  });
});
