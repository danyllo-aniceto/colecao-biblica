import { ROWS, type Form, type LevelObject } from "./types";

/**
 * Trechos prontos para montar fases. Cada função coloca objetos a partir da coluna `x` e devolve a próxima coluna livre,
 * então uma fase é só uma sequência de trechos (`levels.ts`). Medidas pensadas para a física única do motor:
 * o pulo alcança ~2 linhas de altura e ~4 colunas de comprimento.
 */
export type Cursor = number;

export function gap(x: Cursor, columns: number): Cursor {
  return x + columns;
}

export function portal(objects: LevelObject[], x: Cursor, form: Form): Cursor {
  objects.push({ kind: "portal", x, form });
  return x + 1;
}

/** `count` espetos colados no chão (1 a 3: o pulo cobre até 3). */
export function spikeRow(objects: LevelObject[], x: Cursor, count: number): Cursor {
  for (let index = 0; index < count; index += 1) objects.push({ kind: "spike", x: x + index });
  return x + count;
}

/** Plataforma baixa para pular em cima; opcionalmente com uma palavra no alto. */
export function platform(objects: LevelObject[], x: Cursor, width: number, height: number, word?: number): Cursor {
  objects.push({ kind: "block", x, y: 0, w: width, h: height });
  if (word !== undefined) objects.push({ kind: "word", x: x + Math.floor(width / 2), y: height, index: word });
  return x + width;
}

/** Palavra no ar (para pegar pulando). */
export function wordAt(objects: LevelObject[], x: Cursor, row: number, index: number): Cursor {
  objects.push({ kind: "word", x, y: row, index });
  return x + 1;
}

/**
 * Túnel de voo: a cada passagem, um bloco no chão (`floor` linhas) e outro no teto (`ceil` linhas) deixam um vão de `ROWS - floor - ceil`.
 * Vãos de 3 linhas ou mais, mudando poucas linhas por vez, são sempre possíveis de passar.
 */
export function flyTunnel(objects: LevelObject[], x: Cursor, gates: Array<{ floor: number; ceil: number; word?: number }>, width = 2, spacing = 5): Cursor {
  let cursor = x;
  for (const gate of gates) {
    if (gate.floor > 0) objects.push({ kind: "block", x: cursor, y: 0, w: width, h: gate.floor });
    if (gate.ceil > 0) objects.push({ kind: "block", x: cursor, y: ROWS - gate.ceil, w: width, h: gate.ceil });
    if (gate.word !== undefined) objects.push({ kind: "word", x: cursor, y: gate.floor + Math.floor((ROWS - gate.floor - gate.ceil) / 2), index: gate.word });
    cursor += width + spacing;
  }
  return cursor;
}

/** Espetos alternando chão e teto: quem passa precisa inverter a gravidade entre um e outro. `spacing` colunas entre eles (7 é confortável). */
export function gravitySpikes(objects: LevelObject[], x: Cursor, sides: Array<"floor" | "ceiling">, spacing = 7): Cursor {
  let cursor = x;
  for (const side of sides) {
    objects.push(side === "floor" ? { kind: "spike", x: cursor } : { kind: "spike", x: cursor, y: ROWS - 1, down: true });
    cursor += spacing;
  }
  return cursor;
}
