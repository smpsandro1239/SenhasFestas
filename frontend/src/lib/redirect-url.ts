export function isSafeRedirectUrl(from: string | null | undefined): boolean {
  if (!from) return false;
  // Security concern: prevent Open Redirect vulnerabilities.
  // Relative paths must start with a single slash '/' and not '//' (protocol-relative URLs)
  // or containing backslashes '\\' (which browsers convert to '/' leading to open redirects in some contexts).
  return from.startsWith('/') && !from.startsWith('//') && !from.includes('\\');
}
