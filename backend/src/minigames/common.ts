/**
 * Peças comuns dos mini games: sorteio com semente, texto sem acento e a conta da pontuação.
 * Tudo puro e sem dependências, como o motor do Tabuleiro e do Duelo.
 */

/** Gerador com semente (mulberry32): a mesma semente sempre sorteia a mesma partida. */
export function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Random = () => number;

export const randInt = (random: Random, min: number, max: number) => min + Math.floor(random() * (max - min + 1));

export function shuffled<T>(random: Random, items: readonly T[]): T[] {
  const list = [...items];
  for (let index = list.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [list[index], list[other]] = [list[other], list[index]];
  }
  return list;
}

/** Letras maiúsculas sem acento (a-z): "João" → "JOAO". Tudo que não é letra some. */
export function lettersOnly(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

/** Pontuação máxima de uma partida: até `ACCURACY_MAX` pela precisão e até `TIME_MAX` pela rapidez. */
export const ACCURACY_MAX = 700;
export const TIME_MAX = 300;

/** Bônus de tempo: cheio até `fast` segundos e perde 1 ponto por segundo a mais. */
export const timeBonus = (seconds: number, fast: number) => Math.max(0, TIME_MAX - Math.max(0, Math.floor(seconds) - fast));

/** Resultado conferido pelo servidor. */
export type Outcome = { solved: boolean; score: number; detail: string };
