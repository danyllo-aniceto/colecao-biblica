import { describe, expect, it } from "vitest";
import { describeDom } from "./cards";
import { buildCard, domToText, parseDom } from "./dsl";
import { playBotTurn, type BotSkill } from "./bots";
import { cardPower, energyFor, newDuel, setReady, slotsOf, stage } from "./engine";
import { scenarioOf } from "./scenarios";
import { HAND_MAX, type Card, type CardDef, type DuelState, type PlacedCard, type Side } from "./types";

/** Figurinha de teste montada pelo mesmo texto da planilha. */
const card = (id: string, trigger: string, effects: string, extra: Partial<{ cost: number; power: number; tags: string[] }> = {}): CardDef => {
  const built = buildCard({ id, name: id, cost: extra.cost ?? 1, power: extra.power ?? 2, tags: extra.tags ?? [], trigger, effects });
  if (!built.ok) throw new Error(built.error);
  return built.card;
};
const plain = (id: string, power = 2, cost = 1, tags: string[] = []): CardDef => ({ id, name: id, cost, power, tags });

const filler = (index: number): CardDef => ({ id: `f${index}`, name: `Reforço ${index}`, cost: 1, power: 2, tags: [] });
const team = () => Array.from({ length: 12 }, (_, index) => ({ def: filler(index) }));

/** Duelo de teste: mãos escolhidas, cenários neutros e Vigor de sobra (turno 6). */
function duel(mine: CardDef[], theirs: CardDef[] = [], turn = 6): DuelState {
  const state = newDuel({ teams: [team(), team()], seed: 3, scenarios: ["jerusalem", "jerusalem", "jerusalem"] });
  state.players[0].hand = mine.map((def) => ({ uid: state.nextUid++, def, bonus: 0 }));
  state.players[1].hand = theirs.map((def) => ({ uid: state.nextUid++, def, bonus: 0 }));
  state.turn = turn;
  return state;
}

const place = (state: DuelState, side: Side, lane: number, def: CardDef, bonus = 0): PlacedCard => {
  const placed: PlacedCard = { uid: state.nextUid++, def, bonus, silenced: false, order: state.nextOrder++, turn: 1 };
  state.lanes[lane].cards[side].push(placed);
  return placed;
};

function turn(state: DuelState, mine: Array<[number, number]>, theirs: Array<[number, number]> = []) {
  let next = state;
  for (const [index, lane] of mine) next = stage(next, 0, next.players[0].hand[index].uid, lane);
  for (const [index, lane] of theirs) next = stage(next, 1, next.players[1].hand[index].uid, lane);
  return setReady(setReady(next, 0), 1);
}

const inDeck = (state: DuelState, side: Side, defs: CardDef[]) => {
  state.players[side].deck = defs.map((def): Card => ({ uid: state.nextUid++, def, bonus: 0 }));
};

describe("comprar ao ser afastada (Jó)", () => {
  it("a figurinha afastada compra 1 figurinha para o dono", () => {
    const jo = card("jo", "destruida", "comprar qtd=1", { power: 3 });
    const killer = card("matador", "revelar", "destruir alvo=inimigo-mais-fraco");
    const state = duel([], [killer]);
    place(state, 0, 0, jo);
    const handBefore = state.players[0].hand.length;
    const deckBefore = state.players[0].deck.length;
    const done = turn(state, [], [[0, 0]]);
    expect(done.lanes[0].cards[0]).toHaveLength(0);
    expect(done.events.some((event) => event.type === "draw" && event.side === 0 && event.name === "jo")).toBe(true);
    // O jogo acabou no turno 6 e não comprou no início do turno: sobra só a compra do Dom.
    expect(deckBefore - done.players[0].deck.length).toBe(1);
    expect(done.players[0].hand.length).toBe(handBefore + 1);
  });

  it("sem figurinha no baralho, não compra e nada quebra", () => {
    const jo = card("jo", "destruida", "comprar qtd=1", { power: 3 });
    const killer = card("matador", "revelar", "destruir alvo=inimigo-mais-fraco");
    const state = duel([], [killer]);
    state.players[0].deck = [];
    place(state, 0, 0, jo);
    const done = turn(state, [], [[0, 0]]);
    expect(done.events.some((event) => event.type === "draw")).toBe(false);
  });
});

