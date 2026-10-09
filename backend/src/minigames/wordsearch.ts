import { ACCURACY_MAX, lettersOnly, randInt, rng, shuffled, timeBonus, type Outcome, type Random } from "./common";
import { BOOKS, bookTestament } from "./books";

/**
 * Caça-palavras: o jogador escolhe a dificuldade (tamanho da grade, quantidade e tamanho das palavras, direções) e o tema.
 * O servidor sorteia as palavras evitando as das últimas partidas, esconde cada uma na grade e guarda o gabarito.
 */
export type Difficulty = "facil" | "medio" | "dificil";
export const DIFFICULTY_IDS: readonly Difficulty[] = ["facil", "medio", "dificil"];

export type WordKind = "character" | "place" | "book";
export type WordSearchTheme = "mix" | "antigo" | "novo" | "lugares" | "livros";
export const THEME_IDS: readonly WordSearchTheme[] = ["mix", "antigo", "novo", "lugares", "livros"];
export const THEME_LABELS: Record<WordSearchTheme, string> = { mix: "Mistura bíblica", antigo: "Antigo Testamento", novo: "Novo Testamento", lugares: "Lugares da campanha", livros: "Livros da Bíblia" };

type Direction = [number, number];
const RIGHT: Direction = [0, 1];
const DOWN: Direction = [1, 0];
const DOWN_RIGHT: Direction = [1, 1];
const UP_RIGHT: Direction = [-1, 1];
const ALL_DIRECTIONS: Direction[] = [RIGHT, DOWN, DOWN_RIGHT, UP_RIGHT, [0, -1], [-1, 0], [-1, -1], [1, -1]];

export type DifficultyConfig = {
  label: string;
  words: number;
  minLength: number;
  maxLength: number;
  /** Menor lado da grade; cresce se as palavras pedirem. */
  minSize: number;
  directions: Direction[];
  /** Segundos com bônus de tempo cheio (depois perde 1 ponto por segundo). */
  par: number;
  /** Quanto da pontuação máxima (1.000) esta dificuldade vale: o ranking premia quem joga o difícil. */
  scale: number;
  hints: number;
};

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  facil: { label: "Fácil", words: 5, minLength: 4, maxLength: 7, minSize: 8, directions: [RIGHT, DOWN], par: 70, scale: 0.6, hints: 3 },
  medio: { label: "Médio", words: 7, minLength: 4, maxLength: 9, minSize: 10, directions: [RIGHT, DOWN, DOWN_RIGHT, UP_RIGHT], par: 120, scale: 0.8, hints: 3 },
  dificil: { label: "Difícil", words: 10, minLength: 5, maxLength: 11, minSize: 12, directions: ALL_DIRECTIONS, par: 210, scale: 1, hints: 3 },
};

/** Cada dica pedida desconta isto (antes do fator da dificuldade). */
export const HINT_PENALTY = 40;
export const MAX_GRID = 14;

/** Palavra possível: o que se procura na grade, como se escreve de verdade e de onde vem (para a tela mostrar a imagem). */
export type WordCandidate = { word: string; label: string; kind: WordKind; testament: "OLD" | "NEW" | null; imageUrl: string | null };
/** O que a tela recebe de cada palavra. */
export type WordClue = { word: string; label: string; kind: WordKind; imageUrl: string | null };

export type WordSearch = {
  size: number;
  grid: string[];
  words: string[];
  difficulty: Difficulty;
  /** Nome do tema desta partida. */
  theme: string;
  clues: WordClue[];
  /** Dicas que ainda pode pedir e o que cada uma custa. */
  hints: number;
  hintPenalty: number;
  /** Segundos de bônus de tempo cheio e pontuação máxima possível. */
  par: number;
  maxScore: number;
};
export type Found = { word: string; from: [number, number]; to: [number, number] };

/** O que o servidor guarda da partida (a grade e as palavras vão à tela; as posições, não). */
export type WordSearchState = { puzzle: WordSearch; placements: Found[]; hinted: string[] };

export const maxScoreOf = (difficulty: Difficulty) => Math.round((ACCURACY_MAX + 300) * DIFFICULTIES[difficulty].scale);

type Sources = {
  characters: Array<{ name: string; imageUrl: string | null; testament: string | null }>;
  scenarios: Array<{ name: string; mapImageUrl: string | null }>;
};

/**
 * Tudo que pode virar palavra: o nome inteiro e cada nome de um nome composto ("Maria Madalena" → MADALENA),
 * lugares da campanha e livros da Bíblia. Sem repetir (o primeiro vence: personagem, lugar, livro).
 */
