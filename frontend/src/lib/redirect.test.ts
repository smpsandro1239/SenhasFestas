import { describe, it, expect } from 'vitest';
import { isValidRedirectUrl } from './redirect';

describe('isValidRedirectUrl (Open Redirect prevention)', () => {
  it('aceita rotas relativas válidas', () => {
    expect(isValidRedirectUrl('/')).toBe(true);
    expect(isValidRedirectUrl('/pedidos')).toBe(true);
    expect(isValidRedirectUrl('/entrar/magusto-2026?table=12')).toBe(true);
    expect(isValidRedirectUrl('/admin')).toBe(true);
  });

  it('rejeita valores nulos, indefinidos ou vazios', () => {
    expect(isValidRedirectUrl(null)).toBe(false);
    expect(isValidRedirectUrl(undefined)).toBe(false);
    expect(isValidRedirectUrl('')).toBe(false);
  });

  it('rejeita URLs absolutos com esquema ou protocolo', () => {
    expect(isValidRedirectUrl('http://evil.com')).toBe(false);
    expect(isValidRedirectUrl('https://evil.com/pedidos')).toBe(false);
    expect(isValidRedirectUrl('javascript:alert(1)')).toBe(false);
    expect(isValidRedirectUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('rejeita bypasses de protocolo relativo (//evil.com ou /\\evil.com)', () => {
    expect(isValidRedirectUrl('//evil.com')).toBe(false);
    expect(isValidRedirectUrl('//evil.com/pedidos')).toBe(false);
    expect(isValidRedirectUrl('/\\evil.com')).toBe(false);
    expect(isValidRedirectUrl('/\\\\evil.com')).toBe(false);
  });

  it('rejeita caminhos com caracteres de controlo', () => {
    expect(isValidRedirectUrl('/pedidos\r\nHost: evil.com')).toBe(false);
    expect(isValidRedirectUrl('/pedidos\0')).toBe(false);
  });
});
