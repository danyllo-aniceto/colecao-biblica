import { describe, expect, it } from "vitest";
import { mergeBest, sanitizeBest } from "./records";

describe("Corrida: melhor resultado", () => {
  it("sem resultado antigo, vale o novo (limitado a 0–100%)", () => {
    expect(mergeBest(null, { progress: 0.4, words: 3, finished: false })).toEqual({ progress: 0.4, words: 3, finished: false });
    expect(mergeBest(null, { progress: 7, words: -2, finished: false })).toEqual({ progress: 1, words: 0, finished: false });
  });

  it("cada campo guarda o máximo, e concluída nunca volta a não concluída", () => {
    const best = mergeBest({ progress: 0.8, words: 2, finished: false }, { progress: 0.5, words: 5, finished: false });
    expect(best).toEqual({ progress: 0.8, words: 5, finished: false });
    expect(mergeBest({ progress: 1, words: 9, finished: true }, { progress: 0.1, words: 0, finished: false })).toEqual({ progress: 1, words: 9, finished: true });
  });

  it("sanitizeBest recusa lixo e corrige números", () => {
    expect(sanitizeBest(null)).toBeNull();
    expect(sanitizeBest("x")).toBeNull();
    expect(sanitizeBest({ progress: "1", words: 2 })).toBeNull();
    expect(sanitizeBest({ progress: Number.NaN, words: 2 })).toBeNull();
    expect(sanitizeBest({ progress: 3, words: 2.9, finished: true })).toEqual({ progress: 1, words: 2, finished: true });
    expect(sanitizeBest({ progress: 0.5, words: 1 })).toEqual({ progress: 0.5, words: 1, finished: false });
  });
});
