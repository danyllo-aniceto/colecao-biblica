import { ACCURACY_MAX, rng, shuffled, timeBonus, type Outcome } from "./common";

/** Memória: 6 pares (12 cartas), cada par é um cenário e a sua referência bíblica. */
export const MEMORY_PAIRS = 6;

export type MemoryCard = { pair: number; text: string };
export type Memory = { cards: MemoryCard[] };
export type MemoryPair = { name: string; match: string };

export function generateMemory(seed: number, pairs: MemoryPair[]): Memory {
  const random = rng(seed);
  const chosen = shuffled(random, pairs).slice(0, MEMORY_PAIRS);
  const cards = chosen.flatMap((pair, index) => [
    { pair: index, text: pair.name },
    { pair: index, text: pair.match },
  ]);
  return { cards: shuffled(random, cards) };
}

/**
 * Confere a partida pela lista de cartas viradas, de duas em duas: cada tentativa vira duas cartas diferentes e ainda fechadas;
 * se forem do mesmo par, ficam abertas. Resolvida quando todos os pares foram achados.
 */
export function checkMemory(memory: Memory, flips: number[], seconds: number): Outcome {
  if (flips.length % 2 !== 0 || flips.length > 400) return { solved: false, score: 0, detail: "Jogadas inválidas" };
  const matched = new Set<number>();
  for (let index = 0; index < flips.length; index += 2) {
    const [a, b] = [flips[index], flips[index + 1]];
    if (![a, b].every((card) => Number.isInteger(card) && card >= 0 && card < memory.cards.length) || a === b || matched.has(a) || matched.has(b)) {
      return { solved: false, score: 0, detail: "Jogadas inválidas" };
    }
    if (memory.cards[a].pair === memory.cards[b].pair) {
      matched.add(a);
      matched.add(b);
    }
  }
  const solved = matched.size === memory.cards.length;
  if (!solved) return { solved: false, score: 0, detail: "Faltaram pares" };
  const attempts = flips.length / 2;
  const pairs = memory.cards.length / 2;
  return { solved: true, score: Math.max(0, ACCURACY_MAX - (attempts - pairs) * 50) + timeBonus(seconds, 40), detail: `${attempts} tentativas` };
}
