import { lettersOnly, shuffled, type Outcome, type Random } from "./common";
import { beginClock, clockAlmostOver, clockExpired, elapsedSeconds, endClock, LEVEL_LABEL, LEVEL_SCALE, maxScoreOf, newClock, speedFactor, turnShare, TurnError, type Clock, type Level, type TurnResult } from "./turns";

/**
 * Versículo em pedaços: as palavras vêm embaralhadas e o jogador toca nelas na ordem certa. O servidor confere cada toque
 * (a ordem nunca vai para a tela). Fácil: versículos curtos; difícil: longos e com menos ajuda.
 */
export type VerseSource = { verse: string; reference: string; title: string; imageUrl: string | null };

/** Versículos que cabem na tela: de 6 a 22 palavras. */
export function verseWords(verse: string): string[] {
  return verse.trim().split(/\s+/).filter(Boolean);
}

export const usableVerse = (source: { verse: string }) => {
  const count = verseWords(source.verse).length;
  return count >= 6 && count <= 22;
};

export const ROUND_CHOICES = [1, 3, 5] as const;
export const TIME_CHOICES = [30, 60, 90, 120, 180] as const;
export const VERSE_LEVELS: Record<Level, { minWords: number; maxWords: number; hints: number }> = {
  facil: { minWords: 6, maxWords: 11, hints: 3 },
  medio: { minWords: 9, maxWords: 16, hints: 2 },
  dificil: { minWords: 14, maxWords: 22, hints: 1 },
};

export type VerseRound = { words: string[]; chips: string[]; reference: string; title: string; imageUrl: string | null };
export type VerseState = {
  seed: number;
  level: Level;
  clock: Clock;
  rounds: VerseRound[];
  current: number;
  /** Quantas palavras já foram postas no turno e quais fichas foram usadas. */
  next: number;
  used: number[];
  errors: number;
  hinted: number;
  results: TurnResult[];
};
export type VersePuzzle = { round: number; rounds: number; reference: string; chips: string[]; length: number; hintsLeft: number; timePerRound: number | null; level: Level; maxScore: number };

const same = (a: string, b: string) => lettersOnly(a) === lettersOnly(b) && lettersOnly(a) !== "";

export function pickVerseRounds(random: Random, sources: VerseSource[], level: Level, count: number, avoid: readonly string[]): VerseRound[] {
  const config = VERSE_LEVELS[level];
  const recent = new Set(avoid);
  const usable = sources.filter((source) => {
    const length = verseWords(source.verse).length;
    return length >= config.minWords && length <= config.maxWords;
  });
  const order = [...shuffled(random, usable.filter((source) => !recent.has(source.reference))), ...shuffled(random, usable.filter((source) => recent.has(source.reference)))];
  return order.slice(0, count).map((source) => {
    const words = verseWords(source.verse);
    let chips = shuffled(random, words);
    while (chips.length > 1 && chips.every((word, index) => word === words[index])) chips = shuffled(random, words);
    return { words, chips, reference: source.reference, title: source.title, imageUrl: source.imageUrl };
  });
}

export const newVerse = (seed: number, rounds: VerseRound[], level: Level, timePerRound: number | null, now: number): VerseState => ({
  seed,
  level,
  clock: newClock(timePerRound, now),
  rounds,
  current: 0,
  next: 0,
  used: [],
  errors: 0,
  hinted: 0,
  results: [],
});

export function publicVerse(state: VerseState): VersePuzzle {
  const round = state.rounds[state.current];
  return { round: state.current, rounds: state.rounds.length, reference: round.reference, chips: round.chips, length: round.words.length, hintsLeft: VERSE_LEVELS[state.level].hints - state.hinted, timePerRound: state.clock.timePerTurn, level: state.level, maxScore: maxScoreOf(state.level) };
}

/** Pontos de um versículo (antes do fator da dificuldade): 60% pela precisão (cada erro tira 8%, cada dica 12%) e 40% pela rapidez (3 s por palavra). */
export function verseTurnPoints(rounds: number, words: number, errors: number, hinted: number, seconds: number, timed: boolean): number {
  const accuracy = Math.max(0, 1 - errors * 0.08 - hinted * 0.12);
  return Math.round(turnShare(rounds, timed) * (0.6 * accuracy + 0.4 * speedFactor(seconds, 3 * words)));
}

