import { rng, shuffled, type Outcome, type Random } from "./common";
import { beginClock, clockAlmostOver, clockExpired, elapsedSeconds, endClock, LEVEL_LABEL, LEVEL_SCALE, maxScoreOf, newClock, speedFactor, turnShare, TurnError, type Clock, type Level, type TurnResult } from "./turns";

/** Os 66 livros da Bíblia (protestante), na ordem canônica; os 39 primeiros são do Antigo Testamento. */
export const BOOKS = [
  "Gênesis", "Êxodo", "Levítico", "Números", "Deuteronômio", "Josué", "Juízes", "Rute", "1 Samuel", "2 Samuel", "1 Reis", "2 Reis", "1 Crônicas", "2 Crônicas",
  "Esdras", "Neemias", "Ester", "Jó", "Salmos", "Provérbios", "Eclesiastes", "Cantares", "Isaías", "Jeremias", "Lamentações", "Ezequiel", "Daniel", "Oseias",
  "Joel", "Amós", "Obadias", "Jonas", "Miqueias", "Naum", "Habacuque", "Sofonias", "Ageu", "Zacarias", "Malaquias", "Mateus", "Marcos", "Lucas", "João", "Atos",
  "Romanos", "1 Coríntios", "2 Coríntios", "Gálatas", "Efésios", "Filipenses", "Colossenses", "1 Tessalonicenses", "2 Tessalonicenses", "1 Timóteo", "2 Timóteo",
  "Tito", "Filemom", "Hebreus", "Tiago", "1 Pedro", "2 Pedro", "1 João", "2 João", "3 João", "Judas", "Apocalipse",
] as const;

export const OLD_TESTAMENT_BOOKS = 39;
export const bookTestament = (book: string): "OLD" | "NEW" | null => {
  const index = BOOKS.indexOf(book as (typeof BOOKS)[number]);
  return index < 0 ? null : index < OLD_TESTAMENT_BOOKS ? "OLD" : "NEW";
};

export const bookIndex = (book: string) => BOOKS.indexOf(book as (typeof BOOKS)[number]);

/** Livros mais conhecidos (o fácil do "Antigo ou Novo?" usa só estes). */
export const FAMOUS_BOOKS = new Set<string>([
  "Gênesis", "Êxodo", "Josué", "Juízes", "Rute", "1 Samuel", "2 Samuel", "Ester", "Jó", "Salmos", "Provérbios", "Isaías", "Jeremias", "Daniel", "Jonas",
  "Mateus", "Marcos", "Lucas", "João", "Atos", "Romanos", "1 Coríntios", "Gálatas", "Efésios", "Filipenses", "Tiago", "Hebreus", "Apocalipse",
]);

/**
 * Livros em ordem, em turnos: cada turno é um conjunto de livros embaralhados para pôr na ordem em que aparecem na Bíblia.
 * Fácil: 4 livros bem espalhados (com a dica de Testamento); médio: 6 livros; difícil: 8 livros próximos uns dos outros.
 */
export const ROUND_CHOICES = [1, 3, 5] as const;
export const BOOK_TIME_CHOICES = [30, 60, 90, 120, 180] as const;
export const BOOK_LEVELS: Record<Level, { size: number; hintTestament: boolean }> = {
  facil: { size: 4, hintTestament: true },
  medio: { size: 6, hintTestament: false },
  dificil: { size: 8, hintTestament: false },
};

export type BookOrderState = { seed: number; level: Level; clock: Clock; sets: string[][]; current: number; results: TurnResult[] };
export type BookOrderPuzzle = {
  round: number;
  rounds: number;
  books: Array<{ name: string; testament: "OLD" | "NEW" | null }>;
  timePerRound: number | null;
  level: Level;
  maxScore: number;
};

/** Um conjunto de livros já na ordem certa. */
function pickSet(random: Random, level: Level): string[] {
  const { size } = BOOK_LEVELS[level];
  if (level === "dificil") {
    // Livros próximos: sorteia uma janela de 20 e tira 8.
    const start = Math.floor(random() * (BOOKS.length - 20));
    return shuffled(random, BOOKS.slice(start, start + 20)).slice(0, size).sort((a, b) => bookIndex(a) - bookIndex(b));
  }
  if (level === "facil") {
    // Espalhados: um de cada quarto da Bíblia.
    const chunk = Math.floor(BOOKS.length / size);
    return Array.from({ length: size }, (_, part) => BOOKS[part * chunk + Math.floor(random() * chunk)]).sort((a, b) => bookIndex(a) - bookIndex(b));
  }
  return shuffled(random, BOOKS).slice(0, size).sort((a, b) => bookIndex(a) - bookIndex(b));
}

