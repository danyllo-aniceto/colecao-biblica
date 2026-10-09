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
  /** Gabarito depois do fim: no caça-palavras, onde estavam as palavras que faltaram; nas palavras cruzadas, os nomes e as fotos. O formato é de cada jogo. */
  reveal?: unknown;
};

export type StartedRun<P> = { runId: string; game: string; puzzle: P };

/** `options` são as escolhas da tela de preparo (ex.: dificuldade e tema do caça-palavras). */
export const startMiniGame = <P>(game: string, options?: object) =>
  apiRequest<StartedRun<P>>(`/minigames/${game}/start`, { method: 'POST', body: JSON.stringify(options ?? {}) }, 'Não foi possível começar o jogo.');

export const finishMiniGame = (runId: string, answer: object) =>
  apiRequest<MiniGameResult>(`/minigames/runs/${runId}/finish`, { method: 'POST', body: JSON.stringify(answer) }, 'Não foi possível conferir a partida.');

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
export type TurnLevel = 'facil' | 'medio' | 'dificil';
export type HangmanPuzzle = {
  round: number;
  rounds: number;
  pattern: Array<string | null>;
  errors: number;
  maxErrors: number;
  hint: string;
  testament: string | null;
  imageUrl: string | null;
  hintsLeft: number;
  timePerRound: number | null;
  level: TurnLevel;
  maxScore: number;
};
export type HangmanEnd = { right: boolean; timedOut: boolean; answer: string; imageUrl: string | null; points: number };
export type HangmanEvent =
  | { kind: 'begin' }
  | { kind: 'guess'; pattern: Array<string | null>; errors: number; hit: boolean }
  | { kind: 'reveal'; pattern: Array<string | null>; hintsLeft: number }
  | { kind: 'end'; end: HangmanEnd; pattern: Array<string | null>; errors: number; next: HangmanPuzzle | null };
export type SizeLevel = TurnLevel | 'mestre';
export type SwapPuzzle = {
  side: number;
  order: number[];
  imageUrl: string | null;
  title: string;
  kind: 'character' | 'place' | 'none';
  level: SizeLevel;
  /** Segundos para montar tudo; null = sem tempo. */
  timeLimit: number | null;
  hintsLeft: number;
  /** Quantas vezes ainda pode ver a imagem inteira (null = sempre à mostra). */
  peeksLeft: number | null;
  peekPenalty: number;
  hintPenalty: number;
  numbers: boolean;
  par: number;
  maxScore: number;
};
export type SwapEvent = { kind: 'hint'; swap: [number, number]; left: number } | { kind: 'reference'; left: number | null };
/** Depois do fim: o que era a imagem. */
export type SwapReveal = { title: string; imageUrl: string | null; summary: string; kind: 'character' | 'place' | 'none' };
export type MemoryCardData = { pair: number; text: string; imageUrl: string | null };
export type MemoryPuzzle = {
  cards: MemoryCardData[];
  cols: number;
  level: SizeLevel;
  pairs: number;
  labels: string[];
  /** Segundos com todas as cartas viradas para cima no começo. */
  peek: number;
  timeLimit: number | null;
  par: number;
  maxScore: number;
};
export type VersePuzzle = { round: number; rounds: number; reference: string; chips: string[]; length: number; hintsLeft: number; timePerRound: number | null; level: TurnLevel; maxScore: number };
export type VerseEnd = { right: boolean; timedOut: boolean; reference: string; text: string; title: string; imageUrl: string | null; errors: number; points: number };
export type VerseEvent =
  | { kind: 'begin' }
  | { kind: 'tap'; index: number; right: boolean; errors: number }
  | { kind: 'hint'; index: number; hintsLeft: number }
  | { kind: 'end'; end: VerseEnd; next: VersePuzzle | null };
export type MazePuzzle = { width: number; height: number; cells: number[] };

