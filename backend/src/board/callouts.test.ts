import { describe, expect, it } from "vitest";
import { botAction } from "./bots";
import { MAX_CALLOUTS, MOMENT_MS, STEP_MS, calloutsFor, holdMs, pickCallouts, walkMs, type Callout } from "./callouts";
import { DEFAULT_CONFIG, answerQuestion, answerTrialOffer, createGame, rollDice, usePowerUp, type BoardEvent, type BoardState, type Difficulty, type QuestionBank } from "./engine";
import { BOARD_SCENARIOS, boardRulesFor } from "./scenarios";

const DIFFICULTIES: Difficulty[] = ["EASY", "MEDIUM", "HARD", "VERY_HARD"];
const bank: QuestionBank = {
  pool: Array.from({ length: 60 }, (_, index) => ({ id: index + 1, difficulty: DIFFICULTIES[index % 4] })),
  correctOption: () => "A",
};

function newGame(slug: string, seed = 5): BoardState {
  return createGame({
    config: { ...DEFAULT_CONFIG },
    rules: boardRulesFor(slug),
    players: [0, 1, 2].map((index) => ({ id: `p${index}`, name: `Jogador ${index}`, pawn: "🐑" })),
    seed,
    bank,
  }).state;
}

const callout = (partial: Partial<Callout>): Callout => ({ emoji: "x", title: "t", text: "t", tone: "info", tiles: [], delayMs: 0, ...partial });

