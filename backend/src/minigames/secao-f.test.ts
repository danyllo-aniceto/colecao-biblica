import { describe, expect, it } from "vitest";
import { lettersOnly, rng } from "./common";
import { CHAIN_LEVELS, chainOutcome, chainPoints, EDGES, neighbors, newChain, NODES, pickChainRounds, playChain, publicChain, shortestPathNodes, shortestSteps } from "./graph";
import { ANCESTOR_LABELS, checkLineage, GENERATION_CHOICES, generateLineage, HINT_PENALTY as LINEAGE_HINT, LINEAGE_LEVELS, LINEAGES, nextHint } from "./lineage";
import { checkMap, distanceKm, generateMap, MAP_LEVELS, PLACES, placeHint } from "./places";
import { TIME_GRACE } from "./turns";

describe("árvore genealógica", () => {
  it("o tamanho define as gerações e os rótulos; o nível define enfeites e ajuda inicial; as respostas são pessoas seguidas da linhagem", () => {
    for (const generations of GENERATION_CHOICES) {
      for (const level of ["facil", "medio", "dificil"] as const) {
        const state = generateLineage(11 + generations, level, generations);
        const { puzzle } = state;
        expect(puzzle.generations).toBe(generations);
        expect(puzzle.slots).toHaveLength(generations - 1);
        expect(state.answers).toHaveLength(generations - 1);
        // O rótulo mais perto da pessoa é "Pai"; o de cima é o mais distante.
        expect(puzzle.slots.at(-1)!.label).toBe("Pai");
        expect(puzzle.slots[0].label).toBe(ANCESTOR_LABELS[generations - 2]);
        // As pessoas são consecutivas numa linhagem, terminando na da base.
        const lineage = LINEAGES.find((item) => item.names.includes(state.reference))!;
        const index = lineage.names.indexOf(state.reference);
        expect(lineage.names.slice(index - (generations - 1), index)).toEqual(state.answers);
        const config = LINEAGE_LEVELS[level];
        expect(puzzle.slots.filter((slot) => slot.name !== null)).toHaveLength(Math.min(config.prefilled, generations - 2));
        expect(state.prefilled).toHaveLength(Math.min(config.prefilled, generations - 2));
        const placedByHand = state.answers.filter((_, slot) => !state.prefilled.includes(slot));
        expect(puzzle.pool).toHaveLength(placedByHand.length + (lineage.names.length - generations >= config.decoys ? config.decoys : lineage.names.length - generations));
        for (const name of placedByHand) expect(puzzle.pool).toContain(name);
        expect(puzzle.source === null).toBe(level === "dificil");
        expect(puzzle.hintsLeft).toBe(config.hints);
      }
    }
    expect(generateLineage(5, "medio", 4)).toEqual(generateLineage(5, "medio", 4));
  });

  it("a tela não recebe as respostas das posições vazias; no difícil os enfeites são os vizinhos da janela", () => {
    const state = generateLineage(3, "dificil", 3);
    expect(JSON.stringify(state.puzzle.slots)).not.toContain(state.answers[0]);
    const lineage = LINEAGES.find((item) => item.names.includes(state.reference))!;
    const start = lineage.names.indexOf(state.answers[0]);
    const decoys = state.puzzle.pool.filter((name) => !state.answers.includes(name));
    for (const decoy of decoys) expect(Math.min(Math.abs(lineage.names.indexOf(decoy) - start), Math.abs(lineage.names.indexOf(decoy) - start - 2))).toBeLessThanOrEqual(decoys.length);
  });

  it("pontos: tudo certo vale o nível; erros custam; dicas descontam; ajuda inicial não conta; tempo esgotado tira a vitória", () => {
    const state = generateLineage(8, "medio", 4, 120);
    expect(checkLineage(state, state.answers, 5)).toMatchObject({ solved: true, score: 800 });
    const oneWrong = state.answers.map((name, index) => (index === 0 ? "Fulano" : name));
    const partial = checkLineage(state, oneWrong, 5);
    expect(partial.solved).toBe(false);
    expect(partial.score).toBe(Math.round(Math.round((2 / 3) * 700) * 0.8));
    expect(checkLineage(state, [null, null, null], 5)).toMatchObject({ solved: false, score: 0 });
    expect(checkLineage(state, ["x"], 5).detail).toBe("Resposta inválida");
    const helped = { ...state, hinted: [0, 1] };
    expect(checkLineage(helped, state.answers, 5).score).toBe(Math.round((1000 - 2 * LINEAGE_HINT) * 0.8));
    expect(checkLineage(helped, state.answers, 5).detail).toContain("2 dicas");
    const late = checkLineage(state, state.answers, 120 + TIME_GRACE + 5);
    expect(late.solved).toBe(false);
    expect(late.detail).toContain("Tempo esgotado");
    // Aceita o nome sem acento.
    expect(checkLineage(state, state.answers.map((name) => lettersOnly(name).toLowerCase()), 5).solved).toBe(true);
    expect((late.reveal as { answers: string[] }).answers).toEqual(state.answers);
    // No fácil, o lugar de graça vale como certo.
    const easy = generateLineage(8, "facil", 4);
    const withBlankPrefilled = easy.answers.map((name, index) => (easy.prefilled.includes(index) ? null : name));
    expect(checkLineage(easy, withBlankPrefilled, 5).solved).toBe(true);
  });

  it("a dica aponta o primeiro lugar ainda errado que não é de graça", () => {
    const state = generateLineage(8, "medio", 4);
    expect(nextHint(state, [null, null, null])).toEqual({ slot: 0, name: state.answers[0] });
    expect(nextHint(state, [state.answers[0], null, null])).toEqual({ slot: 1, name: state.answers[1] });
    expect(nextHint(state, state.answers)).toBeNull();
    expect(nextHint({ ...state, hinted: [0] }, [null, null, null])).toEqual({ slot: 1, name: state.answers[1] });
  });
});

