import { describe, expect, it } from "vitest";
import { describeDom, levelDef, validateTeam } from "./cards";
import { cardPower, doubleStakes, lanePower, newDuel, retreat, setReady, stage, unstage, viewFor, whyNotStage } from "./engine";
import { applyRound, damageFor, newSeries } from "./series";
import { READY_DECKS, STARTER_CARDS, readyTeam } from "./starter";
import { type Card, type CardDef, type DuelState, type PlacedCard, type Side } from "./types";

const def = (id: string): CardDef => {
  const found = STARTER_CARDS.find((card) => card.id === id);
  if (!found) throw new Error(id);
  return found;
};

const filler = (index: number): CardDef => ({ id: `f${index}`, name: `Reforço ${index}`, cost: 1, power: 2, tags: [] });
const fillerTeam = () => Array.from({ length: 12 }, (_, index) => ({ def: filler(index) }));

/** Duelo de teste: mãos escolhidas, cenários fixos e Times de reforço. */
function duel(options: { mine?: string[]; theirs?: string[]; scenarios?: [string, string, string]; turn?: number; seed?: number } = {}): DuelState {
  const state = newDuel({ teams: [fillerTeam(), fillerTeam()], seed: options.seed ?? 7, scenarios: options.scenarios ?? ["eden", "arca", "canaa"] });
  const give = (side: Side, ids: string[] | undefined) => {
    if (!ids) return;
    state.players[side].hand = ids.map((id) => ({ uid: state.nextUid++, def: def(id), bonus: 0 }));
  };
  give(0, options.mine);
  give(1, options.theirs);
  state.turn = options.turn ?? 1;
  return state;
}

const uidOf = (state: DuelState, side: Side, id: string) => state.players[side].hand.find((card) => card.def.id === id)!.uid;

/** Coloca e revela as jogadas dos dois lados num turno. */
function playTurn(state: DuelState, mine: Array<[string, number]>, theirs: Array<[string, number]> = []) {
  let next = state;
  for (const [id, lane] of mine) next = stage(next, 0, uidOf(next, 0, id), lane);
  for (const [id, lane] of theirs) next = stage(next, 1, uidOf(next, 1, id), lane);
  next = setReady(next, 0);
  return setReady(next, 1);
}

const board = (state: DuelState, lane: number, side: Side) => state.lanes[lane].cards[side];
const named = (state: DuelState, lane: number, side: Side, name: string): PlacedCard => board(state, lane, side).find((card) => card.def.name === name)!;

describe("criação", () => {
  it("12 figurinhas por Time: 3 na mão e 9 no baralho; mesma semente, mesma partida", () => {
    const a = newDuel({ teams: [readyTeam("reis-e-juizes"), readyTeam("profetas-e-patriarcas")], seed: 42 });
    const b = newDuel({ teams: [readyTeam("reis-e-juizes"), readyTeam("profetas-e-patriarcas")], seed: 42 });
    const c = newDuel({ teams: [readyTeam("reis-e-juizes"), readyTeam("profetas-e-patriarcas")], seed: 43 });
    expect(a.players[0].hand).toHaveLength(3);
    expect(a.players[0].deck).toHaveLength(9);
    expect(a).toEqual(b);
    expect(a.players[0].hand.map((card) => card.def.id)).not.toEqual(c.players[0].hand.map((card) => card.def.id));
    expect(new Set(a.lanes.map((lane) => lane.scenario)).size).toBe(3);
  });

  it("Times prontos são válidos", () => {
    for (const deck of READY_DECKS) expect(validateTeam(readyTeam(deck.id))).toBeNull();
    expect(validateTeam(readyTeam("reis-e-juizes").slice(0, 11))).toMatch(/12 figurinhas/);
    const repeated = readyTeam("reis-e-juizes");
    repeated[1] = repeated[0];
    expect(validateTeam(repeated)).toMatch(/duas vezes/);
  });

  it("nível da figurinha: Nv2 e Nv4 dão +1 de Influência; Nv3 e Nv5 dão +1 no número do Dom", () => {
    const davi = def("davi");
    expect(levelDef(davi, 1)).toEqual(davi);
    expect(levelDef(davi, 2).power).toBe(3);
    expect(levelDef(davi, 4).power).toBe(4);
    expect((levelDef(davi, 3).dom!.effects[0] as { amount: number }).amount).toBe(7);
    expect((levelDef(davi, 5).dom!.effects[0] as { amount: number }).amount).toBe(8);
    expect(levelDef(davi, 5).power).toBe(4);
    expect(levelDef(def("abel"), 5).power).toBe(4);
  });

  it("descreve o Dom em português", () => {
    expect(describeDom(def("moises").dom)).toBe("Ao revelar: move as figurinhas do rival daqui para os outros cenários.");
    expect(describeDom(def("davi").dom)).toContain("+6 de Influência para esta figurinha, se o rival tem aqui uma figurinha de 6+");
    expect(describeDom(undefined)).toBe("Sem Dom.");
  });
});

