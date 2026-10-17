import { flySplit, FLY_SPLIT, gravityLane, GRAVITY_LANE, gravitySlab, GRAVITY_SLAB, runFork, RUN_FORK } from "./forks";
import { POWER_KINDS, POWERS_BY_FORM, type PowerKind } from "./powers";
import { between, randomFrom, type Random } from "./rng";
import { gap, portal } from "./segments";
import { ROWS, SPEED, TICKS_PER_SECOND, TILE, type Form, type Level, type LevelObject, type LevelStyle, type Verse } from "./types";

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
  /** Estilo da fase (muda os pesos dos obstáculos; padrão: clássica). */
  style?: LevelStyle;
};

/**
 * O que os trechos precisam saber: sorteio, dificuldade (0 = bem fácil, 1 = a mais difícil do cenário), se há bifurcações e de onde vem o próximo poder
 * (`null` se a fase não tem poderes).
 */
type Context = { random: Random; difficulty: number; speed: number; style: LevelStyle; forks: boolean; nextPower: (form: Form) => PowerKind | null };

/** Distância entre checkpoints, em segundos de corrida (a fase tem uma bandeira a cada ~12 s). */
const CHECKPOINT_SECONDS = 12;

/** Quanto dura cada tipo de trecho, em segundos (varia um pouco por sorteio). */
const SECTION_SECONDS: Record<Form, number> = { RUN: 26, FLY: 18, GRAVITY: 22 };

/** Chance de um respiro/portão trazer poder: poucos poderes, para cada um valer a pena. */
const POWER_CHANCE = { rest: 0.4, flyGate: 0.1, fork: 0.7, lane: 0.6 } as const;

/**
 * Multiplicadores de peso de cada estilo (o que não aparece vale 1; 0 tira o obstáculo). Os obstáculos novos só entram nos estilos que os usam,
 * e a fase clássica fica só com o básico.
 */
const NEW_KINDS = ["sawGauntlet", "spikeStairs", "lowRoof", "rhythm3", "pitTrain", "slalom", "teeth", "sweepers", "slalom5", "sawSurface", "pitRush", "teethRow"];
const STYLE_MULT: Record<LevelStyle, Record<string, number>> = {
  CLASSIC: { ...Object.fromEntries(NEW_KINDS.map((kind) => [kind, 0])), pitPair: 0.3, sawBridge: 0.3, hopTrain: 0.5, rush: 0.2, sawMid: 0.4, zigzag: 0.3 },
  SPIKES: { spikes: 2.5, twoSpikes: 3, pitSpike: 3, spikeStairs: 4, rhythm3: 3, teeth: 4, spike: 2, teethRow: 3, saw: 0.3, sawBridge: 0.3, sawGates: 0.4, sawMid: 0.3, pit: 0.6 },
  SAWS: { saw: 3, sawBridge: 4, sawGauntlet: 5, sawGates: 4, sweepers: 4, sawMid: 4, sawSurface: 4, spikes: 0.4, twoSpikes: 0.4, spike: 0.4, pit: 0.5 },
  PITS: { pit: 3, pitPair: 4, pitSpike: 3, pitTrain: 5, pitRush: 5, saw: 0.4, spikes: 0.6, sawGates: 0.5 },
  PLATFORMS: { block: 2.5, stairs: 3, ladder: 4, hopTrain: 4, blockSpike: 3, blockSpikes: 4, spikeStairs: 4, lowRoof: 5, wall: 3, slalom5: 3, pit: 0.4, saw: 0.4, spikes: 0.5 },
  RUSH: { rhythm3: 5, rush: 4, zigzag: 3, slalom: 4, slalom5: 5, twoSpikes: 3, pitTrain: 3, sawGauntlet: 3, rest: 0.1, block: 0.4 },
  SKY: { steps: 2.5, sawGates: 3, zigzag: 3, slalom: 4, teeth: 4, sweepers: 4, split: 2, gates: 0.7, spikes: 0.7, block: 0.7 },
  FLIP: { rush: 3, wall: 3, sawMid: 3, teethRow: 4, slalom5: 4, pitRush: 4, pit: 2, spikePair: 2.5, sawSurface: 2, spike: 0.6, lane: 1.5, slab: 1.5 },
  WILD: { ...Object.fromEntries(NEW_KINDS.map((kind) => [kind, 2.5])), spikes: 0.5, block: 0.4, rest: 0.1, spike: 0.4 },
  FINALE: { ...Object.fromEntries(NEW_KINDS.map((kind) => [kind, 1.8])), pitPair: 2, ladder: 2, blockSpikes: 2, sawBridge: 2, rush: 2, zigzag: 2, sawMid: 2, rest: 0.1, fork: 1.3 },
};

