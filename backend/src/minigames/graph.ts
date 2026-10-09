import { rng, shuffled, type Outcome, type Random } from "./common";
import { beginClock, clockAlmostOver, clockExpired, elapsedSeconds, endClock, LEVEL_LABEL, LEVEL_SCALE, maxScoreOf, newClock, speedFactor, turnShare, TurnError, type Clock, type Level, type TurnResult } from "./turns";

/**
 * Interconexão, em turnos: em cada rodada, chegue de um personagem ou lugar a outro por uma corrente de relações; menos elos, mais pontos.
 * A dificuldade define a distância entre os dois (fácil 2–3 elos, médio 3–4, difícil 5–6) e quantas dicas há.
 */
export const ROUND_CHOICES = [1, 3, 5] as const;
export const TIME_CHOICES = [30, 45, 60, 90, 120] as const;
export const CHAIN_LEVELS: Record<Level, { min: number; max: number; hints: number }> = {
  facil: { min: 2, max: 3, hints: 3 },
  medio: { min: 3, max: 4, hints: 2 },
  dificil: { min: 5, max: 6, hints: 1 },
};
/** Cada dica usada numa rodada tira esta parte dos pontos dela. */
export const HINT_COST = 0.2;
export type Edge = [from: string, to: string, forward: string, backward: string];

/** Relações bíblicas: `forward` lê de `from` para `to`; `backward` lê de `to` para `from`. */
export const EDGES: Edge[] = [
  ["Isaías", "Ezequias", "profetizou ao rei", "recebeu a profecia de"],
  ["Isaías", "Jesus", "anunciou a vinda de", "foi anunciado por"],
  ["Ezequias", "Jerusalém", "reinou em", "foi governada por"],
  ["Ezequias", "Davi", "descendia do rei", "foi antepassado de"],
  ["Jesus", "Jerusalém", "foi crucificado e ressuscitou em", "viu a morte e a ressurreição de"],
  ["Davi", "Jerusalém", "fez dela a sua capital:", "foi a capital de"],
  ["Davi", "Salomão", "foi pai de", "foi filho de"],
  ["Salomão", "Jerusalém", "construiu o Templo em", "teve o Templo construído por"],
  ["Davi", "Belém", "nasceu em", "viu nascer"],
  ["Jesus", "Belém", "nasceu em", "viu nascer"],
  ["Jesus", "Davi", "foi descendente de", "foi antepassado de"],
  ["Jesus", "Abraão", "foi descendente de", "foi antepassado de"],
  ["Jesus", "Maria", "foi filho de", "foi mãe de"],
  ["Jesus", "Nazaré", "cresceu em", "viu crescer"],
  ["Jesus", "João Batista", "foi batizado por", "batizou"],
  ["João Batista", "Rio Jordão", "batizava no", "viu os batismos de"],
  ["Jesus", "Cafarnaum", "ensinou e morou em", "recebeu o ensino de"],
  ["Jesus", "Pedro", "chamou", "foi chamado por"],
  ["Pedro", "Cafarnaum", "morava em", "era a cidade de"],
  ["Jesus", "Egito", "fugiu para o", "acolheu o menino"],
  ["Jesus", "Moisés", "apareceu com", "apareceu com"],
  ["Jesus", "Elias", "apareceu com", "apareceu com"],
  ["Jesus", "Jonas", "citou o sinal de", "foi lembrado como sinal por"],
  ["Paulo", "Damasco", "foi convertido perto de", "viu a conversão de"],
  ["Paulo", "Antioquia", "partiu em viagem missionária de", "enviou"],
  ["Paulo", "Roma", "chegou preso a", "recebeu"],
  ["Paulo", "Pedro", "se encontrou com", "se encontrou com"],
  ["Moisés", "Egito", "libertou o povo do", "foi libertado do cativeiro por"],
  ["Moisés", "Sinai", "recebeu a Lei no", "viu a entrega da Lei a"],
  ["Moisés", "Josué", "foi sucedido por", "sucedeu a"],
  ["Josué", "Jericó", "conquistou", "foi conquistada por"],
  ["Josué", "Canaã", "conduziu o povo a", "foi alcançada por"],
  ["Abraão", "Ur", "saiu de", "viu a saída de"],
  ["Abraão", "Canaã", "viveu em", "acolheu"],
  ["Abraão", "Isaque", "foi pai de", "foi filho de"],
  ["Isaque", "Jacó", "foi pai de", "foi filho de"],
  ["Jacó", "Betel", "sonhou com a escada em", "foi palco do sonho de"],
  ["Jacó", "José", "foi pai de", "foi filho de"],
  ["José", "Egito", "governou o", "foi governado por"],
  ["Elias", "Carmelo", "enfrentou os profetas de Baal no", "viu o fogo de"],
  ["Elias", "Eliseu", "foi sucedido por", "sucedeu a"],
  ["Jonas", "Nínive", "pregou em", "ouviu a pregação de"],
  ["Daniel", "Babilônia", "serviu na corte da", "teve a corte servida por"],
  ["Babilônia", "Jerusalém", "conquistou", "foi conquistada pela"],
  ["Ester", "Susã", "foi rainha em", "teve como rainha"],
  ["Susã", "Babilônia", "foi capital do império que sucedeu a", "foi sucedida pelo império de"],
  ["Rute", "Boaz", "casou-se com", "casou-se com"],
  ["Boaz", "Belém", "vivia em", "era a cidade de"],
  ["Rute", "Davi", "foi bisavó de", "foi bisneto de"],
  ["Samuel", "Davi", "ungiu", "foi ungido por"],
  ["Samuel", "Saul", "ungiu", "foi ungido por"],
  ["Saul", "Davi", "perseguiu", "foi perseguido por"],
  ["João", "Jesus", "foi discípulo de", "foi mestre de"],
  ["João", "Patmos", "foi exilado em", "recebeu o exílio de"],
];

