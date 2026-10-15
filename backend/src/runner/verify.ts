import { MAX_INPUTS, maxTicksOf, newPlayer, progressOf, respawnAt, stepPlayer } from "./engine";
import type { PlayerState, PreparedLevel } from "./types";

/**
 * Conferência de uma partida da campanha pelos toques (o servidor repete tudo; a tela nunca manda pontos).
 * Uma partida é uma **corrente de tentativas**: a 1ª sai do início da fase; cada uma das seguintes sai do último checkpoint alcançado (é o que
 * o jogo faz ao cair e tocar em "Voltar ao último checkpoint"). Cada tentativa é uma lista de passos em que o dedo desce/sobe, contados **a partir
 * do começo da própria tentativa** (a mesma lista que `simulate` usa). Recomeçar do início zera a corrente (o app só manda a corrente atual).
 */
export type RunSegment = { fromCheckpoint: boolean; toggles: number[] };

export const MAX_SEGMENTS = 60;
export const MAX_TOTAL_TOGGLES = 20_000;

/** Lê o que veio do cliente: lista de tentativas com toques inteiros crescentes. `null` = formato inválido. */
export function parseSegments(raw: unknown, maxTicks: number): RunSegment[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_SEGMENTS) return null;
  const segments: RunSegment[] = [];
  let total = 0;
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const { fromCheckpoint, toggles } = item as { fromCheckpoint?: unknown; toggles?: unknown };
    if (typeof fromCheckpoint !== "boolean" || !Array.isArray(toggles) || toggles.length > MAX_INPUTS) return null;
    let last = -1;
    for (const value of toggles) {
      if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > maxTicks || value <= last) return null;
      last = value;
    }
    total += toggles.length;
    if (total > MAX_TOTAL_TOGGLES) return null;
    segments.push({ fromCheckpoint, toggles: toggles as number[] });
  }
  return segments;
}

export type RunVerdict =
  | { ok: true; /** Maior parte da fase percorrida (0–1). */ progress: number; /** Palavras pegas na melhor tentativa. */ words: number; finished: boolean; allWords: boolean; clean: boolean; deaths: number }
  | { ok: false; reason: string };

/** Estrelas da fase: terminar, pegar todas as palavras e terminar sem cair (cada critério vale uma, só contam com a fase terminada). */
export function starsOf(best: { finished: boolean; allWords: boolean; clean: boolean }): number {
  return best.finished ? 1 + (best.allWords ? 1 : 0) + (best.clean ? 1 : 0) : 0;
}

type Snapshot = { count: number; collected: number[]; powers: number[]; tick: number };

/** Repete a partida e devolve o resultado, ou o motivo de recusar (toques impossíveis, tentativa fora de ordem, partida que não termina). */
export function verifyRun(level: PreparedLevel, segments: RunSegment[]): RunVerdict {
  const maxTicks = maxTicksOf(level);
  let snapshot: Snapshot | null = null;
  let progress = 0;
  let words = 0;
  let last: PlayerState = newPlayer(level);
  for (const [index, segment] of segments.entries()) {
    if (index === 0 && segment.fromCheckpoint) return { ok: false, reason: "A primeira tentativa sai do início da fase." };
    if (index > 0 && !segment.fromCheckpoint) return { ok: false, reason: "Depois de cair, a tentativa sai do último checkpoint." };
    let player: PlayerState;
    if (index === 0) {
      player = newPlayer(level);
    } else if (snapshot) {
      player = respawnAt(level, snapshot.count, snapshot.collected, snapshot.tick, snapshot.powers);
    } else {
      return { ok: false, reason: "Não há checkpoint alcançado para voltar." };
    }
    let next = 0;
    let held = false;
    for (let step = 0; step < maxTicks && player.status === "running"; step += 1) {
      while (next < segment.toggles.length && segment.toggles[next] <= step) {
        held = !held;
        next += 1;
      }
      const before = player;
      player = stepPlayer(level, player, held);
      // Mesma regra do jogo: o checkpoint vale ao cruzar a bandeira com o personagem vivo.
      if (player.checkpoint > before.checkpoint && player.status === "running") snapshot = { count: player.checkpoint, collected: [...player.collected], powers: [...player.powers], tick: player.tick };
    }
    if (player.status === "running") return { ok: false, reason: "A tentativa não terminou no tempo da fase." };
    const isLast = index === segments.length - 1;
    if (!isLast && player.status !== "dead") return { ok: false, reason: "Só se volta ao checkpoint depois de cair." };
    progress = Math.max(progress, progressOf(level, player));
    words = Math.max(words, player.collected.length);
    last = player;
  }
  const finished = last.status === "finished";
  return {
    ok: true,
    progress: finished ? 1 : progress,
    words,
    finished,
    allWords: finished && level.wordCount > 0 && last.collected.length === level.wordCount,
    clean: finished && segments.length === 1,
    deaths: segments.length - 1 + (finished ? 0 : 1),
  };
}