describe("jogadas", () => {
  it("só dá para jogar com Vigor, em cenário aberto, com espaço e figurinha da mão", () => {
    const state = duel({ mine: ["davi", "elias", "rute"] });
    expect(whyNotStage(state, 0, uidOf(state, 0, "elias"), 0)).toBe("Vigor insuficiente.");
    expect(whyNotStage(state, 0, uidOf(state, 0, "rute"), 1)).toBe("Esse cenário ainda não apareceu.");
    expect(whyNotStage(state, 0, 9999, 0)).toBe("Essa figurinha não está na sua mão.");
    expect(whyNotStage(state, 0, uidOf(state, 0, "rute"), 0)).toBeNull();
    const staged = stage(state, 0, uidOf(state, 0, "rute"), 0);
    // O Vigor do turno 1 (1) já foi gasto.
    expect(whyNotStage(staged, 0, uidOf(state, 0, "davi"), 0)).toBe("Vigor insuficiente.");
    expect(unstage(staged, 0, uidOf(state, 0, "rute")).players[0].staged).toHaveLength(0);
    expect(staged.players[0].staged).toHaveLength(1);
    expect(state.players[0].staged).toHaveLength(0);
  });

  it("depois de dizer Pronto não dá mais para mexer", () => {
    const state = setReady(duel({ mine: ["rute", "abel", "davi"] }), 0);
    expect(whyNotStage(state, 0, uidOf(state, 0, "rute"), 0)).toBe("Você já terminou o turno.");
  });

  it("os dois prontos: figurinhas viram, turno avança, compra 1 figurinha e o 2º cenário aparece", () => {
    const state = playTurn(duel({ mine: ["rute", "abel", "davi"], theirs: ["abel", "rute", "davi"] }), [["abel", 0]], [["rute", 0]]);
    expect(state.turn).toBe(2);
    expect(board(state, 0, 0)).toHaveLength(1);
    expect(board(state, 0, 1)).toHaveLength(1);
    expect(state.players[0].hand).toHaveLength(3); // 2 + compra
    expect(state.players[0].staged).toHaveLength(0);
    expect(state.players[0].ready).toBe(false);
    expect(state.events.some((event) => event.type === "scenario")).toBe(true);
    expect(viewFor(state, 0).lanes[1].scenario?.id).toBe("arca");
  });

  it("quem está ganhando revela primeiro (a figurinha dele entra antes)", () => {
    const setup = (leader: Side) => {
      const state = duel({ mine: ["abel"], theirs: ["abel"], turn: 2, scenarios: ["jerico", "arca", "canaa"] });
      state.lanes[0].cards[leader].push({ uid: 900, def: def("saul"), bonus: 0, silenced: false, order: 1, turn: 1 });
      state.nextOrder = 2;
      return playTurn(state, [["abel", 0]], [["abel", 0]]);
    };
    for (const leader of [0, 1] as Side[]) {
      const state = setup(leader);
      expect(state.priority).toBe(leader);
      const orderOf = (side: Side) => board(state, 0, side).find((card) => card.uid !== 900)!.order;
      expect(orderOf(leader)).toBeLessThan(orderOf(leader === 0 ? 1 : 0));
    }
  });
});

