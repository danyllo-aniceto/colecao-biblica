import type { SectionId } from '@/components/user/game-shell';

/**
 * Lembra de onde a ficha da figurinha foi aberta, para o "voltar" cair no mesmo lugar
 * (a seção e, no álbum, os filtros e a folha da figurinha). Fica só na aba aberta.
 */
const KEY = 'colecao:sticker-return';

type Saved = { section: SectionId; characterId: number; albumView?: AlbumView; pending?: boolean };

export type AlbumView = { tab: string; rarity: string; books: string[]; sortBy: string; testament: string; period: string };

function read(): Saved | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function write(value: Saved | null) {
  try {
    if (value) sessionStorage.setItem(KEY, JSON.stringify(value));
    else sessionStorage.removeItem(KEY);
  } catch {
    // Sem armazenamento (aba privada): o voltar só cai no início.
  }
}

export function saveStickerReturn(value: { section: SectionId; characterId: number }) {
  write({ ...value, albumView: read()?.albumView });
}

export function saveAlbumView(albumView: AlbumView) {
  const current = read();
  if (current) write({ ...current, albumView });
}

/** Chamado ao sair da ficha (botão voltar ou voltar do navegador): marca o retorno. */
export function markStickerReturn() {
  const current = read();
  if (current) write({ ...current, pending: true });
}

/** Seção inicial do painel: a de onde o jogador saiu, se ele está voltando da ficha. */
export function takeReturnSection(): SectionId {
  const current = read();
  return current?.pending ? current.section : 'home';
}

/** Estado do álbum ao voltar da ficha. */
export function takeAlbumReturn(): { characterId: number; view: Partial<AlbumView> } | null {
  const current = read();
  if (!current?.pending || current.section !== 'stickers') return null;
  return { characterId: current.characterId, view: current.albumView ?? {} };
}

/** O painel limpa depois de montar (leituras acima ficam seguras no StrictMode). */
export function clearStickerReturn() {
  write(null);
}
