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

let contadorMesa = 0;

export function novoIdMesa(): string {
  contadorMesa += 1;
  return `mesa-${Date.now().toString(36)}-${contadorMesa}`;
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

export interface QrsDaPlanta {
  nomes: string[];
  lugares: Record<string, number>;
}

export function mesasParaQrs(mesas: Mesa[]): QrsDaPlanta {
  const nomes: string[] = [];
  const lugares: Record<string, number> = {};
  for (const mesa of mesas) {
    const nome = mesa.nome.trim();
    if (!nome || lugares[nome] !== undefined) continue;
    nomes.push(nome);
    lugares[nome] = mesa.lugares;
  }
  return { nomes, lugares };
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
