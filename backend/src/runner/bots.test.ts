import { beforeAll, describe, expect, it } from "vitest";
import { BOT_LEVELS, botInputs, createBot, TOUCH_DELAY } from "./bots";
import { prepareLevel, respawnAt, simulate } from "./engine";
import { buildJourney, levelSeconds, TILES_PER_SECOND } from "./journey";
import { BASE_LEVELS } from "./levels";
import { POWERS_BY_FORM } from "./powers";
import { ROWS, TICKS_PER_SECOND, type RunResult } from "./types";

describe("Corrida: fases", () => {
  // As fases da campanha (30) são conferidas à parte, um cenário por arquivo (`campaign-levels.shared.ts`), para rodar em paralelo.
  for (const level of BASE_LEVELS) {
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
          const hazards = level.objects
            .filter((object) => object.kind === "spike" || object.kind === "block" || object.kind === "pit" || object.kind === "saw")
            // Buraco ocupa várias colunas: conta se alguma delas cai na janela da bandeira. Serra: 1 coluna de cada lado (a onda anda para os lados).
            .filter((object) => (object.kind === "pit" ? object.x < x + 3 && object.x + object.w > x - 1 : object.kind === "saw" ? object.x >= x - 2 && object.x < x + 3 : object.x >= x - 1 && object.x < x + 3));
          expect(hazards, `checkpoint na coluna ${x}`).toEqual([]);
        }
        // Nunca mais de ~25 s sem bandeira.
        const marks = [0, ...checkpoints, level.length];
        for (let index = 1; index < marks.length; index += 1) expect((marks[index] - marks[index - 1]) / (TILES_PER_SECOND * (level.speed ?? 1))).toBeLessThan(25);
      });

      it("todo checkpoint é um ponto de volta seguro: voltando a ele, o bot segue por pelo menos 10 s sem cair", () => {
        for (let count = 1; count <= prepared.checkpoints.length; count += 1) {
          const bot = createBot(prepared, { from: respawnAt(prepared, count), lag: TOUCH_DELAY });
          const until = 600;
          while (bot.player.status === "running" && bot.elapsed < until) bot.step();
          expect(bot.player.status, `checkpoint ${count} (coluna ${prepared.checkpoints[count - 1] / 40})`).not.toBe("dead");
        }
      }, 120_000);

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
    const journey = BASE_LEVELS.find((level) => level.id === "jornada");
    expect(journey).toBeDefined();
    const seconds = levelSeconds(journey!);
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

  it("as jornadas trazem poderes e bifurcações, e continuam possíveis sem nenhum poder (poder é bônus, nunca obrigação)", () => {
    const kinds = new Set<string>();
    for (const seed of [2, 5, 9]) {
      const level = buildJourney({ id: "t", name: "T", seed, seconds: 75, verse: { ref: "x", words: ["a", "b", "c", "d", "e", "f"] } });
      const powers = level.objects.filter((object) => object.kind === "power");
      expect(powers.length, `semente ${seed}: poderes`).toBeGreaterThan(0);
      for (const object of powers) kinds.add((object as { power: string }).power);
      const without = prepareLevel({ ...level, objects: level.objects.filter((object) => object.kind !== "power") });
      expect(simulate(without, botInputs(without, { lag: TOUCH_DELAY })).status, `semente ${seed} (sem poderes)`).toBe("finished");
      const prepared = prepareLevel(level);
      expect(simulate(prepared, botInputs(prepared, { lag: TOUCH_DELAY })).status, `semente ${seed} (com poderes)`).toBe("finished");
    }
    expect(kinds.size, "tipos de poder nas jornadas").toBeGreaterThan(1);
  }, 240_000);

  it("a dificuldade sobe: fases fáceis não têm buracos duplos nem escadas, as difíceis têm; poderes são poucos", () => {
    const count = (difficulty: number, seed: number) => buildJourney({ id: "t", name: "T", seed, seconds: 150, difficulty, order: ["RUN", "GRAVITY"], verse: { ref: "x", words: ["a", "b", "c", "d"] } });
    const hazardsPerSecond = (level: ReturnType<typeof count>) => level.objects.filter((object) => object.kind === "spike" || object.kind === "pit" || object.kind === "saw" || object.kind === "block").length / levelSeconds(level);
    let easy = 0;
    let hard = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      easy += hazardsPerSecond(count(0, seed));
      hard += hazardsPerSecond(count(1, seed));
    }
    expect(hard).toBeGreaterThan(easy);
    // Menos de 1 poder a cada ~12 s de fase.
    for (const seed of [1, 2, 3]) {
      const level = buildJourney({ id: "t", name: "T", seed, seconds: 150, verse: { ref: "x", words: ["a", "b", "c", "d"] } });
      const powers = level.objects.filter((object) => object.kind === "power").length;
      expect(powers, `semente ${seed}`).toBeLessThan(150 / 12);
    }
  });

  it("a gravidade e a corrida trazem buracos, lajes e voo dividido (mapas variados)", () => {
    const kinds = new Set<string>();
    for (const seed of [3, 4, 5, 6, 7, 8]) {
      const level = buildJourney({ id: "t", name: "T", seed, seconds: 150, difficulty: 0.8, verse: { ref: "x", words: ["a", "b", "c", "d"] } });
      for (const object of level.objects) {
        if (object.kind === "pit") kinds.add(`pit-${object.side}`);
      }
    }
    expect(kinds.has("pit-floor")).toBe(true);
    expect(kinds.has("pit-ceiling")).toBe(true);
  });

  it("cada poder aparece numa forma em que faz sentido (sem Pulo triplo no voo nem na gravidade)", () => {
    for (const seed of [2, 5, 9, 14]) {
      const level = buildJourney({ id: "t", name: "T", seed, seconds: 90, verse: { ref: "x", words: ["a", "b", "c", "d", "e", "f"] } });
      const portals = level.objects.filter((object) => object.kind === "portal") as Array<{ x: number; form: "RUN" | "FLY" | "GRAVITY" }>;
      for (const object of level.objects) {
        if (object.kind !== "power") continue;
        const form = portals.filter((portal) => portal.x <= object.x).pop()?.form ?? level.form;
        expect(POWERS_BY_FORM[form], `semente ${seed}: ${object.power} na coluna ${object.x} (${form})`).toContain(object.power);
      }
    }
  });

  it("bots ao vivo: voltam ao checkpoint depois de cair e terminam; o Mestre chega antes do Aprendiz", () => {
    const level = buildJourney({ id: "t", name: "T", seed: 3, seconds: 75, verse: { ref: "x", words: ["a", "b"] } });
    const prepared = prepareLevel(level);
    const finish = (name: keyof typeof BOT_LEVELS) => {
      const bot = createBot(prepared, { skill: BOT_LEVELS[name].skill, lag: BOT_LEVELS[name].lag, seed: 5, respawn: true });
      while (bot.player.status !== "finished" && bot.elapsed < 60 * 600) bot.step();
      return bot;
    };
    const master = finish("MASTER");
    const apprentice = finish("APPRENTICE");
    expect(master.player.status).toBe("finished");
    expect(apprentice.player.status).toBe("finished");
    expect(apprentice.deaths).toBeGreaterThan(master.deaths);
    expect(master.elapsed).toBeLessThan(apprentice.elapsed);
  }, 240_000);

  it("a mesma semente gera sempre a mesma jornada, e sementes diferentes geram fases diferentes", () => {
    const base = { id: "t", name: "T", seconds: 60, verse: { ref: "x", words: ["a", "b", "c"] } };
    expect(buildJourney({ ...base, seed: 1 })).toEqual(buildJourney({ ...base, seed: 1 }));
    expect(buildJourney({ ...base, seed: 1 })).not.toEqual(buildJourney({ ...base, seed: 2 }));
  });
});
