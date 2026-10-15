import {
  CEIL_Y,
  FLOOR_Y,
  PLAYER,
  SPEED,
  TILE,
  TIME_SCALE,
  type Level,
  type PlayerState,
  type PreparedLevel,
  type Rect,
  type RunResult,
} from "./types";
import { applyPower, emptyEffects, GRACE_TICKS, isImmune, MAGNET_RANGE, TURBO_SPEED, tickEffects } from "./powers";

/**
 * Física única para todos os personagens. Valores de referência (ritmo rápido) multiplicados pela escala de tempo:
 * velocidades por `T`, acelerações por `T²`.
 */
const T = TIME_SCALE;
const GRAVITY = 0.72 * T * T;
const JUMP_SPEED = 11.6 * T;
/** Pulos extras no ar (forma Corrida): um novo toque, depois de soltar, dá mais um impulso um pouco menor. */
export const MAX_AIR_JUMPS = 1;
const AIR_JUMP_SPEED = JUMP_SPEED * 0.92;
const MAX_FALL = 14 * T;
const FLY_UP = 0.55 * T * T;
const FLY_DOWN = 0.45 * T * T;
const FLY_MAX_UP = 6.5 * T;
const FLY_MAX_DOWN = 7 * T;
const FLIP_GRAVITY = 0.9 * T * T;
const FLIP_KICK = 2 * T;
const FLIP_MAX = 13 * T;
/** Até quantos px o personagem "sobe" num canto de bloco em vez de bater (perdão para quem erra por pouco). */
const STEP_UP = 14;
/** Folga da caixa do personagem contra espetos e quinas (a colisão com espeto é mais gentil que o desenho). */
const HURT_INSET = 4;

const toRect = (left: number, top: number, width: number, height: number): Rect => ({ l: left, t: top, r: left + width, b: top + height });

/** Indexa a fase por coluna. Espeto: caixa menor que a casa (50% de largura, 60% de altura, colada na base). */
export function prepareLevel(level: Level): PreparedLevel {
  const cols: PreparedLevel["cols"] = Array.from({ length: level.length + 4 }, () => ({ spikes: [], blocks: [], words: [], powers: [] }));
  const portals: PreparedLevel["portals"] = [];
  const checkpoints: number[] = [];
  let wordCount = 0;
  let powerCount = 0;
  const colOf = (column: number) => cols[Math.max(0, Math.min(cols.length - 1, column))];
  for (const object of level.objects) {
    if (object.kind === "portal") {
      portals.push({ x: object.x * TILE, form: object.form });
    } else if (object.kind === "checkpoint") {
      checkpoints.push(object.x * TILE);
    } else if (object.kind === "spike") {
      const row = object.y ?? 0;
      const cellTop = FLOOR_Y - (row + 1) * TILE;
      const width = TILE * 0.5;
      const height = TILE * 0.6;
      const left = object.x * TILE + (TILE - width) / 2;
      const rect = object.down ? toRect(left, cellTop, width, height) : toRect(left, cellTop + TILE - height, width, height);
      colOf(object.x).spikes.push(rect);
    } else if (object.kind === "block") {
      const rect = toRect(object.x * TILE, FLOOR_Y - (object.y + object.h) * TILE, object.w * TILE, object.h * TILE);
      for (let column = object.x; column < object.x + object.w; column += 1) colOf(column).blocks.push(rect);
    } else if (object.kind === "power") {
      const size = 30;
      const rect = toRect(object.x * TILE + (TILE - size) / 2, FLOOR_Y - (object.y + 1) * TILE + (TILE - size) / 2, size, size);
      colOf(object.x).powers.push({ ...rect, id: powerCount, power: object.power });
      powerCount += 1;
    } else {
      const size = 28;
      const rect = toRect(object.x * TILE + (TILE - size) / 2, FLOOR_Y - (object.y + 1) * TILE + (TILE - size) / 2, size, size);
      colOf(object.x).words.push({ ...rect, index: object.index });
      wordCount = Math.max(wordCount, object.index + 1);
    }
  }
  portals.sort((a, b) => a.x - b.x);
  checkpoints.sort((a, b) => a - b);
  return { level, endX: level.length * TILE, portals, checkpoints, cols, wordCount, powerCount };
}

