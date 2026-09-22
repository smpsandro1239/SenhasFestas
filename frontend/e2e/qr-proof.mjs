#!/usr/bin/env node
/* Prova de runtime do bloqueio de câmara por Permissions-Policy.
 *
 * Uso (na pasta frontend):
 *   node e2e/qr-proof.mjs
 *   E2E_BASE_URL=https://senhas-festas-ten.vercel.app node e2e/qr-proof.mjs
 *
 * Método: com câmara falsa + permissão concedida por defeito
 * (--use-fake-device-for-media-stream + --use-fake-ui-for-media-stream),
 * qualquer falha de getUserMedia só pode vir da Permissions-Policy.
 * 1) Controlo em https://example.com  -> deve ABRIR (prova que o método funciona).
 * 2) Alvo em E2E_BASE_URL (origem com o header) -> se falhar NotAllowedError, está bloqueada.
 *
 * Exit codes (diagnóstico/guarda, alvo saudável = 0):
 *   0 = câmara ABRE na origem (esperado com camera=(self))
 *   1 = câmara BLOQUEADA pela policy (regressão -> alarme)
 *   2 = controlo falhou (método de prova inválido)
 *   3 = erro inesperado no alvo
 */
import { chromium } from '@playwright/test';

const BASE = (process.env.E2E_BASE_URL || 'https://senhas-festas-ten.vercel.app').replace(/\/+$/, '');

const ARGS = [
  '--use-fake-device-for-media-stream',
  '--use-fake-ui-for-media-stream',
];

async function testarCamara(browser, url) {
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(800);
    return await page.evaluate(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        stream.getTracks().forEach((track) => track.stop());
        return { ok: true };
      } catch (erro) {
        return { ok: false, name: erro?.name ?? 'Sem erro', message: erro?.message ?? '' };
      }
    });
  } finally {
    await page.close();
  }
}

let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', args: ARGS });
} catch {
  browser = await chromium.launch({ args: ARGS });
}

try {
  const controlo = await testarCamara(browser, 'https://example.com/');
  const alvo = await testarCamara(browser, `${BASE}/auth/login`);

  console.log('Controlo (example.com):', JSON.stringify(controlo));
  console.log(`Alvo (${BASE}):`, JSON.stringify(alvo));

  const metodoValido = controlo.ok === true;
  const bloqueado = alvo.ok === false && alvo.name === 'NotAllowedError';

  if (!metodoValido) {
    console.error('FALHA: o controlo não abriu a câmara — método de prova inválido.');
    process.exit(2);
  }
  if (bloqueado) {
    console.error('RESULTADO: câmara BLOQUEADA pela Permissions-Policy na origem.');
    process.exit(1);
  }
  if (alvo.ok === true) {
    console.log('RESULTADO: câmara ABRE na origem — o scanner funciona apesar do header.');
    process.exit(0);
  }
  console.error(`RESULTADO: erro inesperado (${alvo.name}) — rever com cuidado.`);
  process.exit(3);
} finally {
  await browser.close();
}