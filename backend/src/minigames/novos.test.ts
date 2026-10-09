import { describe, expect, it } from "vitest";
import { ANAGRAM_ATTEMPTS, anagramMatches, anagramOutcome, generateAnagram } from "./anagram";
import { checkBlitz, generateBlitz, type BlitzQuestion } from "./blitz";
import { BOOKS, bookTestament, checkBookOrder, checkTestament, generateBookOrder, generateTestament } from "./books";
import { checkBlanks, generateBlanks, usableForBlanks } from "./verse-blanks";
import { cluesOf, generateWhoAmI, whoAmIOutcome, type Person } from "./whoami";

describe("livros da Bíblia", () => {
  it("são 66, 39 do Antigo e 27 do Novo Testamento", () => {
    expect(BOOKS).toHaveLength(66);
    expect(new Set(BOOKS).size).toBe(66);
    expect(bookTestament("Gênesis")).toBe("OLD");
    expect(bookTestament("Malaquias")).toBe("OLD");
    expect(bookTestament("Mateus")).toBe("NEW");
    expect(bookTestament("Apocalipse")).toBe("NEW");
    expect(bookTestament("Livro Inventado")).toBeNull();
  });

  it("livros em ordem: 6 livros embaralhados; a ordem certa pontua cheio, posições certas pontuam parcial", () => {
    const puzzle = generateBookOrder(8);
    expect(puzzle.books).toHaveLength(6);
    expect(generateBookOrder(8)).toEqual(puzzle);
    const right = [...puzzle.books].sort((a, b) => BOOKS.indexOf(a as never) - BOOKS.indexOf(b as never));
    expect(puzzle.books).not.toEqual(right);
    expect(checkBookOrder(puzzle, right, 5)).toMatchObject({ solved: true, score: 1000 });
    const swapped = [right[1], right[0], ...right.slice(2)];
    expect(checkBookOrder(puzzle, swapped, 5)).toMatchObject({ solved: false, score: Math.round((4 / 6) * 700) });
    expect(checkBookOrder(puzzle, [...right.slice(1)], 5).detail).toBe("Resposta inválida");
    expect(checkBookOrder(puzzle, [right[0], right[0], ...right.slice(2)], 5).detail).toBe("Resposta inválida");
  });

  it("antigo ou novo: 10 itens, errar 1 ainda vence, errar 2 não", () => {
    const { puzzle, items } = generateTestament(3, [{ text: "Davi", answer: "OLD" }, { text: "Paulo", answer: "NEW" }]);
    expect(puzzle.items).toHaveLength(10);
    expect(items.map((item) => item.text)).toEqual(puzzle.items);
    const all = items.map((item) => item.answer);
    expect(checkTestament(items, all, 5)).toMatchObject({ solved: true, score: 1000 });
    const flip = (choice: "OLD" | "NEW") => (choice === "OLD" ? "NEW" : "OLD");
    expect(checkTestament(items, [flip(all[0]), ...all.slice(1)], 5).solved).toBe(true);
    expect(checkTestament(items, [flip(all[0]), flip(all[1]), ...all.slice(2)], 5).solved).toBe(false);
    expect(checkTestament(items, all.slice(1), 5).detail).toBe("Resposta inválida");
  });
});

describe("anagrama", () => {
  it("embaralha as letras (sem acento) sem deixar o nome pronto", () => {
    const letters = generateAnagram(4, "Moisés");
    expect([...letters].sort().join("")).toBe("EIMOSS");
    expect(letters.join("")).not.toBe("MOISES");
    expect(generateAnagram(4, "Moisés")).toEqual(letters);
  });

  it("aceita o nome com ou sem acento e pontua menos a cada tentativa", () => {
    const state = { word: "Moisés", attempts: 1 };
    expect(anagramMatches(state, "moises")).toBe(true);
    expect(anagramMatches(state, "Moises ")).toBe(true);
    expect(anagramMatches(state, "Miosés ")).toBe(false);
    expect(anagramOutcome(state, true, 5).score).toBe(1000);
    expect(anagramOutcome({ ...state, attempts: 3 }, true, 5).score).toBe(600);
    expect(anagramOutcome({ ...state, attempts: ANAGRAM_ATTEMPTS }, false, 5)).toMatchObject({ solved: false, score: 0, detail: "Era Moisés" });
  });
});

