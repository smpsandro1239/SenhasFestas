// Mitigação de aritmética decimal em ponto flutuante.
//
// Convenção: os valores Monetários vivem em MAJOR UNITS (euros) — no input, no
// output e nas colunas da base de dados. Cêntimos inteiros existem apenas
// dentro da aritmética, nunca como formato de saída.
//
// Cada valor é convertido para cêntimos inteiros antes de operar e reconvertido
// à saída, o que elimina o erro de acumulação de float: `soma(0.1, 0.2)`
// devolve 0.3, não 0.30000000000000004. A conversão é half-up na terceira casa
// decimal (milesimos), não na segunda — 10.005 → 10.01, 1.004 → 1.00 — e é
// idempotente, por isso aninhar `centavos(centavos(x))` é seguro.
//
// Isto NÃO corrige o armazenamento: a base de dados guarda floats. O que
// remove de vez a propagação de erro são colunas inteiras em cêntimos ou
// Decimal.js, e está por fazer.

/** Converte para cêntimos inteiros. Interno — nunca usar directamente. */
function centimosDe(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Valor monetário inválido: ${value}`);
  }
  const sinal = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const milesimos = Math.round(abs * 1000);
  const centimos = Math.floor(milesimos / 10) + (milesimos % 10 >= 5 ? 1 : 0);
  return sinal * centimos;
}

/** Normaliza para 2 casas decimais. Entrada e saída em euros. */
export const centavos = (value: number): number => centimosDe(value) / 100;

/** Soma em euros, sem erro de float. */
export const soma = (a: number, b: number): number => (centimosDe(a) + centimosDe(b)) / 100;

/** Subtrai em euros, sem erro de float. */
export const subtrai = (a: number, b: number): number => (centimosDe(a) - centimosDe(b)) / 100;