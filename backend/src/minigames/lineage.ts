import { ACCURACY_MAX, lettersOnly, rng, shuffled, timeBonus, type Outcome } from "./common";
import { LEVEL_LABEL, LEVEL_SCALE, maxScoreOf, TIME_GRACE, type Level } from "./turns";

/**
 * Árvore genealógica: aparece uma pessoa na base da árvore e o jogador preenche quem são o pai, o avô, o bisavô, o tataravô... dela.
 * O tamanho da árvore (de 2 a 8 gerações) e a dificuldade (nomes de enfeite, ajuda inicial, dicas) são escolhidos antes de começar.
 */
export const LINEAGES: Array<{ source: string; names: string[] }> = [
  { source: "Gênesis 5", names: ["Adão", "Sete", "Enos", "Cainã", "Maalalel", "Jarede", "Enoque", "Matusalém", "Lameque", "Noé"] },
  {
    source: "Mateus 1 e Lucas 3",
    names: ["Terá", "Abraão", "Isaque", "Jacó", "Judá", "Perez", "Esrom", "Rão", "Aminadabe", "Naassom", "Salmom", "Boaz", "Obede", "Jessé", "Davi", "Salomão", "Roboão", "Abias", "Asa", "Josafá", "Jorão", "Uzias", "Jotão", "Acaz", "Ezequias", "Manassés", "Amom", "Josias", "Jeconias", "Salatiel", "Zorobabel"],
  },
];

/** Como se chama cada antepassado, do mais próximo (pai) ao mais distante. */
export const ANCESTOR_LABELS = ["Pai", "Avô", "Bisavô", "Tataravô", "Tetravô", "Pentavô", "Hexavô"] as const;
/** Tamanhos da árvore: número de gerações, contando a pessoa da base. */
export const GENERATION_CHOICES = [2, 3, 4, 5, 6, 7, 8] as const;
export const TIME_CHOICES = [60, 120, 240, 360] as const;
export const HINT_PENALTY = 50;

export const LINEAGE_LEVELS: Record<Level, { decoys: number; prefilled: number; hints: number; showSource: boolean }> = {
  facil: { decoys: 0, prefilled: 1, hints: 3, showSource: true },
  medio: { decoys: 2, prefilled: 0, hints: 2, showSource: true },
  dificil: { decoys: 4, prefilled: 0, hints: 1, showSource: false },
};

export type LineageSlot = { label: string; name: string | null };
export type LineagePuzzle = {
  reference: string;
  generations: number;
  /** De cima (o mais antigo) até o pai; `name` já vem preenchido nas ajudas iniciais. */
  slots: LineageSlot[];
  pool: string[];
  source: string | null;
  level: Level;
  timeLimit: number | null;
  hintsLeft: number;
  hintPenalty: number;
  par: number;
  maxScore: number;
};
export type LineageState = {
  answers: string[];
  reference: string;
  source: string;
  level: Level;
  timeLimit: number | null;
  /** Posições (de cima para baixo) já preenchidas de graça. */
  prefilled: number[];
  /** Posições reveladas por dica. */
  hinted: number[];
  puzzle: LineagePuzzle;
};

