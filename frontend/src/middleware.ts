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

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get('sf_token')?.value;

  if (!token) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
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
      return NextResponse.redirect(erroUrl);
    }
    if (payload.expired) {
      // Load-bearing: api.ts faz refresh silencioso do token. Só depois de
      // falhar o refresh é que o cliente manda para o login.
      return NextResponse.next();
    }
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const gate = matchesGate(pathname);
  if (gate && !ROLE_GATES[gate].includes(payload.role ?? '')) {
    return NextResponse.redirect(new URL('/pedidos', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // `/auth`, `/publico`, `/api`, `/entrar` e `/mesa` não precisam do
    // middleware: são públicas por definição (ver PUBLIC_PATHS). Excluí-las
    // aqui evita instanciar o `jose` e percorrer o middleware em cada pedido
    // de quem só está a ver o ecrã público — a rota de maior tráfego, num
    // evento cheio de clientes. O QR da mesa (rota turbilhão de tráfego na
    // entrada dos eventos) fica acessível a quem não tem sessão.
    '/((?!_next/static|_next/image|favicon.ico|auth(?:/|$)|publico(?:/|$)|api(?:/|$)|entrar(?:/|$)|mesa(?:/|$)|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|css|js|txt|xml|woff2?|map|json|webmanifest)$).*)',
  ],
};