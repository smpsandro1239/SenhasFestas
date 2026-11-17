const CACHE_NAME = 'senhasfestas-v5';
const PRECACHE_URLS = [
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/offline',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    // Nunca guardar HTML/RSC de páginas autenticadas: o Service Worker pode
    // sobreviver ao logout e expor dados privados num dispositivo partilhado.
    return await fetch(request, { cache: 'no-store' });
  } catch {
    const offlinePage = await cache.match('/offline');
    if (offlinePage) return offlinePage;
    return new Response('', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!isSameOrigin(url)) return;
  if (url.pathname.startsWith('/api/')) return;

  // Navegações: network-first com queda offline
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Assets com hash no nome: cache-first é seguro e rápido
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response && response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Não interceptar RSC, HTML dinâmico, respostas personalizadas ou dados
  // de utilizador. Só os assets estáticos explicitamente identificados acima
  // e os recursos precacheados são elegíveis para cache. A API já está excluída.
  if (
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/icon-192.png' ||
    url.pathname === '/icon-512.png'
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.ok) {
            const clone = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      }),
    );
  }
});