export const NODES = [...new Set(EDGES.flatMap(([from, to]) => [from, to]))];

/** Vizinhos de um nó, com a frase da relação lida a partir dele. */
export function neighbors(node: string): Array<{ to: string; phrase: string }> {
  return EDGES.flatMap(([from, to, forward, backward]) => (from === node ? [{ to, phrase: forward }] : to === node ? [{ to: from, phrase: backward }] : []));
}

/** Menor número de passos entre dois nós (null se não houver caminho). */
export function shortestSteps(from: string, to: string): number | null {
  const distance = new Map<string, number>([[from, 0]]);
  const queue = [from];
  for (let head = 0; head < queue.length; head += 1) {
    const at = queue[head];
    if (at === to) return distance.get(at)!;
    for (const { to: next } of neighbors(at)) {
      if (!distance.has(next)) {
        distance.set(next, distance.get(at)! + 1);
        queue.push(next);
      }
    }
  }
  return null;
}

/** O caminho mais curto entre dois nós (lista de nós, com os dois pontas); null se não houver. */
export function shortestPathNodes(from: string, to: string): string[] | null {
  const previous = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  for (let head = 0; head < queue.length; head += 1) {
    const at = queue[head];
    if (at === to) {
      const path: string[] = [];
      for (let node: string | null = to; node !== null; node = previous.get(node) ?? null) path.unshift(node);
      return path;
    }
    for (const { to: next } of neighbors(at)) {
      if (!previous.has(next)) {
        previous.set(next, at);
        queue.push(next);
      }
    }
  }
  return null;
}

export type ChainRound = { from: string; to: string; shortest: number };
export type ChainGameState = { seed: number; level: Level; clock: Clock; rounds: ChainRound[]; current: number; hinted: number; results: TurnResult[] };
export type ChainPuzzle = {
  round: number;
  rounds: number;
  from: string;
  to: string;
  edges: Edge[];
  hintsLeft: number;
  timePerRound: number | null;
  level: Level;
  maxScore: number;
};

/** Sorteia as duplas à distância do nível, sem repetir pontas nem duplas das últimas partidas. */
export function pickChainRounds(random: Random, level: Level, count: number, avoid: readonly string[]): ChainRound[] {
  const config = CHAIN_LEVELS[level];
  const recent = new Set(avoid);
  const rounds: ChainRound[] = [];
  const used = new Set<string>();
  const nodes = shuffled(random, NODES);
  for (const pass of [0, 1]) {
    for (const from of nodes) {
      for (const to of shuffled(random, NODES)) {
        if (rounds.length === count) return rounds;
        if (from === to || used.has(from) || used.has(to)) continue;
        // Na primeira passada evita as pontas das últimas partidas; na segunda aceita qualquer uma.
        if (pass === 0 && (recent.has(from) || recent.has(to))) continue;
        const steps = shortestSteps(from, to);
        if (steps === null || steps < config.min || steps > config.max) continue;
        rounds.push({ from, to, shortest: steps });
        used.add(from);
        used.add(to);
        break;
      }
    }
  }
  return rounds;
}

export const newChain = (seed: number, rounds: ChainRound[], level: Level, timePerRound: number | null, now: number): ChainGameState => ({ seed, level, clock: newClock(timePerRound, now), rounds, current: 0, hinted: 0, results: [] });

export function publicChain(state: ChainGameState): ChainPuzzle {
  const round = state.rounds[state.current];
  return { round: state.current, rounds: state.rounds.length, from: round.from, to: round.to, edges: EDGES, hintsLeft: CHAIN_LEVELS[state.level].hints - state.hinted, timePerRound: state.clock.timePerTurn, level: state.level, maxScore: maxScoreOf(state.level) };
}

