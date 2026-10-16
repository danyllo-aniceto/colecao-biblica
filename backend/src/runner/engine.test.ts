import { describe, expect, it } from "vitest";
import { holdAt, maxTicksOf, newPlayer, normalizeInputs, prepareLevel, progressOf, respawnAt, sawCentreY, simulate, stepPlayer } from "./engine";
import { emptyEffects, TURBO_TICKS } from "./powers";
import { CEIL_Y, FLOOR_Y, PLAYER, SPEED, SPEED_RANGE, TILE, type Form, type Level, type LevelObject, type PlayerState } from "./types";

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
    expect(player.x).toBeGreaterThan(300);
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

  it("pulo duplo: um novo toque no ar sobe mais; só existe um extra por pulo", () => {
    const prepared = prepareLevel(level([]));
    const apex = (presses: number[]) => {
      let player = newPlayer(prepared);
      let top = player.y;
      for (let tick = 0; tick < 120; tick += 1) {
        // Segura 1 passo em cada tecla dada e solta no seguinte.
        player = stepPlayer(prepared, player, presses.includes(tick));
        top = Math.min(top, player.y);
      }
      return FLOOR_Y - PLAYER - top;
    };
    const single = apex([0]);
    const double = apex([0, 14]);
    const triple = apex([0, 14, 28]);
    expect(double).toBeGreaterThan(single + 30);
    // O terceiro toque não ganha impulso: no mesmo instante da queda, o resultado é igual ao do pulo duplo.
    expect(triple).toBeCloseTo(double, 5);
  });

  it("segurar o toque não gasta o pulo extra sozinho", () => {
    const prepared = prepareLevel(level([]));
    let player = newPlayer(prepared);
    let top = player.y;
    for (let tick = 0; tick < 60; tick += 1) {
      player = stepPlayer(prepared, player, true);
      top = Math.min(top, player.y);
    }
    // Segurando direto, a altura é a do pulo simples (a cada pouso, pula de novo), nunca a do duplo.
    expect(FLOOR_Y - PLAYER - top).toBeLessThan(110);
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
    const jumpAt = Math.round((10 * TILE - 3 * TILE) / SPEED);
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
    const jumpAt = Math.round((11 * TILE) / SPEED);
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

  it("checkpoints são contados quando o personagem passa por eles, em ordem", () => {
    const prepared = prepareLevel(level([{ kind: "checkpoint", x: 20 }, { kind: "checkpoint", x: 10 }]));
    expect(prepared.checkpoints).toEqual([10 * TILE, 20 * TILE]);
    expect(run(prepared, 50).checkpoint).toBe(0);
    expect(run(prepared, 100).checkpoint).toBe(1);
    expect(run(prepared, 230).checkpoint).toBe(2);
  });

  it("respawnAt volta limpo ao checkpoint: parado, no chão (ou no meio do vão no voo), na forma certa e com as palavras já pegas", () => {
    const prepared = prepareLevel(
      level([{ kind: "checkpoint", x: 10 }, { kind: "portal", x: 15, form: "FLY" }, { kind: "checkpoint", x: 20 }, { kind: "portal", x: 25, form: "GRAVITY" }, { kind: "checkpoint", x: 30 }]),
    );
    const start = respawnAt(prepared, 0, [3], 77);
    expect(start.x).toBe(0);
    expect(start.collected).toEqual([3]);
    const first = respawnAt(prepared, 1, [1, 2], 50);
    expect(first).toMatchObject({ form: "RUN", checkpoint: 1, portal: 0, vy: 0, grounded: true, airJumps: 1, status: "running", tick: 50 });
    expect(first.x).toBe(10 * TILE - PLAYER / 2);
    expect(first.y).toBe(FLOOR_Y - PLAYER);
    const second = respawnAt(prepared, 2);
    expect(second).toMatchObject({ form: "FLY", portal: 1, checkpoint: 2, grounded: false });
    expect(second.y).toBe((FLOOR_Y + CEIL_Y - PLAYER) / 2);
    expect(respawnAt(prepared, 3)).toMatchObject({ form: "GRAVITY", portal: 2, grav: 1, grounded: true });
    // Voltar a um checkpoint não o faz ser contado de novo, e a corrida segue dali.
    const next = stepPlayer(prepared, first, false);
    expect(next.checkpoint).toBe(1);
    expect(next.status).toBe("running");
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

describe("Corrida: poderes no caminho", () => {
  const power = (x: number, kind: "TURBO" | "SHIELD" | "TRIPLE" | "MAGNET", y = 0): LevelObject => ({ kind: "power", x, y, power: kind });

  it("pegar um poder o registra uma vez, e ele some do caminho", () => {
    const prepared = prepareLevel(level([power(5, "MAGNET")]));
    expect(prepared.powerCount).toBe(1);
    const result = simulate(prepared, []);
    expect(result.powers).toEqual([0]);
    const player = run(prepared, 200);
    expect(player.powers).toEqual([0]);
    expect(player.effects.magnet).toBeGreaterThan(0);
  });

  it("Turbo: só um impulso de velocidade; continua batendo em espetos e paredes", () => {
    const plain = simulate(prepareLevel(level([])), []);
    const fast = simulate(prepareLevel(level([power(3, "TURBO")])), []);
    // Chega antes que sem o poder (a mesma fase vazia leva mais passos).
    expect(fast.status).toBe("finished");
    expect(fast.ticks).toBeLessThan(plain.ticks);
    expect(TURBO_TICKS).toBe(180);
    // Com o Turbo ligado o espeto e a parede ainda derrubam.
    expect(simulate(prepareLevel(level([power(3, "TURBO"), { kind: "spike", x: 12 }])), [])).toMatchObject({ status: "dead", cause: "spike" });
    expect(simulate(prepareLevel(level([power(3, "TURBO"), { kind: "block", x: 12, y: 0, w: 2, h: 3 }])), [])).toMatchObject({ status: "dead", cause: "wall" });
  });

  it("Escudo: absorve o primeiro erro e deixa passar; o segundo erro, depois da imunidade curta, derruba", () => {
    const prepared = prepareLevel(level([power(3, "SHIELD"), { kind: "spike", x: 12 }, { kind: "spike", x: 30 }]));
    const result = simulate(prepared, []);
    expect(result.status).toBe("dead");
    expect(result.cause).toBe("spike");
    // Passou do primeiro espeto (coluna 12) e morreu no segundo (coluna 30).
    expect(result.progress * 40).toBeGreaterThan(25);
    const alone = simulate(prepareLevel(level([{ kind: "spike", x: 12 }, { kind: "spike", x: 30 }])), []);
    expect(alone.progress * 40).toBeLessThan(15);
  });

  it("Escudo: também absorve uma parede (atravessa o bloco) e continua", () => {
    const prepared = prepareLevel(level([power(3, "SHIELD"), { kind: "block", x: 12, y: 0, w: 3, h: 3 }]));
    const result = simulate(prepared, []);
    expect(result.status).toBe("finished");
    expect(simulate(prepareLevel(level([{ kind: "block", x: 12, y: 0, w: 3, h: 3 }])), []).status).toBe("dead");
  });

  it("Pulo triplo: o terceiro toque no ar dá mais um impulso; sem o poder, não", () => {
    const prepared = prepareLevel(level([]));
    const apex = (effects: ReturnType<typeof emptyEffects>) => {
      let player = { ...newPlayer(prepared), effects };
      let top = player.y;
      for (let tick = 0; tick < 150; tick += 1) {
        player = stepPlayer(prepared, player, [0, 14, 28].includes(tick));
        top = Math.min(top, player.y);
      }
      return FLOOR_Y - PLAYER - top;
    };
    const normal = apex(emptyEffects());
    const triple = apex({ ...emptyEffects(), triple: 600 });
    expect(triple).toBeGreaterThan(normal + 30);
  });

  it("Ímã: pega palavras que estão acima do alcance normal; sem ele, a palavra passa", () => {
    // Palavra na linha 2 (~100 px acima do chão): correndo no chão sem pular, só o Ímã a alcança.
    const prepared = prepareLevel(level([{ kind: "word", x: 15, y: 2, index: 0 }]));
    expect(simulate(prepared, []).collected).toEqual([]);
    let player = { ...newPlayer(prepared), effects: { ...emptyEffects(), magnet: 600 } };
    for (let tick = 0; tick < 300 && player.status === "running"; tick += 1) player = stepPlayer(prepared, player, false);
    expect(player.collected).toEqual([0]);
  });

  it("voltar a um checkpoint zera os efeitos e devolve os poderes e palavras guardados", () => {
    const prepared = prepareLevel(level([{ kind: "checkpoint", x: 10 }, power(14, "TURBO")]));
    const back = respawnAt(prepared, 1, [2], 70, [0]);
    expect(back.effects).toEqual(emptyEffects());
    expect(back.powers).toEqual([0]);
    expect(back.collected).toEqual([2]);
    expect(respawnAt(prepared, 1).powers).toEqual([]);
    expect(respawnAt(prepared, 0, [], 0, [0]).powers).toEqual([0]);
  });

  it("é determinístico com poderes (mesmos toques, mesmo resultado)", () => {
    const prepared = prepareLevel(level([power(3, "SHIELD"), { kind: "spike", x: 12 }, power(20, "TURBO"), { kind: "block", x: 30, y: 0, w: 2, h: 3 }]));
    const toggles = [40, 42];
    expect(simulate(prepared, toggles)).toEqual(simulate(prepared, toggles));
  });
});

describe("Corrida: buracos no chão e no teto", () => {
  const floorPit: LevelObject = { kind: "pit", x: 12, w: 4, side: "floor" };
  const ceilingPit: LevelObject = { kind: "pit", x: 12, w: 4, side: "ceiling" };
  /** Toca durante um passo quando o corpo chega em `at` px (e solta em seguida). */
  const tapAt = (at: number) => (tick: number, player?: PlayerState) => player !== undefined && player.x >= at && player.x < at + 4 && tick >= 0;

  function play(objects: LevelObject[], form: Form, at: number | null, length = 40) {
    const prepared = prepareLevel(level(objects, { form, length }));
    let player = newPlayer(prepared);
    let pressedOnce = false;
    for (let step = 0; step < 600 && player.status === "running"; step += 1) {
      const press = at !== null && !pressedOnce && player.x >= at;
      if (press) pressedOnce = true;
      player = stepPlayer(prepared, player, press);
    }
    return player;
  }

  it("corrida: andar no chão por cima do buraco derruba; pular antes dele passa", () => {
    expect(play([floorPit], "RUN", null)).toMatchObject({ status: "dead", cause: "pit" });
    expect(play([floorPit], "RUN", 440).status).toBe("finished");
    // A janela é folgada (até a borda do buraco; já dentro dele ainda dá para salvar com o pulo duplo); pular cedo demais só adianta a queda.
    expect(play([floorPit], "RUN", 470).status).toBe("finished");
    expect(play([floorPit], "RUN", 485).status).toBe("finished");
    expect(play([floorPit], "RUN", 300).status).toBe("dead");
  });

  it("gravidade: no chão sobre o buraco do chão cai; virar para o teto antes passa", () => {
    expect(play([floorPit], "GRAVITY", null)).toMatchObject({ status: "dead", cause: "pit" });
    expect(play([floorPit], "GRAVITY", 360).status).toBe("finished");
  });

  it("gravidade: no teto sob o buraco do teto cai; o buraco do teto não atrapalha quem está no chão", () => {
    // Começa no chão: o buraco do teto não faz nada.
    expect(play([ceilingPit], "GRAVITY", null).status).toBe("finished");
    // Já no teto (virou antes), o buraco derruba, e virar de volta antes dele passa.
    const upThenDown = prepareLevel(level([ceilingPit], { form: "GRAVITY" }));
    let player = newPlayer(upThenDown);
    for (let step = 0; step < 40 && player.status === "running"; step += 1) player = stepPlayer(upThenDown, player, step === 1);
    expect(player.grav).toBe(-1);
    let walking = player;
    for (let step = 0; step < 300 && walking.status === "running"; step += 1) walking = stepPlayer(upThenDown, walking, false);
    expect(walking).toMatchObject({ status: "dead", cause: "pit" });
    let flipped = player;
    for (let step = 0; step < 600 && flipped.status === "running"; step += 1) flipped = stepPlayer(upThenDown, flipped, flipped.x >= 360 && flipped.grav === -1 && flipped.x < 380);
    expect(flipped.status).toBe("finished");
  });

  it("o buraco só tira o apoio do corpo inteiro dentro dele: pisar na borda não derruba", () => {
    const prepared = prepareLevel(level([{ kind: "pit", x: 12, w: 4, side: "floor" }]));
    // Corpo de 32 px dentro de um buraco de 160 px; na borda (x = 470, corpo em 470–502) ainda há chão sob a parte de fora.
    const edge = { ...newPlayer(prepared), x: 470 };
    expect(stepPlayer(prepared, edge, false).y).toBe(FLOOR_Y - PLAYER);
  });

  it("o buraco entra no mapa da fase preparada e a fase continua determinística", () => {
    const prepared = prepareLevel(level([floorPit, ceilingPit]));
    expect(prepared.pits).toEqual([{ side: "floor", l: 480, r: 640 }, { side: "ceiling", l: 480, r: 640 }]);
    expect(simulate(prepared, [])).toEqual(simulate(prepared, []));
  });
});

describe("Corrida: voo letal, serras e velocidade da fase", () => {
  it("no voo, encostar num bloco derruba (de lado, por cima ou por baixo); o chão e o teto do campo continuam seguros", () => {
    // Bloco no meio do caminho do voo, na altura do personagem (meio do campo).
    const side = prepareLevel(level([{ kind: "block", x: 10, y: 0, w: 2, h: 5 }], { form: "FLY" }));
    const hit = run(side, 300);
    expect(hit.status).toBe("dead");
    expect(hit.cause).toBe("wall");
    // Roçar a borda de cima do bloco também derruba (antes só empurrava): voando rente, sem folga.
    const graze = prepareLevel(level([{ kind: "block", x: 10, y: 0, w: 6, h: 3 }], { form: "FLY" }));
    let player = newPlayer(graze);
    for (let tick = 0; tick < 400 && player.status === "running"; tick += 1) player = stepPlayer(graze, player, false);
    expect(player.status).toBe("dead");
    // Sem nada à frente, deslizar no chão do campo não derruba.
    const free = prepareLevel(level([], { form: "FLY" }));
    expect(run(free, 100).status).toBe("running");
  });

  it("o Escudo ainda absorve a batida no voo", () => {
    const prepared = prepareLevel(level([{ kind: "power", x: 2, y: 3, power: "SHIELD" }, { kind: "block", x: 10, y: 0, w: 2, h: 5 }], { form: "FLY" }));
    const player = run(prepared, 120);
    expect(player.status).toBe("running");
  });

  it("serra parada mata ao encostar; a serra que sobe e desce depende de onde o jogador está (mesma fase, mesma conferência)", () => {
    const still = prepareLevel(level([{ kind: "saw", x: 10, y: 0 }]));
    expect(run(still, 200).cause).toBe("saw");
    // Pulando por cima na hora certa passa.
    const jumped = run(still, 200, (tick) => tick >= 80 && tick < 83);
    expect(jumped.status).toBe("running");
    // Com onda: o centro muda conforme o jogador anda, e é o mesmo para quem repete a partida.
    const wavy = prepareLevel(level([{ kind: "saw", x: 10, y: 2, amp: 1.5, period: 10 }]));
    const saw = wavy.cols[10].saws[0];
    expect(saw.amp).toBe(1.5 * TILE);
    const a = sawCentreY(saw, saw.cx - 100);
    const b = sawCentreY(saw, saw.cx - 100);
    expect(a).toBe(b);
    expect(sawCentreY(saw, saw.cx)).toBeCloseTo(saw.cy, 5);
    expect(Math.abs(sawCentreY(saw, saw.cx + saw.period / 4) - saw.cy)).toBeCloseTo(saw.amp, 3);
  });

  it("a velocidade da fase encurta o tempo para chegar (e fica entre os limites)", () => {
    const normal = prepareLevel({ ...level([]), speed: 1 });
    const fast = prepareLevel({ ...level([]), speed: 1.25 });
    const ticksOf = (prepared: ReturnType<typeof prepareLevel>) => simulate(prepared, [], 2000).ticks;
    expect(ticksOf(fast)).toBeLessThan(ticksOf(normal));
    expect(ticksOf(normal) / ticksOf(fast)).toBeCloseTo(1.25, 1);
    expect(prepareLevel({ ...level([]), speed: 99 }).speed).toBe(SPEED_RANGE.max);
    expect(prepareLevel({ ...level([]), speed: 0.1 }).speed).toBe(SPEED_RANGE.min);
    expect(prepareLevel(level([])).speed).toBe(1);
    expect(maxTicksOf(fast)).toBeLessThan(maxTicksOf(normal));
  });
});
