import { describe, expect, it } from "vitest";
import { BOT_RESPAWN_TICKS } from "./bots";
import { FINISH_GRACE_MS, officialTicks, rankRace, raceOver, sanitizeReport, type RaceRunner } from "./room";

const runner = (over: Partial<RaceRunner>): RaceRunner => ({ slot: 0, name: "x", bot: false, finished: false, finishTicks: null, progress: 0, words: 0, deaths: 0, out: false, ...over });

describe("Corrida online: regras da sala", () => {
  it("tempo oficial = passos + a espera de cada volta ao checkpoint", () => {
    expect(officialTicks(3000, 0)).toBe(3000);
    expect(officialTicks(3000, 2)).toBe(3000 + 2 * BOT_RESPAWN_TICKS);
    expect(officialTicks(3000, -4)).toBe(3000);
  });

  it("a corrida acaba quando todos terminaram ou saíram, depois da folga da 1ª chegada ou no tempo máximo", () => {
    const start = 1_000_000;
    const running = [runner({ slot: 0 }), runner({ slot: 1 })];
    expect(raceOver(running, start + 10_000, null, start, 200_000)).toBe(false);
    expect(raceOver([runner({ finished: true }), runner({ out: true })], start + 10_000, start + 5000, start, 200_000)).toBe(true);
    expect(raceOver(running, start + 5000 + FINISH_GRACE_MS - 1, start + 5000, start, 200_000)).toBe(false);
    expect(raceOver(running, start + 5000 + FINISH_GRACE_MS, start + 5000, start, 200_000)).toBe(true);
    expect(raceOver(running, start + 200_000, null, start, 200_000)).toBe(true);
  });

  it("placar: chegou pelo tempo oficial; depois mais longe; quem saiu fica atrás de quem seguiu na mesma distância", () => {
    const ranked = rankRace([
      runner({ slot: 0, name: "longe", progress: 0.8 }),
      runner({ slot: 1, name: "lento", finished: true, finishTicks: 3200, progress: 1 }),
      runner({ slot: 2, name: "saiu", progress: 0.8, out: true }),
      runner({ slot: 3, name: "rapido", finished: true, finishTicks: 3000, progress: 1 }),
    ]);
    expect(ranked.map((item) => item.name)).toEqual(["rapido", "lento", "longe", "saiu"]);
    expect(ranked.map((item) => item.place)).toEqual([1, 2, 3, 4]);
  });

  it("lê o relatório de posição: números dentro da fase, forma válida; lixo é recusado", () => {
    const ok = sanitizeReport({ x: 1200, y: 300, form: "RUN", dead: false, deaths: 1, words: 2 }, 12_000);
    expect(ok).toEqual({ x: 1200, y: 300, form: "RUN", dead: false, deaths: 1, words: 2, progress: 0.1 });
    expect(sanitizeReport({ x: 9e9, y: 0, form: "FLY", deaths: 0, words: 0 }, 12_000)?.x).toBe(12_400);
    for (const bad of [null, "x", { x: "1", y: 0, form: "RUN", deaths: 0, words: 0 }, { x: 1, y: 0, form: "VOAR", deaths: 0, words: 0 }, { x: NaN, y: 0, form: "RUN", deaths: 0, words: 0 }, { x: 1, y: 0, form: "RUN", words: 0 }]) {
      expect(sanitizeReport(bad, 12_000), JSON.stringify(bad)).toBeNull();
    }
  });
});
