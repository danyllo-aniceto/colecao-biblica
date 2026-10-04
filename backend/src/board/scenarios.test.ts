import { describe, expect, it } from "vitest";
import { botAction } from "./bots";
import {
  BoardRuleError,
  DEFAULT_CONFIG,
  MAX_POWER_UPS,
  POWER_UPS,
  answerQuestion,
  answerTrialOffer,
  createGame,
  currentPlayer,
  gateIndex,
  powerTargets,
  rollDice,
  usablePowerUps,
  usePowerUp,
  type BoardConfig,
  type BoardState,
  type Difficulty,
  type PowerUpKind,
  type QuestionBank,
  type ScenarioRules,
} from "./engine";
import { BOARD_SCENARIOS, boardRulesFor } from "./scenarios";

const DIFFICULTIES: Difficulty[] = ["EASY", "MEDIUM", "HARD", "VERY_HARD"];
const bank: QuestionBank = {
  pool: Array.from({ length: 60 }, (_, index) => ({ id: index + 1, difficulty: DIFFICULTIES[index % 4] })),
  correctOption: () => "A",
};
const SLUGS = Object.keys(BOARD_SCENARIOS);

function newGame(slug: string, options: { players?: number; seed?: number; config?: Partial<BoardConfig> } = {}): BoardState {
  const count = options.players ?? 3;
  return createGame({
    config: { ...DEFAULT_CONFIG, ...options.config },
    rules: boardRulesFor(slug),
    players: Array.from({ length: count }, (_, index) => ({ id: `p${index}`, name: `Jogador ${index}`, pawn: "🐑" })),
    seed: options.seed ?? 11,
    bank,
  }).state;
}

/** Deixa o tabuleiro liso e sem perigos, para testar uma regra de cada vez. */
function plain(state: BoardState): BoardState {
  const copy = structuredClone(state);
  const gate = gateIndex(copy.config);
  copy.tiles = copy.tiles.map((_, index) => (index === 0 ? { kind: "START" } : index === gate ? { kind: "GATE" } : index === copy.config.size ? { kind: "FINISH" } : { kind: "NORMAL" }));
  copy.hazard = null;
  copy.storm = false;
  copy.players.forEach((player) => (player.powerUps = []));
  return copy;
}

const me = (state: BoardState) => currentPlayer(state);
const byId = (state: BoardState, id: string) => state.players.find((player) => player.id === id)!;
const kinds = (state: BoardState, kind: string) => state.tiles.flatMap((tile, index) => (tile.kind === kind ? [index] : []));

/** Rola, e deixa a casa `index` com o tipo pedido (a pergunta de movimento ainda está aberta). */
function rolledWith(state: BoardState, place: (copy: BoardState) => void) {
  const copy = structuredClone(rollDice(state, bank).state);
  place(copy);
  return copy;
}

/** O jogador da vez joga a vez inteira errando tudo, até a vez passar a outro. */
function skipTurn(state: BoardState): BoardState {
  const id = me(state).id;
  let current = state;
  for (let guard = 0; guard < 50 && me(current).id === id; guard += 1) {
    if (current.phase === "ROLL") current = rollDice(current, bank).state;
    else if (current.phase === "TRIAL_OFFER") current = answerTrialOffer(current, bank, false).state;
    else current = answerQuestion(current, bank, false).state;
  }
  return current;
}

/** Todos jogam errando até voltar a vez a quem está agora (uma rodada inteira). */
function passRound(state: BoardState): BoardState {
  const first = me(state).id;
  let current = skipTurn(state);
  while (me(current).id !== first) current = skipTurn(current);
  return current;
}

/** Os outros jogam errando até ser a vez de `id`. */
function untilTurn(state: BoardState, id: string): BoardState {
  let current = state;
  for (let guard = 0; guard < 50 && me(current).id !== id; guard += 1) current = skipTurn(current);
  return current;
}

