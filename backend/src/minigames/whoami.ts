import { plainText, shuffled, type Outcome, type Random } from "./common";
import { beginClock, clockAlmostOver, clockExpired, elapsedSeconds, endClock, LEVEL_LABEL, LEVEL_SCALE, maxScoreOf, newClock, speedFactor, turnShare, TurnError, type Clock, type Level, type TurnResult } from "./turns";
import { maskHint } from "./hangman";

/**
 * Quem sou eu?, em turnos: as dicas aparecem uma a uma (da mais vaga à mais clara) e vale uma resposta entre alguns nomes.
 * Fácil: 3 nomes e já abre com 2 dicas; difícil: 6 nomes parecidos e abre com 1 dica. No fim de cada turno aparece a foto do personagem.
 */
export const ROUND_CHOICES = [1, 3, 5] as const;
export const TIME_CHOICES = [30, 45, 60, 90, 120] as const;
export const WHOAMI_LEVELS: Record<Level, { options: number; opening: number; similar: boolean }> = {
  facil: { options: 3, opening: 2, similar: false },
  medio: { options: 4, opening: 1, similar: false },
  dificil: { options: 6, opening: 1, similar: true },
};
/** Cada dica a mais (além das da abertura) tira isto da parte de precisão do turno. */
export const CLUE_COST = 0.15;

export type Person = {
  name: string;
  testament: string | null;
  historicalPeriod: string | null;
  bibleBooks: string | null;
  narrativeRole: string | null;
  keywords: string | null;
  importantEvents: string | null;
  curiosities: string | null;
  shortSummary: string;
  imageUrl: string | null;
};

const MAX_CLUES = 5;

/** Dicas do personagem, da mais vaga à mais clara; o nome é sempre trocado por traços. */
export function cluesOf(person: Person): string[] {
  const text = (value: string | null) => (value && value.trim() ? maskHint(value.trim(), person.name) : null);
  const raw = [
    person.testament === "OLD" ? "Vive no Antigo Testamento." : person.testament === "NEW" ? "Vive no Novo Testamento." : null,
    text(person.historicalPeriod) && `Época: ${text(person.historicalPeriod)}`,
    text(person.bibleBooks) && `Aparece em: ${text(person.bibleBooks)}`,
    text(person.narrativeRole) && `Papel na história: ${text(person.narrativeRole)}`,
    text(person.keywords) && `Palavras-chave: ${text(person.keywords)}`,
    text(person.importantEvents) && `Acontecimentos: ${text(person.importantEvents)}`,
    text(person.curiosities) && `Curiosidade: ${text(person.curiosities)}`,
  ].filter((clue): clue is string => Boolean(clue));
  const summary = maskHint(person.shortSummary, person.name);
  // Fica com as mais vagas e sempre fecha com o resumo (a dica mais clara).
  return [...raw.slice(0, MAX_CLUES - 1), summary];
}

export type WhoAmIRound = { name: string; clues: string[]; options: string[]; answer: number; imageUrl: string | null; summary: string };
export type WhoAmIState = { seed: number; level: Level; clock: Clock; rounds: WhoAmIRound[]; current: number; shown: number; results: TurnResult[] };
export type WhoAmIPuzzle = { round: number; rounds: number; clues: string[]; total: number; options: string[]; timePerRound: number | null; level: Level; maxScore: number };

/** Sorteia os personagens (deixando por último os das partidas recentes) e os nomes de enfeite: no difícil, do mesmo Testamento. */
export function pickWhoAmIRounds(random: Random, people: Person[], level: Level, count: number, avoid: readonly string[]): WhoAmIRound[] {
  const config = WHOAMI_LEVELS[level];
  const recent = new Set(avoid);
  const order = [...shuffled(random, people.filter((person) => !recent.has(person.name))), ...shuffled(random, people.filter((person) => recent.has(person.name)))];
  return order.slice(0, count).map((chosen) => {
    const others = people.filter((person) => person.name !== chosen.name);
    const pool = config.similar ? [...shuffled(random, others.filter((person) => person.testament === chosen.testament)), ...shuffled(random, others.filter((person) => person.testament !== chosen.testament))] : shuffled(random, others);
    const decoys = pool.slice(0, config.options - 1).map((person) => person.name);
    const options = shuffled(random, [chosen.name, ...decoys]);
    return { name: chosen.name, clues: cluesOf(chosen), options, answer: options.indexOf(chosen.name), imageUrl: chosen.imageUrl, summary: plainText(chosen.shortSummary) };
  });
}

