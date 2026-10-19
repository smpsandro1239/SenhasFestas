export type FormaMesa = 'redonda' | 'quadrada';

export interface Mesa {
  id: string;
  nome: string;
  lugares: number;
  x: number;
  y: number;
  forma: FormaMesa;
  // Graus inteiros 0-359. Só visível em mesas não circulares (quadradas).
  rotacao: number;
}

export const MAX_MESAS_PLANTA = 200;
export const GRID_PLANTA = 5;
export const PASSO_ROTACAO = 45;

export function normalizarRotacao(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  const resto = Math.round(valor) % 360;
  return resto < 0 ? resto + 360 : resto;
}

export function normalizarPosicao(valor: number): number {
  if (!Number.isFinite(valor)) return 0;
  if (valor < 0) return 0;
  if (valor > 100) return 100;
  return Math.round(valor * 100) / 100;
}

export function encaixarGrelha(valor: number, passo = GRID_PLANTA): number {
  if (!Number.isFinite(valor) || passo <= 0) return normalizarPosicao(valor);
  return normalizarPosicao(Math.round(valor / passo) * passo);
}

export function novoIdMesa(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') {
    try {
      return `mesa-${c.randomUUID()}`;
    } catch {
      // cai no fallback abaixo
    }
  }
  return `mesa-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function criarMesa(
  nome: string,
  lugares: number,
  forma: FormaMesa = 'redonda',
  x = 50,
  y = 50,
  rotacao = 0,
): Mesa {
  return {
    id: novoIdMesa(),
    nome,
    lugares,
    x: normalizarPosicao(x),
    y: normalizarPosicao(y),
    forma,
    rotacao: normalizarRotacao(rotacao),
  };
}

export function moverMesa(mesas: Mesa[], id: string, x: number, y: number): Mesa[] {
  return mesas.map((mesa) =>
    mesa.id === id ? { ...mesa, x: normalizarPosicao(x), y: normalizarPosicao(y) } : mesa,
  );
}

export function adicionarMesa(mesas: Mesa[], mesa: Mesa): Mesa[] {
  if (mesas.length >= MAX_MESAS_PLANTA) return mesas;
  return [...mesas, mesa];
}

export function removerMesa(mesas: Mesa[], id: string): Mesa[] {
  return mesas.filter((mesa) => mesa.id !== id);
}

export function atualizarMesa(
  mesas: Mesa[],
  id: string,
  patch: Partial<Omit<Mesa, 'id'>>,
): Mesa[] {
  return mesas.map((mesa) => (mesa.id === id ? { ...mesa, ...patch, id: mesa.id } : mesa));
}

export interface NomeDuplicado {
  nome: string;
  ocorrencias: number;
}

export interface QrsDaPlanta {
  nomes: string[];
  lugares: Record<string, number>;
  duplicados: NomeDuplicado[];
}

export function posicaoParaIndice(indice: number, total: number): { x: number; y: number } {
  const n = Math.max(1, Math.trunc(total));
  const i = Math.max(0, Math.trunc(indice));
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  const rows = Math.max(1, Math.ceil(n / cols));
  const col = i % cols;
  const row = Math.floor(i / cols);
  const margem = 12;
  const span = 100 - margem * 2;
  const x = cols === 1 ? 50 : margem + (col * span) / (cols - 1);
  const y = rows === 1 ? 50 : margem + (row * span) / (rows - 1);
  return { x: normalizarPosicao(x), y: normalizarPosicao(y) };
}

export function reorganizarMesas(mesas: Mesa[]): Mesa[] {
  const total = mesas.length;
  if (total === 0) return mesas;
  return mesas.map((mesa, i) => {
    const { x, y } = posicaoParaIndice(i, total);
    return { ...mesa, x, y };
  });
}

export function mesasParaQrs(mesas: Mesa[]): QrsDaPlanta {
  const nomes: string[] = [];
  const lugares: Record<string, number> = {};
  const porChave = new Map<string, { nome: string; ocorrencias: number }>();
  for (const mesa of mesas) {
    const nome = mesa.nome.trim();
    if (!nome) continue;
    const chave = nome.toLowerCase();
    const existente = porChave.get(chave);
    if (existente) {
      existente.ocorrencias += 1;
      continue;
    }
    porChave.set(chave, { nome, ocorrencias: 1 });
    nomes.push(nome);
    lugares[nome] = mesa.lugares;
  }
  const duplicados: NomeDuplicado[] = [];
  for (const entrada of porChave.values()) {
    if (entrada.ocorrencias > 1) duplicados.push({ ...entrada });
  }
  return { nomes, lugares, duplicados };
}

export function parsePlanta(raw: string | null): Mesa[] {
  if (!raw) return [];
  let dados: unknown;
  try {
    dados = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(dados)) return [];
  const mesas: Mesa[] = [];
  for (const item of dados) {
    if (!item || typeof item !== 'object') continue;
    const m = item as Record<string, unknown>;
    if (typeof m.id !== 'string' || typeof m.nome !== 'string') continue;
    mesas.push({
      id: m.id,
      nome: m.nome,
      lugares:
        typeof m.lugares === 'number' && Number.isFinite(m.lugares)
          ? Math.max(0, Math.trunc(m.lugares))
          : 0,
      x: normalizarPosicao(typeof m.x === 'number' ? m.x : 0),
      y: normalizarPosicao(typeof m.y === 'number' ? m.y : 0),
      forma: m.forma === 'quadrada' ? 'quadrada' : 'redonda',
      rotacao: normalizarRotacao(typeof m.rotacao === 'number' ? m.rotacao : 0),
    });
  }
  return mesas;
}

export type ResultadoPlantaRemota =
  | 'aplicar'
  | 'ignorar'
  | 'oferecer-importacao'
  | 'conflito-pendente'
  | 'retomar-pendente';

export function decidirPlantaRemota(entrada: {
  editadoDesdeCarga: boolean;
  pendenteVersao: number | null;
  versaoServidor: number;
  mesasServidor: number;
  mesasLocais: number;
}): ResultadoPlantaRemota {
  if (entrada.editadoDesdeCarga) return 'ignorar';
  if (entrada.pendenteVersao !== null) {
    return entrada.versaoServidor === entrada.pendenteVersao
      ? 'retomar-pendente'
      : 'conflito-pendente';
  }
  if (entrada.versaoServidor === 0 && entrada.mesasServidor === 0 && entrada.mesasLocais > 0) {
    return 'oferecer-importacao';
  }
  return 'aplicar';
}

export interface EntradaCargaPlanta {
  editadoDesdeCarga: boolean;
  pendente: PlantaPendente | null;
  remoto: DocumentoPlanta & { version: number };
  local: DocumentoPlanta;
}

export type PlanoCargaPlanta =
  | { tipo: 'ignorar' }
  | { tipo: 'oferecer-importacao' }
  | {
      tipo: 'conflito-pendente';
      mesas: Mesa[];
      zonas: Zona[];
      version: number;
      pendenteTs: number;
    }
  | { tipo: 'retomar-pendente'; mesas: Mesa[]; zonas: Zona[]; version: number }
  | { tipo: 'aplicar'; mesas: Mesa[]; zonas: Zona[]; version: number };

/**
 * O que o efeito de carga da planta deve fazer para cada decisão. O efeito só
 * aplica o plano (refs, estado, localStorage); toda a decisão fica aqui testada.
 */
export function resolverPlanoCargaPlanta(entrada: EntradaCargaPlanta): PlanoCargaPlanta {
  const decisao = decidirPlantaRemota({
    editadoDesdeCarga: entrada.editadoDesdeCarga,
    pendenteVersao: entrada.pendente ? entrada.pendente.version : null,
    versaoServidor: entrada.remoto.version,
    mesasServidor: entrada.remoto.mesas.length,
    mesasLocais: entrada.local.mesas.length,
  });
  switch (decisao) {
    case 'ignorar':
      return { tipo: 'ignorar' };
    case 'oferecer-importacao':
      return { tipo: 'oferecer-importacao' };
    case 'conflito-pendente':
      return {
        tipo: 'conflito-pendente',
        mesas: entrada.remoto.mesas,
        zonas: entrada.remoto.zonas,
        version: entrada.remoto.version,
        pendenteTs: entrada.pendente ? entrada.pendente.ts : 0,
      };
    case 'retomar-pendente':
      return {
        tipo: 'retomar-pendente',
        mesas: entrada.local.mesas,
        zonas: entrada.local.zonas,
        version: entrada.remoto.version,
      };
    case 'aplicar':
      return {
        tipo: 'aplicar',
        mesas: entrada.remoto.mesas,
        zonas: entrada.remoto.zonas,
        version: entrada.remoto.version,
      };
  }
}

export interface PlantaPendente {
  mesas: Mesa[];
  zonas: Zona[];
  version: number;
  ts: number;
}

export const PREFIXO_PLANTA_PENDENTE = 'sf:planta-pendente:';

export function chavePlantaPendente(shortCode: string): string {
  return `${PREFIXO_PLANTA_PENDENTE}${shortCode}`;
}

export function parsePlantaPendente(raw: string | null): PlantaPendente | null {
  if (!raw) return null;
  let dados: unknown;
  try {
    dados = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!dados || typeof dados !== 'object') return null;
  const d = dados as Record<string, unknown>;
  if (!Array.isArray(d.mesas)) return null;
  return {
    mesas: parsePlanta(JSON.stringify(d.mesas)),
    zonas: Array.isArray(d.zonas)
      ? d.zonas.map(parseZona).filter((z): z is Zona => z !== null)
      : [],
    version:
      typeof d.version === 'number' && Number.isFinite(d.version)
        ? Math.max(0, Math.trunc(d.version))
        : 0,
    ts: typeof d.ts === 'number' && Number.isFinite(d.ts) ? Math.max(0, d.ts) : 0,
  };
}

export function descreverIdade(ts: number, agora: number = Date.now()): string {
  if (!Number.isFinite(ts) || ts <= 0) return '';
  const segundos = Math.max(0, Math.floor((agora - ts) / 1000));
  if (segundos < 60) return 'há instantes';
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `há ${dias} dia${dias === 1 ? '' : 's'}`;
}

export function pendentesOrfaos(chaves: string[], shortCodesValidos: string[]): string[] {
  const validos = new Set(shortCodesValidos);
  return chaves.filter(
    (chave) =>
      chave.startsWith(PREFIXO_PLANTA_PENDENTE) &&
      !validos.has(chave.slice(PREFIXO_PLANTA_PENDENTE.length)),
  );
}

// Uma chave de pendente só existe depois de uma gravação ter falhado (é removida
// em cada sucesso), por isso qualquer pendente de outro evento é trabalho por
// sincronizar. Derivar do armazenamento em vez de guardar em estado evita que o
// aviso se perca num reload ou num re-render.
export function pendentesDeOutrosEventos(
  chaves: string[],
  shortCodeAtual: string,
): string[] {
  const outros = new Set<string>();
  for (const chave of chaves) {
    if (!chave.startsWith(PREFIXO_PLANTA_PENDENTE)) continue;
    const shortCode = chave.slice(PREFIXO_PLANTA_PENDENTE.length);
    if (shortCode && shortCode !== shortCodeAtual) outros.add(shortCode);
  }
  return [...outros].sort();
}

export interface Zona {
  id: string;
  nome: string;
  cor: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Dimensoes {
  larguraM: number;
  alturaM: number;
}

export interface DocumentoPlanta {
  mesas: Mesa[];
  zonas: Zona[];
  dimensoes?: Dimensoes;
}

export const MIN_DIMENSAO_M = 1;
export const MAX_DIMENSAO_M = 200;
export const PX_POR_METRO_EXPORT = 100;
export const MAX_LADO_EXPORT_PX = 6000;

export function normalizarDimensoes(item: unknown): Dimensoes | null {
  if (!item || typeof item !== 'object') return null;
  const d = item as Record<string, unknown>;
  const larguraM = typeof d.larguraM === 'number' ? d.larguraM : NaN;
  const alturaM = typeof d.alturaM === 'number' ? d.alturaM : NaN;
  if (!Number.isFinite(larguraM) || !Number.isFinite(alturaM)) return null;
  const clamp = (v: number) =>
    Math.round(Math.min(MAX_DIMENSAO_M, Math.max(MIN_DIMENSAO_M, v)) * 10) / 10;
  return { larguraM: clamp(larguraM), alturaM: clamp(alturaM) };
}

export function proporcaoPlanta(dimensoes?: Dimensoes | null): number {
  if (!dimensoes) return 16 / 9;
  return dimensoes.larguraM / dimensoes.alturaM;
}

export interface DimensoesExport {
  larguraPx: number;
  alturaPx: number;
  pxPorMetro: number;
}

// Export a 100 px/m (impressão legível a 300 DPI); o lado maior fica limitado
// para o canvas não rebentar a memória em salões grandes.
export function dimensoesExport(dimensoes?: Dimensoes | null): DimensoesExport | null {
  if (!dimensoes) return null;
  const pxPorMetro = Math.min(
    PX_POR_METRO_EXPORT,
    MAX_LADO_EXPORT_PX / dimensoes.larguraM,
    MAX_LADO_EXPORT_PX / dimensoes.alturaM,
  );
  return {
    larguraPx: Math.max(1, Math.round(dimensoes.larguraM * pxPorMetro)),
    alturaPx: Math.max(1, Math.round(dimensoes.alturaM * pxPorMetro)),
    pxPorMetro: Math.round(pxPorMetro * 100) / 100,
  };
}

export function formatarMetros(metros: number): string {
  return `${metros.toFixed(1).replace('.', ',')} m`;
}

// O nome já costuma incluir o prefixo ("Mesa A", "Zona 1"): evita que os leitores
// de ecrã ouçam "Mesa Mesa A" / "Zona Zona 1". Exige o prefixo como palavra
// inteira, para não omitir o prefixo em "Mesalina".
export function rotuloAcessivel(prefixo: string, nome: string): string {
  const p = prefixo.trim().toLowerCase();
  const alvo = nome.trim();
  if (!alvo) return prefixo.trim();
  const minusculas = alvo.toLowerCase();
  return minusculas === p || minusculas.startsWith(`${p} `) ? alvo : `${prefixo} ${alvo}`;
}

export interface GrupoZona {
  zona: Zona | null;
  mesas: Mesa[];
}

export const MAX_ZONAS_PLANTA = 100;
export const ZONA_MIN = 5;
export const CORES_ZONA = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

export function corZona(indice: number): string {
  const i = Number.isFinite(indice) ? Math.abs(Math.trunc(indice)) : 0;
  return CORES_ZONA[i % CORES_ZONA.length];
}

export function normalizarDimensao(valor: number): number {
  if (!Number.isFinite(valor)) return ZONA_MIN;
  if (valor < ZONA_MIN) return ZONA_MIN;
  if (valor > 100) return 100;
  return Math.round(valor * 100) / 100;
}

export function novoIdZona(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') {
    try {
      return `zona-${c.randomUUID()}`;
    } catch {
      // cai no fallback abaixo
    }
  }
  return `zona-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizarZona(zona: Zona): Zona {
  const w = normalizarDimensao(zona.w);
  const h = normalizarDimensao(zona.h);
  return {
    ...zona,
    x: Math.min(normalizarPosicao(zona.x), 100 - w),
    y: Math.min(normalizarPosicao(zona.y), 100 - h),
    w,
    h,
  };
}