describe("os 10 cenários", () => {
  it("todos têm regras próprias com provação, evento e power-up exclusivo", () => {
    expect(SLUGS).toHaveLength(10);
    for (const slug of SLUGS) {
      const rules = BOARD_SCENARIOS[slug];
      expect(rules.slug).toBe(slug);
      expect(rules.exclusive, slug).not.toBeNull();
      expect(rules.event?.name, slug).toBeTruthy();
      expect(rules.trial.name, slug).toBeTruthy();
      expect(POWER_UPS[rules.exclusive!], slug).toBeDefined();
    }
    // Cada cenário tem um exclusivo diferente.
    expect(new Set(SLUGS.map((slug) => BOARD_SCENARIOS[slug].exclusive)).size).toBe(10);
  });

  it("cada cenário monta o tabuleiro com as casas dele (e só as dele)", () => {
    for (const size of [25, 40, 60]) {
      for (const slug of SLUGS) {
        const state = newGame(slug, { config: { size } });
        const rules = BOARD_SCENARIOS[slug];
        expect(kinds(state, "WALL").length > 0, `${slug} ${size} muros`).toBe(Boolean(rules.walls));
        expect(kinds(state, "FIRE").length > 0, `${slug} ${size} fogo`).toBe(Boolean(rules.fire));
        expect(kinds(state, "DEN").length > 0, `${slug} ${size} cova`).toBe(Boolean(rules.den));
        expect(kinds(state, "VIGIL").length > 0, `${slug} ${size} vigília`).toBe(Boolean(rules.vigil));
        expect(kinds(state, "TRIAL").length > 0, `${slug} ${size} provação`).toBe(!rules.vigil);
        expect(Boolean(state.hazard), `${slug} perigo`).toBe(Boolean(rules.hazard));
      }
    }
  });

  it("partidas só de bots em todos os cenários e tamanhos sempre terminam", () => {
    for (const slug of SLUGS) {
      for (const [index, size] of [25, 40, 60].entries()) {
        for (let seed = 1; seed <= 4; seed += 1) {
          let state = createGame({
            config: { ...DEFAULT_CONFIG, size },
            rules: boardRulesFor(slug),
            players: Array.from({ length: 2 + ((seed + index) % 5) }, (_, n) => ({ id: `b${n}`, name: `Bot ${n}`, pawn: "🐑", bot: (["APPRENTICE", "STUDENT", "MASTER"] as const)[n % 3] })),
            seed: seed * 31 + index,
            bank,
          }).state;
          let roll = seed * 7 + index;
          const random = () => {
            roll = (Math.imul(roll, 1664525) + 1013904223) | 0;
            return (roll >>> 0) / 4294967296;
          };
          let guard = 0;
          while (state.phase !== "FINISHED" && guard < 8000) {
            guard += 1;
            const action = botAction(state, bank, random);
            if (action.type === "ROLL") state = rollDice(state, bank).state;
            else if (action.type === "POWER") state = usePowerUp(state, bank, action.kind, action.targetId).state;
            else if (action.type === "TRIAL") state = answerTrialOffer(state, bank, action.accept).state;
            else state = answerQuestion(state, bank, action.correct).state;
            for (const player of state.players) {
              expect(player.position).toBeGreaterThanOrEqual(0);
              expect(player.position).toBeLessThanOrEqual(size);
              expect(player.powerUps.length).toBeLessThanOrEqual(MAX_POWER_UPS);
              expect(player.skip).toBeGreaterThanOrEqual(0);
            }
          }
          expect(state.phase, `${slug} ${size} semente ${seed}`).toBe("FINISHED");
          expect(state.winnerId).not.toBeNull();
        }
      }
    }
  });
});