/** Aplica o estilo da fase aos pesos de uma lista de obstáculos. */
const styled = <T extends string>(ctx: Context, items: Array<[T, number]>): Array<[T, number]> => items.map(([item, weight]) => [item, weight * (STYLE_MULT[ctx.style][item] ?? 1)]);

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

type RunKind = "sawGauntlet" | "spikeStairs" | "lowRoof" | "rhythm3" | "pitTrain" | "spikes" | "block" | "stairs" | "blockSpike" | "twoSpikes" | "pit" | "pitPair" | "ladder" | "fork" | "rest" | "saw" | "sawBridge" | "hopTrain" | "pitSpike" | "blockSpikes";

/** Respiro entre obstáculos: encurta de leve com a dificuldade (nunca abaixo de 5 colunas, para o toque atrasado caber). */
const breath = (ctx: Context, low: number, high: number) => between(ctx.random, Math.round(low - ctx.difficulty), Math.round(high - 2 * ctx.difficulty));

/** Respiro em colunas que mantém o TEMPO (virar a gravidade, mudar o vão do voo) quando a fase é mais rápida: mais colunas na mesma proporção da velocidade. */
const breathAt = (ctx: Context, low: number, high: number) => Math.round(breath(ctx, low, high) * ctx.speed);

/**
 * Trechos de corrida: sequência de obstáculos com respiro entre eles. Cada trecho pode oferecer um lugar para uma palavra
 * (`carriers`); as palavras do versículo são distribuídas depois, uniformemente, nos lugares oferecidos. Os pesos mudam com a dificuldade:
 * no começo só há espetos, serras no chão e blocos; depois entram degraus, buracos, pares de buracos, escadas, trens de blocos, serras no ar e combos.
 */
