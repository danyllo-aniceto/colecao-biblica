import { describe, expect, it } from "vitest";
import { CAMPAIGN_LEVELS, CAMPAIGN_ORDER, isCharacterUnlocked, isLevelUnlocked, isScenarioUnlocked, SCENARIOS } from "./campaign";

/** Personagens da migração 20261106090000: fase que abre cada um. */
const UNLOCKS = { jonatas: "cd-3", joabe: "cd-5", moises: "mv-2", arao: "mv-3", miria: "mv-4", ezequiel: "vo-3" };

describe("Corrida: campanha por cenários", () => {
  it("toda fase que abre personagem existe na campanha", () => {
    for (const levelId of Object.values(UNLOCKS)) expect(CAMPAIGN_ORDER).toContain(levelId);
  });

  it("tem os 3 cenários, cada um com várias fases, ids únicos e versículo completo", () => {
    expect(SCENARIOS.map((scenario) => scenario.id)).toEqual(["cidade-de-davi", "mar-vermelho", "vale-dos-ossos-secos"]);
    expect(new Set(CAMPAIGN_ORDER).size).toBe(CAMPAIGN_ORDER.length);
    for (const scenario of SCENARIOS) expect(scenario.levels.length).toBeGreaterThanOrEqual(3);
    for (const level of CAMPAIGN_LEVELS) expect(level.verse?.words.length).toBeGreaterThan(4);
  });

  it("as fases ficam mais longas ao longo do cenário", () => {
    for (const scenario of SCENARIOS) {
      const seconds = scenario.levels.map((def) => def.seconds);
      expect(seconds).toEqual([...seconds].sort((a, b) => a - b));
    }
  });

  it("a fase seguinte só abre ao concluir a anterior, atravessando os cenários", () => {
    const none = new Set<string>();
    expect(isLevelUnlocked("cd-1", none)).toBe(true);
    expect(isLevelUnlocked("cd-2", none)).toBe(false);
    expect(isLevelUnlocked("cd-2", new Set(["cd-1"]))).toBe(true);
    expect(isLevelUnlocked("mv-1", new Set(["cd-4"]))).toBe(false);
    expect(isLevelUnlocked("mv-1", new Set(["cd-5"]))).toBe(true);
  });

  it("o cenário seguinte abre só com o anterior concluído por inteiro", () => {
    const davi = new Set(SCENARIOS[0].levels.map((def) => def.id));
    expect(isScenarioUnlocked("cidade-de-davi", new Set())).toBe(true);
    expect(isScenarioUnlocked("mar-vermelho", new Set(["cd-1", "cd-2"]))).toBe(false);
    expect(isScenarioUnlocked("mar-vermelho", davi)).toBe(true);
    expect(isScenarioUnlocked("vale-dos-ossos-secos", davi)).toBe(false);
  });

  it("personagem sem fase é do começo; com fase abre ao concluí-la", () => {
    expect(isCharacterUnlocked(null, new Set())).toBe(true);
    expect(isCharacterUnlocked("cd-3", new Set(["cd-2"]))).toBe(false);
    expect(isCharacterUnlocked("cd-3", new Set(["cd-3"]))).toBe(true);
  });
});
