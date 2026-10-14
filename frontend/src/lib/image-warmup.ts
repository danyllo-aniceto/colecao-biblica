/**
 * Baixa imagens em segundo plano para o álbum abrir offline: as requisições passam pelo service worker, que guarda
 * cada imagem no cache (rota de imagens em sw.ts). Só roda com internet, fora do modo "economizar dados" e
 * quando o aparelho está ocioso; cada endereço é pedido uma vez por sessão.
 */
const requested = new Set<string>();
const MAX_PER_CALL = 120;
const PARALLEL = 3;

type IdleWindow = Window & { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number };

function saveDataOn() {
  return (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
}

export function warmImages(urls: Array<string | null | undefined>) {
  if (typeof window === 'undefined' || !navigator.onLine || saveDataOn()) return;
  const queue = urls.filter((url): url is string => Boolean(url) && !url!.startsWith('data:') && !requested.has(url!)).slice(0, MAX_PER_CALL);
  if (queue.length === 0) return;
  queue.forEach((url) => requested.add(url));

  const next = () => {
    const url = queue.shift();
    if (!url) return;
    const image = new Image();
    image.decoding = 'async';
    image.onload = image.onerror = next;
    image.src = url;
  };
  const start = () => Array.from({ length: PARALLEL }, next);
  const idle = (window as IdleWindow).requestIdleCallback;
  if (idle) idle(start, { timeout: 4000 });
  else window.setTimeout(start, 1500);
}
