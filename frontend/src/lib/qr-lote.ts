export const MAX_MESAS_LOTE = 500;
export const MAX_LUGARES_MESA = 99;

export function numerosDeIntervalo(
  inicio: number,
  fim: number,
  max = MAX_MESAS_LOTE,
): string[] {
  if (!Number.isFinite(inicio) || !Number.isFinite(fim)) return [];
  const a = Math.min(Math.trunc(inicio), Math.trunc(fim));
  const b = Math.max(Math.trunc(inicio), Math.trunc(fim));
  if (a < 1 || b - a + 1 > max) return [];
  const lista: string[] = [];
  for (let i = a; i <= b; i++) lista.push(String(i));
  return lista;
}

export function agruparFolhas<T>(itens: T[], porFolha: number): T[][] {
  if (itens.length === 0) return [];
  const n = porFolha > 0 ? Math.floor(porFolha) : 1;
  const folhas: T[][] = [];
  for (let i = 0; i < itens.length; i += n) {
    folhas.push(itens.slice(i, i + n));
  }
  return folhas;
}

export interface GrupoZonaQr {
  titulo: string;
  mesas: string[];
}

export interface FolhaQr {
  titulo: string | null;
  mesas: string[];
}

/**
 * Uma folha por zona. Uma zona com mais mesas do que cabem numa folha continua
 * nas folhas seguintes, repetindo o título; zonas sem mesas não geram folha.
 */
export function agruparFolhasPorZona(
  grupos: GrupoZonaQr[],
  porFolha: number,
): FolhaQr[] {
  return grupos.flatMap((grupo) =>
    agruparFolhas(grupo.mesas, porFolha).map((mesas) => ({
      titulo: grupo.titulo,
      mesas,
    })),
  );
}

export function normalizarLugares(valor: number, max = MAX_LUGARES_MESA): number {
  if (!Number.isFinite(valor)) return 0;
  const n = Math.trunc(valor);
  if (n < 0) return 0;
  if (n > max) return max;
  return n;
}

export function aplicarLugaresTodas(
  mesas: string[],
  valor: number,
  max = MAX_LUGARES_MESA,
): Record<string, number> {
  const v = normalizarLugares(valor, max);
  const mapa: Record<string, number> = {};
  for (const mesa of mesas) mapa[mesa] = v;
  return mapa;
}

export function totalLugares(mesas: string[], lugares: Record<string, number>): number {
  let total = 0;
  for (const mesa of mesas) total += normalizarLugares(lugares[mesa] ?? 0);
  return total;
}
