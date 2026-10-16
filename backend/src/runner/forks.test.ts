import { describe, expect, it } from "vitest";
import { botInputs, TOUCH_DELAY } from "./bots";
import { prepareLevel, simulate } from "./engine";
import { flySplit, gravityLane, gravitySlab, runFork, RUN_FORK } from "./forks";
import { ROWS, type Level, type LevelObject } from "./types";

/** Fase curta com uma bifurcação no meio: chão livre antes e depois. */
function runForkLevel(extra: (info: ReturnType<typeof runFork>) => LevelObject[] = () => [], power: "TURBO" | null = "TURBO"): Level {
  const objects: LevelObject[] = [];
  const info = runFork(objects, 14, power);
  objects.push(...extra(info));
  // Palavras do caminho de cima.
  info.rewardWords.forEach((word, index) => objects.push({ kind: "word", x: word.x, y: word.y, index }));
  return { id: "fork", name: "Fork", form: "RUN", length: info.end + 8, verse: { ref: "x", words: ["a", "b"] }, objects };
}

describe("Corrida: bifurcação da corrida (caminho de cima e de baixo)", () => {
  const finish = (level: Level, lag = 0) => {
    const prepared = prepareLevel(level);
    return simulate(prepared, botInputs(prepared, { lag }));
  };

  it("completa: o bot vai pelo caminho de cima, pega as palavras e o poder", () => {
    const level = runForkLevel();
    const result = finish(level);
    expect(result.status).toBe("finished");
    expect(result.collected).toEqual([0, 1]);
    expect(result.powers).toEqual([0]);
  });

  it("caminho de CIMA sozinho: com o chão sob a laje preenchido, só dá para ir por cima, e é possível (também com o toque atrasado)", () => {
    const level = runForkLevel((info) => [{ kind: "block", x: info.dividerFrom, y: 0, w: info.dividerTo - info.dividerFrom, h: 3 }]);
    expect(finish(level).status).toBe("finished");
    expect(finish(level, TOUCH_DELAY).status).toBe("finished");
  });

  it("caminho de BAIXO sozinho: com o teto fechado sobre a laje, só dá para ir por baixo, e é possível (também com o toque atrasado)", () => {
    const level = runForkLevel((info) => [{ kind: "block", x: info.dividerFrom, y: 4, w: info.dividerTo - info.dividerFrom, h: ROWS - 4 }], null);
    expect(finish(level).status).toBe("finished");
    expect(finish(level, TOUCH_DELAY).status).toBe("finished");
  });

  it("o caminho de cima exige subir pelos degraus: sem pular, a fase derruba", () => {
    expect(simulate(prepareLevel(runForkLevel()), []).status).toBe("dead");
    expect(RUN_FORK.length).toBeGreaterThan(20);
  });
});

describe("Corrida: pistas da gravidade (segura e de recompensa)", () => {
  const laneLevel = (reward: "floor" | "ceiling", extra: LevelObject[] = []): Level => {
    const objects: LevelObject[] = [{ kind: "portal", x: 6, form: "GRAVITY" }];
    const info = gravityLane(objects, 20, reward, "SHIELD");
    info.rewardWords.forEach((word, index) => objects.push({ kind: "word", x: word.x, y: word.y, index }));
    objects.push(...extra);
    return { id: "lane", name: "Lane", form: "RUN", length: info.end + 8, verse: { ref: "x", words: ["a", "b", "c"] }, objects };
  };

  for (const reward of ["ceiling", "floor"] as const) {
    it(`pista de recompensa no ${reward === "ceiling" ? "teto" : "chão"}: o bot pega as palavras e o poder desviando dos espetos, e termina (também com o toque atrasado)`, () => {
      const prepared = prepareLevel(laneLevel(reward));
      const exact = simulate(prepared, botInputs(prepared));
      expect(exact.status).toBe("finished");
      expect(exact.collected).toEqual([0, 1, 2]);
      expect(exact.powers).toEqual([0]);
      expect(simulate(prepared, botInputs(prepared, { lag: TOUCH_DELAY })).status).toBe("finished");
    });

    it(`pista segura (${reward === "ceiling" ? "chão" : "teto"}) é totalmente livre: dá para atravessar a seção toda nela`, () => {
      const objects: LevelObject[] = [];
      gravityLane(objects, 20, reward, null);
      const safeSide = (object: LevelObject) => (object.kind === "spike" ? (reward === "floor" ? object.down === true : object.down !== true) : false);
      expect(objects.filter(safeSide)).toEqual([]);
    });
  }
});

describe("Corrida: variantes de caminho (buraco, voo dividido, laje na gravidade)", () => {
  const both = (level: Level) => {
    const prepared = prepareLevel(level);
    return [simulate(prepared, botInputs(prepared)).status, simulate(prepared, botInputs(prepared, { lag: TOUCH_DELAY })).status];
  };

  it("bifurcação da corrida com buraco no caminho de baixo: possível por cima e por baixo", () => {
    const objects: LevelObject[] = [];
    const info = runFork(objects, 14, null, "PIT");
    expect(objects.some((object) => object.kind === "pit")).toBe(true);
    const base = { id: "f", name: "F", form: "RUN" as const, length: info.end + 8, verse: { ref: "x", words: ["a"] } };
    expect(both({ ...base, objects: [...objects, { kind: "word", x: info.end - 4, y: 0, index: 0 }] })).toEqual(["finished", "finished"]);
    // Só por baixo (teto fechado sobre a laje) e só por cima (chão sob a laje preenchido).
    expect(both({ ...base, objects: [...objects, { kind: "block", x: info.dividerFrom, y: 4, w: info.dividerTo - info.dividerFrom, h: ROWS - 4 }, { kind: "word", x: info.end - 4, y: 0, index: 0 }] })).toEqual(["finished", "finished"]);
  });

  it("voo dividido: cada corredor é possível sozinho", () => {
    const build = (extra: (info: ReturnType<typeof flySplit>) => LevelObject[]): Level => {
      const objects: LevelObject[] = [{ kind: "portal", x: 6, form: "FLY" }];
      const info = flySplit(objects, 20, "SHIELD");
      objects.push(...extra(info));
      return { id: "s", name: "S", form: "RUN", length: info.end + 8, verse: { ref: "x", words: ["a"] }, objects: [...objects, { kind: "word", x: info.end - 2, y: 3, index: 0 }] };
    };
    expect(both(build(() => []))).toEqual(["finished", "finished"]);
    // Corredor de baixo fechado (linhas 0 a 2 sob o divisor): só pelo de cima.
    expect(both(build((info) => [{ kind: "block", x: info.dividerFrom, y: 0, w: info.dividerTo - info.dividerFrom, h: 3 }]))).toEqual(["finished", "finished"]);
  });

  for (const powerUp of [true, false]) {
    it(`gravidade com laje (poder ${powerUp ? "em cima" : "embaixo"}): o bot termina e pega o poder, também com o toque atrasado`, () => {
      const objects: LevelObject[] = [{ kind: "portal", x: 6, form: "GRAVITY" }];
      const info = gravitySlab(objects, 20, "SHIELD", powerUp);
      const level: Level = { id: "g", name: "G", form: "RUN", length: info.end + 8, verse: { ref: "x", words: ["a"] }, objects: [...objects, { kind: "word", x: info.end - 1, y: 0, index: 0 }] };
      expect(both(level)).toEqual(["finished", "finished"]);
    });
  }
});