export function generateLineage(seed: number, level: Level = "medio", generations = 4, timeLimit: number | null = null): LineageState {
  const config = LINEAGE_LEVELS[level];
  const random = rng(seed);
  const ancestors = Math.min(Math.max(generations, 2), 8) - 1;
  const candidates = LINEAGES.filter((lineage) => lineage.names.length >= ancestors + 1);
  // A linhagem longa (Mateus/Lucas) sai mais: tem muito mais janelas possíveis.
  const lineage = candidates.length > 1 && random() < 0.25 ? candidates[0] : candidates[candidates.length - 1];
  const start = Math.floor(random() * (lineage.names.length - ancestors));
  const window = lineage.names.slice(start, start + ancestors + 1);
  const answers = window.slice(0, ancestors);
  const reference = window[ancestors];
  const prefilled = shuffled(random, answers.map((_, index) => index)).slice(0, Math.min(config.prefilled, ancestors - 1));
  // Nomes de enfeite: no difícil, os vizinhos mais próximos da janela (os mais confusos).
  const outside = lineage.names.map((name, index) => ({ name, index })).filter(({ index }) => index < start || index > start + ancestors);
  const nearest = [...outside].sort((a, b) => Math.min(Math.abs(a.index - start), Math.abs(a.index - start - ancestors)) - Math.min(Math.abs(b.index - start), Math.abs(b.index - start - ancestors)));
  const decoys = (level === "dificil" ? nearest : shuffled(random, nearest)).slice(0, config.decoys).map(({ name }) => name);
  const slots = answers.map((name, index) => ({ label: ANCESTOR_LABELS[ancestors - 1 - index], name: prefilled.includes(index) ? name : null }));
  const pool = shuffled(random, [...answers.filter((_, index) => !prefilled.includes(index)), ...decoys]);
  const puzzle: LineagePuzzle = {
    reference,
    generations: ancestors + 1,
    slots,
    pool,
    source: config.showSource ? lineage.source : null,
    level,
    timeLimit,
    hintsLeft: config.hints,
    hintPenalty: HINT_PENALTY,
    par: 20 * ancestors + 20,
    maxScore: maxScoreOf(level),
  };
  return { answers, reference, source: lineage.source, level, timeLimit, prefilled, hinted: [], puzzle };
}

/** A próxima dica: o primeiro lugar que ainda não está certo nem foi ajudado (para o jogador, `fills` é o que ele tem agora). */
export function nextHint(state: LineageState, fills: Array<string | null>): { slot: number; name: string } | null {
  const slot = state.answers.findIndex((answer, index) => !state.prefilled.includes(index) && !state.hinted.includes(index) && lettersOnly(fills[index] ?? "") !== lettersOnly(answer));
  return slot < 0 ? null : { slot, name: state.answers[slot] };
}

/**
 * Pontos: os lugares certos entre os que o jogador preencheu (até 700) + rapidez (até 300) se acertou tudo; menos 50 por dica;
 * tudo vezes o fator do nível. Passou do tempo total: não vale como completa.
 */
export function checkLineage(state: LineageState, fills: Array<string | null>, seconds: number): Outcome {
  // Partida começada antes desta versão (ligar pais e filhos): não dá para conferir.
  if (!Array.isArray(state.answers)) return { solved: false, score: 0, detail: "Partida de uma versão anterior" };
  const total = state.answers.length;
  if (fills.length !== total) return { solved: false, score: 0, detail: "Resposta inválida" };
  const work = state.answers.map((_, index) => index).filter((index) => !state.prefilled.includes(index));
  const right = work.filter((index) => lettersOnly(fills[index] ?? "") === lettersOnly(state.answers[index])).length;
  const late = state.timeLimit !== null && seconds > state.timeLimit + TIME_GRACE;
  const solved = right === work.length && !late;
  const par = state.puzzle.par;
  const raw = Math.round((work.length === 0 ? 1 : right / work.length) * ACCURACY_MAX) + (solved ? timeBonus(seconds, par) : 0) - state.hinted.length * HINT_PENALTY;
  const score = right === 0 && state.hinted.length === 0 ? 0 : Math.max(0, Math.round(raw * LEVEL_SCALE[state.level]));
  const generations = total + 1;
  return {
    solved,
    score,
    detail: `${late ? "Tempo esgotado · " : ""}${right + state.prefilled.length} de ${total} antepassados · ${generations} gerações · ${LEVEL_LABEL[state.level]}${state.hinted.length > 0 ? ` · ${state.hinted.length} ${state.hinted.length === 1 ? "dica" : "dicas"}` : ""}`,
    reveal: { answers: state.answers, labels: state.puzzle.slots.map((slot) => slot.label), reference: state.reference, source: state.source },
  };
}
