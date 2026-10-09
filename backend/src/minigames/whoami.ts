import { ACCURACY_MAX, rng, shuffled, timeBonus, type Outcome } from "./common";
import { maskHint } from "./hangman";

/** Quem sou eu?: as dicas aparecem uma a uma (da mais vaga à mais clara) e vale uma resposta entre 4 nomes. */
export type WhoAmIState = { options: string[]; answer: number; clues: string[]; shown: number };
export type WhoAmIPuzzle = { clue: string; shown: number; total: number; options: string[] };

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

export function generateWhoAmI(seed: number, people: Person[]): { state: WhoAmIState; puzzle: WhoAmIPuzzle } {
  const random = rng(seed);
  const pool = shuffled(random, people);
  const chosen = pool[0];
  const decoys = pool.slice(1, 4).map((person) => person.name);
  const options = shuffled(random, [chosen.name, ...decoys]);
  const clues = cluesOf(chosen);
  const state: WhoAmIState = { options, answer: options.indexOf(chosen.name), clues, shown: 1 };
  return { state, puzzle: { clue: clues[0], shown: 1, total: clues.length, options } };
}

/** Pontos: quanto menos dicas, mais pontos (cada dica a mais custa 150); só acertar vale. */
export function whoAmIOutcome(state: WhoAmIState, choice: number, seconds: number): Outcome {
  if (choice !== state.answer) return { solved: false, score: 0, detail: `Era ${state.options[state.answer]}` };
  const accuracy = Math.max(100, ACCURACY_MAX - (state.shown - 1) * 150);
  return { solved: true, score: accuracy + timeBonus(seconds, 20), detail: `${state.shown} ${state.shown === 1 ? "dica" : "dicas"}` };
}
