import { describe, expect, it } from "vitest";
import { lettersOnly, rng } from "./common";
import { applyGuess, guessLetter, isLost, isWon, maskHint, pattern, type HangmanState } from "./hangman";
import { checkMaze, generateMaze, shortestPath, type Maze } from "./maze";
import { checkWordSearch, DIFFICULTIES, generateWordSearch, gridSize, HINT_PENALTY, selectionSpells, wordSearchCandidates, type Difficulty, type Found, type GeneratedWordSearch, type WordSearch, type WordSearchState } from "./wordsearch";

const NAMES = ["Moisés", "Abraão", "Davi", "Salomão", "Débora", "Gideão", "Samuel", "Rute", "Ester", "Daniel", "Elias", "Eliseu", "Jonas", "Noé", "Isaías", "Jeremias", "Ezequiel", "Josué", "Jacó", "Isaque", "Gabriel", "Miguel", "Pedro", "Tiago", "Mateus", "Lucas", "Marcos", "Paulo", "Timóteo", "Estêvão", "Barnabé", "Lázaro", "Zaqueu", "Nicodemos"];
const CANDIDATES = wordSearchCandidates({
  characters: NAMES.map((name, index) => ({ name, imageUrl: null, testament: index < 22 ? "OLD" : "NEW" })),
  scenarios: ["Jerusalém", "Belém", "Nazaré", "Egito", "Babilônia", "Jericó", "Canaã", "Sinai", "Cafarnaum", "Damasco", "Éfeso", "Antioquia"].map((name) => ({ name, mapImageUrl: null })),
});

const generate = (seed: number, difficulty: Difficulty = "medio", extra: Parameters<typeof generateWordSearch>[2] = {}): GeneratedWordSearch => {
  const generated = generateWordSearch(seed, CANDIDATES, { difficulty, ...extra });
  if (!generated) throw new Error("sem partida");
  return generated;
};
const stateOf = (generated: GeneratedWordSearch, hinted: string[] = []): WordSearchState => ({ puzzle: generated.puzzle, placements: generated.placements, hinted });

/** Acha no gabarito onde a palavra foi escondida (só para os testes). */
function locate(puzzle: WordSearch, word: string): Found {
  const size = puzzle.size;
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]]) {
        const found: Found = { word, from: [r, c], to: [r + dr * (word.length - 1), c + dc * (word.length - 1)] };
        if (selectionSpells(puzzle, found)) return found;
      }
    }
  }
  throw new Error(`palavra ${word} não achada`);
}