export function wordSearchCandidates(sources: Sources): WordCandidate[] {
  const list: WordCandidate[] = [];
  const add = (text: string, label: string, kind: WordKind, testament: "OLD" | "NEW" | null, imageUrl: string | null) => {
    const word = lettersOnly(text);
    if (word.length >= 4 && word.length <= 11) list.push({ word, label, kind, testament, imageUrl });
  };
  for (const character of sources.characters) {
    const testament = character.testament === "OLD" || character.testament === "NEW" ? character.testament : null;
    add(character.name, character.name, "character", testament, character.imageUrl);
    const parts = character.name.split(/\s+/);
    if (parts.length > 1) for (const part of parts) add(part, character.name, "character", testament, character.imageUrl);
  }
  for (const scenario of sources.scenarios) {
    add(scenario.name, scenario.name, "place", null, scenario.mapImageUrl);
    const parts = scenario.name.split(/\s+/);
    if (parts.length > 1) for (const part of parts) add(part, scenario.name, "place", null, scenario.mapImageUrl);
  }
  for (const book of BOOKS) add(book, book, "book", bookTestament(book), null);
  return list.filter((candidate, index, all) => all.findIndex((other) => other.word === candidate.word) === index);
}

/** Ordem em que os tipos entram na mistura: mais personagens, alguns lugares e livros. */
const MIX_ORDER: WordKind[] = ["character", "place", "character", "book", "character", "place", "character"];

function themePool(pool: WordCandidate[], theme: WordSearchTheme): WordCandidate[] {
  switch (theme) {
    case "antigo":
      return pool.filter((item) => item.testament === "OLD");
    case "novo":
      return pool.filter((item) => item.testament === "NEW");
    case "lugares":
      return pool.filter((item) => item.kind === "place");
    case "livros":
      return pool.filter((item) => item.kind === "book");
    default:
      return pool;
  }
}

/** Sorteia as palavras da partida: do tema, no tamanho da dificuldade, deixando por último as que saíram nas partidas recentes. */
export function pickWords(random: Random, candidates: WordCandidate[], difficulty: Difficulty, theme: WordSearchTheme, avoid: readonly string[]): { picked: WordCandidate[]; theme: WordSearchTheme } {
  const config = DIFFICULTIES[difficulty];
  const recent = new Set(avoid);
  const fits = candidates.filter((item) => item.word.length >= config.minLength && item.word.length <= config.maxLength);
  const queueOf = (items: WordCandidate[]) => [...shuffled(random, items.filter((item) => !recent.has(item.word))), ...shuffled(random, items.filter((item) => recent.has(item.word)))];

  const themed = themePool(fits, theme);
  let shownTheme = theme;
  let pool = themed;
  if (themed.length < config.words) {
    // Tema com poucas palavras: completa com o resto e assume que virou mistura.
    pool = [...themed, ...fits.filter((item) => !themed.includes(item))];
    shownTheme = "mix";
  }
  const queues = new Map<WordKind, WordCandidate[]>((["character", "place", "book"] as WordKind[]).map((kind) => [kind, queueOf(pool.filter((item) => item.kind === kind))]));
  const picked: WordCandidate[] = [];
  const used = new Set<string>();
  // Tema único (lugares, livros): uma fila só. Mistura: alterna os tipos para a partida ter cara variada.
  const order = shownTheme === "mix" ? MIX_ORDER : (["character", "place", "book"] as WordKind[]);
  let cursor = 0;
  let guard = 0;
  while (picked.length < config.words && guard < 500) {
    guard += 1;
    const kinds = [order[cursor % order.length], ...order];
    cursor += 1;
    const kind = kinds.find((candidate) => (queues.get(candidate) ?? []).length > 0);
    if (!kind) break;
    const next = queues.get(kind)!.shift()!;
    if (used.has(next.word)) continue;
    // Uma palavra dentro de outra (ex.: JOAO e JOAOBATISTA) confunde: não entra.
    if (picked.some((other) => other.word.includes(next.word) || next.word.includes(other.word))) continue;
    used.add(next.word);
    picked.push(next);
  }
  return { picked, theme: shownTheme };
}

/** Tamanho da grade: o da dificuldade, ou maior se a palavra mais comprida ou a quantidade de letras pedirem (até 14). */
export function gridSize(difficulty: Difficulty, words: string[]): number {
  const letters = words.reduce((sum, word) => sum + word.length, 0);
  const longest = words.reduce((max, word) => Math.max(max, word.length), 0);
  return Math.min(MAX_GRID, Math.max(DIFFICULTIES[difficulty].minSize, longest, Math.ceil(Math.sqrt(letters * 1.9))));
}