describe("esgotar", () => {
  it("o rival tem menos Vigor no próximo turno", () => {
    const state = duel([card("sombra", "revelar", "esgotar valor=2")], [], 3);
    const done = turn(state, [[0, 0]]);
    expect(done.turn).toBe(4);
    expect(done.players[1].energyBonus).toBe(-2);
    expect(done.players[0].energyBonus).toBe(0);
    expect(done.events.some((event) => event.type === "energy" && event.side === 1 && event.amount === -2)).toBe(true);
  });

  it("nunca deixa o rival sem Vigor: sobra 1", () => {
    const state = duel([], [], 1);
    state.players[1].energyBonus = -9;
    expect(energyFor(state, 1)).toBe(1);
  });

  it("no último turno não faz nada (não há próximo turno)", () => {
    const state = duel([card("sombra", "revelar", "esgotar valor=2")], [], 6);
    const done = turn(state, [[0, 0]]);
    expect(done.players[1].nextEnergyBonus).toBe(0);
  });

  it("acumula com outros Dons e respeita a condição", () => {
    const quando = card("quando", "revelar", "esgotar valor=1 se=turno:5", { power: 2 });
    const cedo = duel([quando], [], 3);
    expect(turn(cedo, [[0, 0]]).players[1].energyBonus).toBe(0);
    const tarde = duel([quando], [], 5);
    expect(turn(tarde, [[0, 0]]).players[1].energyBonus).toBe(-1);
  });
});

describe("buscar", () => {
  const profeta = (id: string, cost: number) => plain(id, cost * 2, cost, ["Profeta"]);

  it("pega no Time a figurinha mais cara da etiqueta", () => {
    const state = duel([card("busca", "revelar", "buscar etiqueta=Profeta")], [], 4);
    inDeck(state, 0, [plain("rei", 3, 3, ["Rei"]), profeta("p2", 2), profeta("p5", 5), profeta("p3", 3)]);
    const done = turn(state, [[0, 0]]);
    expect(done.players[0].hand.map((entry) => entry.def.id)).toContain("p5");
    expect(done.players[0].deck.map((entry) => entry.def.id)).not.toContain("p5");
    // O texto do aviso não revela qual figurinha foi pega.
    const event = done.events.find((entry) => entry.type === "draw" && entry.name === "busca");
    expect(event?.text).not.toContain("p5");
  });

  it("criterio=mais-barata e qtd=2", () => {
    const state = duel([card("busca", "revelar", "buscar qtd=2 criterio=mais-barata etiqueta=Profeta")], [], 4);
    inDeck(state, 0, [profeta("p4", 4), profeta("p1", 1), profeta("p2", 2), profeta("p3", 3)]);
    const done = turn(state, [[0, 0]]);
    const ids = done.players[0].hand.map((entry) => entry.def.id);
    expect(ids).toContain("p1");
    expect(ids).toContain("p2");
    expect(ids).not.toContain("p3");
  });

  it("sem figurinha que combine, ou com a mão cheia, não faz nada", () => {
    const state = duel([card("busca", "revelar", "buscar etiqueta=Profeta")], [], 4);
    inDeck(state, 0, [plain("rei", 3, 3, ["Rei"])]);
    const done = turn(state, [[0, 0]]);
    expect(done.events.some((event) => event.type === "draw" && event.name === "busca")).toBe(false);
  });
});

describe("repetir", () => {
  it("repete o Dom 'Ao revelar' da figurinha mais forte daqui", () => {
    const state = duel([card("eco", "revelar", "repetir", { power: 1 })], [], 4);
    const forte = place(state, 0, 0, card("forte", "revelar", "poder valor=+2 alvo=si", { power: 5 }));
    place(state, 0, 0, card("fraca", "revelar", "poder valor=+4 alvo=si", { power: 1 }));
    const done = turn(state, [[0, 0]]);
    const placed = done.lanes[0].cards[0].find((entry) => entry.uid === forte.uid)!;
    expect(placed.bonus).toBe(2);
    expect(done.lanes[0].cards[0].find((entry) => entry.def.id === "fraca")!.bonus).toBe(0);
    expect(done.events.some((event) => event.type === "dom" && event.text.includes("repetiu"))).toBe(true);
  });

  it("ignora Dons contínuos, outros repetir e sumir (sem laço infinito)", () => {
    const state = duel([card("eco", "revelar", "repetir")], [], 4);
    place(state, 0, 0, card("outro-eco", "revelar", "repetir", { power: 9 }));
    place(state, 0, 0, card("some", "revelar", "sumir turnos=2 bonus=+3", { power: 8 }));
    place(state, 0, 0, card("aura", "continuo", "aura valor=+1 em=aliados-aqui", { power: 7 }));
    const done = turn(state, [[0, 0]]);
    expect(done.lanes[0].cards[0].map((entry) => entry.def.id).sort()).toEqual(["aura", "eco", "outro-eco", "some"]);
  });

  it("sem figurinha com Dom 'Ao revelar' aqui, não acontece nada", () => {
    const state = duel([card("eco", "revelar", "repetir")], [], 4);
    place(state, 0, 0, plain("simples", 5));
    const done = turn(state, [[0, 0]]);
    expect(done.events.some((event) => event.type === "dom" && event.text.includes("repetiu"))).toBe(false);
  });
});

