import { ACCURACY_MAX, lettersOnly, rng, shuffled, timeBonus, type Outcome } from "./common";
import { verseWords } from "./verse";

/** Complete o versículo: 3 lacunas e uma lista de palavras (as certas e outras 3 de enfeite). */
export const BLANKS = 3;

export type BlanksState = { answers: string[] };
/** Cada palavra do versículo: sem `blank` é texto fixo; com `blank` é uma lacuna (o `prefix` e o `suffix` são a pontuação em volta). */
export type BlanksPart = { text: string; blank: number | null; prefix?: string; suffix?: string };
export type BlanksPuzzle = { reference: string; parts: BlanksPart[]; options: string[] };

const SPLIT = /^([^\p{L}]*)(\p{L}[\p{L}'’-]*)([^\p{L}]*)$/u;

const wordKey = (word: string) => lettersOnly(word);

/** Versículo com 8 a 24 palavras e pelo menos 3 palavras de 4 letras ou mais, longe umas das outras. */
export const usableForBlanks = (verse: string) => {
  const words = verseWords(verse);
  return words.length >= 8 && words.length <= 24 && words.filter((word) => wordKey(word).length >= 4).length >= BLANKS;
};

export function generateBlanks(seed: number, source: { verse: string; reference: string }, decoyPool: string[]): { state: BlanksState; puzzle: BlanksPuzzle } {
  const random = rng(seed);
  const words = verseWords(source.verse);
  const candidates = words.flatMap((word, index) => (wordKey(word).length >= 4 ? [index] : []));
  // Sorteia sem pôr duas lacunas coladas.
  const picked: number[] = [];
  for (const index of shuffled(random, candidates)) {
    if (picked.length === BLANKS) break;
    if (picked.every((other) => Math.abs(other - index) > 1)) picked.push(index);
  }
  const blanks = picked.sort((a, b) => a - b);
  const pieces = blanks.map((index) => {
    const match = SPLIT.exec(words[index]);
    return { prefix: match?.[1] ?? "", core: match?.[2] ?? words[index], suffix: match?.[3] ?? "" };
  });
  const answers = pieces.map((piece) => piece.core);
  const used = new Set(answers.map(wordKey));
  const decoys = shuffled(random, decoyPool.filter((word) => wordKey(word).length >= 4 && !used.has(wordKey(word)))).slice(0, 3);
  const parts: BlanksPart[] = words.map((word, index) => {
    const slot = blanks.indexOf(index);
    return slot >= 0 ? { text: "", blank: slot, prefix: pieces[slot].prefix, suffix: pieces[slot].suffix } : { text: word, blank: null };
  });
  return { state: { answers }, puzzle: { reference: source.reference, parts, options: shuffled(random, [...answers, ...decoys]) } };
}

export function checkBlanks(state: BlanksState, fills: string[], seconds: number): Outcome {
  if (fills.length !== state.answers.length) return { solved: false, score: 0, detail: "Resposta inválida" };
  const right = fills.filter((fill, index) => wordKey(fill) === wordKey(state.answers[index])).length;
  const solved = right === state.answers.length;
  return { solved, score: Math.round((right / state.answers.length) * ACCURACY_MAX) + (solved ? timeBonus(seconds, 25) : 0), detail: `${right} de ${state.answers.length} lacunas certas` };
}
