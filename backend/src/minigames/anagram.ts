import { ACCURACY_MAX, lettersOnly, rng, shuffled, timeBonus, type Outcome } from "./common";

/** Anagrama: as letras de um nome embaralhadas; 3 tentativas. */
export const ANAGRAM_ATTEMPTS = 3;

export type AnagramState = { word: string; attempts: number };
export type AnagramPuzzle = { letters: string[]; length: number; hint: string; attempts: number };

export function generateAnagram(seed: number, word: string): string[] {
  const random = rng(seed);
  const letters = [...lettersOnly(word)];
  let mixed = shuffled(random, letters);
  while (letters.length > 1 && mixed.join("") === letters.join("")) mixed = shuffled(random, letters);
  return mixed;
}

/** Palpite certo se as letras (sem acento) formam o nome. */
export const anagramMatches = (state: AnagramState, guess: string) => lettersOnly(guess) === lettersOnly(state.word);

export function anagramOutcome(state: AnagramState, solved: boolean, seconds: number): Outcome {
  if (!solved) return { solved: false, score: 0, detail: `Era ${state.word}` };
  const accuracy = ACCURACY_MAX - (state.attempts - 1) * 200;
  return { solved: true, score: Math.max(100, accuracy) + timeBonus(seconds, 20), detail: state.attempts === 1 ? "De primeira" : `${state.attempts} tentativas` };
}