describe("Arca e Egito: perigo que muda de lugar", () => {
  it("o dilúvio sorteia casas alagadas no começo e as renova a cada 3 rodadas", () => {
    let state = newGame("arca", { players: 2 });
    expect(state.hazard?.tiles).toHaveLength(4);
    const first = state.hazard!.tiles;
    state = passRound(state); // rodada 2
    expect(state.round).toBe(2);
    expect(state.hazard!.tiles).toEqual(first);
    state = passRound(state); // rodada 3
    expect(state.hazard!.tiles).toEqual(first);
    state = passRound(state); // rodada 4: nova água
    expect(state.round).toBe(4);
    expect(state.hazard!.tiles).not.toEqual(first);
  });

  it("as pragas do Egito mudam toda rodada e têm nome", () => {
    let state = newGame("egito", { players: 2 });
    const seen = new Set<string>([state.hazard!.name]);
    for (let round = 0; round < 12; round += 1) {
      state = passRound(state);
      seen.add(state.hazard!.name);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("parar numa casa atingida recua 2; o escudo protege", () => {
    const state = rolledWith(newGame("arca"), (copy) => {
      copy.tiles = copy.tiles.map((tile, index) => (index === copy.die! + 0 ? { kind: "NORMAL" } : tile));
    });
    // Casa onde o peão vai parar: marca como alagada (e limpa outras casas especiais ali).
    const target = state.die!;
    state.tiles[target] = { kind: "NORMAL" };
    state.hazard = { tiles: [target], emoji: "🌊", name: "Água subindo" };
    me(state).position = 4;
    state.die = target;
    state.players[state.turn].position = 4;
    const stop = 4 + target;
    state.tiles[stop] = { kind: "NORMAL" };
    state.hazard = { tiles: [stop], emoji: "🌊", name: "Água subindo" };
    const hit = answerQuestion(state, bank, true);
    expect(hit.state.players.find((player) => player.id === me(state).id)!.position).toBe(stop - 2);

    const shielded = structuredClone(state);
    me(shielded).powerUps = ["SHIELD"];
    const safe = answerQuestion(shielded, bank, true).state;
    expect(byId(safe, me(state).id).position).toBe(stop);
  });
});

describe("Jericó: muros", () => {
  function atWall() {
    // O peão da vez está na casa 0 e há um muro na casa 1: qualquer dado passa por ele.
    const state = rolledWith(plain(newGame("jerico")), (copy) => {
      copy.tiles[1] = { kind: "WALL" };
      copy.die = 4;
      copy.bonus = 0;
    });
    return state;
  }

  it("o muro para o peão e pede duas respostas seguidas; acertando as duas, o muro cai e o peão segue", () => {
    const state = atWall();
    const owner = me(state).id;
    const stopped = answerQuestion(state, bank, true).state;
    expect(stopped.phase).toBe("WALL_QUESTION");
    expect(byId(stopped, owner).position).toBe(1);
    expect(stopped.pending).toMatchObject({ kind: "WALL", need: 2, got: 0, carry: 4 });

    const second = answerQuestion(stopped, bank, true).state;
    expect(second.phase).toBe("WALL_QUESTION");
    expect(second.pending!.got).toBe(1);

    const through = answerQuestion(second, bank, true);
    expect(through.state.tiles[1].kind).toBe("NORMAL");
    expect(byId(through.state, owner).position).toBe(4);
    expect(through.events.some((event) => event.type === "WALL" && event.stage === "BREACHED")).toBe(true);
    expect(me(through.state).id).not.toBe(owner);
  });

  it("errar uma das duas deixa o peão no muro; na próxima vez ele já começa pelas perguntas do muro", () => {
    const stopped = answerQuestion(atWall(), bank, true).state;
    const owner = me(stopped).id;
    const failed = answerQuestion(stopped, bank, false).state;
    expect(byId(failed, owner).position).toBe(1);
    expect(failed.tiles[1].kind).toBe("WALL");
    const again = untilTurn(failed, owner);
    // Voltou a vez ao peão do muro: pergunta de muro direto, sem rolar o dado.
    expect(me(again).id).toBe(owner);
    expect(again.phase).toBe("WALL_QUESTION");
    expect(again.pending).toMatchObject({ kind: "WALL", got: 0, carry: null });
  });

  it("quem começa a vez diante do muro responde antes de rolar; derrubado, joga normalmente", () => {
    const state = plain(newGame("jerico", { players: 2 }));
    state.tiles[3] = { kind: "WALL" };
    state.players[1 - state.turn].position = 3;
    // O primeiro joga errando; ao chegar a vez do outro, ele está diante do muro.
    const next = skipTurn(state);
    expect(next.phase).toBe("WALL_QUESTION");
    expect(next.pending!.carry).toBeNull();
    const first = answerQuestion(next, bank, true).state;
    const done = answerQuestion(first, bank, true);
    expect(done.state.phase).toBe("ROLL");
    expect(done.state.tiles[3].kind).toBe("NORMAL");
    expect(me(done.state).id).toBe(me(next).id);
  });

  it("a Trombeta derruba o muro na hora e o peão segue o caminho", () => {
    const state = atWall();
    const owner = me(state).id;
    const stopped = answerQuestion(state, bank, true).state;
    me(stopped).powerUps = ["TRUMPET"];
    expect(usablePowerUps(stopped)).toEqual(["TRUMPET"]);
    const used = usePowerUp(stopped, bank, "TRUMPET");
    expect(used.state.tiles[1].kind).toBe("NORMAL");
    expect(byId(used.state, owner).position).toBe(4);
    // A marca de "um power-up por vez" não vaza para o próximo jogador.
    expect(used.state.powerUsed).toBe(false);
    expect(me(used.state).id).not.toBe(owner);
  });

  it("na rodada 7 todos os muros caem", () => {
    let state = newGame("jerico", { players: 2 });
    expect(kinds(state, "WALL").length).toBeGreaterThan(0);
    for (let round = 1; round < 7; round += 1) {
      // Mantém todos longe dos muros para só passar o tempo.
      state.players.forEach((player) => (player.position = 0));
      state.tiles = state.tiles.map((tile, index) => (tile.kind === "WALL" && index <= 1 ? { kind: "NORMAL" } : tile));
      state = passRound(state);
    }
    expect(state.round).toBe(7);
    expect(kinds(state, "WALL")).toHaveLength(0);
  });

  it("dado que passa de dois muros para no primeiro", () => {
    const state = rolledWith(plain(newGame("jerico")), (copy) => {
      copy.tiles[2] = { kind: "WALL" };
      copy.tiles[5] = { kind: "WALL" };
      copy.die = 6;
      copy.doubled = true;
    });
    const stopped = answerQuestion(state, bank, true).state;
    expect(me(stopped).position).toBe(2);
    expect(stopped.pending!.carry).toBe(12);
  });
});

describe("Babilônia: fornalha e cova dos leões", () => {
  it("cair numa casa de fogo recua 3; o escudo protege", () => {
    const state = rolledWith(plain(newGame("babilonia")), (copy) => {
      me(copy).position = 8;
      copy.die = 2;
      copy.tiles[10] = { kind: "FIRE" };
    });
    expect(byId(answerQuestion(state, bank, true).state, me(state).id).position).toBe(7);
    const shielded = structuredClone(state);
    me(shielded).powerUps = ["SHIELD"];
    expect(byId(answerQuestion(shielded, bank, true).state, me(state).id).position).toBe(10);
  });

  it("na cova dos leões fica uma vez sem jogar e ganha um escudo", () => {
    const state = rolledWith(plain(newGame("babilonia", { players: 2 })), (copy) => {
      copy.die = 2;
      copy.tiles[2] = { kind: "DEN" };
    });
    const owner = me(state).id;
    const entered = answerQuestion(state, bank, true);
    const player = byId(entered.state, owner);
    expect(player.position).toBe(2);
    expect(player.skip).toBe(1);
    expect(player.powerUps).toEqual(["SHIELD"]);
    expect(entered.events.some((event) => event.type === "DEN")).toBe(true);
    // O outro joga e, na volta, a vez do jogador da cova é pulada: o outro joga de novo.
    const other = me(entered.state).id;
    const afterOther = answerQuestion(rollDice(entered.state, bank).state, bank, false);
    expect(afterOther.events.some((event) => event.type === "SKIPPED")).toBe(true);
    expect(me(afterOther.state).id).toBe(other);
    expect(byId(afterOther.state, owner).skip).toBe(0);
  });

  it("Quarto homem deixa imune até o fim da próxima rodada, sem gastar escudo", () => {
    const state = plain(newGame("babilonia", { players: 2 }));
    me(state).powerUps = ["FOURTH"];
    const owner = me(state).id;
    const used = usePowerUp(state, bank, "FOURTH").state;
    expect(byId(used, owner).immuneRound).toBe(used.round + 1);
    // Cai no fogo na próxima rodada: imune.
    let later = rollDice(used, bank).state;
    later = answerQuestion(later, bank, false).state; // passa a vez
    later = answerQuestion(rollDice(later, bank).state, bank, false).state; // outro
    expect(me(later).id).toBe(owner);
    const fire = rolledWith(later, (copy) => {
      copy.die = 3;
      copy.tiles[3] = { kind: "FIRE" };
    });
    const result = answerQuestion(fire, bank, true);
    expect(byId(result.state, owner).position).toBe(3);
    expect(result.events.some((event) => event.type === "SHIELD" && event.power === "FOURTH")).toBe(true);
  });
});

describe("Galileia: tempestade", () => {
  it("em rodada de tempestade, errar leva o peão 1 casa para trás; sem tempestade, não", () => {
    const base = rolledWith(plain(newGame("galileia")), (copy) => {
      me(copy).position = 9;
    });
    const calm = answerQuestion(base, bank, false).state;
    expect(byId(calm, me(base).id).position).toBe(9);

    const storm = structuredClone(base);
    storm.storm = true;
    const hit = answerQuestion(storm, bank, false);
    expect(byId(hit.state, me(base).id).position).toBe(8);

    storm.players[storm.turn].powerUps = ["SHIELD"];
    expect(byId(answerQuestion(storm, bank, false).state, me(base).id).position).toBe(9);
  });

  it("a tempestade vem e vai pelas rodadas", () => {
    let state = newGame("galileia", { players: 2, seed: 5 });
    const seen = new Set<boolean>([state.storm]);
    for (let round = 0; round < 25; round += 1) {
      state = passRound(state);
      seen.add(state.storm);
    }
    expect(seen.size).toBe(2);
  });

  it("a Rede puxa um rival 2 casas; abrigo, escudo e quem está na largada ficam a salvo", () => {
    const state = plain(newGame("galileia", { players: 3 }));
    me(state).powerUps = ["NET"];
    const [rival, safe] = state.players.filter((player) => player.id !== me(state).id);
    rival.position = 9;
    safe.position = 0;
    expect(powerTargets(state, "NET")).toEqual([rival.id]);
    const pulled = usePowerUp(state, bank, "NET", rival.id);
    expect(byId(pulled.state, rival.id).position).toBe(7);
    expect(pulled.state.powerUsed).toBe(true);
    expect(() => usePowerUp(state, bank, "NET", safe.id)).toThrow(BoardRuleError);
    expect(() => usePowerUp(state, bank, "NET")).toThrow(BoardRuleError);

    const shielded = structuredClone(state);
    byId(shielded, rival.id).powerUps = ["SHIELD"];
    expect(byId(usePowerUp(shielded, bank, "NET", rival.id).state, rival.id).position).toBe(9);

    const sheltered = structuredClone(state);
    sheltered.tiles[9] = { kind: "SHELTER" };
    expect(powerTargets(sheltered, "NET")).toEqual([]);
  });

  it("a pesca milagrosa também dá um power-up", () => {
    const asked = rolledWith(plain(newGame("galileia")), (copy) => {
      copy.tiles[copy.die!] = { kind: "TRIAL" };
    });
    const trial = answerQuestion(asked, bank, true).state;
    expect(trial.phase).toBe("TRIAL_QUESTION");
    const won = answerQuestion(trial, bank, true).state;
    expect(byId(won, me(asked).id).powerUps).toHaveLength(1);
  });
});

describe("Jerusalém: vigília", () => {
  function inVigil(players = 3) {
    const state = rolledWith(plain(newGame("jerusalem", { players })), (copy) => {
      copy.die = 3;
      copy.bonus = 0;
      copy.tiles[3] = { kind: "VIGIL" };
    });
    const starter = me(state).id;
    const vigil = answerQuestion(state, bank, true).state;
    return { vigil, starter };
  }

  it("todos respondem à mesma pergunta, na ordem a partir de quem parou; só quem acerta avança", () => {
    const { vigil, starter } = inVigil(3);
    expect(vigil.phase).toBe("VIGIL_QUESTION");
    expect(vigil.vigil?.order[0]).toBe(starter);
    const questionId = vigil.pending!.questionId;
    const order = vigil.vigil!.order;

    let state = vigil;
    const positions = Object.fromEntries(state.players.map((player) => [player.id, player.position]));
    // O primeiro (quem parou na vigília) acerta, o segundo erra, o terceiro acerta.
    const answers = [true, false, true];
    answers.forEach((correct, index) => {
      expect(me(state).id).toBe(order[index]);
      expect(state.pending!.questionId).toBe(questionId);
      state = answerQuestion(state, bank, correct).state;
    });
    expect(state.phase).toBe("ROLL");
    expect(state.vigil).toBeNull();
    expect(byId(state, order[0]).position).toBe(positions[order[0]] + 2);
    expect(byId(state, order[1]).position).toBe(positions[order[1]]);
    expect(byId(state, order[2]).position).toBe(positions[order[2]] + 2);
    // A vez segue para o jogador depois de quem abriu a vigília.
    const starterIndex = state.players.findIndex((player) => player.id === starter);
    expect(state.turn).toBe((starterIndex + 1) % state.players.length);
  });

  it("trocar a pergunta não vale na vigília; a ajuda da vez é de cada um", () => {
    const { vigil } = inVigil(2);
    me(vigil).powerUps = ["SWAP", "WISDOM", "FIFTY"];
    expect(usablePowerUps(vigil)).toEqual(["FIFTY"]);
    const used = usePowerUp(vigil, bank, "FIFTY").state;
    const next = answerQuestion(used, bank, true).state;
    expect(next.phase).toBe("VIGIL_QUESTION");
    expect(next.powerUsed).toBe(false);
  });

  it("todos começam com um escudo extra", () => {
    const state = newGame("jerusalem", { players: 4 });
    expect(state.players.every((player) => player.powerUps.includes("SHIELD") && player.powerUps.length === 2)).toBe(true);
  });
});

describe("outras provações", () => {
  function trialWith(slug: string) {
    const asked = rolledWith(plain(newGame(slug)), (copy) => {
      copy.tiles[copy.die!] = { kind: "TRIAL" };
    });
    const moved = answerQuestion(asked, bank, true).state;
    // No Éden a provação é uma oferta; nos demais, a pergunta já vem.
    return moved.phase === "TRIAL_OFFER" ? answerTrialOffer(moved, bank, true).state : moved;
  }

  it("Canaã: vencer o poço dá um power-up", () => {
    const trial = trialWith("canaa");
    const owner = me(trial).id;
    expect(byId(answerQuestion(trial, bank, true).state, owner).powerUps).toHaveLength(1);
    expect(byId(answerQuestion(trial, bank, false).state, owner).powerUps).toHaveLength(0);
  });

  it("Sinai: perder o bezerro de ouro faz perder um power-up (o escudo anula tudo)", () => {
    const trial = trialWith("sinai");
    const owner = me(trial).id;
    me(trial).powerUps = ["FIFTY", "TIME"];
    expect(byId(answerQuestion(trial, bank, false).state, owner).powerUps).toHaveLength(1);
    const shielded = structuredClone(trial);
    me(shielded).powerUps = ["SHIELD", "TIME"];
    expect(byId(answerQuestion(shielded, bank, false).state, owner).powerUps).toEqual(["TIME"]);
  });

  it("Templo: vencer o juízo adianta o último colocado em 1 casa", () => {
    const trial = trialWith("templo");
    const owner = me(trial).id;
    const [last, ahead] = trial.players.filter((player) => player.id !== owner);
    last.position = 0;
    ahead.position = 20;
    const won = answerQuestion(trial, bank, true).state;
    expect(byId(won, last.id).position).toBe(1);
    expect(byId(won, ahead.id).position).toBe(20);
  });

  it("Canaã: a Tenda atravessa a provação sem pergunta e ainda dá o prêmio", () => {
    const asked = rolledWith(plain(newGame("canaa")), (copy) => {
      copy.tiles[copy.die!] = { kind: "TRIAL" };
      me(copy).powerUps = ["TENT"];
    });
    const owner = me(asked).id;
    const stop = asked.die!;
    const result = answerQuestion(asked, bank, true);
    expect(result.state.phase).toBe("ROLL");
    expect(byId(result.state, owner).position).toBe(stop + 2);
    expect(byId(result.state, owner).powerUps).toEqual([]);
    expect(result.events.some((event) => event.type === "TRIAL" && event.stage === "TENT")).toBe(true);
  });
});

describe("power-ups exclusivos", () => {
  function asking(slug: string, powers: PowerUpKind[]) {
    const state = plain(newGame(slug));
    me(state).powerUps = powers;
    return rollDice(state, bank).state;
  }

  it("Pomba tira uma errada e mostra o versículo", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const state = plain(newGame("arca", { seed }));
      me(state).powerUps = ["DOVE"];
      const used = usePowerUp(rollDice(state, bank).state, bank, "DOVE").state;
      expect(used.pending!.removed).toHaveLength(1);
      expect(used.pending!.removed).not.toContain("A");
      expect(used.pending!.hint).toBe(true);
    }
  });

  it("Luz elimina as três erradas: só sobra a certa", () => {
    const used = usePowerUp(asking("jerusalem", ["LIGHT"]), bank, "LIGHT").state;
    expect(used.pending!.removed.sort()).toEqual(["B", "C", "D"]);
  });

  it("Cajado troca de lugar com um rival à escolha, antes de rolar", () => {
    const state = plain(newGame("egito", { players: 3 }));
    me(state).powerUps = ["STAFF"];
    me(state).position = 2;
    const [near, far] = state.players.filter((player) => player.id !== me(state).id);
    near.position = 4;
    far.position = 15;
    expect(powerTargets(state, "STAFF").sort()).toEqual([far.id, near.id].sort());
    const swapped = usePowerUp(state, bank, "STAFF", far.id);
    expect(byId(swapped.state, me(state).id).position).toBe(15);
    expect(byId(swapped.state, far.id).position).toBe(2);
    expect(swapped.events.some((event) => event.type === "SWAPPED")).toBe(true);
    // Só antes de rolar.
    const rolled = rollDice(state, bank).state;
    expect(() => usePowerUp(rolled, bank, "STAFF", far.id)).toThrow(BoardRuleError);
  });

  it("Cajado não troca com quem está no portão nem num muro", () => {
    const state = plain(newGame("egito", { players: 3 }));
    me(state).powerUps = ["STAFF"];
    const [one, two] = state.players.filter((player) => player.id !== me(state).id);
    one.position = gateIndex(state.config);
    two.position = 8;
    state.tiles[8] = { kind: "WALL" };
    expect(powerTargets(state, "STAFF")).toEqual([]);
  });

  it("Maná rola de novo e não gasta a ajuda da vez; Sabedoria troca a pergunta de graça", () => {
    const manna = usePowerUp(asking("sinai", ["MANNA", "FIFTY"]), bank, "MANNA").state;
    expect(manna.powerUsed).toBe(false);
    expect(usablePowerUps(manna)).toEqual(["FIFTY"]);
    expect(usePowerUp(manna, bank, "FIFTY").state.powerUsed).toBe(true);

    const state = asking("templo", ["WISDOM", "TIME"]);
    const before = state.pending!.questionId;
    const wise = usePowerUp(state, bank, "WISDOM").state;
    expect(wise.pending!.questionId).not.toBe(before);
    expect(wise.powerUsed).toBe(false);
    expect(usePowerUp(wise, bank, "TIME").state.pending!.extraSeconds).toBe(10);
  });

  it("os passivos não se usam à mão", () => {
    const state = plain(newGame("canaa"));
    me(state).powerUps = ["TENT"];
    expect(() => usePowerUp(state, bank, "TENT")).toThrow("sozinho");
  });
});
