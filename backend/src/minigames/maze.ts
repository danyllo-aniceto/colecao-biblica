import { ACCURACY_MAX, randInt, rng, shuffled, timeBonus, type Outcome, type Random } from "./common";
import { SIZE_LABEL, SIZE_SCALE, sizeMaxScore, TIME_GRACE, type SizeLevel } from "./turns";

/**
 * Labirinto: o jogador leva o peão da entrada até a bandeira pelo caminho mais curto, podendo pegar estrelas pelo caminho.
 * O nível define o tamanho, a névoa e as ajudas; o mapa muda a cada partida (4 jeitos de escavar, entrada e saída em lugares diferentes).
 */
export const OPEN = { U: 1, R: 2, D: 4, L: 8 } as const;
export type Move = "U" | "R" | "D" | "L";
const STEP: Record<Move, [number, number, number, number]> = { U: [-1, 0, OPEN.U, OPEN.D], R: [0, 1, OPEN.R, OPEN.L], D: [1, 0, OPEN.D, OPEN.U], L: [0, -1, OPEN.L, OPEN.R] };
const MOVES = Object.keys(STEP) as Move[];

export const MAZE_LEVELS: Record<SizeLevel, { width: number; height: number; hints: number; fog: number | null; par: number }> = {
  facil: { width: 8, height: 10, hints: 3, fog: null, par: 60 },
  medio: { width: 11, height: 14, hints: 3, fog: null, par: 120 },
  dificil: { width: 14, height: 18, hints: 2, fog: 5, par: 200 },
  mestre: { width: 18, height: 24, hints: 2, fog: 4, par: 320 },
};
export const TIME_CHOICES = [60, 120, 240, 420, 600] as const;
export const HINT_PENALTY = 40;
export const HINT_STEPS = 5;
export const STAR_POINTS = 40;
export const STARS = 3;
/** Sem chegar à saída (tempo esgotado ou desistência), vale a parte do caminho andada, até isto. */
export const PARTIAL_MAX = 200;

export type MazeStyle = "corredores" | "ramificado" | "trama" | "atalhos";
export const STYLE_LABEL: Record<MazeStyle, string> = { corredores: "Corredores longos", ramificado: "Muitas ramificações", trama: "Trama de becos", atalhos: "Com atalhos" };
const STYLES: MazeStyle[] = ["corredores", "ramificado", "trama", "atalhos"];

export type Maze = {
  width: number;
  height: number;
  cells: number[];
  /** Entrada e saída (índices das células). */
  start: number;
  goal: number;
  stars: number[];
  style: MazeStyle;
  styleLabel: string;
  level: SizeLevel;
  /** Segundos para chegar à saída; null = sem tempo. */
  timeLimit: number | null;
  hintsLeft: number;
  hintPenalty: number;
  starPoints: number;
  /** Raio (em células) que o peão enxerga; null = o mapa todo à vista. */
  fog: number | null;
  par: number;
  maxScore: number;
  /** Imagem do cenário que enfeita o chão do labirinto. */
  imageUrl: string | null;
  title: string;
};
export type MazeState = { maze: Maze; hints: number };

const cellAt = (maze: Pick<Maze, "width">, row: number, col: number) => row * maze.width + col;

