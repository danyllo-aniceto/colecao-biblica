import type { ScenarioRules } from "./engine";
import { STONE_BOARD_SCENARIOS } from "./scenarios-pedras";

/**
 * Regras do tabuleiro de cada cenário. É só dado: o motor lê estes objetos, então dá para
 * acrescentar ou ajustar um cenário sem mexer na lógica. Cada cenário tem uma provação (ou vigília),
 * um evento próprio e um power-up exclusivo.
 */
const EDEN: ScenarioRules = {
  slug: "eden",
  trial: {
    name: "Tentação da serpente",
    description: "A serpente oferece o fruto: arrisque uma pergunta difícil por +3 casas, ou recuse e siga o caminho. Errou, recua 3.",
    reward: 3,
    penalty: 3,
    optional: true,
  },
  shelterGrants: true,
  exclusive: "TREE",
  event: { name: "Árvores do Éden", description: "Os abrigos são árvores: quem para neles também ganha um power-up." },
};

const ARCA: ScenarioRules = {
  slug: "arca",
  trial: {
    name: "Rumo ao Ararate",
    description: "Pergunta difícil, tudo ou nada: acertou, avança 2 casas; errou, recua 2.",
    reward: 2,
    penalty: 2,
    optional: false,
  },
  shelterGrants: false,
  exclusive: "DOVE",
  event: { name: "Dilúvio", description: "A cada 3 rodadas a água cobre novas casas do caminho. Quem para numa casa alagada recua 2 (o escudo protege)." },
  hazard: {
    name: "Dilúvio",
    description: "Casas alagadas: quem para nelas recua 2.",
    every: 3,
    count: 4,
    penalty: 2,
    labels: [{ emoji: "🌊", name: "Água subindo" }],
  },
};

const CANAA: ScenarioRules = {
  slug: "canaa",
  trial: {
    name: "Poço de Isaque",
    description: "Pergunta difícil, tudo ou nada: acertou, avança 2 casas e ainda ganha um power-up; errou, recua 2.",
    reward: 2,
    penalty: 2,
    optional: false,
    rewardPower: true,
  },
  shelterGrants: false,
  exclusive: "TENT",
  event: { name: "Bênção de Abraão", description: "Vencer o poço rende um power-up. A Tenda atravessa uma provação sem arriscar." },
};

const EGITO: ScenarioRules = {
  slug: "egito",
  trial: {
    name: "Coração do Faraó",
    description: "Pergunta difícil, tudo ou nada: acertou, avança 2 casas; errou, recua 2.",
    reward: 2,
    penalty: 2,
    optional: false,
  },
  shelterGrants: false,
  exclusive: "STAFF",
  event: { name: "As pragas", description: "A cada rodada uma praga cai sobre casas do caminho: quem para nelas recua 2 (o escudo protege)." },
  hazard: {
    name: "Praga",
    description: "Casas atingidas pela praga: quem para nelas recua 2.",
    every: 1,
    count: 3,
    penalty: 2,
    labels: [
      { emoji: "🐸", name: "Praga das rãs" },
      { emoji: "🦟", name: "Praga dos mosquitos" },
      { emoji: "🦗", name: "Praga dos gafanhotos" },
      { emoji: "🌑", name: "Praga das trevas" },
      { emoji: "🩸", name: "Água em sangue" },
    ],
  },
};

const SINAI: ScenarioRules = {
  slug: "sinai",
  trial: {
    name: "Bezerro de ouro",
    description: "Pergunta difícil, tudo ou nada: acertou, avança 2 casas; errou, recua 2 e ainda perde um power-up.",
    reward: 2,
    penalty: 2,
    optional: false,
    losePower: true,
  },
  shelterGrants: true,
  exclusive: "MANNA",
  event: { name: "Maná do céu", description: "Os abrigos são casas de maná: quem para neles ganha um power-up." },
};

