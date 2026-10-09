import { describe, expect, it } from "vitest";
import { rng } from "./common";
import { checkMaze, distancesFrom, generateMaze, hintFrom, HINT_PENALTY, HINT_STEPS, MAZE_LEVELS, movesToGoal, newMazeState, PARTIAL_MAX, replay, shortestPath, STAR_POINTS, STARS, type MazeState, type MazeStyle } from "./maze";
import { eraHints, newTimeline, pickTimelineItems, playTimeline, publicTimeline, TIMELINE, TIMELINE_LEVELS, timelineOutcome, timelinePoints, yearLabel, type ImageLookup } from "./timeline";
import { SIZE_LEVEL_IDS, SIZE_SCALE, TIME_GRACE, type SizeLevel } from "./turns";

describe("labirinto", () => {
  const source = { imageUrl: "mapa.png", title: "Jericó" };
  const state = (seed: number, level: SizeLevel = "facil", timeLimit: number | null = null): MazeState => newMazeState(generateMaze(seed, level, source, timeLimit));

  it("o nível define o tamanho, a névoa e as dicas; entrada e saída são células diferentes e o mapa tem solução", () => {
    for (const level of SIZE_LEVEL_IDS) {
      const config = MAZE_LEVELS[level];
      for (let seed = 1; seed <= 6; seed += 1) {
        const { maze } = state(seed, level);
        expect(maze.cells).toHaveLength(config.width * config.height);
        expect(maze).toMatchObject({ width: config.width, height: config.height, fog: config.fog, hintsLeft: config.hints, level, title: "Jericó", maxScore: Math.round(1000 * SIZE_SCALE[level]) });
        expect(maze.start).not.toBe(maze.goal);
        const distance = distancesFrom(maze, maze.start);
        expect(distance[maze.goal]).toBeGreaterThan(Math.min(config.width, config.height));
        // Todas as células são alcançáveis (labirinto conexo) e as estrelas estão em células distintas.
        expect(distance.every((value) => value >= 0)).toBe(true);
        expect(maze.stars).toHaveLength(STARS);
        expect(new Set(maze.stars).size).toBe(STARS);
        expect(maze.stars.includes(maze.start) || maze.stars.includes(maze.goal)).toBe(false);
        expect(shortestPath(maze)).toBe(distance[maze.goal]);
      }
    }
  });

  it("os mapas variam: 4 estilos, entradas e saídas em lugares diferentes, nada repetido", () => {
    const styles = new Set<MazeStyle>();
    const layouts = new Set<string>();
    const starts = new Set<number>();
    for (let seed = 1; seed <= 40; seed += 1) {
      const { maze } = state(seed, "medio");
      styles.add(maze.style);
      layouts.add(maze.cells.join(","));
      starts.add(maze.start);
    }
    expect(styles.size).toBe(4);
    expect(layouts.size).toBe(40);
    expect(starts.size).toBeGreaterThan(5);
    expect(state(7, "dificil")).toEqual(state(7, "dificil"));
    // "Com atalhos" tem caminhos alternativos: mais passagens do que um labirinto sem ciclos.
    const braided = Array.from({ length: 40 }, (_, seed) => generateMaze(seed + 1, "medio")).find((maze) => maze.style === "atalhos")!;
    const openings = braided.cells.reduce((sum, bits) => sum + [1, 2, 4, 8].filter((bit) => bits & bit).length, 0) / 2;
    expect(openings).toBeGreaterThan(braided.cells.length - 1);
  });

  it("o caminho mais curto leva à saída; atravessar parede ou texto inválido não vale", () => {
    const { maze } = state(3, "medio");
    const best = movesToGoal(maze, maze.start);
    expect(best).toHaveLength(shortestPath(maze));
    const walked = replay(maze, best)!;
    expect(walked.at).toBe(maze.goal);
    expect(replay(maze, "X")).toBeNull();
    expect(replay(maze, "U".repeat(50))).toBeNull();
  });

  it("pontos: caminho mínimo vale o nível; passos a mais custam; estrelas somam; dicas descontam; tempo e desistência valem só o andado", () => {
    const base = state(3, "medio", 240);
    const best = movesToGoal(base.maze, base.maze.start);
    expect(checkMaze(base, best, 5)).toMatchObject({ solved: true, score: Math.round(1000 * 0.8) });
    const withStar = { ...base, maze: { ...base.maze, stars: [replay(base.maze, best)!.at === base.maze.goal ? [...replay(base.maze, best)!.visited][1] : 0] } };
    expect(checkMaze(withStar, best, 5).detail).toContain("1 estrela");
    // Dar uma volta (ir e voltar) custa passos.
    const first = best[0];
    const back = { U: "D", D: "U", L: "R", R: "L" }[first]!;
    const detour = first + back + best;
    expect(checkMaze(base, detour, 5).score).toBeLessThan(checkMaze(base, best, 5).score);
    const helped = { ...base, hints: 2 };
    expect(checkMaze(helped, best, 5).score).toBe(Math.max(0, Math.round((1000 - 2 * HINT_PENALTY) * 0.8)));
    expect(checkMaze(helped, best, 5).detail).toContain("2 dicas");
    const half = checkMaze(base, best.slice(0, Math.floor(best.length / 2)), 5);
    expect(half.solved).toBe(false);
    expect(half.score).toBeGreaterThan(0);
    expect(half.score).toBeLessThanOrEqual(Math.round(PARTIAL_MAX * 0.8));
    expect((half.reveal as { best: string }).best).toBe(best);
    const late = checkMaze(base, best, 240 + TIME_GRACE + 5);
    expect(late).toMatchObject({ solved: false });
    expect(late.detail).toContain("Tempo esgotado");
    expect(checkMaze(base, "XX", 5)).toMatchObject({ solved: false, score: 0, detail: "Jogadas inválidas" });
    expect(STAR_POINTS).toBe(40);
  });

  it("a dica mostra os próximos passos certos a partir de onde o jogador está", () => {
    const base = state(5, "facil");
    const best = movesToGoal(base.maze, base.maze.start);
    expect(hintFrom(base, "")).toBe(best.slice(0, HINT_STEPS));
    // Depois de dois passos certos a dica continua dali.
    expect(hintFrom(base, best.slice(0, 2))).toBe(best.slice(2, 2 + HINT_STEPS));
    expect(hintFrom(base, best)).toBeNull();
    expect(hintFrom(base, "UUUUUUUUUUUUUUUU")).toBeNull();
    expect(rng(1)()).toBeGreaterThan(0);
  });

  it("partidas antigas, sem entrada, saída e nível, ainda são conferidas", () => {
    const fresh = generateMaze(9, "facil");
    const old = { maze: { width: fresh.width, height: fresh.height, cells: fresh.cells }, hints: undefined } as unknown as MazeState;
    expect(checkMaze(old, "", 5)).toMatchObject({ solved: false });
  });
});

