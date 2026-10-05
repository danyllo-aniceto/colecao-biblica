import { describe, expect, it } from "vitest";
import { botAction } from "./bots";
import {
  BoardRuleError,
  CATCH_UP_GAP,
  DEFAULT_CONFIG,
  MAX_POWER_UPS,
  PUSH_BACK,
  answerQuestion,
  answerTrialOffer,
  buildTiles,
  createGame,
  currentPlayer,
  gateIndex,
  rollDice,
  standings,
  usePowerUp,
  usablePowerUps,
  type BoardConfig,
  type BoardState,
  type Difficulty,
  type QuestionBank,
  type ScenarioRules,
} from "./engine";
import { BOARD_SCENARIOS, boardRulesFor } from "./scenarios";

const DIFFICULTIES: Difficulty[] = ["EASY", "MEDIUM", "HARD", "VERY_HARD"];

function makeBank(size = 40): QuestionBank {
  return {
    pool: Array.from({ length: size }, (_, index) => ({ id: index + 1, difficulty: DIFFICULTIES[index % 4] })),
    correctOption: () => "A",
  };
}

const RULES: ScenarioRules = { slug: "teste", trial: { name: "Prova", description: "", reward: 2, penalty: 2, optional: false }, shelterGrants: false, exclusive: null };
const bank = makeBank();

function newGame(options: { config?: Partial<BoardConfig>; rules?: ScenarioRules; players?: number; seed?: number; bank?: QuestionBank } = {}): BoardState {
  const count = options.players ?? 3;
  return createGame({
    config: { ...DEFAULT_CONFIG, ...options.config },
    rules: options.rules ?? RULES,
    players: Array.from({ length: count }, (_, index) => ({ id: `p${index}`, name: `Jogador ${index}`, pawn: "🐑" })),
    seed: options.seed ?? 7,
    bank: options.bank ?? bank,
  }).state;
}

/** Deixa o tabuleiro liso (só largada, portão e chegada) para testar uma regra de cada vez. */
function plain(state: BoardState): BoardState {
  const copy = structuredClone(state);
  copy.tiles = copy.tiles.map((tile, index) => (index === 0 ? { kind: "START" } : index === gateIndex(copy.config) ? { kind: "GATE" } : index === copy.config.size ? { kind: "FINISH" } : { kind: "NORMAL" }));
  copy.players.forEach((player) => (player.powerUps = []));
  return copy;
}

const me = (state: BoardState) => currentPlayer(state);

/** Rola e responde (certo ou errado) a jogada de movimento da vez. */
function play(state: BoardState, correct: boolean) {
  const rolled = rollDice(state, bank).state;
  return answerQuestion(rolled, bank, correct);
}

describe("tabuleiro", () => {
  it("monta largada, portão e chegada nos três tamanhos, com abrigos fixos", () => {
    for (const size of [25, 40, 60, 80, 100]) {
      const state = newGame({ config: { size } });
      expect(state.tiles).toHaveLength(size + 1);
      expect(state.tiles[0].kind).toBe("START");
      expect(state.tiles[size - 1].kind).toBe("GATE");
      expect(state.tiles[size].kind).toBe("FINISH");
      expect(state.tiles[8].kind).toBe("SHELTER");
      expect(state.tiles[16].kind).toBe("SHELTER");
    }
  });

  it("sorteia provações, atalhos, quedas e poderes sem encostar uns nos outros", () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      for (const size of [25, 40, 60, 80, 100]) {
        const draft = { s: { rng: seed } };
        const tiles = buildTiles({ ...DEFAULT_CONFIG, size }, RULES, draft);
        const kinds = (kind: string) => tiles.flatMap((tile, index) => (tile.kind === kind ? [index] : []));
        expect(kinds("TRIAL").length).toBeGreaterThanOrEqual(Math.max(2, Math.round(size / 13)) - 1);
        expect(kinds("SHORTCUT").length).toBeGreaterThanOrEqual(1);
        expect(kinds("FALL").length).toBeGreaterThanOrEqual(1);
        expect(kinds("POWER").length).toBeGreaterThanOrEqual(2);
        tiles.forEach((tile, index) => {
          if (tile.kind === "SHORTCUT") {
            expect(tile.to).toBeGreaterThan(index);
            expect(tile.to).toBeLessThan(size - 1);
          }
          if (tile.kind === "FALL") {
            expect(tile.to).toBeLessThan(index);
            expect(tile.to).toBeGreaterThanOrEqual(0);
          }
          if (["TRIAL", "SHORTCUT", "FALL", "POWER"].includes(tile.kind)) {
            // Duas casas do mesmo tipo nunca ficam coladas.
            expect(tiles[index - 1].kind).not.toBe(tile.kind);
            expect(tiles[index + 1].kind).not.toBe(tile.kind);
          }
        });
      }
    }
  });

  it("sem power-ups, não há casas de poder nem power-up inicial", () => {
    const state = newGame({ config: { powerUps: false } });
    expect(state.tiles.some((tile) => tile.kind === "POWER")).toBe(false);
    expect(state.players.every((player) => player.powerUps.length === 0)).toBe(true);
  });

  it("a mesma semente gera a mesma partida", () => {
    const a = newGame({ seed: 99 });
    const b = newGame({ seed: 99 });
    expect(b).toEqual(a);
    expect(rollDice(a, bank).state).toEqual(rollDice(b, bank).state);
    expect(newGame({ seed: 100 }).tiles).not.toEqual(a.tiles);
  });
});

