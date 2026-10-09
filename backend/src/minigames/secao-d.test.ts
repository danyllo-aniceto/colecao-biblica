import { describe, expect, it } from "vitest";
import { rng } from "./common";
import { checkMemory, generateMemory, MEMORY_LEVELS, MIN_PAIRS, PARTIAL_MAX as MEMORY_PARTIAL, pickPairs, type MemoryPairInput } from "./memory";
import { applySwaps, checkSwapPuzzle, generateSwapPuzzle, HINT_PENALTY, minimumSwaps, newSwapState, nextHintSwap, PARTIAL_MAX, SWAP_LEVELS, type SwapState } from "./swap-puzzle";
import { SIZE_LEVEL_IDS, SIZE_SCALE, TIME_GRACE, type SizeLevel } from "./turns";

describe("quebra-cabeça", () => {
  const source = { imageUrl: "x.png", title: "Moisés", summary: "<p>Libertou o povo.</p>", kind: "character" as const };
  const make = (level: SizeLevel = "facil", timeLimit: number | null = null, seed = 9): SwapState => newSwapState(generateSwapPuzzle(seed, source, level, timeLimit), source.summary);

  /** Resolve trocando cada posição pela peça certa. */
  function solve(order: number[]): Array<[number, number]> {
    const current = [...order];
    const swaps: Array<[number, number]> = [];
    for (let position = 0; position < current.length; position += 1) {
      if (current[position] === position) continue;
      const at = current.indexOf(position);
      [current[position], current[at]] = [current[at], current[position]];
      swaps.push([position, at]);
    }
    return swaps;
  }

  it("o nível define as peças (3×3 a 6×6) e as ajudas; nunca começa pronto", () => {
    for (const level of SIZE_LEVEL_IDS) {
      const config = SWAP_LEVELS[level];
      const { puzzle } = make(level);
      expect(puzzle.order).toHaveLength(config.side * config.side);
      expect(puzzle.order.every((piece, index) => piece === index)).toBe(false);
      expect([...puzzle.order].sort((a, b) => a - b)).toEqual(puzzle.order.map((_, index) => index));
      expect(puzzle).toMatchObject({ side: config.side, hintsLeft: config.hints, peeksLeft: config.peeks, numbers: config.numbers, maxScore: Math.round(1000 * SIZE_SCALE[level]) });
    }
    expect(minimumSwaps([1, 0, 2, 3])).toBe(1);
    expect(minimumSwaps([1, 2, 0])).toBe(2);
    expect(minimumSwaps([0, 1, 2])).toBe(0);
    expect(generateSwapPuzzle(9, source, "medio")).toEqual(generateSwapPuzzle(9, source, "medio"));
  });

  it("resolver no mínimo de trocas dá a pontuação cheia do nível; trocas a mais custam; ajudas descontam", () => {
    const easy = make("facil");
    const best = solve(easy.puzzle.order);
    expect(best).toHaveLength(minimumSwaps(easy.puzzle.order));
    expect(checkSwapPuzzle(easy, best, 10)).toMatchObject({ solved: true, score: 600 });
    expect(checkSwapPuzzle(make("mestre"), solve(make("mestre").puzzle.order), 10).score).toBe(1000);
    const wasteful: Array<[number, number]> = [[0, 1], [0, 1], ...best];
    expect(checkSwapPuzzle(easy, wasteful, 10).score).toBeLessThan(600);
    const hinted = { ...make("medio"), hints: 2, peeks: 1 };
    const result = checkSwapPuzzle(hinted, solve(hinted.puzzle.order), 10);
    expect(result.score).toBe(Math.round((1000 - 2 * HINT_PENALTY - hinted.puzzle.peekPenalty) * 0.8));
    expect(result.detail).toContain("3 ajudas");
    expect(checkSwapPuzzle(easy, [[0, 0]], 10)).toMatchObject({ solved: false, score: 0 });
    expect(checkSwapPuzzle(easy, [[0, 99]], 10).solved).toBe(false);
  });

  it("sem montar vale só as peças que o jogador pôs no lugar (e o tempo esgotado tira a vitória)", () => {
    const state = make("facil", 120);
    const best = solve(state.puzzle.order);
    const partial = checkSwapPuzzle(state, best.slice(0, -1), 10);
    expect(partial.solved).toBe(false);
    expect(partial.score).toBeGreaterThan(0);
    expect(partial.score).toBeLessThan(Math.round(PARTIAL_MAX * 0.6) + 1);
    expect(checkSwapPuzzle(state, [], 10).score).toBe(0);
    const late = checkSwapPuzzle(state, best, 120 + TIME_GRACE + 5);
    expect(late.solved).toBe(false);
    expect(late.detail).toContain("Tempo esgotado");
    expect(late.reveal).toMatchObject({ title: "Moisés", summary: "Libertou o povo." });
  });

  it("a dica põe no lugar a primeira peça fora de lugar, a partir das trocas já feitas", () => {
    const { puzzle } = make("medio");
    const hint = nextHintSwap(puzzle.order)!;
    const after = applySwaps(puzzle.order, [hint])!;
    expect(after[hint[0]]).toBe(hint[0]);
    expect(minimumSwaps(after)).toBe(minimumSwaps(puzzle.order) - 1);
    expect(nextHintSwap([0, 1, 2])).toBeNull();
    expect(applySwaps(puzzle.order, [[0, 999]])).toBeNull();
    expect(applySwaps(puzzle.order, Array.from({ length: 700 }, () => [0, 1] as [number, number]))).toBeNull();
  });
});

