import { describe, expect, it } from "vitest";
import { lettersOnly, rng } from "./common";
import { applyGuess, guessLetter, hangmanOutcome, isLost, isWon, maskHint, pattern, type HangmanState } from "./hangman";
import { checkMaze, generateMaze, shortestPath, type Maze } from "./maze";
import { checkMemory, generateMemory } from "./memory";
import { checkSwapPuzzle, generateSwapPuzzle, minimumSwaps } from "./swap-puzzle";
import { checkVerse, generateVerse, usableVerse } from "./verse";
import { checkWordSearch, generateWordSearch, selectionSpells, type Found, type WordSearch } from "./wordsearch";

const NAMES = ["Moisés", "Abraão", "Davi", "Salomão", "Débora", "Gideão", "Samuel", "Rute", "Ester", "Daniel", "Elias", "Eliseu", "Jonas", "Noé"];

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
  it("esconde 6 palavras que existem na grade; achar todas dá a pontuação cheia mais o bônus de tempo", () => {
    const puzzle = generateWordSearch(11, NAMES);
    expect(puzzle.words).toHaveLength(6);
    expect(puzzle.grid).toHaveLength(10);
    expect(puzzle.grid.every((row) => row.length === 10)).toBe(true);
    expect(generateWordSearch(11, NAMES)).toEqual(puzzle);
    const found = puzzle.words.map((word) => locate(puzzle, word));
    const fast = checkWordSearch(puzzle, found, 20);
    expect(fast).toMatchObject({ solved: true, score: 1000 });
    expect(checkWordSearch(puzzle, found, 200).score).toBeLessThan(fast.score);
    expect(checkWordSearch(puzzle, found, 9999).score).toBe(700);
  });

  it("palavra inventada, seleção que não soletra e repetidas não contam", () => {
    const puzzle = generateWordSearch(3, NAMES);
    const [first] = puzzle.words;
    const real = locate(puzzle, first);
    const fake: Found = { word: "XXXX", from: [0, 0], to: [0, 3] };
    const wrongCells: Found = { ...real, from: [Math.min(real.from[0] + 1, 9), real.from[1]] };
    const result = checkWordSearch(puzzle, [real, real, fake, wrongCells], 10);
    expect(result.solved).toBe(false);
    expect(result.detail).toBe(`1 de 6 palavras`);
    expect(result.score).toBe(Math.round((1 / 6) * 700));
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
    expect(hangmanOutcome(lost, 5)).toMatchObject({ solved: false, score: 0 });
  });

  it("vitória pontua mais com menos erros e menos tempo", () => {
    let clean = start("Noé");
    for (const letter of "NOE") clean = applyGuess(clean, letter);
    let sloppy = start("Noé");
    for (const letter of "QWNOE") sloppy = applyGuess(sloppy, letter);
    expect(hangmanOutcome(clean, 10).score).toBeGreaterThan(hangmanOutcome(sloppy, 10).score);
    expect(hangmanOutcome(clean, 10).score).toBeGreaterThan(hangmanOutcome(clean, 120).score);
    expect(hangmanOutcome(clean, 10).score).toBeLessThanOrEqual(1000);
  });

  it("a dica não entrega o nome", () => {
    expect(maskHint("Moisés tirou o povo do Egito. Davi não.", "Moisés")).toBe("___ tirou o povo do Egito. Davi não.");
    expect(maskHint("O rei Davi Rei venceu.", "Davi Rei")).not.toMatch(/davi/i);
  });
});

describe("quebra-cabeça", () => {
  const puzzle = generateSwapPuzzle(9, { imageUrl: null, title: "Teste" });

  it("nunca começa pronto e o mínimo de trocas confere com os ciclos", () => {
    expect(puzzle.order).toHaveLength(9);
    expect(puzzle.order.every((piece, index) => piece === index)).toBe(false);
    expect(minimumSwaps([1, 0, 2, 3])).toBe(1);
    expect(minimumSwaps([1, 2, 0])).toBe(2);
    expect(minimumSwaps([0, 1, 2])).toBe(0);
  });

  /** Resolve trocando cada posição pela peça certa. */
  function solve(order: number[]): Array<[number, number]> {
    const current = [...order];
    const swaps: Array<[number, number]> = [];
    for (let position = 0; position < current.length; position += 1) {
      if (current[position] === position) continue;
      const at = current.indexOf(position);
      [current[position], current[at]] = [current[at], current[position]];
      swaps.push([position, at]);
    }
    return swaps;
  }

  it("resolver no mínimo de trocas dá a pontuação cheia; trocas a mais custam pontos; inválidas zeram", () => {
    const best = solve(puzzle.order);
    expect(best).toHaveLength(minimumSwaps(puzzle.order));
    expect(checkSwapPuzzle(puzzle, best, 10)).toMatchObject({ solved: true, score: 1000 });
    const wasteful: Array<[number, number]> = [[0, 1], [0, 1], ...best];
    expect(checkSwapPuzzle(puzzle, wasteful, 10).score).toBe(1000 - 70);
    expect(checkSwapPuzzle(puzzle, best.slice(0, -1), 10)).toMatchObject({ solved: false, score: 0 });
    expect(checkSwapPuzzle(puzzle, [[0, 0]], 10).solved).toBe(false);
    expect(checkSwapPuzzle(puzzle, [[0, 99]], 10).solved).toBe(false);
  });
});

