import { type Outcome, type Random, shuffled } from "./common";
import { beginClock, clockAlmostOver, clockExpired, elapsedSeconds, endClock, LEVEL_LABEL, LEVEL_SCALE, maxScoreOf, newClock, speedFactor, turnShare, TurnError, type Clock, type Level, type TurnResult } from "./turns";

/**
 * Relâmpago: afirmações tiradas das perguntas do quiz (a resposta mostrada está certa ou errada?). O servidor confere cada uma e já mostra a explicação.
 * A dificuldade escolhe a dificuldade das perguntas; o tempo por afirmação é opcional.
 */
export const COUNT_CHOICES = [10, 15, 20] as const;
export const TIME_CHOICES = [8, 12, 15, 20] as const;

export type QuestionLevel = "EASY" | "MEDIUM" | "HARD" | "VERY_HARD";
export type BlitzQuestion = { text: string; correct: string; wrong: string[]; difficulty: QuestionLevel; explanation: string | null; reference: string | null };
export type BlitzItem = { question: string; shown: string; truth: boolean; correct: string; explanation: string | null; reference: string | null };
export type BlitzState = { seed: number; level: Level; clock: Clock; items: BlitzItem[]; current: number; results: TurnResult[] };
export type BlitzPuzzle = { index: number; total: number; question: string; answer: string; timePerItem: number | null; level: Level; maxScore: number };

const LEVEL_QUESTIONS: Record<Level, QuestionLevel[]> = { facil: ["EASY"], medio: ["MEDIUM", "EASY"], dificil: ["HARD", "VERY_HARD"] };

/** Sorteia as afirmações (metade verdadeiras), deixando por último as perguntas das partidas recentes e completando com outras se faltarem. */
export function pickBlitzItems(random: Random, questions: BlitzQuestion[], level: Level, count: number, avoid: readonly string[]): BlitzItem[] {
  const recent = new Set(avoid);
  const wanted = LEVEL_QUESTIONS[level];
  const inLevel = questions.filter((question) => wanted.includes(question.difficulty));
  const others = questions.filter((question) => !wanted.includes(question.difficulty));
  const order = (items: BlitzQuestion[]) => [...shuffled(random, items.filter((item) => !recent.has(item.text))), ...shuffled(random, items.filter((item) => recent.has(item.text)))];
  const chosen = [...order(inLevel), ...order(others)].slice(0, count);
  const flags = shuffled(random, chosen.map((_, index) => index < Math.ceil(chosen.length / 2)));
  return chosen.map((question, index) => ({
    question: question.text,
    truth: flags[index],
    shown: flags[index] ? question.correct : shuffled(random, question.wrong)[0],
    correct: question.correct,
    explanation: question.explanation,
    reference: question.reference,
  }));
}

export const newBlitz = (seed: number, items: BlitzItem[], level: Level, timePerItem: number | null, now: number): BlitzState => ({ seed, level, clock: newClock(timePerItem, now), items, current: 0, results: [] });

export function publicBlitz(state: BlitzState): BlitzPuzzle {
  const item = state.items[state.current];
  return { index: state.current, total: state.items.length, question: item.question, answer: item.shown, timePerItem: state.clock.timePerTurn, level: state.level, maxScore: maxScoreOf(state.level) };
}

export type BlitzAction = { type: "judge"; value: boolean } | { type: "timeout" } | { type: "begin" };
export type BlitzEnd = { right: boolean; timedOut: boolean; truth: boolean; correct: string; question: string; explanation: string | null; reference: string | null; points: number };
export type BlitzEvent = { kind: "begin" } | { kind: "end"; end: BlitzEnd; next: BlitzPuzzle | null };

/** Pontos de uma afirmação (antes do fator da dificuldade): 70% por acertar e 30% pela rapidez (5 s de folga para ler). */
export const blitzPoints = (total: number, seconds: number, timed: boolean) => Math.round(turnShare(total, timed) * (0.7 + 0.3 * speedFactor(seconds, 5)));

export function playBlitz(state: BlitzState, action: BlitzAction, now: number): { state: BlitzState; event: BlitzEvent; done: boolean } {
  const item = state.items[state.current];
  if (!item) throw new TurnError("A partida já terminou");
  if (action.type === "begin") return { state: { ...state, clock: beginClock(state.clock, now) }, event: { kind: "begin" }, done: false };
  if (action.type === "timeout" && !clockAlmostOver(state.clock, now)) throw new TurnError("Ainda há tempo");
  const timedOut = action.type === "timeout" || clockExpired(state.clock, now);
  const right = !timedOut && action.type === "judge" && action.value === item.truth;
  const seconds = Math.min(elapsedSeconds(state.clock, now), state.clock.timePerTurn ?? Infinity);
  const points = right ? blitzPoints(state.items.length, seconds, state.clock.timePerTurn !== null) : 0;
  const results = [...state.results, { label: item.question, solved: right, timedOut, points, seconds: Math.round(seconds) }];
  const current = state.current + 1;
  const next: BlitzState = { ...state, results, current, clock: endClock(state.clock, now) };
  const done = current >= state.items.length;
  return {
    state: next,
    event: { kind: "end", end: { right, timedOut, truth: item.truth, correct: item.correct, question: item.question, explanation: item.explanation, reference: item.reference, points }, next: done ? null : publicBlitz(next) },
    done,
  };
}

export function blitzOutcome(state: BlitzState): Outcome {
  const right = state.results.filter((result) => result.solved).length;
  const total = state.items.length;
  const score = Math.round(state.results.reduce((sum, result) => sum + result.points, 0) * LEVEL_SCALE[state.level]);
  return { solved: right >= Math.ceil(total * 0.8), score, detail: `${right} de ${total} certas · ${LEVEL_LABEL[state.level]}` };
}
