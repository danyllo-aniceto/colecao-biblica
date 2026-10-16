import { buildJourney } from "./journey";
import { ART_KEYS, type Form, type Level, type ScenarioArt } from "./types";

/**
 * Campanha solo da Corrida: **cenários** (lugares da Bíblia), cada um com várias **fases** (histórias) em sequência.
 * A fase seguinte só abre ao concluir a anterior e o cenário seguinte só abre ao concluir o último do anterior.
 * Os personagens abrem pela coluna `unlock_level` do Painel (id da fase).
 * A campanha de verdade vem do banco (Painel → Corrida: cenários e fases, tabelas `runner_scenarios`/`runner_levels`); `SCENARIOS` abaixo é o
 * conteúdo de partida (a migração o grava) e o reserva do app quando falta internet. Toda fase nova passa no teste do bot (no Painel, "Testar fase").
 */
export type CampaignLevelDef = {
  id: string;
  name: string;
  seed: number;
  seconds: number;
  order: Form[];
  ref: string;
  verse: string;
  /** Bifurcações e poderes (padrão: ligados). */
  forks?: boolean;
  powers?: boolean;
  /** Dificuldade de 0 a 100 (padrão 50): dentro de cada cenário sobe de fase em fase. */
  difficulty?: number;
};

export type Scenario = {
  id: string;
  name: string;
  story: string;
  theme: { skyTop: string; skyBottom: string };
  art?: ScenarioArt;
  /** Trilha do cenário. */
  music?: string;
  levels: CampaignLevelDef[];
};

const FULL: Form[] = ["RUN", "FLY", "RUN", "GRAVITY"];

export const SCENARIOS: Scenario[] = [
  {
    id: "cidade-de-davi",
    name: "Cidade de Davi",
    story: "Jerusalém, a cidade do rei Davi, o pastor que virou rei.",
    theme: { skyTop: "#1c1917", skyBottom: "#78350f" },
    levels: [
      { id: "cd-1", name: "O pastor", seed: 101, seconds: 80, order: ["RUN"], difficulty: 10, ref: "Salmos 23:1", verse: "O Senhor é o meu pastor; nada me faltará." },
      { id: "cd-2", name: "A luz de Davi", seed: 102, seconds: 95, order: ["RUN", "FLY"], difficulty: 30, ref: "Salmos 27:1", verse: "O Senhor é a minha luz e a minha salvação; a quem temerei?" },
      { id: "cd-3", name: "Rei em Jerusalém", seed: 103, seconds: 110, order: ["RUN", "FLY", "RUN"], difficulty: 50, ref: "2 Samuel 5:10", verse: "Davi ia crescendo em poder, porque o Senhor Deus dos Exércitos era com ele." },
      { id: "cd-4", name: "Refúgio e fortaleza", seed: 104, seconds: 125, order: FULL, difficulty: 70, ref: "Salmos 46:1", verse: "Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia." },
      { id: "cd-5", name: "Os montes de Sião", seed: 105, seconds: 140, order: FULL, difficulty: 90, ref: "Salmos 121:1", verse: "Levanto os meus olhos para os montes, de onde vem o meu socorro." },
    ],
  },
  {
    id: "mar-vermelho",
    name: "Mar Vermelho",
    story: "As águas se abriram para o povo de Deus passar em seco.",
    theme: { skyTop: "#0c1a3a", skyBottom: "#7f1d1d" },
    levels: [
      { id: "mv-1", name: "Não temais", seed: 201, seconds: 110, order: ["RUN", "FLY"], difficulty: 10, ref: "Êxodo 14:13", verse: "Não temais; estai quietos e vede o livramento do Senhor." },
      { id: "mv-2", name: "O Senhor pelejará", seed: 202, seconds: 125, order: ["RUN", "GRAVITY", "RUN"], difficulty: 30, ref: "Êxodo 14:14", verse: "O Senhor pelejará por vós, e vós vos calareis." },
      { id: "mv-3", name: "Cântico da vitória", seed: 203, seconds: 140, order: FULL, difficulty: 50, ref: "Êxodo 15:2", verse: "O Senhor é a minha força e o meu cântico; ele me foi por salvação." },
      { id: "mv-4", name: "Caminho pelo mar", seed: 204, seconds: 155, order: FULL, difficulty: 70, ref: "Salmos 77:19", verse: "O teu caminho foi pelo mar, e as tuas veredas, pelas grandes águas." },
    ],
  },
  {
    id: "vale-dos-ossos-secos",
    name: "Vale dos Ossos Secos",
    story: "O vale onde o Espírito de Deus devolveu a vida aos ossos.",
    theme: { skyTop: "#18181b", skyBottom: "#365314" },
    levels: [
      { id: "vo-1", name: "Viverão estes ossos?", seed: 301, seconds: 125, order: FULL, difficulty: 10, ref: "Ezequiel 37:3", verse: "Filho do homem, porventura viverão estes ossos?" },
      { id: "vo-2", name: "O sopro de vida", seed: 302, seconds: 140, order: FULL, difficulty: 30, ref: "Ezequiel 37:5", verse: "Eis que farei entrar o espírito em vós, e vivereis." },
      { id: "vo-3", name: "Um coração novo", seed: 303, seconds: 155, order: ["GRAVITY", "RUN", "FLY", "RUN"], difficulty: 50, ref: "Ezequiel 36:26", verse: "Dar-vos-ei um coração novo e porei dentro de vós um espírito novo." },
    ],
  },
];

