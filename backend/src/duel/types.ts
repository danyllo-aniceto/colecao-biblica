/**
 * Tipos do Modo Duelo (jogo de cartas estilo Marvel Snap). Tudo aqui é puro e serializável:
 * o mesmo motor roda no navegador (treino contra bot) e no servidor (salas online).
 */

export type Side = 0 | 1;

export const TURNS = 6;
export const LANES = 3;
export const MAX_SLOTS = 4;
export const HAND_MAX = 7;
export const TEAM_SIZE = 12;
export const START_HAND = 3;
export const MAX_STAKES = 8;

// ---------------------------------------------------------------------------
// Dons (habilidades das cartas)
// ---------------------------------------------------------------------------

export type Trigger =
  /** Quando a carta é revelada. */
  | "reveal"
  /** Vale enquanto a carta estiver em jogo (e sem ser silenciada). */
  | "ongoing"
  /** No fim de cada turno. */
  | "turnEnd"
  /** Depois do último turno, antes de contar os cenários. */
  | "gameEnd"
  /** Quando a carta é destruída. */
  | "destroyed"
  /** Quando outra carta sua é revelada no mesmo cenário. */
  | "allyPlayed";

export type Target = "self" | "alliesHere" | "enemiesHere" | "otherAllies" | "weakestEnemyHere" | "strongestEnemyHere" | "weakestAllyHere";

export type Cond =
  | { type: "enemyHerePower"; atLeast: number }
  | { type: "enemyHereNamed"; name: string }
  | { type: "alliesHere"; atLeast: number }
  | { type: "laneLosing" }
  | { type: "turnAtLeast"; turn: number };

/** O que contar nas cartas "por cada...": cartas suas aqui ou em jogo, com etiqueta ou Vigor específico. */
export type Count = { of: "alliesHere" | "alliesAll"; tag?: string; cost?: number };

export type Effect =
  | { kind: "power"; amount: number; to: Target; when?: Cond }
  | { kind: "powerPer"; amount: number; per: Count }
  | { kind: "draw"; count: number }
  | { kind: "destroy"; target: "weakestEnemyHere" | "strongestEnemyHere" | "allHere"; when?: Cond }
  | { kind: "moveEnemies" }
  | { kind: "silence"; target: "enemiesHere" }
  | { kind: "create"; token: string; where: "eachLane" | "here" }
  /** A carta some e volta à mão `turns` turnos depois, com `bonus` de Influência. */
  | { kind: "vanish"; turns: number; bonus: number }
  /** Contínuo: as cartas suas neste cenário não podem ser destruídas nem reduzidas por cartas do rival. */
  | { kind: "protect" }
  /** Contínuo: +amount nas cartas suas neste cenário ou nos cenários vizinhos (de uma etiqueta, se informada). */
  | { kind: "aura"; amount: number; to: "alliesHere" | "adjacent"; tag?: string };

export type Dom = { trigger: Trigger; effects: Effect[]; /** Texto manual (o do painel); sem ele, o motor descreve. */ text?: string };

// ---------------------------------------------------------------------------
// Cartas
// ---------------------------------------------------------------------------

export type CardDef = {
  /** Identificador estável (id do personagem no banco, ou um nome curto nas cartas de teste). */
  id: string;
  name: string;
  /** Vigor para jogar (0 a 6). */
  cost: number;
  power: number;
  tags: string[];
  dom?: Dom;
  imageUrl?: string | null;
  /** Só para cartas criadas por Dons (não entram em Times). */
  token?: boolean;
};

/** Uma carta do Time de um jogador, com o nível da figurinha (1 a 5) que ajusta os números. */
export type TeamCard = { def: CardDef; level?: number };

/** Instância de uma carta na partida. A definição já vem ajustada pelo nível. */
export type Card = { uid: number; def: CardDef; /** Bônus permanente carregado (ex.: Jonas voltando). */ bonus: number };

export type PlacedCard = {
  uid: number;
  def: CardDef;
  /** Bônus permanente (Dons que somam ou tiram Influência de vez). */
  bonus: number;
  silenced: boolean;
  /** Ordem em que foi revelada na partida (os Dons resolvem nesta ordem). */
  order: number;
  /** Turno em que foi revelada. */
  turn: number;
};

// ---------------------------------------------------------------------------
// Cenários
// ---------------------------------------------------------------------------

export type ScenarioRule =
  | { kind: "cheapBonus"; amount: number }
  | { kind: "sharedTag"; amount: number }
  | { kind: "majority"; amount: number }
  | { kind: "decay"; amount: number }
  | { kind: "slots"; count: number }
  | { kind: "noMove" }
  | { kind: "tagBonus"; tags: string[]; amount: number }
  | { kind: "shiftFirst" }
  | { kind: "stormAt"; turn: number; amount: number }
  | { kind: "winnerBonus"; amount: number };

export type ScenarioDef = {
  /** Mesmo identificador (slug) do cenário da campanha. */
  id: string;
  name: string;
  emoji: string;
  rule: ScenarioRule;
  /** Texto curto da regra, mostrado na mesa. */
  text: string;
};

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

export type Lane = {
  scenario: string;
  /** Cartas de cada lado. */
  cards: [PlacedCard[], PlacedCard[]];
  /** Quantas cartas cada lado já revelou aqui (para a regra "primeira carta"). */
  played: [number, number];
};

export type Staged = { uid: number; lane: number };

export type Returning = { card: Card; atTurn: number };

export type PlayerState = {
  deck: Card[];
  hand: Card[];
  /** Destruídas e descartadas. */
  graveyard: Card[];
  returning: Returning[];
  staged: Staged[];
  ready: boolean;
  /** Turno em que dobrou a aposta (0 = ainda não dobrou). */
  doubledTurn: number;
};

export type DuelEvent = {
  type: "play" | "reveal" | "power" | "destroy" | "move" | "create" | "draw" | "vanish" | "return" | "silence" | "scenario" | "turn" | "double" | "retreat" | "win";
  side?: Side;
  lane?: number;
  uid?: number;
  /** Nome da carta que causou (ou sofreu) o acontecimento. */
  name?: string;
  amount?: number;
  /** Texto pronto para o aviso. */
  text: string;
};

export type DuelResult = {
  winner: Side | null;
  /** Vencedor de cada cenário (null = empate). */
  lanes: Array<{ winner: Side | null; power: [number, number] }>;
  totals: [number, number];
  retreated: Side | null;
  stakes: number;
};

export type DuelState = {
  /** Estado do sorteio (mulberry32). */
  rng: number;
  turn: number;
  status: "playing" | "finished";
  lanes: Lane[];
  players: [PlayerState, PlayerState];
  nextUid: number;
  nextOrder: number;
  /** Quem revela primeiro no turno em resolução (guardado para a tela). */
  priority: Side | null;
  stakes: number;
  events: DuelEvent[];
  result: DuelResult | null;
};
