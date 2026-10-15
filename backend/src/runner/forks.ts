import type { PowerKind } from "./powers";
import { ROWS, type LevelObject } from "./types";

/**
 * Caminhos diferentes dentro da mesma fase. Cada bifurcação tem um caminho SEGURO (sem recompensa) e um caminho de RECOMPENSA (mais difícil,
 * com palavras e poderes); os dois são possíveis sozinhos (os testes fecham um por vez e conferem). Medidas em colunas (40 px) e linhas.
 */

/** Medidas da bifurcação da corrida. */
export const RUN_FORK = {
  /** Degraus de entrada (2 + 3 colunas): obrigam a pular, e de cima deles dá para subir ao caminho alto. */
  stairs: 5,
  /** Chão livre entre o último degrau e o começo do divisor. */
  gap: 1,
  /** Comprimento do divisor (a "laje" flutuante que separa os dois caminhos). */
  length: 26,
  /** Chão livre depois do fim do divisor. */
  tail: 7,
} as const;

/** Linha onde fica o divisor: altura do chão ao fundo da laje = 3 linhas (120 px), e a laje tem 1 linha de espessura. */
const DIVIDER_ROW = 3;

export type ForkInfo = {
  /** Próxima coluna livre depois da bifurcação. */
  end: number;
  /** Colunas onde o divisor começa e termina (para os testes fecharem um caminho). */
  dividerFrom: number;
  dividerTo: number;
  /** Lugares de palavras do caminho de recompensa (o gerador sorteia quais viram palavras do versículo). */
  rewardWords: Array<{ x: number; y: number }>;
};

/**
 * Corrida: degraus levam a uma laje flutuante.
 * - **Caminho de baixo (seguro):** o chão sob a laje (120 px de altura livre), com 2 espetos para pular. Sem recompensa.
 * - **Caminho de cima (recompensa):** em cima da laje, com 2 espetos, um poder (se houver) e lugares de palavras. Sobe-se pulando dos degraus.
 * Quem cai da laje no fim volta ao chão, num trecho livre.
 */
export function runFork(objects: LevelObject[], x: number, power: PowerKind | null): ForkInfo {
  const { stairs, gap, length, tail } = RUN_FORK;
  const start = x + stairs + gap;
  objects.push({ kind: "block", x, y: 0, w: 2, h: 1 }, { kind: "block", x: x + 2, y: 0, w: 3, h: 2 });
  objects.push({ kind: "block", x: start, y: DIVIDER_ROW, w: length, h: 1 });
  // Caminho de baixo.
  objects.push({ kind: "spike", x: start + 10 }, { kind: "spike", x: start + 20 });
  // Caminho de cima (em cima da laje, linha 4).
  objects.push({ kind: "spike", x: start + 8, y: DIVIDER_ROW + 1 }, { kind: "spike", x: start + 18, y: DIVIDER_ROW + 1 });
  if (power) objects.push({ kind: "power", x: start + 13, y: DIVIDER_ROW + 1, power });
  // Palavras (linha 5) pouco antes de cada espeto de cima: pegam-se no começo do arco do pulo (posições calibradas com os bots: pegam tudo com e sem atraso no toque).
  return { end: start + length + tail, dividerFrom: start, dividerTo: start + length, rewardWords: [{ x: start + 6, y: DIVIDER_ROW + 2 }, { x: start + 16, y: DIVIDER_ROW + 2 }] };
}

/** Medidas das pistas da gravidade. */
export const GRAVITY_LANE = { length: 36 } as const;

export type GravityLaneInfo = { end: number; rewardWords: Array<{ x: number; y: number }> };

/**
 * Gravidade: duas pistas, chão e teto.
 * - **Pista segura:** a oposta à de recompensa, totalmente livre.
 * - **Pista de recompensa** (`reward` = "floor" ou "ceiling"): espetos a cada 9 colunas, um poder (se houver) e lugares de palavras. Dá para pegar tudo trocando
 *   de pista antes de cada espeto e voltando depois (a troca leva ~2 colunas).
 */
export function gravityLane(objects: LevelObject[], x: number, reward: "floor" | "ceiling", power: PowerKind | null): GravityLaneInfo {
  const spike = (column: number): LevelObject => (reward === "floor" ? { kind: "spike", x: column } : { kind: "spike", x: column, y: ROWS - 1, down: true });
  const row = reward === "floor" ? 0 : ROWS - 1;
  objects.push(spike(x + 9), spike(x + 18), spike(x + 27));
  if (power) objects.push({ kind: "power", x: x + 14, y: row, power });
  return { end: x + GRAVITY_LANE.length, rewardWords: [{ x: x + 4, y: row }, { x: x + 22, y: row }, { x: x + 32, y: row }] };
}
