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
  resolverPlanoCargaPlanta,
  type PlantaPendente,
  parsePlantaPendente,
  descreverIdade,
  pendentesOrfaos,
  chavePlantaPendente,
  MAX_MESAS_PLANTA,
  corZona,
  normalizarDimensao,
  normalizarZona,
  criarZona,
  adicionarZona,
  removerZona,
  atualizarZona,
  moverZona,
  redimensionarZona,
  zonaContemPonto,
  zonaPrincipal,
  agruparMesasPorZona,
  paresDeSobreposicao,
  parseZona,
  parseDocumentoPlanta,
  reorganizarMesasComZonas,
  renderSvgPlanta,
  escaparXml,
  normalizarDimensoes,
  proporcaoPlanta,
  dimensoesExport,
  formatarMetros,
  normalizarRotacao,
  PASSO_ROTACAO,
  MAX_ZONAS_PLANTA,
  ZONA_MIN,
  type Mesa,
  type Zona,
} from './planta';

function mesa(over: Partial<Mesa> = {}): Mesa {
  return {
    id: over.id ?? 'm1',
    nome: over.nome ?? 'Mesa 1',
    lugares: over.lugares ?? 8,
    x: over.x ?? 50,
    y: over.y ?? 50,
    forma: over.forma ?? 'redonda',
    rotacao: over.rotacao ?? 0,
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
      { id: 'a', nome: 'Mesa 1', lugares: 8, x: 100, y: 0, forma: 'quadrada', rotacao: 0 },
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

describe('resolverPlanoCargaPlanta', () => {
  const mesaRemota = criarMesa('Remota', 4, 'redonda', 10, 10);
  const mesaLocal = criarMesa('Local', 6, 'quadrada', 50, 50);
  const zonaRemota = criarZona('Zona R', corZona(0), 0, 0, 30, 30);
  const pendente: PlantaPendente = {
    mesas: [mesaLocal],
    zonas: [],
    version: 3,
    ts: 1_760_000_000_000,
  };
  const base = {
    editadoDesdeCarga: false,
    pendente: null as PlantaPendente | null,
    remoto: { mesas: [mesaRemota], zonas: [zonaRemota], version: 5 },
    local: { mesas: [mesaLocal], zonas: [] as ReturnType<typeof criarZona>[] },
  };

  it('aplica o documento remoto quando não há pendente nem edição', () => {
    expect(resolverPlanoCargaPlanta(base)).toEqual({
      tipo: 'aplicar',
      mesas: [mesaRemota],
      zonas: [zonaRemota],
      version: 5,
    });
  });

  it('não toca no estado quando o utilizador editou desde a carga', () => {
    expect(resolverPlanoCargaPlanta({ ...base, editadoDesdeCarga: true })).toEqual({
      tipo: 'ignorar',
    });
  });

  it('oferece importação quando o servidor está vazio e há mesas locais', () => {
    expect(
      resolverPlanoCargaPlanta({
        ...base,
        remoto: { mesas: [], zonas: [], version: 0 },
      }),
    ).toEqual({ tipo: 'oferecer-importacao' });
  });

  it('conflito expõe as remotas, a versão do servidor e a idade do pendente', () => {
    expect(resolverPlanoCargaPlanta({ ...base, pendente })).toEqual({
      tipo: 'conflito-pendente',
      mesas: [mesaRemota],
      zonas: [zonaRemota],
      version: 5,
      pendenteTs: 1_760_000_000_000,
    });
  });

  it('retoma a edição local (mesas e zonas pendentes) com a versão do servidor', () => {
    // No efeito, `local` é o próprio pendente quando existe — por isso as zonas
    // pendentes aparecem nos dois lados da entrada.
    const zonaPendente = criarZona('Pendente', corZona(1), 60, 60, 30, 30);
    expect(
      resolverPlanoCargaPlanta({
        ...base,
        pendente: { ...pendente, version: 5, zonas: [zonaPendente] },
        local: { mesas: [mesaLocal], zonas: [zonaPendente] },
      }),
    ).toEqual({
      tipo: 'retomar-pendente',
      mesas: [mesaLocal],
      zonas: [zonaPendente],
      version: 5,
    });
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
      mesas: [{ id: 'a', nome: 'Mesa 1', lugares: 4, x: 10, y: 20, forma: 'redonda', rotacao: 0 }],
      version: 5,
      ts: 1700000000000,
    });
    expect(parsePlantaPendente(raw)).toEqual({
      mesas: [{ id: 'a', nome: 'Mesa 1', lugares: 4, x: 10, y: 20, forma: 'redonda', rotacao: 0 }],
      zonas: [],
      version: 5,
      ts: 1700000000000,
    });
  });

  it('lê as zonas do pendente', () => {
    const raw = JSON.stringify({
      mesas: [],
      zonas: [{ id: 'z1', nome: 'Esplanada', cor: '#10b981', x: 0, y: 0, w: 20, h: 20 }],
      version: 1,
      ts: 1,
    });
    expect(parsePlantaPendente(raw)?.zonas).toEqual([
      { id: 'z1', nome: 'Esplanada', cor: '#10b981', x: 0, y: 0, w: 20, h: 20 },
    ]);
  });

  it('normaliza version e ts inválidas para 0', () => {
    expect(parsePlantaPendente(JSON.stringify({ mesas: [], version: -3, ts: -3 }))).toEqual({
      mesas: [],
      zonas: [],
      version: 0,
      ts: 0,
    });
    expect(parsePlantaPendente(JSON.stringify({ mesas: [] }))).toEqual({
      mesas: [],
      zonas: [],
      version: 0,
      ts: 0,
    });
    expect(parsePlantaPendente(JSON.stringify({ mesas: [], version: 2.9, ts: 'x' }))).toEqual({
      mesas: [],
      zonas: [],
      version: 2,
      ts: 0,
    });
  });

  it('filtra mesas inválidas via parsePlanta', () => {
    const raw = JSON.stringify({ mesas: [{ id: 'a', nome: 'Mesa 1' }, { nome: 'sem id' }] });
    expect(parsePlantaPendente(raw)?.mesas).toEqual([
      { id: 'a', nome: 'Mesa 1', lugares: 0, x: 0, y: 0, forma: 'redonda', rotacao: 0 },
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

function zona(over: Partial<Zona> = {}): Zona {
  return {
    id: over.id ?? 'z1',
    nome: over.nome ?? 'Zona 1',
    cor: over.cor ?? '#3b82f6',
    x: over.x ?? 10,
    y: over.y ?? 10,
    w: over.w ?? 30,
    h: over.h ?? 30,
  };
}

describe('corZona', () => {
  it('devolve a primeira cor da paleta', () => {
    expect(corZona(0)).toBe('#3b82f6');
  });

  it('cicla pela paleta', () => {
    expect(corZona(6)).toBe(corZona(0));
    expect(corZona(7)).toBe(corZona(1));
  });

  it('trata índices negativos ou inválidos', () => {
    expect(corZona(-1)).toBe(corZona(1));
    expect(corZona(NaN)).toBe(corZona(0));
  });
});

describe('normalizarDimensao', () => {
  it('impõe um mínimo de ZONA_MIN', () => {
    expect(normalizarDimensao(3)).toBe(ZONA_MIN);
    expect(normalizarDimensao(0)).toBe(ZONA_MIN);
  });

  it('limita a 100', () => {
    expect(normalizarDimensao(140)).toBe(100);
  });

  it('valores inválidos dão ZONA_MIN', () => {
    expect(normalizarDimensao(NaN)).toBe(ZONA_MIN);
  });
});

describe('normalizarZona', () => {
  it('empurra a zona para dentro dos limites', () => {
    const z = normalizarZona(zona({ x: 99, y: 99, w: 30, h: 30 }));
    expect(z.x).toBe(70);
    expect(z.y).toBe(70);
  });

  it('impõe as dimensões mínimas', () => {
    const z = normalizarZona(zona({ w: 1, h: 1 }));
    expect(z.w).toBe(ZONA_MIN);
    expect(z.h).toBe(ZONA_MIN);
  });
});

describe('criarZona', () => {
  it('cria com id e clampa a posição', () => {
    const z = criarZona('Esplanada', '#fff', 90, 90, 30, 30);
    expect(z.id).toMatch(/^zona-/);
    expect(z.nome).toBe('Esplanada');
    expect(z.x).toBe(70);
    expect(z.y).toBe(70);
  });
});

describe('adicionarZona / removerZona', () => {
  it('adiciona zonas', () => {
    expect(adicionarZona([], zona())).toHaveLength(1);
  });

  it('não passa de MAX_ZONAS_PLANTA', () => {
    const cheias = Array.from({ length: MAX_ZONAS_PLANTA }, (_, i) => zona({ id: `z${i}` }));
    expect(adicionarZona(cheias, zona({ id: 'nova' }))).toHaveLength(MAX_ZONAS_PLANTA);
  });

  it('remove pelo id', () => {
    expect(removerZona([zona({ id: 'a' }), zona({ id: 'b' })], 'a')).toEqual([zona({ id: 'b' })]);
  });
});

describe('atualizarZona', () => {
  it('aplica o patch e normaliza', () => {
    const [z] = atualizarZona([zona()], 'z1', { nome: 'Bar', x: 95, w: 30 });
    expect(z.nome).toBe('Bar');
    expect(z.x).toBe(70);
  });

  it('ignora zonas com outro id', () => {
    expect(atualizarZona([zona({ id: 'z2' })], 'z1', { nome: 'X' })[0].nome).toBe('Zona 1');
  });
});

describe('moverZona', () => {
  it('limita a posição a 100 - dimensão', () => {
    const [z] = moverZona([zona({ w: 30, h: 20 })], 'z1', 90, 95);
    expect(z.x).toBe(70);
    expect(z.y).toBe(80);
  });

  it('não deixa mover para negativo', () => {
    const [z] = moverZona([zona()], 'z1', -10, -10);
    expect(z.x).toBe(0);
    expect(z.y).toBe(0);
  });
});

describe('paresDeSobreposicao', () => {
  it('zonas separadas devolvem vazio', () => {
    const pares = paresDeSobreposicao([
      zona({ id: 'a', x: 0, y: 0, w: 20, h: 20 }),
      zona({ id: 'b', x: 30, y: 0, w: 20, h: 20 }),
    ]);
    expect(pares).toEqual([]);
  });

  it('zonas encostadas (interseccão zero) não contam', () => {
    const pares = paresDeSobreposicao([
      zona({ id: 'a', x: 0, y: 0, w: 20, h: 20 }),
      zona({ id: 'b', x: 20, y: 0, w: 20, h: 20 }),
    ]);
    expect(pares).toEqual([]);
  });

  it('sobreposição abaixo do limiar (15%) não conta', () => {
    const pares = paresDeSobreposicao([
      zona({ id: 'a', x: 0, y: 0, w: 20, h: 20 }),
      zona({ id: 'b', x: 17, y: 0, w: 20, h: 20 }),
    ]);
    expect(pares).toEqual([]);
  });

  it('sobreposição significativa (25% da menor) é detectada', () => {
    const pares = paresDeSobreposicao([
      zona({ id: 'a', x: 0, y: 0, w: 20, h: 20 }),
      zona({ id: 'b', x: 15, y: 0, w: 20, h: 20 }),
    ]);
    expect(pares).toHaveLength(1);
    expect(pares[0]).toEqual({ a: 'a', b: 'b', fracao: 0.25 });
  });

  it('zona pequena contida numa grande tem fracao 1', () => {
    const pares = paresDeSobreposicao([
      zona({ id: 'grande', x: 0, y: 0, w: 50, h: 50 }),
      zona({ id: 'pequena', x: 10, y: 10, w: 10, h: 10 }),
    ]);
    expect(pares).toEqual([{ a: 'grande', b: 'pequena', fracao: 1 }]);
  });

  it('respeita um limiar personalizado', () => {
    const sobre = [
      zona({ id: 'a', x: 0, y: 0, w: 20, h: 20 }),
      zona({ id: 'b', x: 17, y: 0, w: 20, h: 20 }),
    ];
    expect(paresDeSobreposicao(sobre, 0.1)).toHaveLength(1);
    expect(paresDeSobreposicao(sobre, 0.15)).toHaveLength(1);
    expect(paresDeSobreposicao(sobre, 0.2)).toHaveLength(0);
  });
});

describe('redimensionarZona', () => {
  it('clampa a dimensão e reposiciona', () => {
    const [z] = redimensionarZona([zona({ x: 70, y: 70, w: 30, h: 30 })], 'z1', 60, 60);
    expect(z.w).toBe(60);
    expect(z.h).toBe(60);
    expect(z.x).toBe(40);
    expect(z.y).toBe(40);
  });

  it('não deixa encolher abaixo do mínimo', () => {
    const [z] = redimensionarZona([zona()], 'z1', 1, 1);
    expect(z.w).toBe(ZONA_MIN);
    expect(z.h).toBe(ZONA_MIN);
  });
});

describe('zonaContemPonto', () => {
  const z = zona({ x: 10, y: 10, w: 30, h: 30 });

  it('inclui as fronteiras', () => {
    expect(zonaContemPonto(z, 10, 10)).toBe(true);
    expect(zonaContemPonto(z, 40, 40)).toBe(true);
  });

  it('exclui o exterior', () => {
    expect(zonaContemPonto(z, 9, 10)).toBe(false);
    expect(zonaContemPonto(z, 41, 41)).toBe(false);
  });
});

describe('zonaPrincipal', () => {
  it('devolve a primeira zona em sobreposição', () => {
    const zonas = [
      zona({ id: 'z1', x: 0, y: 0, w: 60, h: 60 }),
      zona({ id: 'z2', x: 0, y: 0, w: 60, h: 60 }),
    ];
    expect(zonaPrincipal(mesa({ x: 30, y: 30 }), zonas)?.id).toBe('z1');
  });

  it('devolve null fora de qualquer zona', () => {
    expect(zonaPrincipal(mesa({ x: 95, y: 95 }), [zona()])).toBeNull();
  });
});

describe('agruparMesasPorZona', () => {
  const zonas = [
    zona({ id: 'z1', x: 0, y: 0, w: 50, h: 50 }),
    zona({ id: 'z2', x: 50, y: 0, w: 50, h: 50 }),
  ];

  it('agrupa por zona e põe as restantes em "sem zona"', () => {
    const ma = mesa({ id: 'a', x: 10, y: 10 });
    const mb = mesa({ id: 'b', x: 75, y: 10 });
    const mc = mesa({ id: 'c', x: 50, y: 90 });
    const grupos = agruparMesasPorZona([ma, mb, mc], zonas);
    expect(grupos.map((g) => g.zona?.id ?? null)).toEqual(['z1', 'z2', null]);
    expect(grupos[0].mesas).toEqual([ma]);
    expect(grupos[1].mesas).toEqual([mb]);
    expect(grupos[2].mesas).toEqual([mc]);
  });

  it('não cria grupo "sem zona" quando todas têm zona', () => {
    const grupos = agruparMesasPorZona([mesa({ id: 'a', x: 10, y: 10 })], zonas);
    expect(grupos.map((g) => g.zona?.id)).toEqual(['z1', 'z2']);
  });
});

describe('parseZona', () => {
  it('rejeita itens inválidos', () => {
    expect(parseZona(null)).toBeNull();
    expect(parseZona({})).toBeNull();
  });

  it('preenche predefinições e clampa dimensões', () => {
    const z = parseZona({ id: 'z1', w: 0 });
    expect(z).not.toBeNull();
    expect(z!.nome).toBe('');
    expect(z!.cor).toBe(corZona(0));
    expect(z!.w).toBe(ZONA_MIN);
    expect(z!.h).toBe(ZONA_MIN);
  });
});

describe('parseDocumentoPlanta', () => {
  it('devolve vazio para entrada nula ou inválida', () => {
    expect(parseDocumentoPlanta(null)).toEqual({ mesas: [], zonas: [] });
    expect(parseDocumentoPlanta('{')).toEqual({ mesas: [], zonas: [] });
  });

  it('aceita o formato legado (array só de mesas)', () => {
    const doc = parseDocumentoPlanta(JSON.stringify([mesa({ id: 'a' })]));
    expect(doc.mesas).toHaveLength(1);
    expect(doc.zonas).toEqual([]);
  });

  it('lê mesas e zonas de um documento', () => {
    const doc = parseDocumentoPlanta(
      JSON.stringify({ mesas: [mesa({ id: 'a' })], zonas: [{ id: 'z1', w: 20, h: 20 }] }),
    );
    expect(doc.mesas).toHaveLength(1);
    expect(doc.zonas).toHaveLength(1);
    expect(doc.zonas[0].id).toBe('z1');
  });

  it('ignora zonas inválidas', () => {
    const doc = parseDocumentoPlanta(
      JSON.stringify({ mesas: [], zonas: [{ sem: 'id' }, { id: 'z1' }] }),
    );
    expect(doc.zonas.map((z) => z.id)).toEqual(['z1']);
  });

  it('trata mesas não-array como vazio', () => {
    expect(parseDocumentoPlanta(JSON.stringify({ mesas: 'x', zonas: [] })).mesas).toEqual([]);
  });
});

describe('reorganizarMesasComZonas', () => {
  const z = zona({ id: 'z1', x: 10, y: 10, w: 40, h: 40 });

  it('coloca as mesas dentro da sua zona', () => {
    const mesas = [
      mesa({ id: 'a', x: 20, y: 20 }),
      mesa({ id: 'b', x: 25, y: 25 }),
      mesa({ id: 'c', x: 30, y: 30 }),
    ];
    const resultado = reorganizarMesasComZonas(mesas, [z]);
    for (const m of resultado) {
      expect(m.x).toBeGreaterThanOrEqual(z.x);
      expect(m.x).toBeLessThanOrEqual(z.x + z.w);
      expect(m.y).toBeGreaterThanOrEqual(z.y);
      expect(m.y).toBeLessThanOrEqual(z.y + z.h);
    }
  });

  it('põe as mesas sem zona numa faixa no topo', () => {
    const mesas = [mesa({ id: 'a', x: 90, y: 90 }), mesa({ id: 'b', x: 95, y: 95 })];
    const resultado = reorganizarMesasComZonas(mesas, [z]);
    for (const m of resultado) expect(m.y).toBeLessThanOrEqual(40);
  });

  it('preserva id, ordem e número de mesas', () => {
    const mesas = [mesa({ id: 'a', x: 20, y: 20 }), mesa({ id: 'b', x: 90, y: 90 })];
    const resultado = reorganizarMesasComZonas(mesas, [z]);
    expect(resultado).toHaveLength(2);
    expect(resultado.map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('devolve a lista intacta sem mesas', () => {
    expect(reorganizarMesasComZonas([], [z])).toEqual([]);
  });
});

describe('escaparXml', () => {
  it('escapa os caracteres sensíveis', () => {
    expect(escaparXml('<b>&"\'')).toBe('&lt;b&gt;&amp;&quot;&apos;');
  });
});

describe('renderSvgPlanta', () => {
  it('devolve um SVG com a zona e a mesa', () => {
    const svg = renderSvgPlanta({
      mesas: [mesa({ id: 'a', x: 20, y: 20, forma: 'redonda' })],
      zonas: [zona({ id: 'z1', cor: '#10b981' })],
    });
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('</svg>');
    expect(svg).toContain('#10b981');
    expect(svg).toContain('<circle');
  });

  it('desenha as mesas quadradas como rectângulos', () => {
    const svg = renderSvgPlanta({ mesas: [mesa({ id: 'a', forma: 'quadrada' })], zonas: [] });
    expect(svg).toContain('<rect');
    expect(svg).not.toContain('<circle');
  });

  it('escapa o texto das mesas e zonas', () => {
    const svg = renderSvgPlanta({
      mesas: [mesa({ id: 'a', nome: '<b>&"' })],
      zonas: [zona({ id: 'z1', nome: '<script>' })],
    });
    expect(svg).not.toContain('<b>');
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;b&gt;&amp;&quot;');
    expect(svg).toContain('&lt;script&gt;');
  });

  it('sem dimensões mantém o viewBox quadrado e sem barra de escala', () => {
    const svg = renderSvgPlanta({ mesas: [], zonas: [] });
    expect(svg).toContain('viewBox="0 0 100 100"');
    expect(svg).not.toContain('×');
  });

  it('com dimensões usa a proporção real e desenha a barra de escala', () => {
    const svg = renderSvgPlanta({
      mesas: [mesa({ x: 50, y: 50 })],
      zonas: [],
      dimensoes: { larguraM: 20, alturaM: 12 },
    });
    expect(svg).toContain('viewBox="0 0 100 60"');
    expect(svg).toContain('5,0 m');
    expect(svg).toContain('20,0 m × 12,0 m');
    expect(svg).toMatch(/<circle cx="50" cy="30"/);
  });

  it('permite omitir a barra de escala', () => {
    const svg = renderSvgPlanta(
      { mesas: [], zonas: [], dimensoes: { larguraM: 20, alturaM: 12 } },
      { mostrarEscala: false },
    );
    expect(svg).not.toContain('5,0 m');
  });
});

describe('rotação de mesas', () => {
  it('normaliza para o intervalo 0-359', () => {
    expect(normalizarRotacao(0)).toBe(0);
    expect(normalizarRotacao(45)).toBe(45);
    expect(normalizarRotacao(360)).toBe(0);
    expect(normalizarRotacao(405)).toBe(45);
    expect(normalizarRotacao(-45)).toBe(315);
    expect(normalizarRotacao(44.6)).toBe(45);
    expect(normalizarRotacao(NaN)).toBe(0);
    expect(PASSO_ROTACAO).toBe(45);
  });

  it('criarMesa assume 0 e aceita rotação', () => {
    expect(criarMesa('Mesa 1', 4).rotacao).toBe(0);
    expect(criarMesa('Mesa 1', 4, 'quadrada', 50, 50, 90).rotacao).toBe(90);
    expect(criarMesa('Mesa 1', 4, 'quadrada', 50, 50, 450).rotacao).toBe(90);
  });

  it('parsePlanta lê a rotação e descarta inválidos', () => {
    const raw = JSON.stringify([
      { id: 'a', nome: 'A', rotacao: 45 },
      { id: 'b', nome: 'B', rotacao: -90 },
      { id: 'c', nome: 'C', rotacao: 'x' },
    ]);
    expect(parsePlanta(raw).map((m) => m.rotacao)).toEqual([45, 270, 0]);
  });

  it('moverMesa preserva a rotação', () => {
    const movidas = moverMesa([mesa({ rotacao: 90 })], 'm1', 10, 20);
    expect(movidas[0].rotacao).toBe(90);
  });

  it('renderSvgPlanta roda só a forma, mantendo o rótulo direito', () => {
    const svg = renderSvgPlanta({
      mesas: [mesa({ id: 'a', forma: 'quadrada', rotacao: 90 })],
      zonas: [],
    });
    expect(svg).toContain('<g transform="rotate(90 50 50)"><rect');
    expect(svg).not.toContain('<g transform="rotate(90 50 50)"><text');
  });

  it('sem rotação não emite grupo de transformação', () => {
    const svg = renderSvgPlanta({ mesas: [mesa({ rotacao: 0 })], zonas: [] });
    expect(svg).not.toContain('<g transform');
  });
});

describe('dimensões reais', () => {
  it('normaliza valores válidos com uma decimal', () => {
    expect(normalizarDimensoes({ larguraM: 20.55, alturaM: 12 })).toEqual({
      larguraM: 20.6,
      alturaM: 12,
    });
  });

  it('limita entre 1 e 200 metros', () => {
    expect(normalizarDimensoes({ larguraM: 0, alturaM: 500 })).toEqual({
      larguraM: 1,
      alturaM: 200,
    });
  });

  it('devolve null para valores inválidos', () => {
    expect(normalizarDimensoes(null)).toBeNull();
    expect(normalizarDimensoes({ larguraM: '20', alturaM: 12 })).toBeNull();
    expect(normalizarDimensoes({ larguraM: NaN, alturaM: 12 })).toBeNull();
  });

  it('proporção cai em 16:9 sem dimensões', () => {
    expect(proporcaoPlanta(null)).toBeCloseTo(16 / 9);
    expect(proporcaoPlanta({ larguraM: 20, alturaM: 12 })).toBeCloseTo(5 / 3);
  });

  it('exporta a 100 px/m', () => {
    expect(dimensoesExport({ larguraM: 20, alturaM: 12 })).toEqual({
      larguraPx: 2000,
      alturaPx: 1200,
      pxPorMetro: 100,
    });
  });

  it('limita o lado maior a 6000 px', () => {
    expect(dimensoesExport({ larguraM: 100, alturaM: 50 })).toEqual({
      larguraPx: 6000,
      alturaPx: 3000,
      pxPorMetro: 60,
    });
  });

  it('sem dimensões não há tamanho de export', () => {
    expect(dimensoesExport(null)).toBeNull();
  });

  it('formata metros com vírgula', () => {
    expect(formatarMetros(5)).toBe('5,0 m');
    expect(formatarMetros(3.14)).toBe('3,1 m');
  });

  it('parseDocumentoPlanta preserva dimensões válidas', () => {
    const doc = parseDocumentoPlanta(
      JSON.stringify({ mesas: [], zonas: [], dimensoes: { larguraM: 20, alturaM: 12 } }),
    );
    expect(doc.dimensoes).toEqual({ larguraM: 20, alturaM: 12 });
  });

  it('parseDocumentoPlanta descarta dimensões inválidas', () => {
    const doc = parseDocumentoPlanta(
      JSON.stringify({ mesas: [], zonas: [], dimensoes: { larguraM: 'x' } }),
    );
    expect(doc.dimensoes).toBeUndefined();
  });
});

