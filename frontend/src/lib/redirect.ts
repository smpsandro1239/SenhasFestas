/**
 * Valida se um URL de redirecionamento post-login é seguro (relativo e interno).
 * Previne vulnerabilidades de Open Redirect (ex.: //evil.com, /\evil.com, javascript:).
 */
export function isValidRedirectUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  // Deve começar com '/' mas NÃO por '//' nem '/\'
  if (url !== '/' && !/^\/[^\/\\]/.test(url)) {
    return false;
  }
  // Não deve conter caracteres de controlo
  if (/[\x00-\x1F\x7F]/.test(url)) {
    return false;
  }
  return true;
}
