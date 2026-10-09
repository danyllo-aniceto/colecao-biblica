import { describe, expect, it } from "vitest";
import { ANAGRAM_ATTEMPTS, anagramMatches, anagramOutcome, generateAnagram, newAnagram, pickRounds, playAnagram, publicRound, roundPoints, TIME_GRACE, type AnagramState } from "./anagram";
import { plainText, rng } from "./common";
import { maskHint } from "./hangman";
import { BOOKS, bookTestament } from "./books";
import { cluesOf, newWhoAmI, pickWhoAmIRounds, playWhoAmI, publicWhoAmI, whoAmIOutcome, whoAmITurnPoints, WHOAMI_LEVELS, type Person } from "./whoami";
import { TIME_GRACE } from "./turns";

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
});

describe("anagrama", () => {
  it("embaralha as letras (sem acento) sem deixar o nome pronto", () => {
    const letters = generateAnagram(4, "Moisés");
    expect([...letters].sort().join("")).toBe("EIMOSS");
    expect(letters.join("")).not.toBe("MOISES");
    expect(generateAnagram(4, "Moisés")).toEqual(letters);
  });

  it("aceita o nome com ou sem acento", () => {
    const state = { word: "Moisés" };
    expect(anagramMatches(state, "moises")).toBe(true);
    expect(anagramMatches(state, "Moises ")).toBe(true);
    expect(anagramMatches(state, "Miosés ")).toBe(false);
  });

  const SOURCES = ["Moisés", "Abraão", "Salomão", "Débora", "Gideão", "Samuel", "Rute", "Ester", "Daniel", "Elias", "Jerusalém", "Nazaré", "Betsabá", "Naamã"].map((name) => ({ name, summary: `<p>${name} foi importante.</p>`, imageUrl: null }));
  const start = (rounds: number, timePerRound: number | null = null, difficulty: "facil" | "medio" | "dificil" = "medio", now = 0): AnagramState =>
    newAnagram(1, pickRounds(rng(1), SOURCES, difficulty, rounds, []), difficulty, timePerRound, now);

  it("a dificuldade escolhe o tamanho dos nomes; os recentes ficam por último; a dica vem sem HTML nem o nome", () => {
    const lengths = (difficulty: "facil" | "medio" | "dificil") => pickRounds(rng(3), SOURCES, difficulty, 10, []).map((round) => round.word.normalize("NFD").replace(/[^A-Za-z]/g, "").length);
    expect(lengths("facil").every((length) => length >= 4 && length <= 6)).toBe(true);
    expect(lengths("dificil").every((length) => length >= 7)).toBe(true);
    const first = pickRounds(rng(4), SOURCES, "medio", 3, []).map((round) => round.word);
    const second = pickRounds(rng(5), SOURCES, "medio", 3, first).map((round) => round.word);
    expect(second.filter((word) => first.includes(word))).toHaveLength(0);
    const [round] = pickRounds(rng(6), SOURCES, "medio", 1, []);
    expect(round.hint).not.toContain("<");
    expect(round.hint).not.toContain(round.word);
  });

  it("o turno que a tela recebe nunca traz o nome e esconde o retrato no difícil", () => {
    const state = start(3);
    const puzzle = publicRound(state);
    expect(JSON.stringify(puzzle)).not.toContain(state.rounds[0].word);
    expect(puzzle).toMatchObject({ round: 0, rounds: 3, attempts: ANAGRAM_ATTEMPTS, timePerRound: null, maxScore: 800 });
    const withImage = { ...state, rounds: state.rounds.map((round) => ({ ...round, imageUrl: "x.png" })) };
    expect(publicRound(withImage).imageUrl).toBe("x.png");
    expect(publicRound({ ...withImage, difficulty: "dificil" }).imageUrl).toBeNull();
  });

  it("joga os turnos: palpite errado gasta tentativa, acertar avança, pular e esgotar as tentativas zeram o turno", () => {
    let state = start(3);
    const words = state.rounds.map((round) => round.word);
    let played = playAnagram(state, { type: "check", word: "zzzzzz" }, 1000);
    expect(played.event).toEqual({ kind: "wrong", attemptsLeft: 2 });
    state = played.state;
    played = playAnagram(state, { type: "check", word: words[0].toLowerCase() }, 5000);
    expect(played.event).toMatchObject({ kind: "end", end: { right: true, answer: words[0] }, next: { round: 1 } });
    expect(played.state.results[0]).toMatchObject({ solved: true, attempts: 2 });
    state = played.state;
    played = playAnagram(state, { type: "skip" }, 6000);
    expect(played.event).toMatchObject({ kind: "end", end: { right: false, points: 0 } });
    state = played.state;
    for (let attempt = 0; attempt < ANAGRAM_ATTEMPTS - 1; attempt += 1) state = playAnagram(state, { type: "check", word: "zzzzzz" }, 7000).state;
    played = playAnagram(state, { type: "check", word: "zzzzzz" }, 7000);
    expect(played).toMatchObject({ done: true, event: { kind: "end", end: { right: false }, next: null } });
    expect(() => playAnagram(played.state, { type: "skip" }, 8000)).toThrow("terminou");
    const outcome = anagramOutcome(played.state);
    expect(outcome).toMatchObject({ solved: false, detail: "1 de 3 nomes · Médio" });
  });

  it("com tempo por nome: vence depois do limite mais a folga e o relógio só corre depois de 'begin'", () => {
    let state = start(2, 30, "medio", 0);
    expect(() => playAnagram(state, { type: "timeout" }, 5000)).toThrow("tempo");
    const late = playAnagram(state, { type: "check", word: state.rounds[0].word }, (30 + TIME_GRACE + 1) * 1000);
    expect(late.event).toMatchObject({ kind: "end", end: { right: false, timedOut: true } });
    // Entre um nome e outro o relógio fica parado até a tela avisar que começou.
    state = late.state;
    expect(state.roundStartedAt).toBeNull();
    const began = playAnagram(state, { type: "begin" }, 100_000);
    expect(began.state.roundStartedAt).toBe(100_000);
    expect(playAnagram(began.state, { type: "begin" }, 120_000).state.roundStartedAt).toBe(100_000);
    const ok = playAnagram(began.state, { type: "check", word: state.rounds[1].word }, 110_000);
    expect(ok.event).toMatchObject({ kind: "end", end: { right: true } });
    const timeout = playAnagram(began.state, { type: "timeout" }, 100_000 + 28_000);
    expect(timeout.event).toMatchObject({ kind: "end", end: { timedOut: true } });
  });

  it("pontos: cada turno vale uma fatia de 1.000; menos tentativas e mais rapidez valem mais; sem tempo vale 85%; fácil vale 60%", () => {
    expect(roundPoints(5, 1, 1, 6, true)).toBe(200);
    expect(roundPoints(5, 2, 1, 6, true)).toBe(Math.round(200 * (0.7 * 0.6 + 0.3)));
    expect(roundPoints(5, 1, 1, 6, false)).toBe(170);
    expect(roundPoints(5, 1, 18 + 36, 6, true)).toBe(140);
    let state = start(2, null, "facil");
    for (const round of state.rounds) state = playAnagram(state, { type: "check", word: round.word }, 1000).state;
    expect(anagramOutcome(state)).toMatchObject({ solved: true, score: Math.round(2 * roundPoints(2, 1, 1, 5, false) * 0.6) });
  });
});

