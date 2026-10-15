import { describe, expect, it } from "vitest";
import { frameFor, isHexColor, MAX_FRAMES, mergeSounds, mergeSprites, poseFor, sanitizeSounds, sanitizeSprites } from "./characters";

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
    expect(sanitizeSounds({ jump: " https://x/j.mp3 ", bu: "https://x/b.mp3", win: "", death: 3 })).toEqual({ jump: "https://x/j.mp3" });
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
    const current = { jump: "a", win: "b" };
    expect(mergeSounds(current, {})).toEqual(current);
    expect(mergeSounds(current, { jump: null, win: "  " })).toEqual({});
    expect(mergeSounds(current, { death: "c" })).toEqual({ jump: "a", win: "b", death: "c" });
  });

  it("poseFor escolhe a pose pelo estado do corredor", () => {
    expect(poseFor({ form: "RUN", grounded: true, status: "running" })).toBe("run");
    expect(poseFor({ form: "RUN", grounded: false, status: "running" })).toBe("jump");
    expect(poseFor({ form: "FLY", grounded: false, status: "running" })).toBe("fly");
    expect(poseFor({ form: "GRAVITY", grounded: true, status: "running" })).toBe("gravity");
    expect(poseFor({ form: "RUN", grounded: true, status: "dead" })).toBe("dead");
  });

  it("frameFor: ciclo nas poses animadas; queda toca uma vez e fica no último; 1 quadro sempre 0", () => {
    expect(frameFor("run", 1, 100)).toBe(0);
    expect([0, 6, 12, 18, 24].map((tick) => frameFor("run", 4, tick))).toEqual([0, 1, 2, 3, 0]);
    expect([0, 6, 12, 60].map((tick) => frameFor("dead", 3, tick))).toEqual([0, 1, 2, 2]);
    expect(frameFor("portrait", 3, 50)).toBe(0);
  });

  it("isHexColor aceita só #RRGGBB", () => {
    expect(isHexColor("#38bdf8")).toBe(true);
    expect(isHexColor("#FFF")).toBe(false);
    expect(isHexColor("azul")).toBe(false);
    expect(isHexColor(null)).toBe(false);
  });
});