describe("interconexão", () => {
  it("o nível define a distância entre as pontas; as duplas não se repetem", () => {
    for (const level of ["facil", "medio", "dificil"] as const) {
      const config = CHAIN_LEVELS[level];
      const rounds = pickChainRounds(rng(3), level, 5, []);
      expect(rounds.length).toBeGreaterThanOrEqual(3);
      const ends = new Set<string>();
      for (const round of rounds) {
        expect(round.shortest).toBeGreaterThanOrEqual(config.min);
        expect(round.shortest).toBeLessThanOrEqual(config.max);
        expect(shortestSteps(round.from, round.to)).toBe(round.shortest);
        ends.add(round.from);
        ends.add(round.to);
      }
      expect(ends.size).toBe(rounds.length * 2);
    }
    const first = pickChainRounds(rng(4), "medio", 3, []).flatMap((round) => [round.from, round.to]);
    const second = pickChainRounds(rng(5), "medio", 3, first).flatMap((round) => [round.from, round.to]);
    expect(second.filter((node) => first.includes(node)).length).toBeLessThan(second.length);
    expect(NODES.length).toBeGreaterThan(40);
    expect(neighbors("Jesus").length).toBeGreaterThan(5);
  });

  it("o caminho mais curto existe e os passos são relações que existem", () => {
    const path = shortestPathNodes("Isaías", "Salomão")!;
    expect(path[0]).toBe("Isaías");
    expect(path.at(-1)).toBe("Salomão");
    expect(path).toHaveLength(shortestSteps("Isaías", "Salomão")! + 1);
    for (let index = 0; index < path.length - 1; index += 1) expect(neighbors(path[index]).some(({ to }) => to === path[index + 1])).toBe(true);
    expect(EDGES.length).toBeGreaterThan(40);
  });

  it("joga as rodadas: caminho válido pontua, inválido é recusado, pular zera, dica leva ao próximo nó e o tempo vence", () => {
    let state = newChain(1, pickChainRounds(rng(3), "medio", 3, []), "medio", 60, 0);
    expect(publicChain(state)).toMatchObject({ round: 0, rounds: 3, hintsLeft: 2 });
    const [first, second] = state.rounds;
    const best = shortestPathNodes(first.from, first.to)!;
    expect(() => playChain(state, { type: "path", path: [first.from, first.to] }, 1000)).toThrow("inválido");
    const hint = playChain(state, { type: "hint" }, 1000);
    expect(hint.event).toMatchObject({ kind: "hint", node: best[1], left: 1 });
    state = hint.state;
    expect(() => playChain(state, { type: "hint", path: ["Fulano"] }, 1000)).toThrow("inválido");
    let played = playChain(state, { type: "path", path: best }, 5000);
    expect(played.event).toMatchObject({ kind: "end", end: { reached: true, steps: best.length - 1, shortest: first.shortest, best }, next: { round: 1 } });
    expect(played.state.results[0].points).toBe(chainPoints(3, best.length - 1, first.shortest, 1, 5, true));
    state = playChain(played.state, { type: "begin" }, 6000).state;
    expect(() => playChain(state, { type: "timeout" }, 7000)).toThrow("tempo");
    played = playChain(state, { type: "skip" }, 8000);
    expect(played.event).toMatchObject({ end: { reached: false, points: 0 } });
    state = played.state;
    const late = playChain(state, { type: "path", path: shortestPathNodes(state.rounds[2].from, state.rounds[2].to)! }, (60 + TIME_GRACE + 1) * 1000 + 8000);
    expect(late).toMatchObject({ done: true, event: { end: { reached: false, timedOut: true } } });
    expect(second.from).toBe(state.rounds[1].from);
    expect(chainOutcome(late.state)).toMatchObject({ solved: false, detail: "1 de 3 ligações feitas · Médio" });
  });

  it("pontos: elos a mais e dicas custam; sem tempo vale 85%", () => {
    expect(chainPoints(1, 3, 3, 0, 1, true)).toBe(1000);
    expect(chainPoints(1, 5, 3, 0, 1, true)).toBeLessThan(chainPoints(1, 3, 3, 0, 1, true));
    expect(chainPoints(1, 3, 3, 2, 1, true)).toBe(Math.round(1000 * (0.7 + 0.3 - 0.4)));
    expect(chainPoints(1, 3, 3, 0, 1, false)).toBe(850);
  });
});

