import { ACCURACY_MAX, rng, shuffled, timeBonus, type Outcome } from "./common";

/** Quebra-cabeça: a imagem em 3 × 3 peças embaralhadas; toque em duas para trocá-las de lugar. */
export const PUZZLE_SIDE = 3;
export const PUZZLE_PIECES = PUZZLE_SIDE * PUZZLE_SIDE;

/** `order[posição] = peça` (a peça `n` pertence à posição `n`). */
export type SwapPuzzle = { side: number; order: number[]; imageUrl: string | null; title: string };

export function generateSwapPuzzle(seed: number, source: { imageUrl: string | null; title: string }): SwapPuzzle {
  const random = rng(seed);
  let order = shuffled(random, Array.from({ length: PUZZLE_PIECES }, (_, index) => index));
  // Nunca começa pronto.
  while (order.every((piece, index) => piece === index)) order = shuffled(random, order);
  return { side: PUZZLE_SIDE, order, imageUrl: source.imageUrl, title: source.title };
}

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

export function checkSwapPuzzle(puzzle: SwapPuzzle, swaps: Array<[number, number]>, seconds: number): Outcome {
  if (swaps.length > 400) return { solved: false, score: 0, detail: "Jogadas demais" };
  const order = [...puzzle.order];
  for (const [a, b] of swaps) {
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= order.length || b >= order.length || a === b) return { solved: false, score: 0, detail: "Jogada inválida" };
    [order[a], order[b]] = [order[b], order[a]];
  }
  const solved = order.every((piece, index) => piece === index);
  if (!solved) return { solved: false, score: 0, detail: "Não ficou montado" };
  const extra = Math.max(0, swaps.length - minimumSwaps(puzzle.order));
  return { solved: true, score: Math.max(0, ACCURACY_MAX - extra * 35) + timeBonus(seconds, 30), detail: `${swaps.length} ${swaps.length === 1 ? "troca" : "trocas"}` };
}
