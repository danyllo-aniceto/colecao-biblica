import type { CardDef, Dom, Effect, TeamCard } from "./types";

/**
 * Cartas de partida (as primeiras, escritas à mão) e os Times prontos. Enquanto o cadastro do painel não existe,
 * é o que o treino contra bot usa; depois, vira o exemplo/semente do painel. Ids em texto curto.
 *
 * Regra de preço: Influência sem Dom ≈ 2 × Vigor; um Dom bom tira 1 a 3.
 */

const dom = (trigger: Dom["trigger"], ...effects: Effect[]): Dom => ({ trigger, effects });

export const STARTER_CARDS: CardDef[] = [
  // Vigor 1
  { id: "rute", name: "Rute", cost: 1, power: 1, tags: ["Mulher"], dom: dom("allyPlayed", { kind: "power", amount: 1, to: "self" }) },
  { id: "jonas", name: "Jonas", cost: 1, power: 1, tags: ["Profeta"], dom: dom("reveal", { kind: "vanish", turns: 3, bonus: 3 }) },
  { id: "abel", name: "Abel", cost: 1, power: 2, tags: ["Pastor"] },
  { id: "miria", name: "Miriã", cost: 1, power: 1, tags: ["Profeta", "Mulher"], dom: dom("reveal", { kind: "draw", count: 1 }) },
  { id: "timoteo", name: "Timóteo", cost: 1, power: 2, tags: ["Apóstolo"] },
  // Vigor 2
  { id: "davi", name: "Davi", cost: 2, power: 2, tags: ["Rei", "Pastor"], dom: dom("reveal", { kind: "power", amount: 6, to: "self", when: { type: "enemyHerePower", atLeast: 6 } }) },
  { id: "daniel", name: "Daniel", cost: 2, power: 2, tags: ["Profeta"], dom: dom("ongoing", { kind: "protect" }) },
  { id: "gideao", name: "Gideão", cost: 2, power: 1, tags: ["Juiz"], dom: dom("ongoing", { kind: "powerPer", amount: 1, per: { of: "alliesAll", cost: 1 } }) },
  { id: "ester", name: "Ester", cost: 2, power: 3, tags: ["Rainha", "Mulher"], dom: dom("reveal", { kind: "power", amount: 1, to: "alliesHere" }) },
  { id: "debora", name: "Débora", cost: 2, power: 2, tags: ["Juiz", "Mulher", "Profeta"], dom: dom("reveal", { kind: "power", amount: 2, to: "weakestAllyHere" }) },
  { id: "samuel", name: "Samuel", cost: 2, power: 4, tags: ["Profeta", "Sacerdote"] },
  // Vigor 3
  { id: "josue", name: "Josué", cost: 3, power: 3, tags: ["Juiz", "Líder"], dom: dom("reveal", { kind: "silence", target: "enemiesHere" }) },
  { id: "jose", name: "José", cost: 3, power: 4, tags: ["Patriarca"], dom: dom("reveal", { kind: "draw", count: 1 }) },
  { id: "pedro", name: "Pedro", cost: 3, power: 4, tags: ["Apóstolo"], dom: dom("ongoing", { kind: "aura", amount: 1, to: "adjacent" }) },
  { id: "sansao", name: "Sansão", cost: 3, power: 4, tags: ["Juiz"], dom: dom("gameEnd", { kind: "destroy", target: "allHere", when: { type: "laneLosing" } }) },
  { id: "saul", name: "Saul", cost: 3, power: 6, tags: ["Rei"] },
  { id: "joao-batista", name: "João Batista", cost: 3, power: 4, tags: ["Profeta"], dom: dom("reveal", { kind: "power", amount: 2, to: "weakestAllyHere" }) },
  // Vigor 4
  { id: "moises", name: "Moisés", cost: 4, power: 5, tags: ["Profeta", "Líder"], dom: dom("reveal", { kind: "moveEnemies" }) },
  { id: "elias", name: "Elias", cost: 4, power: 4, tags: ["Profeta"], dom: dom("reveal", { kind: "destroy", target: "weakestEnemyHere" }) },
  { id: "abraao", name: "Abraão", cost: 4, power: 4, tags: ["Patriarca"], dom: dom("reveal", { kind: "create", token: "Descendente", where: "eachLane" }) },
  { id: "paulo", name: "Paulo", cost: 4, power: 5, tags: ["Apóstolo"], dom: dom("reveal", { kind: "powerPer", amount: 1, per: { of: "alliesAll", tag: "Apóstolo" } }) },
  { id: "isaias", name: "Isaías", cost: 4, power: 6, tags: ["Profeta"], dom: dom("ongoing", { kind: "aura", amount: 1, to: "alliesHere", tag: "Profeta" }) },
  // Vigor 5
  { id: "salomao", name: "Salomão", cost: 5, power: 7, tags: ["Rei"], dom: dom("reveal", { kind: "draw", count: 1 }) },
  { id: "golias", name: "Golias", cost: 5, power: 11, tags: ["Adversário", "Gigante"], dom: dom("reveal", { kind: "power", amount: -6, to: "self", when: { type: "enemyHereNamed", name: "Davi" } }) },
  { id: "noe", name: "Noé", cost: 5, power: 7, tags: ["Patriarca"], dom: dom("reveal", { kind: "power", amount: 1, to: "alliesHere" }) },
  // Vigor 6
  { id: "farao", name: "Faraó", cost: 6, power: 13, tags: ["Rei", "Adversário"], dom: dom("reveal", { kind: "power", amount: -8, to: "self", when: { type: "enemyHereNamed", name: "Moisés" } }) },
];

const BY_ID = new Map(STARTER_CARDS.map((card) => [card.id, card]));

function team(ids: string[]): TeamCard[] {
  return ids.map((id) => {
    const def = BY_ID.get(id);
    if (!def) throw new Error(`Carta desconhecida: ${id}`);
    return { def, level: 1 };
  });
}

export type ReadyDeck = { id: string; name: string; description: string; cards: string[] };

/** Times prontos: 12 cartas temáticas iguais para todos, para ninguém depender da coleção. */
export const READY_DECKS: ReadyDeck[] = [
  {
    id: "reis-e-juizes",
    name: "Reis e Juízes",
    description: "Cartas fortes de Vigor 2 e 3, e finalizadores: Salomão, Golias e Faraó.",
    cards: ["rute", "gideao", "davi", "debora", "samuel", "ester", "saul", "sansao", "josue", "salomao", "golias", "farao"],
  },
  {
    id: "profetas-e-patriarcas",
    name: "Profetas e Patriarcas",
    description: "Dons que mexem na mesa: mover, afastar e criar cartas.",
    cards: ["jonas", "miria", "abel", "daniel", "samuel", "jose", "joao-batista", "pedro", "moises", "elias", "abraao", "isaias"],
  },
];

export function readyTeam(id: string): TeamCard[] {
  const deck = READY_DECKS.find((entry) => entry.id === id);
  if (!deck) throw new Error(`Time pronto desconhecido: ${id}`);
  return team(deck.cards);
}