const JERICO: ScenarioRules = {
  slug: "jerico",
  trial: {
    name: "Sete voltas",
    description: "Pergunta difícil, tudo ou nada: acertou, avança 2 casas; errou, recua 2.",
    reward: 2,
    penalty: 2,
    optional: false,
  },
  shelterGrants: false,
  exclusive: "TRUMPET",
  event: { name: "Os muros", description: "Um muro para o peão: só passa quem acerta 2 perguntas seguidas. Na rodada 7 todos os muros caem." },
  walls: { count: 3, fallsAtRound: 7 },
};

const TEMPLO: ScenarioRules = {
  slug: "templo",
  trial: {
    name: "Juízo de Salomão",
    description: "Pergunta difícil, tudo ou nada: acertou, avança 2 casas e adianta o último colocado 1 casa; errou, recua 2.",
    reward: 2,
    penalty: 2,
    optional: false,
    shareWithLast: 1,
  },
  shelterGrants: true,
  exclusive: "WISDOM",
  event: { name: "Ouro e cedro", description: "Os abrigos dourados também dão um power-up." },
};

const BABILONIA: ScenarioRules = {
  slug: "babilonia",
  trial: {
    name: "Sonho do rei",
    description: "Pergunta difícil, tudo ou nada: acertou, avança 2 casas; errou, recua 2.",
    reward: 2,
    penalty: 2,
    optional: false,
  },
  shelterGrants: false,
  exclusive: "FOURTH",
  event: {
    name: "Fornalha e cova dos leões",
    description: "Casas de fogo fazem recuar 3. Na cova dos leões você fica uma vez sem jogar, mas ganha um escudo.",
  },
  fire: { count: 3, penalty: 3 },
  den: { count: 2 },
};

const GALILEIA: ScenarioRules = {
  slug: "galileia",
  trial: {
    name: "Pesca milagrosa",
    description: "Pergunta difícil, tudo ou nada: acertou, avança 2 casas e ainda ganha um power-up; errou, recua 2.",
    reward: 2,
    penalty: 2,
    optional: false,
    rewardPower: true,
  },
  shelterGrants: false,
  exclusive: "NET",
  event: { name: "Tempestade", description: "Em algumas rodadas o vento sopra: quem erra a pergunta é levado 1 casa para trás (o escudo protege)." },
  storm: { chance: 0.34, drift: 1 },
};

const JERUSALEM: ScenarioRules = {
  slug: "jerusalem",
  trial: {
    name: "Vigília no Getsêmani",
    description: "Todos respondem à mesma pergunta, um de cada vez. Só quem acerta avança 2 casas.",
    reward: 2,
    penalty: 0,
    optional: false,
  },
  vigil: true,
  shelterGrants: false,
  exclusive: "LIGHT",
  startPower: "SHIELD",
  event: { name: "O túmulo vazio", description: "Todos começam com um escudo extra na mochila." },
};

/** Cenários criados no painel que ainda não têm regras próprias usam esta provação simples. */
export const GENERIC_RULES: Omit<ScenarioRules, "slug"> = {
  trial: {
    name: "Provação",
    description: "Pergunta difícil, tudo ou nada: acertou, avança 2 casas; errou, recua 2.",
    reward: 2,
    penalty: 2,
    optional: false,
  },
  shelterGrants: false,
  exclusive: null,
  event: null,
};

export const BOARD_SCENARIOS: Record<string, ScenarioRules> = {
  eden: EDEN,
  arca: ARCA,
  canaa: CANAA,
  egito: EGITO,
  sinai: SINAI,
  jerico: JERICO,
  templo: TEMPLO,
  babilonia: BABILONIA,
  galileia: GALILEIA,
  jerusalem: JERUSALEM,
  // As 12 Pedras do Peitoral (36 cenários): montados em `scenarios-pedras.ts`.
  ...STONE_BOARD_SCENARIOS,
};

export function boardRulesFor(slug: string): ScenarioRules {
  return BOARD_SCENARIOS[slug] ?? { slug, ...GENERIC_RULES };
}
