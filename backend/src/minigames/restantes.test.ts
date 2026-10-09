import { describe, expect, it } from "vitest";
import { lettersOnly } from "./common";
import { checkCrossword, generateCrossword, type Entry } from "./crossword";
import { EDGES, NODES, checkChain, generateChain, neighbors, shortestSteps } from "./graph";
import { LINEAGES, checkLineage, generateLineage } from "./lineage";
import { MAP_BOUNDS, PLACES, checkMap, distanceKm, generateMap } from "./places";
import { MIN_GAP, TIMELINE, checkTimeline, generateTimeline } from "./timeline";

describe("linha do tempo", () => {
  it("tem datas únicas e ordenadas por época; a sorteada tem 6 itens separados por pelo menos 40 anos", () => {
    expect(new Set(TIMELINE.map((event) => event.id)).size).toBe(TIMELINE.length);
    expect(TIMELINE.map((event) => event.year)).toEqual([...TIMELINE.map((event) => event.year)].sort((a, b) => a - b));
    for (let seed = 1; seed <= 40; seed += 1) {
      const { puzzle, state } = generateTimeline(seed);
      expect(puzzle.items).toHaveLength(6);
      const years = state.order.map((id) => TIMELINE.find((event) => event.id === id)!.year);
      for (let index = 1; index < years.length; index += 1) expect(years[index] - years[index - 1]).toBeGreaterThanOrEqual(MIN_GAP);
      expect(puzzle.items.map((item) => item.id)).not.toEqual(state.order);
    }
  });

  it("a ordem certa pontua cheio; erros de posição custam mais quanto mais longe; resposta inválida zera", () => {
    const { state } = generateTimeline(3);
    expect(checkTimeline(state, state.order, 5)).toMatchObject({ solved: true, score: 1000 });
    const swapped = [state.order[1], state.order[0], ...state.order.slice(2)];
    const far = [state.order[5], ...state.order.slice(1, 5), state.order[0]];
    const near = checkTimeline(state, swapped, 5);
    expect(near).toMatchObject({ solved: false });
    expect(near.score).toBeGreaterThan(checkTimeline(state, far, 5).score);
    expect(checkTimeline(state, [...state.order].reverse(), 5).score).toBe(0);
    expect(checkTimeline(state, state.order.slice(1), 5).detail).toBe("Resposta inválida");
  });
});

describe("mapa bíblico", () => {
  it("todos os lugares cabem no mapa e a distância confere com valores conhecidos", () => {
    for (const place of PLACES) {
      expect(place.lon, place.name).toBeGreaterThanOrEqual(MAP_BOUNDS.west);
      expect(place.lon, place.name).toBeLessThanOrEqual(MAP_BOUNDS.east);
      expect(place.lat, place.name).toBeGreaterThanOrEqual(MAP_BOUNDS.south);
      expect(place.lat, place.name).toBeLessThanOrEqual(MAP_BOUNDS.north);
    }
    const jerusalem = PLACES.find((place) => place.name === "Jerusalém")!;
    const rome = PLACES.find((place) => place.name === "Roma")!;
    expect(distanceKm(jerusalem, jerusalem)).toBe(0);
    expect(distanceKm(jerusalem, rome)).toBeGreaterThan(2200);
    expect(distanceKm(jerusalem, rome)).toBeLessThan(2400);
  });

  it("cravar os lugares pontua cheio; errar longe zera; lugares muito próximos não saem juntos", () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const { puzzle, state } = generateMap(seed);
      expect(puzzle.places).toHaveLength(5);
      for (const a of state.places) for (const b of state.places) if (a !== b) expect(distanceKm(a, b)).toBeGreaterThanOrEqual(40);
    }
    const { state } = generateMap(2);
    expect(checkMap(state, state.places, 5)).toMatchObject({ solved: true, score: 1000 });
    const nearby = state.places.map((place) => ({ lat: place.lat + 1, lon: place.lon }));
    const close = checkMap(state, nearby, 5);
    expect(close.solved).toBe(true);
    expect(close.score).toBeLessThan(1000);
    expect(checkMap(state, state.places.map(() => ({ lat: 25, lon: 8 })), 5)).toMatchObject({ solved: false });
    expect(checkMap(state, [{ lat: 1, lon: 1 }], 5).detail).toBe("Resposta inválida");
    expect(checkMap(state, state.places.map(() => ({ lat: Number.NaN, lon: 0 })), 5).detail).toBe("Resposta inválida");
  });
});

