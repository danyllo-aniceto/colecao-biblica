import { buildJourney } from "./journey";
import type { Form, Level } from "./types";

/**
 * Campanha solo da Corrida: **cenários** (lugares da Bíblia), cada um com várias **fases** (histórias) em sequência.
 * A fase seguinte só abre ao concluir a anterior e o cenário seguinte só abre ao concluir o último do anterior.
 * Os personagens abrem pela coluna `unlock_level` do Painel (id da fase); a lista abaixo é só o plano de conteúdo (docs/modo-corrida.md).
 * Cenário e fase novos entram aqui e passam sozinhos nos testes do bot (`bots.test.ts`).
 */
export type CampaignLevelDef = {
  id: string;
  name: string;
  seed: number;
  seconds: number;
  order: Form[];
  ref: string;
  verse: string;
};

export type Scenario = {
  id: string;
  name: string;
  story: string;
  theme: { skyTop: string; skyBottom: string };
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
      { id: "cd-1", name: "O pastor", seed: 101, seconds: 50, order: ["RUN"], ref: "Salmos 23:1", verse: "O Senhor é o meu pastor; nada me faltará." },
      { id: "cd-2", name: "A luz de Davi", seed: 102, seconds: 60, order: ["RUN", "FLY"], ref: "Salmos 27:1", verse: "O Senhor é a minha luz e a minha salvação; a quem temerei?" },
      { id: "cd-3", name: "Rei em Jerusalém", seed: 103, seconds: 70, order: ["RUN", "FLY", "RUN"], ref: "2 Samuel 5:10", verse: "Davi ia crescendo em poder, porque o Senhor Deus dos Exércitos era com ele." },
      { id: "cd-4", name: "Refúgio e fortaleza", seed: 104, seconds: 80, order: FULL, ref: "Salmos 46:1", verse: "Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia." },
      { id: "cd-5", name: "Os montes de Sião", seed: 105, seconds: 90, order: FULL, ref: "Salmos 121:1", verse: "Levanto os meus olhos para os montes, de onde vem o meu socorro." },
    ],
  },
  {
    id: "mar-vermelho",
    name: "Mar Vermelho",
    story: "As águas se abriram para o povo de Deus passar em seco.",
    theme: { skyTop: "#0c1a3a", skyBottom: "#7f1d1d" },
    levels: [
      { id: "mv-1", name: "Não temais", seed: 201, seconds: 70, order: ["RUN", "FLY"], ref: "Êxodo 14:13", verse: "Não temais; estai quietos e vede o livramento do Senhor." },
      { id: "mv-2", name: "O Senhor pelejará", seed: 202, seconds: 80, order: ["RUN", "GRAVITY", "RUN"], ref: "Êxodo 14:14", verse: "O Senhor pelejará por vós, e vós vos calareis." },
      { id: "mv-3", name: "Cântico da vitória", seed: 203, seconds: 90, order: FULL, ref: "Êxodo 15:2", verse: "O Senhor é a minha força e o meu cântico; ele me foi por salvação." },
      { id: "mv-4", name: "Caminho pelo mar", seed: 204, seconds: 100, order: FULL, ref: "Salmos 77:19", verse: "O teu caminho foi pelo mar, e as tuas veredas, pelas grandes águas." },
    ],
  },
  {
    id: "vale-dos-ossos-secos",
    name: "Vale dos Ossos Secos",
    story: "O vale onde o Espírito de Deus devolveu a vida aos ossos.",
    theme: { skyTop: "#18181b", skyBottom: "#365314" },
    levels: [
      { id: "vo-1", name: "Viverão estes ossos?", seed: 301, seconds: 80, order: FULL, ref: "Ezequiel 37:3", verse: "Filho do homem, porventura viverão estes ossos?" },
      { id: "vo-2", name: "O sopro de vida", seed: 302, seconds: 90, order: FULL, ref: "Ezequiel 37:5", verse: "Eis que farei entrar o espírito em vós, e vivereis." },
      { id: "vo-3", name: "Um coração novo", seed: 303, seconds: 100, order: ["GRAVITY", "RUN", "FLY", "RUN"], ref: "Ezequiel 36:26", verse: "Dar-vos-ei um coração novo e porei dentro de vós um espírito novo." },
    ],
  },
];

export function buildCampaignLevel(scenario: Scenario, def: CampaignLevelDef): Level {
  const level = buildJourney({ id: def.id, name: def.name, seed: def.seed, seconds: def.seconds, order: def.order, verse: { ref: def.ref, words: def.verse.split(" ") } });
  return { ...level, theme: scenario.theme };
}

export const CAMPAIGN_LEVELS: Level[] = SCENARIOS.flatMap((scenario) => scenario.levels.map((def) => buildCampaignLevel(scenario, def)));

/** Fases da campanha na ordem de jogo (cenário a cenário). */
export const CAMPAIGN_ORDER: string[] = SCENARIOS.flatMap((scenario) => scenario.levels.map((def) => def.id));

/** A fase abre se for a primeira da campanha ou se a anterior (do mesmo cenário ou a última do cenário anterior) foi concluída. */
export function isLevelUnlocked(levelId: string, finished: ReadonlySet<string>): boolean {
  const index = CAMPAIGN_ORDER.indexOf(levelId);
  if (index < 0) return true;
  return index === 0 || finished.has(CAMPAIGN_ORDER[index - 1]);
}

/** Cenário aberto: o primeiro sempre; os outros quando o anterior foi concluído por inteiro. */
export function isScenarioUnlocked(scenarioId: string, finished: ReadonlySet<string>): boolean {
  const index = SCENARIOS.findIndex((scenario) => scenario.id === scenarioId);
  if (index <= 0) return index === 0;
  return SCENARIOS[index - 1].levels.every((def) => finished.has(def.id));
}

/** Personagem aberto: sem `unlockLevel` é do começo; com ele, abre ao concluir aquela fase. */
export function isCharacterUnlocked(unlockLevel: string | null, finished: ReadonlySet<string>): boolean {
  return !unlockLevel || finished.has(unlockLevel);
}
