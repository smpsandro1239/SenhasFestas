export type FormaMesa = 'redonda' | 'quadrada';

export interface Mesa {
  id: string;
  nome: string;
  lugares: number;
  x: number;
  y: number;
  forma: FormaMesa;
}

export const MAX_MESAS_PLANTA = 200;
export const GRID_PLANTA = 5;

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
): Mesa {
  return {
    id: novoIdMesa(),
    nome,
    lugares,
    x: normalizarPosicao(x),
    y: normalizarPosicao(y),
    forma,
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
    });
  }
  return mesas;
}

export type ResultadoPlantaRemota = 'aplicar' | 'ignorar' | 'oferecer-importacao';

export function decidirPlantaRemota(entrada: {
  editadoDesdeCarga: boolean;
  versaoServidor: number;
  mesasServidor: number;
  mesasLocais: number;
}): ResultadoPlantaRemota {
  if (entrada.editadoDesdeCarga) return 'ignorar';
  if (entrada.versaoServidor === 0 && entrada.mesasServidor === 0 && entrada.mesasLocais > 0) {
    return 'oferecer-importacao';
  }
  return 'aplicar';
}