export function criarZona(
  nome: string,
  cor: string,
  x = 20,
  y = 20,
  w = 30,
  h = 30,
): Zona {
  return normalizarZona({ id: novoIdZona(), nome, cor, x, y, w, h });
}

export function adicionarZona(zonas: Zona[], zona: Zona): Zona[] {
  if (zonas.length >= MAX_ZONAS_PLANTA) return zonas;
  return [...zonas, zona];
}

export function removerZona(zonas: Zona[], id: string): Zona[] {
  return zonas.filter((zona) => zona.id !== id);
}

export function atualizarZona(
  zonas: Zona[],
  id: string,
  patch: Partial<Omit<Zona, 'id'>>,
): Zona[] {
  return zonas.map((zona) => (zona.id === id ? normalizarZona({ ...zona, ...patch, id: zona.id }) : zona));
}

export const LIMIAR_SOBREPOSICAO_ZONA = 0.2;

export interface ParSobreposicaoZona {
  a: string;
  b: string;
  fracao: number;
}

// A fracção é medida sobre a MENOR zona: encostar ligeiramente (abaixo de 20% da
// menor) não conta como erro, mas cobrir metade dela é quase sempre engano.
export function paresDeSobreposicao(
  zonas: Zona[],
  limiar = LIMIAR_SOBREPOSICAO_ZONA,
): ParSobreposicaoZona[] {
  const pares: ParSobreposicaoZona[] = [];
  for (let i = 0; i < zonas.length; i++) {
    for (let j = i + 1; j < zonas.length; j++) {
      const a = zonas[i];
      const b = zonas[j];
      const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (w <= 0 || h <= 0) continue;
      const menor = Math.min(a.w * a.h, b.w * b.h);
      if (menor <= 0) continue;
      const fracao = (w * h) / menor;
      if (fracao >= limiar) pares.push({ a: a.id, b: b.id, fracao });
    }
  }
  return pares;
}

