import { describe, expect, it } from "vitest";
import { buildCampaignLevel, CAMPAIGN_LEVELS, CAMPAIGN_ORDER, isCharacterUnlocked, isLevelUnlocked, isScenarioUnlocked, SCENARIOS, validateLevelDef, verseWords } from "./campaign";

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

  it("a campanha aceita cenários e fases de qualquer lista (do banco), na ordem dada", () => {
    const [davi, mar] = SCENARIOS;
    const reversed = [mar, davi];
    expect(isLevelUnlocked("mv-1", new Set(), reversed)).toBe(true);
    expect(isLevelUnlocked("cd-1", new Set(["mv-4"]), reversed)).toBe(true);
    expect(isLevelUnlocked("cd-1", new Set(), reversed)).toBe(false);
    expect(isScenarioUnlocked("cidade-de-davi", new Set(), reversed)).toBe(false);
  });

  it("o cenário leva céu, arte e trilha para dentro da fase (só os campos preenchidos)", () => {
    const scenario = { ...SCENARIOS[0], art: { far: "/a.png", spike: "/s.png", block: "" }, music: "/m.mp3" };
    const level = buildCampaignLevel(scenario, scenario.levels[0]);
    expect(level.art).toEqual({ far: "/a.png", spike: "/s.png" });
    expect(level.music).toBe("/m.mp3");
    expect(level.theme).toEqual(scenario.theme);
    expect(buildCampaignLevel(SCENARIOS[0], SCENARIOS[0].levels[0]).art).toBeUndefined();
  });

  it("valida os campos de uma fase", () => {
    const ok = { name: "Fase", seed: 7, seconds: 60, order: ["RUN" as const], ref: "Salmos 1:1", verse: "Bem-aventurado o homem" };
    expect(validateLevelDef(ok)).toEqual({});
    expect(Object.keys(validateLevelDef({ ...ok, name: " ", seed: 0, seconds: 10, order: [], ref: "", verse: "uma" })).sort()).toEqual(["name", "order", "ref", "seconds", "seed", "verse"]);
    expect(verseWords("  O  Senhor \n é ")).toEqual(["O", "Senhor", "é"]);
  });
});