describe("Dons", () => {
  it("Davi ganha +6 contra figurinha forte já na mesa; Golias perde 6 diante de Davi", () => {
    const a = duel({ mine: ["davi"], turn: 2 });
    a.lanes[0].cards[1].push({ uid: 901, def: def("saul"), bonus: 0, silenced: false, order: 1, turn: 1 });
    a.nextOrder = 2;
    const withDavi = playTurn(a, [["davi", 0]]);
    expect(named(withDavi, 0, 0, "Davi").bonus).toBe(6);
    expect(cardPower(withDavi, 0, 0, named(withDavi, 0, 0, "Davi"))).toBe(8);

    const b = duel({ mine: ["abel"], theirs: ["abel"], turn: 5 });
    b.lanes[0].cards[0].push({ uid: 902, def: def("davi"), bonus: 0, silenced: false, order: 1, turn: 1 });
    b.players[1].hand = [{ uid: 903, def: def("golias"), bonus: 0 }];
    b.nextOrder = 2;
    const golias = stage(b, 1, 903, 0);
    const done = setReady(setReady(golias, 0), 1);
    expect(named(done, 0, 1, "Golias").bonus).toBe(-6);
  });

  it("Moisés move as figurinhas do rival para outros cenários abertos com espaço", () => {
    const state = duel({ mine: ["moises"], turn: 4, scenarios: ["eden", "arca", "canaa"] });
    state.lanes[0].cards[1].push({ uid: 910, def: def("abel"), bonus: 0, silenced: false, order: 1, turn: 1 }, { uid: 911, def: def("saul"), bonus: 0, silenced: false, order: 2, turn: 1 });
    state.nextOrder = 3;
    const done = playTurn(state, [["moises", 0]]);
    expect(board(done, 0, 1)).toHaveLength(0);
    expect(board(done, 1, 1).length + board(done, 2, 1).length).toBe(2);
  });

  it("Moisés não move onde nada pode ser movido (Jericó)", () => {
    const state = duel({ mine: ["moises"], turn: 4, scenarios: ["jerico", "arca", "canaa"] });
    state.lanes[0].cards[1].push({ uid: 912, def: def("abel"), bonus: 0, silenced: false, order: 1, turn: 1 });
    state.nextOrder = 2;
    expect(board(playTurn(state, [["moises", 0]]), 0, 1)).toHaveLength(1);
  });

  it("Elias afasta a figurinha mais fraca do rival; Daniel protege", () => {
    const base = () => {
      const state = duel({ mine: ["elias"], turn: 4 });
      state.lanes[0].cards[1].push({ uid: 920, def: def("abel"), bonus: 0, silenced: false, order: 1, turn: 1 }, { uid: 921, def: def("saul"), bonus: 0, silenced: false, order: 2, turn: 1 });
      state.nextOrder = 3;
      return state;
    };
    const plain = playTurn(base(), [["elias", 0]]);
    expect(board(plain, 0, 1).map((card) => card.def.name)).toEqual(["Saul"]);
    expect(plain.players[1].graveyard.map((card) => card.def.name)).toEqual(["Abel"]);

    const guarded = base();
    guarded.lanes[0].cards[1].push({ uid: 922, def: def("daniel"), bonus: 0, silenced: false, order: 3, turn: 1 });
    guarded.nextOrder = 4;
    // Daniel protege as figurinhas do rival aqui: a mais fraca continua protegida.
    const after = playTurn(guarded, [["elias", 0]]);
    expect(board(after, 0, 1)).toHaveLength(3);
  });

  it("Josué cala o Dom contínuo do rival (a proteção de Daniel cai)", () => {
    const state = duel({ mine: ["josue"], turn: 3 });
    state.lanes[0].cards[1].push({ uid: 930, def: def("daniel"), bonus: 0, silenced: false, order: 1, turn: 1 });
    state.nextOrder = 2;
    const done = playTurn(state, [["josue", 0]]);
    expect(named(done, 0, 1, "Daniel").silenced).toBe(true);
    expect(cardPower(done, 0, 1, named(done, 0, 1, "Daniel"))).toBe(2);
  });

  it("Pedro dá +1 às figurinhas dos cenários vizinhos; Isaías, aos Profetas daqui", () => {
    const state = duel({ mine: ["pedro", "abel"], turn: 3 });
    state.lanes[1].cards[0].push({ uid: 940, def: def("abel"), bonus: 0, silenced: false, order: 1, turn: 1 });
    state.lanes[0].cards[0].push({ uid: 941, def: def("daniel"), bonus: 0, silenced: false, order: 2, turn: 1 });
    state.lanes[0].cards[0].push({ uid: 942, def: def("isaias"), bonus: 0, silenced: false, order: 3, turn: 1 });
    state.nextOrder = 4;
    const done = playTurn(state, [["pedro", 1]]);
    // Abel (cenário 1) e Daniel/Isaías (cenário 0) são vizinhos ou do mesmo cenário de Pedro.
    expect(cardPower(done, 0, 0, named(done, 0, 0, "Daniel"))).toBe(2 + 1 + 1); // Pedro (vizinho) + Isaías (Profeta aqui)
    expect(cardPower(done, 0, 0, named(done, 0, 0, "Isaías"))).toBe(6 + 1); // Pedro (vizinho)
  });

  it("Abraão cria um Descendente em cada cenário aberto com espaço", () => {
    const state = duel({ mine: ["abraao"], turn: 4, scenarios: ["sinai", "arca", "canaa"] });
    state.lanes[1].cards[0].push({ uid: 950, def: def("abel"), bonus: 0, silenced: false, order: 1, turn: 1 }, { uid: 951, def: def("abel"), bonus: 0, silenced: false, order: 2, turn: 1 });
    state.nextOrder = 3;
    const done = playTurn(state, [["abraao", 0]]);
    expect(board(done, 0, 0).map((card) => card.def.name).sort()).toEqual(["Abraão", "Descendente"]);
    expect(board(done, 1, 0).filter((card) => card.def.name === "Descendente")).toHaveLength(1);
    expect(board(done, 2, 0).filter((card) => card.def.name === "Descendente")).toHaveLength(1);
  });

  it("Jonas some e volta à mão 3 turnos depois com +3", () => {
    let state = playTurn(duel({ mine: ["jonas", "abel", "rute"] }), [["jonas", 0]]);
    expect(board(state, 0, 0)).toHaveLength(0);
    expect(state.players[0].returning[0].atTurn).toBe(4);
    for (let turn = 2; turn <= 3; turn += 1) {
      expect(state.players[0].hand.some((card) => card.def.id === "jonas")).toBe(false);
      state = setReady(setReady(state, 0), 1);
    }
    expect(state.turn).toBe(4);
    const back = state.players[0].hand.find((card) => card.def.id === "jonas")!;
    expect(back.bonus).toBe(3);
  });

  it("Rute cresce quando outra figurinha sua é jogada no mesmo cenário", () => {
    let state = playTurn(duel({ mine: ["rute", "abel"] }), [["rute", 0]]);
    state.players[0].hand = [{ uid: 960, def: def("abel"), bonus: 0 }];
    state = playTurn(state, [["abel", 0]]);
    expect(named(state, 0, 0, "Rute").bonus).toBe(1);
  });

  it("Gideão soma +1 por figurinha de Vigor 1 em jogo", () => {
    const state = duel({ mine: ["gideao"], turn: 2 });
    state.lanes[1].cards[0].push({ uid: 970, def: def("abel"), bonus: 0, silenced: false, order: 1, turn: 1 }, { uid: 971, def: def("rute"), bonus: 0, silenced: false, order: 2, turn: 1 });
    state.nextOrder = 3;
    const done = playTurn(state, [["gideao", 0]]);
    expect(cardPower(done, 0, 0, named(done, 0, 0, "Gideão"))).toBe(1 + 2);
  });

  it("Sansão destrói tudo no cenário se estiver perdendo no fim do duelo", () => {
    const state = duel({ mine: ["abel"], turn: 6, scenarios: ["jerico", "arca", "canaa"] });
    state.lanes[0].cards[0].push({ uid: 980, def: def("sansao"), bonus: 0, silenced: false, order: 1, turn: 1 });
    state.lanes[0].cards[1].push({ uid: 981, def: def("saul"), bonus: 0, silenced: false, order: 2, turn: 1 });
    state.nextOrder = 3;
    const done = playTurn(state, [], []);
    expect(done.status).toBe("finished");
    expect(board(done, 0, 0)).toHaveLength(0);
    expect(board(done, 0, 1)).toHaveLength(0);
  });

  it("Salomão e José compram figurinhas", () => {
    const state = duel({ mine: ["jose"], turn: 3 });
    const before = state.players[0].deck.length;
    const done = playTurn(state, [["jose", 0]]);
    // Compra do Dom (1) + compra do início do turno (1).
    expect(done.players[0].deck.length).toBe(before - 2);
  });
});