export function moverZona(zonas: Zona[], id: string, x: number, y: number): Zona[] {
  return zonas.map((zona) => {
    if (zona.id !== id) return zona;
    return {
      ...zona,
      x: Math.min(normalizarPosicao(x), 100 - zona.w),
      y: Math.min(normalizarPosicao(y), 100 - zona.h),
    };
  });
}

export function redimensionarZona(zonas: Zona[], id: string, w: number, h: number): Zona[] {
  return zonas.map((zona) => {
    if (zona.id !== id) return zona;
    const nw = normalizarDimensao(w);
    const nh = normalizarDimensao(h);
    return {
      ...zona,
      w: nw,
      h: nh,
      x: Math.min(zona.x, 100 - nw),
      y: Math.min(zona.y, 100 - nh),
    };
  });
}

export function zonaContemPonto(zona: Zona, x: number, y: number): boolean {
  return x >= zona.x && x <= zona.x + zona.w && y >= zona.y && y <= zona.y + zona.h;
}

/**
 * Zona a que a mesa pertence: a primeira cujo rectângulo contém o centro da
 * mesa. Em sobreposição vale a ordem de criação (a primeira da lista).
 */
export function zonaPrincipal(mesa: Mesa, zonas: Zona[]): Zona | null {
  for (const zona of zonas) {
    if (zonaContemPonto(zona, mesa.x, mesa.y)) return zona;
  }
  return null;
}

