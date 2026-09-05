import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/auth', '/publico', '/api'];

const ROLE_GATES: Record<string, string[]> = {
  '/admin': ['superadmin', 'organizer'],
  '/relatorios': ['superadmin', 'organizer', 'cashier', 'treasurer'],
  '/caixa': ['superadmin', 'organizer', 'cashier', 'treasurer'],
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get('sf_token')?.value;
  const role = request.cookies.get('sf_role')?.value;

  if (!token) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const gate = matchesGate(pathname);
  if (gate && !ROLE_GATES[gate].includes(role ?? '')) {
    return NextResponse.redirect(new URL('/pedidos', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico|css|js|txt|xml|woff2?|map|json)$).*)',
  ],
};