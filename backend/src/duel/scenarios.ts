import type { ScenarioDef } from "./types";

/**
 * Os cenários do Duelo (os mesmos da campanha: 10 de lançamento + os das 12 Pedras). Nenhum usa sorte: só decisão do jogador.
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
  { id: "babel", name: "Torre de Babel", emoji: "🧱", rule: { kind: "decayStrongest", amount: 1 }, text: "No fim de cada turno, a figurinha mais forte de cada lado perde 1." },
  { id: "betel", name: "Betel", emoji: "🪜", rule: { kind: "growWeakest", amount: 1 }, text: "No fim de cada turno, a figurinha mais fraca de cada lado ganha +1." },
  { id: "peniel", name: "Peniel", emoji: "🌅", rule: { kind: "underdog", amount: 3 }, text: "Quem tem menos figurinhas aqui (ao menos 1) ganha +3." },
  { id: "horebe", name: "Sarça ardente em Horebe", emoji: "🔥", rule: { kind: "lone", amount: 3 }, text: "Uma figurinha sozinha do seu lado aqui ganha +3." },
  { id: "tabernaculo", name: "Tabernáculo", emoji: "🪔", rule: { kind: "firstBonus", amount: 2 }, text: "A primeira figurinha de cada lado aqui (as primícias) ganha +2." },
  { id: "cidade-davi", name: "Cidade de Davi", emoji: "🎵", rule: { kind: "costBonus", min: 4, amount: 2 }, text: "Figurinhas de Vigor 4 ou mais aqui ganham +2." },
  { id: "carmelo", name: "Monte Carmelo", emoji: "☁️", rule: { kind: "strongestAt", turn: 5, amount: 3 }, text: "No fim do turno 5, o fogo desce: a figurinha mais forte de cada lado aqui ganha +3." },
  { id: "ossos-secos", name: "Vale dos Ossos Secos", emoji: "🌬️", rule: { kind: "weakBonus", max: 2, amount: 2 }, text: "Figurinhas de Influência base 2 ou menos aqui ganham +2." },
  { id: "pentecostes", name: "Pentecostes", emoji: "✨", rule: { kind: "gather", min: 3, amount: 1 }, text: "Com 3 ou mais figurinhas suas aqui, cada uma ganha +1." },
  { id: "campos-belem", name: "Campos de Belém", emoji: "🌾", rule: { kind: "bountyAt", turn: 4, amount: 1 }, text: "No fim do turno 4, é a colheita: todas as figurinhas aqui ganham +1." },
  { id: "elim", name: "Oásis de Elim", emoji: "🌴", rule: { kind: "refuge" }, text: "Refúgio: o rival não consegue enfraquecer, calar nem destruir, com Dons, as figurinhas daqui." },
  { id: "monte-oliveiras", name: "Monte das Oliveiras", emoji: "🫒", rule: { kind: "veteran", after: 2, amount: 2 }, text: "Quem vigia permanece: figurinhas reveladas aqui há 2 turnos ou mais ganham +2." },
];

export const SCENARIO_BY_ID = new Map(SCENARIOS.map((scenario) => [scenario.id, scenario]));

/** Identificadores antigos que mudaram de nome (salas e partidas guardadas ainda podem usá-los). */
const LEGACY_IDS: Record<string, string> = { cenaculo: "pentecostes" };

export function scenarioOf(id: string): ScenarioDef {
  const found = SCENARIO_BY_ID.get(LEGACY_IDS[id] ?? id);
  if (!found) throw new Error(`Cenário de duelo desconhecido: ${id}`);
  return found;
}