export function agruparMesasPorZona(mesas: Mesa[], zonas: Zona[]): GrupoZona[] {
  const grupos: GrupoZona[] = zonas.map((zona) => ({ zona, mesas: [] }));
  const semZona: Mesa[] = [];
  for (const mesa of mesas) {
    const zona = zonaPrincipal(mesa, zonas);
    if (!zona) {
      semZona.push(mesa);
      continue;
    }
    const grupo = grupos.find((g) => g.zona?.id === zona.id);
    if (grupo) grupo.mesas.push(mesa);
    else semZona.push(mesa);
  }
  if (semZona.length > 0) grupos.push({ zona: null, mesas: semZona });
  return grupos;
}

export function parseZona(item: unknown): Zona | null {
  if (!item || typeof item !== 'object') return null;
  const z = item as Record<string, unknown>;
  if (typeof z.id !== 'string' || z.id.length === 0) return null;
  return normalizarZona({
    id: z.id,
    nome: typeof z.nome === 'string' ? z.nome : '',
    cor: typeof z.cor === 'string' && z.cor ? z.cor : corZona(0),
    x: typeof z.x === 'number' ? z.x : 0,
    y: typeof z.y === 'number' ? z.y : 0,
    w: typeof z.w === 'number' ? z.w : ZONA_MIN,
    h: typeof z.h === 'number' ? z.h : ZONA_MIN,
  });
}

