import { describe, expect, it } from "vitest";
import { buildCampaignLevel, CAMPAIGN_LEVELS, CAMPAIGN_ORDER, isCharacterUnlocked, isLevelUnlocked, isScenarioUnlocked, SCENARIOS, validateLevelDef, verseWords } from "./campaign";

/** Distância mínima (soma das diferenças da mistura de espetos, serras, blocos e buracos, do chão e do teto) entre duas fases do mesmo cenário. */
const MIN_STYLE_DISTANCE = 0.05;

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

  it("cada cenário tem pelo menos 10 fases, e as fases de um cenário não repetem a mesma ordem de formas em sequência", () => {
    for (const scenario of SCENARIOS) {
      expect(scenario.levels.length, scenario.name).toBeGreaterThanOrEqual(10);
      for (let index = 1; index < scenario.levels.length; index += 1) {
        expect(JSON.stringify(scenario.levels[index].order), `${scenario.name}: fase ${index + 1}`).not.toBe(JSON.stringify(scenario.levels[index - 1].order));
      }
      // Fases bem distintas: pelo menos 6 desenhos de formas diferentes por cenário.
      expect(new Set(scenario.levels.map((def) => JSON.stringify(def.order))).size).toBeGreaterThanOrEqual(6);
    }
  });

  it("cada fase de um cenário tem estilo próprio e uma mistura de obstáculos diferente das outras", () => {
    const histogram = (scenario: (typeof SCENARIOS)[number], def: (typeof SCENARIOS)[number]["levels"][number]) => {
      const level = buildCampaignLevel(scenario, def);
      // Categorias: espeto do chão, espeto pendurado, serra parada, serra que sobe e desce, bloco, buraco do chão, buraco do teto.
      const counts = [
        level.objects.filter((object) => object.kind === "spike" && !object.down).length,
        level.objects.filter((object) => object.kind === "spike" && object.down).length,
        level.objects.filter((object) => object.kind === "saw" && !object.amp).length,
        level.objects.filter((object) => object.kind === "saw" && object.amp).length,
        level.objects.filter((object) => object.kind === "block").length,
        level.objects.filter((object) => object.kind === "pit" && object.side === "floor").length,
        level.objects.filter((object) => object.kind === "pit" && object.side === "ceiling").length,
      ];
      const total = counts.reduce((sum, value) => sum + value, 0) || 1;
      return counts.map((value) => value / total);
    };
    for (const scenario of SCENARIOS) {
      const styles = scenario.levels.map((def) => def.style ?? "CLASSIC");
      expect(new Set(styles).size, `${scenario.name}: estilos`).toBe(scenario.levels.length);
      expect(styles[0]).toBe("CLASSIC");
      expect(styles[styles.length - 1]).toBe("FINALE");
      const shapes = scenario.levels.map((def) => histogram(scenario, def));
      for (let a = 0; a < shapes.length; a += 1) {
        for (let b = a + 1; b < shapes.length; b += 1) {
          const distance = shapes[a].reduce((sum, value, index) => sum + Math.abs(value - shapes[b][index]), 0);
          expect(distance, `${scenario.name}: fases ${a + 1} e ${b + 1} (${styles[a]} × ${styles[b]})`).toBeGreaterThan(MIN_STYLE_DISTANCE);
        }
      }
    }
  });

  it("a velocidade sobe com a dificuldade dentro do cenário (de 1,00 a 1,25)", () => {
    for (const scenario of SCENARIOS) {
      const speeds = scenario.levels.map((def) => buildCampaignLevel(scenario, def).speed ?? 1);
      expect(speeds[0]).toBeLessThan(1.05);
      expect(speeds).toEqual([...speeds].sort((a, b) => a - b));
      expect(speeds[speeds.length - 1]).toBeGreaterThan(1.2);
    }
  });

  it("a dificuldade começa baixa e só sobe dentro de cada cenário", () => {
    for (const scenario of SCENARIOS) {
      const levels = scenario.levels.map((def) => def.difficulty ?? 50);
      expect(levels[0], scenario.name).toBeLessThanOrEqual(20);
      expect(levels).toEqual([...levels].sort((a, b) => a - b));
      expect(new Set(levels).size).toBe(levels.length);
    }
    expect(validateLevelDef({ name: "x", seed: 5, seconds: 60, order: ["RUN"], ref: "a", verse: "uma duas", difficulty: 101 }).difficulty).toBeDefined();
    expect(validateLevelDef({ name: "x", seed: 5, seconds: 60, order: ["RUN"], ref: "a", verse: "uma duas", difficulty: 40 }).difficulty).toBeUndefined();
  });

  it("a fase seguinte só abre ao concluir a anterior, atravessando os cenários", () => {
    const none = new Set<string>();
    expect(isLevelUnlocked("cd-1", none)).toBe(true);
    expect(isLevelUnlocked("cd-2", none)).toBe(false);
    expect(isLevelUnlocked("cd-2", new Set(["cd-1"]))).toBe(true);
    expect(isLevelUnlocked("mv-1", new Set(["cd-9"]))).toBe(false);
    expect(isLevelUnlocked("mv-1", new Set(["cd-10"]))).toBe(true);
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
    expect(isLevelUnlocked("cd-1", new Set(["mv-10"]), reversed)).toBe(true);
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
