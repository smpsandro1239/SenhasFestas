import { describe, it, expect, vi } from 'vitest';
import { hostConfiavel, SecurityMiddleware } from './security.middleware';
import { Request, Response } from 'express';

describe('SecurityMiddleware', () => {
  it('define cabeçalhos de segurança HTTP na resposta', () => {
    const middleware = new SecurityMiddleware();
    const setHeader = vi.fn();
    const req = { method: 'GET', headers: {} } as unknown as Request;
    const res = { setHeader } as unknown as Response;
    const next = vi.fn();

    middleware.use(req, res, next);

    expect(setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(setHeader).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
    expect(setHeader).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
    expect(setHeader).toHaveBeenCalledWith('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    expect(setHeader).toHaveBeenCalledWith('Referrer-Policy', 'strict-origin-when-cross-origin');
    expect(setHeader).toHaveBeenCalledWith('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
    expect(setHeader).toHaveBeenCalledWith('Cross-Origin-Resource-Policy', 'same-site');
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