export function newPlayer(level: PreparedLevel): PlayerState {
  const form = level.level.form;
  return {
    tick: 0,
    x: 0,
    y: form === "FLY" ? (FLOOR_Y + CEIL_Y - PLAYER) / 2 : FLOOR_Y - PLAYER,
    vy: 0,
    grav: 1,
    form,
    grounded: form !== "FLY",
    airJumps: MAX_AIR_JUMPS,
    held: false,
    portal: 0,
    checkpoint: 0,
    status: "running",
    cause: null,
    collected: [],
    powers: [],
    effects: emptyEffects(),
  };
}

/**
 * Estado limpo para voltar a um checkpoint: parado no ponto da bandeira, no chão (Corrida e Gravidade) ou no meio do vão (Voo), na forma que a fase
 * tem ali, com o pulo duplo recarregado e sem efeitos de poderes. Guarda as palavras (e os poderes) já pegos e a contagem de passos. Sempre justo: nunca volta no meio de um pulo.
 * `count` = quantos checkpoints já foram cruzados (1 = o primeiro); 0 volta ao começo da fase.
 */
export function respawnAt(level: PreparedLevel, count: number, collected: number[] = [], tick = 0, powers: number[] = []): PlayerState {
  if (count <= 0) return { ...newPlayer(level), collected: [...collected], powers: [...powers], tick };
  const x = level.checkpoints[Math.min(count, level.checkpoints.length) - 1];
  const centre = x + PLAYER / 2;
  let form = level.level.form;
  let portal = 0;
  while (portal < level.portals.length && level.portals[portal].x <= centre) {
    form = level.portals[portal].form;
    portal += 1;
  }
  return {
    tick,
    x: x - PLAYER / 2,
    y: form === "FLY" ? (FLOOR_Y + CEIL_Y - PLAYER) / 2 : FLOOR_Y - PLAYER,
    vy: 0,
    grav: 1,
    form,
    grounded: form !== "FLY",
    airJumps: MAX_AIR_JUMPS,
    held: false,
    portal,
    checkpoint: Math.min(count, level.checkpoints.length),
    status: "running",
    cause: null,
    collected: [...collected],
    powers: [...powers],
    effects: emptyEffects(),
  };
}

const overlaps = (a: Rect, b: Rect) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

/** Objetos nas colunas que o personagem ocupa (no máximo 2 a 3 colunas; mais largo com o Ímã). */
function* nearby<T>(level: PreparedLevel, x: number, pick: (col: PreparedLevel["cols"][number]) => T[], width = PLAYER): Generator<T> {
  const first = Math.max(0, Math.floor(x / TILE));
  const last = Math.min(level.cols.length - 1, Math.floor((x + width - 0.001) / TILE));
  for (let column = first; column <= last; column += 1) yield* pick(level.cols[column]);
}

/**
 * Um passo de 1/60 s. `held` = o dedo está na tela neste passo.
 * - Corrida: segurar (ou tocar) no chão pula; um novo toque no ar dá o pulo duplo (triplo com o poder). - Voo: segurar sobe, soltar desce. - Gravidade: tocar no chão/teto inverte a gravidade.
 * Primeiro anda para o lado (bater de lado derruba), depois resolve o vertical (bater cabeça/pousar nunca derruba), depois espetos, palavras e poderes.
 * Poderes: Turbo (mais rápido e imune), Escudo (absorve um erro), Pulo triplo e Ímã (ver `powers.ts`). Imune = "fantasma": atravessa blocos e espetos.
 */
