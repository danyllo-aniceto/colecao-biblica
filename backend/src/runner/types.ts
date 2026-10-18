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
/**
 * Buraco no chão ou no teto (`side`), de `x` a `x + w` colunas: quem passa por cima sem estar no ar (corrida), do outro lado (gravidade) ou fora do
 * buraco cai e morre. O corpo só fica sem apoio quando está INTEIRO dentro do buraco (por isso a largura é de pelo menos 3 colunas).
 */
export type PitObject = { kind: "pit"; x: number; w: number; side: "floor" | "ceiling" };
/**
 * Serra giratória (como as do Geometry Dash e do G-Switch): hazard redondo no meio do campo, mata ao encostar. `y` = linha do centro (0 = chão; pode ser
 * fracionário). Com `amp` (em linhas) ela sobe e desce: a altura depende de ONDE o jogador está (`sawCentreY`), não do relógio, então a fase continua
 * igual em qualquer retomada/conferência. `period` = comprimento da onda em colunas.
 */
export type SawObject = { kind: "saw"; x: number; y: number; amp?: number; period?: number };
export type LevelObject = SpikeObject | BlockObject | PortalObject | WordObject | CheckpointObject | PowerObject | PitObject | SawObject;

/** Versículo escondido da fase: cada palavra coletada (`index`) aparece no lugar dele. */
export type Verse = { ref: string; words: string[] };

/** Imagens do cenário (todas opcionais): três camadas de fundo (longe, meio, perto; repetem na horizontal) e a figura do espeto e do bloco. */
/** `cover` é só a capa do cartão do cenário (não entra na fase). */
export const ART_KEYS = ["far", "mid", "near", "spike", "block", "cover"] as const;
export type ArtKey = (typeof ART_KEYS)[number];
export type ScenarioArt = Partial<Record<ArtKey, string>>;

export type Level = {
  id: string;
  name: string;
  verse?: Verse;
  /** Forma no começo da fase. */
  form: Form;
  /** Comprimento em colunas: ao chegar ao fim a fase termina. */
  length: number;
  objects: LevelObject[];
  /** Cores do céu do cenário (só visual). */
  theme?: { skyTop: string; skyBottom: string };
  /** Arte do cenário (só visual): fundo em 3 camadas e obstáculos em imagem. Sem arte, o app desenha formas simples. */
  art?: ScenarioArt;
  /** Trilha do cenário (endereço do áudio). */
  music?: string;
  /** Multiplicador da velocidade horizontal (1 = normal; fases difíceis correm mais). Entre `SPEED_RANGE.min` e `.max`. */
  speed?: number;
};

/**
 * Estilo da fase: muda os pesos dos obstáculos para que cada fase tenha a sua cara (todas as fases de um cenário têm estilos diferentes).
 * CLASSIC (básico, gentil), SPIKES (espetos e ritmo de pulos), SAWS (serras), PITS (buracos), PLATFORMS (blocos e degraus), RUSH (sequências rápidas),
 * SKY (voo variado), FLIP (gravidade variada), WILD (de tudo, bem denso) e FINALE (o máximo de cada coisa).
 */
export const LEVEL_STYLES = ["CLASSIC", "SPIKES", "SAWS", "PITS", "PLATFORMS", "RUSH", "SKY", "FLIP", "WILD", "FINALE"] as const;
export type LevelStyle = (typeof LEVEL_STYLES)[number];

export const STYLE_INFO: Record<LevelStyle, { label: string; hint: string }> = {
  CLASSIC: { label: "Clássica", hint: "Espetos, serras no chão e blocos: o básico, sem pressa." },
  SPIKES: { label: "Espetos", hint: "Muitos espetos, em sequência e em combinação com buracos e degraus." },
  SAWS: { label: "Serras", hint: "Serras no chão, no ar e no meio do campo; portões de serras no voo." },
  PITS: { label: "Buracos", hint: "Buracos em fila, no chão e no teto; o chão some o tempo todo." },
  PLATFORMS: { label: "Plataformas", hint: "Blocos, degraus, escadas e cavernas com teto baixo." },
  RUSH: { label: "Ritmo", hint: "Sequências rápidas de obstáculos: pula, pula, pula." },
  SKY: { label: "Céu", hint: "Voo com slaloms, dentes, varredores de serras e portões em zigue-zague." },
  FLIP: { label: "Reviravolta", hint: "Gravidade com paredes, buracos alternados e fileiras de espetos que não deixam virar." },
  WILD: { label: "Selvagem", hint: "De tudo um pouco, denso e imprevisível." },
  FINALE: { label: "Final", hint: "O máximo de cada obstáculo, quase sem respiro." },
};

export const SPEED_RANGE = { min: 0.8, max: 1.6 };

export type Rect = { l: number; t: number; r: number; b: number };

/** Serra pronta para simular (px): centro, raio e a onda vertical. */
export type Saw = { cx: number; cy: number; radius: number; amp: number; period: number };

/** Fase pronta para simular: objetos indexados por coluna (a busca a cada passo é O(1)). */
export type PreparedLevel = {
  level: Level;
  endX: number;
  portals: Array<{ x: number; form: Form }>;
  /** Posição (px) de cada checkpoint, em ordem. */
  checkpoints: number[];
  cols: Array<{ spikes: Rect[]; saws: Saw[]; blocks: Rect[]; words: Array<Rect & { index: number }>; powers: Array<Rect & { id: number; power: PowerKind }> }>;
  /** Buracos do chão e do teto (px), para o motor tirar o apoio de quem está dentro deles. */
  pits: Array<{ side: "floor" | "ceiling"; l: number; r: number }>;
  /** Multiplicador de velocidade da fase (1 = normal). */
  speed: number;
  wordCount: number;
  /** Quantos poderes a fase tem (os `id` vão de 0 a `powerCount - 1`, na ordem da lista de objetos). */
  powerCount: number;
};

export type PlayerStatus = "running" | "dead" | "finished";
export type DeathCause = "spike" | "wall" | "pit" | "saw";

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