export type AnagramDifficulty = 'facil' | 'medio' | 'dificil';
/** Um turno do anagrama (o nome nunca vem junto). */
export type AnagramPuzzle = {
  round: number;
  rounds: number;
  letters: string[];
  length: number;
  hint: string;
  imageUrl: string | null;
  attempts: number;
  /** Segundos por nome; null = sem tempo. */
  timePerRound: number | null;
  difficulty: AnagramDifficulty;
  maxScore: number;
};
export type AnagramRoundEnd = { right: boolean; timedOut: boolean; answer: string; imageUrl: string | null; points: number };
export type AnagramEvent = { kind: 'begin' } | { kind: 'wrong'; attemptsLeft: number } | { kind: 'end'; end: AnagramRoundEnd; next: AnagramPuzzle | null };
export type BooksPuzzle = {
  round: number;
  rounds: number;
  books: Array<{ name: string; testament: 'OLD' | 'NEW' | null }>;
  timePerRound: number | null;
  level: TurnLevel;
  maxScore: number;
};
export type BooksEnd = { right: number; total: number; solved: boolean; timedOut: boolean; correct: string[]; points: number };
export type BooksEvent = { kind: 'begin' } | { kind: 'end'; end: BooksEnd; next: BooksPuzzle | null };
export type TestamentPuzzle = { index: number; total: number; text: string; kind: 'book' | 'person'; timePerItem: number | null; level: TurnLevel; maxScore: number };
export type TestamentEnd = { right: boolean; timedOut: boolean; correct: 'OLD' | 'NEW'; text: string; imageUrl: string | null; points: number };
export type TestamentEvent = { kind: 'begin' } | { kind: 'end'; end: TestamentEnd; next: TestamentPuzzle | null };
export type BlitzPuzzle = { index: number; total: number; question: string; answer: string; timePerItem: number | null; level: TurnLevel; maxScore: number };
export type BlitzEnd = { right: boolean; timedOut: boolean; truth: boolean; correct: string; question: string; explanation: string | null; reference: string | null; points: number };
export type BlitzEvent = { kind: 'begin' } | { kind: 'end'; end: BlitzEnd; next: BlitzPuzzle | null };
export type BlanksPart = { text: string; blank: number | null; prefix?: string; suffix?: string };
export type BlanksPuzzle = { round: number; rounds: number; reference: string; parts: BlanksPart[]; options: string[]; timePerRound: number | null; level: TurnLevel; maxScore: number };
export type BlanksEnd = { right: number; total: number; solved: boolean; timedOut: boolean; answers: string[]; fills: string[]; reference: string; text: string; title: string; imageUrl: string | null; points: number };
export type BlanksEvent = { kind: 'begin' } | { kind: 'end'; end: BlanksEnd; next: BlanksPuzzle | null };
export type WhoAmIPuzzle = { round: number; rounds: number; clues: string[]; total: number; options: string[]; timePerRound: number | null; level: TurnLevel; maxScore: number };
export type WhoAmIEnd = { right: boolean; timedOut: boolean; answer: string; imageUrl: string | null; summary: string; shown: number; points: number };
export type WhoAmIEvent = { kind: 'begin' } | { kind: 'hint'; clue: string; shown: number; total: number } | { kind: 'end'; end: WhoAmIEnd; next: WhoAmIPuzzle | null };

/** Passo a passo no servidor (anagrama: palpites; quem sou eu?: dicas e resposta). */
export type ActResult = { status: 'playing' | 'won' | 'lost'; turn?: unknown; cell?: [number, number]; hintsLeft?: number; attemptsLeft?: number; clue?: string; shown?: number; total?: number; answer?: string; result?: MiniGameResult };

export const actMiniGame = (runId: string, body: object) =>
  apiRequest<ActResult>(`/minigames/runs/${runId}/act`, { method: 'POST', body: JSON.stringify(body) }, 'Não foi possível conferir a jogada.');

export type TimelinePuzzle = { items: Array<{ id: string; label: string; emoji: string }> };
export type MapPuzzle = { places: string[]; bounds: { west: number; east: number; south: number; north: number } };
export type LineagePuzzle = { fathers: string[]; sons: string[] };
export type ChainPuzzle = { from: string; to: string; edges: Array<[string, string, string, string]> };
export type CrosswordPuzzle = {
  rows: number;
  cols: number;
  open: number[][];
  words: Array<{ number: number; row: number; col: number; across: boolean; length: number; clue: string }>;
  level: TurnLevel;
  /** Segundos para a cruzada toda; null = sem tempo. */
  timeLimit: number | null;
  checksLeft: number;
  peeksLeft: number;
  par: number;
  maxScore: number;
  checkPenalty: number;
  peekPenalty: number;
};
export type CrosswordEvent = { kind: 'verify'; wrong: Array<[number, number]>; left: number } | { kind: 'peek'; row: number; col: number; letter: string; left: number };
/** Depois do fim: os nomes das respostas (e a foto, quando houver). */
export type CrosswordReveal = Array<{ number: number; across: boolean; label: string; imageUrl: string | null }>;

export type MiniGameDesign = { gameId: string; coverUrl: string | null; backgroundUrl: string | null };

/** Painel: salva a capa do cartão e o fundo da tela de um mini game (vazio limpa). */
export const saveMiniGameDesign = (gameId: string, input: { coverUrl?: string | null; backgroundUrl?: string | null }) =>
  apiRequest<MiniGameDesign>(`/minigames/admin/${gameId}/design`, { method: 'PUT', body: JSON.stringify(input) }, 'Não foi possível salvar as imagens do jogo.');
