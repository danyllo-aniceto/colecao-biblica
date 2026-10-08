import { ACCURACY_MAX, lettersOnly, rng, shuffled, timeBonus, type Outcome } from "./common";

/** Versículo em pedaços: as palavras vêm embaralhadas e o jogador toca nelas na ordem certa. */
export type VersePuzzle = { reference: string; chips: string[]; length: number };
export type VerseSource = { verse: string; reference: string };

/** Versículos que cabem na tela: de 6 a 22 palavras. */
export function verseWords(verse: string): string[] {
  return verse.trim().split(/\s+/).filter(Boolean);
}

export const usableVerse = (source: VerseSource) => {
  const count = verseWords(source.verse).length;
  return count >= 6 && count <= 22;
};

export function generateVerse(seed: number, source: VerseSource): { puzzle: VersePuzzle; words: string[] } {
  const random = rng(seed);
  const words = verseWords(source.verse);
  let chips = shuffled(random, words);
  while (chips.length > 1 && chips.every((word, index) => word === words[index])) chips = shuffled(random, words);
  return { puzzle: { reference: source.reference, chips, length: words.length }, words };
}

const same = (a: string, b: string) => lettersOnly(a) === lettersOnly(b) && lettersOnly(a) !== "";

/**
 * Confere pela lista de fichas tocadas (índices em `chips`): toque certo avança, toque errado conta erro; ficha já usada é inválida.
 * Palavras iguais (como "o" e "o") valem em qualquer ordem entre si.
 */
export function checkVerse(puzzle: VersePuzzle, words: string[], taps: number[], seconds: number): Outcome {
  if (taps.length > 400) return { solved: false, score: 0, detail: "Jogadas demais" };
  const used = new Set<number>();
  let next = 0;
  let errors = 0;
  for (const tap of taps) {
    if (!Number.isInteger(tap) || tap < 0 || tap >= puzzle.chips.length || used.has(tap)) return { solved: false, score: 0, detail: "Jogada inválida" };
    if (next < words.length && same(puzzle.chips[tap], words[next])) {
      used.add(tap);
      next += 1;
    } else {
      errors += 1;
    }
  }
  if (next < words.length) return { solved: false, score: 0, detail: "Faltou completar" };
  return { solved: true, score: Math.max(0, ACCURACY_MAX - errors * 60) + timeBonus(seconds, words.length * 3), detail: `${errors} ${errors === 1 ? "erro" : "erros"}` };
}
