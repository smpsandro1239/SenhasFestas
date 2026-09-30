// Convenção OWASP: prefixar com apóstrofo células que começam por caracteres
// que o Excel/Google Sheets interpreta como fórmula (=, +, -, @, tab, CR).
export function sanitizarCelulaCsv(valor: unknown): string {
  const s = String(valor ?? '');
  if (/^[=+\-@\t\r]/.test(s)) {
    return `'${s}`;
  }
  return s;
}