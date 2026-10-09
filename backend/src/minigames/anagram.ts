import { lettersOnly, rng, shuffled, type Outcome, type Random } from "./common";
import { maskHint } from "./hangman";

/**
 * Anagrama em turnos: cada turno é um nome com as letras embaralhadas, 3 tentativas e, se o jogador quiser, um tempo por nome.
 * O jogador escolhe a dificuldade (tamanho dos nomes), a quantidade de turnos e o tempo; o servidor guarda os nomes e confere cada passo.
 */
export const ANAGRAM_ATTEMPTS = 3;
export const ROUND_CHOICES = [3, 5, 8, 10] as const;
export const TIME_CHOICES = [20, 30, 45, 60, 90] as const;
/** Folga (segundos) para a rede: o tempo só vence no servidor depois disto. */
export const TIME_GRACE = 3;
/** Pontuação de partida cheia (a soma dos turnos) antes do fator da dificuldade. */
export const ANAGRAM_MAX = 1000;
/** Sem contar o tempo, cada nome vale um pouco menos. */
export const UNTIMED_FACTOR = 0.85;

export type AnagramDifficulty = "facil" | "medio" | "dificil";
export const ANAGRAM_LEVELS: Record<AnagramDifficulty, { label: string; minLength: number; maxLength: number; scale: number; showImage: boolean }> = {
  facil: { label: "Fácil", minLength: 4, maxLength: 6, scale: 0.6, showImage: true },
  medio: { label: "Médio", minLength: 5, maxLength: 8, scale: 0.8, showImage: true },
  dificil: { label: "Difícil", minLength: 7, maxLength: 11, scale: 1, showImage: false },
};

export type AnagramSource = { name: string; summary: string; imageUrl: string | null };
export type AnagramRound = { word: string; hint: string; imageUrl: string | null };
export type RoundResult = { word: string; solved: boolean; timedOut: boolean; attempts: number; seconds: number; points: number };

export type AnagramState = {
  seed: number;
  difficulty: AnagramDifficulty;
  /** Segundos por nome; null = sem tempo. */
  timePerRound: number | null;
  rounds: AnagramRound[];
  current: number;
  /** Palpites errados ou certos já feitos neste nome. */
  attempts: number;
  /** Quando o relógio do nome atual começou (ms); null enquanto o jogador vê o resultado do nome anterior. */
  roundStartedAt: number | null;
  /** Quando o nome anterior terminou (ms): se o jogador nunca avisar que começou, o tempo conta daqui. */
  lastEndedAt: number;
  results: RoundResult[];
};

/** O que a tela recebe de cada turno (o nome nunca vai junto). */
export type AnagramPuzzle = {
  round: number;
  rounds: number;
  letters: string[];
  length: number;
  hint: string;
  /** Retrato do personagem (ou mapa do lugar): só nos níveis em que ajuda. */
  imageUrl: string | null;
  attempts: number;
  timePerRound: number | null;
  difficulty: AnagramDifficulty;
  maxScore: number;
};

export function generateAnagram(seed: number, word: string): string[] {
  const random = rng(seed);
  const letters = [...lettersOnly(word)];
  let mixed = shuffled(random, letters);
  while (letters.length > 1 && mixed.join("") === letters.join("")) mixed = shuffled(random, letters);
  return mixed;
}

/** Palpite certo se as letras (sem acento) formam o nome. */
export const anagramMatches = (state: { word: string }, guess: string) => lettersOnly(guess) === lettersOnly(state.word);

/** Sorteia os nomes da partida (no tamanho da dificuldade), deixando por último os das partidas recentes. */
export function pickRounds(random: Random, sources: AnagramSource[], difficulty: AnagramDifficulty, count: number, avoid: readonly string[]): AnagramRound[] {
  const level = ANAGRAM_LEVELS[difficulty];
  const recent = new Set(avoid.map(lettersOnly));
  const fits = sources.filter((source) => {
    const length = lettersOnly(source.name).length;
    return length >= level.minLength && length <= level.maxLength;
  });
  const unique = fits.filter((source, index) => fits.findIndex((other) => lettersOnly(other.name) === lettersOnly(source.name)) === index);
  const ordered = [...shuffled(random, unique.filter((source) => !recent.has(lettersOnly(source.name)))), ...shuffled(random, unique.filter((source) => recent.has(lettersOnly(source.name))))];
  return ordered.slice(0, count).map((source) => ({ word: source.name, hint: maskHint(source.summary, source.name), imageUrl: source.imageUrl }));
}

export function newAnagram(seed: number, rounds: AnagramRound[], difficulty: AnagramDifficulty, timePerRound: number | null, now: number): AnagramState {
  return { seed, difficulty, timePerRound, rounds, current: 0, attempts: 0, roundStartedAt: now, lastEndedAt: now, results: [] };
}

const roundSeed = (state: AnagramState, index: number) => (state.seed + index * 7919) >>> 0;

