import { describe, expect, it } from "vitest";
import { rng } from "./common";
import { blitzOutcome, blitzPoints, newBlitz, pickBlitzItems, playBlitz, publicBlitz, type BlitzQuestion } from "./blitz";
import { newVerse, pickVerseRounds, playVerse, publicVerse, usableVerse, verseOutcome, verseTurnPoints, VERSE_LEVELS, verseWords, type VerseSource } from "./verse";
import { blanksOutcome, blanksTurnPoints, BLANK_LEVELS, newBlanks, pickBlanksRounds, playBlanks, publicBlanks, usableForBlanks, type BlanksSource } from "./verse-blanks";
import { LEVEL_SCALE, TIME_GRACE } from "./turns";

describe("relâmpago em turnos", () => {
  const levels = ["EASY", "MEDIUM", "HARD", "VERY_HARD"] as const;
  const questions: BlitzQuestion[] = Array.from({ length: 40 }, (_, index) => ({ text: `Pergunta ${index}?`, correct: `Certa ${index}`, wrong: [`Errada ${index}a`, `Errada ${index}b`, `Errada ${index}c`], difficulty: levels[index % 4], explanation: index % 2 ? "Porque sim." : null, reference: index % 3 ? "Gn 1:1" : null }));

  it("a dificuldade escolhe as perguntas; metade verdadeira; completa com outras se faltar; recentes por último", () => {
    const easy = pickBlitzItems(rng(1), questions, "facil", 10, []);
    expect(easy).toHaveLength(10);
    expect(easy.filter((item) => item.truth)).toHaveLength(5);
    easy.forEach((item) => expect(item.shown.startsWith("Certa")).toBe(item.truth));
    const idsOf = (items: ReturnType<typeof pickBlitzItems>) => items.map((item) => Number(item.question.replace(/\D/g, "")));
    expect(idsOf(easy).every((id) => id % 4 === 0)).toBe(true);
    expect(idsOf(pickBlitzItems(rng(1), questions, "dificil", 10, [])).every((id) => id % 4 >= 2)).toBe(true);
    // Só 10 perguntas fáceis: pedir 15 completa com as outras.
    expect(pickBlitzItems(rng(1), questions, "facil", 15, [])).toHaveLength(15);
    const recent = pickBlitzItems(rng(2), questions, "medio", 5, []).map((item) => item.question);
    expect(pickBlitzItems(rng(3), questions, "medio", 5, recent).filter((item) => recent.includes(item.question)).length).toBe(0);
  });

  it("cada julgamento é conferido, devolve a explicação; o tempo vence no servidor; vence com 80%", () => {
    let state = newBlitz(1, pickBlitzItems(rng(3), questions, "medio", 10, []), "medio", 12, 0);
    expect(JSON.stringify(publicBlitz(state))).not.toContain("truth");
    const first = state.items[0];
    let played = playBlitz(state, { type: "judge", value: first.truth }, 3000);
    expect(played.event).toMatchObject({ kind: "end", end: { right: true, truth: first.truth, correct: first.correct, explanation: first.explanation }, next: { index: 1 } });
    state = played.state;
    expect(() => playBlitz(state, { type: "timeout" }, 4000)).toThrow("tempo");
    played = playBlitz(state, { type: "judge", value: state.items[1].truth }, (12 + TIME_GRACE + 1) * 1000 + 3000);
    expect(played.event).toMatchObject({ end: { right: false, timedOut: true, points: 0 } });
    state = playBlitz(played.state, { type: "begin" }, 100_000).state;
    for (let index = 2; index < 10; index += 1) {
      played = playBlitz(state, { type: "judge", value: state.items[index].truth }, 101_000 + index);
      state = played.state;
    }
    expect(played.done).toBe(true);
    expect(blitzOutcome(state)).toMatchObject({ solved: true, detail: "9 de 10 certas · Médio" });
    expect(blitzPoints(10, 1, true)).toBe(100);
    expect(blitzPoints(10, 1, false)).toBe(85);
  });
});

