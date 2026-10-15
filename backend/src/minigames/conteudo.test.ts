import { describe, expect, it } from "vitest";
import { ANAGRAM_LEVELS } from "./anagram";
import { FACTS_BANK } from "./content/facts";
import { PEOPLE_BANK } from "./content/people";
import { THINGS_BANK } from "./content/things";
import { VERSES_BANK } from "./content/verses";
import { lettersOnly } from "./common";
import { BLANK_LEVELS, usableForBlanks } from "./verse-blanks";
import { EDGES, NODES, shortestSteps, CHAIN_LEVELS } from "./graph";
import { MAP_LEVELS, PLACES } from "./places";
import { TIMELINE } from "./timeline";
import { LINEAGES } from "./lineage";
import { VERSE_LEVELS, verseWords } from "./verse";
import { HANGMAN_LEVELS } from "./hangman";

const unique = (values: string[]) => new Set(values).size === values.length;

describe("bancos de conteúdo dos mini games", () => {
  it("pessoas, lugares e coisas: sem nome repetido e com dica", () => {
    const names = [...PEOPLE_BANK.map((p) => p.name), ...THINGS_BANK.map((t) => t.name)].map(lettersOnly);
    const repeated = names.filter((name, index) => names.indexOf(name) !== index);
    expect(repeated).toEqual([]);
    for (const person of PEOPLE_BANK) expect(person.summary.length).toBeGreaterThan(15);
    for (const thing of THINGS_BANK) expect(thing.clue.length).toBeGreaterThan(10);
    expect(PEOPLE_BANK.length).toBeGreaterThan(180);
    expect(THINGS_BANK.length).toBeGreaterThan(150);
  });

  it("anagrama e forca têm bastante nome em cada dificuldade", () => {
    const all = [...PEOPLE_BANK.map((p) => p.name), ...THINGS_BANK.map((t) => t.name)].map((name) => lettersOnly(name).length);
    for (const [level, config] of Object.entries(ANAGRAM_LEVELS)) {
      const count = all.filter((length) => length >= config.minLength && length <= config.maxLength).length;
      expect(count, `anagrama ${level}`).toBeGreaterThan(60);
    }
    for (const [level, config] of Object.entries(HANGMAN_LEVELS)) {
      const count = all.filter((length) => length >= config.minLength && length <= config.maxLength).length;
      expect(count, `forca ${level}`).toBeGreaterThan(60);
    }
  });

  it("versículos: referência única e tamanho que cabe nos dois jogos", () => {
    expect(unique(VERSES_BANK.map((v) => v.reference))).toBe(true);
    for (const level of ["facil", "medio", "dificil"] as const) {
      const config = VERSE_LEVELS[level];
      const inPieces = VERSES_BANK.filter((v) => { const n = verseWords(v.verse).length; return n >= config.minWords && n <= config.maxWords; });
      expect(inPieces.length, `pedaços ${level}`).toBeGreaterThan(25);
      const blanks = BLANK_LEVELS[level];
      const inBlanks = VERSES_BANK.filter((v) => { const n = verseWords(v.verse).length; return n >= blanks.minWords && n <= blanks.maxWords && usableForBlanks(v.verse, blanks.blanks); });
      expect(inBlanks.length, `lacunas ${level}`).toBeGreaterThan(25);
    }
  });

  it("perguntas do relâmpago: três erradas diferentes da certa e todos os níveis", () => {
    for (const fact of FACTS_BANK) {
      expect(fact.wrong).toHaveLength(3);
      expect(unique([fact.correct, ...fact.wrong]), fact.text).toBe(true);
    }
    expect(unique(FACTS_BANK.map((f) => f.text))).toBe(true);
    for (const level of ["EASY", "MEDIUM", "HARD"] as const) expect(FACTS_BANK.filter((f) => f.difficulty === level).length).toBeGreaterThan(30);
  });

  it("linha do tempo: ids e anos distintos", () => {
    expect(unique(TIMELINE.map((e) => e.id))).toBe(true);
    expect(unique(TIMELINE.map((e) => String(e.year)))).toBe(true);
    expect(TIMELINE.length).toBeGreaterThan(90);
  });

  it("mapa: nomes distintos e lugares suficientes em cada região", () => {
    expect(unique(PLACES.map((p) => p.name))).toBe(true);
    for (const level of ["facil", "medio", "dificil"] as const) {
      const { bounds, places } = MAP_LEVELS[level];
      const inside = PLACES.filter((p) => p.lon >= bounds.west && p.lon <= bounds.east && p.lat >= bounds.south && p.lat <= bounds.north);
      expect(inside.length, level).toBeGreaterThan(places * 3);
    }
  });

  it("interconexão: sem laço nem relação repetida e com duplas em todas as distâncias", () => {
    const keys = EDGES.map(([a, b]) => [a, b].sort().join("|"));
    expect(keys.filter((key, index) => keys.indexOf(key) !== index)).toEqual([]);
    for (const [a, b] of EDGES) expect(a).not.toBe(b);
    expect(NODES.length).toBeGreaterThan(150);
    for (const level of ["facil", "medio", "dificil"] as const) {
      const { min, max } = CHAIN_LEVELS[level];
      let pairs = 0;
      for (const from of NODES) for (const to of NODES) { const steps = from === to ? null : shortestSteps(from, to); if (steps !== null && steps >= min && steps <= max) pairs += 1; }
      expect(pairs, level).toBeGreaterThan(60);
    }
  });

  it("árvore genealógica: nomes únicos em cada linhagem", () => {
    for (const lineage of LINEAGES) expect(unique(lineage.names), lineage.source).toBe(true);
  });
});