describe("mapa bíblico", () => {
  it("o nível escolhe a região, a quantidade de lugares e a tolerância; só entram lugares da região, longe uns dos outros", () => {
    for (const level of ["facil", "medio", "dificil"] as const) {
      const config = MAP_LEVELS[level];
      for (let seed = 1; seed <= 10; seed += 1) {
        const { puzzle, state } = generateMap(seed, level);
        expect(puzzle).toMatchObject({ region: config.region, maxErrorKm: config.maxErrorKm, bounds: config.bounds, hintsLeft: config.hints });
        expect(state.places.length).toBeGreaterThanOrEqual(Math.min(4, config.places));
        expect(state.places.length).toBeLessThanOrEqual(config.places);
        for (const place of state.places) {
          expect(place.lon).toBeGreaterThanOrEqual(config.bounds.west);
          expect(place.lon).toBeLessThanOrEqual(config.bounds.east);
          expect(place.lat).toBeGreaterThanOrEqual(config.bounds.south);
          expect(place.lat).toBeLessThanOrEqual(config.bounds.north);
        }
        for (let a = 0; a < state.places.length; a += 1) for (let b = a + 1; b < state.places.length; b += 1) expect(distanceKm(state.places[a], state.places[b])).toBeGreaterThanOrEqual(config.maxErrorKm / 6);
      }
    }
    expect(generateMap(3, "dificil").state.places).toHaveLength(10);
    expect(JSON.stringify(generateMap(3, "facil").puzzle)).not.toMatch(/"lat"/);
    expect(generateMap(2, "medio")).toEqual(generateMap(2, "medio"));
    expect(PLACES.length).toBeGreaterThan(20);
  });

  it("lugares das últimas partidas ficam por último", () => {
    const first = generateMap(1, "facil").puzzle.places;
    const second = generateMap(2, "facil", null, first).puzzle.places;
    expect(second.filter((name) => first.includes(name)).length).toBeLessThan(first.length);
  });

  it("pontos: marcar no lugar vale o nível; erro maior que a tolerância zera o lugar; lugar sem marca não pontua; dica desconta; tempo esgotado tira a vitória", () => {
    const { state } = generateMap(4, "medio", 150);
    const exact = state.places.map(({ lat, lon }) => ({ lat, lon }));
    expect(checkMap(state, exact, 5)).toMatchObject({ solved: true, score: 800 });
    const far = state.places.map(({ lat, lon }) => ({ lat: lat + 15, lon }));
    expect(checkMap(state, far, 5)).toMatchObject({ solved: false, score: 0 });
    const missing = exact.map((guess, index) => (index === 0 ? null : guess));
    const partial = checkMap(state, missing, 5);
    expect(partial.score).toBeGreaterThan(0);
    expect(partial.score).toBeLessThan(800);
    expect(checkMap(state, exact.map(() => null), 5)).toMatchObject({ solved: false, score: 0, detail: expect.stringContaining("Nada marcado") });
    expect(checkMap(state, [{ lat: 1, lon: 1 }], 5).detail).toBe("Resposta inválida");
    expect(checkMap(state, [{ lat: 999, lon: 0 }, ...exact.slice(1)], 5).detail).toBe("Resposta inválida");
    expect(checkMap({ ...state, hinted: [0] }, exact, 5).score).toBe(Math.round((1000 - 40) * 0.8));
    const late = checkMap(state, exact, 150 + TIME_GRACE + 5);
    expect(late.solved).toBe(false);
    expect(late.detail).toContain("Tempo esgotado");
    const reveal = checkMap(state, exact, 5).reveal as Array<{ name: string; lat: number; km: number | null }>;
    expect(reveal.map((item) => item.name)).toEqual(state.places.map((place) => place.name));
    expect(reveal.every((item) => item.km === 0)).toBe(true);
    expect((partial.reveal as Array<{ km: number | null }>)[0].km).toBeNull();
  });

  it("a dica é um círculo grande que contém o lugar, sem ter o lugar no centro, e é sempre o mesmo", () => {
    const { state } = generateMap(6, "medio");
    const radius = MAP_LEVELS.medio.maxErrorKm * 1.2;
    state.places.forEach((place, index) => {
      const hint = placeHint(state, index)!;
      expect(hint.radiusKm).toBe(Math.round(radius));
      const off = distanceKm(hint, place);
      expect(off).toBeLessThan(radius * 0.5);
      expect(placeHint(state, index)).toEqual(hint);
    });
    expect(placeHint(state, 99)).toBeNull();
  });
});
