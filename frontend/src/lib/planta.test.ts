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
  reorganizarMesas,
  novoIdMesa,
  mesasParaQrs,
  parsePlanta,
  decidirPlantaRemota,
  parsePlantaPendente,
  descreverIdade,
  pendentesOrfaos,
  chavePlantaPendente,
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

describe('reorganizarMesas', () => {
  it('não altera uma lista vazia', () => {
    expect(reorganizarMesas([])).toEqual([]);
  });

  it('centra uma única mesa', () => {
    const r = reorganizarMesas([mesa({ id: 'a', x: 3, y: 9 })]);
    expect(r[0]).toMatchObject({ id: 'a', x: 50, y: 50 });
  });

  it('reposiciona todas dentro de 0..100 preservando id/nome/lugares', () => {
    const lista = Array.from({ length: 9 }, (_, i) => mesa({ id: `m${i}`, nome: `Mesa ${i}` }));
    const r = reorganizarMesas(lista);
    expect(r).toHaveLength(9);
    for (const m of r) {
      expect(m.x).toBeGreaterThanOrEqual(0);
      expect(m.x).toBeLessThanOrEqual(100);
      expect(m.y).toBeGreaterThanOrEqual(0);
      expect(m.y).toBeLessThanOrEqual(100);
    }
    expect(r.map((m) => m.id)).toEqual(lista.map((m) => m.id));
    expect(r[0].nome).toBe('Mesa 0');
  });
});

