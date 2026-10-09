import { ACCURACY_MAX, lettersOnly, rng, shuffled, timeBonus, type Outcome, type Random } from "./common";
import { LEVEL_LABEL, LEVEL_SCALE, maxScoreOf, TIME_GRACE, type Level } from "./turns";

/**
 * Palavras cruzadas: nomes de personagens e lugares (as dicas vêm das descrições), grade gerada com semente.
 * Fácil: 5 palavras numa grade pequena; difícil: 10 palavras, nomes mais longos e menos ajuda. Tempo total opcional.
 * Ajudas: "Conferir letras" (marca as erradas) e "Revelar uma letra"; cada uma desconta pontos.
 */
export const CROSSWORD_LEVELS: Record<Level, { size: number; words: number; minWords: number; minLength: number; maxLength: number; par: number; checks: number; peeks: number }> = {
  facil: { size: 9, words: 5, minWords: 4, minLength: 3, maxLength: 7, par: 150, checks: 3, peeks: 5 },
  medio: { size: 11, words: 7, minWords: 5, minLength: 3, maxLength: 9, par: 240, checks: 3, peeks: 4 },
  dificil: { size: 13, words: 10, minWords: 7, minLength: 4, maxLength: 11, par: 360, checks: 2, peeks: 3 },
};
export const TIME_CHOICES = [180, 300, 480, 600] as const;
export const PEEK_PENALTY = 30;
export const CHECK_PENALTY = 50;

export type Entry = { word: string; clue: string; label?: string; imageUrl?: string | null };
type Placed = { word: string; clue: string; row: number; col: number; across: boolean; label?: string; imageUrl?: string | null };

export type CrosswordPuzzle = {
  rows: number;
  cols: number;
  /** 1 = casa de resposta, 0 = bloqueada. */
  open: number[][];
  words: Array<{ number: number; row: number; col: number; across: boolean; length: number; clue: string }>;
};
export type CrosswordWordInfo = { number: number; across: boolean; label: string; imageUrl: string | null };
export type CrosswordState = {
  solution: string[];
  level: Level;
  /** Segundos para a cruzada toda; null = sem tempo. */
  timeLimit: number | null;
  checks: number;
  peeks: number;
  words: CrosswordWordInfo[];
};

function fits(grid: string[][], placed: Placed[], word: string, row: number, col: number, across: boolean, size: number): boolean {
  const dr = across ? 0 : 1;
  const dc = across ? 1 : 0;
  if (row < 0 || col < 0 || row + dr * (word.length - 1) >= size || col + dc * (word.length - 1) >= size) return false;
  // As casas logo antes e depois da palavra precisam estar vazias.
  const before = [row - dr, col - dc];
  const after = [row + dr * word.length, col + dc * word.length];
  for (const [r, c] of [before, after]) if (r >= 0 && c >= 0 && r < size && c < size && grid[r][c] !== "") return false;
  let crossings = 0;
  for (let index = 0; index < word.length; index += 1) {
    const r = row + dr * index;
    const c = col + dc * index;
    const cell = grid[r][c];
    if (cell !== "") {
      if (cell !== word[index]) return false;
      crossings += 1;
      continue;
    }
    // Casa vazia: os vizinhos dos lados (perpendiculares) precisam estar vazios, senão formaria palavra sem querer.
    for (const [nr, nc] of across ? [[r - 1, c], [r + 1, c]] : [[r, c - 1], [r, c + 1]]) {
      if (nr >= 0 && nc >= 0 && nr < size && nc < size && grid[nr][nc] !== "") return false;
    }
  }
  // Tem de cruzar (menos a primeira) e não pode repetir uma palavra no mesmo lugar.
  return placed.length === 0 || crossings > 0;
}

function build(random: Random, entries: Entry[], size: number, target: number): Placed[] {
  const grid: string[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => ""));
  const placed: Placed[] = [];
  const pool = shuffled(random, entries).sort((a, b) => b.word.length - a.word.length);
  const put = (entry: Entry, row: number, col: number, across: boolean) => {
    for (let index = 0; index < entry.word.length; index += 1) grid[row + (across ? 0 : index)][col + (across ? index : 0)] = entry.word[index];
    placed.push({ ...entry, row, col, across });
  };
  const first = pool.shift();
  if (!first) return placed;
  put(first, Math.floor(size / 2), Math.max(0, Math.floor((size - first.word.length) / 2)), true);
  for (const entry of pool) {
    if (placed.length >= target) break;
    const options: Array<[number, number, boolean]> = [];
    for (const target of placed) {
      for (let at = 0; at < target.word.length; at += 1) {
        for (let index = 0; index < entry.word.length; index += 1) {
          if (target.word[at] !== entry.word[index]) continue;
          // Cruza em sentido contrário ao da palavra já posta.
          const across = !target.across;
          const row = target.across ? target.row - (across ? 0 : index) : target.row + at - (across ? 0 : index);
          const col = target.across ? target.col + at - (across ? index : 0) : target.col - (across ? index : 0);
          options.push([row, col, across]);
        }
      }
    }
    for (const [row, col, across] of shuffled(random, options)) {
      if (fits(grid, placed, entry.word, row, col, across, size)) {
        put(entry, row, col, across);
        break;
      }
    }
  }
  return placed;
}

