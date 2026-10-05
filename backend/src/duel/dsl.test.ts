import { describe, expect, it } from "vitest";
import { describeDom } from "./cards";
import { buildCard, domToText, parseDom, EFFECT_GUIDE } from "./dsl";
import { cardPower, newDuel, setReady, stage, viewFor } from "./engine";
import { STARTER_CARDS } from "./starter";
import type { CardDef, DuelState, PlacedCard, Side } from "./types";

const card = (id: string, trigger: string, effects: string, extra: Partial<{ cost: number; power: number; tags: string[] }> = {}): CardDef => {
  const built = buildCard({ id, name: id, cost: extra.cost ?? 2, power: extra.power ?? 3, tags: extra.tags ?? [], trigger, effects });
  if (!built.ok) throw new Error(built.error);
  return built.card;
};

const filler = (index: number): CardDef => ({ id: `f${index}`, name: `Reforço ${index}`, cost: 1, power: 2, tags: [] });
const team = () => Array.from({ length: 12 }, (_, index) => ({ def: filler(index) }));

/** Duelo de teste com mãos escolhidas, no turno pedido (cenários neutros). */
function duel(mine: CardDef[], theirs: CardDef[] = [], turn = 4): DuelState {
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

describe("texto dos Dons", () => {
  it("todas as cartas de partida sobrevivem a ida e volta (texto → Dom → texto)", () => {
    for (const starter of STARTER_CARDS) {
      const text = domToText(starter.dom);
      const parsed = parseDom(text.trigger, text.effects);
      expect(parsed.ok, starter.id).toBe(true);
      if (parsed.ok) expect(parsed.dom, starter.id).toEqual(starter.dom ?? null);
    }
  });

  it("aceita acento, maiúsculas e vários efeitos", () => {
    const parsed = parseDom("Revelar", "poder valor=+2 alvo=SI | Comprar qtd=2");
    expect(parsed.ok && parsed.dom?.effects).toEqual([
      { kind: "power", amount: 2, to: "self" },
      { kind: "draw", count: 2 },
    ]);
    expect(parseDom("contínuo", "aura valor=1 em=vizinhos etiqueta=Profeta").ok).toBe(true);
    expect(parseDom("", "")).toEqual({ ok: true, dom: null });
  });

  it("explica o erro em português", () => {
    const error = (trigger: string, effects: string) => {
      const parsed = parseDom(trigger, effects);
      return parsed.ok ? null : parsed.error;
    };
    expect(error("revelar", "voar")).toMatch(/Efeito desconhecido/);
    expect(error("revelar", "poder valor=abc")).toMatch(/valor precisa ser um número inteiro/);
    expect(error("revelar", "poder alvo=si")).toMatch(/Falta valor/);
    expect(error("revelar", "poder valor=1 cor=azul")).toMatch(/não usa "cor"/);
    expect(error("depois", "calar")).toMatch(/Gatilho desconhecido/);
    expect(error("", "calar")).toMatch(/Falta o gatilho/);
    expect(error("revelar", "")).toMatch(/Falta o texto dos efeitos/);
    expect(error("continuo", "comprar qtd=1")).toMatch(/não funciona como Dom contínuo/);
    expect(error("revelar", "proteger")).toMatch(/só funciona no gatilho continuo/);
    expect(error("revelar", "poder valor=1 se=lua")).toMatch(/Condição desconhecida/);
    expect(error("revelar", "poder valor=1 se=inimigo-poder")).toMatch(/precisa de um número/);
    expect(error("revelar", "criar ficha=Dragão onde=aqui")).toMatch(/ficha= precisa ser/);
    expect(error("revelar", "poder valor=-3 alvo=mao")).toMatch(/própria mão/);
    expect(error("revelar", "comprar | comprar | comprar | comprar")).toMatch(/No máximo 3/);
  });

  it("monta a carta e avisa quando está acima do preço", () => {
    const ok = buildCard({ id: "x", name: "Teste", cost: 2, power: 4, tags: ["Rei", " Rei ", "Juiz"], trigger: "revelar", effects: "comprar qtd=1" });
    expect(ok.ok && ok.card.tags).toEqual(["Rei", "Juiz"]);
    expect(ok.ok && ok.warnings).toEqual([]);
    const high = buildCard({ id: "y", name: "Forte", cost: 1, power: 9, tags: [] });
    expect(high.ok && high.warnings[0]).toMatch(/alta para Vigor 1/);
    expect(buildCard({ id: "z", name: "Ruim", cost: 9, power: 1, tags: [] })).toEqual({ ok: false, error: "Vigor precisa ser um número de 0 a 6." });
  });

  it("o guia cobre todos os efeitos aceitos (cada exemplo é válido)", () => {
    for (const entry of EFFECT_GUIDE) {
      const trigger = entry.summary.startsWith("(contínuo)") ? "continuo" : "revelar";
      const parsed = parseDom(trigger, entry.example);
      expect(parsed.ok, `${entry.name}: ${parsed.ok ? "" : parsed.error}`).toBe(true);
    }
    expect(EFFECT_GUIDE.length).toBeGreaterThanOrEqual(19);
  });

  it("o texto em português descreve os efeitos novos", () => {
    const text = (trigger: string, effects: string) => {
      const parsed = parseDom(trigger, effects);
      return parsed.ok ? describeDom(parsed.dom ?? undefined) : "";
    };
    expect(text("revelar", "devolver alvo=inimigo-mais-forte")).toBe("Ao revelar: devolve a carta mais forte do rival aqui à mão do dono.");
    expect(text("revelar", "ressuscitar qtd=1")).toBe("Ao revelar: 1 carta destruída volta à sua mão.");
    expect(text("revelar", "poder valor=+1 alvo=mao")).toBe("Ao revelar: +1 de Influência para as cartas da sua mão.");
  });
});

describe("efeitos novos no motor", () => {
  it("devolver: a carta do rival volta à mão dele, sem bônus, e pode ser jogada de novo", () => {
    const state = duel([card("Anjo", "revelar", "devolver alvo=inimigo-mais-forte")]);
    place(state, 1, 0, card("Forte", "revelar", "comprar", { power: 8 }), 5);
    place(state, 1, 0, card("Fraca", "revelar", "comprar", { power: 1 }));
    const done = turn(state, [[0, 0]]);
    expect(done.lanes[0].cards[1].map((c) => c.def.name)).toEqual(["Fraca"]);
    const back = done.players[1].hand.find((c) => c.def.name === "Forte");
    expect(back?.bonus).toBe(0);
  });

  it("descartar: o rival perde a carta de maior Vigor da mão", () => {
    const state = duel([card("Peste", "revelar", "descartar qtd=1")], [card("Barata", "revelar", "comprar", { cost: 1, power: 1 }), card("Cara", "revelar", "comprar", { cost: 5, power: 9 })]);
    const done = turn(state, [[0, 0]]);
    expect(done.players[1].hand.map((c) => c.def.name)).toContain("Barata");
    expect(done.players[1].hand.map((c) => c.def.name)).not.toContain("Cara");
    expect(done.players[1].graveyard.map((c) => c.def.name)).toContain("Cara");
  });

  it("vigor-extra vale no próximo turno; custo-menos barateia a mão", () => {
    const state = duel([card("Ramp", "revelar", "vigor-extra valor=2"), card("Cara", "revelar", "comprar", { cost: 5, power: 9 })], [], 2);
    const done = turn(state, [[0, 0]]);
    expect(done.turn).toBe(3);
    expect(viewFor(done, 0).energy).toBe(5);
    expect(viewFor(done, 1).energy).toBe(3);
    // No turno seguinte o bônus acaba.
    const after = setReady(setReady(done, 0), 1);
    expect(viewFor(after, 0).energy).toBe(4);

    const cheap = turn(duel([card("Mestre", "revelar", "custo-menos valor=1"), card("Cara", "revelar", "comprar", { cost: 5, power: 9 })]), [[0, 0]]);
    expect(cheap.players[0].hand.find((c) => c.def.name === "Cara")?.def.cost).toBe(4);
  });

  it("converter: a carta mais fraca do rival passa para o seu lado", () => {
    const state = duel([card("Paulo", "revelar", "converter")]);
    place(state, 1, 0, card("Fraca", "revelar", "comprar", { power: 1 }));
    place(state, 1, 0, card("Forte", "revelar", "comprar", { power: 7 }));
    const done = turn(state, [[0, 0]]);
    expect(done.lanes[0].cards[0].map((c) => c.def.name).sort()).toEqual(["Fraca", "Paulo"]);
    expect(done.lanes[0].cards[1].map((c) => c.def.name)).toEqual(["Forte"]);
  });

  it("sacrificar, multiplicar e mover-se", () => {
    let state = duel([card("Isaque", "revelar", "sacrificar ganho=+5", { power: 2 })]);
    place(state, 0, 0, card("Cordeiro", "revelar", "comprar", { power: 1 }));
    let done = turn(state, [[0, 0]]);
    expect(done.lanes[0].cards[0].map((c) => c.def.name)).toEqual(["Isaque"]);
    expect(cardPower(done, 0, 0, done.lanes[0].cards[0][0])).toBe(2 + 5);

    state = duel([card("Hulk", "revelar", "multiplicar fator=2", { power: 4 })]);
    done = turn(state, [[0, 0]]);
    expect(cardPower(done, 0, 0, done.lanes[0].cards[0][0])).toBe(8);

    state = duel([card("Anjo", "revelar", "mover-se")]);
    place(state, 0, 0, card("Forte", "revelar", "comprar", { power: 9 }));
    place(state, 0, 1, card("Mais fraca", "revelar", "comprar", { power: 1 }));
    place(state, 0, 2, card("Média", "revelar", "comprar", { power: 4 }));
    done = turn(state, [[0, 0]]);
    expect(done.lanes[1].cards[0].map((c) => c.def.name).sort()).toEqual(["Anjo", "Mais fraca"]);
  });

  it("ressuscitar traz de volta a última carta destruída", () => {
    const state = duel([card("Lázaro", "revelar", "ressuscitar qtd=1")]);
    state.players[0].graveyard.push({ uid: 9001, def: card("Antiga", "revelar", "comprar"), bonus: 4 });
    const done = turn(state, [[0, 0]]);
    const back = done.players[0].hand.find((c) => c.def.name === "Antiga");
    expect(back?.bonus).toBe(0);
    expect(done.players[0].graveyard).toHaveLength(0);
  });

  it("poder na mão e aura em todas as cartas aliadas", () => {
    let state = duel([card("Líder", "revelar", "poder valor=+2 alvo=mao"), card("Reserva", "revelar", "comprar", { power: 3 })]);
    let done = turn(state, [[0, 0]]);
    expect(done.players[0].hand.find((c) => c.def.name === "Reserva")?.bonus).toBe(2);

    state = duel([card("Bandeira", "continuo", "aura valor=+1 em=aliados", { power: 2 })]);
    const other = place(state, 0, 1, card("Outra", "revelar", "comprar", { power: 3 }));
    done = turn(state, [[0, 0]]);
    expect(cardPower(done, 1, 0, done.lanes[1].cards[0].find((c) => c.uid === other.uid)!)).toBe(4);
  });

  it("condições novas: sozinho, ganhando, etiqueta do inimigo e mão curta", () => {
    let state = duel([card("Solitário", "revelar", "poder valor=+5 alvo=si se=sozinho")]);
    let done = turn(state, [[0, 0]]);
    expect(done.lanes[0].cards[0][0].bonus).toBe(5);

    state = duel([card("Solitário", "revelar", "poder valor=+5 alvo=si se=sozinho")]);
    place(state, 0, 0, card("Amigo", "revelar", "comprar"));
    done = turn(state, [[0, 0]]);
    expect(done.lanes[0].cards[0].find((c) => c.def.name === "Solitário")!.bonus).toBe(0);

    state = duel([card("Caçador", "revelar", "poder valor=+4 alvo=si se=inimigo-etiqueta:Gigante")]);
    place(state, 1, 0, card("Golias", "revelar", "comprar", { tags: ["Gigante"] }));
    done = turn(state, [[0, 0]]);
    expect(done.lanes[0].cards[0][0].bonus).toBe(4);

    state = duel([card("Último", "revelar", "poder valor=+3 alvo=si se=mao-max:0")]);
    done = turn(state, [[0, 0]]);
    expect(done.lanes[0].cards[0][0].bonus).toBe(3);
  });

  it("criar fichas nos vizinhos e contar cartas do rival", () => {
    let state = duel([card("Semeador", "revelar", "criar ficha=Ovelha onde=vizinhos")]);
    let done = turn(state, [[0, 1]]);
    expect(done.lanes[0].cards[0].map((c) => c.def.name)).toEqual(["Ovelha"]);
    expect(done.lanes[2].cards[0].map((c) => c.def.name)).toEqual(["Ovelha"]);
    expect(done.lanes[1].cards[0].map((c) => c.def.name)).toEqual(["Semeador"]);

    state = duel([card("Multidão", "continuo", "poder-por valor=+1 por=inimigos-aqui", { power: 1 })]);
    place(state, 1, 0, card("A", "revelar", "comprar"));
    place(state, 1, 0, card("B", "revelar", "comprar"));
    done = turn(state, [[0, 0]]);
    expect(cardPower(done, 0, 0, done.lanes[0].cards[0][0])).toBe(3);
  });
});
