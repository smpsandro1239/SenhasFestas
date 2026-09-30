import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';
import { middleware } from './middleware';

const SECRET = 'segredo-de-teste-com-tamanho-suficiente-1234567890';
const ORIGEM = 'https://app.example';

const ORIGINAL_SECRET = process.env.JWT_SECRET;

function pedido(pathname: string, token?: string): NextRequest {
  const headers = new Headers();
  if (token) headers.set('cookie', `sf_token=${token}`);
  return new NextRequest(new URL(pathname, ORIGEM), { headers });
}

async function assinar(role: string, expiracao: string | number = '15m'): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user-1')
    .setIssuer('senhasfestas-api')
    .setAudience('senhasfestas-app')
    .setIssuedAt()
    .setExpirationTime(expiracao)
    .sign(new TextEncoder().encode(SECRET));
}

function eRedirect(resposta: Response): boolean {
  return resposta.headers.get('location') !== null;
}

function destino(resposta: Response): string {
  return resposta.headers.get('location') ?? '';
}

function deixaPassar(resposta: Response): boolean {
  return resposta.headers.get('x-middleware-next') === '1';
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  if (ORIGINAL_SECRET === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = ORIGINAL_SECRET;
});

describe('middleware — JWT_SECRET ausente (erro de configuração)', () => {
  beforeEach(() => {
    delete process.env.JWT_SECRET;
  });

  it('bloqueia rota protegida em vez de a deixar passar', async () => {
    const token = await assinar('superadmin');
    const resposta = await middleware(pedido('/admin', token));

    expect(deixaPassar(resposta)).toBe(false);
    expect(eRedirect(resposta)).toBe(true);
    expect(destino(resposta)).toContain('/auth/login');
  });

  it('bloqueia mesmo sem cookie, sem cair em next()', async () => {
    const resposta = await middleware(pedido('/caixa'));

    expect(deixaPassar(resposta)).toBe(false);
    expect(eRedirect(resposta)).toBe(true);
  });

  it('marca o redireccionamento como erro de configuração', async () => {
    const token = await assinar('superadmin');
    const resposta = await middleware(pedido('/admin', token));

    expect(destino(resposta)).toContain('error=config');
  });

  it('regista o motivo em log — o silêncio é o que torna o bug invisível', async () => {
    const token = await assinar('superadmin');
    await middleware(pedido('/admin', token));

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('JWT_SECRET'),
    );
  });

  it('não deixa passar rota protegida com roleGate (caixa, cozinha, admin)', async () => {
    for (const rota of ['/caixa', '/cozinha', '/admin', '/relatorios', '/pos']) {
      const token = await assinar('superadmin');
      const resposta = await middleware(pedido(rota, token));
      expect(deixaPassar(resposta), `rota ${rota} passou sem segredo`).toBe(false);
    }
  });

  it('mantém as rotas públicas acessíveis sem segredo', async () => {
    for (const rota of ['/auth/login', '/publico', '/publico/abc', '/api/health']) {
      const resposta = await middleware(pedido(rota));
      expect(deixaPassar(resposta), `rota pública ${rota} foi bloqueada`).toBe(true);
    }
  });

  it('não expande a lista de públicas — qr-order e offline continuam protegidos', async () => {
    for (const rota of ['/qr-order', '/offline']) {
      const resposta = await middleware(pedido(rota));
      expect(eRedirect(resposta), `rota ${rota} ficou pública`).toBe(true);
    }
  });
});

describe('middleware — com JWT_SECRET configurado (comportamento actual)', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = SECRET;
  });

  it('deixa passar token válido com role correcta', async () => {
    const resposta = await middleware(pedido('/admin', await assinar('superadmin')));
    expect(deixaPassar(resposta)).toBe(true);
  });

  it('expulsa role errada para /pedidos', async () => {
    const resposta = await middleware(pedido('/admin', await assinar('kitchen')));
    expect(destino(resposta)).toContain('/pedidos');
  });

  it('deixa passar token expirado — o refresh silencioso em api.ts depende disto', async () => {
    const resposta = await middleware(pedido('/caixa', await assinar('cashier', '-1s')));
    expect(deixaPassar(resposta)).toBe(true);
  });

  it('redirecciona token com assinatura inválida para login, sem error=config', async () => {
    const falso = await new SignJWT({ role: 'superadmin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuer('senhasfestas-api')
      .setAudience('senhasfestas-app')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode('outro-segredo-com-o-mesmo-comprimento-x'));

    const resposta = await middleware(pedido('/caixa', falso));

    expect(eRedirect(resposta)).toBe(true);
    expect(destino(resposta)).not.toContain('error=config');
  });

  it('não regista erro de configuração quando o segredo existe', async () => {
    const resposta = await middleware(pedido('/caixa', await assinar('cashier')));
    expect(console.error).not.toHaveBeenCalled();
  });
});