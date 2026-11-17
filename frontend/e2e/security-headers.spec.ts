import { test, expect } from '@playwright/test';

// Guarda de regressão: se a Permissions-Policy voltar a servir camera=(),
// o scanner QR morre em produção (já aconteceu; estava bloqueado mesmo com
// câmara falsa e permissão concedida). Sem login, sem credenciais — só lê o
// header servido pela origem.
test('Permissões-Policy serve camera=(self) — scanner QR não regride', async ({ request }) => {
  const resposta = await request.get('/auth/login');
  expect(resposta.status()).toBe(200);
  const policy = resposta.headers()['permissions-policy'] ?? '';
  expect(policy).toContain('camera=(self)');
  expect(policy).not.toContain('camera=()');
});

test('CSP usa nonce por resposta e não permite scripts inline genéricos', async ({ request }) => {
  const resposta = await request.get('/auth/login');
  expect(resposta.status()).toBe(200);

  const csp = resposta.headers()['content-security-policy'] ?? '';
  const scriptSrc = csp.split(';').map((parte) => parte.trim()).find((parte) => parte.startsWith('script-src')) ?? '';

  expect(scriptSrc).toContain('nonce-');
  expect(scriptSrc).not.toContain("'unsafe-inline'");

  const nonce = scriptSrc.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toBeTruthy();
  const html = await resposta.text();
  expect(html).toContain(`nonce="${nonce}"`);
});