describe("quem sou eu?", () => {
  const person = (name: string): Person => ({ name, testament: "OLD", historicalPeriod: "Por volta de 1000 a.C.", bibleBooks: "1 Samuel, Salmos", narrativeRole: `${name} foi rei`, keywords: "pastor, harpa", importantEvents: "Venceu o gigante", curiosities: null, shortSummary: `${name} derrotou Golias.` });
  const people = ["Davi", "Saul", "Samuel", "Salomão", "Jonas"].map(person);

  it("monta dicas da mais vaga à mais clara, sem o nome", () => {
    const clues = cluesOf(people[0]);
    expect(clues[0]).toBe("Vive no Antigo Testamento.");
    expect(clues.length).toBeLessThanOrEqual(5);
    expect(clues.at(-1)).toBe("___ derrotou Golias.");
    expect(clues.join(" ")).not.toMatch(/davi/i);
  });

  it("4 opções, resposta entre elas; menos dicas = mais pontos; errar zera", () => {
    const { state, puzzle } = generateWhoAmI(5, people);
    expect(puzzle.options).toHaveLength(4);
    expect(new Set(puzzle.options).size).toBe(4);
    expect(puzzle.shown).toBe(1);
    expect(puzzle.clue).toBe(state.clues[0]);
    expect(JSON.stringify(puzzle)).not.toContain('"answer"');
    expect(whoAmIOutcome(state, state.answer, 5)).toMatchObject({ solved: true, score: 1000 });
    expect(whoAmIOutcome({ ...state, shown: 3 }, state.answer, 5).score).toBe(1000 - 300);
    expect(whoAmIOutcome({ ...state, shown: 5 }, state.answer, 5).score).toBe(100 + 300);
    const wrong = (state.answer + 1) % 4;
    expect(whoAmIOutcome(state, wrong, 5)).toMatchObject({ solved: false, score: 0 });
  });
});

describe("complete o versículo", () => {
  const source = { verse: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito.", reference: "João 3:16" };

  it("só serve versículo com palavras longas o bastante", () => {
    expect(usableForBlanks(source.verse)).toBe(true);
    expect(usableForBlanks("Jesus chorou.")).toBe(false);
  });

  it("sorteia 3 lacunas separadas, oferece as certas e 3 enfeites; só acertar tudo vence", () => {
    const { state, puzzle } = generateBlanks(6, source, ["Egito", "Faraó", "deserto", "Jordão", "mundo"]);
    expect(state.answers).toHaveLength(3);
    expect(puzzle.parts.filter((part) => part.blank !== null)).toHaveLength(3);
    expect(puzzle.parts.filter((part) => part.blank !== null).map((part) => part.blank)).toEqual([0, 1, 2]);
    expect(puzzle.options).toHaveLength(6);
    for (const answer of state.answers) expect(puzzle.options).toContain(answer);
    const rebuilt = puzzle.parts.map((part) => (part.blank === null ? part.text : `${part.prefix}${state.answers[part.blank]}${part.suffix}`)).join(" ");
    expect(rebuilt).toBe(source.verse);
    expect(checkBlanks(state, state.answers.map((word) => word.toLowerCase()), 5)).toMatchObject({ solved: true, score: 1000 });
    expect(checkBlanks(state, [state.answers[0], state.answers[1], "Egito"], 5)).toMatchObject({ solved: false, score: Math.round((2 / 3) * 700) });
    expect(checkBlanks(state, ["x"], 5).detail).toBe("Resposta inválida");
  });
});

describe("relâmpago", () => {
  const questions: BlitzQuestion[] = Array.from({ length: 14 }, (_, index) => ({ text: `Pergunta ${index}?`, correct: `Certa ${index}`, wrong: [`Errada ${index}a`, `Errada ${index}b`, `Errada ${index}c`] }));

  it("10 afirmações, metade verdadeiras; a conferência é pelo gabarito", () => {
    const { state, puzzle } = generateBlitz(9, questions);
    expect(puzzle.statements).toHaveLength(10);
    expect(state.truths.filter(Boolean)).toHaveLength(5);
    puzzle.statements.forEach((statement, index) => expect(statement.answer.startsWith("Certa")).toBe(state.truths[index]));
    expect(checkBlitz(state, state.truths, 5)).toMatchObject({ solved: true, score: 1000 });
    const two = state.truths.map((value, index) => (index < 2 ? !value : value));
    expect(checkBlitz(state, two, 5).solved).toBe(true);
    const three = state.truths.map((value, index) => (index < 3 ? !value : value));
    expect(checkBlitz(state, three, 5).solved).toBe(false);
    expect(checkBlitz(state, [true], 5).detail).toBe("Resposta inválida");
  });

  it("com poucas perguntas usa as que houver", () => {
    expect(generateBlitz(1, questions.slice(0, 6)).puzzle.statements).toHaveLength(6);
  });
});