describe("cenários", () => {
  it("Éden: Vigor 1 ganha +2", () => {
    const state = playTurn(duel({ mine: ["abel"], scenarios: ["eden", "arca", "canaa"] }), [["abel", 0]]);
    expect(lanePower(state, 0, 0)).toBe(4);
  });

  it("Arca: etiqueta repetida dá +1 a cada figurinha", () => {
    const state = duel({ turn: 3, scenarios: ["eden", "arca", "canaa"] });
    state.lanes[1].cards[0].push({ uid: 1, def: def("daniel"), bonus: 0, silenced: false, order: 1, turn: 1 }, { uid: 2, def: def("samuel"), bonus: 0, silenced: false, order: 2, turn: 1 }, { uid: 3, def: def("abel"), bonus: 0, silenced: false, order: 3, turn: 1 });
    expect(lanePower(state, 1, 0)).toBe(2 + 1 + (4 + 1) + 2);
  });

  it("Canaã: quem tem mais figurinhas aqui ganha +3", () => {
    const state = duel({ turn: 3, scenarios: ["eden", "arca", "canaa"] });
    state.lanes[2].cards[0].push({ uid: 1, def: def("abel"), bonus: 0, silenced: false, order: 1, turn: 1 }, { uid: 2, def: def("abel"), bonus: 0, silenced: false, order: 2, turn: 1 });
    state.lanes[2].cards[1].push({ uid: 3, def: def("saul"), bonus: 0, silenced: false, order: 3, turn: 1 });
    expect(lanePower(state, 2, 0)).toBe(4 + 3);
    expect(lanePower(state, 2, 1)).toBe(6);
  });

  it("Egito: a figurinha mais fraca de cada lado perde 1 no fim do turno", () => {
    const state = playTurn(duel({ mine: ["abel", "rute"], theirs: ["abel", "rute"], scenarios: ["egito", "arca", "canaa"] }), [["abel", 0]], [["abel", 0]]);
    expect(named(state, 0, 0, "Abel").bonus).toBe(-1);
    expect(named(state, 0, 1, "Abel").bonus).toBe(-1);
  });

  it("Sinai: só 2 espaços por lado", () => {
    const state = duel({ turn: 4, scenarios: ["sinai", "arca", "canaa"], mine: ["abel", "rute", "miria"] });
    state.lanes[0].cards[0].push({ uid: 1, def: def("abel"), bonus: 0, silenced: false, order: 1, turn: 1 }, { uid: 2, def: def("abel"), bonus: 0, silenced: false, order: 2, turn: 1 });
    expect(whyNotStage(state, 0, uidOf(state, 0, "rute"), 0)).toBe("Esse cenário está cheio.");
  });

  it("Templo: +1 por Rei ou Sacerdote seu aqui", () => {
    const state = duel({ turn: 3, scenarios: ["templo", "arca", "canaa"] });
    state.lanes[0].cards[0].push({ uid: 1, def: def("saul"), bonus: 0, silenced: false, order: 1, turn: 1 }, { uid: 2, def: def("samuel"), bonus: 0, silenced: false, order: 2, turn: 1 });
    expect(lanePower(state, 0, 0)).toBe(6 + 4 + 2);
  });

  it("Babilônia: a primeira figurinha de cada lado vai para o cenário da direita", () => {
    const state = playTurn(duel({ turn: 2, mine: ["abel", "rute"], scenarios: ["babilonia", "arca", "canaa"] }), [["abel", 0]]);
    expect(board(state, 0, 0)).toHaveLength(0);
    expect(board(state, 1, 0).map((card) => card.def.name)).toEqual(["Abel"]);
  });

  it("Galileia: no fim do turno 4 todas as figurinhas perdem 1", () => {
    const state = duel({ mine: ["abel"], turn: 4, scenarios: ["galileia", "arca", "canaa"] });
    const done = playTurn(state, [["abel", 0]]);
    expect(named(done, 0, 0, "Abel").bonus).toBe(-1);
  });

  it("Jerusalém: quem vence o cenário ganha +2 no total (desempate)", () => {
    let state = duel({ turn: 6, scenarios: ["jerusalem", "arca", "canaa"] });
    state.lanes[0].cards[0].push({ uid: 1, def: def("saul"), bonus: 0, silenced: false, order: 1, turn: 1 });
    state.lanes[1].cards[1].push({ uid: 2, def: def("samuel"), bonus: 0, silenced: false, order: 2, turn: 1 });
    state = playTurn(state, []);
    // Cada um ganha um cenário (1 a 1, o 3º empata): total de 0 = 6 + 2, total de 1 = 4 (+1 da Arca? não: Samuel só): vence o lado 0.
    expect(state.result?.winner).toBe(0);
  });
});

