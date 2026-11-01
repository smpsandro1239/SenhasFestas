// Convenção OWASP CSV Injection: prefixar com apóstrofo células que começam
// por caracteres que o Excel/Google Sheets/Calc interpretam como fórmula ou comando
// (=, +, -, @, tab, CR, pipe, percentual), incluindo eventuais espaços iniciais
// que as aplicações de folha de cálculo ignoram antes de avaliar a fórmula.
export function sanitizarCelulaCsv(valor: unknown): string {
  const s = String(valor ?? '');
  if (/^\s*[=+\-@\t\r|%]/.test(s)) {
    return `'${s}`;
  }
  return s;
}