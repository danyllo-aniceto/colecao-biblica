import { MAX_STAKES, type DuelResult, type Side } from "./types";

/**
 * Série de rodadas (casual, sem recompensa): rodada única, melhor de 3 ou por vidas (10 vidas, a aposta vira dano,
 * dobrada a partir da rodada 5), como o modo Batalha do Marvel Snap.
 */
export type SeriesFormat = "single" | "bo3" | "lives";

export const SERIES_FORMATS: Array<{ id: SeriesFormat; name: string; text: string }> = [
  { id: "single", name: "Rodada única", text: "Uma rodada decide. Sem aposta: não dá para dobrar." },
  { id: "bo3", name: "Melhor de 3", text: "Vence quem somar 2 pontos. Cada rodada vale a aposta: dobrada, vale 2 pontos e já decide." },
  { id: "lives", name: "Vidas", text: "10 vidas cada. A aposta da rodada vira dano (e dobra a partir da rodada 5)." },
];

export const START_LIVES = 10;
const DOUBLE_FROM_ROUND = 5;

export type Series = {
  format: SeriesFormat;
  /** Número da próxima rodada (1, 2, ...). */
  round: number;
  wins: [number, number];
  lives: [number, number];
  over: boolean;
  winner: Side | null;
  history: Array<{ winner: Side | null; stakes: number }>;
};

export function newSeries(format: SeriesFormat): Series {
  return { format, round: 1, wins: [0, 0], lives: [START_LIVES, START_LIVES], over: false, winner: null, history: [] };
}

/** Aposta da rodada para o dano: dobra a partir da rodada 5 (limitada ao máximo). */
export function damageFor(round: number, stakes: number) {
  return Math.min(MAX_STAKES * 2, round >= DOUBLE_FROM_ROUND ? stakes * 2 : stakes);
}

/** Registra o resultado de uma rodada e diz se a série acabou. */
export function applyRound(series: Series, result: DuelResult): Series {
  if (series.over) return series;
  const next: Series = { ...series, wins: [...series.wins] as [number, number], lives: [...series.lives] as [number, number], history: [...series.history, { winner: result.winner, stakes: result.stakes }] };
  if (result.winner !== null) {
    const loser: Side = result.winner === 0 ? 1 : 0;
    // Melhor de 3 em pontos: a aposta é quanto a rodada vale (dobrar vale 2 pontos). Nos outros formatos, 1 vitória.
    next.wins[result.winner] += series.format === "bo3" ? Math.max(1, result.stakes) : 1;
    next.lives[loser] -= damageFor(series.round, result.stakes);
  }
  next.round = series.round + 1;
  if (series.format === "single") {
    next.over = true;
    next.winner = result.winner;
  } else if (series.format === "bo3") {
    if (next.wins[0] >= 2 || next.wins[1] >= 2) {
      next.over = true;
      next.winner = next.wins[0] > next.wins[1] ? 0 : 1;
    } else if (next.round > 5) {
      // Muitos empates: quem estiver na frente leva; igual, empate.
      next.over = true;
      next.winner = next.wins[0] === next.wins[1] ? null : next.wins[0] > next.wins[1] ? 0 : 1;
    }
  } else {
    if (next.lives[0] <= 0 || next.lives[1] <= 0) {
      next.over = true;
      next.winner = next.lives[0] === next.lives[1] ? null : next.lives[0] > next.lives[1] ? 0 : 1;
    } else if (next.round > 15) {
      next.over = true;
      next.winner = next.lives[0] === next.lives[1] ? null : next.lives[0] > next.lives[1] ? 0 : 1;
    }
  }
  return next;
}
