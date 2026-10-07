/**
 * Tipos do Modo Duelo (jogo de figurinhas estilo Marvel Snap). Tudo aqui é puro e serializável:
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
// Dons (habilidades das figurinhas)
// ---------------------------------------------------------------------------

export type Trigger =
  /** Quando a figurinha é revelada. */
  | "reveal"
  /** Vale enquanto a figurinha estiver em jogo (e sem ser silenciada). */
  | "ongoing"
  /** No fim de cada turno. */
  | "turnEnd"
  /** Depois do último turno, antes de contar os cenários. */
  | "gameEnd"
  /** Quando a figurinha é destruída. */
  | "destroyed"
  /** Quando outra figurinha sua é revelada no mesmo cenário. */
  | "allyPlayed";

export type Target =
  | "self"
  | "alliesHere"
  | "enemiesHere"
  | "otherAllies"
  | "weakestEnemyHere"
  | "strongestEnemyHere"
  | "weakestAllyHere"
  /** Todas as figurinhas do rival em jogo, em qualquer cenário. */
  | "enemiesAll"
  /** As figurinhas da sua mão (só vale para somar Influência). */
  | "hand";

export type Cond =
  | { type: "enemyHerePower"; atLeast: number }
  | { type: "enemyHereNamed"; name: string }
  | { type: "alliesHere"; atLeast: number }
  | { type: "laneLosing" }
  | { type: "laneWinning" }
  | { type: "alone" }
  | { type: "handAtMost"; count: number }
  | { type: "enemyHereTag"; tag: string }
  | { type: "allyHereTag"; tag: string }
  | { type: "turnAtLeast"; turn: number }
  /** Você tem `atLeast` ou mais figurinhas suas afastadas (no cemitério). */
  | { type: "graveyardAtLeast"; atLeast: number };

/**
 * O que contar nas figurinhas "por cada...": figurinhas suas aqui ou em jogo, com etiqueta ou Vigor específico.
 * `graveyard` conta as suas figurinhas afastadas e `hand`, as que estão na sua mão.
 */
export type Count = { of: "alliesHere" | "alliesAll" | "enemiesHere" | "cardsHere" | "graveyard" | "hand"; tag?: string; cost?: number };

export type Effect =
  | { kind: "power"; amount: number; to: Target; when?: Cond }
  | { kind: "powerPer"; amount: number; per: Count }
  | { kind: "draw"; count: number }
  | { kind: "destroy"; target: "weakestEnemyHere" | "strongestEnemyHere" | "weakestAllyHere" | "allHere"; when?: Cond }
  | { kind: "moveEnemies" }
  | { kind: "silence"; target: "enemiesHere" }
  | { kind: "create"; token: string; where: "eachLane" | "here" | "neighbors" }
  /** A figurinha do rival volta à mão dele (sem os bônus). */
  | { kind: "bounce"; target: "weakestEnemyHere" | "strongestEnemyHere" }
  /** O rival descarta as figurinhas de maior Vigor da mão dele. */
  | { kind: "discard"; count: number }
  /** Mais Vigor no próximo turno. */
  | { kind: "energy"; amount: number }
  /** As figurinhas da sua mão custam `amount` a menos de Vigor (mínimo 0). */
  | { kind: "cheaper"; amount: number }
  /** A figurinha mais fraca do rival aqui passa para o seu lado, se houver espaço. */
  | { kind: "convert" }
  /** Destrói a sua figurinha mais fraca aqui e esta figurinha ganha `gain`. */
  | { kind: "sacrifice"; gain: number }
  /** Multiplica a Influência atual desta figurinha. */
  | { kind: "multiply"; factor: number }
  /** Esta figurinha vai para o seu cenário mais fraco com espaço. */
  | { kind: "relocate" }
  /** Uma figurinha destruída sua volta à mão. */
  | { kind: "revive"; count: number }
  /** A figurinha some e volta à mão `turns` turnos depois, com `bonus` de Influência. */
  | { kind: "vanish"; turns: number; bonus: number }
  /** Contínuo: as figurinhas suas neste cenário não podem ser destruídas nem reduzidas por figurinhas do rival. */
  | { kind: "protect" }
  /** Contínuo: +amount nas figurinhas suas neste cenário ou nos cenários vizinhos (de uma etiqueta, se informada). */
  | { kind: "aura"; amount: number; to: "alliesHere" | "adjacent" | "allies"; tag?: string }
  /** O rival terá `amount` a menos de Vigor no próximo turno (sempre sobra ao menos 1). */
  | { kind: "exhaust"; amount: number; when?: Cond }
  /** Pega no seu Time `count` figurinha(s) e põe na mão: a mais cara (ou a mais barata) que combine com a etiqueta, se houver. */
  | { kind: "search"; count: number; pick: "priciest" | "cheapest"; tag?: string; when?: Cond }
  /** Repete o "Ao revelar" da sua figurinha mais forte aqui que tenha esse Dom (como se ela tivesse virado de novo). */
  | { kind: "echo"; when?: Cond }
  /** Contínuo: esta figurinha não pode ser destruída, devolvida, movida nem reduzida pelo rival. */
  | { kind: "shield" }
  /** Tira as penalidades (Influência negativa acumulada) desta figurinha e das suas outras aqui. */
  | { kind: "cleanse"; when?: Cond }
  /** Esta figurinha sobe até a Influência da mais forte aqui (de qualquer lado), ganhando no máximo `max`. */
  | { kind: "match"; max: number; when?: Cond };

