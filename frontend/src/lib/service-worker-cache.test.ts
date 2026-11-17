import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const serviceWorker = readFileSync(resolve(process.cwd(), 'public/sw.js'), 'utf8');

describe('Service Worker — privacidade de páginas autenticadas', () => {
  it('não guarda respostas de navegação no Cache Storage', () => {
    const inicio = serviceWorker.indexOf('async function networkFirst');
    const fim = serviceWorker.indexOf("self.addEventListener('fetch'", inicio);
    expect(inicio).toBeGreaterThanOrEqual(0);
    expect(fim).toBeGreaterThan(inicio);

    const networkFirst = serviceWorker.slice(inicio, fim);
    expect(networkFirst).not.toMatch(/cache\.put\s*\(\s*request/);
    expect(networkFirst).not.toMatch(/cache\.put\s*\(\s*request\s*,\s*response\.clone/);
  });

  it('não interceta respostas RSC/HTML dinâmico fora das rotas estáticas permitidas', () => {
    expect(serviceWorker).toContain("if (request.mode === 'navigate')");
    expect(serviceWorker).toContain("url.pathname.startsWith('/_next/static/')");
    expect(serviceWorker).toContain("url.pathname === '/manifest.webmanifest'");
    expect(serviceWorker).toContain("url.pathname === '/icon-512.png'");
    expect(serviceWorker).not.toContain('// Restante (manifest, ícones): stale-while-revalidate');
  });
});
