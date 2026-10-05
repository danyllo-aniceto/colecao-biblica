import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/http';

export type GameMode = 'QUIZ' | 'BOARD' | 'DUEL';
export type GameModeDesign = { mode: GameMode; imageUrl: string | null };
export type GameModeImages = Partial<Record<GameMode, string | null>>;

let cache: GameModeImages | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<(images: GameModeImages) => void>();

function publish(next: GameModeImages) {
  cache = next;
  listeners.forEach((listener) => listener(next));
}

function load() {
  loading ??= apiRequest<GameModeDesign[]>('/game-modes', { method: 'GET' }, 'Não foi possível carregar as capas dos jogos.')
    .then((list) => publish(Object.fromEntries(list.map((design) => [design.mode, design.imageUrl]))))
    .catch(() => publish({}))
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** Capas dos modos de jogo da aba Jogar (cacheadas: uma consulta por sessão). Vazio usa o fundo padrão. */
export function useGameModeImages(): GameModeImages {
  const [images, setImages] = useState<GameModeImages>(cache ?? {});
  useEffect(() => {
    listeners.add(setImages);
    if (cache) setImages(cache);
    else void load();
    return () => {
      listeners.delete(setImages);
    };
  }, []);
  return images;
}

/** Salva a capa de um modo (admin) e já atualiza o app. */
export async function saveGameModeImage(mode: GameMode, imageUrl: string | null) {
  const saved = await apiRequest<GameModeDesign>(`/game-modes/admin/${mode.toLowerCase()}`, { method: 'PUT', body: JSON.stringify({ imageUrl }) }, 'Não foi possível salvar a capa.');
  publish({ ...(cache ?? {}), [saved.mode]: saved.imageUrl });
  return saved;
}