export function stepPlayer(level: PreparedLevel, previous: PlayerState, held: boolean): PlayerState {
  if (previous.status !== "running") return previous;
  const p: PlayerState = { ...previous, tick: previous.tick + 1, held, effects: { ...previous.effects } };
  const pressed = held && !previous.held;
  const wasImmune = isImmune(previous.effects);
  const maxAir = MAX_AIR_JUMPS + (p.effects.triple > 0 ? 1 : 0);
  p.airJumps = Math.min(p.airJumps, maxAir);

  while (p.portal < level.portals.length && p.x + PLAYER / 2 >= level.portals[p.portal].x) {
    const form = level.portals[p.portal].form;
    p.portal += 1;
    if (form !== p.form) {
      p.form = form;
      p.grav = 1;
      p.vy = Math.min(p.vy, 4 * T);
      p.grounded = false;
      p.airJumps = maxAir;
      // O Pulo triplo só serve na Corrida: ao virar Voo ou Gravidade ele se apaga.
      if (form !== "RUN") p.effects = { ...p.effects, triple: 0 };
    }
  }

  while (p.checkpoint < level.checkpoints.length && p.x + PLAYER / 2 >= level.checkpoints[p.checkpoint]) p.checkpoint += 1;

  // Para o lado (o Turbo corre mais).
  p.x += p.effects.turbo > 0 ? SPEED * TURBO_SPEED : SPEED;
  const body = (): Rect => toRect(p.x, p.y, PLAYER, PLAYER);
  // `ghost`: imune (ou o Escudo agiu neste passo): não bate em blocos nem em espetos.
  let ghost = isImmune(p.effects);
  /** O Escudo absorve o erro: desliga e dá uma imunidade curta para passar pelo que causou o erro. */
  const absorb = () => {
    if (p.effects.shield <= 0) return false;
    p.effects.shield = 0;
    p.effects.grace = GRACE_TICKS;
    return true;
  };
  if (!ghost) {
    for (const block of nearby(level, p.x, (col) => col.blocks)) {
      const box = body();
      if (!overlaps(box, block)) continue;
      const depthTop = box.b - block.t;
      const depthBottom = block.b - box.t;
      if (Math.min(depthTop, depthBottom) > STEP_UP) {
        if (absorb()) {
          ghost = true;
          break;
        }
        p.status = "dead";
        p.cause = "wall";
        return p;
      }
      if (depthTop <= depthBottom) {
        p.y = block.t - PLAYER;
        if (p.vy > 0) p.vy = 0;
        if (p.grav === 1 && p.form !== "FLY") p.grounded = true;
      } else {
        p.y = block.b;
        if (p.vy < 0) p.vy = 0;
        if (p.grav === -1 && p.form !== "FLY") p.grounded = true;
      }
    }
  }

  // Vertical.
  if (p.form === "RUN") {
    if (p.grounded) p.airJumps = maxAir;
    if (held && p.grounded) {
      p.vy = -JUMP_SPEED;
    } else if (pressed && !p.grounded && p.airJumps > 0) {
      p.vy = -AIR_JUMP_SPEED;
      p.airJumps -= 1;
    }
    p.vy = Math.min(MAX_FALL, p.vy + GRAVITY);
  } else if (p.form === "FLY") {
    p.vy += held ? -FLY_UP : FLY_DOWN;
    p.vy = Math.max(-FLY_MAX_UP, Math.min(FLY_MAX_DOWN, p.vy));
  } else {
    if (pressed && p.grounded) {
      p.grav = p.grav === 1 ? -1 : 1;
      p.vy = p.grav * FLIP_KICK;
    }
    p.vy = Math.max(-FLIP_MAX, Math.min(FLIP_MAX, p.vy + p.grav * FLIP_GRAVITY));
  }
  p.grounded = false;
  p.y += p.vy;
  const canStand = p.form !== "FLY";
  if (p.y + PLAYER > FLOOR_Y) {
    p.y = FLOOR_Y - PLAYER;
    if (p.vy > 0) p.vy = 0;
    if (canStand && p.grav === 1) p.grounded = true;
  }
  if (p.y < CEIL_Y) {
    p.y = CEIL_Y;
    if (p.vy < 0) p.vy = 0;
    if (canStand && p.grav === -1) p.grounded = true;
  }
  if (!ghost) {
    for (const block of nearby(level, p.x, (col) => col.blocks)) {
      const box = body();
      if (!overlaps(box, block)) continue;
      if (p.vy > 0) {
        p.y = block.t - PLAYER;
        p.vy = 0;
        if (canStand && p.grav === 1) p.grounded = true;
      } else if (p.vy < 0) {
        p.y = block.b;
        p.vy = 0;
        if (canStand && p.grav === -1) p.grounded = true;
      }
    }
  }

  // Espetos.
  if (!ghost) {
    const hurt = toRect(p.x + HURT_INSET, p.y + HURT_INSET, PLAYER - HURT_INSET * 2, PLAYER - HURT_INSET * 2);
    for (const spike of nearby(level, p.x, (col) => col.spikes)) {
      if (!overlaps(hurt, spike)) continue;
      // Já imune (o Escudo acabou de agir neste mesmo passo) ou o Escudo absorve agora.
      if (isImmune(p.effects) || absorb()) continue;
      p.status = "dead";
      p.cause = "spike";
      return p;
    }
  }

  // Palavras (o Ímã alcança mais longe) e poderes.
  const reach = p.effects.magnet > 0 ? MAGNET_RANGE : 0;
  const wordBox = reach > 0 ? toRect(p.x - reach, p.y - reach, PLAYER + reach * 2, PLAYER + reach * 2) : body();
  for (const word of nearby(level, p.x - reach, (col) => col.words, PLAYER + reach * 2)) {
    if (overlaps(wordBox, word) && !p.collected.includes(word.index)) p.collected = [...p.collected, word.index];
  }
  const box = body();
  for (const power of nearby(level, p.x, (col) => col.powers)) {
    if (overlaps(box, power) && !p.powers.includes(power.id)) {
      p.powers = [...p.powers, power.id];
      p.effects = applyPower(p.effects, power.power);
    }
  }

  // Os tempos dos poderes passam. Se a imunidade acabou com o personagem dentro de um bloco, ela segue até ele sair (nunca cai por isso).
  const shield = p.effects.shield;
  p.effects = tickEffects(p.effects);
  p.effects.shield = shield;
  if (wasImmune && !isImmune(p.effects)) {
    const inside = body();
    for (const block of nearby(level, p.x, (col) => col.blocks)) {
      if (overlaps(inside, block)) {
        p.effects.grace = 1;
        break;
      }
    }
  }

  if (p.x >= level.endX) p.status = "finished";
  return p;
}