function runPattern(objects: LevelObject[], carriers: Carrier[], x: number, ctx: Context, remaining: number): number {
  const { random, difficulty: d } = ctx;
  const forkLength = RUN_FORK.stairs + RUN_FORK.gap + RUN_FORK.length + RUN_FORK.tail;
  const kind = weighted<RunKind>(random, styled(ctx, [
    ["spikes", 20 - 8 * d],
    ["saw", 8 + 2 * d],
    ["block", 16 - 6 * d],
    ["stairs", 6 + 5 * d],
    ["blockSpike", 8 + 6 * d],
    ["twoSpikes", 3 + 8 * d],
    ["pit", 3 + 12 * d],
    ["pitPair", d > 0.45 ? 10 * d : 0],
    ["ladder", d > 0.3 ? 8 * d : 0],
    ["hopTrain", d > 0.2 ? 4 + 8 * d : 0],
    ["sawBridge", d > 0.25 ? 4 + 9 * d : 0],
    ["pitSpike", d > 0.4 ? 10 * d : 0],
    ["blockSpikes", d > 0.5 ? 10 * d : 0],
    ["fork", ctx.forks && remaining >= forkLength ? 11 : 0],
    ["rest", 5 - 3 * d],
    // Obstáculos novos (só entram nos estilos que os pedem).
    ["sawGauntlet", d > 0.3 ? 2 + 4 * d : 0],
    ["spikeStairs", d > 0.3 ? 2 + 5 * d : 0],
    ["lowRoof", d > 0.25 ? 2 + 4 * d : 0],
    ["rhythm3", d > 0.35 ? 2 + 5 * d : 0],
    ["pitTrain", d > 0.5 ? 2 + 6 * d : 0],
  ]));
  switch (kind) {
    case "spikes": {
      // Até 2 espetos: com 3 o pulo simples sobra só ~5 passos de folga (só o pulo duplo salva), apertado demais para o toque de gente.
      const count = between(random, 1, 2);
      carriers.push({ x: x + Math.floor(count / 2), y: 2 });
      for (let index = 0; index < count; index += 1) objects.push({ kind: "spike", x: x + index });
      return x + count + breathAt(ctx, 6, 9);
    }
    case "saw":
      // Serra no chão (uma, às vezes duas coladas de 2 em 2 colunas não: uma só, ou duas com 8 colunas): é pular na hora.
      objects.push({ kind: "saw", x, y: 0 });
      carriers.push({ x, y: 2 });
      if (d > 0.35 && random() < 0.5) {
        objects.push({ kind: "saw", x: x + 8, y: 0 });
        return x + 9 + breathAt(ctx, 6, 8);
      }
      return x + 1 + breathAt(ctx, 6, 9);
    case "block": {
      const width = between(random, 4, 6);
      objects.push({ kind: "block", x, y: 0, w: width, h: 1 });
      carriers.push({ x: x + Math.floor(width / 2), y: 1 });
      return x + width + breathAt(ctx, 6, 8);
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
    case "blockSpikes":
      // Bloco comprido com dois espetos em cima: pousa, pula o 1º, pousa de novo e pula o 2º.
      objects.push({ kind: "block", x, y: 0, w: 20, h: 1 }, { kind: "spike", x: x + 8, y: 1 }, { kind: "spike", x: x + 16, y: 1 });
      return x + 20 + 6;
    case "twoSpikes":
      objects.push({ kind: "spike", x }, { kind: "spike", x: x + 8 });
      return x + 9 + 7;
    case "pit": {
      // Buraco no chão: pular antes da borda (2 a 3 colunas no começo, 3 a 4 mais adiante).
      const width = between(random, d < 0.5 ? 2 : 3, d < 0.5 ? 3 : 4);
      objects.push({ kind: "pit", x, w: width, side: "floor" });
      carriers.push({ x: x + Math.floor(width / 2), y: 3 });
      return x + width + breathAt(ctx, 7, 9);
    }
    case "pitPair":
      // Dois buracos separados por um pedaço de chão para pousar e pular de novo.
      objects.push({ kind: "pit", x, w: 3, side: "floor" }, { kind: "pit", x: x + 3 + 6, w: 3, side: "floor" });
      return x + 3 + 6 + 3 + 7;
    case "pitSpike":
      // Buraco e, logo depois de pousar, um espeto: dois pulos seguidos com chão de sobra para o segundo.
      objects.push({ kind: "pit", x, w: 3, side: "floor" }, { kind: "spike", x: x + 3 + 8 });
      return x + 3 + 8 + 1 + 7;
    case "ladder":
      // Escada que sobe, desce e termina num espeto: pousa em cada degrau antes de saltar para o seguinte.
      objects.push({ kind: "block", x, y: 0, w: 5, h: 1 }, { kind: "block", x: x + 5, y: 0, w: 5, h: 2 }, { kind: "block", x: x + 10, y: 0, w: 5, h: 1 }, { kind: "spike", x: x + 17 });
      carriers.push({ x: x + 7, y: 2 });
      return x + 17 + 1 + 7;
    case "hopTrain":
      // Três blocos baixos em fila, com 4 colunas de chão entre eles: pula um por um (ou pousa em cima e segue).
      for (let index = 0; index < 3; index += 1) objects.push({ kind: "block", x: x + index * 8, y: 0, w: 4, h: 1 });
      carriers.push({ x: x + 10, y: 2 });
      return x + 3 * 8 + 4;
    case "sawBridge":
      // Espeto no chão e, mais adiante, uma serra no ar na altura de um pulo: pula o espeto, pousa e passa por baixo da serra SEM pular.
      objects.push({ kind: "spike", x }, { kind: "saw", x: x + 11, y: 2, ...(d > 0.6 ? { amp: 0.4, period: 10 } : {}) });
      carriers.push({ x, y: 2 });
      return x + 11 + 1 + breathAt(ctx, 6, 8);
    case "sawGauntlet":
      // Três serras no chão, uma a cada 9 colunas: pula, pousa, pula, pousa, pula.
      for (let index = 0; index < 3; index += 1) objects.push({ kind: "saw", x: x + index * 9, y: 0 });
      carriers.push({ x, y: 2 });
      return x + 18 + 1 + breathAt(ctx, 6, 8);
    case "spikeStairs":
      // Dois degraus compridos, cada um com um espeto em cima: pousa, pula o espeto, sobe o degrau seguinte e pula o outro.
      objects.push({ kind: "block", x, y: 0, w: 14, h: 1 }, { kind: "spike", x: x + 3, y: 1 }, { kind: "block", x: x + 14, y: 0, w: 11, h: 2 }, { kind: "spike", x: x + 19, y: 2 });
      return x + 25 + 6;
    case "lowRoof":
      // Caverna: um teto de blocos com espetos pendurados e espetos no chão em outros lugares. Pula só onde há espeto no chão.
      objects.push({ kind: "block", x, y: 3, w: 20, h: 1 }, { kind: "spike", x: x + 4 }, { kind: "spike", x: x + 8, y: 2, down: true }, { kind: "spike", x: x + 14 }, { kind: "spike", x: x + 18, y: 2, down: true });
      return x + 20 + 6;
    case "rhythm3":
      // Espeto, serra e espeto de 8 em 8 colunas: um ritmo de três pulos.
      objects.push({ kind: "spike", x }, { kind: "saw", x: x + 8, y: 0 }, { kind: "spike", x: x + 16 });
      carriers.push({ x, y: 2 });
      return x + 17 + breathAt(ctx, 6, 8);
    case "pitTrain":
      // Três buracos de 3 colunas, com 7 colunas de chão entre eles.
      for (let index = 0; index < 3; index += 1) objects.push({ kind: "pit", x: x + index * 10, w: 3, side: "floor" });
      return x + 3 * 10 + 4;
    case "fork": {
      // Bifurcação: degraus levam a uma laje (caminho de cima, com recompensas) ou segue-se por baixo (seguro).
      const power = random() < POWER_CHANCE.fork ? ctx.nextPower("RUN") : null;
      const info = runFork(objects, x, power, random() < 0.3 + 0.3 * d ? "PIT" : "SPIKES");
      // As palavras do versículo ficam só no chão livre (o caminho de risco dá o poder: palavra lá poderia ficar fora do alcance de quem vai pelo seguro).
      // A palavra fica no chão depois da laje (quem foi por cima já pousou) e longe do próximo obstáculo (com a fase mais rápida o pulo começa mais cedo).
      carriers.push({ x: info.end - 1, y: 0 });
      return info.end + 6;
    }
    default: {
      // Respiro, às vezes com um poder no chão (se a fase tem poderes).
      const power = random() < POWER_CHANCE.rest ? ctx.nextPower("RUN") : null;
      if (power) objects.push({ kind: "power", x: x + 3, y: 0, power });
      return x + 8;
    }
  }
}

type FlyKind = "gates" | "steps" | "sawGates" | "zigzag" | "split" | "slalom" | "teeth" | "sweepers";

/**
 * Trecho de voo. Tocar em qualquer bloco, espeto ou serra derruba (só o chão e o teto do campo são seguros). Cada trecho de ~5 portões sorteia um desenho:
 * portões comuns (o vão anda no máximo 1 linha por passagem), escada (o vão sobe e desce em sequência), portões de serras (como os blocos, mas serras
 * girando, às vezes subindo e descendo juntas), zigue-zague (vão que muda de lado, só mais adiante) e o voo dividido (dois corredores).
 */
function flySection(objects: LevelObject[], carriers: Carrier[], x: number, length: number, ctx: Context, minGap: number, mark: (nextObstacleX: number) => void): number {
  const { random, difficulty: d } = ctx;
  let floor = 1;
  let ceil = 1;
  let cursor = x;
  const end = x + length;
  const room = ROWS - minGap;
  /** Portão de blocos: `floor` linhas embaixo e `ceil` em cima. */
  const blockGate = (at: number) => {
    if (floor > 0) objects.push({ kind: "block", x: at, y: 0, w: 2, h: floor });
    if (ceil > 0) objects.push({ kind: "block", x: at, y: ROWS - ceil, w: 2, h: ceil });
  };
  /** Portão de serras: uma serra na primeira linha do vão (embaixo) e outra na última (em cima); as duas sobem e descem juntas, então o vão não aperta. */
  const sawGate = (at: number, bob: boolean) => {
    const wave = bob ? { amp: 0.5, period: 12 } : {};
    objects.push({ kind: "saw", x: at, y: floor, ...wave }, { kind: "saw", x: at, y: ROWS - ceil - 1, ...wave });
  };
  const place = (at: number, mode: "blocks" | "saws", bob = false) => {
    if (mode === "blocks") blockGate(at);
    else sawGate(at, bob);
    // Palavra bem no meio do vão (entre as serras, a meia-linha, quando o vão é par).
    const centre = mode === "saws" ? (floor + ROWS - ceil - 1) / 2 : floor + Math.floor((ROWS - floor - ceil) / 2);
    carriers.push({ x: at, y: centre });
    // De vez em quando um poder no meio do vão (na 2ª coluna do portão).
    if (random() < POWER_CHANCE.flyGate) {
      const power = ctx.nextPower("FLY");
      if (power) objects.push({ kind: "power", x: at + 1, y: centre, power });
    }
  };
  while (cursor < end) {
    const left = end - cursor;
    const kind = weighted<FlyKind>(random, styled(ctx, [
      ["gates", 30 - 10 * d],
      ["steps", 14],
      ["sawGates", 10 + 12 * d],
      ["zigzag", d > 0.4 ? 10 * d : 0],
      ["split", ctx.forks && left >= FLY_SPLIT.lead + FLY_SPLIT.length + FLY_SPLIT.tail + 6 ? 12 : 0],
      ["slalom", d > 0.25 ? 4 + 8 * d : 0],
      ["teeth", d > 0.15 ? 4 + 4 * d : 0],
      ["sweepers", d > 0.45 ? 8 * d : 0],
    ]));
    if (kind === "split") {
      const info = flySplit(objects, cursor, random() < POWER_CHANCE.fork ? ctx.nextPower("FLY") : null);
      // O vão antes do próximo trecho volta a ser o do meio.
      floor = 1;
      ceil = 1;
      cursor = info.end + between(random, 4, 6);
      mark(cursor);
      continue;
    }
    // Antes de cada desenho novo, um portão com o vão no meio: a troca de um desenho para o outro nunca pede um salto grande de altura.
    if (cursor > x) {
      floor = 1;
      ceil = 1;
      place(cursor, "blocks");
      cursor += 2 + breathAt(ctx, 5, 6);
      mark(cursor);
    }
    if (kind === "slalom") {
      // Slalom: blocos soltos, um do chão e um do teto em alternância (3 colunas de largura): o personagem balança de um lado para o outro.
      const height = 3;
      const width = d > 0.7 ? 4 : 3;
      const count = between(random, 4, 6);
      for (let index = 0; index < count && cursor < end; index += 1) {
        const fromFloor = index % 2 === 0;
        objects.push(fromFloor ? { kind: "block", x: cursor, y: 0, w: width, h: height } : { kind: "block", x: cursor, y: ROWS - height, w: width, h: height });
        carriers.push({ x: cursor + 1, y: fromFloor ? (height + ROWS - 1) / 2 : (ROWS - height - 1) / 2 });
        cursor += width + breathAt(ctx, 6, 8);
        mark(cursor);
      }
      cursor += 3;
      mark(cursor);
      continue;
    }
    if (kind === "teeth") {
      // Túnel de dentes: espetos no chão e no teto, alternados; voando pelo meio nada acontece, mas quem desce ou sobe demais é pego.
      for (let index = 0; index < 4; index += 1) objects.push(index % 2 === 0 ? { kind: "spike", x: cursor + 2 + index * 3 } : { kind: "spike", x: cursor + 2 + index * 3, y: ROWS - 1, down: true });
      carriers.push({ x: cursor + 4, y: 3 }, { x: cursor + 10, y: 3 });
      cursor += 15 + breathAt(ctx, 5, 6);
      mark(cursor);
      continue;
    }
    if (kind === "sweepers") {
      // Três serras que varrem o campo de cima a baixo (a onda depende de onde o jogador está): passa-se onde a serra não está.
      for (let index = 0; index < 3; index += 1) objects.push({ kind: "saw", x: cursor + index * 8, y: 3, amp: 1.5, period: 12 + index * 2 });
      cursor += 3 * 8 + breathAt(ctx, 5, 6);
      mark(cursor);
      continue;
    }
    const gates = between(random, 4, 6);
    const mode = kind === "sawGates" ? "saws" : "blocks";
    // Nos portões de serras elas ficam dentro do vão (uma em cada ponta): o vão precisa de 2 linhas a mais: sobra folga para pegar a palavra no meio sem arriscar.
    const limit = mode === "saws" ? room - 2 : room;
    const bob = kind === "sawGates" && d > 0.5 && random() < 0.6;
    let direction = random() < 0.5 ? 1 : -1;
    for (let index = 0; index < gates && cursor < end; index += 1) {
      if (kind === "steps") {
        // A escada: o vão anda sempre para o mesmo lado e vira quando chega no limite.
        if (floor + direction < 0 || floor + direction > limit) direction = -direction;
        floor = Math.max(0, Math.min(limit, floor + direction));
        ceil = Math.max(0, Math.min(limit - floor, 1));
      } else if (kind === "zigzag") {
        // Zigue-zague: o vão pula para o outro lado (no máximo 3 linhas) a cada portão, com mais espaço entre eles.
        floor = Math.max(0, index % 2 === 0 ? 0 : limit - 1);
        ceil = Math.max(0, limit - floor);
      } else {
        floor = Math.max(0, Math.min(limit, floor + between(random, -1, 1)));
        ceil = Math.max(0, Math.min(limit - floor, ceil + between(random, -1, 1)));
      }
      place(cursor, mode, bob);
      cursor += 2 + (kind === "zigzag" ? breathAt(ctx, 9, 10) : breathAt(ctx, 5, 6));
      mark(cursor);
    }
    // Entre um desenho e o seguinte, um pouco de respiro (o vão fica no meio).
    floor = 1;
    ceil = 1;
    cursor += 3;
    mark(cursor);
  }
  return cursor;
}

type GravityKind = "spike" | "pit" | "lane" | "slab" | "wall" | "sawMid" | "rush" | "spikePair" | "slalom5" | "sawSurface" | "pitRush" | "teethRow";

/**
 * Trecho de gravidade: espetos no chão e no teto (quem passa inverte a gravidade quando o espeto está do lado onde está), buracos no chão ou no teto
 * (é preciso estar do lado oposto ao passar), paredes de bloco (idem), serras no meio do campo (não se pode virar enquanto passa por elas), sequências rápidas,
 * pistas de recompensa e lajes que abrem dois corredores. `side` é o lado em que o jogador está.
 */
function gravitySection(objects: LevelObject[], carriers: Carrier[], x: number, length: number, ctx: Context, mark: (nextObstacleX: number) => void): number {
  const { random, difficulty: d } = ctx;
  let cursor = x;
  let side: "floor" | "ceiling" = "floor";
  const end = x + length;
  const spikeOn = (at: number, onSide: "floor" | "ceiling"): LevelObject => (onSide === "floor" ? { kind: "spike", x: at } : { kind: "spike", x: at, y: ROWS - 1, down: true });
  const other = () => (side === "floor" ? "ceiling" : "floor");
  /** Palavra logo depois de um obstáculo, na superfície em que o jogador fica depois de virar (ele passa ali, nunca no meio de uma virada). */
  const carry = (at: number) => carriers.push({ x: at, y: side === "floor" ? 0 : ROWS - 1 });
  while (cursor < end) {
    const room = end - cursor;
    const kind = weighted<GravityKind>(random, styled(ctx, [
      ["spike", 36 - 14 * d],
      ["pit", 8 + 22 * d],
      ["wall", 14 + 8 * d],
      ["spikePair", d > 0.25 ? 6 + 10 * d : 0],
      ["sawMid", d > 0.2 ? 6 + 12 * d : 0],
      ["rush", d > 0.5 && room >= 28 ? 14 * d : 0],
      ["lane", ctx.forks && room >= GRAVITY_LANE.length + 6 ? 14 : 0],
      ["slab", ctx.forks && room >= GRAVITY_SLAB.lead + GRAVITY_SLAB.length + GRAVITY_SLAB.tail + 6 ? 10 : 0],
    
      ["slalom5", d > 0.3 && room >= 50 ? 3 + 8 * d : 0],
      ["sawSurface", d > 0.1 ? 4 + 6 * d : 0],
      ["pitRush", d > 0.5 && room >= 40 ? 10 * d : 0],
      ["teethRow", d > 0.3 ? 3 + 7 * d : 0],
    ]));
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
      carry(cursor + width + 3);
      cursor += width + breathAt(ctx, 8, 10);
      side = other();
      carriers[carriers.length - 1].y = side === "floor" ? 0 : ROWS - 1;
      mark(cursor);
      continue;
    }
    if (kind === "wall") {
      // Parede de bloco (1 a 2 linhas) do lado em que o jogador está: bater de frente derruba, então ele vira antes.
      objects.push(side === "floor" ? { kind: "block", x: cursor, y: 0, w: 2, h: between(random, 1, 2) } : { kind: "block", x: cursor, y: ROWS - 2, w: 2, h: 2 });
      side = other();
      carry(cursor + 5);
      cursor += 2 + breathAt(ctx, 8, 10);
      mark(cursor);
      continue;
    }
    if (kind === "spikePair") {
      // Dois espetos juntos do lado do jogador: ele vira e fica do outro lado.
      objects.push(spikeOn(cursor, side), spikeOn(cursor + 1, side));
      side = other();
      carry(cursor + 5);
      cursor += 2 + breathAt(ctx, 8, 10);
      mark(cursor);
      continue;
    }
    if (kind === "sawMid") {
      // Serra no meio do campo (às vezes subindo e descendo): não se pode virar enquanto passa por ela. Depois, um espeto obriga a virar.
      objects.push({ kind: "saw", x: cursor, y: 3, ...(d > 0.45 && random() < 0.6 ? { amp: 1.5, period: 14 } : {}) });
      const at = cursor + Math.round(10 * ctx.speed);
      objects.push(spikeOn(at, side));
      side = other();
      carry(at + 4);
      cursor = at + 1 + breathAt(ctx, 8, 10);
      mark(cursor);
      continue;
    }
    if (kind === "rush") {
      // Três obstáculos seguidos, cada um do lado oposto ao anterior: vira, vira, vira (7 colunas entre eles).
      for (let index = 0; index < 3; index += 1) {
        objects.push(index % 2 === 0 ? spikeOn(cursor, side) : { kind: "block", x: cursor, y: side === "floor" ? 0 : ROWS - 1, w: 2, h: 1 });
        side = other();
        cursor += Math.round(7 * ctx.speed);
      }
      cursor += breathAt(ctx, 5, 7);
      mark(cursor);
      continue;
    }
    if (kind === "slalom5") {
      // Cinco paredes de bloco seguidas, cada uma do lado em que o jogador está: vira, vira, vira, vira, vira.
      for (let index = 0; index < 5; index += 1) {
        objects.push(side === "floor" ? { kind: "block", x: cursor, y: 0, w: 2, h: 2 } : { kind: "block", x: cursor, y: ROWS - 2, w: 2, h: 2 });
        side = other();
        if (index === 1) carry(cursor + Math.round(4 * ctx.speed));
        cursor += Math.round(8 * ctx.speed);
      }
      cursor += breathAt(ctx, 3, 4);
      mark(cursor);
      continue;
    }
    if (kind === "pitRush") {
      // Três buracos em fila, cada um do lado em que o jogador está: ele vira antes de cada um.
      for (let index = 0; index < 3; index += 1) {
        objects.push({ kind: "pit", x: cursor, w: 3, side });
        side = other();
        cursor += 3 + Math.round(9 * ctx.speed);
      }
      cursor += breathAt(ctx, 2, 3);
      mark(cursor);
      continue;
    }
    if (kind === "teethRow") {
      // Fileira de 4 espetos na superfície OPOSTA à do jogador: não pode virar enquanto passa. Depois, um espeto do lado dele obriga a virar.
      const opposite = other();
      for (let index = 0; index < 4; index += 1) objects.push(spikeOn(cursor + index * 3, opposite));
      const at = cursor + 9 + Math.round(10 * ctx.speed);
      objects.push(spikeOn(at, side));
      carry(cursor + 5);
      side = other();
      cursor = at + 1 + breathAt(ctx, 8, 10);
      mark(cursor);
      continue;
    }
    // Espeto: na maioria das vezes do lado em que o jogador está (ele precisa virar); às vezes do outro (ele só segue).
    const spikeSide = random() < 0.65 ? side : other();
    objects.push(kind === "sawSurface" ? { kind: "saw", x: cursor, y: spikeSide === "floor" ? 0 : ROWS - 1 } : spikeOn(cursor, spikeSide));
    side = spikeSide === "floor" ? "ceiling" : "floor";
    carry(cursor + 4);
    cursor += breathAt(ctx, 7, 9);
    mark(cursor);
  }
  return cursor;
}