export function parseDocumentoPlanta(raw: string | null): DocumentoPlanta {
  if (!raw) return { mesas: [], zonas: [] };
  let dados: unknown;
  try {
    dados = JSON.parse(raw);
  } catch {
    return { mesas: [], zonas: [] };
  }
  if (Array.isArray(dados)) {
    return { mesas: parsePlanta(JSON.stringify(dados)), zonas: [] };
  }
  if (!dados || typeof dados !== 'object') return { mesas: [], zonas: [] };
  const d = dados as Record<string, unknown>;
  const dimensoes = normalizarDimensoes(d.dimensoes);
  return {
    mesas: parsePlanta(JSON.stringify(Array.isArray(d.mesas) ? d.mesas : [])),
    zonas: (Array.isArray(d.zonas) ? d.zonas : [])
      .map(parseZona)
      .filter((z): z is Zona => z !== null),
    ...(dimensoes ? { dimensoes } : {}),
  };
}

function preencherNoRect(
  posicoes: Map<string, { x: number; y: number }>,
  mesas: Mesa[],
  rect: { x: number; y: number; w: number; h: number },
): void {
  const n = mesas.length;
  if (n === 0) return;
  const margem = Math.min(rect.w, rect.h) / 6;
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
  const rows = Math.max(1, Math.ceil(n / cols));
  const largura = Math.max(0, rect.w - margem * 2);
  const altura = Math.max(0, rect.h - margem * 2);
  mesas.forEach((mesa, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = cols === 1 ? rect.x + rect.w / 2 : rect.x + margem + (col * largura) / (cols - 1);
    const y = rows === 1 ? rect.y + rect.h / 2 : rect.y + margem + (row * altura) / (rows - 1);
    posicoes.set(mesa.id, { x: normalizarPosicao(x), y: normalizarPosicao(y) });
  });
}

