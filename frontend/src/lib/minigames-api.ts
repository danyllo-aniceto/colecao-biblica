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
  /** Capa do cartão (16:9) e fundo da tela de jogo (vertical), enviados pelo painel. */
  coverUrl: string | null;
  backgroundUrl: string | null;
};

export type MiniGamesOverview = { games: MiniGameInfo[]; rankingUnlocked: boolean; adminPreview: boolean; weekKey: string; coins: { perWin: number; limit: number; winsToday: number } };

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
  /** Caça-palavras: onde estavam as palavras que faltaram. */
  reveal?: Array<{ word: string; from: [number, number]; to: [number, number] }>;
};

export type StartedRun<P> = { runId: string; game: string; puzzle: P };

/** `options` são as escolhas da tela de preparo (ex.: dificuldade e tema do caça-palavras). */
export const startMiniGame = <P>(game: string, options?: object) =>
  apiRequest<StartedRun<P>>(`/minigames/${game}/start`, { method: 'POST', body: JSON.stringify(options ?? {}) }, 'Não foi possível começar o jogo.');

export const finishMiniGame = (runId: string, answer: object) =>
  apiRequest<MiniGameResult>(`/minigames/runs/${runId}/finish`, { method: 'POST', body: JSON.stringify(answer) }, 'Não foi possível conferir a partida.');

export type HangmanGuess = { pattern: Array<string | null>; errors: number; maxErrors: number; status: 'playing' | 'won' | 'lost'; word?: string; result?: MiniGameResult };

export const guessHangman = (runId: string, letter: string) =>
  apiRequest<HangmanGuess>(`/minigames/runs/${runId}/guess`, { method: 'POST', body: JSON.stringify({ letter }) }, 'Não foi possível conferir a letra.');

/** Dados que cada jogo recebe ao começar (o servidor guarda o gabarito). */
export type WordSearchDifficulty = 'facil' | 'medio' | 'dificil';
export type WordSearchTheme = 'mix' | 'antigo' | 'novo' | 'lugares' | 'livros';
export type WordSearchClue = { word: string; label: string; kind: 'character' | 'place' | 'book'; imageUrl: string | null };
export type WordSearchPuzzle = {
  size: number;
  grid: string[];
  words: string[];
  difficulty: WordSearchDifficulty;
  theme: string;
  clues: WordSearchClue[];
  hints: number;
  hintPenalty: number;
  /** Segundos com bônus de tempo cheio. */
  par: number;
  maxScore: number;
};
export type HangmanPuzzle = { pattern: Array<string | null>; errors: number; maxErrors: number; hint: string; testament: string | null };
export type SwapPuzzle = { side: number; order: number[]; imageUrl: string | null; title: string };
export type MemoryPuzzle = { cards: Array<{ pair: number; text: string }> };
export type VersePuzzle = { reference: string; chips: string[]; length: number; words: string[] };
export type MazePuzzle = { width: number; height: number; cells: number[] };

export type AnagramPuzzle = { letters: string[]; length: number; hint: string; attempts: number };
export type BooksPuzzle = { books: string[] };
export type TestamentPuzzle = { items: string[] };
export type BlitzPuzzle = { statements: Array<{ question: string; answer: string }> };
export type BlanksPart = { text: string; blank: number | null; prefix?: string; suffix?: string };
export type BlanksPuzzle = { reference: string; parts: BlanksPart[]; options: string[] };
export type WhoAmIPuzzle = { clue: string; shown: number; total: number; options: string[] };

/** Passo a passo no servidor (anagrama: palpites; quem sou eu?: dicas e resposta). */
export type ActResult = { status: 'playing' | 'won' | 'lost'; cell?: [number, number]; hintsLeft?: number; attemptsLeft?: number; clue?: string; shown?: number; total?: number; answer?: string; result?: MiniGameResult };

export const actMiniGame = (runId: string, body: object) =>
  apiRequest<ActResult>(`/minigames/runs/${runId}/act`, { method: 'POST', body: JSON.stringify(body) }, 'Não foi possível conferir a jogada.');

export type TimelinePuzzle = { items: Array<{ id: string; label: string; emoji: string }> };
export type MapPuzzle = { places: string[]; bounds: { west: number; east: number; south: number; north: number } };
export type LineagePuzzle = { fathers: string[]; sons: string[] };
export type ChainPuzzle = { from: string; to: string; edges: Array<[string, string, string, string]> };
export type CrosswordPuzzle = { rows: number; cols: number; open: number[][]; words: Array<{ number: number; row: number; col: number; across: boolean; length: number; clue: string }> };

export type MiniGameDesign = { gameId: string; coverUrl: string | null; backgroundUrl: string | null };

/** Painel: salva a capa do cartão e o fundo da tela de um mini game (vazio limpa). */
export const saveMiniGameDesign = (gameId: string, input: { coverUrl?: string | null; backgroundUrl?: string | null }) =>
  apiRequest<MiniGameDesign>(`/minigames/admin/${gameId}/design`, { method: 'PUT', body: JSON.stringify(input) }, 'Não foi possível salvar as imagens do jogo.');
