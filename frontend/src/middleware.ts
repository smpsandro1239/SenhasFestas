import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PATHS = ['/auth', '/publico', '/api', '/entrar', '/mesa'];

const ROLE_GATES: Record<string, string[]> = {
  '/admin': ['superadmin', 'organizer'],
  '/relatorios': ['superadmin', 'organizer', 'cashier', 'treasurer'],
  '/caixa': ['superadmin', 'organizer', 'cashier', 'treasurer'],
  '/cozinha': ['superadmin', 'organizer', 'kitchen', 'bar'],
  '/pos': ['superadmin', 'organizer', 'cashier', 'treasurer'],
};

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
}

function matchesGate(pathname: string): string | null {
  for (const [prefix, roles] of Object.entries(ROLE_GATES)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      return roles.length ? prefix : null;
    }
  }
  return null;
}

function criarPoliticaCsp(request: NextRequest): { headers: Headers; policy: string } {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = btoa(String.fromCharCode(...bytes));
  const originOf = (value: string | undefined): string => {
    if (!value) return '';
    try {
      return new URL(value).origin;
    } catch {
      return '';
    }
  };
  const apiOrigin = originOf(process.env.NEXT_PUBLIC_API_URL);
  const wsOrigin = originOf(process.env.NEXT_PUBLIC_WS_URL);
  const connectSrc = ["'self'", apiOrigin, wsOrigin].filter(Boolean).join(' ');
  const scriptSrc =
    process.env.NODE_ENV === 'production'
      ? `'self' 'nonce-${nonce}'`
      : `'self' 'nonce-${nonce}' 'unsafe-eval'`;
  const policy = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSrc}`,
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "worker-src 'self' blob:",
  ].join('; ');

  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', policy);
  return { headers, policy };
}

function respostaComCsp(response: NextResponse, policy: string): NextResponse {
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

type VerifyResult = { ok: boolean; role?: string; expired?: boolean; configError?: boolean };

async function verifySessionToken(token: string): Promise<VerifyResult> {
  const secretEnv = process.env.JWT_SECRET;
  if (!secretEnv) {
    // Erro de configuração, não uma sessão expirada: não houve verificação
    // nenhuma. Distinguir isto de 'expired' evita fail-open (ver middleware).
    return { ok: false, configError: true };
  }
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secretEnv), {
      issuer: 'senhasfestas-api',
      audience: 'senhasfestas-app',
    });
    return { ok: true, role: payload.role as string | undefined };
  } catch (erro) {
    return { ok: false, expired: (erro as Error & { code?: string })?.code === 'ERR_JWT_EXPIRED' };
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { headers: requestHeaders, policy } = criarPoliticaCsp(request);
  const seguir = () => respostaComCsp(NextResponse.next({ request: { headers: requestHeaders } }), policy);
  const redirecionar = (url: URL) => respostaComCsp(NextResponse.redirect(url), policy);

  if (isPublic(pathname)) {
    return seguir();
  }

  const token = request.cookies.get('sf_token')?.value;

  if (!token) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return redirecionar(loginUrl);
  }

  const payload = await verifySessionToken(token);
  if (!payload.ok) {
    if (payload.configError) {
      // Fail-closed: sem segredo não há verificação possível, logo não há
      // autorização. Deixar passar tornaria o aviso invisível (a API continua
      // a proteger os dados, mas o utilizador vê páginas que parecem abertas).
      console.error('[middleware] JWT_SECRET ausente — a bloquear rotas protegidas');
      const erroUrl = new URL('/auth/login', request.url);
      erroUrl.searchParams.set('error', 'config');
      erroUrl.searchParams.set('from', pathname);
      return redirecionar(erroUrl);
    }
    if (payload.expired) {
      // Load-bearing: api.ts faz refresh silencioso do token. Só depois de
      // falhar o refresh é que o cliente manda para o login.
      return seguir();
    }
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return redirecionar(loginUrl);
  }

  const gate = matchesGate(pathname);
  if (gate && !ROLE_GATES[gate].includes(payload.role ?? '')) {
    return redirecionar(new URL('/pedidos', request.url));
  }

  return seguir();
}

export const config = {
  matcher: [
    // Páginas públicas também passam pelo middleware para receber CSP nonce.
    // Só API e assets estáticos são excluídos; as páginas de autenticação,
    // público e QR continuam sem exigir sessão via isPublic().
    '/((?!_next/static|_next/image|favicon.ico|api(?:/|$)|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|css|js|txt|xml|woff2?|map|json|webmanifest)$).*)',
  ],
};