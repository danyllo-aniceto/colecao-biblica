import { flySplit, FLY_SPLIT, gravityLane, GRAVITY_LANE, gravitySlab, GRAVITY_SLAB, runFork, RUN_FORK } from "./forks";
import { POWER_KINDS, POWERS_BY_FORM, type PowerKind } from "./powers";
import { between, randomFrom, type Random } from "./rng";
import { gap, portal } from "./segments";
import { ROWS, SPEED, TICKS_PER_SECOND, TILE, type Form, type Level, type LevelObject, type Verse } from "./types";

/** Colunas que o personagem percorre por segundo (a fase é medida em tempo, o que o jogador sente). */
export const TILES_PER_SECOND = (SPEED * TICKS_PER_SECOND) / TILE;

type Carrier = { x: number; y: number };

export type JourneyOptions = {
  id: string;
  name: string;
  seed: number;
  /** Duração aproximada da fase em segundos. */
  seconds: number;
  verse: Verse;
  /** Sequência de formas (repete até completar o tempo). */
  order?: Form[];
  /** Vão mínimo dos túneis de voo, em linhas (4 = confortável; 3 = difícil). */
  flyGap?: number;
  /** Bifurcações (caminho de cima × de baixo na corrida; pista segura × de recompensa na gravidade). Padrão: ligadas. */
  forks?: boolean;
  /** Poderes no caminho (Turbo, Escudo, Pulo triplo, Ímã). Padrão: ligados. */
  powers?: boolean;
  /** Dificuldade de 0 (bem fácil) a 1 (a mais difícil do cenário): muda os pesos dos trechos e o respiro entre obstáculos. Padrão: 0,5. */
  difficulty?: number;
};

/**
 * O que os trechos precisam saber: sorteio, dificuldade (0 = bem fácil, 1 = a mais difícil do cenário), se há bifurcações e de onde vem o próximo poder
 * (`null` se a fase não tem poderes).
 */
type Context = { random: Random; difficulty: number; forks: boolean; nextPower: (form: Form) => PowerKind | null };

/** Distância entre checkpoints, em segundos de corrida (a fase tem uma bandeira a cada ~12 s). */
const CHECKPOINT_SECONDS = 12;

/** Quanto dura cada tipo de trecho, em segundos (varia um pouco por sorteio). */
const SECTION_SECONDS: Record<Form, number> = { RUN: 26, FLY: 18, GRAVITY: 22 };

/** Chance de um respiro/portão trazer poder: poucos poderes, para cada um valer a pena. */
const POWER_CHANCE = { rest: 0.4, flyGate: 0.1, fork: 0.7, lane: 0.6 } as const;

/** Sorteia um item de uma lista com pesos. */
function weighted<T>(random: Random, items: Array<[T, number]>): T {
  const total = items.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [item, weight] of items) {
    roll -= weight;
    if (roll < 0) return item;
  }
  return items[items.length - 1][0];
}

type RunKind = "spikes" | "block" | "stairs" | "blockSpike" | "twoSpikes" | "pit" | "pitPair" | "ladder" | "fork" | "rest";

/** Respiro entre obstáculos: encurta de leve com a dificuldade (nunca abaixo de 5 colunas, para o toque atrasado caber). */
const breath = (ctx: Context, low: number, high: number) => between(ctx.random, Math.round(low - ctx.difficulty), Math.round(high - 2 * ctx.difficulty));

/**
 * Trechos de corrida: sequência de obstáculos com respiro entre eles. Cada trecho pode oferecer um lugar para uma palavra
 * (`carriers`); as palavras do versículo são distribuídas depois, uniformemente, nos lugares oferecidos. Os pesos mudam com a dificuldade:
 * no começo do cenário só há espetos e blocos; depois entram degraus, buracos, pares de buracos e escadas.
 */
