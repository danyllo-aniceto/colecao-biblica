import { maxTicksOf, newPlayer, stepPlayer } from "./engine";
import { randomFrom } from "./rng";
import type { PlayerState, PreparedLevel } from "./types";

/** O bot decide a cada `DECISION_TICKS` passos e olha `DEPTH` decisões à frente (até 128 caminhos, ~56 passos de horizonte). */
export const DECISION_TICKS = 8;
const DEPTH = 7;

/**
 * Escolhe segurar ou soltar olhando só o que o jogador também enxerga: percorre a árvore de decisões (cada nó repete a mesma ação por
 * `DECISION_TICKS` passos) e fica com o caminho que sobrevive, pega mais palavras e mexe menos no toque. Empate: continua como estava.
 */
export function planHold(level: PreparedLevel, player: PlayerState, current: boolean): boolean {
  let best = current;
  let bestScore = -Infinity;
  const visit = (sim: PlayerState, depth: number, last: boolean, switches: number, first: boolean) => {
    if (depth === DEPTH || sim.status !== "running") {
      const alive = sim.status !== "dead";
      const score = (alive ? 1e6 : sim.tick - player.tick) + sim.collected.length * 100 - switches + (first === current ? 0.5 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = first;
      }
      return;
    }
    for (const hold of [last, !last]) {
      let next = sim;
      for (let step = 0; step < DECISION_TICKS && next.status === "running"; step += 1) next = stepPlayer(level, next, hold);
      visit(next, depth + 1, hold, switches + (hold !== last ? 1 : 0), depth === 0 ? hold : first);
    }
  };
  visit(player, 0, current, 0, current);
  return best;
}

/**
 * Partida inteira de um bot, devolvida como lista de toques (a mesma forma do jogador).
 * `skill` (0 a 1) é a chance de pensar a cada decisão; quando "distrai", repete o que estava fazendo: quanto menor, mais erra.
 */
export function botInputs(level: PreparedLevel, options: { skill?: number; seed?: number } = {}): number[] {
  const skill = options.skill ?? 1;
  const random = randomFrom(options.seed ?? 1);
  const toggles: number[] = [];
  let player = newPlayer(level);
  let hold = false;
  const limit = maxTicksOf(level);
  while (player.status === "running" && player.tick < limit) {
    if (player.tick % DECISION_TICKS === 0 && (skill >= 1 || random() < skill)) {
      const next = planHold(level, player, hold);
      if (next !== hold) {
        toggles.push(player.tick);
        hold = next;
      }
    }
    player = stepPlayer(level, player, hold);
  }
  return toggles;
}