describe("passo a passo do turno (para a tela animar)", () => {
  it("cada acontecimento traz a foto do tabuleiro: a figurinha entra, depois o Dom muda o número", () => {
    const state = duel({ mine: ["davi"], turn: 2 });
    state.lanes[0].cards[1].push({ uid: 901, def: def("saul"), bonus: 0, silenced: false, order: 1, turn: 1 });
    state.nextOrder = 2;
    const done = playTurn(state, [["davi", 0]]);
    const steps = done.events.filter((event) => event.snap);
    const reveal = steps.find((event) => event.type === "reveal")!;
    const power = steps.find((event) => event.type === "power")!;
    expect(reveal.dom).toContain("+6 de Influência para esta figurinha");
    expect(reveal.snap![0].cards[0].map((card) => card.power)).toEqual([2]);
    expect(reveal.snap![0].power).toEqual([2, 6]);
    expect(power.snap![0].cards[0].map((card) => card.power)).toEqual([8]);
    expect(power.snap![0].power).toEqual([8, 6]);
    expect(steps.indexOf(reveal)).toBeLessThan(steps.indexOf(power));
    // Cenários que ainda não apareceram vêm vazios na foto.
    expect(reveal.snap![2].open).toBe(false);
  });

  it("destruir mostra a figurinha saindo; a foto seguinte já não a tem", () => {
    const state = duel({ mine: ["elias"], turn: 4 });
    state.lanes[0].cards[1].push({ uid: 920, def: def("abel"), bonus: 0, silenced: false, order: 1, turn: 1 });
    state.nextOrder = 2;
    const done = playTurn(state, [["elias", 0]]);
    const kill = done.events.find((event) => event.type === "destroy")!;
    expect(kill.name).toBe("Abel");
    expect(kill.snap![0].cards[1]).toEqual([]);
  });
});

