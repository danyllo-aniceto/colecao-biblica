/** Sorteio com semente (mulberry32): a mesma partida se repete igual nos testes e na revanche. */
export function nextRandom(seed: number): { value: number; seed: number } {
  let t = (seed + 0x6d2b79f5) | 0;
  const next = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: next };
}

/** Embaralha (Fisher-Yates) e devolve também a nova semente. */
export function shuffled<T>(items: T[], seed: number): { items: T[]; seed: number } {
  const list = [...items];
  let current = seed;
  for (let index = list.length - 1; index > 0; index -= 1) {
    const roll = nextRandom(current);
    current = roll.seed;
    const swap = Math.floor(roll.value * (index + 1));
    [list[index], list[swap]] = [list[swap], list[index]];
  }
  return { items: list, seed: current };
}
