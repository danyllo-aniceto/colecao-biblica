import { describe, expect, it } from "vitest";
import { botInputs, TOUCH_DELAY } from "./bots";
import { CAMPAIGN_LEVELS, SCENARIOS } from "./campaign";
import { prepareLevel, simulate } from "./engine";
import { levelSeconds, TILES_PER_SECOND } from "./journey";

/**
 * Confere as fases da campanha de um cenário: possíveis para o bot perfeito (pega todas as palavras) e para o de toque atrasado (como um dedo de verdade),
 * também sem nenhum poder (poder é bônus, nunca obrigação), com bandeira a cada ~12 s e fora de qualquer obstáculo.
 * Um cenário por arquivo de teste: assim o vitest roda os três em paralelo.
 */
export function describeScenarioLevels(scenarioId: string) {
  const scenario = SCENARIOS.find((item) => item.id === scenarioId)!;
  describe(`Corrida: fases de ${scenario.name}`, () => {
    for (const def of scenario.levels) {
      const level = CAMPAIGN_LEVELS.find((item) => item.id === def.id)!;
      describe(`${def.id} · ${def.name}`, () => {
        const prepared = prepareLevel(level);

        it("dura o combinado e as formas seguem a ordem da fase", () => {
          expect(Math.abs(levelSeconds(level) - def.seconds) / def.seconds).toBeLessThan(0.35);
          expect(level.speed).toBeGreaterThanOrEqual(1);
        });

        it("tem bandeiras em lugar livre e a cada menos de 25 s", () => {
          const checkpoints = level.objects.filter((object) => object.kind === "checkpoint").map((object) => object.x).sort((a, b) => a - b);
          for (const x of checkpoints) {
            const hazards = level.objects
              .filter((object) => object.kind === "spike" || object.kind === "block" || object.kind === "pit" || object.kind === "saw")
              .filter((object) => (object.kind === "pit" ? object.x < x + 3 && object.x + object.w > x - 1 : object.kind === "saw" ? object.x >= x - 2 && object.x < x + 3 : object.x >= x - 1 && object.x < x + 3));
            expect(hazards, `bandeira na coluna ${x}`).toEqual([]);
          }
          const marks = [0, ...checkpoints, level.length];
          for (let index = 1; index < marks.length; index += 1) expect((marks[index] - marks[index - 1]) / (TILES_PER_SECOND * (level.speed ?? 1))).toBeLessThan(25);
        });

        it("o bot perfeito termina e pega todas as palavras", () => {
          const result = simulate(prepared, botInputs(prepared));
          expect(result.status, `${result.cause} na coluna ${Math.round(result.progress * level.length)}`).toBe("finished");
          expect(result.collected).toHaveLength(prepared.wordCount);
        }, 300_000);

        it("com o toque atrasado e sem nenhum poder, o bot também termina", () => {
          const without = prepareLevel({ ...level, objects: level.objects.filter((object) => object.kind !== "power") });
          const result = simulate(without, botInputs(without, { lag: TOUCH_DELAY }));
          expect(result.status, `${result.cause} na coluna ${Math.round(result.progress * level.length)}`).toBe("finished");
        }, 300_000);

        it("com o toque atrasado (e com os poderes) também termina", () => {
          const result = simulate(prepared, botInputs(prepared, { lag: TOUCH_DELAY }));
          expect(result.status, `${result.cause} na coluna ${Math.round(result.progress * level.length)}`).toBe("finished");
        }, 300_000);
      });
    }
  });
}
