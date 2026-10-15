import { describe, expect, it } from "vitest";
import { botInputs } from "./bots";
import { prepareLevel, simulate } from "./engine";
import { LEVELS } from "./levels";
import { ROWS } from "./types";

describe("Corrida: fases", () => {
  for (const level of LEVELS) {
    describe(level.name, () => {
      const prepared = prepareLevel(level);

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

      it("não dá para vencer sem tocar na tela", () => {
        expect(simulate(prepared, []).status).not.toBe("finished");
      });

      it("um bot perfeito termina a fase e pega todas as palavras (a fase é possível)", () => {
        const result = simulate(prepared, botInputs(prepared));
        expect(result.status).toBe("finished");
        expect(result.collected).toHaveLength(prepared.wordCount);
      });

      it("a mesma partida do bot se repete igual (o servidor confere pelos toques)", () => {
        const toggles = botInputs(prepared, { skill: 0.7, seed: 3 });
        expect(simulate(prepared, toggles)).toEqual(simulate(prepared, toggles));
      });

      it("um bot distraído erra mais que o perfeito", () => {
        const deaths = Array.from({ length: 8 }, (_, seed) => simulate(prepared, botInputs(prepared, { skill: 0.25, seed: seed + 1 })).status === "dead").filter(Boolean).length;
        expect(deaths).toBeGreaterThan(0);
      });
    });
  }
});