/** O toque está apertado no passo `tick`? `toggles` = passos em que o dedo desce/sobe, em ordem (desce, sobe, desce...). */
export function holdAt(toggles: number[], tick: number): boolean {
  let count = 0;
  for (const at of toggles) {
    if (at > tick) break;
    count += 1;
  }
  return count % 2 === 1;
}

export const MAX_INPUTS = 4000;

/** Confere a lista de toques que veio do cliente: inteiros crescentes dentro do tempo da partida. `null` = inválida. */
export function normalizeInputs(raw: unknown, maxTicks: number): number[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_INPUTS) return null;
  let last = -1;
  for (const value of raw) {
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > maxTicks || value <= last) return null;
    last = value;
  }
  return raw as number[];
}

/** Tempo máximo de uma partida: o necessário para correr a fase inteira mais uma folga. */
export function maxTicksOf(level: PreparedLevel): number {
  return Math.ceil(level.endX / SPEED) + 600;
}

export function progressOf(level: PreparedLevel, player: PlayerState): number {
  return Math.max(0, Math.min(1, player.x / level.endX));
}

/** Roda a partida inteira a partir da lista de toques. É o que o servidor repete para conferir o resultado. */
export function simulate(level: PreparedLevel, toggles: number[], maxTicks = maxTicksOf(level)): RunResult {
  let player = newPlayer(level);
  let next = 0;
  let held = false;
  for (let tick = 0; tick < maxTicks && player.status === "running"; tick += 1) {
    while (next < toggles.length && toggles[next] <= tick) {
      held = !held;
      next += 1;
    }
    player = stepPlayer(level, player, held);
  }
  return {
    status: player.status === "running" ? "timeout" : player.status,
    ticks: player.tick,
    progress: progressOf(level, player),
    collected: [...player.collected].sort((a, b) => a - b),
    powers: [...player.powers].sort((a, b) => a - b),
    cause: player.cause,
  };
}