/** Escava o labirinto: `corredores` = busca em profundidade; `ramificado` = Prim; `trama` = Kruskal; `atalhos` = Prim/profundidade com paredes derrubadas. */
function carve(random: Random, width: number, height: number, style: MazeStyle): number[] {
  const cells = Array.from({ length: width * height }, () => 0);
  const link = (at: number, move: Move) => {
    const [dr, dc, here, there] = STEP[move];
    const next = (Math.floor(at / width) + dr) * width + ((at % width) + dc);
    cells[at] |= here;
    cells[next] |= there;
    return next;
  };
  const inside = (at: number, move: Move) => {
    const r = Math.floor(at / width) + STEP[move][0];
    const c = (at % width) + STEP[move][1];
    return r >= 0 && r < height && c >= 0 && c < width;
  };
  const algorithm = style === "atalhos" ? (random() < 0.5 ? "corredores" : "ramificado") : style;

  if (algorithm === "corredores") {
    const visited = new Set<number>([0]);
    const stack = [0];
    while (stack.length > 0) {
      const at = stack[stack.length - 1];
      const options = shuffled(random, MOVES).filter((move) => inside(at, move) && !visited.has(at + STEP[move][0] * width + STEP[move][1]));
      if (options.length === 0) {
        stack.pop();
        continue;
      }
      const next = link(at, options[randInt(random, 0, options.length - 1)]);
      visited.add(next);
      stack.push(next);
    }
  } else if (algorithm === "ramificado") {
    const visited = new Set<number>([randInt(random, 0, width * height - 1)]);
    const frontier: Array<[number, Move]> = [];
    const push = (at: number) => MOVES.forEach((move) => inside(at, move) && frontier.push([at, move]));
    push([...visited][0]);
    while (frontier.length > 0) {
      const pick = randInt(random, 0, frontier.length - 1);
      const [at, move] = frontier[pick];
      frontier[pick] = frontier[frontier.length - 1];
      frontier.pop();
      const next = at + STEP[move][0] * width + STEP[move][1];
      if (visited.has(next)) continue;
      link(at, move);
      visited.add(next);
      push(next);
    }
  } else {
    // Kruskal: junta pedaços ao acaso até virar uma árvore só.
    const parent = Array.from({ length: width * height }, (_, index) => index);
    const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])));
    const edges: Array<[number, Move]> = [];
    for (let at = 0; at < width * height; at += 1) {
      if (inside(at, "R")) edges.push([at, "R"]);
      if (inside(at, "D")) edges.push([at, "D"]);
    }
    for (const [at, move] of shuffled(random, edges)) {
      const next = at + STEP[move][0] * width + STEP[move][1];
      if (find(at) === find(next)) continue;
      parent[find(at)] = find(next);
      link(at, move);
    }
  }

  if (style === "atalhos") {
    // Derruba uma parede em cerca de 60% dos becos: surgem caminhos alternativos.
    for (let at = 0; at < cells.length; at += 1) {
      const bits = cells[at];
      if ((bits & (bits - 1)) !== 0 || random() > 0.6) continue;
      const closed = shuffled(random, MOVES).filter((move) => inside(at, move) && !(bits & STEP[move][2]));
      if (closed.length > 0) link(at, closed[0]);
    }
  }
  return cells;
}

/** Distância (em passos) de `from` até cada célula; -1 onde não chega. */
export function distancesFrom(maze: Pick<Maze, "width" | "height" | "cells">, from: number): number[] {
  const distance = Array.from({ length: maze.cells.length }, () => -1);
  distance[from] = 0;
  const queue = [from];
  for (let head = 0; head < queue.length; head += 1) {
    const at = queue[head];
    for (const move of MOVES) {
      const [dr, dc, bit] = STEP[move];
      if (!(maze.cells[at] & bit)) continue;
      const next = at + dr * maze.width + dc;
      if (distance[next] === -1) {
        distance[next] = distance[at] + 1;
        queue.push(next);
      }
    }
  }
  return distance;
}

const farthest = (distance: number[]) => distance.reduce((best, value, index) => (value > distance[best] ? index : best), 0);

export function generateMaze(seed: number, level: SizeLevel = "facil", source: { imageUrl: string | null; title: string } = { imageUrl: null, title: "Labirinto" }, timeLimit: number | null = null): Maze {
  const config = MAZE_LEVELS[level];
  const random = rng(seed);
  const style = STYLES[randInt(random, 0, STYLES.length - 1)];
  const cells = carve(random, config.width, config.height, style);
  const base = { width: config.width, height: config.height, cells };
  // Entrada e saída nas pontas mais distantes do mapa (em lados diferentes a cada partida).
  const first = farthest(distancesFrom(base, randInt(random, 0, cells.length - 1)));
  const second = farthest(distancesFrom(base, first));
  const [start, goal] = random() < 0.5 ? [first, second] : [second, first];
  const fromStart = distancesFrom(base, start);
  const deadEnds = cells.flatMap((bits, index) => ((bits & (bits - 1)) === 0 && index !== start && index !== goal ? [index] : []));
  const pool = deadEnds.length >= STARS ? deadEnds : cells.flatMap((_, index) => (index !== start && index !== goal && fromStart[index] > 3 ? [index] : []));
  const stars = shuffled(random, pool).slice(0, STARS);
  return {
    ...base,
    start,
    goal,
    stars,
    style,
    styleLabel: STYLE_LABEL[style],
    level,
    timeLimit,
    hintsLeft: config.hints,
    hintPenalty: HINT_PENALTY,
    starPoints: STAR_POINTS,
    fog: config.fog,
    par: config.par,
    maxScore: sizeMaxScore(level),
    imageUrl: source.imageUrl,
    title: source.title,
  };
}

export const newMazeState = (maze: Maze): MazeState => ({ maze, hints: 0 });

