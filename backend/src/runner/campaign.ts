import { buildJourney } from "./journey";
import { ART_KEYS, LEVEL_STYLES, type Form, type Level, type LevelStyle, type ScenarioArt } from "./types";

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
  /** Estilo da fase (padrão: clássica): cada fase de um cenário tem um estilo diferente. */
  style?: LevelStyle;
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
      { id: "cd-1", name: "O pastor", seed: 101, seconds: 90, order: ["RUN"], difficulty: 5, style: "CLASSIC", ref: "Salmos 23:1", verse: "O Senhor é o meu pastor; nada me faltará." },
      { id: "cd-2", name: "A luz de Davi", seed: 102, seconds: 102, order: ["RUN", "FLY"], difficulty: 15, style: "SPIKES", ref: "Salmos 27:1", verse: "O Senhor é a minha luz e a minha salvação; a quem temerei?" },
      { id: "cd-3", name: "Rei em Jerusalém", seed: 103, seconds: 114, order: ["RUN", "FLY", "RUN"], difficulty: 25, style: "PLATFORMS", ref: "2 Samuel 5:10", verse: "Davi ia crescendo em poder, porque o Senhor Deus dos Exércitos era com ele." },
      { id: "cd-4", name: "Refúgio e fortaleza", seed: 104, seconds: 126, order: ["RUN", "FLY", "RUN", "GRAVITY"], difficulty: 35, style: "SAWS", ref: "Salmos 46:1", verse: "Deus é o nosso refúgio e fortaleza, socorro bem presente na angústia." },
      { id: "cd-5", name: "Os montes de Sião", seed: 105, seconds: 138, order: ["RUN", "FLY", "GRAVITY", "FLY", "RUN"], difficulty: 45, style: "PITS", ref: "Salmos 121:1", verse: "Levanto os meus olhos para os montes, de onde vem o meu socorro." },
      { id: "cd-6", name: "O vale da sombra", seed: 106, seconds: 150, order: ["RUN", "GRAVITY", "RUN"], difficulty: 55, style: "FLIP", ref: "Salmos 23:4", verse: "Ainda que eu andasse pelo vale da sombra da morte, não temeria mal algum, porque tu estás comigo; a tua vara e o teu cajado me consolam." },
      { id: "cd-7", name: "Davi e o gigante", seed: 107, seconds: 162, order: ["RUN", "GRAVITY", "FLY", "RUN"], difficulty: 65, style: "RUSH", ref: "1 Samuel 17:47", verse: "E toda esta multidão saberá que o Senhor não salva com espada e lança; pois do Senhor é a guerra, e ele vos entregará nas nossas mãos." },
      { id: "cd-8", name: "Coração puro", seed: 108, seconds: 174, order: ["FLY", "RUN", "GRAVITY", "RUN"], difficulty: 75, style: "SKY", ref: "Salmos 51:10", verse: "Cria em mim, ó Deus, um coração puro, e renova em mim um espírito reto." },
      { id: "cd-9", name: "Lâmpada para os pés", seed: 109, seconds: 186, order: ["GRAVITY", "FLY", "RUN", "GRAVITY"], difficulty: 85, style: "WILD", ref: "Salmos 119:105", verse: "Lâmpada para os meus pés é a tua palavra, e luz para o meu caminho." },
      { id: "cd-10", name: "A casa do Senhor", seed: 110, seconds: 198, order: ["RUN", "FLY", "GRAVITY", "RUN", "GRAVITY", "FLY"], difficulty: 95, style: "FINALE", ref: "Salmos 122:1", verse: "Alegrei-me quando me disseram: Vamos à casa do Senhor." },
    ],
  },
  {
    id: "mar-vermelho",
    name: "Mar Vermelho",
    story: "As águas se abriram para o povo de Deus passar em seco.",
    theme: { skyTop: "#0c1a3a", skyBottom: "#7f1d1d" },
    levels: [
      { id: "mv-1", name: "Não temais", seed: 201, seconds: 90, order: ["RUN", "FLY"], difficulty: 5, style: "CLASSIC", ref: "Êxodo 14:13", verse: "Não temais; estai quietos e vede o livramento do Senhor." },
      { id: "mv-2", name: "O Senhor pelejará", seed: 202, seconds: 102, order: ["RUN", "GRAVITY", "RUN"], difficulty: 15, style: "SPIKES", ref: "Êxodo 14:14", verse: "O Senhor pelejará por vós, e vós vos calareis." },
      { id: "mv-3", name: "Cântico da vitória", seed: 203, seconds: 114, order: ["RUN", "FLY", "RUN", "GRAVITY"], difficulty: 25, style: "PLATFORMS", ref: "Êxodo 15:2", verse: "O Senhor é a minha força e o meu cântico; ele me foi por salvação." },
      { id: "mv-4", name: "Caminho pelo mar", seed: 204, seconds: 126, order: ["FLY", "GRAVITY", "RUN"], difficulty: 35, style: "SAWS", ref: "Salmos 77:19", verse: "O teu caminho foi pelo mar, e as tuas veredas, pelas grandes águas." },
      { id: "mv-5", name: "Pelas águas", seed: 205, seconds: 138, order: ["FLY", "RUN", "FLY"], difficulty: 45, style: "SKY", ref: "Isaías 43:2", verse: "Quando passares pelas águas, estarei contigo, e pelos rios, eles não te submergirão; quando passares pelo fogo, não te queimarás, nem a chama arderá em ti." },
      { id: "mv-6", name: "A tempestade se acalma", seed: 206, seconds: 150, order: ["GRAVITY", "FLY"], difficulty: 55, style: "PITS", ref: "Salmos 107:29", verse: "Fez cessar a tempestade, e as suas ondas se acalmaram." },
      { id: "mv-7", name: "Coluna de nuvem e de fogo", seed: 207, seconds: 162, order: ["RUN", "FLY", "GRAVITY", "FLY"], difficulty: 65, style: "RUSH", ref: "Êxodo 13:21", verse: "E o Senhor ia adiante deles, de dia numa coluna de nuvem, para os guiar pelo caminho, e de noite numa coluna de fogo, para os alumiar, para que caminhassem de dia e de noite." },
      { id: "mv-8", name: "O mar dividido", seed: 208, seconds: 174, order: ["GRAVITY", "RUN", "GRAVITY"], difficulty: 75, style: "FLIP", ref: "Salmos 136:13", verse: "Aquele que dividiu o Mar Vermelho em duas partes, porque a sua benignidade dura para sempre." },
      { id: "mv-9", name: "Tem bom ânimo", seed: 209, seconds: 186, order: ["FLY", "GRAVITY", "RUN", "FLY", "GRAVITY"], difficulty: 85, style: "WILD", ref: "Josué 1:9", verse: "Não to mandei eu? Esforça-te, e tem bom ânimo; não pasmes, nem te espantes, porque o Senhor teu Deus é contigo, por onde quer que andares." },
      { id: "mv-10", name: "Guiados com bondade", seed: 210, seconds: 198, order: ["RUN", "GRAVITY", "FLY", "RUN", "FLY", "GRAVITY"], difficulty: 95, style: "FINALE", ref: "Êxodo 15:13", verse: "Tu, com a tua beneficência, guiaste este povo, que salvaste; com a tua força o levaste à habitação da tua santidade." },
    ],
  },
  {
    id: "vale-dos-ossos-secos",
    name: "Vale dos Ossos Secos",
    story: "O vale onde o Espírito de Deus devolveu a vida aos ossos.",
    theme: { skyTop: "#18181b", skyBottom: "#365314" },
    levels: [
      { id: "vo-1", name: "Viverão estes ossos?", seed: 301, seconds: 90, order: ["RUN", "FLY", "RUN", "GRAVITY"], difficulty: 5, style: "CLASSIC", ref: "Ezequiel 37:3", verse: "Filho do homem, porventura viverão estes ossos?" },
      { id: "vo-2", name: "O sopro de vida", seed: 302, seconds: 102, order: ["RUN", "GRAVITY", "FLY"], difficulty: 15, style: "SPIKES", ref: "Ezequiel 37:5", verse: "Eis que farei entrar o espírito em vós, e vivereis." },
      { id: "vo-3", name: "Um coração novo", seed: 303, seconds: 114, order: ["GRAVITY", "RUN", "FLY", "RUN"], difficulty: 25, style: "PLATFORMS", ref: "Ezequiel 36:26", verse: "Dar-vos-ei um coração novo e porei dentro de vós um espírito novo." },
      { id: "vo-4", name: "Ossos secos, ouvi", seed: 304, seconds: 126, order: ["GRAVITY"], difficulty: 35, style: "FLIP", ref: "Ezequiel 37:4", verse: "Profetiza sobre estes ossos e dize-lhes: Ossos secos, ouvi a palavra do Senhor." },
      { id: "vo-5", name: "Um exército em pé", seed: 305, seconds: 138, order: ["RUN", "GRAVITY", "RUN", "GRAVITY"], difficulty: 45, style: "PITS", ref: "Ezequiel 37:10", verse: "Profetizei, pois, como me tinha ordenado, e o espírito entrou neles, e viveram, e se puseram em pé, um exército grande em extremo." },
      { id: "vo-6", name: "No vosso lugar", seed: 306, seconds: 150, order: ["FLY", "GRAVITY", "FLY"], difficulty: 55, style: "SAWS", ref: "Ezequiel 37:14", verse: "E porei em vós o meu espírito, e vivereis, e vos porei na vossa própria terra; e sabereis que eu, o Senhor, o disse e o fiz, diz o Senhor." },
      { id: "vo-7", name: "Asas como águias", seed: 307, seconds: 162, order: ["FLY"], difficulty: 65, style: "SKY", ref: "Isaías 40:31", verse: "Mas os que esperam no Senhor renovarão as forças, subirão com asas como águias; correrão, e não se cansarão; caminharão, e não se fatigarão." },
      { id: "vo-8", name: "Ressurreição e vida", seed: 308, seconds: 174, order: ["GRAVITY", "FLY", "GRAVITY", "RUN"], difficulty: 75, style: "RUSH", ref: "João 11:25", verse: "Disse-lhe Jesus: Eu sou a ressurreição e a vida; quem crê em mim, ainda que esteja morto, viverá." },
      { id: "vo-9", name: "Pensamentos de paz", seed: 309, seconds: 186, order: ["RUN", "FLY", "GRAVITY", "FLY", "RUN"], difficulty: 85, style: "WILD", ref: "Jeremias 29:11", verse: "Porque eu bem sei os pensamentos que penso sobre vós, diz o Senhor; pensamentos de paz, e não de mal, para vos dar o fim que esperais." },
      { id: "vo-10", name: "Novas todas as coisas", seed: 310, seconds: 198, order: ["GRAVITY", "FLY", "RUN", "GRAVITY", "FLY", "RUN", "GRAVITY"], difficulty: 95, style: "FINALE", ref: "Apocalipse 21:5", verse: "E o que estava assentado sobre o trono disse: Eis que faço novas todas as coisas." },
    ],
  },
];

