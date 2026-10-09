import { lettersOnly, shuffled, type Outcome, type Random } from "./common";
import { verseWords } from "./verse";
import { beginClock, clockAlmostOver, clockExpired, elapsedSeconds, endClock, LEVEL_LABEL, LEVEL_SCALE, maxScoreOf, newClock, speedFactor, turnShare, TurnError, type Clock, type Level, type TurnResult } from "./turns";

/**
 * Complete o versículo: lacunas no versículo e uma lista de palavras (as certas e algumas de enfeite). Uma tentativa por versículo;
 * o servidor confere e mostra o versículo completo. Fácil: 2 lacunas e 2 enfeites; difícil: 4 lacunas e 5 enfeites de tamanho parecido.
 */
export const ROUND_CHOICES = [1, 3, 5] as const;
export const TIME_CHOICES = [30, 45, 60, 90, 120] as const;
export const BLANK_LEVELS: Record<Level, { blanks: number; decoys: number; minWords: number; maxWords: number }> = {
  facil: { blanks: 2, decoys: 2, minWords: 8, maxWords: 14 },
  medio: { blanks: 3, decoys: 3, minWords: 8, maxWords: 20 },
  dificil: { blanks: 4, decoys: 5, minWords: 12, maxWords: 24 },
};

/** Cada palavra do versículo: sem `blank` é texto fixo; com `blank` é uma lacuna (o `prefix` e o `suffix` são a pontuação em volta). */
export type BlanksPart = { text: string; blank: number | null; prefix?: string; suffix?: string };
export type BlanksSource = { verse: string; reference: string; title: string; imageUrl: string | null };
export type BlanksRound = { reference: string; title: string; imageUrl: string | null; text: string; answers: string[]; parts: BlanksPart[]; options: string[] };
export type BlanksState = { seed: number; level: Level; clock: Clock; rounds: BlanksRound[]; current: number; results: TurnResult[] };
export type BlanksPuzzle = { round: number; rounds: number; reference: string; parts: BlanksPart[]; options: string[]; timePerRound: number | null; level: Level; maxScore: number };

