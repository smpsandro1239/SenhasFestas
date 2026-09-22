import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import crypto from 'node:crypto';

// Suite do contrato de sessão contra produção (E2E_BASE_URL).
// O cenário "token expirado + F5 -> renovação silenciosa" precisa de
// process.env.JWT_SECRET (a mesma chave que assina os tokens de produção)
// para forjar um access token com exp no passado. Sem ela o teste é saltado.
// Credenciais de teste de produção — serão rotacionadas quando as passwords
// de produção forem resetadas; até lá: ADMIN_EMAIL/ADMIN_PASSWORD/CLIENT_EMAIL/CLIENT_PASSWORD
// podem ser sobrescritas por env.

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'admin@senhasfestas.com';
const ADMIN_PASS = process.env.E2E_ADMIN_PASSWORD || 'admin123';
const CLIENT_EMAIL = process.env.E2E_CLIENT_EMAIL || 'client@senhasfestas.com';
const CLIENT_PASS = process.env.E2E_CLIENT_PASSWORD || 'client123';

const BASE = process.env.E2E_BASE_URL || 'https://senhas-festas-ten.vercel.app';

async function loginComo(page: Page, email: string, password: string): Promise<void> {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  if (new URL(page.url()).pathname.startsWith('/auth')) {
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3500);
    expect(new URL(page.url()).pathname).not.toMatch(/^\/auth/);
  }
}

function b64u(buf: Buffer): string {
  return Buffer.from(buf).toString('base64url');
}

function mintAccessTokenExpirado(secret: string, sub: string, role: string): string {
  const header = b64u(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64u(
    Buffer.from(
      JSON.stringify({
        sub,
        email: ADMIN_EMAIL,
        role,
        iat: now - 120,
        exp: now - 60,
        aud: 'senhasfestas-app',
        iss: 'senhasfestas-api',
      }),
    ),
  );
  const sig = b64u(crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${sig}`;
}

async function cookieSf(context: BrowserContext, name: string): Promise<string | undefined> {
  const cookies = await context.cookies(BASE + '/');
  return cookies.find((c) => c.name === name)?.value;
}

test('raiz sem sessão redireciona para /auth (sem redirect-loop)', async ({ page }) => {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  expect(new URL(page.url()).pathname).toMatch(/^\/auth/);
});

test('login admin + F5 mantém a sessão (refresh cookie sem body) com cookies host-only', async ({
  page,
  context,
}) => {
  await loginComo(page, ADMIN_EMAIL, ADMIN_PASS);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  expect(new URL(page.url()).pathname).not.toMatch(/^\/auth/);

  const cookies = await context.cookies(BASE + '/');
  const sf = cookies.filter((c) => c.name === 'sf_token' || c.name === 'sf_refresh');
  expect(sf.length).toBeGreaterThanOrEqual(2);
  expect(sf.every((c) => !c.domain.startsWith('.'))).toBe(true);
});

test('admin acede a /pos (role financeira)', async ({ page }) => {
  await loginComo(page, ADMIN_EMAIL, ADMIN_PASS);
  await page.goto(BASE + '/pos', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  expect(new URL(page.url()).pathname).toMatch(/^\/pos/);
});

test('token de acesso expirado + F5 -> renovado silenciosamente (reproduz os 15 min)', async ({
  page,
  context,
}) => {
  test.skip(
    !process.env.JWT_SECRET,
    'define process.env.JWT_SECRET (chave de assinatura de prod) para correr este cenário',
  );

  await loginComo(page, ADMIN_EMAIL, ADMIN_PASS);
  const user = await page.evaluate(() => JSON.parse(localStorage.getItem('user') || '{}'));
  const expirado = mintAccessTokenExpirado(process.env.JWT_SECRET as string, user.id, user.role);
  expect(expirado.split('.').length).toBe(3);

  await context.addCookies([
    {
      name: 'sf_token',
      value: expirado,
      domain: new URL(BASE).hostname,
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    },
  ]);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);

  expect(new URL(page.url()).pathname).not.toMatch(/^\/auth/);
  const tokenAtual = await cookieSf(context, 'sf_token');
  expect(tokenAtual).toBeDefined();
  expect(tokenAtual).not.toBe(expirado);
});

test('logout por UI redireciona sempre para /auth/login', async ({ page }) => {
  await loginComo(page, ADMIN_EMAIL, ADMIN_PASS);
  await page.goto(BASE + '/admin', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.locator('button[title="Terminar sessão"]').click();
  await page.waitForURL('**/auth/login', { timeout: 15_000 });
  expect(new URL(page.url()).pathname).toMatch(/^\/auth/);
});

test('client é bloqueado em /pos, /admin e /caixa (redirect para /pedidos)', async ({ page }) => {
  await loginComo(page, CLIENT_EMAIL, CLIENT_PASS);
  for (const rota of ['/pos', '/admin', '/caixa']) {
    await page.goto(BASE + rota, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    expect(new URL(page.url()).pathname, `client em ${rota}`).toMatch(/^\/pedidos/);
  }
});