describe("blindar", () => {
  const escudo = () => card("escudo", "continuo", "blindar", { power: 3 });

  it("o rival não consegue afastá-la, devolvê-la nem reduzi-la", () => {
    for (const power of ["destruir alvo=inimigo-mais-forte", "devolver alvo=inimigo-mais-forte", "poder valor=-3 alvo=inimigo-mais-forte"]) {
      const state = duel([], [card("ataque", "revelar", power)]);
      const shield = place(state, 0, 0, escudo());
      const done = turn(state, [], [[0, 0]]);
      const found = done.lanes[0].cards[0].find((entry) => entry.uid === shield.uid);
      expect(found, power).toBeTruthy();
      expect(found!.bonus, power).toBe(0);
    }
  });

  it("protege só a própria figurinha: as outras do mesmo lado continuam expostas", () => {
    const state = duel([], [card("ataque", "revelar", "destruir alvo=inimigo-mais-fraco")]);
    place(state, 0, 0, escudo());
    place(state, 0, 0, plain("fraca", 1));
    const done = turn(state, [], [[0, 0]]);
    expect(done.lanes[0].cards[0].map((entry) => entry.def.id)).toEqual(["escudo"]);
  });

  it("calar cancela o escudo", () => {
    const state = duel([], [card("ataque", "revelar", "calar | destruir alvo=inimigo-mais-forte", { power: 1 })]);
    place(state, 0, 0, escudo());
    const done = turn(state, [], [[0, 0]]);
    expect(done.lanes[0].cards[0]).toHaveLength(0);
  });

  it("só funciona como Dom contínuo", () => {
    expect(parseDom("revelar", "blindar").ok).toBe(false);
    expect(parseDom("continuo", "blindar").ok).toBe(true);
    expect(parseDom("continuo", "blindar | poder-por valor=+1 por=aliados").ok).toBe(true);
  });
});

describe("purificar", () => {
  it("tira as penalidades das suas figurinhas aqui, sem mexer nos bônus", () => {
    const state = duel([card("cura", "revelar", "purificar", { power: 1 })], [], 4);
    const ferida = place(state, 0, 0, plain("ferida", 4), -3);
    const forte = place(state, 0, 0, plain("forte", 4), 2);
    const outraArena = place(state, 0, 1, plain("longe", 4), -2);
    const done = turn(state, [[0, 0]]);
    const bonus = (uid: number, lane: number) => done.lanes[lane].cards[0].find((entry) => entry.uid === uid)!.bonus;
    expect(bonus(ferida.uid, 0)).toBe(0);
    expect(bonus(forte.uid, 0)).toBe(2);
    expect(bonus(outraArena.uid, 1)).toBe(-2);
    expect(done.events.some((event) => event.type === "power" && event.amount === 3)).toBe(true);
  });
});

describe("igualar", () => {
  it("sobe até a figurinha mais forte daqui, de qualquer lado, até o máximo", () => {
    const state = duel([card("espelho", "revelar", "igualar max=5", { power: 2 })], [], 4);
    place(state, 1, 0, plain("gigante", 9));
    const done = turn(state, [[0, 0]]);
    const mirror = done.lanes[0].cards[0].find((entry) => entry.def.id === "espelho")!;
    expect(cardPower(done, 0, 0, mirror)).toBe(7);
  });

  it("sem teto e com figurinha mais fraca por perto, só iguala (nunca perde)", () => {
    const aberto = duel([card("espelho", "revelar", "igualar", { power: 2 })], [], 4);
    place(aberto, 0, 0, plain("aliada", 6));
    const a = turn(aberto, [[0, 0]]);
    expect(cardPower(a, 0, 0, a.lanes[0].cards[0].find((entry) => entry.def.id === "espelho")!)).toBe(6);
    const fraco = duel([card("espelho", "revelar", "igualar", { power: 5 })], [], 4);
    place(fraco, 1, 0, plain("pequena", 1));
    const b = turn(fraco, [[0, 0]]);
    expect(cardPower(b, 0, 0, b.lanes[0].cards[0].find((entry) => entry.def.id === "espelho")!)).toBe(5);
  });
});

