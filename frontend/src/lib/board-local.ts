import type { BoardState } from '@board/engine';
import type { BoardQuestion } from '@/lib/board-api';

/** Partida local guardada no aparelho, para continuar depois de fechar o app. */
export type LocalBoardGame = {
  version: 1;
  scenario: { id: number; slug: string; name: string; color: string | null; background: string | null };
  state: BoardState;
  questions: BoardQuestion[];
  log: string[];
  savedAt: number;
};

const KEY = 'colecao-biblica:tabuleiro-local';

export function loadLocalBoard(): LocalBoardGame | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalBoardGame;
    // Partida de uma versão antiga das regras não serve mais.
    if (parsed.version !== 1 || parsed.state?.version !== 1 || parsed.state.phase === 'FINISHED') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveLocalBoard(game: LocalBoardGame) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(game));
  } catch {
    // Sem espaço ou bloqueado: a partida segue, só não dá para retomar depois.
  }
}

export function clearLocalBoard() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignora
  }
}
