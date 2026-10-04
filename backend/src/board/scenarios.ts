import type { ScenarioRules } from "./engine";

/**
 * Regras do tabuleiro de cada cenário. É só dado: o motor lê estes objetos, então dá para
 * acrescentar ou ajustar um cenário sem mexer na lógica.
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
};

/** Cenários cadastrados no painel que ainda não têm regras próprias usam esta provação simples. */
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
};

export const BOARD_SCENARIOS: Record<string, ScenarioRules> = { eden: EDEN };

export function boardRulesFor(slug: string): ScenarioRules {
  return BOARD_SCENARIOS[slug] ?? { slug, ...GENERIC_RULES };
}