describe("criação da partida", () => {
  it("exige de 2 a 6 jogadores com ids diferentes", () => {
    expect(() => newGame({ players: 1 })).toThrow(BoardRuleError);
    expect(() => newGame({ players: 7 })).toThrow(BoardRuleError);
    expect(newGame({ players: 6 }).players).toHaveLength(6);
    expect(() =>
      createGame({ config: DEFAULT_CONFIG, rules: RULES, bank, seed: 1, players: [{ id: "x", name: "A", pawn: "🐑" }, { id: "x", name: "B", pawn: "🕊️" }] }),
    ).toThrow(BoardRuleError);
  });

  it("todos começam na largada, com 1 power-up comum, e a ordem é sorteada", () => {
    const state = newGame({ players: 6 });
    expect(state.players.every((player) => player.position === 0 && player.powerUps.length === 1)).toBe(true);
    expect(state.phase).toBe("ROLL");
    const orders = new Set(Array.from({ length: 12 }, (_, seed) => newGame({ players: 6, seed: seed + 1 }).players.map((player) => player.id).join()));
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe("jogada", () => {
  it("rola de 1 a 6 e sorteia a pergunta; só rola na fase certa", () => {
    const state = plain(newGame());
    const rolled = rollDice(state, bank);
    expect(rolled.state.die).toBeGreaterThanOrEqual(1);
    expect(rolled.state.die).toBeLessThanOrEqual(6);
    expect(rolled.state.phase).toBe("QUESTION");
    expect(rolled.state.pending?.kind).toBe("MOVE");
    expect(rolled.events.map((event) => event.type)).toEqual(["ROLLED", "QUESTION"]);
    expect(() => rollDice(rolled.state, bank)).toThrow(BoardRuleError);
    expect(() => answerQuestion(state, bank, true)).toThrow(BoardRuleError);
  });

  it("não muta o estado recebido", () => {
    const state = plain(newGame());
    const snapshot = structuredClone(state);
    rollDice(state, bank);
    expect(state).toEqual(snapshot);
  });

  it("acertou: anda o valor do dado e passa a vez", () => {
    const state = plain(newGame());
    const first = me(state).id;
    const rolled = rollDice(state, bank).state;
    const die = rolled.die!;
    const { state: after, events } = answerQuestion(rolled, bank, true);
    expect(after.players.find((player) => player.id === first)!.position).toBe(die);
    expect(me(after).id).not.toBe(first);
    expect(after.phase).toBe("ROLL");
    expect(events.some((event) => event.type === "MOVED")).toBe(true);
  });

  it("errou: fica parado, zera a sequência e passa a vez", () => {
    const state = plain(newGame());
    const first = me(state).id;
    const after = play(state, false).state;
    const player = after.players.find((item) => item.id === first)!;
    expect(player.position).toBe(0);
    expect(player.stats.wrong).toBe(1);
    expect(me(after).id).not.toBe(first);
  });

  it("conta acertos e a maior sequência", () => {
    let state = plain(newGame({ players: 2 }));
    for (const correct of [true, true, true, false]) {
      // Cada jogador joga a sua vez; só o primeiro interessa aqui.
      state = play(state, correct).state;
      state = play(state, false).state;
    }
    const first = state.players[0];
    expect(first.stats.correct).toBe(3);
    expect(first.stats.bestStreak).toBe(3);
    expect(first.stats.streak).toBe(0);
  });

  it("a rodada sobe quando a vez volta ao primeiro jogador", () => {
    let state = plain(newGame({ players: 3 }));
    expect(state.round).toBe(1);
    for (let index = 0; index < 3; index += 1) state = play(state, false).state;
    expect(state.round).toBe(2);
    expect(state.turn).toBe(0);
  });
});

describe("casas", () => {
  function tileGame(kind: "SHORTCUT" | "FALL" | "POWER" | "SHELTER", options: { to?: number; rules?: ScenarioRules } = {}) {
    const state = plain(newGame({ rules: options.rules }));
    const rolled = rollDice(state, bank).state;
    const copy = structuredClone(rolled);
    copy.tiles[copy.die!] = { kind, to: options.to };
    return copy;
  }

  it("atalho leva para frente sem encadear efeito", () => {
    const state = tileGame("SHORTCUT", { to: 11 });
    const after = answerQuestion(state, bank, true).state;
    expect(after.players.find((player) => player.id === me(state).id)!.position).toBe(11);
  });

  it("queda leva para trás, e o escudo anula", () => {
    const fall = tileGame("FALL", { to: 0 });
    const target = fall.die!;
    fall.tiles[target] = { kind: "FALL", to: Math.max(0, target - 1) };
    const fell = answerQuestion(fall, bank, true).state;
    expect(fell.players.find((player) => player.id === me(fall).id)!.position).toBe(Math.max(0, target - 1));

    const shielded = structuredClone(fall);
    me(shielded).powerUps = ["SHIELD"];
    const result = answerQuestion(shielded, bank, true);
    expect(result.state.players.find((player) => player.id === me(fall).id)!.position).toBe(target);
    expect(result.state.players.find((player) => player.id === me(fall).id)!.powerUps).toEqual([]);
    expect(result.events.some((event) => event.type === "SHIELD")).toBe(true);
  });

  it("casa de poder dá um power-up; mochila cheia não dá", () => {
    const state = tileGame("POWER");
    const owner = me(state).id;
    const gained = answerQuestion(state, bank, true);
    expect(gained.state.players.find((player) => player.id === owner)!.powerUps).toHaveLength(1);
    expect(gained.events.some((event) => event.type === "POWER_GAINED")).toBe(true);

    const full = structuredClone(state);
    me(full).powerUps = ["FIFTY", "TIME"];
    const result = answerQuestion(full, bank, true);
    expect(result.state.players.find((player) => player.id === owner)!.powerUps).toHaveLength(MAX_POWER_UPS);
    expect(result.events.some((event) => event.type === "POWER_FULL")).toBe(true);
  });

  it("abrigo só dá power-up nos cenários que pedem", () => {
    const plainShelter = tileGame("SHELTER");
    expect(answerQuestion(plainShelter, bank, true).state.players.find((player) => player.id === me(plainShelter).id)!.powerUps).toHaveLength(0);
    const tree = tileGame("SHELTER", { rules: BOARD_SCENARIOS.eden });
    expect(answerQuestion(tree, bank, true).state.players.find((player) => player.id === me(tree).id)!.powerUps).toHaveLength(1);
  });
});

describe("empurrão", () => {
  function pushSetup(rivalOn: "NORMAL" | "SHELTER") {
    const state = plain(newGame({ players: 2 }));
    const rolled = rollDice(state, bank).state;
    const copy = structuredClone(rolled);
    const target = copy.die!;
    copy.tiles[target] = { kind: rivalOn };
    const rival = copy.players.find((player) => player.id !== me(copy).id)!;
    rival.position = target;
    return { copy, rivalId: rival.id, target };
  }

  it("cair na casa de um rival o recua", () => {
    const { copy, rivalId, target } = pushSetup("NORMAL");
    const result = answerQuestion(copy, bank, true);
    const rival = result.state.players.find((player) => player.id === rivalId)!;
    expect(rival.position).toBe(Math.max(0, target - PUSH_BACK));
    expect(me(copy).stats.pushes + result.state.players.find((player) => player.id === me(copy).id)!.stats.pushes).toBe(1);
    expect(result.events.some((event) => event.type === "PUSHED")).toBe(true);
  });

  it("não empurra em abrigo, com a regra desligada nem quem tem escudo", () => {
    const shelter = pushSetup("SHELTER");
    expect(answerQuestion(shelter.copy, bank, true).state.players.find((player) => player.id === shelter.rivalId)!.position).toBe(shelter.target);

    const off = pushSetup("NORMAL");
    off.copy.config.push = false;
    expect(answerQuestion(off.copy, bank, true).state.players.find((player) => player.id === off.rivalId)!.position).toBe(off.target);

    const shield = pushSetup("NORMAL");
    shield.copy.players.find((player) => player.id === shield.rivalId)!.powerUps = ["SHIELD"];
    const result = answerQuestion(shield.copy, bank, true);
    const rival = result.state.players.find((player) => player.id === shield.rivalId)!;
    expect(rival.position).toBe(shield.target);
    expect(rival.powerUps).toEqual([]);
  });

  it("a largada nunca empurra", () => {
    const state = plain(newGame({ players: 2 }));
    const rival = state.players[1];
    rival.position = 0;
    // Quem erra fica na largada junto do rival, sem empurrão.
    expect(play(state, false).state.players.every((player) => player.position === 0)).toBe(true);
  });
});

describe("power-ups", () => {
  function questionState(powers: Parameters<typeof usePowerUp>[2][]) {
    const state = plain(newGame());
    me(state).powerUps = [...powers];
    return rollDice(state, bank).state;
  }

  it("meio a meio elimina duas erradas e nunca a certa", () => {
    for (let seed = 1; seed <= 25; seed += 1) {
      const state = plain(newGame({ seed }));
      me(state).powerUps = ["FIFTY"];
      const rolled = rollDice(state, bank).state;
      const used = usePowerUp(rolled, bank, "FIFTY").state;
      expect(used.pending!.removed).toHaveLength(2);
      expect(used.pending!.removed).not.toContain("A");
    }
  });

  it("tempo extra soma segundos; trocar sorteia outra pergunta", () => {
    const withTime = usePowerUp(questionState(["TIME"]), bank, "TIME").state;
    expect(withTime.pending!.extraSeconds).toBe(10);

    const state = questionState(["SWAP"]);
    const before = state.pending!.questionId;
    const swapped = usePowerUp(state, bank, "SWAP").state;
    expect(swapped.pending!.questionId).not.toBe(before);
    expect(swapped.phase).toBe("QUESTION");
  });

  it("rolar de novo troca o dado e mantém a pergunta", () => {
    let found = false;
    for (let seed = 1; seed <= 30 && !found; seed += 1) {
      const state = plain(newGame({ seed }));
      me(state).powerUps = ["REROLL"];
      const rolled = rollDice(state, bank).state;
      const again = usePowerUp(rolled, bank, "REROLL").state;
      expect(again.pending!.questionId).toBe(rolled.pending!.questionId);
      expect(again.die).toBeGreaterThanOrEqual(1);
      found = found || again.die !== rolled.die;
    }
    expect(found).toBe(true);
  });

  it("dado dobrado vale antes ou depois de rolar e dobra o passo", () => {
    const state = plain(newGame());
    me(state).powerUps = ["DOUBLE"];
    const armed = usePowerUp(state, bank, "DOUBLE").state;
    expect(armed.doubled).toBe(true);
    const rolled = rollDice(armed, bank).state;
    const after = answerQuestion(rolled, bank, true).state;
    const mover = after.players.find((player) => player.id === me(state).id)!;
    expect(mover.position).toBe(Math.min(rolled.die! * 2, gateIndex(rolled.config)));
  });

  it("só um por vez, só se tiver e só quando serve", () => {
    const state = questionState(["TIME", "FIFTY"]);
    const once = usePowerUp(state, bank, "TIME").state;
    expect(() => usePowerUp(once, bank, "FIFTY")).toThrow("Só um power-up por vez");
    expect(() => usePowerUp(state, bank, "SWAP")).toThrow("Você não tem");
    expect(() => usePowerUp(state, bank, "SHIELD")).toThrow("sozinho");
    const noDie = plain(newGame());
    me(noDie).powerUps = ["REROLL"];
    expect(() => usePowerUp(noDie, bank, "REROLL")).toThrow("não serve agora");
    expect(usablePowerUps(state).sort()).toEqual(["FIFTY", "TIME"]);
    expect(usablePowerUps(once)).toEqual([]);
  });

  it("o uso de power-up volta a ficar livre na vez seguinte", () => {
    const state = questionState(["TIME"]);
    const used = usePowerUp(state, bank, "TIME").state;
    const next = answerQuestion(used, bank, false).state;
    expect(next.powerUsed).toBe(false);
  });
});

describe("ajuda ao último colocado", () => {
  it("dá +1 quando está 8 casas atrás do líder, se ligada", () => {
    const state = plain(newGame({ players: 2 }));
    state.players.find((player) => player.id !== me(state).id)!.position = CATCH_UP_GAP + 2;
    const rolled = rollDice(state, bank).state;
    expect(rolled.bonus).toBe(1);
    const after = answerQuestion(rolled, bank, true).state;
    expect(after.players.find((player) => player.id === me(state).id)!.position).toBe(rolled.die! + 1);

    const off = structuredClone(state);
    off.config.catchUp = false;
    expect(rollDice(off, bank).state.bonus).toBe(0);
  });

  it("não dá quando a diferença é menor", () => {
    const state = plain(newGame({ players: 2 }));
    state.players.find((player) => player.id !== me(state).id)!.position = CATCH_UP_GAP - 1;
    expect(rollDice(state, bank).state.bonus).toBe(0);
  });
});

describe("provação", () => {
  function onTrial(rules: ScenarioRules, correctMove = true) {
    const state = plain(newGame({ rules }));
    const rolled = rollDice(state, bank).state;
    const copy = structuredClone(rolled);
    copy.tiles[copy.die!] = { kind: "TRIAL" };
    return answerQuestion(copy, bank, correctMove).state;
  }

  it("obrigatória: cai direto na pergunta difícil; acertar avança, errar recua", () => {
    const asked = onTrial(RULES);
    expect(asked.phase).toBe("TRIAL_QUESTION");
    const difficulty = bank.pool.find((question) => question.id === asked.pending!.questionId)!.difficulty;
    expect(["HARD", "VERY_HARD"]).toContain(difficulty);

    const start = me(asked).position;
    const won = answerQuestion(asked, bank, true).state;
    expect(won.players.find((player) => player.id === me(asked).id)!.position).toBe(start + RULES.trial.reward);
    expect(won.players.find((player) => player.id === me(asked).id)!.stats.trialsWon).toBe(1);

    const lost = answerQuestion(asked, bank, false).state;
    expect(lost.players.find((player) => player.id === me(asked).id)!.position).toBe(Math.max(0, start - RULES.trial.penalty));
  });

  it("escudo anula a perda da provação", () => {
    const asked = onTrial(RULES);
    me(asked).powerUps = ["SHIELD"];
    const start = me(asked).position;
    const lost = answerQuestion(asked, bank, false);
    expect(lost.state.players.find((player) => player.id === me(asked).id)!.position).toBe(start);
    expect(lost.events.some((event) => event.type === "SHIELD")).toBe(true);
  });

  it("opcional (Éden): oferece primeiro; recusar passa a vez, aceitar sorteia a pergunta", () => {
    const offered = onTrial(BOARD_SCENARIOS.eden);
    expect(offered.phase).toBe("TRIAL_OFFER");
    expect(rollDice).toBeDefined();
    expect(() => rollDice(offered, bank)).toThrow(BoardRuleError);

    const declined = answerTrialOffer(offered, bank, false).state;
    expect(declined.phase).toBe("ROLL");
    expect(me(declined).id).not.toBe(me(offered).id);

    const accepted = answerTrialOffer(offered, bank, true).state;
    expect(accepted.phase).toBe("TRIAL_QUESTION");
    expect(answerQuestion(accepted, bank, true).state.players.find((player) => player.id === me(offered).id)!.position).toBe(me(offered).position + 3);
  });

  it("errar a pergunta de movimento nunca abre a provação", () => {
    expect(onTrial(RULES, false).phase).toBe("ROLL");
  });

  it("a Árvore da Vida anula o recuo e ainda avança 2 casas", () => {
    const asked = onTrial(BOARD_SCENARIOS.eden);
    const accepted = answerTrialOffer(asked, bank, true).state;
    me(accepted).powerUps = ["TREE"];
    const start = me(accepted).position;
    const lost = answerQuestion(accepted, bank, false);
    expect(lost.state.players.find((player) => player.id === me(accepted).id)!.position).toBe(start + 2);
    expect(lost.state.players.find((player) => player.id === me(accepted).id)!.powerUps).toEqual([]);
  });
});

describe("chegada", () => {
  function nearGate(distance = 1) {
    const state = plain(newGame());
    me(state).position = gateIndex(state.config) - distance;
    return state;
  }

  it("passar do portão para nele e pede a pergunta final (difícil)", () => {
    const rolled = rollDice(nearGate(), bank).state;
    const result = answerQuestion(rolled, bank, true);
    expect(result.state.phase).toBe("FINAL_QUESTION");
    expect(result.state.pending!.kind).toBe("FINAL");
    expect(me(result.state).position).toBe(gateIndex(result.state.config));
    const difficulty = bank.pool.find((question) => question.id === result.state.pending!.questionId)!.difficulty;
    expect(["HARD", "VERY_HARD"]).toContain(difficulty);
  });

  it("acertar a final vence; a partida termina e ninguém joga mais", () => {
    const final = answerQuestion(rollDice(nearGate(), bank).state, bank, true).state;
    const owner = me(final).id;
    const won = answerQuestion(final, bank, true);
    expect(won.state.phase).toBe("FINISHED");
    expect(won.state.winnerId).toBe(owner);
    expect(won.state.players.find((player) => player.id === owner)!.position).toBe(won.state.config.size);
    expect(won.events.some((event) => event.type === "WON")).toBe(true);
    expect(() => rollDice(won.state, bank)).toThrow(BoardRuleError);
    expect(standings(won.state)[0].id).toBe(owner);
  });

  it("errar a final passa a vez; no turno seguinte volta direto à final, sem dado", () => {
    let state = answerQuestion(rollDice(nearGate(), bank).state, bank, true).state;
    const owner = me(state).id;
    state = answerQuestion(state, bank, false).state;
    expect(me(state).id).not.toBe(owner);
    // Os outros jogam e erram; a vez volta ao portão.
    while (me(state).id !== owner) state = play(state, false).state;
    expect(state.phase).toBe("FINAL_QUESTION");
    expect(state.die).toBeNull();
  });

  it("o portão é abrigo: ninguém é empurrado nele", () => {
    const state = plain(newGame({ players: 2 }));
    const gate = gateIndex(state.config);
    me(state).position = gate - 2;
    state.players.find((player) => player.id !== me(state).id)!.position = gate;
    const rolled = rollDice(state, bank).state;
    rolled.die = 2;
    rolled.bonus = 0;
    const result = answerQuestion(rolled, bank, true);
    expect(result.state.players.find((player) => player.id !== me(state).id)!.position).toBe(gate);
  });

  it("a provação que passa do portão leva à pergunta final", () => {
    const state = plain(newGame({ rules: { ...RULES, trial: { ...RULES.trial, reward: 5 } } }));
    const gate = gateIndex(state.config);
    const rolled = rollDice(state, bank).state;
    const copy = structuredClone(rolled);
    me(copy).position = gate - 6;
    copy.die = 6;
    copy.bonus = 0;
    copy.tiles[gate] = { kind: "GATE" };
    // Cai numa casa de provação a 1 do portão... usa direto a pergunta de provação.
    copy.tiles[gate - 0] = { kind: "GATE" };
    copy.phase = "TRIAL_QUESTION";
    copy.pending = { questionId: bank.pool.find((question) => question.difficulty === "HARD")!.id, kind: "TRIAL", removed: [], extraSeconds: 0 };
    me(copy).position = gate - 3;
    const result = answerQuestion(copy, bank, true);
    expect(result.state.phase).toBe("FINAL_QUESTION");
    expect(me(result.state).position).toBe(gate);
  });
});

describe("perguntas", () => {
  it("não repete pergunta antes de esgotar o banco, e depois recomeça", () => {
    const small = makeBank(6);
    let state = createGame({
      config: { ...DEFAULT_CONFIG, powerUps: false },
      rules: RULES,
      players: [{ id: "a", name: "A", pawn: "🐑" }, { id: "b", name: "B", pawn: "🕊️" }],
      seed: 3,
      bank: small,
    }).state;
    const seen: number[] = [];
    let recycled = false;
    for (let turn = 0; turn < 20; turn += 1) {
      const rolled = rollDice(state, small);
      seen.push(rolled.state.pending!.questionId);
      const answered = answerQuestion(rolled.state, small, false);
      recycled = recycled || answered.events.some((event) => event.type === "RECYCLED") || rolled.events.some((event) => event.type === "RECYCLED");
      state = answered.state;
    }
    expect(new Set(seen.slice(0, 6)).size).toBe(6);
    expect(recycled).toBe(true);
  });

  it("sem perguntas, não dá para jogar", () => {
    const empty: QuestionBank = { pool: [], correctOption: () => "A" };
    const state = plain(newGame());
    expect(() => rollDice(state, empty)).toThrow(BoardRuleError);
  });
});

describe("bots", () => {
  it("o bot rola, responde e a vez sempre passa", () => {
    let state = plain(newGame({ players: 2 }));
    for (let step = 0; step < 6; step += 1) {
      const action = botAction(state, bank, () => 0.99);
      expect(["ROLL", "POWER", "TRIAL", "ANSWER"]).toContain(action.type);
      if (action.type === "ROLL") state = rollDice(state, bank).state;
      else if (action.type === "ANSWER") state = answerQuestion(state, bank, action.correct).state;
    }
    expect(state.round).toBeGreaterThanOrEqual(1);
  });

  it("partidas só de bots sempre terminam, com estado coerente", () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const size = [25, 40, 60, 80, 100][seed % 5];
      const rules = seed % 2 === 0 ? BOARD_SCENARIOS.eden : boardRulesFor("outro");
      let state = createGame({
        config: { ...DEFAULT_CONFIG, size },
        rules,
        players: Array.from({ length: 2 + (seed % 5) }, (_, index) => ({ id: `b${index}`, name: `Bot ${index}`, pawn: "🐑", bot: (["APPRENTICE", "STUDENT", "MASTER"] as const)[index % 3] })),
        seed,
        bank,
      }).state;
      // O sorteio dos bots usa a mesma semente para o teste ser repetível.
      let roll = seed;
      const random = () => {
        roll = (Math.imul(roll, 1664525) + 1013904223) | 0;
        return (roll >>> 0) / 4294967296;
      };
      let guard = 0;
      while (state.phase !== "FINISHED" && guard < 5000) {
        guard += 1;
        const action = botAction(state, bank, random);
        if (action.type === "ROLL") state = rollDice(state, bank).state;
        else if (action.type === "POWER") state = usePowerUp(state, bank, action.kind).state;
        else if (action.type === "TRIAL") state = answerTrialOffer(state, bank, action.accept).state;
        else state = answerQuestion(state, bank, action.correct).state;
        for (const player of state.players) {
          expect(player.position).toBeGreaterThanOrEqual(0);
          expect(player.position).toBeLessThanOrEqual(size);
          expect(player.powerUps.length).toBeLessThanOrEqual(MAX_POWER_UPS);
        }
      }
      expect(state.phase).toBe("FINISHED");
      expect(state.winnerId).not.toBeNull();
      expect(state.players.find((player) => player.id === state.winnerId)!.position).toBe(size);
    }
  });
});

describe("cenários", () => {
  it("cenário sem regra própria usa a provação genérica obrigatória", () => {
    const rules = boardRulesFor("criado-no-painel");
    expect(rules.slug).toBe("criado-no-painel");
    expect(rules.trial.optional).toBe(false);
    expect(rules.exclusive).toBeNull();
  });

  it("o Éden tem Árvore da Vida e abrigos que dão poder", () => {
    expect(boardRulesFor("eden")).toMatchObject({ exclusive: "TREE", shelterGrants: true, trial: { optional: true, reward: 3, penalty: 3 } });
  });
});
