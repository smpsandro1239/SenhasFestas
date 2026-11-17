import { describe, it, expect, vi } from 'vitest';
import { hostConfiavel, SecurityMiddleware } from './security.middleware';

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

describe('SecurityMiddleware — CSRF para sessões cookie', () => {
  function criarRequest(origin?: string) {
    return {
      method: 'POST',
      protocol: 'https',
      headers: { cookie: 'sf_token=abc', origin },
      get: (name: string) => name === 'x-forwarded-proto' ? 'https' : undefined,
    } as any;
  }

  function criarResponse() {
    const response: any = {
      setHeader: () => response,
      statusCode: 200,
      status: (statusCode: number) => {
        response.statusCode = statusCode;
        return response;
      },
      json: (body: unknown) => {
        response.body = body;
        return response;
      },
    };
    return response;
  }

  it('rejeita mutações autenticadas por cookie sem Origin', () => {
    const middleware = new SecurityMiddleware();
    const req = criarRequest();
    const res = criarResponse();
    const next = vi.fn();

    middleware.use(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual(expect.objectContaining({ message: expect.stringContaining('Origem obrigatória') }));
    expect(next).not.toHaveBeenCalled();
  });

  it('aceita mutações autenticadas por cookie com origem explicitamente permitida', () => {
    const anterior = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = 'https://app.example.com';
    try {
      const middleware = new SecurityMiddleware();
      const req = criarRequest('https://app.example.com');
      const res = criarResponse();
      const next = vi.fn();

      middleware.use(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res.statusCode).toBe(200);
    } finally {
      if (anterior === undefined) delete process.env.FRONTEND_URL;
      else process.env.FRONTEND_URL = anterior;
    }
  });
});
