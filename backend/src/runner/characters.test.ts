import { describe, expect, it } from "vitest";
import { frameFor, isHexColor, MAX_FRAMES, MAX_VARIANTS, mergeSounds, mergeSprites, pickSheet, pickVariant, POSE_INFO, POSES, poseFor, sanitizeSounds, sanitizeSprites, shouldSpeak, SOUND_INFO, SOUND_KEYS } from "./characters";

describe("Corrida: personagens", () => {
  it("sanitizeSprites guarda só poses conhecidas com endereço, e limita os quadros a 1–12", () => {
    expect(sanitizeSprites(null)).toEqual({});
    expect(sanitizeSprites("x")).toEqual({});
    expect(
      sanitizeSprites({
        run: { url: " https://x/run.png ", frames: 4 },
        jump: { url: "https://x/j.png" },
        voar: { url: "https://x/v.png", frames: 2 },
        fly: { url: "", frames: 2 },
        dead: { url: "https://x/d.png", frames: 99 },
        win: { url: "https://x/w.png", frames: 0 },
        gravity: "https://x/g.png",
      }),
    ).toEqual({ run: { url: "https://x/run.png", frames: 4 }, jump: { url: "https://x/j.png", frames: 1 }, dead: { url: "https://x/d.png", frames: MAX_FRAMES }, win: { url: "https://x/w.png", frames: 1 } });
  });

  it("sanitizeSounds guarda só sons conhecidos com endereço", () => {
    expect(sanitizeSounds({ jump: " https://x/j.mp3 ", bu: "https://x/b.mp3", win: "", death: 3 })).toEqual({ jump: ["https://x/j.mp3"] });
    expect(sanitizeSounds(undefined)).toEqual({});
  });

  it("mergeSprites: pose ausente não muda, null remove, valor novo troca", () => {
    const current = { run: { url: "a", frames: 4 }, jump: { url: "b", frames: 1 } };
    expect(mergeSprites(current, {})).toEqual(current);
    expect(mergeSprites(current, { jump: null })).toEqual({ run: { url: "a", frames: 4 } });
    expect(mergeSprites(current, { run: { url: " c ", frames: 6 }, fly: { url: "d", frames: 2 } })).toEqual({ run: { url: "c", frames: 6 }, jump: { url: "b", frames: 1 }, fly: { url: "d", frames: 2 } });
    // Não altera o objeto de entrada.
    expect(current.run.url).toBe("a");
  });

  it("mergeSounds: ausente não muda; null ou vazio remove", () => {
    const current = { jump: ["a"], win: ["b"] };
    expect(mergeSounds(current, {})).toEqual(current);
    expect(mergeSounds(current, { jump: null, win: "  " })).toEqual({});
    expect(mergeSounds(current, { death: "c" })).toEqual({ jump: ["a"], win: ["b"], death: ["c"] });
  });

  it("cada ação aceita várias falas (sem vazias nem repetidas, até o limite) e lê o formato antigo de uma fala só", () => {
    expect(sanitizeSounds({ jump: ["a", " b ", "a", "", 3] })).toEqual({ jump: ["a", "b"] });
    expect(sanitizeSounds({ jump: Array.from({ length: 20 }, (_, index) => `s${index}`) }).jump).toHaveLength(MAX_VARIANTS);
    expect(sanitizeSounds({ jump: [] })).toEqual({});
    expect(mergeSounds({ jump: ["a"] }, { jump: ["x", "y"] })).toEqual({ jump: ["x", "y"] });
  });

  it("as falas novas (começa a voar, gravidade, volta a correr, poder) existem e todas têm chance entre 0 e 1", () => {
    for (const key of ["flyStart", "gravityStart", "runStart", "power"] as const) expect(SOUND_KEYS).toContain(key);
    for (const key of SOUND_KEYS) {
      expect(SOUND_INFO[key].chance).toBeGreaterThan(0);
      expect(SOUND_INFO[key].chance).toBeLessThanOrEqual(1);
    }
    // Pulo fala menos que a queda; a vitória fala sempre.
    expect(SOUND_INFO.jump.chance).toBeLessThan(SOUND_INFO.death.chance);
    expect(SOUND_INFO.win.chance).toBe(1);
  });

  it("sorteia a fala sem repetir a anterior seguidamente e cobre todas; às vezes fica quieto", () => {
    expect(pickVariant(1, 0)).toBe(0);
    for (const count of [2, 3, 5]) {
      const seen = new Set<number>();
      let last = -1;
      for (let index = 0; index < 200; index += 1) {
        const pick = pickVariant(count, last);
        expect(pick).toBeGreaterThanOrEqual(0);
        expect(pick).toBeLessThan(count);
        expect(pick).not.toBe(last);
        seen.add(pick);
        last = pick;
      }
      expect(seen.size).toBe(count);
    }
    // Sorteio previsível: 0,99 sempre dá a última possível, 0 dá a primeira (pulando a anterior).
    expect(pickVariant(3, 0, () => 0)).toBe(1);
    expect(pickVariant(3, 2, () => 0.99)).toBe(1);
    expect(shouldSpeak("win", () => 0.999)).toBe(true);
    expect(shouldSpeak("jump", () => 0.9)).toBe(false);
    expect(shouldSpeak("jump", () => 0.1)).toBe(true);
    const talks = Array.from({ length: 1000 }, () => shouldSpeak("jump")).filter(Boolean).length;
    expect(talks).toBeGreaterThan(200);
    expect(talks).toBeLessThan(420);
  });

  it("a pose Parado existe, com 4 quadros por padrão, e é guardada como as outras", () => {
    expect(POSES).toContain("idle");
    expect(POSE_INFO.idle).toMatchObject({ label: "Parado", defaultFrames: 4 });
    expect(sanitizeSprites({ idle: { url: "https://x/idle.webp", frames: 4 } })).toEqual({ idle: { url: "https://x/idle.webp", frames: 4 } });
    expect(mergeSprites({}, { idle: { url: "https://x/i.webp", frames: 6 } })).toEqual({ idle: { url: "https://x/i.webp", frames: 6 } });
    expect(mergeSprites({ idle: { url: "a", frames: 4 }, run: { url: "b", frames: 4 } }, { idle: null })).toEqual({ run: { url: "b", frames: 4 } });
  });

  it("poseFor escolhe a pose pelo estado do corredor", () => {
    expect(poseFor({ form: "RUN", grounded: true, status: "running" })).toBe("run");
    expect(poseFor({ form: "RUN", grounded: false, status: "running" })).toBe("jump");
    expect(poseFor({ form: "FLY", grounded: false, status: "running" })).toBe("fly");
    expect(poseFor({ form: "GRAVITY", grounded: true, status: "running" })).toBe("gravity");
    expect(poseFor({ form: "RUN", grounded: true, status: "dead" })).toBe("dead");
  });

  it("poseFor: parado (antes da largada, esperando o toque, pausado) ou na chegada, no chão, usa Parado; no voo continua pairando; cair vence tudo", () => {
    expect(poseFor({ form: "RUN", grounded: true, status: "running" }, true)).toBe("idle");
    expect(poseFor({ form: "GRAVITY", grounded: true, status: "running" }, true)).toBe("idle");
    expect(poseFor({ form: "FLY", grounded: false, status: "running" }, true)).toBe("fly");
    expect(poseFor({ form: "RUN", grounded: true, status: "finished" })).toBe("idle");
    expect(poseFor({ form: "FLY", grounded: false, status: "finished" })).toBe("fly");
    expect(poseFor({ form: "RUN", grounded: true, status: "dead" }, true)).toBe("dead");
  });

  it("frameFor: ciclo nas poses animadas; Parado respira mais devagar; queda toca uma vez e fica no último; retrato e 1 quadro ficam no 0", () => {
    expect(frameFor("run", 1, 100)).toBe(0);
    expect([0, 6, 12, 18, 24].map((tick) => frameFor("run", 4, tick))).toEqual([0, 1, 2, 3, 0]);
    expect([0, 11, 12, 24, 36, 48, 60].map((tick) => frameFor("idle", 4, tick))).toEqual([0, 0, 1, 2, 3, 0, 1]);
    expect([0, 6, 12, 60].map((tick) => frameFor("dead", 3, tick))).toEqual([0, 1, 2, 2]);
    expect(frameFor("portrait", 3, 50)).toBe(0);
    expect(frameFor("idle", 4, -5)).toBe(0);
  });

  it("pickSheet: usa a imagem da pose; sem arte Parado cai para o 1º quadro da corrida (parado); as outras poses sem arte não têm reserva", () => {
    const run = { url: "https://x/run.webp", frames: 4 };
    const idle = { url: "https://x/idle.webp", frames: 4 };
    expect(pickSheet({ run, idle }, "idle")).toEqual({ sheet: idle, still: false });
    expect(pickSheet({ run }, "idle")).toEqual({ sheet: run, still: true });
    expect(pickSheet({ idle }, "run")).toBeNull();
    expect(pickSheet({}, "idle")).toBeNull();
    expect(pickSheet(undefined, "idle")).toBeNull();
  });

  it("isHexColor aceita só #RRGGBB", () => {
    expect(isHexColor("#38bdf8")).toBe(true);
    expect(isHexColor("#FFF")).toBe(false);
    expect(isHexColor("azul")).toBe(false);
    expect(isHexColor(null)).toBe(false);
  });
});
