import { describe, it, expect, vi } from 'vitest';
import { hostConfiavel, SecurityMiddleware } from './security.middleware';

describe('SecurityMiddleware', () => {
  it('configura os cabeçalhos de segurança HTTP em cada resposta', () => {
    const middleware = new SecurityMiddleware();
    const headers: Record<string, string> = {};
    const res = {
      setHeader: vi.fn((key: string, value: string) => {
        headers[key] = value;
      }),
    } as any;
    const req = { method: 'GET', headers: {} } as any;
    const next = vi.fn();

    middleware.use(req, res, next);

    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['X-XSS-Protection']).toBe('1; mode=block');
    expect(headers['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['X-Permitted-Cross-Domain-Policies']).toBe('none');
    expect(next).toHaveBeenCalled();
  });
});

describe('hostConfiavel (A6: open redirect via Host header)', () => {
  const confiaveis = new Set([
    'https://senhas-festas.vercel.app',
    'http://localhost:3001',
  ]);

  it('recusa um Host arbitrário (evil.com)', () => {
    expect(hostConfiavel('evil.com', confiaveis)).toBe(false);
  });

  it('recusa Host com domínio semelhante (senhas-festas.vercel.app.evil.com)', () => {
    expect(hostConfiavel('senhas-festas.vercel.app.evil.com', confiaveis)).toBe(false);
  });

  it('aceita o FRONTEND_URL confiável', () => {
    expect(hostConfiavel('senhas-festas.vercel.app', confiaveis)).toBe(true);
  });

  it('aceita localhost para desenvolvimento', () => {
    expect(hostConfiavel('localhost:3001', confiaveis)).toBe(true);
  });

  it('aceita previews *.vercel.app (fluxo de desenvolvimento não parte)', () => {
    expect(hostConfiavel('senhasfestas-api-abc123-user.vercel.app', confiaveis)).toBe(true);
  });

  it('recusa host em falta', () => {
    expect(hostConfiavel('', confiaveis)).toBe(false);
    expect(hostConfiavel(undefined as unknown as string, confiaveis)).toBe(false);
  });
});