const ALPHABET = "ABCDEFGHIJLMNOPQRSTUVZ";

function layout(random: Random, words: string[], size: number, directions: Direction[], difficulty: Difficulty) {
  const cells: string[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => ""));
  const placements: Found[] = [];
  // Os mais compridos primeiro (são os mais difíceis de encaixar).
  for (const word of [...words].sort((a, b) => b.length - a.length)) {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const [dr, dc] = directions[randInt(random, 0, directions.length - 1)];
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
      placements.push({ word, from: [row, col], to: [endRow, endCol] });
      break;
    }
  }
  // Nos níveis mais altos o enchimento usa letras das próprias palavras, para confundir.
  const filler = difficulty === "facil" ? ALPHABET : ALPHABET + words.join("");
  for (let r = 0; r < size; r += 1) for (let c = 0; c < size; c += 1) if (cells[r][c] === "") cells[r][c] = filler[randInt(random, 0, filler.length - 1)];
  return { grid: cells.map((row) => row.join("")), placements };
}

export type GeneratedWordSearch = { puzzle: WordSearch; placements: Found[] };

export function generateWordSearch(seed: number, candidates: WordCandidate[], options: { difficulty?: Difficulty; theme?: WordSearchTheme; avoid?: readonly string[] } = {}): GeneratedWordSearch | null {
  const difficulty = options.difficulty ?? "medio";
  const config = DIFFICULTIES[difficulty];
  const random = rng(seed);
  const { picked, theme } = pickWords(random, candidates, difficulty, options.theme ?? "mix", options.avoid ?? []);
  if (picked.length < config.words) return null;
  const words = picked.map((item) => item.word);
  const size = gridSize(difficulty, words);
  // Quase sempre cabe de primeira; se alguma palavra ficar de fora, tenta de novo.
  let best = layout(random, words, size, config.directions, difficulty);
  for (let retry = 0; retry < 8 && best.placements.length < words.length; retry += 1) {
    const again = layout(random, words, size, config.directions, difficulty);
    if (again.placements.length > best.placements.length) best = again;
  }
  const placedWords = best.placements.map((entry) => entry.word);
  const clues = picked.filter((item) => placedWords.includes(item.word)).map(({ word, label, kind, imageUrl }) => ({ word, label, kind, imageUrl }));
  if (clues.length < Math.min(config.words, words.length)) return null;
  return {
    puzzle: { size, grid: best.grid, words: clues.map((clue) => clue.word), difficulty, theme: THEME_LABELS[theme], clues, hints: config.hints, hintPenalty: HINT_PENALTY, par: config.par, maxScore: maxScoreOf(difficulty) },
    placements: best.placements,
  };
}

/** A seleção é uma reta (horizontal, vertical ou diagonal) cujas letras formam a palavra, de frente para trás ou ao contrário. */
export function selectionSpells(puzzle: Pick<WordSearch, "size" | "grid">, found: Found): boolean {
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

/**
 * Pontos: até 700 pela quantidade de palavras e até 300 pela rapidez (só se achou todas), menos 40 por palavra com dica,
 * tudo vezes o fator da dificuldade (fácil 60%, médio 80%, difícil 100%). Devolve também onde estavam as palavras que faltaram.
 */
export function checkWordSearch(state: WordSearchState, found: Found[], seconds: number): Outcome {
  const { puzzle } = state;
  const valid = new Set<string>();
  for (const entry of found) {
    if (puzzle.words.includes(entry.word) && selectionSpells(puzzle, entry)) valid.add(entry.word);
  }
  const solved = valid.size === puzzle.words.length;
  const config = DIFFICULTIES[puzzle.difficulty];
  const raw = Math.round((valid.size / Math.max(puzzle.words.length, 1)) * ACCURACY_MAX) + (solved ? timeBonus(seconds, config.par) : 0) - state.hinted.length * HINT_PENALTY;
  const score = valid.size === 0 ? 0 : Math.max(0, Math.round(raw * config.scale));
  const hintText = state.hinted.length > 0 ? ` · ${state.hinted.length} ${state.hinted.length === 1 ? "dica" : "dicas"}` : "";
  return {
    solved,
    score,
    detail: `${valid.size} de ${puzzle.words.length} palavras · ${config.label}${hintText}`,
    reveal: state.placements.filter((placement) => !valid.has(placement.word)),
  };
}
