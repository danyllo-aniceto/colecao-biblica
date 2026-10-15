import { BOT_RESPAWN_TICKS } from "./bots";
import { rankLocal, type LocalEntry } from "./local";

/**
 * Corrida online (até 4): regras puras da sala (o servidor só guarda e confere; ver `services/runner-room.ts`).
 * Sem WebSocket: cada jogador corre no próprio aparelho, manda a posição a cada ~1 s e, ao terminar, a partida inteira (corrente de tentativas com os
 * toques), que o servidor repete (`verifyRun`). O tempo oficial vem dos passos da partida conferida, nunca do relógio do aparelho.
 */
export const MAX_ROOM_PLAYERS = 4;
export const MIN_ROOM_RUNNERS = 2;
/** Da largada marcada pelo anfitrião até o "Já!": dá tempo de todos verem a contagem. */
export const START_DELAY_MS = 6000;
/** Depois da 1ª chegada, os outros têm este tempo para terminar (valem pelo tempo oficial). */
export const FINISH_GRACE_MS = 30_000;
/** Sem sinal por este tempo, a pessoa está fora da corrida. */
export const OFFLINE_MS = 20_000;
/** Folga depois do tempo máximo da fase para a corrida acabar sozinha. */
export const RACE_SLACK_MS = 45_000;
export const BOT_SKILLS = ["APPRENTICE", "STUDENT", "MASTER"] as const;
export type RoomBotSkill = (typeof BOT_SKILLS)[number];

/** Tempo oficial: passos jogados + a espera de cada volta ao checkpoint (o relógio da corrida não para quando alguém cai). */
export function officialTicks(steps: number, deaths: number): number {
  return steps + Math.max(0, deaths) * BOT_RESPAWN_TICKS;
}

export type RaceRunner = { slot: number; name: string; bot: boolean; finished: boolean; finishTicks: number | null; progress: number; words: number; deaths: number; out: boolean };

/** A corrida acaba quando todos terminaram ou saíram, depois da folga que segue a 1ª chegada, ou no tempo máximo. */
export function raceOver(runners: RaceRunner[], now: number, firstFinishAt: number | null, startAt: number, maxMs: number): boolean {
  if (runners.every((runner) => runner.finished || runner.out)) return true;
  if (firstFinishAt !== null && now - firstFinishAt >= FINISH_GRACE_MS) return true;
  return now - startAt >= maxMs;
}

/** Placar final: quem chegou (pelo tempo oficial) e depois quem foi mais longe; empate por palavras e quedas. Quem saiu fica no fim das suas posições. */
export function rankRace(runners: RaceRunner[]): Array<RaceRunner & { place: number }> {
  const entries: Array<LocalEntry & { runner: RaceRunner }> = runners.map((runner) => ({
    name: runner.name,
    color: "",
    progress: runner.out && !runner.finished ? Math.min(runner.progress, 0.999) - 1 : runner.progress,
    finished: runner.finished,
    ticks: runner.finishTicks ?? Number.MAX_SAFE_INTEGER,
    deaths: runner.deaths,
    words: runner.words,
    human: !runner.bot,
    runner,
  }));
  return rankLocal(entries).map((entry, index) => ({ ...(entry as LocalEntry & { runner: RaceRunner }).runner, place: index + 1 }));
}

/** Relatório de posição do aparelho: números finitos, dentro da fase (nunca confiar na tela, mas também não quebrar com lixo). */
export function sanitizeReport(raw: unknown, endX: number): { x: number; y: number; form: "RUN" | "FLY" | "GRAVITY"; dead: boolean; deaths: number; words: number; progress: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const num = (field: unknown, min: number, max: number) => (typeof field === "number" && Number.isFinite(field) ? Math.min(max, Math.max(min, field)) : null);
  const x = num(value.x, 0, endX + 400);
  const y = num(value.y, -200, 800);
  const deaths = num(value.deaths, 0, 999);
  const words = num(value.words, 0, 99);
  const form = value.form === "FLY" || value.form === "GRAVITY" || value.form === "RUN" ? value.form : null;
  if (x === null || y === null || deaths === null || words === null || form === null) return null;
  return { x, y, form, dead: value.dead === true, deaths: Math.floor(deaths), words: Math.floor(words), progress: Math.min(1, x / endX) };
}