/** Partidas começadas antes desta versão não têm entrada, saída nem nível: valem como um labirinto fácil de ponta a ponta. */
function normalize(maze: Maze): Maze {
  return { ...maze, start: maze.start ?? 0, goal: maze.goal ?? maze.width * maze.height - 1, stars: maze.stars ?? [], level: maze.level ?? "facil", timeLimit: maze.timeLimit ?? null, par: maze.par ?? MAZE_LEVELS.facil.par, title: maze.title ?? "Labirinto", imageUrl: maze.imageUrl ?? null };
}

/** Menor número de passos da entrada até a saída. */
export function shortestPath(maze: Maze): number {
  const m = normalize(maze);
  return Math.max(0, distancesFrom(m, m.start)[m.goal]);
}

/** Caminho mais curto (letras U/R/D/L) de uma célula até a saída. */
export function movesToGoal(maze: Maze, from: number): string {
  const m = normalize(maze);
  const toGoal = distancesFrom(m, m.goal);
  let at = from;
  let path = "";
  while (at !== m.goal && toGoal[at] > 0) {
    const move = MOVES.find((candidate) => (m.cells[at] & STEP[candidate][2]) && toGoal[at + STEP[candidate][0] * m.width + STEP[candidate][1]] === toGoal[at] - 1);
    if (!move) break;
    path += move;
    at += STEP[move][0] * m.width + STEP[move][1];
  }
  return path;
}

/** Refaz os passos a partir da entrada: onde parou e por quais células passou. Null se atravessou uma parede ou o texto é inválido. */
export function replay(maze: Maze, moves: string): { at: number; visited: Set<number> } | null {
  const m = normalize(maze);
  if (moves.length > 2000 || /[^URDL]/.test(moves)) return null;
  let at = m.start;
  const visited = new Set<number>([at]);
  for (const move of moves as unknown as Move[]) {
    const [dr, dc, bit] = STEP[move];
    if (!(m.cells[at] & bit)) return null;
    at += dr * m.width + dc;
    visited.add(at);
  }
  return { at, visited };
}

/** Os próximos passos certos a partir de onde o jogador está (a dica "mostrar o caminho"). */
export function hintFrom(state: MazeState, moves: string): string | null {
  const walked = replay(state.maze, moves);
  if (!walked) return null;
  const path = movesToGoal(state.maze, walked.at);
  return path === "" ? null : path.slice(0, HINT_STEPS);
}

/**
 * Pontos: chegou à saída no tempo → até 700 (cada passo a mais que o mínimo tira um pouco) + até 300 de rapidez, mais 40 por estrela pega e
 * menos 40 por dica; no máximo 1.000, vezes o fator do nível. Sem chegar: só o caminho andado (até 200).
 */
export function checkMaze(state: MazeState, moves: string, seconds: number): Outcome {
  const maze = normalize(state.maze);
  const walked = replay(maze, moves);
  if (!walked) return { solved: false, score: 0, detail: /[^URDL]/.test(moves) || moves.length > 2000 ? "Jogadas inválidas" : "Atravessou uma parede" };
  const scale = SIZE_SCALE[maze.level];
  const best = shortestPath(maze);
  const toGoal = distancesFrom(maze, maze.goal);
  const late = maze.timeLimit !== null && seconds > maze.timeLimit + TIME_GRACE;
  const reveal = { best: movesToGoal(maze, maze.start), title: maze.title, style: maze.styleLabel };
  if (walked.at !== maze.goal || late) {
    const progress = best === 0 ? 0 : Math.max(0, 1 - toGoal[walked.at] / best);
    return { solved: false, score: Math.round(progress * PARTIAL_MAX * scale), detail: `${late ? "Tempo esgotado · " : ""}${Math.round(progress * 100)}% do caminho`, reveal };
  }
  const stars = maze.stars.filter((star) => walked.visited.has(star)).length;
  const extra = Math.max(0, moves.length - best);
  const accuracy = ACCURACY_MAX * Math.max(0.2, 1 - extra / (best * 2));
  const raw = Math.min(1000, Math.round(accuracy) + timeBonus(seconds, maze.par) + stars * STAR_POINTS - state.hints * HINT_PENALTY);
  const parts = [`${moves.length} passos`, SIZE_LABEL[maze.level]];
  if (stars > 0) parts.push(`${stars} ${stars === 1 ? "estrela" : "estrelas"}`);
  if (state.hints > 0) parts.push(`${state.hints} ${state.hints === 1 ? "dica" : "dicas"}`);
  return { solved: true, score: Math.max(0, Math.round(raw * scale)), detail: parts.join(" · "), reveal };
}
