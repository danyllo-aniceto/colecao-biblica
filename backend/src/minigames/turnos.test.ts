import { describe, expect, it } from "vitest";
import { rng } from "./common";
import { BOOK_LEVELS, BOOKS, bookIndex, bookOrderOutcome, bookTurnPoints, newBookOrder, playBookOrder, publicBookOrder } from "./books";
import { HANGMAN_LEVELS, hangmanGameOutcome, hangmanTurnPoints, newHangman, pickHangmanRounds, playHangman, publicHangman, type HangmanSource } from "./hangman";
import { newTestament, pickTestamentItems, playTestament, publicTestament, testamentOutcome, testamentPoints } from "./testament";
import { LEVEL_SCALE, safeWords, TIME_GRACE } from "./turns";
import { newWhoAmI, pickWhoAmIRounds } from "./whoami";

describe("forca em turnos", () => {
  const sources: HangmanSource[] = ["Noé", "Davi", "Rute", "Ester", "Moisés", "Samuel", "Salomão", "Jerusalém", "Nazaré", "Abraão", "Zacarias", "Betsabá", "Habacuque", "Nabucodonosor"].map((name) => ({ name, summary: `<p>${name} foi importante.</p>`, testament: "OLD", imageUrl: null }));
  const game = (rounds: number, time: number | null = null, level: "facil" | "medio" | "dificil" = "medio", now = 0) => newHangman(1, pickHangmanRounds(rng(1), sources, level, rounds, []), level, time, now);
  const letters = (word: string) => [...new Set(word.normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase())];

  it("a dificuldade define o tamanho das palavras e as vidas; a dica vem sem HTML nem o nome", () => {
    for (const level of ["facil", "medio", "dificil"] as const) {
      const config = HANGMAN_LEVELS[level];
      const rounds = pickHangmanRounds(rng(3), sources, level, 5, []);
      expect(rounds.length).toBeGreaterThan(0);
      for (const round of rounds) {
        const length = round.word.normalize("NFD").replace(/[^A-Za-z]/g, "").length;
        expect(length).toBeGreaterThanOrEqual(config.minLength);
        expect(length).toBeLessThanOrEqual(config.maxLength);
        expect(round.hint).not.toContain("<");
        expect(round.hint).not.toContain(round.word);
      }
    }
    expect(publicHangman(game(1, null, "facil")).maxErrors).toBe(8);
    expect(publicHangman(game(1, null, "dificil")).maxErrors).toBe(5);
    const first = pickHangmanRounds(rng(4), sources, "medio", 2, []).map((round) => round.word);
    expect(pickHangmanRounds(rng(5), sources, "medio", 2, first).map((round) => round.word).filter((word) => first.includes(word))).toHaveLength(0);
  });

  it("a tela nunca recebe a palavra; o retrato só vem fora do difícil", () => {
    const state = game(2);
    expect(JSON.stringify(publicHangman(state))).not.toContain(state.rounds[0].word);
    const withImage = { ...state, rounds: state.rounds.map((round) => ({ ...round, imageUrl: "x.png" })) };
    expect(publicHangman(withImage).imageUrl).toBe("x.png");
    expect(publicHangman({ ...withImage, level: "dificil" }).imageUrl).toBeNull();
  });

  it("palpite certo/errado, dica de letra, vitória e derrota avançam os turnos", () => {
    let state = game(2);
    const [first, second] = state.rounds;
    const wrong = [..."QWXZKYJVB"].find((letter) => !letters(first.word).includes(letter))!;
    let played = playHangman(state, { type: "guess", letter: wrong }, 1000);
    expect(played.event).toMatchObject({ kind: "guess", hit: false, errors: 1 });
    expect(() => playHangman(played.state, { type: "guess", letter: wrong }, 1000)).toThrow("já foi");
    const revealed = playHangman(played.state, { type: "reveal" }, 1000);
    expect(revealed.event).toMatchObject({ kind: "reveal", hintsLeft: HANGMAN_LEVELS.medio.hints - 1 });
    state = revealed.state;
    for (const letter of letters(first.word)) {
      if (state.guessed.includes(letter)) continue;
      played = playHangman(state, { type: "guess", letter }, 5000);
      state = played.state;
    }
    expect(played.event).toMatchObject({ kind: "end", end: { right: true, answer: first.word }, next: { round: 1 } });
    expect(state.results[0].solved).toBe(true);
    // Segundo turno: errar todas as vidas.
    const misses = [..."QWXZKYJVBPFGHU"].filter((letter) => !letters(second.word).includes(letter)).slice(0, state.lives);
    for (const letter of misses) played = playHangman(state, { type: "guess", letter }, 6000), (state = played.state);
    expect(played).toMatchObject({ done: true, event: { kind: "end", end: { right: false, answer: second.word }, next: null } });
    expect(hangmanGameOutcome(state)).toMatchObject({ solved: true, detail: "1 de 2 palavras · Médio" });
  });

  it("dicas acabam; tempo vence no servidor e o relógio só corre depois de begin", () => {
    let state = game(2, 30, "dificil", 0);
    state = playHangman(state, { type: "reveal" }, 100).state;
    expect(() => playHangman(state, { type: "reveal" }, 100)).toThrow("dicas");
    expect(() => playHangman(state, { type: "timeout" }, 5000)).toThrow("tempo");
    const late = playHangman(state, { type: "guess", letter: "A" }, (30 + TIME_GRACE + 1) * 1000);
    expect(late.event).toMatchObject({ kind: "end", end: { right: false, timedOut: true } });
    expect(late.state.clock.roundStartedAt).toBeNull();
    const began = playHangman(late.state, { type: "begin" }, 100_000);
    expect(began.state.clock.roundStartedAt).toBe(100_000);
  });

  it("pontos: vidas que sobram, rapidez e dicas; sem tempo vale 85%", () => {
    expect(hangmanTurnPoints(1, 6, 0, 0, 1, 5, true)).toBe(1000);
    expect(hangmanTurnPoints(1, 6, 3, 0, 1, 5, true)).toBe(Math.round(1000 * (0.7 * 0.5 + 0.3)));
    expect(hangmanTurnPoints(1, 6, 0, 1, 1, 5, true)).toBe(850);
    expect(hangmanTurnPoints(1, 6, 0, 0, 1, 5, false)).toBe(850);
    expect(hangmanTurnPoints(1, 6, 0, 0, 999, 5, true)).toBe(700);
  });
});

