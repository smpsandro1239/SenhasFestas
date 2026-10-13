export const MAX_MESAS_LOTE = 500;

export function numerosDeIntervalo(
  inicio: number,
  fim: number,
  max = MAX_MESAS_LOTE,
): string[] {
  if (!Number.isFinite(inicio) || !Number.isFinite(fim)) return [];
  const a = Math.min(inicio, fim);
  const b = Math.max(inicio, fim);
  if (b - a + 1 > max) return [];
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
