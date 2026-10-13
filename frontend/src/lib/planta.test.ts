import { describe, it, expect } from 'vitest';
import {
  normalizarPosicao,
  encaixarGrelha,
  criarMesa,
  moverMesa,
  adicionarMesa,
  removerMesa,
  atualizarMesa,
  posicaoParaIndice,
  mesasParaQrs,
  parsePlanta,
  MAX_MESAS_PLANTA,
  type Mesa,
} from './planta';

function mesa(over: Partial<Mesa> = {}): Mesa {
  return {
    id: over.id ?? 'm1',
    nome: over.nome ?? 'Mesa 1',
    lugares: over.lugares ?? 8,
    x: over.x ?? 50,
    y: over.y ?? 50,
    forma: over.forma ?? 'redonda',
  };
}

describe('normalizarPosicao', () => {
  it('limita a 0..100', () => {
    expect(normalizarPosicao(-10)).toBe(0);
    expect(normalizarPosicao(140)).toBe(100);
  });

  it('mantém valores válidos', () => {
    expect(normalizarPosicao(37.5)).toBe(37.5);
  });

  it('valores inválidos dão 0', () => {
    expect(normalizarPosicao(NaN)).toBe(0);
    expect(normalizarPosicao(Infinity)).toBe(0);
  });
});

describe('encaixarGrelha', () => {
  it('aproxima ao múltiplo do passo', () => {
    expect(encaixarGrelha(42, 5)).toBe(40);
    expect(encaixarGrelha(43, 5)).toBe(45);
  });

  it('continua limitado a 0..100', () => {
    expect(encaixarGrelha(103, 5)).toBe(100);
    expect(encaixarGrelha(-3, 5)).toBe(0);
  });
});

describe('criarMesa', () => {
  it('cria ids únicos', () => {
    const a = criarMesa('A', 4);
    const b = criarMesa('B', 4);
    expect(a.id).not.toBe(b.id);
  });

  it('limita as posições', () => {
    const m = criarMesa('X', 4, 'quadrada', 200, -5);
    expect(m.x).toBe(100);
    expect(m.y).toBe(0);
    expect(m.forma).toBe('quadrada');
  });
});

describe('moverMesa', () => {
  it('move apenas a mesa indicada e limita a posição', () => {
    const lista = [mesa({ id: 'a', x: 10, y: 10 }), mesa({ id: 'b', x: 20, y: 20 })];
    const next = moverMesa(lista, 'a', 150, -20);
    expect(next[0]).toMatchObject({ id: 'a', x: 100, y: 0 });
    expect(next[1]).toMatchObject({ id: 'b', x: 20, y: 20 });
  });
});

describe('adicionarMesa / removerMesa', () => {
  it('remove por id', () => {
    const lista = [mesa({ id: 'a' }), mesa({ id: 'b' })];
    expect(removerMesa(lista, 'a').map((m) => m.id)).toEqual(['b']);
  });

  it('não passa do máximo', () => {
    const cheio = Array.from({ length: MAX_MESAS_PLANTA }, (_, i) => mesa({ id: `m${i}` }));
    expect(adicionarMesa(cheio, mesa({ id: 'novo' }))).toHaveLength(MAX_MESAS_PLANTA);
  });
});

describe('atualizarMesa', () => {
  it('aplica o patch e preserva o id', () => {
    const lista = [mesa({ id: 'a', nome: 'Antiga', lugares: 4 })];
    const next = atualizarMesa(lista, 'a', { nome: 'Nova', lugares: 12 });
    expect(next[0]).toMatchObject({ id: 'a', nome: 'Nova', lugares: 12 });
  });
});

describe('posicaoParaIndice', () => {
  it('mantém uma única posição centrada', () => {
    expect(posicaoParaIndice(0, 1)).toEqual({ x: 50, y: 50 });
  });

  it('distribui dentro de 0..100 sem saturar', () => {
    for (let total = 1; total <= 60; total++) {
      for (let i = 0; i < total; i++) {
        const p = posicaoParaIndice(i, total);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(100);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(100);
      }
    }
  });

  it('posições de mesas diferentes não coincidem (total pequeno)', () => {
    const pos = new Set<string>();
    for (let i = 0; i < 12; i++) {
      const p = posicaoParaIndice(i, 12);
      pos.add(`${p.x},${p.y}`);
    }
    expect(pos.size).toBe(12);
  });
});

describe('mesasParaQrs', () => {
  it('extrai nomes e lugares', () => {
    const r = mesasParaQrs([mesa({ nome: 'Balcão', lugares: 4 }), mesa({ nome: 'VIP', lugares: 12 })]);
    expect(r.nomes).toEqual(['Balcão', 'VIP']);
    expect(r.lugares).toEqual({ Balcão: 4, VIP: 12 });
    expect(r.duplicados).toEqual([]);
  });

  it('ignora nomes vazios e reporta duplicados', () => {
    const r = mesasParaQrs([
      mesa({ nome: '  ' }),
      mesa({ nome: 'Mesa 1' }),
      mesa({ nome: 'Mesa 1' }),
      mesa({ nome: 'Mesa 2' }),
      mesa({ nome: 'Mesa 2' }),
    ]);
    expect(r.nomes).toEqual(['Mesa 1', 'Mesa 2']);
    expect(r.duplicados).toEqual(['Mesa 1', 'Mesa 2']);
  });
});

describe('parsePlanta', () => {
  it('devolve [] para json inválido ou não-array', () => {
    expect(parsePlanta(null)).toEqual([]);
    expect(parsePlanta('{')).toEqual([]);
    expect(parsePlanta('{"a":1}')).toEqual([]);
  });

  it('filtra itens inválidos e normaliza', () => {
    const raw = JSON.stringify([
      { id: 'a', nome: 'Mesa 1', lugares: 8.9, x: 150, y: -3, forma: 'quadrada' },
      { id: 'b' },
      null,
    ]);
    expect(parsePlanta(raw)).toEqual([
      { id: 'a', nome: 'Mesa 1', lugares: 8, x: 100, y: 0, forma: 'quadrada' },
    ]);
  });
});