describe("sorteio", () => {
  it("a mesma semente repete a partida", () => {
    const a = rng(5);
    const b = rng(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(rng(6)()).not.toBe(rng(5)());
    expect(lettersOnly("João Batista-1")).toBe("JOAOBATISTA");
  });
});

describe("caça-palavras", () => {
  it("a dificuldade define a quantidade de palavras, o tamanho da grade e as direções", () => {
    for (const difficulty of ["facil", "medio", "dificil"] as const) {
      const config = DIFFICULTIES[difficulty];
      for (let seed = 1; seed <= 25; seed += 1) {
        const { puzzle, placements } = generate(seed, difficulty);
        expect(puzzle.words, `${difficulty} ${seed}`).toHaveLength(config.words);
        expect(puzzle.grid).toHaveLength(puzzle.size);
        expect(puzzle.grid.every((row) => row.length === puzzle.size)).toBe(true);
        expect(puzzle.size).toBeGreaterThanOrEqual(config.minSize);
        expect(puzzle.size).toBeGreaterThanOrEqual(Math.max(...puzzle.words.map((word) => word.length)));
        expect(puzzle.words.every((word) => word.length >= config.minLength && word.length <= config.maxLength)).toBe(true);
        for (const placement of placements) {
          expect(selectionSpells(puzzle, placement)).toBe(true);
          const dr = Math.sign(placement.to[0] - placement.from[0]);
          const dc = Math.sign(placement.to[1] - placement.from[1]);
          expect(config.directions.some(([r, c]) => r === dr && c === dc), `${difficulty} direção`).toBe(true);
        }
      }
    }
    // Quanto mais letras, maior a grade (nunca passa de 14).
    expect(gridSize("facil", ["ABCD", "EFGH"])).toBe(8);
    expect(gridSize("dificil", Array.from({ length: 10 }, () => "ABCDEFGHIJK"))).toBeGreaterThan(12);
    expect(gridSize("dificil", Array.from({ length: 10 }, () => "ABCDEFGHIJK"))).toBeLessThanOrEqual(14);
  });

  it("a mesma semente repete a partida; o fácil só tem palavras da esquerda para a direita e de cima para baixo", () => {
    expect(generate(11)).toEqual(generate(11));
    expect(generate(11)).not.toEqual(generate(12));
    const easy = generate(5, "facil");
    expect(easy.placements.every((placement) => placement.to[0] >= placement.from[0] && placement.to[1] >= placement.from[1])).toBe(true);
  });

  it("o tema filtra as palavras e as das partidas recentes ficam por último", () => {
    const places = generate(2, "facil", { theme: "lugares" });
    const placeLabels = new Set(places.puzzle.clues.map((clue) => clue.kind));
    expect(placeLabels).toEqual(new Set(["place"]));
    expect(places.puzzle.theme).toBe("Lugares da campanha");
    const old = generate(3, "medio", { theme: "antigo" });
    expect(old.puzzle.clues.every((clue) => clue.kind !== "place")).toBe(true);
    const books = generate(4, "medio", { theme: "livros" });
    expect(books.puzzle.clues.every((clue) => clue.kind === "book")).toBe(true);
    // Tema sem palavras suficientes vira mistura.
    expect(generateWordSearch(1, CANDIDATES.filter((candidate) => candidate.kind !== "book" || candidate.word === "GENESIS"), { difficulty: "medio", theme: "livros" })?.puzzle.theme).toBe("Mistura bíblica");

    const first = generate(8).puzzle.words;
    const second = generate(9, "medio", { avoid: first }).puzzle.words;
    expect(second.filter((word) => first.includes(word))).toHaveLength(0);
    // Quando não há palavras novas bastantes, repete só o necessário em vez de falhar.
    const everyWord = CANDIDATES.map((candidate) => candidate.word);
    expect(generateWordSearch(1, CANDIDATES, { difficulty: "medio", avoid: everyWord })?.puzzle.words).toHaveLength(7);
  });

  it("variedade: dez partidas seguidas, evitando as anteriores, repetem pouco mesmo com um catálogo pequeno", () => {
    let avoid: string[] = [];
    const seen = new Map<string, number>();
    for (let game = 0; game < 10; game += 1) {
      const { puzzle } = generate(100 + game, "medio", { avoid });
      for (const word of puzzle.words) seen.set(word, (seen.get(word) ?? 0) + 1);
      avoid = [...avoid, ...puzzle.words].slice(-8 * 7);
    }
    // O catálogo do teste tem pouco mais de 60 palavras para 70 pedidas: no máximo 3 aparições e a maioria só uma.
    expect(Math.max(...seen.values())).toBeLessThanOrEqual(3);
    expect([...seen.values()].filter((times) => times === 1).length).toBeGreaterThan(seen.size / 2);
  });

  it("no difícil a pontuação cheia é 1.000; achar todas rápido soma o bônus e devagar perde 1 ponto por segundo", () => {
    const generated = generate(11, "dificil");
    const found = generated.placements;
    const state = stateOf(generated);
    expect(checkWordSearch(state, found, 20)).toMatchObject({ solved: true, score: 1000 });
    expect(checkWordSearch(state, found, DIFFICULTIES.dificil.par + 50).score).toBe(950);
    expect(checkWordSearch(state, found, 9999).score).toBe(700);
  });

  it("fácil vale 60% e médio 80% da pontuação; cada dica desconta 40 antes do fator", () => {
    const easy = generate(7, "facil");
    expect(checkWordSearch(stateOf(easy), easy.placements, 5).score).toBe(600);
    const medium = generate(7, "medio");
    expect(checkWordSearch(stateOf(medium), medium.placements, 5).score).toBe(800);
    const hinted = checkWordSearch(stateOf(medium, [medium.puzzle.words[0], medium.puzzle.words[1]]), medium.placements, 5);
    expect(hinted.score).toBe(Math.round((1000 - 2 * HINT_PENALTY) * 0.8));
    expect(hinted.detail).toContain("2 dicas");
    // Sem achar nada, dica não gera pontos negativos.
    expect(checkWordSearch(stateOf(medium, [medium.puzzle.words[0]]), [], 5).score).toBe(0);
  });

  it("palavra inventada, seleção que não soletra e repetidas não contam; as que faltaram voltam em reveal", () => {
    const generated = generate(3, "medio");
    const { puzzle } = generated;
    const real = generated.placements[0];
    const fake: Found = { word: "XXXX", from: [0, 0], to: [0, 3] };
    const wrongCells: Found = { ...real, from: [Math.min(real.from[0] + 1, puzzle.size - 1), real.from[1]] };
    const result = checkWordSearch(stateOf(generated), [real, real, fake, wrongCells], 10);
    expect(result.solved).toBe(false);
    expect(result.detail).toContain("1 de 7 palavras");
    expect(result.score).toBe(Math.round(Math.round((1 / 7) * 700) * 0.8));
    const reveal = result.reveal as Found[];
    expect(reveal).toHaveLength(6);
    expect(reveal.map((entry) => entry.word)).not.toContain(real.word);
  });
});

describe("forca", () => {
  const start = (word: string): HangmanState => ({ word, guessed: [], errors: 0 });

  it("revela as letras (com acento), conta erros e ignora repetidas", () => {
    let state = start("Moisés");
    state = applyGuess(state, "E");
    expect(pattern(state)).toEqual([null, null, null, null, "é", null]);
    state = applyGuess(state, "Z");
    state = applyGuess(state, "Z");
    expect(state.errors).toBe(1);
    expect(guessLetter("é")).toBe("E");
    expect(guessLetter("12")).toBeNull();
    for (const letter of "MOIS") state = applyGuess(state, letter);
    expect(isWon(state)).toBe(true);
  });

  it("espaços aparecem de graça; 6 erros perdem e não pontuam", () => {
    const state = applyGuess(start("Davi Rei"), "D");
    expect(pattern(state)[4]).toBe(" ");
    let lost = start("Noé");
    for (const letter of "QWXZKY") lost = applyGuess(lost, letter);
    expect(isLost(lost)).toBe(true);
    expect(applyGuess(lost, "N")).toBe(lost);
  });

  it("a dica não entrega o nome", () => {
    expect(maskHint("Moisés tirou o povo do Egito. Davi não.", "Moisés")).toBe("___ tirou o povo do Egito. Davi não.");
    expect(maskHint("O rei Davi Rei venceu.", "Davi Rei")).not.toMatch(/davi/i);
  });
});

describe("labirinto", () => {
  const maze = generateMaze(21);

  /** Caminho mais curto por busca, só para montar a resposta certa. */
  function solution(m: Maze): string {
    const goal = m.width * m.height - 1;
    const previous = new Map<number, [number, string]>();
    const queue = [0];
    const seen = new Set([0]);
    const dirs: Array<[string, number, number, number]> = [["U", -1, 0, 1], ["R", 0, 1, 2], ["D", 1, 0, 4], ["L", 0, -1, 8]];
    for (let head = 0; head < queue.length; head += 1) {
      const at = queue[head];
      for (const [name, dr, dc, bit] of dirs) {
        if (!(m.cells[at] & bit)) continue;
        const next = (Math.floor(at / m.width) + dr) * m.width + ((at % m.width) + dc);
        if (seen.has(next)) continue;
        seen.add(next);
        previous.set(next, [at, name]);
        queue.push(next);
      }
    }
    let path = "";
    for (let at = goal; at !== 0; ) {
      const [from, name] = previous.get(at)!;
      path = name + path;
      at = from;
    }
    return path;
  }

  it("é determinista, tem caminho e as paredes são simétricas", () => {
    expect(generateMaze(21)).toEqual(maze);
    expect(generateMaze(22).cells).not.toEqual(maze.cells);
    for (let at = 0; at < maze.cells.length; at += 1) {
      const col = at % maze.width;
      if (maze.cells[at] & 2) expect(maze.cells[at + 1] & 8).toBeTruthy();
      if (col === maze.width - 1) expect(maze.cells[at] & 2).toBe(0);
      if (maze.cells[at] & 4) expect(maze.cells[at + maze.width] & 1).toBeTruthy();
    }
    expect(shortestPath(maze)).toBe(solution(maze).length);
  });

  it("chegar à saída pelo caminho curto pontua cheio; voltas custam; parede e saída longe não valem", () => {
    const best = solution(maze);
    expect(checkMaze(maze, best, 5)).toMatchObject({ solved: true, score: 1000 });
    const first = best[0];
    const opposite = { U: "D", D: "U", L: "R", R: "L" }[first]!;
    expect(checkMaze(maze, first + opposite + best, 5).score).toBe(1000 - 8);
    expect(checkMaze(maze, best.slice(0, -1), 5).solved).toBe(false);
    expect(checkMaze(maze, "X", 5).solved).toBe(false);
    // Uma parede: tenta sempre sair pelo lado esquerdo da entrada (fora da grade, sempre fechado).
    expect(checkMaze(maze, "L", 5).detail).toBe("Atravessou uma parede");
  });
});