describe('novoIdMesa', () => {
  it('gera ids únicos e não depende de contador de módulo', () => {
    const ids = new Set(Array.from({ length: 500 }, () => novoIdMesa()));
    expect(ids.size).toBe(500);
  });

  it('não tem espaços e começa por mesa-', () => {
    const id = novoIdMesa();
    expect(id.startsWith('mesa-')).toBe(true);
    expect(id).not.toContain(' ');
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
    expect(r.duplicados).toEqual([
      { nome: 'Mesa 1', ocorrencias: 2 },
      { nome: 'Mesa 2', ocorrencias: 2 },
    ]);
  });

  it('conta as ocorrências e trata duplicados de forma case-insensitive', () => {
    const r = mesasParaQrs([
      mesa({ nome: 'Mesa 1', lugares: 8 }),
      mesa({ nome: 'mesa 1', lugares: 4 }),
      mesa({ nome: 'MESA 1', lugares: 2 }),
    ]);
    expect(r.nomes).toEqual(['Mesa 1']);
    expect(r.lugares).toEqual({ 'Mesa 1': 8 });
    expect(r.duplicados).toEqual([{ nome: 'Mesa 1', ocorrencias: 3 }]);
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

describe('decidirPlantaRemota', () => {
  const base = {
    editadoDesdeCarga: false,
    pendenteVersao: null as number | null,
    versaoServidor: 3,
    mesasServidor: 2,
    mesasLocais: 2,
  };

  it('ignora quando o utilizador editou desde a carga', () => {
    expect(decidirPlantaRemota({ ...base, editadoDesdeCarga: true })).toBe('ignorar');
  });

  it('retoma automaticamente quando a versão do pendente coincide com o servidor', () => {
    expect(decidirPlantaRemota({ ...base, pendenteVersao: 3, versaoServidor: 3 })).toBe(
      'retomar-pendente',
    );
  });

  it('sinaliza conflito-pendente quando o servidor mudou desde o pendente', () => {
    expect(decidirPlantaRemota({ ...base, pendenteVersao: 3, versaoServidor: 5 })).toBe(
      'conflito-pendente',
    );
  });

  it('retomar-pendente tem prioridade sobre oferecer-importacao', () => {
    expect(
      decidirPlantaRemota({
        ...base,
        pendenteVersao: 0,
        versaoServidor: 0,
        mesasServidor: 0,
        mesasLocais: 5,
      }),
    ).toBe('retomar-pendente');
  });

  it('conflito-pendente tem prioridade sobre oferecer-importacao', () => {
    expect(
      decidirPlantaRemota({
        ...base,
        pendenteVersao: 4,
        versaoServidor: 0,
        mesasServidor: 0,
        mesasLocais: 5,
      }),
    ).toBe('conflito-pendente');
  });

  it('a edição em curso tem prioridade sobre o pendente', () => {
    expect(
      decidirPlantaRemota({ ...base, editadoDesdeCarga: true, pendenteVersao: 3 }),
    ).toBe('ignorar');
  });

  it('oferece importação quando o servidor está vazio e há mesas locais', () => {
    expect(
      decidirPlantaRemota({ ...base, versaoServidor: 0, mesasServidor: 0, mesasLocais: 5 }),
    ).toBe('oferecer-importacao');
  });

  it('aplica quando o servidor tem mesas', () => {
    expect(
      decidirPlantaRemota({ ...base, versaoServidor: 0, mesasServidor: 3, mesasLocais: 0 }),
    ).toBe('aplicar');
  });

  it('aplica quando ambos estão vazios (nada a importar)', () => {
    expect(
      decidirPlantaRemota({ ...base, versaoServidor: 0, mesasServidor: 0, mesasLocais: 0 }),
    ).toBe('aplicar');
  });

  it('aplica quando o servidor tem version mas não há mesas locais', () => {
    expect(decidirPlantaRemota({ ...base, mesasLocais: 0 })).toBe('aplicar');
  });
});

describe('parsePlantaPendente', () => {
  it('devolve null para json inválido, nulo ou sem mesas', () => {
    expect(parsePlantaPendente(null)).toBeNull();
    expect(parsePlantaPendente('{')).toBeNull();
    expect(parsePlantaPendente('{"ts":2}')).toBeNull();
    expect(parsePlantaPendente('"x"')).toBeNull();
  });

  it('lê mesas, version e ts', () => {
    const raw = JSON.stringify({
      mesas: [{ id: 'a', nome: 'Mesa 1', lugares: 4, x: 10, y: 20, forma: 'redonda' }],
      version: 5,
      ts: 1700000000000,
    });
    expect(parsePlantaPendente(raw)).toEqual({
      mesas: [{ id: 'a', nome: 'Mesa 1', lugares: 4, x: 10, y: 20, forma: 'redonda' }],
      version: 5,
      ts: 1700000000000,
    });
  });

  it('normaliza version e ts inválidas para 0', () => {
    expect(parsePlantaPendente(JSON.stringify({ mesas: [], version: -3, ts: -3 }))).toEqual({
      mesas: [],
      version: 0,
      ts: 0,
    });
    expect(parsePlantaPendente(JSON.stringify({ mesas: [] }))).toEqual({
      mesas: [],
      version: 0,
      ts: 0,
    });
    expect(parsePlantaPendente(JSON.stringify({ mesas: [], version: 2.9, ts: 'x' }))).toEqual({
      mesas: [],
      version: 2,
      ts: 0,
    });
  });

  it('filtra mesas inválidas via parsePlanta', () => {
    const raw = JSON.stringify({ mesas: [{ id: 'a', nome: 'Mesa 1' }, { nome: 'sem id' }] });
    expect(parsePlantaPendente(raw)?.mesas).toEqual([
      { id: 'a', nome: 'Mesa 1', lugares: 0, x: 0, y: 0, forma: 'redonda' },
    ]);
  });
});

describe('descreverIdade', () => {
  const agora = 1_700_000_000_000;

  it('devolve string vazia para ts inválida', () => {
    expect(descreverIdade(0, agora)).toBe('');
    expect(descreverIdade(NaN, agora)).toBe('');
    expect(descreverIdade(-5, agora)).toBe('');
  });

  it('descreve instantes, minutos, horas e dias', () => {
    expect(descreverIdade(agora - 5_000, agora)).toBe('há instantes');
    expect(descreverIdade(agora - 5 * 60_000, agora)).toBe('há 5 min');
    expect(descreverIdade(agora - 3 * 3_600_000, agora)).toBe('há 3 h');
    expect(descreverIdade(agora - 2 * 86_400_000, agora)).toBe('há 2 dias');
    expect(descreverIdade(agora - 86_400_000, agora)).toBe('há 1 dia');
  });
});

describe('pendentesOrfaos', () => {
  it('identifica chaves de eventos inexistentes', () => {
    const chaves = [
      chavePlantaPendente('festa'),
      chavePlantaPendente('apagado'),
      'sf:planta:festa',
      'sf:qr-lugares:festa',
    ];
    expect(pendentesOrfaos(chaves, ['festa'])).toEqual([chavePlantaPendente('apagado')]);
  });

  it('devolve [] quando todas são válidas', () => {
    expect(pendentesOrfaos([chavePlantaPendente('a')], ['a', 'b'])).toEqual([]);
  });
});
