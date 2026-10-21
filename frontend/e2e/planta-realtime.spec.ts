import { test, expect, type Page, type Browser, type APIRequestContext } from '@playwright/test';

// Suite do realtime da planta (dois contextos) contra E2E_BASE_URL.
// Zero segredos em código: credenciais do env obrigatório. Cria um evento
// `e2e-*` descartável (nunca toca em eventos reais) e apaga-o no fim.
//
// Prova o que a revisão exigiu como "done":
//  1. A adiciona uma mesa -> B adopta-a no DOM sem reload (via socket).
//  2. Com edição local por sincronizar em B, A grava -> B mostra o aviso
//     "mudou noutro dispositivo" e NÃO perde a edição local.

const BASE = process.env.E2E_BASE_URL;
if (!BASE) {
  throw new Error(
    'Falta E2E_BASE_URL. A suite não corre contra produção por omissão.',
  );
}

const API = process.env.E2E_API_URL || BASE.replace(/:3001\/?$/, ':3000') + '/api';

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

interface EventoCriado {
  id: string;
  plantaId: string;
}

async function criarEventoDescartavel(request: APIRequestContext, token: string): Promise<EventoCriado> {
  const ts = Date.now();
  const auth = { Authorization: `Bearer ${token}` };
  const iso = new Date().toISOString();
  const fim = new Date(Date.now() + 86_400_000).toISOString();

  const ev = await request.post(`${API}/events`, {
    headers: auth,
    data: { name: `e2e-planta-${ts}`, startDate: iso, endDate: fim },
  });
  expect(ev.ok(), `criar evento: ${ev.status()}`).toBeTruthy();
  const evento = await ev.json();

  let plantas = await request.get(`${API}/events/${evento.id}/plantas`, { headers: auth });
  expect(plantas.ok()).toBeTruthy();
  let lista = await plantas.json();
  if (!lista.length) {
    const nova = await request.post(`${API}/events/${evento.id}/plantas`, {
      headers: auth,
      data: { nome: 'Principal' },
    });
    expect(nova.ok(), `criar planta: ${nova.status()}`).toBeTruthy();
    lista = await (await request.get(`${API}/events/${evento.id}/plantas`, { headers: auth })).json();
  }
  return { id: evento.id, plantaId: lista[0].id };
}

async function apagarEvento(request: APIRequestContext, token: string, id: string): Promise<void> {
  await request.delete(`${API}/events/${id}`, { headers: { Authorization: `Bearer ${token}` } });
}

async function entrar(
  browser: Browser,
  baseURL: string,
  email: string,
  password: string,
  eventoCriado: EventoCriado,
): Promise<{ page: Page; fechar: () => Promise<void> }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseURL}/auth/login`, { waitUntil: 'networkidle' });
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.getByRole('button', { name: /Entrar/i }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/auth/login'), { timeout: 20_000 });

  await page.goto(`${baseURL}/admin`, { waitUntil: 'networkidle' });
  await page.click('#tab-planta');
  await page.waitForTimeout(500);
  const selects = page.locator('select');
  await selects.nth(0).selectOption(eventoCriado.id);
  await page.waitForTimeout(1500);
  await selects.nth(1).selectOption(eventoCriado.plantaId).catch(() => {});
  await page.waitForTimeout(1500);
  return { page, fechar: () => context.close() };
}

test('planta realtime: B adopta a mesa nova de A e, com edição local, é avisado sem a perder', async ({
  browser,
  request,
}) => {
  const email = exigirEnv('E2E_ADMIN_EMAIL');
  const password = exigirEnv('E2E_ADMIN_PASSWORD');

  const login = await request.post(`${API}/auth/login`, { data: { email, password } });
  expect(login.ok(), `login API: ${login.status()}`).toBeTruthy();
  const { token } = await login.json();

  const evento = await criarEventoDescartavel(request, token);
  const ts = Date.now();

  const A = await entrar(browser, BASE, email, password, evento);
  const B = await entrar(browser, BASE, email, password, evento);
  try {
    const mesasA0 = await A.page.locator('.planta-mesa').count();
    const mesasB0 = await B.page.locator('.planta-mesa').count();

    const nomeRemota = `E2E-A-${ts}`;
    await A.page.locator('input[placeholder="ex: Mesa 1"]').fill(nomeRemota);
    await A.page.getByRole('button', { name: 'Adicionar mesa' }).click();

    await expect(B.page.locator(`.planta-mesa:has-text("${nomeRemota}")`)).toBeVisible({
      timeout: 15_000,
    });
    expect(await A.page.locator('.planta-mesa').count()).toBe(mesasA0 + 1);
    expect(mesasB0).toBe(mesasA0);
    expect(await B.page.locator('.planta-mesa').count()).toBe(mesasB0 + 1);

    // B edita localmente; antes de sincronizar, A grava outra mesa.
    const nomeLocal = `E2E-B-${ts}`;
    await B.page.locator('input[placeholder="ex: Mesa 1"]').fill(nomeLocal);
    await B.page.getByRole('button', { name: 'Adicionar mesa' }).click();

    await A.page.locator('input[placeholder="ex: Mesa 1"]').fill(`E2E-A2-${ts}`);
    await A.page.getByRole('button', { name: 'Adicionar mesa' }).click();

    await expect(B.page.getByText(/mudou noutro dispositivo/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(B.page.locator(`.planta-mesa:has-text("${nomeLocal}")`)).toBeVisible();
  } finally {
    await A.fechar();
    await B.fechar();
    await apagarEvento(request, token, evento.id);
  }
});