/**
 * Auto-organiza as mesas: as que estão dentro de uma zona são distribuídas
 * dentro dessa zona; as restantes (sem zona) ficam numa faixa no topo.
 */
export function reorganizarMesasComZonas(mesas: Mesa[], zonas: Zona[]): Mesa[] {
  if (mesas.length === 0) return mesas;
  const posicoes = new Map<string, { x: number; y: number }>();
  const grupos = agruparMesasPorZona(mesas, zonas);
  for (const grupo of grupos) {
    if (!grupo.zona) continue;
    preencherNoRect(posicoes, grupo.mesas, grupo.zona);
  }
  const semZona = mesas.filter((mesa) => !zonaPrincipal(mesa, zonas));
  if (semZona.length > 0) {
    const rows = Math.max(1, Math.ceil(semZona.length / Math.ceil(Math.sqrt(semZona.length))));
    const altura = Math.min(40, rows * 8 + 4);
    preencherNoRect(posicoes, semZona, { x: 0, y: 0, w: 100, h: altura });
  }
  return mesas.map((mesa) => {
    const p = posicoes.get(mesa.id);
    return p ? { ...mesa, x: p.x, y: p.y } : mesa;
  });
}

export interface OpcoesSvgPlanta {
  largura?: number;
  altura?: number;
  fundo?: string;
  mostrarEscala?: boolean;
}

export function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Renderiza a planta como SVG standalone (para exportar a PNG no cliente).
 * As percentagens 0-100 são o viewBox; quando o documento tem dimensões reais,
 * a altura do viewBox acompanha a proporção (para o desenho não ficar esticado)
 * e é desenhada uma barra de escala.
 */