describe("texto do painel", () => {
  it("tira tags e entidades das dicas", () => {
    expect(plainText("<p>Davi foi rei.</p><p>Tocava harpa &amp; cantava&nbsp;salmos.<br/>Fim</p>")).toBe("Davi foi rei. Tocava harpa & cantava salmos. Fim");
    expect(maskHint("<p>Moisés guiou o povo.</p>", "Moisés")).toBe("___ guiou o povo.");
  });
});

describe("quem sou eu?", () => {
  const person = (name: string): Person => ({ name, testament: "OLD", historicalPeriod: "Por volta de 1000 a.C.", bibleBooks: "1 Samuel, Salmos", narrativeRole: `${name} foi rei`, keywords: "pastor, harpa", importantEvents: "Venceu o gigante", curiosities: null, shortSummary: `<p>${name} derrotou Golias.</p>`, imageUrl: `${name}.png` });
  const people = ["Davi", "Saul", "Samuel", "Salomão", "Jonas", "Ester", "Rute", "Noé"].map((name, index) => ({ ...person(name), testament: index < 6 ? "OLD" : "NEW" }));

  it("monta dicas da mais vaga à mais clara, sem o nome", () => {
    const clues = cluesOf(people[0]);
    expect(clues[0]).toBe("Vive no Antigo Testamento.");
    expect(clues.length).toBeLessThanOrEqual(5);
    expect(clues.at(-1)).toBe("___ derrotou Golias.");
    expect(clues.join(" ")).not.toMatch(/davi/i);
  });

  it("o nível define as opções e a abertura; a tela não recebe o gabarito; no difícil os enfeites são do mesmo Testamento", () => {
    for (const level of ["facil", "medio", "dificil"] as const) {
      const rounds = pickWhoAmIRounds(rng(5), people, level, 3, []);
      expect(rounds).toHaveLength(3);
      for (const round of rounds) {
        expect(round.options).toHaveLength(WHOAMI_LEVELS[level].options);
        expect(new Set(round.options).size).toBe(round.options.length);
        expect(round.options[round.answer]).toBe(round.name);
        expect(round.summary).not.toContain("<");
      }
      const state = newWhoAmI(1, rounds, level, null, 0);
      const puzzle = publicWhoAmI(state);
      expect(puzzle.clues).toHaveLength(WHOAMI_LEVELS[level].opening);
      expect(JSON.stringify(puzzle)).not.toContain('"answer"');
      expect(JSON.stringify(puzzle)).not.toContain("png");
    }
    const hard = pickWhoAmIRounds(rng(5), people, "dificil", 1, [])[0];
    const chosen = people.find((person) => person.name === hard.name)!;
    expect(hard.options.filter((name) => people.find((person) => person.name === name)!.testament === chosen.testament).length).toBeGreaterThanOrEqual(5);
  });

  it("dicas extras custam, errar zera o turno, a foto vem no fim e o tempo vence no servidor", () => {
    let state = newWhoAmI(1, pickWhoAmIRounds(rng(2), people, "medio", 2, []), "medio", 30, 0);
    const first = state.rounds[0];
    const hint = playWhoAmI(state, { type: "hint" }, 1000);
    expect(hint.event).toMatchObject({ kind: "hint", shown: 2, clue: first.clues[1] });
    state = hint.state;
    let played = playWhoAmI(state, { type: "answer", choice: first.answer }, 5000);
    expect(played.event).toMatchObject({ kind: "end", end: { right: true, answer: first.name, imageUrl: first.imageUrl, shown: 2 }, next: { round: 1 } });
    expect(played.state.results[0].points).toBe(whoAmITurnPoints(2, 1, 5, true));
    state = played.state;
    expect(publicWhoAmI(state).clues).toHaveLength(1);
    expect(() => playWhoAmI(state, { type: "timeout" }, 6000)).toThrow("tempo");
    played = playWhoAmI(state, { type: "answer", choice: state.rounds[1].answer }, (30 + TIME_GRACE + 1) * 1000 + 5000);
    expect(played.event).toMatchObject({ end: { right: false, timedOut: true, points: 0 } });
    expect(played.done).toBe(true);
    expect(whoAmIOutcome(played.state)).toMatchObject({ solved: true, detail: "1 de 2 personagens · Médio" });
    expect(whoAmITurnPoints(1, 0, 1, true)).toBe(1000);
    expect(whoAmITurnPoints(1, 0, 1, false)).toBe(850);
    expect(whoAmITurnPoints(1, 10, 1, true)).toBe(Math.round(1000 * (0.7 * 0.4 + 0.3)));
  });

  it("todas as dicas acabam e escolher errado perde o turno", () => {
    let state = newWhoAmI(1, pickWhoAmIRounds(rng(2), people, "facil", 1, []), "facil", null, 0);
    const total = state.rounds[0].clues.length;
    for (let shown = state.shown; shown < total; shown += 1) state = playWhoAmI(state, { type: "hint" }, 1000).state;
    expect(() => playWhoAmI(state, { type: "hint" }, 1000)).toThrow("dicas");
    const wrong = (state.rounds[0].answer + 1) % state.rounds[0].options.length;
    expect(playWhoAmI(state, { type: "answer", choice: wrong }, 2000)).toMatchObject({ done: true, event: { end: { right: false, points: 0 } } });
  });
});
