/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

/*
 * Service worker da Coleção Bíblica (compilado pelo vite-plugin-pwa).
 *
 * - Arquivos do build (JS, CSS, fontes, ícones, index.html): pré-cacheados; o app abre offline.
 * - Navegação: qualquer rota do app devolve o index.html do cache (é uma SPA).
 * - Imagens (inclusive as do Vercel Blob): cache com revalidação em segundo plano.
 * - API: só as leituras listadas abaixo, rede primeiro com cópia para uso offline.
 *   Quiz, compras e login nunca passam pelo cache.
 */

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> };

const PREFIX = 'colecao-biblica';
const API_CACHE = `${PREFIX}-api`;
const IMAGES_CACHE = `${PREFIX}-images`;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), { denylist: [/^\/api\//] }));

// Arquivos do build fora do pré-cache (nomes com hash, nunca mudam): guardados ao serem usados.
registerRoute(
  ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/assets/'),
  new CacheFirst({
    cacheName: `${PREFIX}-assets`,
    plugins: [new ExpirationPlugin({ maxEntries: 150, purgeOnQuotaError: true })],
  }),
);

/** Leituras da API que podem ser exibidas offline. */
const CACHEABLE_API_PATHS = [
  /^\/api\/characters(\/\d+)?$/,
  /^\/api\/collection\/my(\/progress)?$/,
  /^\/api\/comments\/my$/,
  /^\/api\/ranking$/,
  /^\/api\/settings$/,
  /^\/api\/shop$/,
  /^\/api\/users\/me$/,
  /^\/api\/quiz\/history$/,
  /^\/api\/quiz\/matches$/,
  /^\/api\/achievements$/,
  /^\/api\/missions$/,
  /^\/api\/characters\/upcoming$/,
];

registerRoute(
  ({ url, request, sameOrigin }) => sameOrigin && request.method === 'GET' && CACHEABLE_API_PATHS.some((pattern) => pattern.test(url.pathname)),
  new NetworkFirst({
    cacheName: API_CACHE,
    networkTimeoutSeconds: 6,
    plugins: [
      // Nunca guarda erros (ex.: 401), apenas respostas válidas.
      { cacheWillUpdate: async ({ response }) => (response.ok ? response : null) },
      new ExpirationPlugin({ maxEntries: 40 }),
    ],
  }),
);

registerRoute(
  ({ request, url, sameOrigin }) => request.destination === 'image' && (sameOrigin || url.hostname.endsWith('.blob.vercel-storage.com')),
  new StaleWhileRevalidate({
    cacheName: IMAGES_CACHE,
    plugins: [
      // Imagens de outro domínio sem CORS chegam "opacas" (status 0); também servem offline.
      { cacheWillUpdate: async ({ response }) => (response.ok || response.type === 'opaque' ? response : null) },
      new ExpirationPlugin({ maxEntries: 80, purgeOnQuotaError: true }),
    ],
  }),
);

self.addEventListener('message', (event) => {
  const data = (event.data ?? {}) as { type?: string };

  // Uma nova versão espera o usuário aceitar a atualização (aviso no app).
  if (data.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }

  // Login e logout apagam os dados do usuário anterior guardados no aparelho.
  if (data.type === 'CLEAR_USER_DATA') {
    event.waitUntil(caches.delete(API_CACHE).then(() => undefined));
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Remove os caches do service worker antigo (anterior ao Workbox).
      const names = await caches.keys();
      const legacy = names.filter((name) => /^colecao-biblica-(shell|static|pages)-/.test(name));
      await Promise.all(legacy.map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});
