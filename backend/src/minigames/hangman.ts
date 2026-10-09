import { lettersOnly, plainText, rng, shuffled, type Outcome } from "./common";
import { beginClock, clockAlmostOver, clockExpired, elapsedSeconds, endClock, LEVEL_LABEL, LEVEL_SCALE, maxScoreOf, newClock, speedFactor, turnShare, TurnError, type Clock, type Level, type TurnResult } from "./turns";

/**
 * Forca em turnos: cada turno é uma palavra (personagem, lugar...) com dica; as vidas dependem da dificuldade e o tempo por palavra é opcional.
 * A palavra nunca sai do servidor; cada palpite volta com o que foi revelado.
 */
export const HANGMAN_ERRORS = 6;
export const ROUND_CHOICES = [1, 3, 5] as const;
export const TIME_CHOICES = [30, 45, 60, 90, 120] as const;

export type HangmanState = { word: string; guessed: string[]; errors: number };

/** Letra sem acento: "Á" → "A". Qualquer outra coisa (número, símbolo) não vale como palpite. */
export function guessLetter(input: string): string | null {
  const letter = lettersOnly(input);
  return letter.length === 1 ? letter : null;
}

/** O que o jogador vê: cada posição com a letra original (com acento) ou null; espaços e hífens aparecem sempre. */
export function pattern(state: HangmanState): Array<string | null> {
  return [...state.word].map((char) => {
    const base = lettersOnly(char);
    if (base === "") return char;
    return state.guessed.includes(base) ? char : null;
  });
}

export const isWon = (state: HangmanState) => pattern(state).every((char) => char !== null);
export const isLost = (state: HangmanState, lives = HANGMAN_ERRORS) => state.errors >= lives;

/** Aplica um palpite (repetido não conta). */
export function applyGuess(state: HangmanState, letter: string, lives = HANGMAN_ERRORS): HangmanState {
  if (isWon(state) || isLost(state, lives) || state.guessed.includes(letter)) return state;
  const hit = lettersOnly(state.word).includes(letter);
  return { ...state, guessed: [...state.guessed, letter], errors: state.errors + (hit ? 0 : 1) };
}

export const HANGMAN_LEVELS: Record<Level, { minLength: number; maxLength: number; lives: number; hints: number; showImage: boolean }> = {
  facil: { minLength: 3, maxLength: 6, lives: 8, hints: 2, showImage: true },
  medio: { minLength: 5, maxLength: 9, lives: 6, hints: 2, showImage: true },
  dificil: { minLength: 7, maxLength: 14, lives: 5, hints: 1, showImage: false },
};

export type HangmanSource = { name: string; summary: string; testament: string | null; imageUrl: string | null };
export type HangmanRound = { word: string; hint: string; testament: string | null; imageUrl: string | null };

export type HangmanGameState = {
  seed: number;
  level: Level;
  lives: number;
  clock: Clock;
  rounds: HangmanRound[];
  current: number;
  guessed: string[];
  errors: number;
  /** Letras reveladas por dica neste turno. */
  hinted: number;
  results: TurnResult[];
};

/** O turno como a tela vê (a palavra nunca vai; só o que já foi revelado). */
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
  level: Level;
  maxScore: number;
};

const testamentLabel = (testament: string | null) => (testament === "OLD" ? "Antigo Testamento" : testament === "NEW" ? "Novo Testamento" : null);

/** Sorteia as palavras (no tamanho da dificuldade), deixando por último as das partidas recentes. */
export function pickHangmanRounds(random: () => number, sources: HangmanSource[], level: Level, count: number, avoid: readonly string[]): HangmanRound[] {
  const config = HANGMAN_LEVELS[level];
  const recent = new Set(avoid.map(lettersOnly));
  const fits = sources.filter((source) => {
    const length = lettersOnly(source.name).length;
    return length >= config.minLength && length <= config.maxLength && source.name.length <= 20;
  });
  const unique = fits.filter((source, index) => fits.findIndex((other) => lettersOnly(other.name) === lettersOnly(source.name)) === index);
  const ordered = [...shuffled(random, unique.filter((s) => !recent.has(lettersOnly(s.name)))), ...shuffled(random, unique.filter((s) => recent.has(lettersOnly(s.name))))];
  return ordered.slice(0, count).map((source) => ({ word: source.name, hint: maskHint(source.summary, source.name), testament: testamentLabel(source.testament), imageUrl: source.imageUrl }));
}

export const newHangman = (seed: number, rounds: HangmanRound[], level: Level, timePerRound: number | null, now: number): HangmanGameState => ({
  seed,
  level,
  lives: HANGMAN_LEVELS[level].lives,
  clock: newClock(timePerRound, now),
  rounds,
  current: 0,
  guessed: [],
  errors: 0,
  hinted: 0,
  results: [],
});

const wordState = (state: HangmanGameState): HangmanState => ({ word: state.rounds[state.current].word, guessed: state.guessed, errors: state.errors });

export function publicHangman(state: HangmanGameState): HangmanPuzzle {
  const round = state.rounds[state.current];
  const config = HANGMAN_LEVELS[state.level];
  return {
    round: state.current,
    rounds: state.rounds.length,
    pattern: pattern(wordState(state)),
    errors: state.errors,
    maxErrors: state.lives,
    hint: round.hint,
    testament: round.testament,
    imageUrl: config.showImage ? round.imageUrl : null,
    hintsLeft: config.hints - state.hinted,
    timePerRound: state.clock.timePerTurn,
    level: state.level,
    maxScore: maxScoreOf(state.level),
  };
}