describe("memória", () => {
  const pairs = Array.from({ length: 10 }, (_, index) => ({ name: `Cenário ${index}`, match: `Livro ${index}:1` }));
  const memory = generateMemory(4, pairs);

  /** Jogada perfeita: vira cada par de uma vez. */
  const perfect = () => {
    const flips: number[] = [];
    const byPair = new Map<number, number[]>();
    memory.cards.forEach((card, index) => byPair.set(card.pair, [...(byPair.get(card.pair) ?? []), index]));
    for (const cards of byPair.values()) flips.push(...cards);
    return flips;
  };

  it("monta 12 cartas, 6 pares, e a partida perfeita (6 tentativas) pontua cheio", () => {
    expect(memory.cards).toHaveLength(12);
    expect(new Set(memory.cards.map((card) => card.pair)).size).toBe(6);
    expect(generateMemory(4, pairs)).toEqual(memory);
    expect(checkMemory(memory, perfect(), 10)).toMatchObject({ solved: true, score: 1000, detail: "6 tentativas" });
  });

  it("tentativas erradas custam pontos; jogada inválida ou incompleta não vale", () => {
    const wrongA = memory.cards.findIndex((card) => card.pair === 0);
    const wrongB = memory.cards.findIndex((card) => card.pair === 1);
    const flips = [wrongA, wrongB, ...perfect()];
    expect(checkMemory(memory, flips, 10).score).toBe(1000 - 50);
    expect(checkMemory(memory, [0, 0], 10).solved).toBe(false);
    expect(checkMemory(memory, [0], 10).solved).toBe(false);
    expect(checkMemory(memory, perfect().slice(0, 10), 10).solved).toBe(false);
    // Virar de novo uma carta que já foi achada é inválido.
    expect(checkMemory(memory, [...perfect(), 0, 1], 10).detail).toBe("Jogadas inválidas");
  });
});

describe("versículo em pedaços", () => {
  const source = { verse: "O Senhor é o meu pastor e nada me faltará", reference: "Salmos 23:1" };

  it("só serve versículo de 6 a 22 palavras", () => {
    expect(usableVerse(source)).toBe(true);
    expect(usableVerse({ verse: "Jesus chorou.", reference: "João 11:35" })).toBe(false);
  });

  it("tocar na ordem certa pontua cheio; erros custam; trocar palavras iguais vale", () => {
    const { puzzle, words } = generateVerse(2, source);
    expect(puzzle.chips).toHaveLength(words.length);
    expect([...puzzle.chips].sort()).toEqual([...words].sort());
    expect(puzzle.chips).not.toEqual(words);
    const used = new Set<number>();
    const taps = words.map((word) => {
      const index = puzzle.chips.findIndex((chip, at) => chip === word && !used.has(at));
      used.add(index);
      return index;
    });
    expect(checkVerse(puzzle, words, taps, 5)).toMatchObject({ solved: true, score: 1000 });
    // Um toque errado no meio conta 1 erro.
    const first = taps[0];
    const wrong = puzzle.chips.findIndex((chip, at) => chip !== words[1] && at !== taps[0] && !taps.slice(0, 1).includes(at));
    expect(checkVerse(puzzle, words, [first, wrong, ...taps.slice(1)], 5).score).toBe(1000 - 60);
    expect(checkVerse(puzzle, words, taps.slice(0, 3), 5).solved).toBe(false);
    expect(checkVerse(puzzle, words, [...taps, taps[0]], 5).solved).toBe(false);
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
