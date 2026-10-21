import type { ScenarioDef } from "./types";

/**
 * Os cenários do Duelo (os mesmos da campanha: 10 de lançamento + os das 12 Pedras). Nenhum usa sorte: só decisão do jogador.
 * Regras são dados; o motor as lê em `engine.ts`.
 */
export const SCENARIOS: ScenarioDef[] = [
  { id: "eden", name: "Jardim do Éden", rule: { kind: "costBand", lowMax: 1, lowAmount: 2, highMin: 5, highAmount: -1 }, text: "Figurinhas de Vigor 1 ganham +2. Figurinhas de Vigor 5 ou mais perdem 1." },
  { id: "arca", name: "Arca de Noé", rule: { kind: "sharedTag", amount: 1 }, text: "Figurinhas suas aqui que dividem uma etiqueta com outra figurinha sua aqui ganham +1." },
  { id: "canaa", name: "Terra de Canaã", rule: { kind: "majority", amount: 3 }, text: "O lado com mais figurinhas aqui ganha +3 no cenário." },
  { id: "egito", name: "Egito", rule: { kind: "decay", amount: 1 }, text: "No fim de cada turno, a figurinha mais fraca de cada lado aqui perde 1." },
  { id: "sinai", name: "Deserto do Sinai", rule: { kind: "slots", count: 2, bonus: 2 }, text: "Cada lado tem só 2 espaços aqui. Cada figurinha daqui ganha +2." },
  { id: "jerico", name: "Jericó", rule: { kind: "noMove" }, text: "As figurinhas daqui não podem ser movidas." },
  { id: "templo", name: "Templo de Salomão", rule: { kind: "tagBonus", tags: ["Rei", "Sacerdote"], amount: 1 }, text: "O lado ganha +1 no cenário para cada Rei ou Sacerdote seu aqui." },
  { id: "babilonia", name: "Babilônia", rule: { kind: "shiftFirst" }, text: "A primeira figurinha que cada lado revela aqui vai para o cenário vizinho à direita, se houver espaço." },
  { id: "galileia", name: "Mar da Galileia", rule: { kind: "stormAt", turn: 4, amount: 1, heavyMin: 4, heavyAmount: 2 }, text: "No fim do turno 4, todas as figurinhas aqui perdem 1. As de Vigor 4 ou mais perdem 2." },
  { id: "jerusalem", name: "Jerusalém", rule: { kind: "winnerBonus", amount: 2 }, text: "Quem vencer este cenário ganha +2 na Influência total, usada no desempate da partida." },
  { id: "babel", name: "Torre de Babel", rule: { kind: "decayStrongest", amount: 1 }, text: "No fim de cada turno, a figurinha mais forte de cada lado aqui perde 1." },
  { id: "betel", name: "Betel", rule: { kind: "growWeakest", amount: 1 }, text: "No fim de cada turno, a figurinha mais fraca de cada lado aqui ganha +1." },
  { id: "peniel", name: "Peniel", rule: { kind: "underdog", amount: 3 }, text: "O lado com menos figurinhas aqui (ao menos 1) ganha +3 no cenário." },
  { id: "horebe", name: "Sarça ardente em Horebe", rule: { kind: "lone", amount: 3, crowdMin: 3, crowdAmount: 1 }, text: "Figurinha sozinha do seu lado aqui ganha +3. Com 3 ou mais figurinhas do mesmo lado aqui, cada uma perde 1." },
  { id: "tabernaculo", name: "Tabernáculo", rule: { kind: "firstBonus", amount: 2 }, text: "A primeira figurinha que cada lado revelou aqui ganha +2." },
  { id: "cidade-davi", name: "Cidade de Davi", rule: { kind: "costBand", lowMax: 2, lowAmount: -1, highMin: 4, highAmount: 2 }, text: "Figurinhas de Vigor 4 ou mais ganham +2. Figurinhas de Vigor 1 ou 2 perdem 1." },
  { id: "carmelo", name: "Monte Carmelo", rule: { kind: "strongestAt", turn: 5, amount: 3 }, text: "No fim do turno 5, a figurinha mais forte de cada lado aqui ganha +3." },
  { id: "ossos-secos", name: "Vale dos Ossos Secos", rule: { kind: "weakBonus", max: 2, amount: 2, highMin: 7, highAmount: 2 }, text: "Figurinhas de Influência base 2 ou menos ganham +2. Figurinhas de Influência base 7 ou mais perdem 2." },
  { id: "pentecostes", name: "Pentecostes", rule: { kind: "gather", min: 3, amount: 1 }, text: "Com 3 ou mais figurinhas suas aqui, cada uma ganha +1." },
  { id: "campos-belem", name: "Campos de Belém", rule: { kind: "harvestAt", turn: 4, amount: 1 }, text: "No fim do turno 4, cada figurinha aqui ganha +1 para cada turno em que está aqui, contando o da revelação." },
  { id: "elim", name: "Oásis de Elim", rule: { kind: "refuge" }, text: "O rival não consegue enfraquecer, calar nem afastar, com Dons, as figurinhas daqui." },
  { id: "monte-oliveiras", name: "Monte das Oliveiras", rule: { kind: "veteran", after: 2, amount: 2 }, text: "Figurinhas reveladas aqui há 2 turnos ou mais ganham +2." },
  { id: "ur-caldeus", name: "Ur dos Caldeus", rule: { kind: "tagBonus", tags: ["Patriarca"], amount: 2 }, text: "O lado ganha +2 no cenário para cada Patriarca seu aqui." },
  { id: "susa", name: "Susã", rule: { kind: "reversalAt", turn: 5, amount: 1 }, text: "No fim do turno 5, o lado que está perdendo aqui ganha +1 em cada figurinha." },
  { id: "ninive", name: "Nínive", rule: { kind: "forgive" }, text: "No fim de cada turno, as figurinhas daqui que perderam Influência recuperam o que perderam." },
  { id: "transfiguracao", name: "Monte da Transfiguração", rule: { kind: "exactCount", count: 3, amount: 2 }, text: "Com exatamente 3 figurinhas suas aqui, cada uma ganha +2." },
  { id: "jordao", name: "Rio Jordão", rule: { kind: "lastBonus", amount: 2 }, text: "A figurinha mais recente de cada lado aqui ganha +2." },
  { id: "manjedoura", name: "Manjedoura de Jesus", rule: { kind: "weakestBonus", amount: 3 }, text: "A figurinha mais fraca de cada lado aqui ganha +3." },
  { id: "damasco", name: "Damasco", rule: { kind: "levelAt", turn: 3, fall: 2, rise: 4 }, text: "No fim do turno 3, em cada lado com 2 ou mais figurinhas aqui, a mais forte perde 2 e a mais fraca ganha 4." },
  { id: "atenas", name: "Atenas", rule: { kind: "doubleReveal" }, text: "Os Dons \"Ao revelar\" das figurinhas reveladas aqui agem duas vezes." },
  { id: "corinto", name: "Corinto", rule: { kind: "redistribute", amount: 1 }, text: "No fim de cada turno, em cada lado com 2 ou mais figurinhas aqui, a mais forte passa 1 de Influência para a mais fraca." },
  { id: "efeso", name: "Éfeso", rule: { kind: "domSplit", withDom: 2, plain: -1 }, text: "Figurinhas com Dom ganham +2. Figurinhas sem Dom perdem 1." },
  { id: "filipos", name: "Filipos", rule: { kind: "evenBonus", amount: 1 }, text: "Com 2 ou 4 figurinhas suas aqui, cada uma ganha +1." },
  { id: "malta", name: "Malta", rule: { kind: "unharmed" }, text: "As penalidades de Influência não valem nas figurinhas daqui." },
  { id: "roma", name: "Roma", rule: { kind: "roads", amount: 1 }, text: "Cada figurinha sua aqui ganha +1 para cada cenário vizinho onde você também tem figurinhas." },
  { id: "antioquia", name: "Antioquia", rule: { kind: "variety", tags: 4, amount: 1 }, text: "Se as figurinhas suas aqui reunirem 4 ou mais etiquetas diferentes, cada uma ganha +1." },
  { id: "samaria", name: "Samaria", rule: { kind: "samaritan", amount: 1 }, text: "No fim de cada turno, a figurinha mais fraca do lado que está perdendo aqui ganha +1." },
  { id: "patmos", name: "Ilha de Patmos", rule: { kind: "island", amount: 2 }, text: "Cada figurinha sua aqui ganha +2 se você não tem figurinhas nos cenários vizinhos." },
  { id: "cesareia", name: "Cesareia Marítima", rule: { kind: "centurion", amount: 1 }, text: "A figurinha mais forte de cada lado aqui ganha +1 para cada outra figurinha do seu lado aqui." },
  { id: "cafarnaum", name: "Cafarnaum", rule: { kind: "together", amount: 2 }, text: "Figurinhas reveladas no mesmo turno que outra figurinha sua aqui ganham +2." },
  { id: "santa-ceia", name: "Sala da Santa Ceia", rule: { kind: "betrayalAt", turn: 4, amount: 3 }, text: "No fim do turno 4, se os dois lados jogaram aqui, a figurinha mais forte do lado que está ganhando perde 3." },
  { id: "getsemani", name: "Getsêmani", rule: { kind: "hush" }, text: "Os Dons \"Ao revelar\" e \"Quando uma aliada é jogada\" das figurinhas daqui não agem." },
  { id: "calvario", name: "Calvário", rule: { kind: "sacrifice", amount: 1, max: 3 }, text: "Cada figurinha sua aqui ganha +1 para cada figurinha sua já afastada, até +3." },
  { id: "rio-da-vida", name: "Rio da Vida", rule: { kind: "fruit", amount: 1, max: 3 }, text: "Cada figurinha sua aqui ganha +1 por turno que passa depois de revelada, até +3." },
  { id: "nova-jerusalem", name: "Nova Jerusalém", rule: { kind: "gates", min: 12, amount: 3 }, text: "O lado que reunir 12 ou mais de Influência nas figurinhas daqui ganha +3 no cenário." },
  { id: "monte-siao", name: "Monte Sião", rule: { kind: "investment", amount: 3 }, text: "O lado que investiu mais Vigor aqui (soma do Vigor das figurinhas) ganha +3 no cenário. Empate, ninguém." },
];

export const SCENARIO_BY_ID = new Map(SCENARIOS.map((scenario) => [scenario.id, scenario]));

/** Identificadores antigos que mudaram de nome (salas e partidas guardadas ainda podem usá-los). */
const LEGACY_IDS: Record<string, string> = { cenaculo: "pentecostes" };

export function scenarioOf(id: string): ScenarioDef {
  const found = SCENARIO_BY_ID.get(LEGACY_IDS[id] ?? id);
  if (!found) throw new Error(`Cenário de duelo desconhecido: ${id}`);
  return found;
}