/** Pontos de uma palavra ganha (antes do fator da dificuldade): 70% pelas vidas que sobraram, 30% pela rapidez, menos 15% por letra revelada. */
export function hangmanTurnPoints(rounds: number, lives: number, errors: number, hinted: number, seconds: number, letters: number, timed: boolean): number {
  const share = turnShare(rounds, timed);
  const accuracy = Math.max(0, (lives - errors) / lives);
  const par = 4 * letters + 10;
  return Math.max(0, Math.round(share * (0.7 * accuracy + 0.3 * speedFactor(seconds, par) - 0.15 * hinted)));
}

export type HangmanAction = { type: "guess"; letter: string } | { type: "reveal" } | { type: "skip" } | { type: "timeout" } | { type: "begin" };
export type HangmanEnd = { right: boolean; timedOut: boolean; answer: string; imageUrl: string | null; points: number };
export type HangmanEvent =
  | { kind: "begin" }
  | { kind: "guess"; pattern: Array<string | null>; errors: number; hit: boolean }
  | { kind: "reveal"; pattern: Array<string | null>; hintsLeft: number }
  | { kind: "end"; end: HangmanEnd; pattern: Array<string | null>; errors: number; next: HangmanPuzzle | null };

/** Aplica uma jogada. Se o tempo da palavra já venceu, ela termina como "tempo esgotado" seja qual for a jogada. */
export function playHangman(state: HangmanGameState, action: HangmanAction, now: number): { state: HangmanGameState; event: HangmanEvent; done: boolean } {
  const round = state.rounds[state.current];
  if (!round) throw new TurnError("A partida já terminou");
  if (action.type === "begin") return { state: { ...state, clock: beginClock(state.clock, now) }, event: { kind: "begin" }, done: false };
  if (action.type === "timeout" && !clockAlmostOver(state.clock, now)) throw new TurnError("Ainda há tempo");
  const config = HANGMAN_LEVELS[state.level];
  const letters = lettersOnly(round.word).length;

  const finish = (right: boolean, timedOut: boolean, guessed: string[], errors: number, hinted = state.hinted): ReturnType<typeof playHangman> => {
    const seconds = Math.min(elapsedSeconds(state.clock, now), state.clock.timePerTurn ?? Infinity);
    const points = right ? hangmanTurnPoints(state.rounds.length, state.lives, errors, hinted, seconds, letters, state.clock.timePerTurn !== null) : 0;
    const results = [...state.results, { label: round.word, solved: right, timedOut, points, seconds: Math.round(seconds) }];
    const current = state.current + 1;
    const next: HangmanGameState = { ...state, results, current, guessed: [], errors: 0, hinted: 0, clock: endClock(state.clock, now) };
    const done = current >= state.rounds.length;
    const shown = pattern({ word: round.word, guessed: right ? guessed : round.word.split("").map(lettersOnly), errors });
    return { state: next, event: { kind: "end", end: { right, timedOut, answer: round.word, imageUrl: round.imageUrl, points }, pattern: shown, errors, next: done ? null : publicHangman(next) }, done };
  };

  if (clockExpired(state.clock, now) || action.type === "timeout") return finish(false, true, state.guessed, state.errors);
  if (action.type === "skip") return finish(false, false, state.guessed, state.errors);

  if (action.type === "reveal") {
    if (state.hinted >= config.hints) throw new TurnError("Acabaram as dicas desta palavra");
    const open = shuffled(rng((state.seed + state.current * 31 + state.hinted) >>> 0), [...new Set(lettersOnly(round.word))].filter((letter) => !state.guessed.includes(letter)));
    if (open.length === 0) throw new TurnError("Não há mais letras");
    const guessed = [...state.guessed, open[0]];
    const next = { ...state, guessed, hinted: state.hinted + 1 };
    if (isWon({ word: round.word, guessed, errors: state.errors })) return finish(true, false, guessed, state.errors, next.hinted);
    return { state: next, event: { kind: "reveal", pattern: pattern(wordState(next)), hintsLeft: config.hints - next.hinted }, done: false };
  }

  const letter = lettersOnly(action.letter);
  if (letter.length !== 1) throw new TurnError("Escolha uma letra");
  if (state.guessed.includes(letter)) throw new TurnError("Essa letra já foi");
  const after = applyGuess(wordState(state), letter, state.lives);
  const hit = after.errors === state.errors;
  if (isWon(after)) return finish(true, false, after.guessed, after.errors);
  if (isLost(after, state.lives)) return finish(false, false, after.guessed, after.errors);
  return { state: { ...state, guessed: after.guessed, errors: after.errors }, event: { kind: "guess", pattern: pattern(after), errors: after.errors, hit }, done: false };

}

/** Resultado da partida: soma das palavras vezes o fator da dificuldade; vale como vitória acertar metade ou mais. */
export function hangmanGameOutcome(state: HangmanGameState): Outcome {
  const solvedCount = state.results.filter((result) => result.solved).length;
  const total = state.rounds.length;
  const score = Math.round(state.results.reduce((sum, result) => sum + result.points, 0) * LEVEL_SCALE[state.level]);
  return { solved: solvedCount >= Math.ceil(total / 2), score, detail: `${solvedCount} de ${total} ${total === 1 ? "palavra" : "palavras"} · ${LEVEL_LABEL[state.level]}` };
}

/** Dica sem entregar a resposta: troca cada pedaço do nome por traços. */
export function maskHint(hint: string, name: string): string {
  let text = plainText(hint);
  for (const part of [name, ...name.split(/\s+/)].filter((piece) => piece.length >= 3)) {
    text = text.replace(new RegExp(part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "___");
  }
  return text;
}
