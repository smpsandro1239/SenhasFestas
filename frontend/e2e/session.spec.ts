import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// Suite do contrato de sessão contra produção (E2E_BASE_URL).
// Zero segredos em código: as credenciais vêm do env obrigatório e a suite
// falha com mensagem clara se faltarem. Não precisa da chave de assinatura —
// a renovação é exercitada por cookie (sem corpo, sem forjar tokens).

const BASE = process.env.E2E_BASE_URL || 'https://senhas-festas-ten.vercel.app';

function exigirEnv(nome: string): string {
  const valor = process.env[nome];
  if (!valor) {
    throw new Error(
      `Falta ${nome} no env. A suite não tem credenciais em código. ` +
        `Exporta ${nome} (ex.: $env:${nome}='...') antes de correr.`,
    );
  }
  return valor;
}

function creds() {
  return {
    adminEmail: exigirEnv('E2E_ADMIN_EMAIL'),
    adminPass: exigirEnv('E2E_ADMIN_PASSWORD'),
    clientEmail: exigirEnv('E2E_CLIENT_EMAIL'),
    clientPass: exigirEnv('E2E_CLIENT_PASSWORD'),
  };
}

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
  const { adminEmail, adminPass } = creds();
  await loginComo(page, adminEmail, adminPass);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  expect(new URL(page.url()).pathname).not.toMatch(/^\/auth/);

  const cookies = await context.cookies(BASE + '/');
  const sf = cookies.filter((c) => c.name === 'sf_token' || c.name === 'sf_refresh');
  expect(sf.length).toBeGreaterThanOrEqual(2);
  expect(sf.every((c) => !c.domain.startsWith('.'))).toBe(true);
});

test('admin acede a /pos (role financeira)', async ({ page }) => {
  const { adminEmail, adminPass } = creds();
  await loginComo(page, adminEmail, adminPass);
  await page.goto(BASE + '/pos', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  expect(new URL(page.url()).pathname).toMatch(/^\/pos/);
});

test('sem access token mas com refresh cookie -> boot em /auth/login renova a sessão', async ({
  page,
  context,
}) => {
  const { adminEmail, adminPass } = creds();
  await loginComo(page, adminEmail, adminPass);
  const refreshAntes = await cookieSf(context, 'sf_refresh');
  expect(refreshAntes).toBeDefined();

  // Remove só o access token; o refresh cookie fica. Boot na rota pública:
  // o AuthProvider corre hydrateSession -> POST /auth/refresh sem corpo -> renova.
  await context.clearCookies({ name: 'sf_token', domain: new URL(BASE).hostname });
  await page.goto(BASE + '/auth/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  expect(new URL(page.url()).pathname).toMatch(/^\/auth\/login/);
  const tokenNovo = await cookieSf(context, 'sf_token');
  expect(tokenNovo).toBeDefined();
  const user = await page.evaluate(() => localStorage.getItem('user'));
  expect(user).toBeTruthy();
});

test('logout por UI redireciona sempre para /auth/login', async ({ page }) => {
  const { adminEmail, adminPass } = creds();
  await loginComo(page, adminEmail, adminPass);
  await page.goto(BASE + '/admin', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.locator('button[title="Terminar sessão"]').click();
  await page.waitForURL('**/auth/login', { timeout: 15_000 });
  expect(new URL(page.url()).pathname).toMatch(/^\/auth/);
});

test('client é bloqueado em /pos, /admin e /caixa (redirect para /pedidos)', async ({ page }) => {
  const { clientEmail, clientPass } = creds();
  await loginComo(page, clientEmail, clientPass);
  for (const rota of ['/pos', '/admin', '/caixa']) {
    await page.goto(BASE + rota, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    expect(new URL(page.url()).pathname, `client em ${rota}`).toMatch(/^\/pedidos/);
  }
});