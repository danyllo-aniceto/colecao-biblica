import { ACCURACY_MAX, lettersOnly, randInt, rng, shuffled, timeBonus, type Outcome } from "./common";

/** Caça-palavras: grade 10 × 10 com 6 nomes escondidos em qualquer direção (reta). */
export const WORDSEARCH_SIZE = 10;
export const WORDSEARCH_WORDS = 6;

export type WordSearch = { size: number; grid: string[]; words: string[] };
export type Found = { word: string; from: [number, number]; to: [number, number] };

const DIRECTIONS: Array<[number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [-1, 1],
  [0, -1],
  [-1, 0],
  [-1, -1],
  [1, -1],
];

/** Nomes que cabem na grade: só letras, de 4 a 9 letras, sem repetir. */
export function wordSearchCandidates(names: string[]): string[] {
  return [...new Set(names.map(lettersOnly).filter((word) => word.length >= 4 && word.length <= WORDSEARCH_SIZE - 1))];
}

export function generateWordSearch(seed: number, names: string[]): WordSearch {
  const random = rng(seed);
  const pool = shuffled(random, wordSearchCandidates(names)).sort((a, b) => b.length - a.length);
  const size = WORDSEARCH_SIZE;
  const cells: string[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => ""));
  const placed: string[] = [];
  // Primeiro os mais longos (mais difíceis de encaixar), depois completa com os curtos; sorteia 6 de um grupo embaralhado.
  const picks = shuffled(random, pool).slice(0, WORDSEARCH_WORDS * 3);
  for (const word of picks) {
    if (placed.length >= WORDSEARCH_WORDS) break;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const [dr, dc] = DIRECTIONS[randInt(random, 0, DIRECTIONS.length - 1)];
      const row = randInt(random, 0, size - 1);
      const col = randInt(random, 0, size - 1);
      const endRow = row + dr * (word.length - 1);
      const endCol = col + dc * (word.length - 1);
      if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue;
      let fits = true;
      for (let index = 0; index < word.length; index += 1) {
        const current = cells[row + dr * index][col + dc * index];
        if (current !== "" && current !== word[index]) {
          fits = false;
          break;
        }
      }
      if (!fits) continue;
      for (let index = 0; index < word.length; index += 1) cells[row + dr * index][col + dc * index] = word[index];
      placed.push(word);
      break;
    }
  }
  const alphabet = "ABCDEFGHIJLMNOPQRSTUVZ";
  for (let r = 0; r < size; r += 1) for (let c = 0; c < size; c += 1) if (cells[r][c] === "") cells[r][c] = alphabet[randInt(random, 0, alphabet.length - 1)];
  return { size, grid: cells.map((row) => row.join("")), words: placed };
}

/** A seleção é uma reta (horizontal, vertical ou diagonal) cujas letras formam a palavra, de frente para trás ou ao contrário. */
export function selectionSpells(puzzle: WordSearch, found: Found): boolean {
  const [r1, c1] = found.from;
  const [r2, c2] = found.to;
  const size = puzzle.size;
  if ([r1, c1, r2, c2].some((value) => !Number.isInteger(value) || value < 0 || value >= size)) return false;
  const dr = Math.sign(r2 - r1);
  const dc = Math.sign(c2 - c1);
  const length = Math.max(Math.abs(r2 - r1), Math.abs(c2 - c1)) + 1;
  if (Math.abs(r2 - r1) !== 0 && Math.abs(c2 - c1) !== 0 && Math.abs(r2 - r1) !== Math.abs(c2 - c1)) return false;
  if (length !== found.word.length) return false;
  let text = "";
  for (let index = 0; index < length; index += 1) text += puzzle.grid[r1 + dr * index][c1 + dc * index];
  return text === found.word || [...text].reverse().join("") === found.word;
}

export function checkWordSearch(puzzle: WordSearch, found: Found[], seconds: number): Outcome {
  const valid = new Set<string>();
  for (const entry of found) {
    if (puzzle.words.includes(entry.word) && selectionSpells(puzzle, entry)) valid.add(entry.word);
  }
  const solved = valid.size === puzzle.words.length;
  const score = Math.round((valid.size / Math.max(puzzle.words.length, 1)) * ACCURACY_MAX) + (solved ? timeBonus(seconds, 45) : 0);
  return { solved, score, detail: `${valid.size} de ${puzzle.words.length} palavras` };
}