describe("livros em ordem em turnos", () => {
  it("o nível define o tamanho do conjunto e a dica de Testamento; fácil é espalhado e difícil é próximo", () => {
    for (const level of ["facil", "medio", "dificil"] as const) {
      const state = newBookOrder(2, level, 3, null, 0);
      expect(state.sets).toHaveLength(3);
      for (const set of state.sets) {
        expect(set).toHaveLength(BOOK_LEVELS[level].size);
        expect(set.map(bookIndex)).toEqual([...set.map(bookIndex)].sort((a, b) => a - b));
        if (level === "dificil") expect(Math.max(...set.map(bookIndex)) - Math.min(...set.map(bookIndex))).toBeLessThan(20);
        if (level === "facil") expect(Math.max(...set.map(bookIndex)) - Math.min(...set.map(bookIndex))).toBeGreaterThan(15);
      }
      const puzzle = publicBookOrder(state);
      expect(puzzle.books.map((book) => book.name).sort()).toEqual([...state.sets[0]].sort());
      expect(puzzle.books.map((book) => book.name)).not.toEqual(state.sets[0]);
      expect(puzzle.books.every((book) => (book.testament !== null) === (level === "facil"))).toBe(true);
    }
  });

  it("ordem certa pontua cheio; posições certas dão parcial; ordem inválida é recusada; pular ou esgotar o tempo zera", () => {
    let state = newBookOrder(5, "medio", 3, null, 0);
    const [a, b] = state.sets;
    expect(() => playBookOrder(state, { type: "order", order: a.slice(1) }, 1)).toThrow("inválida");
    expect(() => playBookOrder(state, { type: "order", order: [a[0], a[0], ...a.slice(2)] }, 1)).toThrow("inválida");
    let played = playBookOrder(state, { type: "order", order: a }, 1000);
    expect(played.event).toMatchObject({ kind: "end", end: { solved: true, right: 6, correct: a }, next: { round: 1 } });
    expect(played.state.results[0].points).toBe(bookTurnPoints(3, 6, 6, 1, false));
    state = played.state;
    const swapped = [b[1], b[0], ...b.slice(2)];
    played = playBookOrder(state, { type: "order", order: swapped }, 2000);
    expect(played.event).toMatchObject({ end: { solved: false, right: 4 } });
    state = played.state;
    played = playBookOrder(state, { type: "skip" }, 3000);
    expect(played).toMatchObject({ done: true, event: { end: { right: 0, points: 0 } } });
    expect(bookOrderOutcome(played.state)).toMatchObject({ solved: false, detail: "1 de 3 conjuntos na ordem · Médio" });
  });

  it("com tempo: vence com folga e begin liga o relógio", () => {
    const state = newBookOrder(5, "facil", 1, 30, 0);
    expect(() => playBookOrder(state, { type: "timeout" }, 5000)).toThrow("tempo");
    const played = playBookOrder(state, { type: "order", order: state.sets[0] }, (30 + TIME_GRACE + 1) * 1000);
    expect(played.event).toMatchObject({ end: { timedOut: true, points: 0 } });
  });

  it("66 livros e pontos", () => {
    expect(BOOKS).toHaveLength(66);
    expect(bookTurnPoints(1, 6, 6, 1, true)).toBe(1000);
    expect(bookTurnPoints(1, 3, 6, 1, true)).toBe(350);
  });
});