const SPLIT = /^([^\p{L}]*)(\p{L}[\p{L}'’-]*)([^\p{L}]*)$/u;
const wordKey = (word: string) => lettersOnly(word);

/** Versículo com palavras suficientes (4 letras ou mais) para as lacunas. */
export const usableForBlanks = (verse: string, blanks = 3) => {
  const words = verseWords(verse);
  return words.length >= 8 && words.length <= 24 && words.filter((word) => wordKey(word).length >= blanks + 1).length >= blanks;
};

function buildRound(random: Random, source: BlanksSource, level: Level, decoyPool: string[]): BlanksRound | null {
  const config = BLANK_LEVELS[level];
  const words = verseWords(source.verse);
  const candidates = words.flatMap((word, index) => (wordKey(word).length >= 4 ? [index] : []));
  // Sorteia sem pôr duas lacunas coladas.
  const picked: number[] = [];
  for (const index of shuffled(random, candidates)) {
    if (picked.length === config.blanks) break;
    if (picked.every((other) => Math.abs(other - index) > 1)) picked.push(index);
  }
  if (picked.length < config.blanks) return null;
  const blanks = picked.sort((a, b) => a - b);
  const pieces = blanks.map((index) => {
    const match = SPLIT.exec(words[index]);
    return { prefix: match?.[1] ?? "", core: match?.[2] ?? words[index], suffix: match?.[3] ?? "" };
  });
  const answers = pieces.map((piece) => piece.core);
  const used = new Set(answers.map(wordKey));
  const average = answers.reduce((sum, answer) => sum + wordKey(answer).length, 0) / answers.length;
  const eligible = decoyPool.filter((word) => wordKey(word).length >= 4 && !used.has(wordKey(word)));
  // No difícil os enfeites têm tamanho parecido com as respostas, para não dar pista.
  const ordered = level === "dificil" ? [...shuffled(random, eligible)].sort((a, b) => Math.abs(wordKey(a).length - average) - Math.abs(wordKey(b).length - average)) : shuffled(random, eligible);
  const seen = new Set<string>();
  const decoys: string[] = [];
  for (const word of ordered) {
    if (decoys.length === config.decoys) break;
    if (seen.has(wordKey(word))) continue;
    seen.add(wordKey(word));
    decoys.push(word);
  }
  const parts: BlanksPart[] = words.map((word, index) => {
    const slot = blanks.indexOf(index);
    return slot >= 0 ? { text: "", blank: slot, prefix: pieces[slot].prefix, suffix: pieces[slot].suffix } : { text: word, blank: null };
  });
  return { reference: source.reference, title: source.title, imageUrl: source.imageUrl, text: words.join(" "), answers, parts, options: shuffled(random, [...answers, ...decoys]) };
}

export function pickBlanksRounds(random: Random, sources: BlanksSource[], level: Level, count: number, avoid: readonly string[], decoyPool: string[]): BlanksRound[] {
  const config = BLANK_LEVELS[level];
  const recent = new Set(avoid);
  const usable = sources.filter((source) => {
    const length = verseWords(source.verse).length;
    return length >= config.minWords && length <= config.maxWords && usableForBlanks(source.verse, config.blanks);
  });
  const order = [...shuffled(random, usable.filter((source) => !recent.has(source.reference))), ...shuffled(random, usable.filter((source) => recent.has(source.reference)))];
  const rounds: BlanksRound[] = [];
  for (const source of order) {
    if (rounds.length === count) break;
    const round = buildRound(random, source, level, decoyPool);
    if (round) rounds.push(round);
  }
  return rounds;
}

export const newBlanks = (seed: number, rounds: BlanksRound[], level: Level, timePerRound: number | null, now: number): BlanksState => ({ seed, level, clock: newClock(timePerRound, now), rounds, current: 0, results: [] });

export function publicBlanks(state: BlanksState): BlanksPuzzle {
  const round = state.rounds[state.current];
  return { round: state.current, rounds: state.rounds.length, reference: round.reference, parts: round.parts, options: round.options, timePerRound: state.clock.timePerTurn, level: state.level, maxScore: maxScoreOf(state.level) };
}

export type BlanksAction = { type: "fill"; fills: string[] } | { type: "skip" } | { type: "timeout" } | { type: "begin" };
export type BlanksEnd = { right: number; total: number; solved: boolean; timedOut: boolean; answers: string[]; fills: string[]; reference: string; text: string; title: string; imageUrl: string | null; points: number };
export type BlanksEvent = { kind: "begin" } | { kind: "end"; end: BlanksEnd; next: BlanksPuzzle | null };

/** Pontos de um versículo (antes do fator da dificuldade): 70% pelas lacunas certas e 30% pela rapidez (só se acertou todas; 6 s por lacuna + 10). */
export function blanksTurnPoints(rounds: number, right: number, total: number, seconds: number, timed: boolean): number {
  const solved = right === total;
  return Math.round(turnShare(rounds, timed) * (0.7 * (right / total) + (solved ? 0.3 * speedFactor(seconds, 6 * total + 10) : 0)));
}

export function playBlanks(state: BlanksState, action: BlanksAction, now: number): { state: BlanksState; event: BlanksEvent; done: boolean } {
  const round = state.rounds[state.current];
  if (!round) throw new TurnError("A partida já terminou");
  if (action.type === "begin") return { state: { ...state, clock: beginClock(state.clock, now) }, event: { kind: "begin" }, done: false };
  if (action.type === "timeout" && !clockAlmostOver(state.clock, now)) throw new TurnError("Ainda há tempo");
  const timedOut = action.type === "timeout" || clockExpired(state.clock, now);
  let fills: string[] = [];
  if (action.type === "fill" && !timedOut) {
    fills = action.fills;
    if (fills.length !== round.answers.length) throw new TurnError("Resposta inválida");
  }
  const right = fills.filter((fill, index) => wordKey(fill) === wordKey(round.answers[index])).length;
  const seconds = Math.min(elapsedSeconds(state.clock, now), state.clock.timePerTurn ?? Infinity);
  const points = timedOut ? 0 : blanksTurnPoints(state.rounds.length, right, round.answers.length, seconds, state.clock.timePerTurn !== null);
  const solved = right === round.answers.length;
  const results = [...state.results, { label: round.reference, solved, timedOut, points, seconds: Math.round(seconds) }];
  const current = state.current + 1;
  const next: BlanksState = { ...state, results, current, clock: endClock(state.clock, now) };
  const done = current >= state.rounds.length;
  const end: BlanksEnd = { right, total: round.answers.length, solved, timedOut, answers: round.answers, fills, reference: round.reference, text: round.text, title: round.title, imageUrl: round.imageUrl, points };
  return { state: next, event: { kind: "end", end, next: done ? null : publicBlanks(next) }, done };
}

export function blanksOutcome(state: BlanksState): Outcome {
  const solvedCount = state.results.filter((result) => result.solved).length;
  const total = state.rounds.length;
  const score = Math.round(state.results.reduce((sum, result) => sum + result.points, 0) * LEVEL_SCALE[state.level]);
  return { solved: solvedCount >= Math.ceil(total / 2), score, detail: `${solvedCount} de ${total} ${total === 1 ? "versículo completo" : "versículos completos"} · ${LEVEL_LABEL[state.level]}` };
}