function runPattern(objects: LevelObject[], carriers: Carrier[], x: number, ctx: Context, remaining: number): number {
  const { random, difficulty: d } = ctx;
  const forkLength = RUN_FORK.stairs + RUN_FORK.gap + RUN_FORK.length + RUN_FORK.tail;
  const kind = weighted<RunKind>(random, [
    ["spikes", 24 - 8 * d],
    ["block", 20 - 6 * d],
    ["stairs", 6 + 5 * d],
    ["blockSpike", 8 + 8 * d],
    ["twoSpikes", 3 + 8 * d],
    ["pit", 3 + 12 * d],
    ["pitPair", d > 0.45 ? 10 * d : 0],
    ["ladder", d > 0.3 ? 8 * d : 0],
    ["fork", ctx.forks && remaining >= forkLength ? 11 : 0],
    ["rest", 6 - 3 * d],
  ]);
  switch (kind) {
    case "spikes": {
      // Até 2 espetos: com 3 o pulo simples sobra só ~5 passos de folga (só o pulo duplo salva), apertado demais para o toque de gente.
      const count = between(random, 1, 2);
      carriers.push({ x: x + Math.floor(count / 2), y: 2 });
      for (let index = 0; index < count; index += 1) objects.push({ kind: "spike", x: x + index });
      return x + count + breath(ctx, 6, 9);
    }
    case "block": {
      const width = between(random, 4, 6);
      objects.push({ kind: "block", x, y: 0, w: width, h: 1 });
      carriers.push({ x: x + Math.floor(width / 2), y: 1 });
      return x + width + breath(ctx, 6, 8);
    }
    case "stairs": {
      // Degraus largos: com 3 colunas cada, o tempo entre o pouso e o pulo seguinte era curto demais (e às vezes impossível).
      objects.push({ kind: "block", x, y: 0, w: 5, h: 1 }, { kind: "block", x: x + 5, y: 0, w: 5, h: 2 });
      carriers.push({ x: x + 7, y: 2 });
      return x + 10 + 7;
    }
    case "blockSpike":
      // Pousa no bloco e só depois pula o espeto: sobra ~6 colunas entre o pouso e o espeto (4 era apertado demais).
      objects.push({ kind: "block", x, y: 0, w: 12, h: 1 }, { kind: "spike", x: x + 8, y: 1 });
      return x + 12 + 6;
    case "twoSpikes":
      objects.push({ kind: "spike", x }, { kind: "spike", x: x + 8 });
      return x + 9 + 7;
    case "pit": {
      // Buraco no chão: pular antes da borda (2 a 3 colunas no começo, 3 a 4 mais adiante).
      const width = between(random, d < 0.5 ? 2 : 3, d < 0.5 ? 3 : 4);
      objects.push({ kind: "pit", x, w: width, side: "floor" });
      carriers.push({ x: x + Math.floor(width / 2), y: 3 });
      return x + width + breath(ctx, 7, 9);
    }
    case "pitPair":
      // Dois buracos separados por um pedaço de chão para pousar e pular de novo.
      objects.push({ kind: "pit", x, w: 3, side: "floor" }, { kind: "pit", x: x + 3 + 6, w: 3, side: "floor" });
      return x + 3 + 6 + 3 + 7;
    case "ladder":
      // Escada que sobe, desce e termina num espeto: pousa em cada degrau antes de saltar para o seguinte.
      objects.push({ kind: "block", x, y: 0, w: 5, h: 1 }, { kind: "block", x: x + 5, y: 0, w: 5, h: 2 }, { kind: "block", x: x + 10, y: 0, w: 5, h: 1 }, { kind: "spike", x: x + 17 });
      carriers.push({ x: x + 7, y: 2 });
      return x + 17 + 1 + 7;
    case "fork": {
      // Bifurcação: degraus levam a uma laje (caminho de cima, com recompensas) ou segue-se por baixo (seguro).
      const power = random() < POWER_CHANCE.fork ? ctx.nextPower("RUN") : null;
      const info = runFork(objects, x, power, random() < 0.3 + 0.3 * d ? "PIT" : "SPIKES");
      // As palavras do versículo ficam só no chão livre (o caminho de risco dá o poder: palavra lá poderia ficar fora do alcance de quem vai pelo seguro).
      carriers.push({ x: info.end - 4, y: 0 });
      return info.end;
    }
    default: {
      // Respiro, às vezes com um poder no chão (se a fase tem poderes).
      const power = random() < POWER_CHANCE.rest ? ctx.nextPower("RUN") : null;
      if (power) objects.push({ kind: "power", x: x + 3, y: 0, power });
      return x + 8;
    }
  }
}