describe("versículo em pedaços em turnos", () => {
  const sources: VerseSource[] = [
    { verse: "O Senhor é o meu pastor e nada me faltará", reference: "Salmos 23:1", title: "Vale", imageUrl: null },
    { verse: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito", reference: "João 3:16", title: "Betânia", imageUrl: null },
    { verse: "No princípio criou Deus os céus e a terra", reference: "Gênesis 1:1", title: "Éden", imageUrl: null },
    { verse: "Tudo posso naquele que me fortalece sempre e em todo lugar da terra aqui", reference: "Filipenses 4:13", title: "Roma", imageUrl: null },
    { verse: "Jesus chorou.", reference: "João 11:35", title: "Betânia", imageUrl: null },
  ];
  const tapsFor = (state: ReturnType<typeof newVerse>) => {
    const round = state.rounds[state.current];
    const used = new Set<number>();
    return round.words.map((word) => {
      const index = round.chips.findIndex((chip, at) => chip === word && !used.has(at));
      used.add(index);
      return index;
    });
  };

  it("só serve versículo de 6 a 22 palavras e o nível escolhe o tamanho", () => {
    expect(usableVerse(sources[0])).toBe(true);
    expect(usableVerse(sources[4])).toBe(false);
    for (const level of ["facil", "medio", "dificil"] as const) {
      const config = VERSE_LEVELS[level];
      for (const round of pickVerseRounds(rng(2), sources, level, 3, [])) {
        expect(round.words.length).toBeGreaterThanOrEqual(config.minWords);
        expect(round.words.length).toBeLessThanOrEqual(config.maxWords);
        expect(round.chips).not.toEqual(round.words);
      }
    }
    expect(verseWords(" a  b ")).toEqual(["a", "b"]);
  });

  it("a tela não recebe a ordem; tocar certo avança, errado conta, dica mostra a ficha e completar encerra o turno", () => {
    let state = newVerse(1, pickVerseRounds(rng(3), sources, "medio", 2, []), "medio", null, 0);
    expect(JSON.stringify(publicVerse(state))).not.toContain('"words"');
    const taps = tapsFor(state);
    const round = state.rounds[0];
    const wrong = round.chips.findIndex((chip, at) => chip !== round.words[0] && at !== taps[0]);
    let played = playVerse(state, { type: "tap", index: wrong }, 1000);
    expect(played.event).toMatchObject({ kind: "tap", right: false, errors: 1 });
    state = played.state;
    const hint = playVerse(state, { type: "hint" }, 1000);
    expect(hint.event).toMatchObject({ kind: "hint", index: taps[0], hintsLeft: VERSE_LEVELS.medio.hints - 1 });
    state = hint.state;
    for (const index of taps) {
      played = playVerse(state, { type: "tap", index }, 2000);
      state = played.state;
    }
    expect(played.event).toMatchObject({ kind: "end", end: { right: true, reference: round.reference, errors: 1 }, next: { round: 1 } });
    expect(() => playVerse(state, { type: "tap", index: 999 }, 3000)).toThrow("inválida");
    expect(verseTurnPoints(1, 10, 0, 0, 1, true)).toBe(1000);
    expect(verseTurnPoints(1, 10, 1, 1, 1, true)).toBe(Math.round(1000 * (0.6 * 0.8 + 0.4)));
    played = playVerse(state, { type: "skip" }, 4000);
    expect(played).toMatchObject({ done: true, event: { end: { right: false, points: 0 } } });
    expect(verseOutcome(played.state)).toMatchObject({ solved: true, detail: "1 de 2 versículos · Médio" });
  });

  it("dicas acabam, tempo vence e o relógio fica parado entre os turnos", () => {
    let state = newVerse(1, pickVerseRounds(rng(3), sources, "dificil", 1, []), "dificil", 30, 0);
    state = playVerse(state, { type: "hint" }, 100).state;
    expect(() => playVerse(state, { type: "hint" }, 100)).toThrow("dicas");
    expect(() => playVerse(state, { type: "timeout" }, 5000)).toThrow("tempo");
    const late = playVerse(state, { type: "tap", index: 0 }, (30 + TIME_GRACE + 1) * 1000);
    expect(late.event).toMatchObject({ end: { timedOut: true, right: false } });
    expect(late.state.clock.roundStartedAt).toBeNull();
    expect(LEVEL_SCALE.dificil).toBe(1);
  });
});

describe("complete o versículo em turnos", () => {
  const sources: BlanksSource[] = [
    { verse: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito.", reference: "João 3:16", title: "Betânia", imageUrl: null },
    { verse: "O Senhor é o meu pastor e nada me faltará nunca, ainda que eu ande pelo vale.", reference: "Salmos 23", title: "Vale", imageUrl: null },
    { verse: "Confia no Senhor de todo o teu coração e não te estribes no teu próprio entendimento.", reference: "Provérbios 3:5", title: "Sião", imageUrl: null },
    { verse: "Jesus chorou.", reference: "João 11:35", title: "Betânia", imageUrl: null },
  ];
  const pool = ["Egito", "Faraó", "deserto", "Jordão", "mundo", "cidade", "rainha", "profeta", "montanha", "caminho", "justiça"];

  it("só serve versículo com palavras longas o bastante", () => {
    expect(usableForBlanks(sources[0].verse)).toBe(true);
    expect(usableForBlanks("Jesus chorou.")).toBe(false);
  });

  it("o nível define lacunas e enfeites; o versículo remontado é igual ao original", () => {
    for (const level of ["facil", "medio", "dificil"] as const) {
      const config = BLANK_LEVELS[level];
      const rounds = pickBlanksRounds(rng(6), sources, level, 3, [], pool);
      expect(rounds.length).toBeGreaterThan(0);
      for (const round of rounds) {
        expect(round.answers).toHaveLength(config.blanks);
        expect(round.parts.filter((part) => part.blank !== null)).toHaveLength(config.blanks);
        expect(round.options).toHaveLength(config.blanks + config.decoys);
        for (const answer of round.answers) expect(round.options).toContain(answer);
        const rebuilt = round.parts.map((part) => (part.blank === null ? part.text : `${part.prefix}${round.answers[part.blank]}${part.suffix}`)).join(" ");
        expect(rebuilt).toBe(round.text);
      }
    }
  });

  it("a tela não recebe as respostas; só acertar tudo conta como versículo completo; pontos parciais", () => {
    let state = newBlanks(1, pickBlanksRounds(rng(6), sources, "medio", 2, [], pool), "medio", null, 0);
    expect(JSON.stringify(publicBlanks(state))).not.toContain('"answers"');
    const [a, b] = state.rounds;
    expect(() => playBlanks(state, { type: "fill", fills: ["x"] }, 1000)).toThrow("inválida");
    let played = playBlanks(state, { type: "fill", fills: a.answers.map((word) => word.toLowerCase()) }, 1000);
    expect(played.event).toMatchObject({ kind: "end", end: { solved: true, right: 3, total: 3 }, next: { round: 1 } });
    state = played.state;
    played = playBlanks(state, { type: "fill", fills: [b.answers[0], b.answers[1], "Egito"] }, 2000);
    expect(played.event).toMatchObject({ end: { solved: false, right: 2 } });
    expect(blanksOutcome(played.state)).toMatchObject({ solved: true, detail: "1 de 2 versículos completos · Médio" });
    expect(blanksTurnPoints(1, 3, 3, 1, true)).toBe(1000);
    expect(blanksTurnPoints(1, 2, 3, 1, true)).toBe(Math.round(1000 * 0.7 * (2 / 3)));
  });
});
