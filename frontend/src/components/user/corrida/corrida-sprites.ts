import type { Sprites } from '@runner/characters';

type Entry = { image: HTMLImageElement; state: 'loading' | 'ready' | 'error' };
const images = new Map<string, Entry>();

/** Imagem de um sprite, já carregada (ou `null` enquanto carrega ou se falhou: o desenho usa a forma colorida). Começa a carregar na primeira vez. */
export function spriteImage(url: string): HTMLImageElement | null {
  let entry = images.get(url);
  if (!entry) {
    const image = new Image();
    image.decoding = 'async';
    entry = { image, state: 'loading' };
    images.set(url, entry);
    image.onload = () => {
      entry!.state = 'ready';
    };
    image.onerror = () => {
      entry!.state = 'error';
    };
    image.src = url;
  }
  return entry.state === 'ready' ? entry.image : null;
}

/** Aquece o cache com todos os sprites do personagem (antes da corrida começar). */
export function preloadSprites(sprites: Sprites | undefined) {
  for (const sheet of Object.values(sprites ?? {})) if (sheet) spriteImage(sheet.url);
}
