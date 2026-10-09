import { describe, expect, it } from "vitest";
import { ANAGRAM_ATTEMPTS, anagramMatches, anagramOutcome, generateAnagram, newAnagram, pickRounds, playAnagram, publicRound, roundPoints, TIME_GRACE, type AnagramState } from "./anagram";
import { plainText, rng } from "./common";
import { maskHint } from "./hangman";
import { checkBlitz, generateBlitz, type BlitzQuestion } from "./blitz";
import { BOOKS, bookTestament } from "./books";
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