export type VerseAction = { type: "tap"; index: number } | { type: "hint" } | { type: "skip" } | { type: "timeout" } | { type: "begin" };
export type VerseEnd = { right: boolean; timedOut: boolean; reference: string; text: string; title: string; imageUrl: string | null; errors: number; points: number };
export type VerseEvent =
  | { kind: "begin" }
  | { kind: "tap"; index: number; right: boolean; errors: number }
  | { kind: "hint"; index: number; hintsLeft: number }
  | { kind: "end"; end: VerseEnd; next: VersePuzzle | null };

export function playVerse(state: VerseState, action: VerseAction, now: number): { state: VerseState; event: VerseEvent; done: boolean } {
  const round = state.rounds[state.current];
  if (!round) throw new TurnError("A partida já terminou");
  if (action.type === "begin") return { state: { ...state, clock: beginClock(state.clock, now) }, event: { kind: "begin" }, done: false };
  if (action.type === "timeout" && !clockAlmostOver(state.clock, now)) throw new TurnError("Ainda há tempo");

  const finish = (right: boolean, timedOut: boolean, errors: number, hinted: number) => {
    const seconds = Math.min(elapsedSeconds(state.clock, now), state.clock.timePerTurn ?? Infinity);
    const points = right ? verseTurnPoints(state.rounds.length, round.words.length, errors, hinted, seconds, state.clock.timePerTurn !== null) : 0;
    const results = [...state.results, { label: round.reference, solved: right, timedOut, points, seconds: Math.round(seconds) }];
    const current = state.current + 1;
    const next: VerseState = { ...state, results, current, next: 0, used: [], errors: 0, hinted: 0, clock: endClock(state.clock, now) };
    const done = current >= state.rounds.length;
    const end: VerseEnd = { right, timedOut, reference: round.reference, text: round.words.join(" "), title: round.title, imageUrl: round.imageUrl, errors, points };
    return { state: next, event: { kind: "end", end, next: done ? null : publicVerse(next) } as VerseEvent, done };
  };

  if (clockExpired(state.clock, now) || action.type === "timeout") return finish(false, true, state.errors, state.hinted);
  if (action.type === "skip") return finish(false, false, state.errors, state.hinted);

  const expected = round.words[state.next];
  if (action.type === "hint") {
    if (state.hinted >= VERSE_LEVELS[state.level].hints) throw new TurnError("Acabaram as dicas deste versículo");
    const index = round.chips.findIndex((chip, at) => !state.used.includes(at) && same(chip, expected));
    return { state: { ...state, hinted: state.hinted + 1 }, event: { kind: "hint", index, hintsLeft: VERSE_LEVELS[state.level].hints - state.hinted - 1 }, done: false };
  }

  const { index } = action;
  if (!Number.isInteger(index) || index < 0 || index >= round.chips.length || state.used.includes(index)) throw new TurnError("Jogada inválida");
  // Palavras iguais (como "o" e "o") valem em qualquer ordem entre si.
  if (!same(round.chips[index], expected)) {
    const errors = state.errors + 1;
    return { state: { ...state, errors }, event: { kind: "tap", index, right: false, errors }, done: false };
  }
  const used = [...state.used, index];
  const next = state.next + 1;
  if (next >= round.words.length) return finish(true, false, state.errors, state.hinted);
  return { state: { ...state, used, next }, event: { kind: "tap", index, right: true, errors: state.errors }, done: false };
}

export function verseOutcome(state: VerseState): Outcome {
  const right = state.results.filter((result) => result.solved).length;
  const total = state.rounds.length;
  const score = Math.round(state.results.reduce((sum, result) => sum + result.points, 0) * LEVEL_SCALE[state.level]);
  return { solved: right >= Math.ceil(total / 2), score, detail: `${right} de ${total} ${total === 1 ? "versículo" : "versículos"} · ${LEVEL_LABEL[state.level]}` };
}
