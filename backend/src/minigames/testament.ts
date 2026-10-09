import { rng, shuffled, type Outcome, type Random } from "./common";
import { BOOKS, bookTestament, FAMOUS_BOOKS } from "./books";
import { beginClock, clockAlmostOver, clockExpired, elapsedSeconds, endClock, LEVEL_LABEL, LEVEL_SCALE, maxScoreOf, newClock, speedFactor, turnShare, TurnError, type Clock, type Level, type TurnResult } from "./turns";

/**
 * Antigo ou Novo?: um item por vez (livro ou personagem), de que Testamento é? O servidor confere cada resposta e já devolve o certo.
 * Fácil: livros conhecidos; médio: todos os livros; difícil: só os menos conhecidos. Tempo por item opcional.
 */
export const COUNT_CHOICES = [10, 15, 20] as const;
export const TIME_CHOICES = [5, 8, 12, 15] as const;
export type Testament = "OLD" | "NEW";
export type TestamentItem = { text: string; answer: Testament; kind: "book" | "person"; imageUrl: string | null };
export type TestamentPerson = { name: string; testament: string | null; imageUrl: string | null };

export type TestamentState = { seed: number; level: Level; clock: Clock; items: TestamentItem[]; current: number; results: Array<TurnResult & { answer: Testament }> };
export type TestamentPuzzle = { index: number; total: number; text: string; kind: "book" | "person"; timePerItem: number | null; level: Level; maxScore: number };

/** Sorteia os itens: 40% personagens (que saíram menos nas últimas partidas) e o resto livros do nível. */
export function pickTestamentItems(random: Random, people: TestamentPerson[], level: Level, count: number, avoid: readonly string[]): TestamentItem[] {
  const recent = new Set(avoid);
  const bookPool = BOOKS.filter((book) => (level === "facil" ? FAMOUS_BOOKS.has(book) : level === "dificil" ? !FAMOUS_BOOKS.has(book) : true));
  const known = people.filter((person): person is TestamentPerson & { testament: Testament } => person.testament === "OLD" || person.testament === "NEW");
  const peopleCount = Math.min(known.length, Math.round(count * 0.4));
  const order = <T extends { key: string }>(items: T[]) => [...shuffled(random, items.filter((item) => !recent.has(item.key))), ...shuffled(random, items.filter((item) => recent.has(item.key)))];
  const persons: TestamentItem[] = order(known.map((person) => ({ key: person.name, person })))
    .slice(0, peopleCount)
    .map(({ person }) => ({ text: person.name, answer: person.testament, kind: "person", imageUrl: person.imageUrl }));
  const books: TestamentItem[] = order(bookPool.map((book) => ({ key: book })))
    .slice(0, count - persons.length)
    .map(({ key }) => ({ text: key, answer: bookTestament(key)!, kind: "book", imageUrl: null }));
  return shuffled(random, [...persons, ...books]);
}

export function newTestament(seed: number, items: TestamentItem[], level: Level, timePerItem: number | null, now: number): TestamentState {
  return { seed, level, clock: newClock(timePerItem, now), items, current: 0, results: [] };
}

export function publicTestament(state: TestamentState): TestamentPuzzle {
  const item = state.items[state.current];
  return { index: state.current, total: state.items.length, text: item.text, kind: item.kind, timePerItem: state.clock.timePerTurn, level: state.level, maxScore: maxScoreOf(state.level) };
}

export type TestamentAction = { type: "classify"; choice: Testament } | { type: "timeout" } | { type: "begin" };
export type TestamentEnd = { right: boolean; timedOut: boolean; correct: Testament; text: string; imageUrl: string | null; points: number };
export type TestamentEvent = { kind: "begin" } | { kind: "end"; end: TestamentEnd; next: TestamentPuzzle | null };

/** Pontos de um item (antes do fator da dificuldade): 70% por acertar e 30% pela rapidez (3 s de folga por item). */
export const testamentPoints = (total: number, seconds: number, timed: boolean) => Math.round(turnShare(total, timed) * (0.7 + 0.3 * speedFactor(seconds, 3)));

export function playTestament(state: TestamentState, action: TestamentAction, now: number): { state: TestamentState; event: TestamentEvent; done: boolean } {
  const item = state.items[state.current];
  if (!item) throw new TurnError("A partida já terminou");
  if (action.type === "begin") return { state: { ...state, clock: beginClock(state.clock, now) }, event: { kind: "begin" }, done: false };
  if (action.type === "timeout" && !clockAlmostOver(state.clock, now)) throw new TurnError("Ainda há tempo");
  const timedOut = action.type === "timeout" || clockExpired(state.clock, now);
  const right = !timedOut && action.type === "classify" && action.choice === item.answer;
  const seconds = Math.min(elapsedSeconds(state.clock, now), state.clock.timePerTurn ?? Infinity);
  const points = right ? testamentPoints(state.items.length, seconds, state.clock.timePerTurn !== null) : 0;
  const results = [...state.results, { label: item.text, solved: right, timedOut, points, seconds: Math.round(seconds), answer: item.answer }];
  const current = state.current + 1;
  const next: TestamentState = { ...state, results, current, clock: endClock(state.clock, now) };
  const done = current >= state.items.length;
  return { state: next, event: { kind: "end", end: { right, timedOut, correct: item.answer, text: item.text, imageUrl: item.imageUrl, points }, next: done ? null : publicTestament(next) }, done };
}

export function testamentOutcome(state: TestamentState): Outcome {
  const right = state.results.filter((result) => result.solved).length;
  const total = state.items.length;
  const score = Math.round(state.results.reduce((sum, result) => sum + result.points, 0) * LEVEL_SCALE[state.level]);
  return { solved: right >= Math.ceil(total * 0.8), score, detail: `${right} de ${total} certos · ${LEVEL_LABEL[state.level]}` };
}