describe("contar figurinhas afastadas e na mão", () => {
  it("poder-por por=afastadas soma enquanto a figurinha estiver em jogo", () => {
    const state = duel([], [], 4);
    const martir = place(state, 0, 0, card("martir", "continuo", "poder-por valor=+2 por=afastadas", { power: 1 }));
    expect(cardPower(state, 0, 0, martir)).toBe(1);
    state.players[0].graveyard = [
      { uid: 901, def: plain("a"), bonus: 0 },
      { uid: 902, def: plain("b"), bonus: 0 },
      // Figurinha-ficha não conta.
      { uid: 903, def: { ...plain("ficha"), token: true }, bonus: 0 },
    ];
    expect(cardPower(state, 0, 0, martir)).toBe(1 + 4);
  });

  it("filtra por etiqueta e conta a mão", () => {
    const state = duel([plain("x", 1, 1, ["Rei"]), plain("y", 1, 1, ["Rei"]), plain("z")], [], 4);
    const conta = place(state, 0, 0, card("conta", "continuo", "poder-por valor=+1 por=mao etiqueta=Rei", { power: 0 }));
    expect(cardPower(state, 0, 0, conta)).toBe(2);
    state.players[0].graveyard = [{ uid: 801, def: plain("p", 1, 1, ["Rei"]), bonus: 0 }];
    const gravar = place(state, 0, 1, card("gravar", "continuo", "poder-por valor=+3 por=afastadas etiqueta=Rei", { power: 0 }));
    expect(cardPower(state, 1, 0, gravar)).toBe(3);
  });

  it("a condição afastadas:N compara com o cemitério do dono", () => {
    const forte = card("forte", "revelar", "poder valor=+5 alvo=si se=afastadas:2", { power: 1 });
    const sem = duel([forte], [], 4);
    const a = turn(sem, [[0, 0]]);
    expect(a.lanes[0].cards[0][0].bonus).toBe(0);
    const com = duel([forte], [], 4);
    com.players[0].graveyard = [
      { uid: 701, def: plain("a"), bonus: 0 },
      { uid: 702, def: plain("b"), bonus: 0 },
    ];
    const b = turn(com, [[0, 0]]);
    expect(b.lanes[0].cards[0][0].bonus).toBe(5);
  });
});

describe("texto da planilha e do jogo", () => {
  const casos: Array<[string, string]> = [
    ["revelar", "esgotar valor=2"],
    ["revelar", "esgotar valor=1 se=turno:4"],
    ["revelar", "buscar qtd=2 criterio=mais-barata etiqueta=Profeta"],
    ["revelar", "buscar"],
    ["revelar", "repetir"],
    ["continuo", "blindar"],
    ["revelar", "purificar se=perdendo"],
    ["revelar", "igualar max=6"],
    ["continuo", "poder-por valor=+1 por=afastadas etiqueta=Discipulo"],
    ["revelar", "poder valor=+2 alvo=si se=afastadas:2"],
    ["continuo", "poder-por valor=+1 por=mao"],
  ];

  it("ida e volta: texto → Dom → texto", () => {
    for (const [trigger, effects] of casos) {
      const first = parseDom(trigger, effects);
      expect(first.ok, effects).toBe(true);
      if (!first.ok) continue;
      const text = domToText(first.dom);
      const again = parseDom(text.trigger, text.effects);
      expect(again.ok, effects).toBe(true);
      if (again.ok) expect(again.dom, effects).toEqual(first.dom);
    }
  });

  it("descreve cada novo Dom em português", () => {
    const text = (trigger: string, effects: string) => {
      const parsed = parseDom(trigger, effects);
      if (!parsed.ok || !parsed.dom) throw new Error(effects);
      return describeDom(parsed.dom);
    };
    expect(text("revelar", "esgotar valor=2")).toBe("Ao revelar: o rival terá 2 a menos de Vigor no próximo turno.");
    expect(text("revelar", "buscar etiqueta=Profeta")).toContain("busca no seu Time 1 figurinha Profeta de maior Vigor");
    expect(text("revelar", "repetir")).toContain('repete o Dom "Ao revelar"');
    expect(text("continuo", "blindar")).toContain("não pode ser afastada");
    expect(text("revelar", "purificar")).toContain("tira as penalidades");
    expect(text("revelar", "igualar max=6")).toContain("até +6");
    expect(text("continuo", "poder-por valor=+1 por=afastadas")).toContain("por cada figurinha sua afastada");
  });

  it("explica os erros em português", () => {
    const erro = (effects: string, trigger = "revelar") => {
      const parsed = parseDom(trigger, effects);
      return parsed.ok ? "" : parsed.error;
    };
    expect(erro("esgotar valor=3")).toMatch(/valor/);
    expect(erro("buscar criterio=aleatoria")).toMatch(/mais-cara ou mais-barata/);
    expect(erro("igualar max=20")).toMatch(/max/);
    expect(erro("repetir alvo=si")).toMatch(/não usa/);
    expect(erro("blindar")).toMatch(/continuo/);
    expect(erro("poder valor=+1 alvo=si se=afastadas:0")).toMatch(/afastadas/);
  });
});

