// Mitigação de aritmética decimal. Cada input é normalizado para cêntimos
// inteiros no momento da entrada (arredondamento half-up na 3.ª casa decimal)
// e as operações decorrem nesse domínio — elimina a acumulação de erro de
// ponto flutuante. Fix definitivo: colunas inteiras em cêntimos (ou Decimal.js).

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

export const centavos = (value: number): number => centimosDe(value) / 100;

export const soma = (a: number, b: number): number => (centimosDe(a) + centimosDe(b)) / 100;

export const subtrai = (a: number, b: number): number => (centimosDe(a) - centimosDe(b)) / 100;