describe("antigo ou novo?", () => {
  const people = ["Davi", "Moisés", "Noé", "Paulo", "Pedro", "Maria", "Elias", "Ester", "Lucas", "Tiago"].map((name, index) => ({ name, testament: index % 2 === 0 ? "OLD" : "NEW", imageUrl: null }));

  it("o nível escolhe os livros (conhecidos, todos, menos conhecidos) e a quantidade", () => {
    const books = (level: "facil" | "medio" | "dificil") => pickTestamentItems(rng(2), people, level, 15, []).filter((item) => item.kind === "book");
    const famous = books("facil");
    const obscure = books("dificil");
    expect(famous.length).toBeGreaterThan(0);
    expect(famous.some((item) => ["Naum", "Obadias", "Filemom"].includes(item.text))).toBe(false);
    expect(obscure.some((item) => ["Mateus", "Salmos", "Gênesis"].includes(item.text))).toBe(false);
    expect(pickTestamentItems(rng(2), people, "medio", 20, [])).toHaveLength(20);
    const items = pickTestamentItems(rng(3), people, "medio", 10, []);
    expect(items.filter((item) => item.kind === "person")).toHaveLength(4);
  });

  it("cada resposta é conferida e já devolve o certo; o tempo por item vence no servidor", () => {
    let state = newTestament(1, pickTestamentItems(rng(4), people, "medio", 10, []), "medio", 8, 0);
    expect(JSON.stringify(publicTestament(state))).not.toContain('"answer"');
    const item = state.items[0];
    const wrong = item.answer === "OLD" ? "NEW" : "OLD";
    let played = playTestament(state, { type: "classify", choice: wrong }, 2000);
    expect(played.event).toMatchObject({ kind: "end", end: { right: false, correct: item.answer, points: 0 }, next: { index: 1 } });
    state = played.state;
    expect(() => playTestament(state, { type: "timeout" }, 3000)).toThrow("tempo");
    played = playTestament(state, { type: "classify", choice: state.items[1].answer }, (8 + TIME_GRACE + 1) * 1000 + 3000);
    expect(played.event).toMatchObject({ end: { right: false, timedOut: true } });
    state = playTestament(played.state, { type: "begin" }, 50_000).state;
    for (let index = 2; index < 10; index += 1) {
      played = playTestament(state, { type: "classify", choice: state.items[index].answer }, 51_000 + index);
      state = played.state;
    }
    expect(played.done).toBe(true);
    expect(testamentOutcome(state)).toMatchObject({ solved: true, detail: "8 de 10 certos · Médio" });
  });

  it("pontos: cada item vale uma fatia; rápido vale mais; sem tempo vale 85%; vitória com 80%", () => {
    expect(testamentPoints(10, 1, true)).toBe(100);
    expect(testamentPoints(10, 1, false)).toBe(85);
    expect(testamentPoints(10, 99, true)).toBe(70);
    let state = newTestament(1, pickTestamentItems(rng(4), people, "facil", 10, []), "facil", null, 0);
    for (const item of state.items) state = playTestament(state, { type: "classify", choice: item.answer }, 1000).state;
    expect(testamentOutcome(state)).toMatchObject({ solved: true, score: Math.round(10 * testamentPoints(10, 1, false) * LEVEL_SCALE.facil) });
  });
});

describe("partidas guardadas em formato antigo", () => {
  it("não derrubam o sorteio da próxima partida", () => {
    const read = (state: ReturnType<typeof newWhoAmI>) => state.rounds.map((round) => round.name);
    // Formato de antes da atualização do Quem sou eu?: sem `rounds`.
    const old = { options: ["Davi", "Saul"], answer: 0, clues: ["a", "b"], shown: 1 };
    expect(() => read(old as never)).toThrow();
    expect(safeWords(read as never, old)).toEqual([]);
    expect(safeWords(read as never, null)).toEqual([]);
    const fresh = newWhoAmI(1, pickWhoAmIRounds(rng(1), [{ name: "Davi", testament: "OLD", historicalPeriod: null, bibleBooks: null, narrativeRole: null, keywords: null, importantEvents: null, curiosities: null, shortSummary: "Rei.", imageUrl: null }], "facil", 1, []), "facil", null, 0);
    expect(safeWords(read as never, fresh)).toEqual(["Davi"]);
  });
});