describe("fim do duelo e aposta", () => {
  it("depois do turno 6 o duelo acaba e vence quem ganha 2 cenários", () => {
    let state = duel({ turn: 6 });
    state.lanes[0].cards[0].push({ uid: 1, def: def("saul"), bonus: 0, silenced: false, order: 1, turn: 1 });
    state.lanes[1].cards[0].push({ uid: 2, def: def("saul"), bonus: 0, silenced: false, order: 2, turn: 1 });
    state = playTurn(state, []);
    expect(state.status).toBe("finished");
    expect(state.result?.winner).toBe(0);
    expect(state.result?.lanes.map((lane) => lane.winner)).toEqual([0, 0, null]);
  });

  it("empate de cenários desempata pela Influência total e, igual, empata", () => {
    let state = duel({ turn: 6, scenarios: ["jerico", "arca", "canaa"] });
    state.lanes[0].cards[0].push({ uid: 1, def: def("saul"), bonus: 0, silenced: false, order: 1, turn: 1 });
    state.lanes[0].cards[1].push({ uid: 2, def: def("samuel"), bonus: 0, silenced: false, order: 2, turn: 1 });
    state.lanes[1].cards[1].push({ uid: 3, def: def("samuel"), bonus: 0, silenced: false, order: 3, turn: 1 });
    state = playTurn(state, []);
    expect(state.result?.lanes.map((lane) => lane.winner)).toEqual([0, 1, null]);
    // Cada um leva um cenário e o terceiro empata: desempata o total (lado 0 = 6, lado 1 = 4 + 4).
    expect(state.result?.winner).toBe(1);
    expect(state.result?.totals).toEqual([6, 8]);
  });

  it("dobrar: 1 → 2 → 4 (cada um uma vez); desistir perde a aposta atual", () => {
    let state = duel({});
    state = doubleStakes(state, 0);
    expect(state.stakes).toBe(2);
    expect(() => doubleStakes(state, 0)).toThrow(/já dobrou/);
    state = doubleStakes(state, 1);
    expect(state.stakes).toBe(4);
    expect(() => retreat(state, 1)).toThrow(/no turno em que você dobrou/);
    state = setReady(setReady(state, 0), 1);
    const done = retreat(state, 0);
    expect(done.result).toMatchObject({ winner: 1, retreated: 0, stakes: 4 });
    expect(done.status).toBe("finished");
  });

  it("série: melhor de 3 e vidas (aposta dobrada a partir da rodada 5)", () => {
    const win = (winner: Side | null, stakes = 1) => ({ winner, lanes: [], totals: [0, 0] as [number, number], retreated: null, stakes });
    let bo3 = newSeries("bo3");
    bo3 = applyRound(bo3, win(0));
    expect(bo3.over).toBe(false);
    bo3 = applyRound(bo3, win(null));
    bo3 = applyRound(bo3, win(0));
    expect(bo3).toMatchObject({ over: true, winner: 0 });

    let lives = newSeries("lives");
    lives = applyRound(lives, win(0, 4));
    expect(lives.lives).toEqual([10, 6]);
    expect(damageFor(5, 2)).toBe(4);
    const near: ReturnType<typeof newSeries> = { ...lives, lives: [10, 3], round: 5 };
    expect(applyRound(near, win(0, 2))).toMatchObject({ over: true, winner: 0 });
    expect(applyRound(newSeries("single"), win(1))).toMatchObject({ over: true, winner: 1 });
  });
});

