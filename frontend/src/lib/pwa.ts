import { getApiBaseUrl } from '@/lib/api';

/** Evento não padronizado do Chromium para instalação do PWA. */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export function isServiceWorkerSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator;
}

export function serviceWorkerUrl() {
  const params = new URLSearchParams({
    v: process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev',
    api: new URL(getApiBaseUrl()).origin,
  });
  return `/sw.js?${params.toString()}`;
}

/**
 * Envia ao worker os arquivos do build já carregados por esta página, para que
 * a primeira visita (antes de o worker controlar a página) também funcione offline.
 */
export function precacheLoadedAssets(worker: ServiceWorker | null | undefined) {
  if (!worker) {
    return;
  }

  const urls = new Set<string>();
  performance.getEntriesByType('resource').forEach((entry) => urls.add(entry.name));
  document.querySelectorAll<HTMLScriptElement>('script[src]').forEach((script) => urls.add(script.src));
  document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]').forEach((link) => urls.add(link.href));

  worker.postMessage({ type: 'CACHE_URLS', urls: Array.from(urls) });
}

/**
 * Apaga as respostas da API guardadas para uso offline. Chamado no login e no
 * logout para que um usuário nunca veja dados de outro no mesmo aparelho.
 */
export function clearCachedUserData() {
  if (!isServiceWorkerSupported()) {
    return;
  }

  navigator.serviceWorker.controller?.postMessage({ type: 'CLEAR_USER_DATA' });
}

export function subscribeOnlineStatus(onChange: () => void) {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

export function getOnlineStatus() {
  return navigator.onLine;
}

const STANDALONE_QUERY = '(display-mode: standalone)';

export function subscribeDisplayMode(onChange: () => void) {
  const media = window.matchMedia(STANDALONE_QUERY);
  media.addEventListener('change', onChange);
  return () => media.removeEventListener('change', onChange);
}

/** true quando o app está aberto instalado (fora da aba do navegador). */
export function getIsStandalone() {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return window.matchMedia(STANDALONE_QUERY).matches || iosStandalone;
}

/** iPhone/iPad não emitem beforeinstallprompt: a instalação é manual pelo menu Compartilhar. */
export function getIsIos() {
  const { userAgent, maxTouchPoints } = navigator;
  return /iphone|ipad|ipod/i.test(userAgent) || (/macintosh/i.test(userAgent) && maxTouchPoints > 1);
}
