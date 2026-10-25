import { describe, it, expect } from 'vitest';
import { isSafeRedirectUrl } from './redirect-url';

describe('isSafeRedirectUrl (Open Redirect Prevention)', () => {
  it('accepts valid relative path', () => {
    expect(isSafeRedirectUrl('/caixa')).toBe(true);
    expect(isSafeRedirectUrl('/pedidos?id=123')).toBe(true);
    expect(isSafeRedirectUrl('/admin/config')).toBe(true);
  });

  it('rejects null, undefined or empty strings', () => {
    expect(isSafeRedirectUrl(null)).toBe(false);
    expect(isSafeRedirectUrl(undefined)).toBe(false);
    expect(isSafeRedirectUrl('')).toBe(false);
  });

  it('rejects protocol-relative URLs (//evil.com)', () => {
    expect(isSafeRedirectUrl('//evil.com')).toBe(false);
    expect(isSafeRedirectUrl('//evil.com/path')).toBe(false);
  });

  it('rejects absolute URLs with protocol (https://evil.com)', () => {
    expect(isSafeRedirectUrl('https://evil.com')).toBe(false);
    expect(isSafeRedirectUrl('http://evil.com')).toBe(false);
    expect(isSafeRedirectUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects backslash evasion attempts (/\\evil.com)', () => {
    expect(isSafeRedirectUrl('/\\evil.com')).toBe(false);
    expect(isSafeRedirectUrl('/path\\with\\backslash')).toBe(false);
  });
});
