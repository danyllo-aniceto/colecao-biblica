import { useEffect, useSyncExternalStore } from 'react';

/**
 * Música do cenário da partida de tabuleiro aberta. Enquanto houver uma, ela toca no lugar da
 * escolhida nos ajustes (igual ao quiz, que sempre toca a do tema).
 */
let current: string | null = null;
const listeners = new Set<() => void>();

function set(value: string | null) {
  if (current === value) return;
  current = value;
  listeners.forEach((listener) => listener());
}

export function useBoardMusicOverride() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
    () => null,
  );
}

/** Declara a música do cenário enquanto a tela da partida estiver montada. */
export function useBoardMusic(src: string | null | undefined) {
  useEffect(() => {
    set(src ?? null);
    return () => set(null);
  }, [src]);
}
