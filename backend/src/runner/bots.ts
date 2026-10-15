import { maxTicksOf, newPlayer, stepPlayer } from "./engine";
import type { PlayerState, PreparedLevel } from "./types";

/** O bot decide a cada `DECISION_TICKS` passos e olha `DEPTH` decisões à frente (64 caminhos de 48 passos). */
export const DECISION_TICKS = 8;
const DEPTH = 6;

/**
 * Escolhe segurar ou soltar olhando só o que o jogador também enxerga: simula os caminhos possíveis e fica com o que sobrevive,
 * pega mais palavras e mexe menos no toque. Empate: continua como estava.
 */
export function planHold(level: PreparedLevel, player: PlayerState, current: boolean): boolean {
  let best = current;
  let bestScore = -Infinity;
  for (let mask = 0; mask < 1 << DEPTH; mask += 1) {
    let sim = player;
    let switches = 0;
    let last = current;
    for (let decision = 0; decision < DEPTH && sim.status === "running"; decision += 1) {
      const hold = ((mask >> decision) & 1) === 1;
      if (hold !== last) switches += 1;
      last = hold;
      for (let step = 0; step < DECISION_TICKS && sim.status === "running"; step += 1) sim = stepPlayer(level, sim, hold);
    }
    const alive = sim.status !== "dead";
    const first = (mask & 1) === 1;
    const score = (alive ? 1e6 : sim.tick - player.tick) + sim.collected.length * 100 - switches + (first === current ? 0.5 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = first;
    }
  }
  return best;
}

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