export function newBookOrder(seed: number, level: Level, rounds: number, timePerRound: number | null, now: number): BookOrderState {
  const random = rng(seed);
  const sets: string[][] = [];
  while (sets.length < rounds) {
    const set = pickSet(random, level);
    // Não repete o mesmo conjunto na partida.
    if (!sets.some((other) => other.join("|") === set.join("|"))) sets.push(set);
  }
  return { seed, level, clock: newClock(timePerRound, now), sets, current: 0, results: [] };
}

/** Os livros do turno embaralhados (nunca já na ordem certa). */
export function publicBookOrder(state: BookOrderState): BookOrderPuzzle {
  const set = state.sets[state.current];
  const random = rng((state.seed + state.current * 104729) >>> 0);
  let mixed = shuffled(random, set);
  while (set.length > 1 && mixed.every((book, index) => book === set[index])) mixed = shuffled(random, set);
  const hint = BOOK_LEVELS[state.level].hintTestament;
  return {
    round: state.current,
    rounds: state.sets.length,
    books: mixed.map((name) => ({ name, testament: hint ? bookTestament(name) : null })),
    timePerRound: state.clock.timePerTurn,
    level: state.level,
    maxScore: maxScoreOf(state.level),
  };
}

export type BookOrderAction = { type: "order"; order: string[] } | { type: "skip" } | { type: "timeout" } | { type: "begin" };
export type BookOrderEnd = { right: number; total: number; solved: boolean; timedOut: boolean; correct: string[]; points: number };
export type BookOrderEvent = { kind: "begin" } | { kind: "end"; end: BookOrderEnd; next: BookOrderPuzzle | null };

/** Pontos de um conjunto (antes do fator da dificuldade): 70% pelas posições certas e 30% pela rapidez (só se acertou todas). */
export function bookTurnPoints(rounds: number, right: number, total: number, seconds: number, timed: boolean): number {
  const solved = right === total;
  return Math.round(turnShare(rounds, timed) * (0.7 * (right / total) + (solved ? 0.3 * speedFactor(seconds, 6 * total) : 0)));
}

export function playBookOrder(state: BookOrderState, action: BookOrderAction, now: number): { state: BookOrderState; event: BookOrderEvent; done: boolean } {
  const set = state.sets[state.current];
  if (!set) throw new TurnError("A partida já terminou");
  if (action.type === "begin") return { state: { ...state, clock: beginClock(state.clock, now) }, event: { kind: "begin" }, done: false };
  if (action.type === "timeout" && !clockAlmostOver(state.clock, now)) throw new TurnError("Ainda há tempo");
  const timedOut = action.type === "timeout" || clockExpired(state.clock, now);
  let order: string[] = [];
  if (action.type === "order" && !timedOut) {
    order = action.order;
    if (order.length !== set.length || new Set(order).size !== order.length || order.some((book) => !set.includes(book))) throw new TurnError("Ordem inválida");
  }
  const right = order.filter((book, index) => book === set[index]).length;
  const seconds = Math.min(elapsedSeconds(state.clock, now), state.clock.timePerTurn ?? Infinity);
  const points = timedOut ? 0 : bookTurnPoints(state.sets.length, right, set.length, seconds, state.clock.timePerTurn !== null);
  const solved = right === set.length;
  const results = [...state.results, { label: set.join(", "), solved, timedOut, points, seconds: Math.round(seconds) }];
  const current = state.current + 1;
  const next: BookOrderState = { ...state, results, current, clock: endClock(state.clock, now) };
  const done = current >= state.sets.length;
  return { state: next, event: { kind: "end", end: { right, total: set.length, solved, timedOut, correct: set, points }, next: done ? null : publicBookOrder(next) }, done };
}

export function bookOrderOutcome(state: BookOrderState): Outcome {
  const solvedCount = state.results.filter((result) => result.solved).length;
  const total = state.sets.length;
  const score = Math.round(state.results.reduce((sum, result) => sum + result.points, 0) * LEVEL_SCALE[state.level]);
  return { solved: solvedCount >= Math.ceil(total / 2), score, detail: `${solvedCount} de ${total} ${total === 1 ? "conjunto" : "conjuntos"} na ordem · ${LEVEL_LABEL[state.level]}` };
}
