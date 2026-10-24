import { describe, it, expect, vi } from 'vitest';
import { hostConfiavel, SecurityMiddleware } from './security.middleware';

describe('SecurityMiddleware', () => {
  it('define cabeçalhos de segurança em todas as respostas', () => {
    const middleware = new SecurityMiddleware();
    const headers: Record<string, string> = {};
    const req = { method: 'GET', headers: {} } as any;
    const res = {
      setHeader: (name: string, value: string) => {
        headers[name] = value;
      },
    } as any;
    const next = vi.fn();

    middleware.use(req, res, next);

    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['X-XSS-Protection']).toBe('1; mode=block');
    expect(headers['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['X-Permitted-Cross-Domain-Policies']).toBe('none');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('bloqueia pedidos POST com cookie de origem não permitida', () => {
    const middleware = new SecurityMiddleware();
    let statusSet = 0;
    let jsonResponse: any = null;

    const req = {
      method: 'POST',
      headers: { cookie: 'sf_token=abc', origin: 'http://evil.com' },
      protocol: 'http',
      get: (header: string) => {
        if (header === 'x-forwarded-proto') return undefined;
        if (header === 'x-forwarded-host') return undefined;
        return 'localhost:3000';
      },
    } as any;

    const res = {
      setHeader: vi.fn(),
      status: (code: number) => {
        statusSet = code;
        return res;
      },
      json: (data: any) => {
        jsonResponse = data;
      },
    } as any;

    const next = vi.fn();

    middleware.use(req, res, next);

    expect(statusSet).toBe(403);
    expect(jsonResponse).toEqual({ statusCode: 403, message: 'Origem não permitida' });
    expect(next).not.toHaveBeenCalled();
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