describe("informação escondida", () => {
  it("a visão não traz a mão do rival, o baralho, as jogadas do rival nem cenários que não apareceram", () => {
    let state = duel({ mine: ["abel", "rute", "davi"], theirs: ["abel", "rute", "davi"] });
    state = stage(state, 1, uidOf(state, 1, "abel"), 0);
    const view = viewFor(state, 0);
    expect(view.hand).toHaveLength(3);
    expect(view.opponent.handCount).toBe(3);
    expect(JSON.stringify(view)).not.toContain(String(uidOf(state, 1, "davi")) + ",\"def\"");
    expect(view.lanes[1].scenario).toBeNull();
    expect(view.lanes[2].scenario).toBeNull();
    expect(view.staged).toHaveLength(0);
    expect(Object.keys(view.opponent).sort()).toEqual(["deckCount", "doubled", "handCount", "ready"]);
    // Depois de acabar, os cenários são revelados.
    expect(viewFor(retreat(state, 0), 0).lanes[2].scenario?.id).toBe("canaa");
  });
});

describe("conservação das figurinhas", () => {
  it("nenhuma figurinha se perde ou duplica durante uma partida inteira", () => {
    let state = newDuel({ teams: [readyTeam("reis-e-juizes"), readyTeam("profetas-e-patriarcas")], seed: 5 });
    const total = (side: Side) => {
      const player = state.players[side];
      const placed = state.lanes.flatMap((lane) => lane.cards[side]).filter((card) => !card.def.token).length;
      return player.deck.length + player.hand.length + player.graveyard.length + player.returning.length + placed;
    };
    expect([total(0), total(1)]).toEqual([12, 12]);
    for (let turn = 1; turn <= 6; turn += 1) {
      for (const side of [0, 1] as Side[]) {
        const hand: Card[] = state.players[side].hand;
        let left = turn;
        for (const card of hand) {
          if (card.def.cost <= left) {
            const lane = state.lanes.findIndex((_, index) => whyNotStage(state, side, card.uid, index) === null);
            if (lane >= 0) {
              state = stage(state, side, card.uid, lane);
              left -= card.def.cost;
            }
          }
        }
        state = setReady(state, side);
      }
      expect([total(0), total(1)]).toEqual([12, 12]);
    }
    expect(state.status).toBe("finished");
  });
});