/** Trecho de voo: túneis cujo vão (no mínimo `minGap` linhas) anda no máximo 1 linha por passagem em cada lado; às vezes um divisor abre dois corredores. */
function flySection(objects: LevelObject[], carriers: Carrier[], x: number, length: number, ctx: Context, minGap: number, mark: (nextObstacleX: number) => void): number {
  const { random } = ctx;
  let floor = 1;
  let ceil = 1;
  let cursor = x;
  const end = x + length;
  while (cursor < end) {
    if (ctx.forks && end - cursor >= FLY_SPLIT.lead + FLY_SPLIT.length + FLY_SPLIT.tail + 6 && random() < 0.16) {
      const info = flySplit(objects, cursor, random() < POWER_CHANCE.fork ? ctx.nextPower("FLY") : null);
      // O vão antes do próximo túnel volta a ser o do meio.
      floor = 1;
      ceil = 1;
      cursor = info.end + between(random, 4, 6);
      mark(cursor);
      continue;
    }
    const room = ROWS - minGap;
    floor = Math.max(0, Math.min(room, floor + between(random, -1, 1)));
    ceil = Math.max(0, Math.min(room - floor, ceil + between(random, -1, 1)));
    if (floor > 0) objects.push({ kind: "block", x: cursor, y: 0, w: 2, h: floor });
    if (ceil > 0) objects.push({ kind: "block", x: cursor, y: ROWS - ceil, w: 2, h: ceil });
    const centre = floor + Math.floor((ROWS - floor - ceil) / 2);
    carriers.push({ x: cursor, y: centre });
    // De vez em quando um poder no meio do vão (na 2ª coluna do portão).
    if (random() < POWER_CHANCE.flyGate) {
      const power = ctx.nextPower("FLY");
      if (power) objects.push({ kind: "power", x: cursor + 1, y: centre, power });
    }
    cursor += 2 + breath(ctx, 5, 6);
    mark(cursor);
  }
  return cursor;
}

/**
 * Trecho de gravidade: espetos no chão e no teto (quem passa inverte a gravidade quando o espeto está do lado onde está), buracos no chão ou no teto
 * (é preciso estar do lado oposto ao passar), pistas de recompensa e lajes que abrem dois corredores. `side` é o lado em que o jogador está.
 */
function gravitySection(objects: LevelObject[], carriers: Carrier[], x: number, length: number, ctx: Context, mark: (nextObstacleX: number) => void): number {
  const { random, difficulty: d } = ctx;
  let cursor = x;
  let side: "floor" | "ceiling" = "floor";
  const end = x + length;
  while (cursor < end) {
    const room = end - cursor;
    const kind = weighted<"spike" | "pit" | "lane" | "slab">(random, [
      ["spike", 60 - 20 * d],
      ["pit", 8 + 28 * d],
      ["lane", ctx.forks && room >= GRAVITY_LANE.length + 6 ? 18 : 0],
      ["slab", ctx.forks && room >= GRAVITY_SLAB.lead + GRAVITY_SLAB.length + GRAVITY_SLAB.tail + 6 ? 12 : 0],
    ]);
    if (kind === "lane") {
      const info = gravityLane(objects, cursor, random() < 0.5 ? "ceiling" : "floor", random() < POWER_CHANCE.lane ? ctx.nextPower("GRAVITY") : null);
      cursor = info.end + between(random, 3, 5);
      mark(cursor);
      continue;
    }
    if (kind === "slab") {
      const info = gravitySlab(objects, cursor, random() < POWER_CHANCE.lane ? ctx.nextPower("GRAVITY") : null, random() < 0.5);
      cursor = info.end + between(random, 3, 5);
      side = "floor";
      mark(cursor);
      continue;
    }
    if (kind === "pit") {
      // O buraco fica do lado em que o jogador está: ele precisa virar para o outro lado antes e só volta depois.
      const width = between(random, 3, 4);
      objects.push({ kind: "pit", x: cursor, w: width, side });
      cursor += width + breath(ctx, 8, 10);
      side = side === "floor" ? "ceiling" : "floor";
      mark(cursor);
      continue;
    }
    if (random() < 0.65) side = side === "floor" ? "ceiling" : "floor";
    objects.push(side === "floor" ? { kind: "spike", x: cursor } : { kind: "spike", x: cursor, y: ROWS - 1, down: true });
    cursor += breath(ctx, 7, 9);
    mark(cursor);
  }
  return cursor;
}