/** O turno atual como a tela vê. */
export function publicRound(state: AnagramState): AnagramPuzzle {
  const round = state.rounds[state.current];
  const letters = generateAnagram(roundSeed(state, state.current), round.word);
  const level = ANAGRAM_LEVELS[state.difficulty];
  return {
    round: state.current,
    rounds: state.rounds.length,
    letters,
    length: letters.length,
    hint: round.hint,
    imageUrl: level.showImage ? round.imageUrl : null,
    attempts: ANAGRAM_ATTEMPTS,
    timePerRound: state.timePerRound,
    difficulty: state.difficulty,
    maxScore: Math.round(ANAGRAM_MAX * level.scale),
  };
}

const ATTEMPT_FACTOR = [1, 0.6, 0.3];

/** Pontos de um nome (antes do fator da dificuldade): 70% pelas tentativas e 30% pela rapidez, dentro da fatia do turno. */
export function roundPoints(rounds: number, attempts: number, seconds: number, length: number, timed: boolean): number {
  const share = ANAGRAM_MAX / rounds;
  const accuracy = ATTEMPT_FACTOR[Math.min(Math.max(attempts, 1), ANAGRAM_ATTEMPTS) - 1];
  const par = 3 * length;
  const speed = Math.min(1, Math.max(0, 1 - Math.max(0, seconds - par) / (par * 2)));
  return Math.round(share * (0.7 * accuracy + 0.3 * speed) * (timed ? 1 : UNTIMED_FACTOR));
}

export type AnagramAction = { type: "check"; word: string } | { type: "skip" } | { type: "timeout" } | { type: "begin" };
export type RoundEnd = { right: boolean; timedOut: boolean; answer: string; imageUrl: string | null; points: number };
export type AnagramEvent =
  | { kind: "begin" }
  | { kind: "wrong"; attemptsLeft: number }
  | { kind: "end"; end: RoundEnd; next: AnagramPuzzle | null };

export class AnagramError extends Error {}

/** Aplica uma jogada. Se o tempo do nome já venceu, o nome termina como "tempo esgotado" seja qual for a jogada. */
export function playAnagram(state: AnagramState, action: AnagramAction, now: number): { state: AnagramState; event: AnagramEvent; done: boolean } {
  const round = state.rounds[state.current];
  if (!round) throw new AnagramError("A partida já terminou");
  if (action.type === "begin") {
    return { state: state.roundStartedAt === null ? { ...state, roundStartedAt: now } : state, event: { kind: "begin" }, done: false };
  }
  const startedAt = state.roundStartedAt ?? state.lastEndedAt;
  const elapsed = (now - startedAt) / 1000;
  const limit = state.timePerRound;
  const expired = limit !== null && elapsed > limit + TIME_GRACE;
  if (action.type === "timeout" && !(limit !== null && elapsed >= limit - TIME_GRACE)) throw new AnagramError("Ainda há tempo");

  const finish = (right: boolean, timedOut: boolean, attempts: number): ReturnType<typeof playAnagram> => {
    const seconds = Math.min(elapsed, limit ?? elapsed);
    const length = lettersOnly(round.word).length;
    const points = right ? roundPoints(state.rounds.length, attempts, seconds, length, limit !== null) : 0;
    const results = [...state.results, { word: round.word, solved: right, timedOut, attempts, seconds: Math.round(seconds), points }];
    const current = state.current + 1;
    const next = { ...state, results, current, attempts: 0, roundStartedAt: null, lastEndedAt: now };
    const done = current >= state.rounds.length;
    return { state: next, event: { kind: "end", end: { right, timedOut, answer: round.word, imageUrl: round.imageUrl, points }, next: done ? null : publicRound(next) }, done };
  };

  if (expired || action.type === "timeout") return finish(false, true, state.attempts);
  if (action.type === "skip") return finish(false, false, state.attempts);
  const attempts = state.attempts + 1;
  if (anagramMatches(round, action.word)) return finish(true, false, attempts);
  if (attempts >= ANAGRAM_ATTEMPTS) return finish(false, false, attempts);
  return { state: { ...state, attempts }, event: { kind: "wrong", attemptsLeft: ANAGRAM_ATTEMPTS - attempts }, done: false };
}

/** Resultado da partida: a soma dos nomes vezes o fator da dificuldade. Vale como vitória acertar metade dos nomes (arredondando para cima). */
export function anagramOutcome(state: AnagramState): Outcome {
  const level = ANAGRAM_LEVELS[state.difficulty];
  const correct = state.results.filter((result) => result.solved).length;
  const total = state.rounds.length;
  const score = Math.round(state.results.reduce((sum, result) => sum + result.points, 0) * level.scale);
  return { solved: correct >= Math.ceil(total / 2), score, detail: `${correct} de ${total} ${total === 1 ? "nome" : "nomes"} · ${level.label}` };
}
