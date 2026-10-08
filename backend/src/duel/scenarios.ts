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
  { id: "ur-caldeus", name: "Ur dos Caldeus", emoji: "🌟", rule: { kind: "tagBonus", tags: ["Patriarca"], amount: 2 }, text: "Os pais da fé: +2 para cada Patriarca seu aqui." },
  { id: "susa", name: "Susã", emoji: "👑", rule: { kind: "reversalAt", turn: 5, amount: 1 }, text: "A reviravolta de Ester: no fim do turno 5, o lado que está perdendo aqui ganha +1 em cada figurinha." },
  { id: "ninive", name: "Nínive", emoji: "🏙️", rule: { kind: "forgive" }, text: "Nínive se arrependeu: no fim de cada turno, as figurinhas daqui perdoadas recuperam a Influência que tinham perdido." },
  { id: "transfiguracao", name: "Monte da Transfiguração", emoji: "☀️", rule: { kind: "exactCount", count: 3, amount: 2 }, text: "Três tendas: com exatamente 3 figurinhas suas aqui, cada uma ganha +2." },
  { id: "jordao", name: "Rio Jordão", emoji: "💧", rule: { kind: "lastBonus", amount: 2 }, text: "Quem entra nas águas: a figurinha mais recente de cada lado aqui ganha +2." },
  { id: "manjedoura", name: "Manjedoura de Jesus", emoji: "⭐", rule: { kind: "weakestBonus", amount: 3 }, text: "Os últimos serão os primeiros: a figurinha mais fraca de cada lado aqui ganha +3." },
  { id: "damasco", name: "Damasco", emoji: "🛤️", rule: { kind: "levelAt", turn: 3, fall: 2, rise: 4 }, text: "A luz da estrada: no fim do turno 3, a mais forte de cada lado aqui (com 2 ou mais figurinhas) perde 2 e a mais fraca ganha 4." },
  { id: "atenas", name: "Atenas", emoji: "🏛️", rule: { kind: "plainBonus", amount: 2 }, text: "O altar ao Deus desconhecido: figurinhas sem Dom aqui ganham +2." },
  { id: "corinto", name: "Corinto", emoji: "⚓", rule: { kind: "growthEvery", every: 2, amount: 1 }, text: "Plantar e regar: no fim dos turnos 2, 4 e 6, todas as figurinhas daqui ganham +1." },
  { id: "efeso", name: "Éfeso", emoji: "🏟️", rule: { kind: "domBonus", amount: 1 }, text: "As maravilhas de Deus pelas mãos de Paulo: figurinhas com Dom aqui ganham +1." },
  { id: "filipos", name: "Filipos", emoji: "🎶", rule: { kind: "evenBonus", amount: 1 }, text: "Paulo e Silas, dois a dois: com 2 ou 4 figurinhas suas aqui, cada uma ganha +1." },
  { id: "malta", name: "Malta", emoji: "🏝️", rule: { kind: "unharmed" }, text: "A víbora não fez mal: as figurinhas daqui não perdem Influência (as penalidades não valem aqui)." },
  { id: "roma", name: "Roma", emoji: "🛣️", rule: { kind: "roads", amount: 1 }, text: "Todos os caminhos levam a Roma: cada figurinha sua aqui ganha +1 para cada arena vizinha onde você também tem figurinhas." },
  { id: "antioquia", name: "Antioquia", emoji: "🤝", rule: { kind: "variety", tags: 4, amount: 1 }, text: "Gente de todo tipo: se as figurinhas suas aqui reunirem 4 ou mais etiquetas diferentes, cada uma ganha +1." },
  { id: "samaria", name: "Samaria", emoji: "🪣", rule: { kind: "samaritan", amount: 1 }, text: "O samaritano socorre: no fim de cada turno, a figurinha mais fraca do lado que está perdendo aqui ganha +1." },
  { id: "patmos", name: "Ilha de Patmos", emoji: "📜", rule: { kind: "island", amount: 2 }, text: "Isolado numa ilha: cada figurinha sua aqui ganha +2 se você não tem figurinhas nas arenas vizinhas." },
  { id: "cesareia", name: "Cesareia Marítima", emoji: "⚓", rule: { kind: "centurion", amount: 1 }, text: "O centurião comanda: a figurinha mais forte de cada lado aqui ganha +1 para cada outra figurinha do lado." },
  { id: "cafarnaum", name: "Cafarnaum", emoji: "🏠", rule: { kind: "together", amount: 2 }, text: "Quatro amigos pelo telhado: figurinhas reveladas no mesmo turno que outra sua aqui ganham +2." },
  { id: "santa-ceia", name: "Sala da Santa Ceia", emoji: "🍷", rule: { kind: "betrayalAt", turn: 4, amount: 3 }, text: "Um de vocês me trairá: no fim do turno 4, a figurinha mais forte do lado que está ganhando aqui perde 3." },
  { id: "getsemani", name: "Getsêmani", emoji: "🫒", rule: { kind: "hush" }, text: "Vigiai e orai: o silêncio do jardim cala os Dons de \"Ao revelar\" e de \"Quando uma aliada é jogada\" nas figurinhas daqui." },
  { id: "calvario", name: "Calvário", emoji: "✝️", rule: { kind: "sacrifice", amount: 1, max: 3 }, text: "O sacrifício que redime: cada figurinha sua aqui ganha +1 para cada figurinha sua já afastada (até +3)." },
];

export const SCENARIO_BY_ID = new Map(SCENARIOS.map((scenario) => [scenario.id, scenario]));

/** Identificadores antigos que mudaram de nome (salas e partidas guardadas ainda podem usá-los). */
const LEGACY_IDS: Record<string, string> = { cenaculo: "pentecostes" };

export function scenarioOf(id: string): ScenarioDef {
  const found = SCENARIO_BY_ID.get(LEGACY_IDS[id] ?? id);
  if (!found) throw new Error(`Cenário de duelo desconhecido: ${id}`);
  return found;
}
