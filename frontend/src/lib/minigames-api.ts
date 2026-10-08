import { apiRequest } from '@/lib/http';
import type { PaginatedResponse } from '@/lib/admin-api';
import type { PlayerLook } from '@/lib/rewards-api';

export type MiniGameInfo = {
  id: string;
  name: string;
  emoji: string;
  text: string;
  /** Pedra do Peitoral que libera o jogo (1 a 12). */
  stoneSlot: number;
  stoneName: string | null;
  /** O jogo já existe no app (os demais aparecem como "em preparo"). */
  ready: boolean;
  unlocked: boolean;
};

export type MiniGamesOverview = { games: MiniGameInfo[]; rankingUnlocked: boolean; weekKey: string; coins: { perWin: number; limit: number; winsToday: number } };

export type MiniRankingEntry = { position: number; userId: number; userName: string; level: number; look: PlayerLook | null; total: number };
export type MiniRankingPage = PaginatedResponse<MiniRankingEntry> & { weekKey: string; me: { position: number; total: number } | null };

export type GalleryEntry = { position: number; userId: number; userName: string; level: number; look: PlayerLook | null; completedAt: string };
export type GalleryPage = PaginatedResponse<GalleryEntry> & { me: { completedAt: string } | null };

export const getMiniGames = () => apiRequest<MiniGamesOverview>('/minigames', { method: 'GET' }, 'Não foi possível carregar os mini games.');

export const getMiniRanking = (page = 0, size = 20) => apiRequest<MiniRankingPage>(`/minigames/ranking?page=${page}&size=${size}`, { method: 'GET' }, 'Não foi possível carregar o ranking dos mini games.');

export const getPeitoralGallery = (page = 0, size = 20) => apiRequest<GalleryPage>(`/minigames/gallery?page=${page}&size=${size}`, { method: 'GET' }, 'Não foi possível carregar a Galeria dos Peitorais.');

/** Resultado conferido pelo servidor: a tela nunca manda a pontuação. */
export type MiniGameResult = {
  solved: boolean;
  score: number;
  detail: string;
  /** Melhor pontuação da semana neste jogo. */
  best: number;
  recorded: boolean;
  rankingUnlocked: boolean;
  weekKey: string;
  coins: number;
  userCoins: number | null;
};

export type StartedRun<P> = { runId: string; game: string; puzzle: P };

export const startMiniGame = <P>(game: string) => apiRequest<StartedRun<P>>(`/minigames/${game}/start`, { method: 'POST' }, 'Não foi possível começar o jogo.');

export const finishMiniGame = (runId: string, answer: object) =>
  apiRequest<MiniGameResult>(`/minigames/runs/${runId}/finish`, { method: 'POST', body: JSON.stringify(answer) }, 'Não foi possível conferir a partida.');

export type HangmanGuess = { pattern: Array<string | null>; errors: number; maxErrors: number; status: 'playing' | 'won' | 'lost'; word?: string; result?: MiniGameResult };

export const guessHangman = (runId: string, letter: string) =>
  apiRequest<HangmanGuess>(`/minigames/runs/${runId}/guess`, { method: 'POST', body: JSON.stringify({ letter }) }, 'Não foi possível conferir a letra.');

/** Dados que cada jogo recebe ao começar (o servidor guarda o gabarito). */
export type WordSearchPuzzle = { size: number; grid: string[]; words: string[] };
export type HangmanPuzzle = { pattern: Array<string | null>; errors: number; maxErrors: number; hint: string; testament: string | null };
export type SwapPuzzle = { side: number; order: number[]; imageUrl: string | null; title: string };
export type MemoryPuzzle = { cards: Array<{ pair: number; text: string }> };
export type VersePuzzle = { reference: string; chips: string[]; length: number; words: string[] };
export type MazePuzzle = { width: number; height: number; cells: number[] };
