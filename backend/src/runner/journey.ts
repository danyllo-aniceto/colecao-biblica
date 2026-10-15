import { gravityLane, GRAVITY_LANE, runFork, RUN_FORK } from "./forks";
import { POWER_KINDS, type PowerKind } from "./powers";
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
};

/** O que os trechos precisam saber: sorteio, se há bifurcações e de onde vem o próximo poder (ou `null` se a fase não tem poderes). */
type Context = { random: Random; forks: boolean; nextPower: () => PowerKind | null };

/** Distância entre checkpoints, em segundos de corrida (a fase tem uma bandeira a cada ~12 s). */
const CHECKPOINT_SECONDS = 12;

/** Quanto dura cada tipo de trecho, em segundos (varia um pouco por sorteio). */
const SECTION_SECONDS: Record<Form, number> = { RUN: 26, FLY: 18, GRAVITY: 22 };

/**
 * Trechos de corrida: sequência de obstáculos com respiro entre eles. Cada trecho pode oferecer um lugar para uma palavra
 * (`carriers`); as palavras do versículo são distribuídas depois, uniformemente, nos lugares oferecidos.
 */
function runPattern(objects: LevelObject[], carriers: Carrier[], x: number, ctx: Context, remaining: number): number {
  const { random } = ctx;
  const pick = random();
  if (pick < 0.26) {
    // Até 2 espetos: com 3 o pulo simples sobra só ~5 passos de folga (só o pulo duplo salva), apertado demais para o toque de gente.
    const count = between(random, 1, 2);
    carriers.push({ x: x + Math.floor(count / 2), y: 2 });
    for (let index = 0; index < count; index += 1) objects.push({ kind: "spike", x: x + index });
    return x + count + between(random, 6, 9);
  }
  if (pick < 0.48) {
    const width = between(random, 4, 6);
    objects.push({ kind: "block", x, y: 0, w: width, h: 1 });
    carriers.push({ x: x + Math.floor(width / 2), y: 1 });
    return x + width + between(random, 6, 8);
  }
  if (pick < 0.6) {
    // Degraus largos: com 3 colunas cada, o tempo entre o pouso e o pulo seguinte era curto demais (e às vezes impossível).
    objects.push({ kind: "block", x, y: 0, w: 5, h: 1 }, { kind: "block", x: x + 5, y: 0, w: 5, h: 2 });
    carriers.push({ x: x + 7, y: 2 });
    return x + 10 + 7;
  }
  if (pick < 0.72) {
    // Pousa no bloco e só depois pula o espeto: sobra ~6 colunas entre o pouso e o espeto (4 era apertado demais).
    objects.push({ kind: "block", x, y: 0, w: 12, h: 1 }, { kind: "spike", x: x + 8, y: 1 });
    return x + 12 + 6;
  }
  if (pick < 0.76) {
    objects.push({ kind: "spike", x }, { kind: "spike", x: x + 8 });
    return x + 9 + 7;
  }
  if (pick < 0.88) {
    // Bifurcação: degraus levam a uma laje (caminho de cima, com recompensas) ou segue-se por baixo (seguro). Só cabe se sobrar trecho.
    const length = RUN_FORK.stairs + RUN_FORK.gap + RUN_FORK.length + RUN_FORK.tail;
    if (ctx.forks && remaining >= length) {
      const info = runFork(objects, x, ctx.nextPower());
      // As palavras do versículo ficam só no chão livre (o caminho de risco dá o poder: palavra lá poderia ficar fora do alcance de quem vai pelo seguro).
      carriers.push({ x: info.end - 4, y: 0 });
      return info.end;
    }
    objects.push({ kind: "spike", x }, { kind: "spike", x: x + 8 });
    return x + 9 + 7;
  }
  // Respiro com um poder no chão (se a fase tem poderes).
  const power = ctx.nextPower();
  if (power) objects.push({ kind: "power", x: x + 3, y: 0, power });
  return x + 8;
}

/** Trecho de voo: túneis cujo vão (no mínimo `minGap` linhas) anda no máximo 1 linha por passagem em cada lado. */
function flySection(objects: LevelObject[], carriers: Carrier[], x: number, length: number, ctx: Context, minGap: number, mark: (nextObstacleX: number) => void): number {
  const { random } = ctx;
  let floor = 1;
  let ceil = 1;
  let cursor = x;
  const end = x + length;
  while (cursor < end) {
    const room = ROWS - minGap;
    floor = Math.max(0, Math.min(room, floor + between(random, -1, 1)));
    ceil = Math.max(0, Math.min(room - floor, ceil + between(random, -1, 1)));
    if (floor > 0) objects.push({ kind: "block", x: cursor, y: 0, w: 2, h: floor });
    if (ceil > 0) objects.push({ kind: "block", x: cursor, y: ROWS - ceil, w: 2, h: ceil });
    const centre = floor + Math.floor((ROWS - floor - ceil) / 2);
    carriers.push({ x: cursor, y: centre });
    // De vez em quando um poder no meio do vão (na 2ª coluna do portão).
    if (random() < 0.3) {
      const power = ctx.nextPower();
      if (power) objects.push({ kind: "power", x: cursor + 1, y: centre, power });
    }
    cursor += 2 + between(random, 5, 6);
    mark(cursor);
  }
  return cursor;
}

/**
 * Trecho de gravidade: espetos no chão e no teto (quem passa inverte a gravidade quando o espeto está do lado onde está) e, de vez em quando,
 * uma "pista de recompensa" (uma pista segura e outra com espetos, poder e palavras).
 */
function gravitySection(objects: LevelObject[], carriers: Carrier[], x: number, length: number, ctx: Context, mark: (nextObstacleX: number) => void): number {
  const { random } = ctx;
  let cursor = x;
  let side: "floor" | "ceiling" = "floor";
  const end = x + length;
  while (cursor < end) {
    if (ctx.forks && end - cursor >= GRAVITY_LANE.length + 6 && random() < 0.3) {
      const info = gravityLane(objects, cursor, random() < 0.5 ? "ceiling" : "floor", ctx.nextPower());
      cursor = info.end + between(random, 3, 5);
      mark(cursor);
      continue;
    }
    if (random() < 0.65) side = side === "floor" ? "ceiling" : "floor";
    objects.push(side === "floor" ? { kind: "spike", x: cursor } : { kind: "spike", x: cursor, y: ROWS - 1, down: true });
    cursor += between(random, 7, 9);
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
  const ctx: Context = { random, forks: useForks, nextPower: () => (usePowers ? queue[given++ % queue.length] : null) };
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
