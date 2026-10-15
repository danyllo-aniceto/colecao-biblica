import { maxTicksOf, newPlayer, stepPlayer } from "./engine";
import { randomFrom } from "./rng";
import type { PlayerState, PreparedLevel } from "./types";

/** O bot decide a cada `DECISION_TICKS` passos e olha `DEPTH` decisões à frente (até 128 caminhos, ~56 passos de horizonte). */
export const DECISION_TICKS = 8;
const DEPTH = 7;

/** Atraso do toque (em passos) que o bot tenta aguentar: o dedo de gente real nunca é exato (~50 ms). */
export const TOUCH_DELAY = 3;

/**
 * Escolhe segurar ou soltar olhando só o que o jogador também enxerga: percorre a árvore de decisões (cada nó repete a mesma ação por
 * `DECISION_TICKS` passos) e fica com o caminho que sobrevive, pega mais palavras e mexe menos no toque. Empate: prefere soltar (toques curtos, como gente: segurar dá pulo automático em sequência, que é frágil).
 * Cada caminho roda duas vezes, uma exata e outra com o toque atrasado em `delay` passos; o preferido sobrevive nas duas, então a fase
 * não depende de acertar o instante exato (nem o bot nem a fase ficam "no fio da navalha").
 */
export function planHold(level: PreparedLevel, player: PlayerState, current: boolean, delay = TOUCH_DELAY): boolean {
  let best = current;
  let bestScore = -Infinity;
  const visit = (exact: PlayerState, late: PlayerState, depth: number, last: boolean, switches: number, first: boolean) => {
    if (depth === DEPTH || exact.status !== "running") {
      const alive = exact.status !== "dead";
      const lateAlive = late.status !== "dead";
      const base = !alive ? exact.tick - player.tick : lateAlive ? 2e6 : 1e6;
      const score = base + exact.collected.length * 100 - switches + (first ? 0 : 2);
      if (score > bestScore) {
        bestScore = score;
        best = first;
      }
      return;
    }
    for (const hold of [last, !last]) {
      let nextExact = exact;
      let nextLate = late;
      for (let step = 0; step < DECISION_TICKS; step += 1) {
        if (nextExact.status === "running") nextExact = stepPlayer(level, nextExact, hold);
        if (nextLate.status === "running") nextLate = stepPlayer(level, nextLate, step < delay ? last : hold);
      }
      visit(nextExact, nextLate, depth + 1, hold, switches + (hold !== last ? 1 : 0), depth === 0 ? hold : first);
    }
  };
  visit(player, player, 0, current, 0, current);
  return best;
}

/**
 * Partida inteira de um bot, devolvida como lista de toques (a mesma forma do jogador).
 * `skill` (0 a 1) é a chance de pensar a cada decisão; quando "distrai", repete o que estava fazendo: quanto menor, mais erra.
 * `lag` é o atraso do toque em passos: a decisão só vale `lag` passos depois, como o dedo de gente real; o bot continua replanejando
 * a cada decisão a partir do que vê. Use `lag` ~ `TOUCH_DELAY` para provar que uma fase não exige precisão de 1 passo.
 */
export function botInputs(level: PreparedLevel, options: { skill?: number; seed?: number; lag?: number } = {}): number[] {
  const skill = options.skill ?? 1;
  const lag = Math.max(0, Math.floor(options.lag ?? 0));
  const random = randomFrom(options.seed ?? 1);
  const toggles: number[] = [];
  let player = newPlayer(level);
  let hold = false;
  let intended = false;
  let pending: { at: number; hold: boolean } | null = null;
  const limit = maxTicksOf(level);
  while (player.status === "running" && player.tick < limit) {
    if (player.tick % DECISION_TICKS === 0 && (skill >= 1 || random() < skill)) {
      const next = planHold(level, player, hold);
      if (next !== intended) {
        intended = next;
        if (lag === 0) {
          if (next !== hold) {
            toggles.push(player.tick);
            hold = next;
          }
        } else {
          pending = { at: player.tick + lag, hold: next };
        }
      }
    }
    if (pending && player.tick >= pending.at) {
      if (pending.hold !== hold) {
        toggles.push(player.tick);
        hold = pending.hold;
      }
      pending = null;
    }
    player = stepPlayer(level, player, hold);
  }
  return toggles;
}