/** Palavras do versículo (separadas por espaço; a pontuação fica colada na palavra). */
export const verseWords = (verse: string) => verse.trim().split(/\s+/).filter(Boolean);

export function buildCampaignLevel(scenario: Scenario, def: CampaignLevelDef): Level {
  const level = buildJourney({ id: def.id, name: def.name, seed: def.seed, seconds: def.seconds, order: def.order, forks: def.forks, powers: def.powers, difficulty: (def.difficulty ?? DEFAULT_DIFFICULTY) / 100, verse: { ref: def.ref, words: verseWords(def.verse) } });
  const art = Object.fromEntries(ART_KEYS.filter((key) => key !== "cover" && scenario.art?.[key]).map((key) => [key, scenario.art![key]]));
  return { ...level, theme: scenario.theme, ...(Object.keys(art).length > 0 ? { art } : {}), ...(scenario.music ? { music: scenario.music } : {}) };
}

export const DEFAULT_DIFFICULTY = 50;
export const DIFFICULTY_RANGE = { min: 0, max: 100 };

/** Nome da dificuldade para a tela. */
export const difficultyLabel = (difficulty: number) => (difficulty < 25 ? "Fácil" : difficulty < 50 ? "Moderada" : difficulty < 75 ? "Difícil" : "Desafio");

export const SEED_RANGE = { min: 1, max: 999_999 };
export const SECONDS_RANGE = { min: 30, max: 600 };
export const MAX_FORM_ORDER = 8;
export const VERSE_WORDS_RANGE = { min: 2, max: 40 };

/** Confere os campos de uma fase antes de salvar ou testar (os limites também valem no servidor). Devolve só os erros, por campo. */
export function validateLevelDef(def: Pick<CampaignLevelDef, "name" | "seed" | "seconds" | "order" | "ref" | "verse"> & { difficulty?: number }): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!def.name.trim()) errors.name = "Informe o nome da fase.";
  if (!Number.isInteger(def.seed) || def.seed < SEED_RANGE.min || def.seed > SEED_RANGE.max) errors.seed = `Use um número inteiro de ${SEED_RANGE.min} a ${SEED_RANGE.max}.`;
  if (!Number.isInteger(def.seconds) || def.seconds < SECONDS_RANGE.min || def.seconds > SECONDS_RANGE.max) errors.seconds = `A fase dura de ${SECONDS_RANGE.min} a ${SECONDS_RANGE.max} segundos.`;
  if (def.order.length === 0 || def.order.length > MAX_FORM_ORDER || def.order.some((form) => form !== "RUN" && form !== "FLY" && form !== "GRAVITY")) errors.order = `Escolha de 1 a ${MAX_FORM_ORDER} formas.`;
  if (def.difficulty !== undefined && (!Number.isInteger(def.difficulty) || def.difficulty < DIFFICULTY_RANGE.min || def.difficulty > DIFFICULTY_RANGE.max)) errors.difficulty = `Use um número inteiro de ${DIFFICULTY_RANGE.min} a ${DIFFICULTY_RANGE.max}.`;
  if (!def.ref.trim()) errors.ref = "Informe a referência do versículo.";
  const words = verseWords(def.verse).length;
  if (words < VERSE_WORDS_RANGE.min || words > VERSE_WORDS_RANGE.max) errors.verse = `O versículo precisa ter de ${VERSE_WORDS_RANGE.min} a ${VERSE_WORDS_RANGE.max} palavras (tem ${words}).`;
  return errors;
}

export const campaignLevels = (scenarios: readonly Scenario[]): Level[] => scenarios.flatMap((scenario) => scenario.levels.map((def) => buildCampaignLevel(scenario, def)));

export const CAMPAIGN_LEVELS: Level[] = campaignLevels(SCENARIOS);

/** Ids das fases na ordem de jogo (cenário a cenário). */
export const levelOrder = (scenarios: readonly Scenario[]): string[] => scenarios.flatMap((scenario) => scenario.levels.map((def) => def.id));

export const CAMPAIGN_ORDER: string[] = levelOrder(SCENARIOS);

/** A fase abre se for a primeira da campanha ou se a anterior (do mesmo cenário ou a última do cenário anterior) foi concluída. */
export function isLevelUnlocked(levelId: string, finished: ReadonlySet<string>, scenarios: readonly Scenario[] = SCENARIOS): boolean {
  const order = levelOrder(scenarios);
  const index = order.indexOf(levelId);
  if (index < 0) return true;
  return index === 0 || finished.has(order[index - 1]);
}

/** Cenário aberto: o primeiro sempre; os outros quando o anterior foi concluído por inteiro. */
export function isScenarioUnlocked(scenarioId: string, finished: ReadonlySet<string>, scenarios: readonly Scenario[] = SCENARIOS): boolean {
  const index = scenarios.findIndex((scenario) => scenario.id === scenarioId);
  if (index <= 0) return index === 0;
  return scenarios[index - 1].levels.every((def) => finished.has(def.id));
}

/** Personagem aberto: sem `unlockLevel` é do começo; com ele, abre ao concluir aquela fase. */
export function isCharacterUnlocked(unlockLevel: string | null, finished: ReadonlySet<string>): boolean {
  return !unlockLevel || finished.has(unlockLevel);
}
