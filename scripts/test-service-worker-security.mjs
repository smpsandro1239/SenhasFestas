import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../frontend/public/sw.js', import.meta.url), 'utf8');

function carregarServiceWorker({ fetchImpl, offlineResponse = new Response('offline') }) {
  const listeners = new Map();
  const cache = {
    match: async (key) => key === '/offline' ? offlineResponse : null,
    put: async () => { throw new Error('O teste não permite escrita de páginas no cache'); },
    addAll: async () => undefined,
  };
  const sandbox = {
    self: {
      location: { origin: 'https://senhasfestas.example' },
      addEventListener: (event, callback) => listeners.set(event, callback),
      skipWaiting: async () => undefined,
      clients: { claim: async () => undefined },
    },
    caches: {
      open: async () => cache,
      keys: async () => ['senhasfestas-v5'],
      delete: async () => true,
      match: async () => null,
    },
    fetch: fetchImpl,
    URL,
    Response,
    Promise,
  };
  runInNewContext(source, sandbox);
  return listeners;
}

test('nunca guarda respostas HTML de navegação autenticada', async () => {
  let options;
  const listeners = carregarServiceWorker({
    fetchImpl: async (_request, fetchOptions) => {
      options = fetchOptions;
      return new Response('<html>privado</html>', { status: 200 });
    },
  });
  let responsePromise;
  listeners.get('fetch')({
    request: {
      method: 'GET',
      mode: 'navigate',
      url: 'https://senhasfestas.example/pos',
    },
    respondWith: (promise) => { responsePromise = promise; },
  });

  const response = await responsePromise;
  assert.equal(response.status, 200);
  assert.equal(options.cache, 'no-store');
});

test('em falha de rede devolve apenas a página offline genérica', async () => {
  const offline = new Response('offline genérico', { status: 200 });
  const listeners = carregarServiceWorker({
    fetchImpl: async () => { throw new Error('offline'); },
    offlineResponse: offline,
  });
  let responsePromise;
  listeners.get('fetch')({
    request: {
      method: 'GET',
      mode: 'navigate',
      url: 'https://senhasfestas.example/admin',
    },
    respondWith: (promise) => { responsePromise = promise; },
  });

  const response = await responsePromise;
  assert.equal(await response.text(), 'offline genérico');
});

test('não interceta pedidos à API', () => {
  const listeners = carregarServiceWorker({ fetchImpl: async () => new Response('ok') });
  let intercetado = false;
  listeners.get('fetch')({
    request: {
      method: 'GET',
      mode: 'cors',
      url: 'https://senhasfestas.example/api/balances',
    },
    respondWith: () => { intercetado = true; },
  });
  assert.equal(intercetado, false);
});
