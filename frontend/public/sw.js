/* Service worker da Coleção Bíblica.
 *
 * Registrado por src/lib/pwa.ts como /sw.js?v=<build>&api=<origem da API>.
 * Uma nova versão do build muda a URL, o que instala um novo worker.
 *
 * Estratégias:
 * - Páginas (navegação): rede primeiro; sem rede, página em cache ou /offline.
 * - /_next/static: cache primeiro (arquivos com hash, imutáveis).
 * - Ícones, manifest e imagens (inclusive as do Vercel Blob): cache com revalidação em segundo plano.
 * - API: apenas GETs de leitura listados abaixo, rede primeiro com cópia
 *   em cache para uso offline. Quiz, loja (compra) e autenticação nunca
 *   passam pelo cache.
 */

const params = new URL(self.location.href).searchParams;
const VERSION = params.get('v') || 'dev';
const API_ORIGIN = params.get('api') ? new URL(params.get('api')).origin : null;

const PREFIX = 'colecao-biblica';
const SHELL_CACHE = `${PREFIX}-shell-${VERSION}`;
const STATIC_CACHE = `${PREFIX}-static-${VERSION}`;
const PAGES_CACHE = `${PREFIX}-pages-${VERSION}`;
const IMAGES_CACHE = `${PREFIX}-images`;
const API_CACHE = `${PREFIX}-api`;
const CURRENT_CACHES = [SHELL_CACHE, STATIC_CACHE, PAGES_CACHE, IMAGES_CACHE, API_CACHE];

const OFFLINE_URL = '/offline';
const SHELL_URLS = [
  OFFLINE_URL,
  '/',
  '/dashboard',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png',
];

/** Leituras da API que podem ser exibidas offline. */
const CACHEABLE_API_PATHS = [
  /^\/characters(\/\d+)?$/,
  /^\/collection\/my(\/progress)?$/,
  /^\/comments\/my$/,
  /^\/ranking$/,
  /^\/settings$/,
  /^\/shop$/,
  /^\/users\/me$/,
  /^\/quiz\/history$/,
];

const NAVIGATION_TIMEOUT_MS = 4000;
const MAX_ENTRIES = { [PAGES_CACHE]: 30, [IMAGES_CACHE]: 80, [API_CACHE]: 40 };

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Um recurso ausente não deve impedir a instalação do restante.
      Promise.all(SHELL_URLS.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => undefined))),
    ),
  );
  // Sem skipWaiting aqui: uma nova versão espera o usuário aceitar a atualização.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.startsWith(PREFIX) && !CURRENT_CACHES.includes(name))
          .map((name) => caches.delete(name)),
      );
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (data.type === 'CLEAR_USER_DATA') {
    event.waitUntil(caches.delete(API_CACHE));
  }

  // O cliente informa os arquivos que já carregou antes do worker assumir,
  // para que a primeira visita já funcione offline.
  if (data.type === 'CACHE_URLS' && Array.isArray(data.urls)) {
    event.waitUntil(cacheUrls(data.urls));
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') {
      event.respondWith(handleNavigation(event));
      return;
    }

    // Requisições RSC do roteador do Next: sem rede, o Next recarrega a página
    // inteira, que então é atendida pela estratégia de navegação.
    if (request.headers.get('RSC') || url.searchParams.has('_rsc')) {
      return;
    }

    if (url.pathname.startsWith('/_next/static/')) {
      event.respondWith(cacheFirst(request, STATIC_CACHE));
      return;
    }

    if (
      url.pathname.startsWith('/icons/') ||
      url.pathname.startsWith('/_next/image') ||
      url.pathname === '/manifest.webmanifest' ||
      request.destination === 'image'
    ) {
      event.respondWith(staleWhileRevalidate(request, IMAGES_CACHE));
    }
    return;
  }

  // Imagens do Vercel Blob (figurinhas e conteúdo): ficam disponíveis offline.
  if (request.destination === 'image' && url.hostname.endsWith('.blob.vercel-storage.com')) {
    event.respondWith(staleWhileRevalidate(request, IMAGES_CACHE, { allowOpaque: true }));
    return;
  }

  if (API_ORIGIN && url.origin === API_ORIGIN && CACHEABLE_API_PATHS.some((pattern) => pattern.test(url.pathname))) {
    event.respondWith(networkFirstApi(request));
  }
});

async function handleNavigation(event) {
  const { request } = event;

  const network = (async () => {
    const response = (await event.preloadResponse) || (await fetch(request));
    if (response.ok && response.type === 'basic') {
      await putAndTrim(PAGES_CACHE, request, response.clone());
    }
    return response;
  })();
  // Evita "unhandled rejection" quando a resposta de cache vence a corrida.
  event.waitUntil(network.catch(() => undefined));

  try {
    return await withTimeout(network, NAVIGATION_TIMEOUT_MS);
  } catch {
    const cached =
      (await caches.match(request, { ignoreSearch: true })) ||
      (await caches.match(new URL(request.url).pathname, { cacheName: SHELL_CACHE }));
    if (cached) {
      return cached;
    }

    // Rede lenta (e não ausente) sem cópia local: continua esperando a rede.
    try {
      return await network;
    } catch {
      return (await caches.match(OFFLINE_URL)) || new Response('Você está offline.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    await cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request, cacheName, { allowOpaque = false } = {}) {
  const cached = await caches.match(request);
  const network = fetch(request)
    .then(async (response) => {
      // Imagens de outro domínio sem CORS chegam "opacas" (status 0): só aceitas quando pedido.
      if (response.ok || (allowOpaque && response.type === 'opaque')) {
        await putAndTrim(cacheName, request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  return cached || (await network) || Response.error();
}

async function networkFirstApi(request) {
  try {
    const response = await fetch(request);
    // Nunca guarda erros (ex.: 401), apenas respostas válidas.
    if (response.ok) {
      await putAndTrim(API_CACHE, request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request, { cacheName: API_CACHE });
    if (cached) {
      return cached;
    }
    throw error;
  }
}

async function cacheUrls(urls) {
  const cache = await caches.open(STATIC_CACHE);
  await Promise.all(
    urls
      .filter((raw) => {
        try {
          const url = new URL(raw, self.location.origin);
          return url.origin === self.location.origin && url.pathname.startsWith('/_next/static/');
        } catch {
          return false;
        }
      })
      .map(async (url) => {
        if (!(await cache.match(url))) {
          await cache.add(url).catch(() => undefined);
        }
      }),
  );
}

async function putAndTrim(cacheName, request, response) {
  const cache = await caches.open(cacheName);
  await cache.put(request, response);

  const limit = MAX_ENTRIES[cacheName];
  if (limit) {
    const keys = await cache.keys();
    // Remove as entradas mais antigas (a ordem de keys() é a de inserção).
    await Promise.all(keys.slice(0, Math.max(0, keys.length - limit)).map((key) => cache.delete(key)));
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