/** Palavras do versículo (separadas por espaço; a pontuação fica colada na palavra). */
export const verseWords = (verse: string) => verse.trim().split(/\s+/).filter(Boolean);

export function buildCampaignLevel(scenario: Scenario, def: CampaignLevelDef): Level {
  const level = buildJourney({ id: def.id, name: def.name, seed: def.seed, seconds: def.seconds, order: def.order, forks: def.forks, powers: def.powers, difficulty: (def.difficulty ?? DEFAULT_DIFFICULTY) / 100, style: def.style, verse: { ref: def.ref, words: verseWords(def.verse) } });
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
export function validateLevelDef(def: Pick<CampaignLevelDef, "name" | "seed" | "seconds" | "order" | "ref" | "verse"> & { difficulty?: number; style?: string }): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!def.name.trim()) errors.name = "Informe o nome da fase.";
  if (!Number.isInteger(def.seed) || def.seed < SEED_RANGE.min || def.seed > SEED_RANGE.max) errors.seed = `Use um número inteiro de ${SEED_RANGE.min} a ${SEED_RANGE.max}.`;
  if (!Number.isInteger(def.seconds) || def.seconds < SECONDS_RANGE.min || def.seconds > SECONDS_RANGE.max) errors.seconds = `A fase dura de ${SECONDS_RANGE.min} a ${SECONDS_RANGE.max} segundos.`;
  if (def.order.length === 0 || def.order.length > MAX_FORM_ORDER || def.order.some((form) => form !== "RUN" && form !== "FLY" && form !== "GRAVITY")) errors.order = `Escolha de 1 a ${MAX_FORM_ORDER} formas.`;
  if (def.difficulty !== undefined && (!Number.isInteger(def.difficulty) || def.difficulty < DIFFICULTY_RANGE.min || def.difficulty > DIFFICULTY_RANGE.max)) errors.difficulty = `Use um número inteiro de ${DIFFICULTY_RANGE.min} a ${DIFFICULTY_RANGE.max}.`;
  if (def.style !== undefined && !(LEVEL_STYLES as readonly string[]).includes(def.style)) errors.style = "Escolha um estilo da lista.";
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