/** Pontos de uma rodada (antes do fator da dificuldade): 70% pelos elos (cada elo a mais tira 30% dessa parte, mínimo 25%) e 30% pela rapidez, menos 20% por dica. */
export function chainPoints(rounds: number, steps: number, shortest: number, hinted: number, seconds: number, timed: boolean): number {
  const accuracy = Math.max(0.25, 1 - Math.max(0, steps - shortest) * 0.3);
  return Math.max(0, Math.round(turnShare(rounds, timed) * (0.7 * accuracy + 0.3 * speedFactor(seconds, 20 + 10 * shortest) - HINT_COST * hinted)));
}

export type ChainAction = { type: "path"; path: string[] } | { type: "hint"; path?: string[] } | { type: "skip" } | { type: "timeout" } | { type: "begin" };
export type ChainEnd = { reached: boolean; timedOut: boolean; steps: number; shortest: number; best: string[]; points: number };
export type ChainEvent = { kind: "begin" } | { kind: "hint"; node: string; phrase: string; left: number } | { kind: "end"; end: ChainEnd; next: ChainPuzzle | null };

/** O caminho é a lista de nós visitados, do começo ao fim; cada passo precisa ser uma relação que existe. */
function validPath(round: ChainRound, path: string[]): boolean {
  if (path.length < 2 || path.length > 40 || path[0] !== round.from || path.at(-1) !== round.to) return false;
  return path.every((node, index) => index === path.length - 1 || neighbors(node).some(({ to }) => to === path[index + 1]));
}

export function playChain(state: ChainGameState, action: ChainAction, now: number): { state: ChainGameState; event: ChainEvent; done: boolean } {
  const round = state.rounds[state.current];
  if (!round) throw new TurnError("A partida já terminou");
  if (action.type === "begin") return { state: { ...state, clock: beginClock(state.clock, now) }, event: { kind: "begin" }, done: false };
  if (action.type === "timeout" && !clockAlmostOver(state.clock, now)) throw new TurnError("Ainda há tempo");
  const timedOut = action.type === "timeout" || clockExpired(state.clock, now);

  if (action.type === "hint" && !timedOut) {
    if (state.hinted >= CHAIN_LEVELS[state.level].hints) throw new TurnError("Acabaram as dicas desta rodada");
    // A dica leva do ponto em que o jogador está ao próximo nó do caminho mais curto até a chegada.
    const walked = action.path && action.path.length > 0 ? action.path : [round.from];
    if (walked[0] !== round.from || walked.some((node, index) => index < walked.length - 1 && !neighbors(node).some(({ to }) => to === walked[index + 1]))) throw new TurnError("Caminho inválido");
    const here = walked[walked.length - 1];
    const best = shortestPathNodes(here, round.to);
    if (!best || best.length < 2) throw new TurnError("Você já chegou");
    const phrase = neighbors(here).find(({ to }) => to === best[1])?.phrase ?? "";
    return { state: { ...state, hinted: state.hinted + 1 }, event: { kind: "hint", node: best[1], phrase: `${here} ${phrase}`, left: CHAIN_LEVELS[state.level].hints - state.hinted - 1 }, done: false };
  }

  let steps = 0;
  let reached = false;
  if (action.type === "path" && !timedOut) {
    if (!validPath(round, action.path)) throw new TurnError("Caminho inválido");
    steps = action.path.length - 1;
    reached = true;
  }
  const seconds = Math.min(elapsedSeconds(state.clock, now), state.clock.timePerTurn ?? Infinity);
  const points = reached ? chainPoints(state.rounds.length, steps, round.shortest, state.hinted, seconds, state.clock.timePerTurn !== null) : 0;
  const results = [...state.results, { label: `${round.from} → ${round.to}`, solved: reached, timedOut, points, seconds: Math.round(seconds) }];
  const current = state.current + 1;
  const next: ChainGameState = { ...state, results, current, hinted: 0, clock: endClock(state.clock, now) };
  const done = current >= state.rounds.length;
  const end: ChainEnd = { reached, timedOut, steps, shortest: round.shortest, best: shortestPathNodes(round.from, round.to) ?? [], points };
  return { state: next, event: { kind: "end", end, next: done ? null : publicChain(next) }, done };
}

export function chainOutcome(state: ChainGameState): Outcome {
  const reached = state.results.filter((result) => result.solved).length;
  const total = state.rounds.length;
  const score = Math.round(state.results.reduce((sum, result) => sum + result.points, 0) * LEVEL_SCALE[state.level]);
  return { solved: reached >= Math.ceil(total / 2), score, detail: `${reached} de ${total} ${total === 1 ? "ligação feita" : "ligações feitas"} · ${LEVEL_LABEL[state.level]}` };
}
