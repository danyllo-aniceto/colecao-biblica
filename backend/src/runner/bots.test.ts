import { beforeAll, describe, expect, it } from "vitest";
import { botInputs, TOUCH_DELAY } from "./bots";
import { prepareLevel, simulate } from "./engine";
import { buildJourney, TILES_PER_SECOND } from "./journey";
import { LEVELS } from "./levels";
import { ROWS, TICKS_PER_SECOND, type RunResult } from "./types";

describe("Corrida: fases", () => {
  for (const level of LEVELS) {
    describe(level.name, () => {
      const prepared = prepareLevel(level);
      let perfectToggles: number[] = [];
      let perfect: RunResult;

      beforeAll(() => {
        perfectToggles = botInputs(prepared);
        perfect = simulate(prepared, perfectToggles);
      }, 120_000);

      it("tem objetos dentro do campo e portais em ordem", () => {
        for (const object of level.objects) {
          expect(object.x).toBeGreaterThanOrEqual(0);
          expect(object.x).toBeLessThan(level.length);
          if (object.kind === "block") expect(object.y + object.h).toBeLessThanOrEqual(ROWS);
          if (object.kind === "spike" || object.kind === "word") expect(object.y ?? 0).toBeLessThan(ROWS);
        }
        const portals = level.objects.filter((object) => object.kind === "portal").map((object) => object.x);
        expect(portals).toEqual([...portals].sort((a, b) => a - b));
      });

      it("tem checkpoints em lugares livres (3+ colunas antes de qualquer obstáculo) e a cada ~12 s", () => {
        const checkpoints = level.objects.filter((object) => object.kind === "checkpoint").map((object) => object.x).sort((a, b) => a - b);
        expect(checkpoints.length).toBeGreaterThan(2);
        for (const x of checkpoints) {
          const hazards = level.objects.filter((object) => object.kind === "spike" || object.kind === "block").filter((object) => object.x >= x - 1 && object.x < x + 3);
          expect(hazards, `checkpoint na coluna ${x}`).toEqual([]);
        }
        // Nunca mais de ~25 s sem bandeira.
        const marks = [0, ...checkpoints, level.length];
        for (let index = 1; index < marks.length; index += 1) expect((marks[index] - marks[index - 1]) / TILES_PER_SECOND).toBeLessThan(25);
      });

      it("as palavras do versículo existem uma vez cada", () => {
        const indexes = level.objects.filter((object) => object.kind === "word").map((object) => (object as { index: number }).index);
        expect(new Set(indexes).size).toBe(indexes.length);
        expect(indexes.length).toBe(level.verse?.words.length);
      });

      it("não dá para vencer sem tocar na tela", () => {
        expect(simulate(prepared, []).status).not.toBe("finished");
      });

      it("um bot perfeito termina a fase e pega todas as palavras (a fase é possível)", () => {
        expect(perfect.status).toBe("finished");
        expect(perfect.collected).toHaveLength(prepared.wordCount);
      });

      it("com o toque atrasado (como um dedo de verdade), o bot também termina: a fase não exige precisão de 1 passo", () => {
        const result = simulate(prepared, botInputs(prepared, { lag: TOUCH_DELAY }));
        expect(result.status).toBe("finished");
      }, 120_000);

      it("a mesma partida se repete igual (o servidor confere pelos toques)", () => {
        expect(simulate(prepared, perfectToggles)).toEqual(perfect);
      });

      it("um bot distraído erra mais que o perfeito", () => {
        const deaths = Array.from({ length: 6 }, (_, seed) => simulate(prepared, botInputs(prepared, { skill: 0.25, seed: seed + 1 })).status === "dead").filter(Boolean).length;
        expect(deaths).toBeGreaterThan(0);
      }, 120_000);
    });
  }

  it("a jornada dura minutos", () => {
    const journey = LEVELS.find((level) => level.id === "jornada");
    expect(journey).toBeDefined();
    const seconds = journey!.length / TILES_PER_SECOND;
    expect(seconds).toBeGreaterThan(120);
    expect(TICKS_PER_SECOND).toBe(60);
  });

  it("jornadas geradas por sementes diferentes são possíveis e confortáveis (toque atrasado)", () => {
    for (const seed of [1, 6]) {
      const level = buildJourney({ id: "t", name: "T", seed, seconds: 60, verse: { ref: "x", words: ["a", "b", "c", "d"] } });
      const prepared = prepareLevel(level);
      expect(simulate(prepared, botInputs(prepared)).status, `semente ${seed} (exato)`).toBe("finished");
      expect(simulate(prepared, botInputs(prepared, { lag: TOUCH_DELAY })).status, `semente ${seed} (atrasado)`).toBe("finished");
    }
  }, 240_000);

  it("a mesma semente gera sempre a mesma jornada, e sementes diferentes geram fases diferentes", () => {
    const base = { id: "t", name: "T", seconds: 60, verse: { ref: "x", words: ["a", "b", "c"] } };
    expect(buildJourney({ ...base, seed: 1 })).toEqual(buildJourney({ ...base, seed: 1 }));
    expect(buildJourney({ ...base, seed: 1 })).not.toEqual(buildJourney({ ...base, seed: 2 }));
  });
});