export function renderSvgPlanta(doc: DocumentoPlanta, opcoes: OpcoesSvgPlanta = {}): string {
  const largura = opcoes.largura ?? 800;
  const altura = opcoes.altura ?? 800;
  const fundo = opcoes.fundo ?? '#0b0b0f';
  const dimensoes = doc.dimensoes ?? null;
  const f = dimensoes ? dimensoes.alturaM / dimensoes.larguraM : 1;
  const h = 100 * f;
  const raio = 4;
  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 100 ${h}" preserveAspectRatio="xMidYMid meet">`,
  );
  out.push(`<rect x="0" y="0" width="100" height="${h}" fill="${escaparXml(fundo)}"/>`);
  for (let i = 10; i < 100; i += 10) {
    out.push(
      `<line x1="${i}" y1="0" x2="${i}" y2="${h}" stroke="#27272a" stroke-width="0.2"/>`,
      `<line x1="0" y1="${(i / 100) * h}" x2="100" y2="${(i / 100) * h}" stroke="#27272a" stroke-width="0.2"/>`,
    );
  }
  for (const zona of doc.zonas) {
    const cor = escaparXml(zona.cor);
    out.push(
      `<rect x="${zona.x}" y="${(zona.y / 100) * h}" width="${zona.w}" height="${(zona.h / 100) * h}" rx="1.5" fill="${cor}" fill-opacity="0.16" stroke="${cor}" stroke-width="0.6"/>`,
    );
    if (zona.nome) {
      out.push(
        `<text x="${zona.x + 1.5}" y="${(zona.y / 100) * h + 3.5}" font-family="sans-serif" font-size="3" fill="${cor}">${escaparXml(zona.nome)}</text>`,
      );
    }
  }
  for (const mesa of doc.mesas) {
    const cy = (mesa.y / 100) * h;
    const forma =
      mesa.forma === 'quadrada'
        ? `<rect x="${mesa.x - raio}" y="${cy - raio * 0.85}" width="${raio * 2}" height="${raio * 1.7}" rx="0.8" fill="#52525b" stroke="#a1a1aa" stroke-width="0.4"/>`
        : `<circle cx="${mesa.x}" cy="${cy}" r="${raio}" fill="#52525b" stroke="#a1a1aa" stroke-width="0.4"/>`;
    // A rotação aplica-se só à forma: o rótulo fica sempre direito.
    const rotacao = normalizarRotacao(mesa.rotacao);
    out.push(rotacao ? `<g transform="rotate(${rotacao} ${mesa.x} ${cy})">${forma}</g>` : forma);
    out.push(
      `<text x="${mesa.x}" y="${cy + 1}" font-family="sans-serif" font-size="3" text-anchor="middle" fill="#fafafa">${escaparXml(mesa.nome)}</text>`,
    );
  }
  if (dimensoes && opcoes.mostrarEscala !== false) {
    const barra = 25;
    const x0 = 2;
    const y0 = h - 5;
    out.push(
      `<line x1="${x0}" y1="${y0}" x2="${x0 + barra}" y2="${y0}" stroke="#a1a1aa" stroke-width="0.6"/>`,
      `<line x1="${x0}" y1="${y0 - 1.2}" x2="${x0}" y2="${y0 + 1.2}" stroke="#a1a1aa" stroke-width="0.6"/>`,
      `<line x1="${x0 + barra}" y1="${y0 - 1.2}" x2="${x0 + barra}" y2="${y0 + 1.2}" stroke="#a1a1aa" stroke-width="0.6"/>`,
      `<text x="${x0 + barra / 2}" y="${y0 - 1.8}" font-family="sans-serif" font-size="3" text-anchor="middle" fill="#a1a1aa">${formatarMetros(dimensoes.larguraM / 4)}</text>`,
      `<text x="98" y="${y0 - 1.8}" font-family="sans-serif" font-size="3" text-anchor="end" fill="#a1a1aa">${formatarMetros(dimensoes.larguraM)} × ${formatarMetros(dimensoes.alturaM)}</text>`,
    );
  }
  out.push('</svg>');
  return out.join('');
}