export const newWhoAmI = (seed: number, rounds: WhoAmIRound[], level: Level, timePerRound: number | null, now: number): WhoAmIState => ({
  seed,
  level,
  clock: newClock(timePerRound, now),
  rounds,
  current: 0,
  shown: Math.min(WHOAMI_LEVELS[level].opening, rounds[0]?.clues.length ?? 1),
  results: [],
});

export function publicWhoAmI(state: WhoAmIState): WhoAmIPuzzle {
  const round = state.rounds[state.current];
  return { round: state.current, rounds: state.rounds.length, clues: round.clues.slice(0, state.shown), total: round.clues.length, options: round.options, timePerRound: state.clock.timePerTurn, level: state.level, maxScore: maxScoreOf(state.level) };
}

/** Pontos de um personagem (antes do fator da dificuldade): 70% pela precisão (cada dica extra tira 15%, no mínimo 40%) e 30% pela rapidez. */
export function whoAmITurnPoints(rounds: number, extraClues: number, seconds: number, timed: boolean): number {
  const accuracy = Math.max(0.4, 1 - extraClues * CLUE_COST);
  return Math.round(turnShare(rounds, timed) * (0.7 * accuracy + 0.3 * speedFactor(seconds, 25)));
}

export type WhoAmIAction = { type: "hint" } | { type: "answer"; choice: number } | { type: "skip" } | { type: "timeout" } | { type: "begin" };
export type WhoAmIEnd = { right: boolean; timedOut: boolean; answer: string; imageUrl: string | null; summary: string; shown: number; points: number };
export type WhoAmIEvent = { kind: "begin" } | { kind: "hint"; clue: string; shown: number; total: number } | { kind: "end"; end: WhoAmIEnd; next: WhoAmIPuzzle | null };

export function playWhoAmI(state: WhoAmIState, action: WhoAmIAction, now: number): { state: WhoAmIState; event: WhoAmIEvent; done: boolean } {
  const round = state.rounds[state.current];
  if (!round) throw new TurnError("A partida já terminou");
  if (action.type === "begin") return { state: { ...state, clock: beginClock(state.clock, now) }, event: { kind: "begin" }, done: false };
  if (action.type === "timeout" && !clockAlmostOver(state.clock, now)) throw new TurnError("Ainda há tempo");
  const timedOut = action.type === "timeout" || clockExpired(state.clock, now);

  if (action.type === "hint" && !timedOut) {
    if (state.shown >= round.clues.length) throw new TurnError("Não há mais dicas");
    const shown = state.shown + 1;
    return { state: { ...state, shown }, event: { kind: "hint", clue: round.clues[shown - 1], shown, total: round.clues.length }, done: false };
  }

  const right = !timedOut && action.type === "answer" && action.choice === round.answer;
  const seconds = Math.min(elapsedSeconds(state.clock, now), state.clock.timePerTurn ?? Infinity);
  const extra = Math.max(0, state.shown - WHOAMI_LEVELS[state.level].opening);
  const points = right ? whoAmITurnPoints(state.rounds.length, extra, seconds, state.clock.timePerTurn !== null) : 0;
  const results = [...state.results, { label: round.name, solved: right, timedOut, points, seconds: Math.round(seconds) }];
  const current = state.current + 1;
  const upcoming = state.rounds[current];
  const next: WhoAmIState = { ...state, results, current, shown: upcoming ? Math.min(WHOAMI_LEVELS[state.level].opening, upcoming.clues.length) : 0, clock: endClock(state.clock, now) };
  const done = current >= state.rounds.length;
  const end: WhoAmIEnd = { right, timedOut, answer: round.name, imageUrl: round.imageUrl, summary: round.summary, shown: state.shown, points };
  return { state: next, event: { kind: "end", end, next: done ? null : publicWhoAmI(next) }, done };
}

export function whoAmIOutcome(state: WhoAmIState): Outcome {
  const right = state.results.filter((result) => result.solved).length;
  const total = state.rounds.length;
  const score = Math.round(state.results.reduce((sum, result) => sum + result.points, 0) * LEVEL_SCALE[state.level]);
  return { solved: right >= Math.ceil(total / 2), score, detail: `${right} de ${total} ${total === 1 ? "personagem" : "personagens"} · ${LEVEL_LABEL[state.level]}` };
}