export type Dom = { trigger: Trigger; effects: Effect[]; /** Texto manual (o do painel); sem ele, o motor descreve. */ text?: string };

// ---------------------------------------------------------------------------
// Figurinhas
// ---------------------------------------------------------------------------

export type CardDef = {
  /** Identificador estável (id do personagem no banco, ou um nome curto nas figurinhas de teste). */
  id: string;
  name: string;
  /** Vigor para jogar (0 a 6). */
  cost: number;
  power: number;
  tags: string[];
  dom?: Dom;
  imageUrl?: string | null;
  /** Só para figurinhas criadas por Dons (não entram em Times). */
  token?: boolean;
};

/** Uma figurinha do Time de um jogador, com o nível da figurinha (1 a 5) que ajusta os números. */
export type TeamCard = { def: CardDef; level?: number };

/** Instância de uma figurinha na partida. A definição já vem ajustada pelo nível. */
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
  | { kind: "winnerBonus"; amount: number }
  | { kind: "decayStrongest"; amount: number }
  | { kind: "growWeakest"; amount: number }
  | { kind: "underdog"; amount: number }
  | { kind: "lone"; amount: number }
  | { kind: "firstBonus"; amount: number }
  | { kind: "costBonus"; min: number; amount: number }
  | { kind: "strongestAt"; turn: number; amount: number }
  | { kind: "bountyAt"; turn: number; amount: number }
  | { kind: "refuge" }
  | { kind: "veteran"; after: number; amount: number }
  | { kind: "weakBonus"; max: number; amount: number }
  | { kind: "gather"; min: number; amount: number }
  | { kind: "reversalAt"; turn: number; amount: number }
  | { kind: "forgive" }
  | { kind: "exactCount"; count: number; amount: number }
  | { kind: "lastBonus"; amount: number }
  | { kind: "weakestBonus"; amount: number };

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
  /** Figurinhas de cada lado. */
  cards: [PlacedCard[], PlacedCard[]];
  /** Quantas figurinhas cada lado já revelou aqui (para a regra "primeira figurinha"). */
  played: [number, number];
};

export type Staged = { uid: number; lane: number };

/**
 * Figurinha que sumiu (Dom "sumir") e vai voltar sozinha para a arena `lane` no turno `atTurn`, com o bônus `gain`, e fica lá.
 * Entradas antigas (sem `lane`) voltam à mão, como antes.
 */
export type Returning = { card: Card; atTurn: number; lane?: number; gain?: number };

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
  /** Vigor a mais neste turno (de um Dom do turno anterior) e no próximo. */
  energyBonus: number;
  nextEnergyBonus: number;
  /** Vigor que sobrou dos turnos anteriores e foi guardado: soma ao deste turno. Ausente = 0 (estados antigos). */
  carry?: number;
};

/** Foto do tabuleiro num instante (para a tela repetir o turno passo a passo, com os números mudando). */
export type SnapCard = { uid: number; def: CardDef; power: number; silenced: boolean };
export type Snapshot = Array<{ cards: [SnapCard[], SnapCard[]]; power: [number, number]; open: boolean }>;

export type DuelEvent = {
  type: "play" | "reveal" | "power" | "destroy" | "move" | "create" | "draw" | "vanish" | "return" | "silence" | "scenario" | "turn" | "double" | "retreat" | "win" | "bounce" | "discard" | "convert" | "energy" | "dom";
  side?: Side;
  lane?: number;
  uid?: number;
  /** Nome da figurinha que causou (ou sofreu) o acontecimento. */
  name?: string;
  amount?: number;
  /** Texto pronto para o aviso. */
  text: string;
  /** Como o tabuleiro ficou logo depois deste acontecimento. */
  snap?: Snapshot;
  /** Na revelação de uma figurinha com Dom: o texto do Dom, para a tela explicar antes de agir. */
  dom?: string;
  /** Para onde a figurinha foi (movida) ou de onde veio. */
  fromLane?: number;
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
  /** Falso na rodada única: a aposta não vale nada, então não dá para dobrar. Ausente = vale (estados antigos). */
  stakesMatter?: boolean;
  events: DuelEvent[];
  result: DuelResult | null;
};