describe("memória", () => {
  const pool: MemoryPairInput[] = [
    ...Array.from({ length: 20 }, (_, index) => ({ key: `P${index}`, kind: "personagens" as const, a: { text: `Pessoa ${index}`, imageUrl: `p${index}.png` }, b: { text: `Pessoa ${index}`, imageUrl: null }, label: `Pessoa ${index}` })),
    ...Array.from({ length: 10 }, (_, index) => ({ key: `C${index}`, kind: "cenarios" as const, a: { text: `Lugar ${index}`, imageUrl: `c${index}.png` }, b: { text: `Lugar ${index}`, imageUrl: null }, label: `Lugar ${index}` })),
    ...Array.from({ length: 10 }, (_, index) => ({ key: `V${index}`, kind: "versiculos" as const, a: { text: `Cenário ${index}`, imageUrl: null }, b: { text: `Livro ${index}:1`, imageUrl: null }, label: `Cenário ${index}` })),
  ];
  const perfect = (memory: NonNullable<ReturnType<typeof generateMemory>>) => {
    const byPair = new Map<number, number[]>();
    memory.cards.forEach((card, index) => byPair.set(card.pair, [...(byPair.get(card.pair) ?? []), index]));
    return [...byPair.values()].flat();
  };

  it("o nível define pares, colunas e a prévia; o tipo escolhe de onde vêm os pares", () => {
    for (const level of SIZE_LEVEL_IDS) {
      const config = MEMORY_LEVELS[level];
      const memory = generateMemory(4, pool, level, "mix")!;
      expect(memory.cards).toHaveLength(config.pairs * 2);
      expect(new Set(memory.cards.map((card) => card.pair)).size).toBe(config.pairs);
      expect(memory).toMatchObject({ pairs: config.pairs, peek: config.peek, level });
      expect(memory.labels).toHaveLength(config.pairs);
    }
    expect(generateMemory(4, pool, "facil", "mix")!.cols).toBe(3);
    expect(generateMemory(4, pool, "medio", "mix")!.cols).toBe(4);
    expect(generateMemory(4, pool, "mestre", "mix")!.cols).toBe(6);
    const people = generateMemory(4, pool, "medio", "personagens")!;
    expect(people.cards.filter((card) => card.imageUrl).length).toBe(8);
    expect(people.cards.every((card) => card.text.startsWith("Pessoa"))).toBe(true);
    const verses = generateMemory(4, pool, "facil", "versiculos")!;
    expect(verses.cards.every((card) => card.imageUrl === null)).toBe(true);
    expect(generateMemory(4, pool, "facil", "mix")).toEqual(generateMemory(4, pool, "facil", "mix"));
  });

  it("tipo com poucos pares completa com os outros; sem pares suficientes não monta; recentes ficam por último", () => {
    const few = pool.filter((pair) => pair.kind !== "cenarios").slice(0, 25);
    expect(pickPairs(rng(1), few, "cenarios", 8, [])).toHaveLength(8);
    expect(generateMemory(1, pool.slice(0, MIN_PAIRS - 1), "facil", "mix")).toBeNull();
    const first = generateMemory(2, pool, "facil", "personagens")!.labels;
    const second = generateMemory(3, pool, "facil", "personagens", null, first)!.labels;
    expect(second.filter((label) => first.includes(label))).toHaveLength(0);
    // Na mistura aparecem os três tipos.
    const mix = pickPairs(rng(5), pool, "mix", 9, []);
    expect(new Set(mix.map((pair) => pair.kind))).toEqual(new Set(["personagens", "cenarios", "versiculos"]));
  });

  it("partida perfeita pontua cheio do nível; erros custam; tempo esgotado ou incompleta vale só os pares achados", () => {
    const memory = generateMemory(4, pool, "medio", "mix", 150)!;
    const flips = perfect(memory);
    expect(checkMemory(memory, flips, 10)).toMatchObject({ solved: true, score: 800, detail: "8 tentativas · Médio" });
    const wrongA = memory.cards.findIndex((card) => card.pair === 0);
    const wrongB = memory.cards.findIndex((card) => card.pair === 1);
    expect(checkMemory(memory, [wrongA, wrongB, ...flips], 10).score).toBeLessThan(800);
    expect(checkMemory(memory, [0, 0], 10).solved).toBe(false);
    expect(checkMemory(memory, [0], 10).detail).toBe("Jogadas inválidas");
    expect(checkMemory(memory, [...flips, 0, 1], 10).detail).toBe("Jogadas inválidas");
    const half = checkMemory(memory, flips.slice(0, 8), 10);
    expect(half).toMatchObject({ solved: false, detail: "4 de 8 pares" });
    expect(half.score).toBe(Math.round((4 / 8) * MEMORY_PARTIAL * 0.8));
    const late = checkMemory(memory, flips, 150 + TIME_GRACE + 5);
    expect(late.solved).toBe(false);
    expect(late.detail).toContain("Tempo esgotado");
    expect(Array.isArray(late.reveal)).toBe(true);
  });
});
