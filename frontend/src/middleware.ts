import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PATHS = ['/auth', '/publico', '/api'];

const ROLE_GATES: Record<string, string[]> = {
  '/admin': ['superadmin', 'organizer'],
  '/relatorios': ['superadmin', 'organizer', 'cashier', 'treasurer'],
  '/caixa': ['superadmin', 'organizer', 'cashier', 'treasurer'],
  '/cozinha': ['superadmin', 'organizer', 'kitchen', 'bar'],
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

async function verifySessionToken(
  token: string,
): Promise<{ ok: boolean; role?: string; expired?: boolean }> {
  const secretEnv = process.env.JWT_SECRET;
  if (!secretEnv) {
    return { ok: false, expired: true };
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
    if (payload.expired) {
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
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|css|js|txt|xml|woff2?|map|json|webmanifest)$).*)',
  ],
};