describe("árvore genealógica", () => {
  it("as linhagens não repetem nomes", () => {
    for (const chain of LINEAGES) expect(new Set(chain).size).toBe(chain.length);
    expect(LINEAGES[1].indexOf("Davi") - LINEAGES[1].indexOf("Jessé")).toBe(1);
  });

  it("5 ligações pai e filho; todas certas pontuam cheio, uma trocada custa", () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const { puzzle, state } = generateLineage(seed);
      expect(puzzle.fathers).toHaveLength(5);
      expect(new Set([...puzzle.fathers, ...puzzle.sons]).size).toBe(10);
      expect(state.pairs).toHaveLength(5);
    }
    const { puzzle, state } = generateLineage(4);
    const right = puzzle.fathers.map((father) => state.pairs.find((pair) => pair.father === father)!.son);
    expect(checkLineage(state, puzzle.fathers, right, 5)).toMatchObject({ solved: true, score: 1000 });
    const wrong = [right[1], right[0], ...right.slice(2)];
    expect(checkLineage(state, puzzle.fathers, wrong, 5)).toMatchObject({ solved: false, score: Math.round((3 / 5) * 700) });
    expect(checkLineage(state, puzzle.fathers, [right[0], right[0], ...right.slice(2)], 5).detail).toBe("Resposta inválida");
  });
});

describe("interconexão", () => {
  it("o grafo é conexo e as relações têm frase nos dois sentidos", () => {
    expect(NODES.length).toBeGreaterThan(30);
    for (const node of NODES) expect(shortestSteps(NODES[0], node), node).not.toBeNull();
    for (const [from, to, forward, backward] of EDGES) {
      expect(forward.length).toBeGreaterThan(2);
      expect(backward.length).toBeGreaterThan(2);
      expect(neighbors(from).some((item) => item.to === to && item.phrase === forward)).toBe(true);
      expect(neighbors(to).some((item) => item.to === from && item.phrase === backward)).toBe(true);
    }
    expect(shortestSteps("Isaías", "Jesus")).toBe(1);
    expect(shortestSteps("Isaías", "Jerusalém")).toBe(2);
  });

  it("sorteia dois nós a 3 ou 4 passos; o caminho mais curto pontua cheio, desvios custam, passos inventados não valem", () => {
    for (let seed = 1; seed <= 20; seed += 1) {
      const { state } = generateChain(seed);
      expect([3, 4]).toContain(state.shortest);
      expect(shortestSteps(state.from, state.to)).toBe(state.shortest);
    }
    const { state } = generateChain(7);
    // Monta um caminho mais curto passo a passo.
    const path = [state.from];
    while (path.at(-1) !== state.to) {
      const here = path.at(-1)!;
      path.push(neighbors(here).find((item) => shortestSteps(item.to, state.to) === shortestSteps(here, state.to)! - 1)!.to);
    }
    expect(checkChain(state, path, 5)).toMatchObject({ solved: true, score: 1000 });
    const first = neighbors(state.from)[0].to;
    const detour = [state.from, first, state.from, ...path.slice(1)];
    expect(checkChain(state, detour, 5).score).toBe(1000 - 300);
    expect(checkChain(state, [state.from, state.to], 5)).toMatchObject({ solved: false, detail: "Passo inválido" });
    expect(checkChain(state, path.slice(0, -1), 5).solved).toBe(false);
  });
});

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

  it("preencher tudo certo pontua cheio; letras erradas ou vazias custam; formato errado zera", () => {
    const { state } = generateCrossword(3, entries)!;
    expect(checkCrossword(state, state.solution, 5)).toMatchObject({ solved: true, score: 1000 });
    const blank = state.solution.map((row) => row.replace(/[A-Z]/g, " "));
    expect(checkCrossword(state, blank, 5)).toMatchObject({ solved: false, score: 0 });
    const lower = state.solution.map((row) => row.toLowerCase().replace(/\./g, "."));
    expect(checkCrossword(state, lower, 5).solved).toBe(true);
    const oneWrong = state.solution.map((row, index) => (index === state.solution.findIndex((r) => /[A-Z]/.test(r)) ? row.replace(/[A-Z]/, "#") : row));
    expect(checkCrossword(state, oneWrong, 5).solved).toBe(false);
    expect(checkCrossword(state, ["x"], 5).detail).toBe("Resposta inválida");
  });
});
