import { ACCURACY_MAX, randInt, rng, shuffled, timeBonus, type Outcome } from "./common";

/** Labirinto: grade 9 × 11 gerada por busca em profundidade (um único caminho entre quaisquer duas células). */
export const MAZE_WIDTH = 9;
export const MAZE_HEIGHT = 11;

/** Bits de cada célula: quais lados estão abertos. */
export const OPEN = { U: 1, R: 2, D: 4, L: 8 } as const;
const STEP: Record<Move, [number, number, number, number]> = { U: [-1, 0, OPEN.U, OPEN.D], R: [0, 1, OPEN.R, OPEN.L], D: [1, 0, OPEN.D, OPEN.U], L: [0, -1, OPEN.L, OPEN.R] };

export type Move = "U" | "R" | "D" | "L";
export type Maze = { width: number; height: number; cells: number[] };

export function generateMaze(seed: number): Maze {
  const random = rng(seed);
  const width = MAZE_WIDTH;
  const height = MAZE_HEIGHT;
  const cells = Array.from({ length: width * height }, () => 0);
  const visited = new Set<number>([0]);
  const stack = [0];
  while (stack.length > 0) {
    const at = stack[stack.length - 1];
    const row = Math.floor(at / width);
    const col = at % width;
    const options = shuffled(random, Object.keys(STEP) as Move[]).filter((move) => {
      const [dr, dc] = STEP[move];
      const r = row + dr;
      const c = col + dc;
      return r >= 0 && r < height && c >= 0 && c < width && !visited.has(r * width + c);
    });
    if (options.length === 0) {
      stack.pop();
      continue;
    }
    const move = options[randInt(random, 0, options.length - 1)];
    const [dr, dc, here, there] = STEP[move];
    const next = (row + dr) * width + (col + dc);
    cells[at] |= here;
    cells[next] |= there;
    visited.add(next);
    stack.push(next);
  }
  return { width, height, cells };
}

/** Menor número de passos da entrada (canto de cima, à esquerda) até a saída (canto de baixo, à direita). */
export function shortestPath(maze: Maze): number {
  const goal = maze.width * maze.height - 1;
  const distance = new Map<number, number>([[0, 0]]);
  const queue = [0];
  for (let head = 0; head < queue.length; head += 1) {
    const at = queue[head];
    if (at === goal) return distance.get(at)!;
    const row = Math.floor(at / maze.width);
    const col = at % maze.width;
    for (const move of Object.keys(STEP) as Move[]) {
      const [dr, dc, bit] = STEP[move];
      if (!(maze.cells[at] & bit)) continue;
      const next = (row + dr) * maze.width + (col + dc);
      if (!distance.has(next)) {
        distance.set(next, distance.get(at)! + 1);
        queue.push(next);
      }
    }
  }
  return 0;
}

export function checkMaze(maze: Maze, moves: string, seconds: number): Outcome {
  if (moves.length > 2000 || /[^URDL]/.test(moves)) return { solved: false, score: 0, detail: "Jogadas inválidas" };
  let at = 0;
  for (const move of moves as unknown as Move[]) {
    const [dr, dc, bit] = STEP[move];
    if (!(maze.cells[at] & bit)) return { solved: false, score: 0, detail: "Atravessou uma parede" };
    at = (Math.floor(at / maze.width) + dr) * maze.width + ((at % maze.width) + dc);
  }
  if (at !== maze.width * maze.height - 1) return { solved: false, score: 0, detail: "Não chegou à saída" };
  const best = shortestPath(maze);
  const extra = Math.max(0, moves.length - best);
  return { solved: true, score: Math.max(0, ACCURACY_MAX - extra * 4) + timeBonus(seconds, Math.round(best * 0.8)), detail: `${moves.length} passos` };
}
