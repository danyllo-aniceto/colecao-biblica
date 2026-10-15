/** Sorteio com semente (mulberry32), próprio do modo: o motor não importa nada de fora da pasta. */
export function randomFrom(seed: number) {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Random = ReturnType<typeof randomFrom>;

/** Inteiro de `min` a `max` (inclusive). */
export const between = (random: Random, min: number, max: number) => min + Math.floor(random() * (max - min + 1));
