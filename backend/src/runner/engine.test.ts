import { describe, expect, it } from "vitest";
import { holdAt, maxTicksOf, newPlayer, normalizeInputs, prepareLevel, progressOf, simulate, stepPlayer } from "./engine";
import { CEIL_Y, FLOOR_Y, PLAYER, TILE, type Form, type Level, type LevelObject, type PlayerState } from "./types";

const level = (objects: LevelObject[], options: { form?: Form; length?: number } = {}): Level => ({
  id: "t",
  name: "Teste",
  form: options.form ?? "RUN",
  length: options.length ?? 40,
  objects,
});

/** Anda `ticks` passos com o toque numa regra (`held(tick)`). */
function run(prepared: ReturnType<typeof prepareLevel>, ticks: number, held: (tick: number) => boolean = () => false, from?: PlayerState) {
  let player = from ?? newPlayer(prepared);
  for (let tick = 0; tick < ticks && player.status === "running"; tick += 1) player = stepPlayer(prepared, player, held(player.tick));
  return player;
}

describe("Corrida: física", () => {
  it("sem toque, o personagem corre pelo chão sem sair dele", () => {
    const prepared = prepareLevel(level([]));
    const player = run(prepared, 100);
    expect(player.status).toBe("running");
    expect(player.y).toBe(FLOOR_Y - PLAYER);
    expect(player.x).toBeGreaterThan(500);
  });

  it("o pulo sobe cerca de 2 linhas e volta ao chão", () => {
    const prepared = prepareLevel(level([]));
    let player = newPlayer(prepared);
    let top = player.y;
    for (let tick = 0; tick < 60; tick += 1) {
      player = stepPlayer(prepared, player, tick < 1);
      top = Math.min(top, player.y);
    }
    const height = FLOOR_Y - PLAYER - top;
    expect(height).toBeGreaterThan(80);
    expect(height).toBeLessThan(110);
    expect(player.y).toBe(FLOOR_Y - PLAYER);
    expect(player.grounded).toBe(true);
  });

  it("o espeto derruba, e pular por cima passa", () => {
    const prepared = prepareLevel(level([{ kind: "spike", x: 10 }]));
    expect(simulate(prepared, []).status).toBe("dead");
    expect(simulate(prepared, []).cause).toBe("spike");
    // Existe uma janela de tempo em que o pulo passa por cima; antes e depois dela o personagem cai no espeto.
    const wins = Array.from({ length: 120 }, (_, jumpAt) => simulate(prepared, [jumpAt, jumpAt + 2]).status === "finished");
    expect(wins.filter(Boolean).length).toBeGreaterThan(3);
    expect(wins[0]).toBe(false);
  });

  it("bater de lado num bloco derruba; pousar em cima segue em frente", () => {
    const prepared = prepareLevel(level([{ kind: "block", x: 10, y: 0, w: 3, h: 1 }]));
    const crash = simulate(prepared, []);
    expect(crash.status).toBe("dead");
    expect(crash.cause).toBe("wall");
    const jumpAt = Math.round((10 * TILE - 3 * TILE) / 5.4);
    expect(simulate(prepared, [jumpAt, jumpAt + 2]).status).toBe("finished");
  });

  it("um bloco alto demais (3 linhas) não dá para subir", () => {
    const prepared = prepareLevel(level([{ kind: "block", x: 10, y: 0, w: 2, h: 3 }]));
    for (let jumpAt = 0; jumpAt < 140; jumpAt += 1) expect(simulate(prepared, [jumpAt, jumpAt + 2]).status).toBe("dead");
  });

  it("a cabeça batendo no bloco por baixo não derruba", () => {
    // Bloco flutuante: passa-se por baixo; pular debaixo dele bate a cabeça e o personagem cai de volta sem morrer.
    const prepared = prepareLevel(level([{ kind: "block", x: 10, y: 2, w: 6, h: 1 }]));
    expect(simulate(prepared, []).status).toBe("finished");
    const jumpAt = Math.round((11 * TILE) / 5.4);
    const result = simulate(prepared, [jumpAt, jumpAt + 1]);
    expect(result.status).toBe("finished");
  });

  it("voo: segurar sobe, soltar desce, e o teto e o chão não derrubam", () => {
    const prepared = prepareLevel(level([], { form: "FLY" }));
    const start = newPlayer(prepared);
    const up = run(prepared, 120, () => true);
    expect(up.y).toBe(CEIL_Y);
    expect(up.status).toBe("running");
    const down = run(prepared, 160, () => false, up);
    expect(down.y).toBe(FLOOR_Y - PLAYER);
    expect(start.y).toBeGreaterThan(CEIL_Y);
  });

  it("gravidade: tocar no chão inverte e o personagem vai para o teto; no ar o toque não faz nada", () => {
    const prepared = prepareLevel(level([], { form: "GRAVITY" }));
    let player = newPlayer(prepared);
    player = stepPlayer(prepared, player, true);
    expect(player.grav).toBe(-1);
    player = run(prepared, 60, () => false, player);
    expect(player.y).toBe(CEIL_Y);
    expect(player.grounded).toBe(true);
    // Toque no ar: começa a cair, então tocar durante a queda não inverte de novo.
    player = stepPlayer(prepared, player, true);
    const airborne = player;
    const again = stepPlayer(prepared, stepPlayer(prepared, airborne, false), true);
    expect(again.grav).toBe(airborne.grav);
  });

  it("o portal troca a forma no ponto marcado", () => {
    const prepared = prepareLevel(level([{ kind: "portal", x: 10, form: "FLY" }]));
    const before = run(prepared, 50);
    expect(before.form).toBe("RUN");
    const after = run(prepared, 100);
    expect(after.form).toBe("FLY");
  });

  it("palavras são coletadas uma vez e aparecem na lista", () => {
    const prepared = prepareLevel(level([{ kind: "word", x: 10, y: 0, index: 0 }, { kind: "word", x: 20, y: 5, index: 1 }]));
    const result = simulate(prepared, []);
    expect(result.collected).toEqual([0]);
    expect(prepared.wordCount).toBe(2);
  });

  it("termina ao chegar ao fim e o progresso vai a 100%", () => {
    const prepared = prepareLevel(level([], { length: 12 }));
    const result = simulate(prepared, []);
    expect(result.status).toBe("finished");
    expect(result.progress).toBe(1);
    expect(progressOf(prepared, newPlayer(prepared))).toBe(0);
  });

  it("é determinístico: os mesmos toques dão sempre o mesmo resultado", () => {
    const prepared = prepareLevel(level([{ kind: "spike", x: 10 }, { kind: "block", x: 20, y: 0, w: 2, h: 1 }]));
    const toggles = [20, 22, 60, 62];
    expect(simulate(prepared, toggles)).toEqual(simulate(prepared, toggles));
  });

  it("sem fim à vista, a partida acaba por tempo", () => {
    const prepared = prepareLevel(level([], { length: 400 }));
    expect(simulate(prepared, [], 100).status).toBe("timeout");
    expect(maxTicksOf(prepared)).toBeGreaterThan(100);
  });
});

describe("Corrida: toques", () => {
  it("holdAt segue a paridade dos toques", () => {
    const toggles = [5, 9, 20];
    expect([0, 4, 5, 8, 9, 19, 20, 99].map((tick) => holdAt(toggles, tick))).toEqual([false, false, true, true, false, false, true, true]);
  });

  it("normalizeInputs só aceita inteiros crescentes dentro do tempo", () => {
    expect(normalizeInputs([1, 5, 9], 100)).toEqual([1, 5, 9]);
    expect(normalizeInputs([], 100)).toEqual([]);
    expect(normalizeInputs([5, 5], 100)).toBeNull();
    expect(normalizeInputs([9, 5], 100)).toBeNull();
    expect(normalizeInputs([1.5], 100)).toBeNull();
    expect(normalizeInputs([-1], 100)).toBeNull();
    expect(normalizeInputs([101], 100)).toBeNull();
    expect(normalizeInputs(["1"], 100)).toBeNull();
    expect(normalizeInputs("x", 100)).toBeNull();
    expect(normalizeInputs(Array.from({ length: 4001 }, (_, index) => index), 10000)).toBeNull();
  });
});