describe("bots com os novos Dons", () => {
  const pool = (): CardDef[] => [
    card("jo", "destruida", "comprar qtd=1", { cost: 2, power: 3, tags: ["Patriarca"] }),
    card("sombra", "revelar", "esgotar valor=1", { cost: 3, power: 4 }),
    card("busca", "revelar", "buscar etiqueta=Profeta", { cost: 2, power: 3 }),
    card("eco", "revelar", "repetir", { cost: 3, power: 4 }),
    card("escudo", "continuo", "blindar", { cost: 2, power: 3 }),
    card("cura", "revelar", "purificar", { cost: 1, power: 2 }),
    card("espelho", "revelar", "igualar max=5", { cost: 4, power: 5 }),
    card("martir", "continuo", "poder-por valor=+1 por=afastadas", { cost: 2, power: 2, tags: ["Discipulo"] }),
    card("mao", "continuo", "poder-por valor=+1 por=mao", { cost: 3, power: 3 }),
    card("p1", "revelar", "poder valor=+2 alvo=aliados-aqui", { cost: 2, power: 3, tags: ["Profeta"] }),
    card("p2", "revelar", "destruir alvo=inimigo-mais-fraco", { cost: 4, power: 6, tags: ["Profeta"] }),
    card("p3", "revelar", "devolver alvo=inimigo-mais-forte", { cost: 3, power: 4, tags: ["Profeta"] }),
  ];

  function check(state: DuelState) {
    const uids: number[] = [];
    for (const side of [0, 1] as Side[]) {
      const player = state.players[side];
      expect(player.hand.length).toBeLessThanOrEqual(HAND_MAX);
      const zones = [...player.deck, ...player.hand, ...player.graveyard, ...player.returning.map((entry) => entry.card)];
      const placed = state.lanes.flatMap((lane) => lane.cards[side]);
      uids.push(...zones.map((entry) => entry.uid), ...placed.map((entry) => entry.uid));
      state.lanes.forEach((lane) => expect(lane.cards[side].length).toBeLessThanOrEqual(slotsOf(scenarioOf(lane.scenario))));
      expect(zones.length + placed.filter((entry) => !entry.def.token).length).toBe(12);
    }
    expect(new Set(uids).size).toBe(uids.length);
  }

  it("200 duelos com esses Dons terminam sem estado inválido", () => {
    const skills: BotSkill[] = ["APPRENTICE", "STUDENT", "MASTER"];
    for (let seed = 1; seed <= 200; seed += 1) {
      const defs = pool();
      const mine = defs.map((def) => ({ def: { ...def, id: `a-${def.id}` } }));
      const theirs = defs.map((def) => ({ def: { ...def, id: `b-${def.id}` } }));
      let state = newDuel({ teams: [mine, theirs], seed });
      let guard = 0;
      while (state.status === "playing" && guard < 20) {
        state = playBotTurn(state, 0, skills[seed % 3]);
        state = playBotTurn(state, 1, skills[(seed >> 1) % 3]);
        check(state);
        guard += 1;
      }
      expect(state.status).toBe("finished");
    }
  });
});
