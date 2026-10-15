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
};

/** Quanto dura cada tipo de trecho, em segundos (varia um pouco por sorteio). */
const SECTION_SECONDS: Record<Form, number> = { RUN: 26, FLY: 18, GRAVITY: 22 };

/**
 * Trechos de corrida: sequência de obstáculos com respiro entre eles. Cada trecho pode oferecer um lugar para uma palavra
 * (`carriers`); as palavras do versículo são distribuídas depois, uniformemente, nos lugares oferecidos.
 */
function runPattern(objects: LevelObject[], carriers: Carrier[], x: number, random: Random): number {
  const pick = random();
  if (pick < 0.3) {
    const count = between(random, 1, 3);
    carriers.push({ x: x + Math.floor(count / 2), y: 2 });
    for (let index = 0; index < count; index += 1) objects.push({ kind: "spike", x: x + index });
    return x + count + between(random, 6, 9);
  }
  if (pick < 0.55) {
    const width = between(random, 3, 5);
    objects.push({ kind: "block", x, y: 0, w: width, h: 1 });
    carriers.push({ x: x + Math.floor(width / 2), y: 1 });
    return x + width + between(random, 6, 8);
  }
  if (pick < 0.7) {
    objects.push({ kind: "block", x, y: 0, w: 3, h: 1 }, { kind: "block", x: x + 3, y: 0, w: 3, h: 2 });
    carriers.push({ x: x + 4, y: 2 });
    return x + 6 + 6;
  }
  if (pick < 0.85) {
    objects.push({ kind: "block", x, y: 0, w: 9, h: 1 }, { kind: "spike", x: x + 5, y: 1 });
    return x + 9 + 6;
  }
  if (pick < 0.95) {
    objects.push({ kind: "spike", x }, { kind: "spike", x: x + 6 });
    return x + 7 + 7;
  }
  return x + 5;
}

/** Trecho de voo: túneis cujo vão (no mínimo 3 linhas) anda no máximo 1 linha por passagem. */
function flySection(objects: LevelObject[], carriers: Carrier[], x: number, length: number, random: Random): number {
  let floor = 1;
  let ceil = 2;
  let cursor = x;
  const end = x + length;
  while (cursor < end) {
    floor = Math.max(0, Math.min(3, floor + between(random, -1, 1)));
    ceil = Math.max(0, Math.min(ROWS - 3 - floor, ceil + between(random, -1, 1)));
    if (ceil > ROWS - 3 - floor) ceil = ROWS - 3 - floor;
    if (floor > 0) objects.push({ kind: "block", x: cursor, y: 0, w: 2, h: floor });
    if (ceil > 0) objects.push({ kind: "block", x: cursor, y: ROWS - ceil, w: 2, h: ceil });
    carriers.push({ x: cursor, y: floor + Math.floor((ROWS - floor - ceil) / 2) });
    cursor += 2 + between(random, 5, 6);
  }
  return cursor;
}

/** Trecho de gravidade: espetos no chão e no teto; quem passa inverte a gravidade quando o espeto está do lado onde está. */
function gravitySection(objects: LevelObject[], x: number, length: number, random: Random): number {
  let cursor = x;
  let side: "floor" | "ceiling" = "floor";
  const end = x + length;
  while (cursor < end) {
    if (random() < 0.65) side = side === "floor" ? "ceiling" : "floor";
    objects.push(side === "floor" ? { kind: "spike", x: cursor } : { kind: "spike", x: cursor, y: ROWS - 1, down: true });
    cursor += between(random, 7, 9);
  }
  return cursor;
}

/**
 * Monta uma fase longa (minutos) alternando as formas, com portais e respiros entre elas, e espalha as palavras do versículo.
 * Determinística: a mesma semente dá sempre a mesma fase. Toda fase gerada precisa passar no teste do bot perfeito.
 */
export function buildJourney(options: JourneyOptions): Level {
  const random = randomFrom(options.seed);
  const order = options.order ?? ["RUN", "FLY", "RUN", "GRAVITY"];
  const objects: LevelObject[] = [];
  const carriers: Carrier[] = [];
  let x = 16;
  let form: Form = "RUN";
  let sectionIndex = 0;
  const target = options.seconds * TILES_PER_SECOND;
  const firstForm = order[0];
  while (x < target) {
    const next = order[sectionIndex % order.length];
    if (sectionIndex > 0 && next !== form) {
      x = portal(objects, gap(x, 4), next);
      x = gap(x, 12);
    } else if (sectionIndex === 0 && next !== "RUN") {
      x = portal(objects, x, next);
      x = gap(x, 12);
    }
    form = next;
    const length = Math.round(SECTION_SECONDS[form] * TILES_PER_SECOND * (0.8 + random() * 0.4));
    const end = x + length;
    if (form === "RUN") {
      while (x < end) x = runPattern(objects, carriers, x, random);
    } else if (form === "FLY") {
      x = flySection(objects, carriers, x, length, random);
    } else {
      x = gravitySection(objects, x, length, random);
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
