import { describe, expect, it } from "vitest";
import { cellAt, localLayout, planSlots, rankLocal, uniqueNames, type LocalEntry } from "./local";

const entry = (over: Partial<LocalEntry>): LocalEntry => ({ name: "x", color: "#000", progress: 0, finished: false, ticks: 0, deaths: 0, words: 0, human: true, ...over });

describe("Corrida: no mesmo aparelho", () => {
  it("faixas: 2 empilhadas, 3 (duas em cima e uma embaixo) e 4 em grade 2×2, sempre cobrindo a tela toda", () => {
    for (const count of [2, 3, 4]) {
      const cells = localLayout(count);
      expect(cells).toHaveLength(count);
      expect(cells.reduce((sum, cell) => sum + cell.w * cell.h, 0)).toBeCloseTo(1, 5);
    }
    expect(localLayout(3)[2]).toEqual({ x: 0, y: 0.5, w: 1, h: 0.5 });
    expect(() => localLayout(1)).toThrow();
    expect(() => localLayout(5)).toThrow();
  });

  it("o toque vai para a faixa certa e fora da tela não vai para nenhuma", () => {
    const cells = localLayout(4);
    expect(cellAt(cells, 0.1, 0.1)).toBe(0);
    expect(cellAt(cells, 0.9, 0.2)).toBe(1);
    expect(cellAt(cells, 0.2, 0.9)).toBe(2);
    expect(cellAt(cells, 0.99, 0.99)).toBe(3);
    expect(cellAt(cells, 1.2, 0.5)).toBe(-1);
    // 3 jogadores: a de baixo ocupa a largura toda.
    expect(cellAt(localLayout(3), 0.9, 0.9)).toBe(2);
  });

  it("vagas: humanos primeiro, bots completam (sempre pelo menos 1 humano)", () => {
    expect(planSlots(2, 4)).toEqual(["human", "human", "bot", "bot"]);
    expect(planSlots(0, 3)).toEqual(["human", "bot", "bot"]);
    expect(planSlots(9, 2)).toEqual(["human", "human"]);
  });

  it("placar: quem chegou primeiro, depois quem foi mais longe; empate por palavras e quedas", () => {
    const ranked = rankLocal([
      entry({ name: "longe", progress: 0.9 }),
      entry({ name: "lento", finished: true, progress: 1, ticks: 3000 }),
      entry({ name: "perto", progress: 0.4 }),
      entry({ name: "rapido", finished: true, progress: 1, ticks: 2800 }),
      entry({ name: "longe2", progress: 0.9, words: 3 }),
      entry({ name: "longe3", progress: 0.9, words: 3, deaths: 1 }),
    ]);
    expect(ranked.map((item) => item.name)).toEqual(["rapido", "lento", "longe2", "longe3", "longe", "perto"]);
  });

  it("nomes repetidos ganham número", () => {
    expect(uniqueNames(["Davi", "Ester", "Davi", "Davi"])).toEqual(["Davi", "Ester", "Davi (2)", "Davi (3)"]);
  });
});
