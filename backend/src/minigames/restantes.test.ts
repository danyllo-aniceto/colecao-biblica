import { describe, expect, it } from "vitest";
import { lettersOnly } from "./common";
import { checkCrossword, CHECK_PENALTY, CROSSWORD_LEVELS, generateCrossword, letterAt, PEEK_PENALTY, wrongCells, type CrosswordState, type Entry } from "./crossword";

describe("palavras cruzadas", () => {
  const words = ["Davi", "Moisés", "Jericó", "Egito", "Rute", "Noé", "Jonas", "Sinai", "Elias", "Ester", "Paulo", "Isaque", "Jordão", "Belém"];
  const entries: Entry[] = words.map((word) => ({ word: lettersOnly(word), clue: `Dica de ${word.length} letras` }));

  it("monta uma grade com pelo menos 4 palavras cruzadas, todas com número e dica", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const generated = generateCrossword(seed, entries);
      expect(generated, `semente ${seed}`).not.toBeNull();
      const { puzzle, state } = generated!;
      expect(puzzle.words.length).toBeGreaterThanOrEqual(4);
      expect(state.solution).toHaveLength(puzzle.rows);
      expect(puzzle.open.every((row) => row.length === puzzle.cols)).toBe(true);
      // Cada palavra cabe na grade e as letras da solução formam o que o gabarito diz.
      for (const word of puzzle.words) {
        const letters = Array.from({ length: word.length }, (_, index) => state.solution[word.row + (word.across ? 0 : index)][word.col + (word.across ? index : 0)]).join("");
        expect(words.map(lettersOnly)).toContain(letters);
      }
      // A solução não vaza na parte pública.
      expect(JSON.stringify(puzzle)).not.toContain('"solution"');
    }
    expect(generateCrossword(5, entries)).toEqual(generateCrossword(5, entries));
    expect(generateCrossword(1, entries.slice(0, 2))).toBeNull();
  });

  const full = (generated: NonNullable<ReturnType<typeof generateCrossword>>, level: "facil" | "medio" | "dificil" = "medio", timeLimit: number | null = null): CrosswordState => ({ ...generated.state, level, timeLimit, checks: 0, peeks: 0 });

  it("o nível define o tamanho da grade e a quantidade de palavras", () => {
    const big = ["Davi", "Moisés", "Jericó", "Egito", "Rute", "Noé", "Jonas", "Sinai", "Elias", "Ester", "Paulo", "Isaque", "Jordão", "Belém", "Salomão", "Samuel", "Abraão", "Nazaré", "Jerusalém", "Gideão", "Débora", "Daniel", "Zacarias", "Tiago"].map((word) => ({ word: lettersOnly(word), clue: `Dica ${word}`, label: word, imageUrl: null }));
    for (const level of ["facil", "medio", "dificil"] as const) {
      const config = CROSSWORD_LEVELS[level];
      const generated = generateCrossword(4, big, level);
      expect(generated, level).not.toBeNull();
      expect(generated!.puzzle.words.length).toBeGreaterThanOrEqual(config.minWords);
      expect(generated!.puzzle.words.length).toBeLessThanOrEqual(config.words);
      expect(Math.max(generated!.puzzle.rows, generated!.puzzle.cols)).toBeLessThanOrEqual(config.size);
      expect(generated!.puzzle.words.every((word) => word.length >= config.minLength && word.length <= config.maxLength)).toBe(true);
      expect(generated!.state.words).toHaveLength(generated!.puzzle.words.length);
      expect(generated!.state.words.every((info) => info.label.length > 0)).toBe(true);
    }
  });

  it("preencher tudo certo pontua cheio vezes o fator do nível; letras erradas ou vazias custam; formato errado zera", () => {
    const generated = generateCrossword(3, entries)!;
    const state = full(generated);
    expect(checkCrossword(state, state.solution, 5)).toMatchObject({ solved: true, score: 800 });
    expect(checkCrossword(full(generated, "dificil"), state.solution, 5).score).toBe(1000);
    expect(checkCrossword(full(generated, "facil"), state.solution, 5).score).toBe(600);
    const blank = state.solution.map((row) => row.replace(/[A-Z]/g, " "));
    expect(checkCrossword(state, blank, 5)).toMatchObject({ solved: false, score: 0 });
    const lower = state.solution.map((row) => row.toLowerCase().replace(/\./g, "."));
    expect(checkCrossword(state, lower, 5).solved).toBe(true);
    const oneWrong = state.solution.map((row, index) => (index === state.solution.findIndex((r) => /[A-Z]/.test(r)) ? row.replace(/[A-Z]/, "#") : row));
    expect(checkCrossword(state, oneWrong, 5).solved).toBe(false);
    expect(checkCrossword(state, ["x"], 5).detail).toBe("Resposta inválida");
  });

  it("ajudas descontam pontos, a conferência marca só as letras erradas e o tempo total vence", () => {
    const generated = generateCrossword(3, entries)!;
    const state = full(generated, "dificil", 300);
    const helped = { ...state, checks: 1, peeks: 2 };
    expect(checkCrossword(helped, state.solution, 5).score).toBe(1000 - CHECK_PENALTY - 2 * PEEK_PENALTY);
    expect(checkCrossword(helped, state.solution, 5).detail).toContain("3 ajudas");
    const first = state.solution.findIndex((row) => /[A-Z]/.test(row));
    const col = state.solution[first].search(/[A-Z]/);
    const wrongRows = state.solution.map((row, index) => (index === first ? row.slice(0, col) + (row[col] === "Z" ? "Y" : "Z") + row.slice(col + 1) : row));
    expect(wrongCells(state, wrongRows)).toEqual([[first, col]]);
    expect(wrongCells(state, state.solution.map((row) => row.replace(/[A-Z]/g, " ")))).toEqual([]);
    expect(letterAt(state, first, col)).toBe(state.solution[first][col]);
    expect(letterAt(state, 0, 999)).toBeNull();
    const late = checkCrossword(state, state.solution, 400);
    expect(late).toMatchObject({ solved: false });
    expect(late.detail).toContain("Tempo esgotado");
    expect(late.score).toBe(700);
    expect(Array.isArray(late.reveal)).toBe(true);
  });
});