/**
 * Monta uma fase longa (minutos) alternando as formas, com portais e respiros entre elas, e espalha as palavras do versículo.
 * Determinística: a mesma semente dá sempre a mesma fase. Toda fase gerada precisa passar no teste do bot perfeito.
 */
export function buildJourney(options: JourneyOptions): Level {
  const random = randomFrom(options.seed);
  // Os poderes saem em ordem embaralhada pela semente, sem repetir até acabarem os 4 tipos.
  const queue = [...POWER_KINDS];
  for (let index = queue.length - 1; index > 0; index -= 1) {
    const swap = between(random, 0, index);
    [queue[index], queue[swap]] = [queue[swap], queue[index]];
  }
  let given = 0;
  const useForks = options.forks ?? true;
  const usePowers = options.powers ?? true;
  const difficulty = Math.max(0, Math.min(1, options.difficulty ?? 0.5));
  const ctx: Context = { random, difficulty, forks: useForks, nextPower: (form) => {
      if (!usePowers) return null;
      // O próximo da fila que faz sentido na forma (os que não servem ficam para a vez seguinte).
      for (let tries = 0; tries < queue.length; tries += 1) {
        const index = (given + tries) % queue.length;
        if (POWERS_BY_FORM[form].includes(queue[index])) {
          given = index + 1;
          return queue[index];
        }
      }
      return null;
    },
  };
  const order = options.order ?? ["RUN", "FLY", "RUN", "GRAVITY"];
  const objects: LevelObject[] = [];
  const carriers: Carrier[] = [];
  let x = 16;
  let lastCheckpoint = 0;
  // Bandeira no trecho livre antes do próximo obstáculo (3 colunas antes dele), quando já passou tempo desde a última.
  const mark = (nextObstacleX: number) => {
    if (nextObstacleX - lastCheckpoint >= CHECKPOINT_SECONDS * TILES_PER_SECOND) {
      lastCheckpoint = nextObstacleX - 3;
      objects.push({ kind: "checkpoint", x: lastCheckpoint });
    }
  };
  let form: Form = "RUN";
  let sectionIndex = 0;
  const target = options.seconds * TILES_PER_SECOND;
  const firstForm = order[0];
  while (x < target) {
    const next = order[sectionIndex % order.length];
    if (sectionIndex > 0 && next !== form) {
      x = portal(objects, gap(x, 4), next);
      x = gap(x, 12);
      // Começo de cada trecho novo: bandeira logo depois do portal.
      lastCheckpoint = x - 6;
      objects.push({ kind: "checkpoint", x: lastCheckpoint });
    } else if (sectionIndex === 0 && next !== "RUN") {
      x = portal(objects, x, next);
      x = gap(x, 12);
    }
    form = next;
    const length = Math.round(SECTION_SECONDS[form] * TILES_PER_SECOND * (0.8 + random() * 0.4));
    const end = x + length;
    if (form === "RUN") {
      while (x < end) {
        x = runPattern(objects, carriers, x, ctx, end - x);
        mark(x);
      }
    } else if (form === "FLY") {
      x = flySection(objects, carriers, x, length, ctx, options.flyGap ?? 4, mark);
    } else {
      x = gravitySection(objects, carriers, x, length, ctx, mark);
    }
    sectionIndex += 1;
  }
  x = gap(x, 8);

  // Palavras do versículo: nos lugares oferecidos, uniformemente espaçados, na ordem em que aparecem.
  const words = options.verse.words.length;
  if (carriers.length < words) throw new Error(`Fase ${options.id}: ${carriers.length} lugares para ${words} palavras`);
  carriers.sort((a, b) => a.x - b.x);
  for (let index = 0; index < words; index += 1) {
    const carrier = carriers[Math.floor(((index + 0.5) * carriers.length) / words)];
    objects.push({ kind: "word", x: carrier.x, y: carrier.y, index });
  }
  return { id: options.id, name: options.name, verse: options.verse, form: firstForm === "RUN" ? "RUN" : firstForm, length: x, objects };
}
