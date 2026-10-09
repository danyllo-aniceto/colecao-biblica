import { ACCURACY_MAX, rng, shuffled, timeBonus, type Outcome } from "./common";

/** Relâmpago: 10 afirmações tiradas das perguntas do quiz; diga se cada uma é verdadeira ou falsa. */
export const BLITZ_STATEMENTS = 10;

export type BlitzQuestion = { text: string; correct: string; wrong: string[] };
export type BlitzState = { truths: boolean[] };
export type BlitzPuzzle = { statements: Array<{ question: string; answer: string }> };

export function generateBlitz(seed: number, questions: BlitzQuestion[]): { state: BlitzState; puzzle: BlitzPuzzle } {
  const random = rng(seed);
  const chosen = shuffled(random, questions).slice(0, BLITZ_STATEMENTS);
  // Metade das afirmações usa a alternativa certa; a outra, uma errada.
  const flags = shuffled(random, chosen.map((_, index) => index < Math.ceil(chosen.length / 2)));
  const statements = chosen.map((question, index) => ({
    question: question.text,
    answer: flags[index] ? question.correct : shuffled(random, question.wrong)[0],
  }));
  return { state: { truths: flags }, puzzle: { statements } };
}

export function checkBlitz(state: BlitzState, answers: boolean[], seconds: number): Outcome {
  if (answers.length !== state.truths.length) return { solved: false, score: 0, detail: "Resposta inválida" };
  const right = answers.filter((answer, index) => answer === state.truths[index]).length;
  const solved = right >= Math.ceil(state.truths.length * 0.8);
  return { solved, score: Math.round((right / state.truths.length) * ACCURACY_MAX) + (solved ? timeBonus(seconds, 45) : 0), detail: `${right} de ${state.truths.length} certas` };
}
