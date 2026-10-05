import { describe, expect, it } from "vitest";
import { playBotTurn, type BotSkill } from "./bots";
import { newDuel, viewFor } from "./engine";
import { READY_DECKS, readyTeam } from "./starter";
import { HAND_MAX, TURNS, type DuelState, type Side } from "./types";
import { slotsOf } from "./engine";
import { scenarioOf } from "./scenarios";

function play(seed: number, skills: [BotSkill, BotSkill], decks: [string, string] = ["reis-e-juizes", "profetas-e-patriarcas"]): DuelState {
  let state = newDuel({ teams: [readyTeam(decks[0]), readyTeam(decks[1])], seed });
  let guard = 0;
  while (state.status === "playing" && guard < 20) {
    state = playBotTurn(state, 0, skills[0]);
    state = playBotTurn(state, 1, skills[1]);
    guard += 1;
    checkInvariants(state);
  }
  return state;
}

function checkInvariants(state: DuelState) {
  const uids: number[] = [];
  for (const side of [0, 1] as Side[]) {
    const player = state.players[side];
    expect(player.hand.length).toBeLessThanOrEqual(HAND_MAX);
    const zones = [...player.deck, ...player.hand, ...player.graveyard, ...player.returning.map((entry) => entry.card)];
    uids.push(...zones.map((card) => card.uid));
    const placed = state.lanes.flatMap((lane) => lane.cards[side]);
    uids.push(...placed.map((card) => card.uid));
    state.lanes.forEach((lane) => expect(lane.cards[side].length).toBeLessThanOrEqual(slotsOf(scenarioOf(lane.scenario))));
    // Nunca há mais de 12 figurinhas de Time + fichas.
    expect(zones.length + placed.filter((card) => !card.def.token).length).toBe(12);
  }
  expect(new Set(uids).size).toBe(uids.length);
}

describe("bots", () => {
  it("300 duelos entre bots terminam em até 6 turnos, sem estado inválido", () => {
    const skills: BotSkill[] = ["APPRENTICE", "STUDENT", "MASTER"];
    let finished = 0;
    for (let seed = 1; seed <= 300; seed += 1) {
      const state = play(seed, [skills[seed % 3], skills[(seed >> 1) % 3]], seed % 2 ? ["reis-e-juizes", "profetas-e-patriarcas"] : ["profetas-e-patriarcas", "reis-e-juizes"]);
      expect(state.status).toBe("finished");
      expect(state.turn).toBeLessThanOrEqual(TURNS);
      expect(state.result).not.toBeNull();
      finished += 1;
    }
    expect(finished).toBe(300);
  });

  it("o bot só usa o que enxerga: a visão dele não tem a mão do rival", () => {
    const state = newDuel({ teams: [readyTeam("reis-e-juizes"), readyTeam("profetas-e-patriarcas")], seed: 3 });
    const view = viewFor(state, 0);
    const text = JSON.stringify(view);
    // A mão do rival não está na visão (só a quantidade); nem o baralho de ninguém.
    for (const card of state.players[1].hand) expect(text).not.toContain(`"uid":${card.uid},`);
    for (const card of state.players[0].deck) expect(text).not.toContain(`"uid":${card.uid},`);
    expect(view.opponent.handCount).toBe(3);
  });

  it("mesma semente, mesmo duelo", () => {
    const a = play(11, ["MASTER", "STUDENT"]);
    const b = play(11, ["MASTER", "STUDENT"]);
    expect(a.result).toEqual(b.result);
  });

  it("bots melhores vencem mais: Mestre > Estudante > Aprendiz", () => {
    const rate = (strong: BotSkill, weak: BotSkill) => {
      let wins = 0;
      let games = 0;
      for (let seed = 100; seed < 200; seed += 1) {
        const swapped = seed % 2 === 1;
        const state = play(seed, swapped ? [weak, strong] : [strong, weak], seed % 4 < 2 ? ["reis-e-juizes", "profetas-e-patriarcas"] : ["profetas-e-patriarcas", "reis-e-juizes"]);
        const winner = state.result!.winner;
        if (winner === null) continue;
        games += 1;
        if (winner === (swapped ? 1 : 0)) wins += 1;
      }
      return wins / games;
    };
    expect(rate("MASTER", "APPRENTICE")).toBeGreaterThan(0.7);
    expect(rate("STUDENT", "APPRENTICE")).toBeGreaterThan(0.6);
    expect(rate("MASTER", "STUDENT")).toBeGreaterThan(0.5);
  });

  it("os dois Times prontos ficam equilibrados (nenhum passa de 65% entre bots iguais)", () => {
    let first = 0;
    let games = 0;
    for (let seed = 1000; seed < 1300; seed += 1) {
      const swapped = seed % 2 === 1;
      const state = play(seed, ["MASTER", "MASTER"], swapped ? [READY_DECKS[1].id, READY_DECKS[0].id] : [READY_DECKS[0].id, READY_DECKS[1].id]);
      const winner = state.result!.winner;
      if (winner === null) continue;
      games += 1;
      if (winner === (swapped ? 1 : 0)) first += 1;
    }
    const rate = first / games;
    expect(rate).toBeGreaterThan(0.35);
    expect(rate).toBeLessThan(0.65);
  });
});