describe("avisos animados do tabuleiro", () => {
  it("atalho e queda explicam o que aconteceu e acendem as casas", () => {
    const state = newGame("eden");
    const events: BoardEvent[] = [
      { type: "MOVED", playerId: "p0", from: 10, to: 14, reason: "DICE" },
      { type: "MOVED", playerId: "p0", from: 14, to: 20, reason: "SHORTCUT" },
    ];
    const [shortcut] = calloutsFor(events, state);
    expect(shortcut).toMatchObject({ title: "Atalho!", tone: "good", tiles: [14, 20], playerId: "p0", fx: "hop" });
    expect(shortcut.text).toContain("6 casas");
    const [fall] = calloutsFor([{ type: "MOVED", playerId: "p1", from: 12, to: 9, reason: "FALL" }], state);
    expect(fall).toMatchObject({ title: "Queda!", tone: "bad", fx: "shake" });
    expect(fall.text).toContain("3 casas");
  });

  it("o aviso espera o peão chegar andando pelo dado", () => {
    const state = newGame("eden");
    const events: BoardEvent[] = [
      { type: "MOVED", playerId: "p0", from: 3, to: 7, reason: "DICE" },
      { type: "POWER_GAINED", playerId: "p0", power: "SHIELD" },
    ];
    expect(calloutsFor(events, state)[0].delayMs).toBe(4 * STEP_MS);
    // Sem andar (recuo ou salto), não espera.
    expect(calloutsFor([{ type: "MOVED", playerId: "p0", from: 7, to: 4, reason: "TRIAL_PENALTY" }, { type: "POWER_FULL", playerId: "p0" }], state)[0].delayMs).toBe(0);
  });

  it("o movimento comum e os efeitos que já têm aviso próprio não repetem", () => {
    const state = newGame("eden");
    const quiet: BoardEvent[] = [
      { type: "TURN", playerId: "p1", round: 2 },
      { type: "ROLLED", playerId: "p0", die: 3, bonus: 0, doubled: false },
      { type: "ANSWERED", playerId: "p0", kind: "MOVE", correct: true },
      { type: "MOVED", playerId: "p0", from: 1, to: 4, reason: "DICE" },
      { type: "MOVED", playerId: "p0", from: 4, to: 6, reason: "TRIAL" },
      { type: "MOVED", playerId: "p0", from: 6, to: 3, reason: "PUSH" },
      { type: "MOVED", playerId: "p0", from: 6, to: 3, reason: "NET" },
      { type: "RECYCLED" },
    ];
    expect(calloutsFor(quiet, state)).toEqual([]);
  });

  it("empurrão, rede e troca falam de quem fez e de quem sofreu", () => {
    const state = newGame("galileia");
    const [pushed] = calloutsFor([{ type: "PUSHED", playerId: "p1", byId: "p0", from: 9, to: 6 }], state);
    expect(pushed.text).toContain("Jogador 0");
    expect(pushed.text).toContain("Jogador 1");
    expect(pushed).toMatchObject({ tone: "bad", tiles: [9], playerId: "p1" });
    const [netted] = calloutsFor([{ type: "NETTED", playerId: "p1", byId: "p0" }], state);
    expect(netted.title).toBe("Rede!");
    const [swapped] = calloutsFor([{ type: "SWAPPED", playerId: "p0", withId: "p1" }], state);
    expect(swapped.tiles).toHaveLength(2);
  });

  it("poder ganho ensina o que ele faz", () => {
    const state = newGame("eden");
    const [gained] = calloutsFor([{ type: "POWER_GAINED", playerId: "p0", power: "SHIELD" }], state);
    expect(gained.emoji).toBe("🛡️");
    expect(gained.text).toContain("Escudo");
    expect(gained.text).toContain("recuo");
  });

  it("a pausa da jogada soma o peão andando e um tempo por aviso, com teto", () => {
    const walk: BoardEvent[] = [{ type: "MOVED", playerId: "p0", from: 3, to: 7, reason: "DICE" }];
    expect(walkMs(walk)).toBe(4 * STEP_MS + 500);
    expect(walkMs([{ type: "MOVED", playerId: "p0", from: 7, to: 4, reason: "FALL" }])).toBe(0);
    expect(holdMs(walk, [callout({}), callout({})])).toBe(4 * STEP_MS + 500 + 2 * MOMENT_MS);
    expect(holdMs([], [])).toBe(0);
    expect(holdMs(walk, Array.from({ length: 10 }, () => callout({})))).toBeLessThanOrEqual(9000);
  });

  it("limita os avisos de uma jogada e tira primeiro os menos importantes", () => {
    const list = [callout({ title: "a", tone: "info" }), callout({ title: "b", tone: "good" }), callout({ title: "c", tone: "bad" }), callout({ title: "d", tone: "special" }), callout({ title: "e", tone: "good" })];
    const picked = pickCallouts(list);
    expect(picked).toHaveLength(MAX_CALLOUTS);
    expect(picked.map((item) => item.title)).toEqual(["c", "d", "e"]);
    expect(pickCallouts(list.slice(0, 2))).toHaveLength(2);
  });

  it("jogando cada cenário por inteiro, todo aviso tem texto e casas válidas", () => {
    for (const slug of Object.keys(BOARD_SCENARIOS)) {
      for (const seed of [3, 8]) {
        let state = newGame(slug, seed);
        let guard = 0;
        while (state.phase !== "FINISHED" && guard < 1500) {
          guard += 1;
          const action = botAction(state, bank);
          const result =
            action.type === "ROLL"
              ? rollDice(state, bank)
              : action.type === "POWER"
                ? usePowerUp(state, bank, action.kind, action.targetId)
                : action.type === "TRIAL"
                  ? answerTrialOffer(state, bank, action.accept)
                  : answerQuestion(state, bank, action.correct);
          for (const item of calloutsFor(result.events, result.state)) {
            expect(item.title.length).toBeGreaterThan(0);
            expect(item.text.length).toBeGreaterThan(0);
            expect(item.delayMs).toBeGreaterThanOrEqual(0);
            for (const tile of item.tiles) {
              expect(tile).toBeGreaterThanOrEqual(0);
              expect(tile).toBeLessThanOrEqual(result.state.config.size);
            }
          }
          state = result.state;
        }
        expect(state.phase).toBe("FINISHED");
      }
    }
  });
});
