import type { Effects, PowerKind } from "./powers";

/**
 * Modo Corrida: tipos e constantes do motor. Tudo em pixels do "mundo" (a tela só escala), passo de tempo fixo de 60 por segundo.
 * O campo tem 7 linhas de 40 px: o chão fica em `FLOOR_Y` e o teto em `CEIL_Y`.
 */
export const TICKS_PER_SECOND = 60;
export const TILE = 40;
export const ROWS = 7;
export const FLOOR_Y = 320;
export const CEIL_Y = FLOOR_Y - ROWS * TILE;
export const PLAYER = 32;
/**
 * Escala de tempo da física: 1 = ritmo rápido original, menor = mais devagar. Velocidade, gravidade e pulos mudam juntos,
 * então a geometria dos saltos (quantas colunas e linhas o pulo alcança) continua a mesma. É o botão para ajustar o ritmo.
 */
export const TIME_SCALE = 0.72;
/** Velocidade horizontal (px por passo): todos os personagens correm igual. */
export const SPEED = 5.4 * TIME_SCALE;

/** Forma do personagem no trecho: quem decide é a fase (portais), nunca o personagem. */
export type Form = "RUN" | "FLY" | "GRAVITY";

/** Espeto no chão (`y` = linha de baixo, 0 = chão). `down` pendura do teto/bloco apontando para baixo. */
export type SpikeObject = { kind: "spike"; x: number; y?: number; down?: boolean };
/** Bloco sólido (em linhas e colunas): dá para pousar em cima; bater de lado derruba. */
export type BlockObject = { kind: "block"; x: number; y: number; w: number; h: number };
/** Portal: a partir daqui o personagem passa a ter a forma indicada. */
export type PortalObject = { kind: "portal"; x: number; form: Form };
/** Palavra do versículo escondido (`index` = posição no versículo). */
export type WordObject = { kind: "word"; x: number; y: number; index: number };
/** Checkpoint: bandeira num trecho livre; quem cai pode voltar a ela. Fica sempre a ~3 colunas ou mais do próximo obstáculo. */
export type CheckpointObject = { kind: "checkpoint"; x: number };
/** Poder no meio do caminho (Turbo, Escudo, Pulo triplo ou Ímã): some quando pego. `y` = linha (0 = chão). */
export type PowerObject = { kind: "power"; x: number; y: number; power: PowerKind };
export type LevelObject = SpikeObject | BlockObject | PortalObject | WordObject | CheckpointObject | PowerObject;

/** Versículo escondido da fase: cada palavra coletada (`index`) aparece no lugar dele. */
export type Verse = { ref: string; words: string[] };

export type Level = {
  id: string;
  name: string;
  verse?: Verse;
  /** Forma no começo da fase. */
  form: Form;
  /** Comprimento em colunas: ao chegar ao fim a fase termina. */
  length: number;
  objects: LevelObject[];
};

export type Rect = { l: number; t: number; r: number; b: number };

/** Fase pronta para simular: objetos indexados por coluna (a busca a cada passo é O(1)). */
export type PreparedLevel = {
  level: Level;
  endX: number;
  portals: Array<{ x: number; form: Form }>;
  /** Posição (px) de cada checkpoint, em ordem. */
  checkpoints: number[];
  cols: Array<{ spikes: Rect[]; blocks: Rect[]; words: Array<Rect & { index: number }>; powers: Array<Rect & { id: number; power: PowerKind }> }>;
  wordCount: number;
  /** Quantos poderes a fase tem (os `id` vão de 0 a `powerCount - 1`, na ordem da lista de objetos). */
  powerCount: number;
};

export type PlayerStatus = "running" | "dead" | "finished";
export type DeathCause = "spike" | "wall";

/** Estado de um corredor: simples e serializável (vai e volta do servidor e do navegador). */
export type PlayerState = {
  tick: number;
  x: number;
  y: number;
  vy: number;
  /** 1 = cai para o chão; -1 = cai para o teto (forma Gravidade). */
  grav: 1 | -1;
  form: Form;
  grounded: boolean;
  /** Pulos extras que ainda restam no ar (forma Corrida): volta ao máximo ao pousar. */
  airJumps: number;
  /** O toque estava apertado no passo anterior (para detectar o instante do toque). */
  held: boolean;
  /** Próximo portal a cruzar. */
  portal: number;
  /** Quantos checkpoints já foram cruzados. */
  checkpoint: number;
  status: PlayerStatus;
  cause: DeathCause | null;
  collected: number[];
  /** Poderes já pegos (`id` na fase): não aparecem de novo. */
  powers: number[];
  /** Efeitos ativos dos poderes. */
  effects: Effects;
};

export type RunResult = {
  status: PlayerStatus | "timeout";
  ticks: number;
  progress: number;
  collected: number[];
  powers: number[];
  cause: DeathCause | null;
};
