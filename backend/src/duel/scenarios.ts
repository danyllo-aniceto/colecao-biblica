import type { ScenarioDef } from "./types";

/**
 * Os 10 cenários do Duelo (os mesmos da campanha). Nenhum usa sorte: só decisão do jogador.
 * Regras são dados; o motor as lê em `engine.ts`.
 */
export const SCENARIOS: ScenarioDef[] = [
  { id: "eden", name: "Jardim do Éden", emoji: "🍎", rule: { kind: "cheapBonus", amount: 2 }, text: "Suas figurinhas de Vigor 1 ganham +2." },
  { id: "arca", name: "Arca de Noé", emoji: "🌈", rule: { kind: "sharedTag", amount: 1 }, text: "Figurinhas suas aqui que repetem uma etiqueta ganham +1." },
  { id: "canaa", name: "Terra de Canaã", emoji: "⛺", rule: { kind: "majority", amount: 3 }, text: "Quem tem mais figurinhas aqui ganha +3." },
  { id: "egito", name: "Egito", emoji: "🐫", rule: { kind: "decay", amount: 1 }, text: "No fim de cada turno, a figurinha mais fraca de cada lado perde 1." },
  { id: "sinai", name: "Deserto do Sinai", emoji: "⛰️", rule: { kind: "slots", count: 2 }, text: "Só 2 espaços por lado." },
  { id: "jerico", name: "Jericó", emoji: "📯", rule: { kind: "noMove" }, text: "As figurinhas daqui não podem ser movidas." },
  { id: "templo", name: "Templo de Salomão", emoji: "🕎", rule: { kind: "tagBonus", tags: ["Rei", "Sacerdote"], amount: 1 }, text: "+1 para cada Rei ou Sacerdote seu aqui." },
  { id: "babilonia", name: "Babilônia", emoji: "🦁", rule: { kind: "shiftFirst" }, text: "A primeira figurinha de cada lado vai para o cenário vizinho à direita (se houver espaço)." },
  { id: "galileia", name: "Mar da Galileia", emoji: "⛵", rule: { kind: "stormAt", turn: 4, amount: 1 }, text: "No fim do turno 4, todas as figurinhas daqui perdem 1." },
  { id: "jerusalem", name: "Jerusalém", emoji: "🕊️", rule: { kind: "winnerBonus", amount: 2 }, text: "Quem vencer este cenário ganha +2 na Influência total (desempate)." },
];

export const SCENARIO_BY_ID = new Map(SCENARIOS.map((scenario) => [scenario.id, scenario]));

export function scenarioOf(id: string): ScenarioDef {
  const found = SCENARIO_BY_ID.get(id);
  if (!found) throw new Error(`Cenário de duelo desconhecido: ${id}`);
  return found;
}