/** Monta a cruzada do nível; tenta várias vezes (sementes derivadas) até caberem as palavras pedidas (ou ao menos o mínimo do nível). */
export function generateCrossword(seed: number, entries: Entry[], level: Level = "medio"): { puzzle: CrosswordPuzzle; state: Pick<CrosswordState, "solution" | "words"> } | null {
  const config = CROSSWORD_LEVELS[level];
  const usable = entries.filter((entry) => entry.word.length >= config.minLength && entry.word.length <= Math.min(config.maxLength, config.size - 2));
  let best: Placed[] = [];
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const placed = build(rng(seed + attempt * 7919), usable, config.size, config.words);
    if (placed.length > best.length) best = placed;
    if (best.length >= config.words) break;
  }
  if (best.length < config.minWords) return null;
  // Corta a grade ao retângulo usado.
  const cells = best.flatMap((entry) => [...entry.word].map((letter, index) => ({ r: entry.row + (entry.across ? 0 : index), c: entry.col + (entry.across ? index : 0), letter })));
  const top = Math.min(...cells.map((cell) => cell.r));
  const left = Math.min(...cells.map((cell) => cell.c));
  const rows = Math.max(...cells.map((cell) => cell.r)) - top + 1;
  const cols = Math.max(...cells.map((cell) => cell.c)) - left + 1;
  const solution = Array.from({ length: rows }, () => Array.from({ length: cols }, () => "."));
  for (const cell of cells) solution[cell.r - top][cell.c - left] = cell.letter;
  const starts = best.map((entry) => ({ entry, row: entry.row - top, col: entry.col - left })).sort((a, b) => a.row - b.row || a.col - b.col || Number(b.entry.across) - Number(a.entry.across));
  // Numeração: casas de início (uma por casa, mesmo se a palavra horizontal e a vertical começarem juntas).
  const numbers = new Map<string, number>();
  const words = starts.map(({ entry, row, col }) => {
    const key = `${row},${col}`;
    if (!numbers.has(key)) numbers.set(key, numbers.size + 1);
    return { number: numbers.get(key)!, row, col, across: entry.across, length: entry.word.length, clue: entry.clue };
  });
  const info = starts.map(({ entry }, index) => ({ number: words[index].number, across: entry.across, label: entry.label ?? entry.word, imageUrl: entry.imageUrl ?? null }));
  return { puzzle: { rows, cols, open: solution.map((row) => row.map((letter) => (letter === "." ? 0 : 1))), words }, state: { solution: solution.map((row) => row.join("")), words: info } };
}

/** As letras digitadas que não batem com a solução (casas vazias não contam). */
export function wrongCells(state: CrosswordState, rows: string[]): Array<[number, number]> {
  const wrong: Array<[number, number]> = [];
  state.solution.forEach((row, r) =>
    [...row].forEach((letter, c) => {
      const typed = lettersOnly(rows[r]?.[c] ?? "");
      if (letter !== "." && typed !== "" && typed !== letter) wrong.push([r, c]);
    }),
  );
  return wrong;
}

/** A letra de uma casa (dica "revelar uma letra"). */
export function letterAt(state: CrosswordState, row: number, col: number): string | null {
  const letter = state.solution[row]?.[col];
  return letter && letter !== "." ? letter : null;
}

/**
 * Pontua as letras certas (até 700) e, se completou, a rapidez (até 300 em relação ao tempo da dificuldade); desconta 50 por conferência e 30 por letra
 * revelada; tudo vezes o fator da dificuldade. Passou do tempo total: não vale como completa e perde o bônus.
 */
export function checkCrossword(state: CrosswordState, rows: string[], seconds: number): Outcome {
  if (rows.length !== state.solution.length || rows.some((row, index) => row.length !== state.solution[index].length)) return { solved: false, score: 0, detail: "Resposta inválida" };
  let total = 0;
  let right = 0;
  state.solution.forEach((row, r) =>
    [...row].forEach((letter, c) => {
      if (letter === ".") return;
      total += 1;
      if (lettersOnly(rows[r][c] ?? "") === letter) right += 1;
    }),
  );
  const late = state.timeLimit !== null && seconds > state.timeLimit + TIME_GRACE;
  const solved = right === total && !late;
  const config = CROSSWORD_LEVELS[state.level];
  const raw = Math.round((right / total) * ACCURACY_MAX) + (solved ? timeBonus(seconds, config.par) : 0) - state.checks * CHECK_PENALTY - state.peeks * PEEK_PENALTY;
  const score = right === 0 ? 0 : Math.max(0, Math.round(raw * LEVEL_SCALE[state.level]));
  const helps = state.checks + state.peeks;
  return {
    solved,
    score,
    detail: `${late ? "Tempo esgotado · " : ""}${right} de ${total} letras certas · ${LEVEL_LABEL[state.level]}${helps > 0 ? ` · ${helps} ${helps === 1 ? "ajuda" : "ajudas"}` : ""}`,
    reveal: state.words,
  };
}

export { maxScoreOf };