/** Velocidade da fase pela dificuldade: de 1,00 (fácil) a 1,25 (a mais difícil). */
export const speedFor = (difficulty: number) => 1 + 0.25 * Math.max(0, Math.min(1, difficulty));

/** Duração da fase em segundos de jogo (considera a velocidade dela). */
export const levelSeconds = (level: Pick<Level, "length" | "speed">) => level.length / (TILES_PER_SECOND * (level.speed ?? 1));

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
  const speed = speedFor(difficulty);
  // Colunas por segundo de jogo: com a velocidade maior, a mesma duração pede uma fase mais comprida.
  const tps = TILES_PER_SECOND * speed;
  const ctx: Context = { random, difficulty, speed, style: options.style ?? "CLASSIC", forks: useForks, nextPower: (form) => {
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
    if (nextObstacleX - lastCheckpoint >= CHECKPOINT_SECONDS * tps) {
      lastCheckpoint = nextObstacleX - 3;
      objects.push({ kind: "checkpoint", x: lastCheckpoint });
    }
  };
  let form: Form = "RUN";
  let sectionIndex = 0;
  const target = options.seconds * tps;
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
    const length = Math.round(SECTION_SECONDS[form] * tps * (0.8 + random() * 0.4));
    const end = x + length;
    if (form === "RUN") {
      while (x < end) {
        x = runPattern(objects, carriers, x, ctx, end - x);
        mark(x);
      }
    } else if (form === "FLY") {
      x = flySection(objects, carriers, x, length, ctx, options.flyGap ?? (difficulty > 0.8 ? 3 : 4), mark);
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
  return { id: options.id, name: options.name, verse: options.verse, form: firstForm === "RUN" ? "RUN" : firstForm, length: x, objects, speed: Number(speed.toFixed(3)) };
}