describe("linha do tempo", () => {
  const lookup: ImageLookup = (event) => (event.match && event.match.length > 0 ? { imageUrl: `${event.id}.png`, kind: "character" } : { imageUrl: null, kind: "event" });
  const game = (level: "facil" | "medio" | "dificil" = "medio", count = 8, time: number | null = null, seed = 3) => newTimeline(seed, pickTimelineItems(rng(seed), lookup, level, count, []), level, time, 0);
  /** A posição certa de uma carta na linha. */
  const slotOf = (state: ReturnType<typeof game>) => state.placed.filter((id) => state.items.find((item) => item.id === id)!.year < state.items[state.index].year).length;

  it("as datas são distintas, o nível define a distância mínima e a primeira carta já está na linha", () => {
    expect(new Set(TIMELINE.map((event) => event.id)).size).toBe(TIMELINE.length);
    for (const level of ["facil", "medio", "dificil"] as const) {
      const state = game(level, 8);
      expect(state.items).toHaveLength(8);
      expect(state.placed).toEqual([state.items[0].id]);
      expect(state.lives).toBe(TIMELINE_LEVELS[level].lives);
      expect(state.items[0].imageUrl === null || typeof state.items[0].imageUrl === "string").toBe(true);
    }
    const years = game("facil", 8).items.map((item) => item.year).sort((a, b) => a - b);
    for (let index = 1; index < years.length; index += 1) expect(years[index] - years[index - 1]).toBeGreaterThanOrEqual(150);
    // Pedindo mais do que cabe com a distância do nível, a distância encolhe até completar.
    expect(game("facil", 20).items).toHaveLength(20);
    expect(game("medio", 8, null, 3)).toEqual(game("medio", 8, null, 3));
  });

  it("a tela vê a carta da vez sem a data; as já postas mostram a data aproximada", () => {
    const state = game();
    const puzzle = publicTimeline(state);
    expect(puzzle.card.id).toBe(state.items[1].id);
    expect(JSON.stringify(puzzle.card)).not.toContain("year");
    expect(puzzle.placed[0].yearLabel).toMatch(/^cerca de \d+ (a|d)\.C\.$/);
    expect(puzzle).toMatchObject({ index: 1, total: 8, lives: 4, maxLives: 4, hintsLeft: 2, hints: [] });
    expect(yearLabel(-1450)).toBe("1450 a.C.");
    expect(yearLabel(30)).toBe("30 d.C.");
  });

  it("acertar a posição mantém as vidas; errar custa uma vida e a carta vai para o lugar certo; sem vidas a partida acaba", () => {
    let state = game("dificil", 6);
    const lives = state.lives;
    const right = playTimeline(state, { type: "place", slot: slotOf(state) }, 2000);
    expect(right.event).toMatchObject({ kind: "end", end: { right: true }, lives });
    expect(right.state.placed).toHaveLength(2);
    expect(right.state.results[0].points).toBeGreaterThan(0);
    state = right.state;
    // Depois de acertar, a linha continua do mais antigo ao mais recente.
    const years = state.placed.map((id) => state.items.find((item) => item.id === id)!.year);
    expect(years).toEqual([...years].sort((a, b) => a - b));
    // Errando de propósito: coloca no extremo errado.
    const correct = slotOf(state);
    const wrongSlot = correct === 0 ? state.placed.length : 0;
    const wrong = playTimeline(state, { type: "place", slot: wrongSlot }, 3000);
    expect(wrong.event).toMatchObject({ end: { right: false, correctSlot: correct, points: 0 }, lives: lives - 1 });
    const afterWrong = wrong.state.placed.map((id) => wrong.state.items.find((item) => item.id === id)!.year);
    expect(afterWrong).toEqual([...afterWrong].sort((a, b) => a - b));
    expect(() => playTimeline(state, { type: "place", slot: 99 }, 3000)).toThrow("Posição inválida");
    expect(() => playTimeline(state, { type: "place", slot: -1 }, 3000)).toThrow("Posição inválida");
  });

  it("jogando tudo certo vence; errar todas as vidas encerra; desistir encerra", () => {
    let state = game("medio", 6);
    let played = playTimeline(state, { type: "begin" }, 0);
    while (state.index < state.items.length) {
      played = playTimeline(state, { type: "place", slot: slotOf(state) }, 1000);
      state = played.state;
    }
    expect(played.done).toBe(true);
    expect(timelineOutcome(state)).toMatchObject({ solved: true, detail: "5 de 5 cartas certas · 4 vidas · Médio" });
    expect(timelineOutcome(state).score).toBeGreaterThan(0);

    let lost = game("dificil", 12);
    let result = playTimeline(lost, { type: "place", slot: 0 }, 0);
    for (let step = 0; step < 20 && !result.done; step += 1) {
      lost = result.state;
      const correct = slotOf(lost);
      result = playTimeline(lost, { type: "place", slot: correct === 0 ? lost.placed.length : 0 }, 1000);
    }
    expect(result.done).toBe(true);
    expect(result.event).toMatchObject({ kind: "end", gameOver: true, next: null });
    expect(timelineOutcome(result.state).solved).toBe(false);
    expect(() => playTimeline(result.state, { type: "place", slot: 0 }, 2000)).toThrow("terminou");

    const quit = playTimeline(game("facil", 8), { type: "giveup" }, 100);
    expect(quit).toMatchObject({ done: true, event: { gameOver: true } });
    expect(timelineOutcome(quit.state).solved).toBe(false);
  });

  it("dicas dão a época aos poucos e custam pontos; o tempo da carta vence no servidor", () => {
    expect(eraHints(-1450)).toEqual(["Aconteceu antes de Cristo, no 2º milênio a.C.", "Foi no século 15 a.C.", "Entre os anos 1500 e 1400 a.C."]);
    expect(eraHints(30)[0]).toContain("depois de Cristo");
    let state = game("medio", 6, 15);
    const first = playTimeline(state, { type: "hint" }, 1000);
    expect(first.event).toMatchObject({ kind: "hint", hintsLeft: 1 });
    state = playTimeline(first.state, { type: "hint" }, 1000).state;
    expect(() => playTimeline(state, { type: "hint" }, 1000)).toThrow("dicas");
    expect(publicTimeline(state).hints).toHaveLength(2);
    expect(timelinePoints(5, 0, 1, true)).toBeGreaterThan(timelinePoints(5, 2, 1, true));
    expect(() => playTimeline(state, { type: "timeout" }, 2000)).toThrow("tempo");
    const late = playTimeline(state, { type: "place", slot: slotOf(state) }, (15 + TIME_GRACE + 1) * 1000);
    expect(late.event).toMatchObject({ end: { right: false, timedOut: true } });
    expect(late.state.lives).toBe(state.lives - 1);
    expect(late.state.clock.roundStartedAt).toBeNull();
    // As dicas voltam a zero na carta seguinte.
    expect(publicTimeline(late.state).hints).toEqual([]);
  });

  it("pontos: cada carta vale uma fatia; rápido vale mais; sem tempo vale 85%", () => {
    expect(timelinePoints(10, 0, 1, true)).toBe(100);
    expect(timelinePoints(10, 0, 1, false)).toBe(85);
    expect(timelinePoints(10, 1, 1, true)).toBe(80);
  });
});
