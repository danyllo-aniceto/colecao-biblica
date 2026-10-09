import { ACCURACY_MAX, plainText, rng, shuffled, timeBonus, type Outcome } from "./common";
import { SIZE_LABEL, SIZE_SCALE, sizeMaxScore, TIME_GRACE, type SizeLevel } from "./turns";

/**
 * Quebra-cabeça: a imagem de um personagem ou de um cenário em peças embaralhadas; toque (ou arraste) uma peça sobre outra para trocá-las.
 * O nível define o número de peças (3×3 a 6×6) e as ajudas: números nas peças, ver a imagem inteira e "colocar uma peça no lugar".
 */
export const SWAP_LEVELS: Record<SizeLevel, { side: number; hints: number; peeks: number | null; peekPenalty: number; numbers: boolean; par: number }> = {
  facil: { side: 3, hints: 3, peeks: null, peekPenalty: 0, numbers: true, par: 90 },
  medio: { side: 4, hints: 4, peeks: 3, peekPenalty: 30, numbers: false, par: 180 },
  dificil: { side: 5, hints: 5, peeks: 1, peekPenalty: 50, numbers: false, par: 360 },
  mestre: { side: 6, hints: 6, peeks: 2, peekPenalty: 70, numbers: false, par: 600 },
};
export const TIME_CHOICES = [120, 240, 420, 600, 900] as const;
export const HINT_PENALTY = 40;
/** Sem montar tudo (tempo esgotado ou desistência), cada peça no lugar vale uma fatia disto. */
export const PARTIAL_MAX = 250;

export type PuzzleKind = "character" | "place" | "none";
export type SwapSource = { imageUrl: string | null; title: string; summary: string; kind: PuzzleKind };

/** `order[posição] = peça` (a peça `n` pertence à posição `n`). */
export type SwapPuzzle = {
  side: number;
  order: number[];
  imageUrl: string | null;
  title: string;
  kind: PuzzleKind;
  level: SizeLevel;
  /** Segundos para montar tudo; null = sem tempo. */
  timeLimit: number | null;
  hintsLeft: number;
  /** Quantas vezes ainda pode ver a imagem inteira (null = sempre à mostra). */
  peeksLeft: number | null;
  peekPenalty: number;
  hintPenalty: number;
  numbers: boolean;
  par: number;
  maxScore: number;
};
/** O que o servidor guarda: a tela recebe só o `puzzle` (o resumo aparece no fim). */
export type SwapState = { puzzle: SwapPuzzle; hints: number; peeks: number; summary: string };

export function generateSwapPuzzle(seed: number, source: SwapSource, level: SizeLevel = "facil", timeLimit: number | null = null): SwapPuzzle {
  const config = SWAP_LEVELS[level];
  const random = rng(seed);
  const pieces = config.side * config.side;
  let order = shuffled(random, Array.from({ length: pieces }, (_, index) => index));
  // Nunca começa pronto.
  while (order.every((piece, index) => piece === index)) order = shuffled(random, order);
  return {
    side: config.side,
    order,
    imageUrl: source.imageUrl,
    title: source.title,
    kind: source.kind,
    level,
    timeLimit,
    hintsLeft: config.hints,
    peeksLeft: config.peeks,
    peekPenalty: config.peekPenalty,
    hintPenalty: HINT_PENALTY,
    numbers: config.numbers,
    par: config.par,
    maxScore: sizeMaxScore(level),
  };
}

export const newSwapState = (puzzle: SwapPuzzle, summary: string): SwapState => ({ puzzle, hints: 0, peeks: 0, summary: plainText(summary) });

/** Menor número de trocas para resolver: peças menos ciclos da permutação. */
export function minimumSwaps(order: number[]): number {
  const seen = new Set<number>();
  let cycles = 0;
  for (let start = 0; start < order.length; start += 1) {
    if (seen.has(start)) continue;
    cycles += 1;
    let at = start;
    while (!seen.has(at)) {
      seen.add(at);
      at = order[at];
    }
  }
  return order.length - cycles;
}

/** Refaz as trocas a partir da ordem inicial; null se alguma for inválida. */
export function applySwaps(initial: number[], swaps: Array<[number, number]>): number[] | null {
  if (swaps.length > 600) return null;
  const order = [...initial];
  for (const [a, b] of swaps) {
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= order.length || b >= order.length || a === b) return null;
    [order[a], order[b]] = [order[b], order[a]];
  }
  return order;
}

/** A troca que põe no lugar a primeira peça fora de lugar (a dica "colocar uma peça"). */
export function nextHintSwap(order: number[]): [number, number] | null {
  const position = order.findIndex((piece, index) => piece !== index);
  if (position < 0) return null;
  return [position, order.indexOf(position)];
}

/**
 * Pontos: montou tudo no tempo → até 700 (cada troca a mais que o mínimo tira um pouco) + até 300 de rapidez (em relação ao tempo do nível),
 * menos 40 por dica de peça e o custo de cada espiada na imagem; tudo vezes o fator do nível. Sem montar: só as peças no lugar, até 250.
 */
export function checkSwapPuzzle(state: SwapState, swaps: Array<[number, number]>, seconds: number): Outcome {
  // Partidas começadas antes desta versão não têm nível nem ajudas: valem como fácil.
  const puzzle: SwapPuzzle = { ...state.puzzle, level: state.puzzle.level ?? "facil", timeLimit: state.puzzle.timeLimit ?? null, par: state.puzzle.par ?? SWAP_LEVELS.facil.par, peekPenalty: state.puzzle.peekPenalty ?? 0 };
  state = { ...state, puzzle, hints: state.hints ?? 0, peeks: state.peeks ?? 0, summary: state.summary ?? "" };
  const order = applySwaps(puzzle.order, swaps);
  if (!order) return { solved: false, score: 0, detail: "Jogada inválida" };
  const pieces = order.length;
  const correct = order.filter((piece, index) => piece === index).length;
  const late = puzzle.timeLimit !== null && seconds > puzzle.timeLimit + TIME_GRACE;
  const solved = correct === pieces && !late;
  const reveal = { title: puzzle.title, imageUrl: puzzle.imageUrl, summary: state.summary, kind: puzzle.kind };
  const scale = SIZE_SCALE[puzzle.level];
  if (!solved) {
    // As peças que ainda estavam fora do lugar não contam; as que começaram certas também não (só vale o que o jogador pôs).
    const placed = Math.max(0, correct - order.filter((piece, index) => piece === index && puzzle.order[index] === index).length);
    return { solved: false, score: Math.round((placed / pieces) * PARTIAL_MAX * scale), detail: `${late ? "Tempo esgotado · " : ""}${correct} de ${pieces} peças no lugar`, reveal };
  }
  const extra = Math.max(0, swaps.length - minimumSwaps(puzzle.order));
  const accuracy = ACCURACY_MAX * Math.max(0.25, 1 - extra / (pieces * 2));
  const raw = Math.round(accuracy) + timeBonus(seconds, puzzle.par) - state.hints * HINT_PENALTY - state.peeks * puzzle.peekPenalty;
  const helps = state.hints + state.peeks;
  return {
    solved: true,
    score: Math.max(0, Math.round(raw * scale)),
    detail: `${swaps.length} ${swaps.length === 1 ? "troca" : "trocas"} · ${SIZE_LABEL[puzzle.level]}${helps > 0 ? ` · ${helps} ${helps === 1 ? "ajuda" : "ajudas"}` : ""}`,
    reveal,
  };
}
