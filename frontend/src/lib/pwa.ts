/** Evento não padronizado do Chromium para instalação do PWA. */
export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export function isServiceWorkerSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator;
}

/** Worker gerado pelo vite-plugin-pwa (src/sw.ts); o build pré-cacheia todos os arquivos do app. */
export const SERVICE_WORKER_URL = '/sw.js';

/** Commit do build em uso (aparece no perfil; ajuda a saber se o aparelho já pegou o deploy novo). */
export const APP_VERSION = __BUILD_ID__;

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
