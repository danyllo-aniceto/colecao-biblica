/**
 * Motor do Modo Tabuleiro: regras puras, sem banco e sem dependências, para rodar igual no navegador
 * (partida local) e no servidor (salas online). Toda função recebe o estado e devolve um estado novo
 * mais a lista de eventos (para a tela animar). O sorteio usa uma semente guardada no próprio estado,
 * então a mesma partida sempre se repete igual (testes e revanche).
 *
 * O motor nunca vê a alternativa marcada: quem chama (o cliente no modo local, o servidor no online)
 * confere a resposta e informa só se acertou. Assim a resposta certa pode ficar escondida no online.
 */

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type Difficulty = "EASY" | "MEDIUM" | "HARD" | "VERY_HARD";
export type OptionLetter = "A" | "B" | "C" | "D";

/** O motor só precisa do id e da dificuldade; o texto da pergunta fica com quem exibe. */
export type QuestionRef = { id: number; difficulty: Difficulty };

/** Banco de perguntas da partida: o sorteio é do motor, a resposta certa é de quem confere. */
export type QuestionBank = {
  pool: QuestionRef[];
  correctOption: (questionId: number) => OptionLetter;
};

export type PowerUpKind = "FIFTY" | "TIME" | "SWAP" | "SHIELD" | "DOUBLE" | "REROLL" | "TREE";

export type TileKind = "START" | "NORMAL" | "SHELTER" | "POWER" | "TRIAL" | "SHORTCUT" | "FALL" | "GATE" | "FINISH";

export type Tile = {
  kind: TileKind;
  /** Destino do atalho (para frente) ou da queda (para trás). */
  to?: number;
};

export type BotSkill = "APPRENTICE" | "STUDENT" | "MASTER";

export type PlayerStats = { correct: number; wrong: number; streak: number; bestStreak: number; pushes: number; pushed: number; trialsWon: number };

export type BoardPlayer = {
  id: string;
  name: string;
  /** Emoji do peão. */
  pawn: string;
  bot: { skill: BotSkill } | null;
  position: number;
  powerUps: PowerUpKind[];
  stats: PlayerStats;
};

/** Regras próprias de cada cenário (dados, para o painel poder editar depois). */
export type ScenarioRules = {
  slug: string;
  /** Casa de provação: pergunta difícil, "tudo ou nada". */
  trial: { name: string; description: string; reward: number; penalty: number; optional: boolean };
  /** As casas de abrigo também dão um power-up. */
  shelterGrants: boolean;
  /** Power-up exclusivo do cenário (mais comum nas casas de poder). */
  exclusive: PowerUpKind | null;
};

export type BoardConfig = {
  /** Quantas casas até a chegada (25, 40 ou 60). */
  size: number;
  /** Segundos por pergunta. */
  timeSeconds: number;
  powerUps: boolean;
  /** Cair na casa de um rival o empurra para trás. */
  push: boolean;
  /** O último colocado ganha +1 no dado. */
  catchUp: boolean;
};

export type Phase = "ROLL" | "QUESTION" | "TRIAL_OFFER" | "TRIAL_QUESTION" | "FINAL_QUESTION" | "FINISHED";
export type QuestionKind = "MOVE" | "TRIAL" | "FINAL";

export type PendingQuestion = {
  questionId: number;
  kind: QuestionKind;
  /** Alternativas eliminadas pelo 50/50. */
  removed: OptionLetter[];
  /** Segundos somados pelo power-up de tempo. */
  extraSeconds: number;
};

export type BoardState = {
  version: 1;
  config: BoardConfig;
  rules: ScenarioRules;
  tiles: Tile[];
  players: BoardPlayer[];
  /** Índice do jogador da vez. */
  turn: number;
  round: number;
  phase: Phase;
  die: number | null;
  /** Bônus de ajuda ao último colocado, somado ao dado nesta jogada. */
  bonus: number;
  /** Dado dobrado armado nesta jogada. */
  doubled: boolean;
  /** Já usou um power-up nesta vez (só um por vez). */
  powerUsed: boolean;
  pending: PendingQuestion | null;
  askedIds: number[];
  winnerId: string | null;
  rng: number;
};

export type MoveReason = "DICE" | "TRIAL" | "TRIAL_PENALTY" | "SHORTCUT" | "FALL" | "PUSH" | "TREE";

export type BoardEvent =
  | { type: "TURN"; playerId: string; round: number }
  | { type: "ROLLED"; playerId: string; die: number; bonus: number; doubled: boolean }
  | { type: "REROLLED"; playerId: string; die: number }
  | { type: "QUESTION"; playerId: string; kind: QuestionKind; questionId: number }
  | { type: "ANSWERED"; playerId: string; kind: QuestionKind; correct: boolean }
  | { type: "MOVED"; playerId: string; from: number; to: number; reason: MoveReason }
  | { type: "PUSHED"; playerId: string; byId: string; from: number; to: number }
  | { type: "SHIELD"; playerId: string; power: PowerUpKind; against: "FALL" | "PUSH" | "TRIAL" }
  | { type: "POWER_GAINED"; playerId: string; power: PowerUpKind }
  | { type: "POWER_FULL"; playerId: string }
  | { type: "POWER_USED"; playerId: string; power: PowerUpKind }
  | { type: "TRIAL"; playerId: string; stage: "OFFER" | "ACCEPTED" | "DECLINED" | "WON" | "LOST" }
  | { type: "GATE"; playerId: string }
  | { type: "RECYCLED" }
  | { type: "WON"; playerId: string };

export type EngineResult = { state: BoardState; events: BoardEvent[] };

/** Erro de regra (jogada fora de hora, power-up que não se tem...). A tela não deveria permitir. */
export class BoardRuleError extends Error {}

// ---------------------------------------------------------------------------
// Constantes e catálogo
// ---------------------------------------------------------------------------

export const BOARD_SIZES = [25, 40, 60] as const;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const MAX_POWER_UPS = 2;
export const PUSH_BACK = 3;
/** Quantas casas atrás do líder para ganhar a ajuda do dado. */
export const CATCH_UP_GAP = 8;
export const EXTRA_SECONDS = 10;
/** Casas de abrigo a cada tantas casas. */
export const SHELTER_EVERY = 6;
export const TIME_OPTIONS = [15, 20, 30] as const;
export const DEFAULT_CONFIG: BoardConfig = { size: 40, timeSeconds: 20, powerUps: true, push: true, catchUp: true };

export type PowerUpInfo = { name: string; emoji: string; description: string; passive: boolean };

export const POWER_UPS: Record<PowerUpKind, PowerUpInfo> = {
  FIFTY: { name: "Meio a meio", emoji: "✂️", description: "Elimina duas alternativas erradas da pergunta.", passive: false },
  TIME: { name: "Tempo extra", emoji: "⏳", description: `Soma ${EXTRA_SECONDS} segundos na pergunta.`, passive: false },
  SWAP: { name: "Trocar pergunta", emoji: "🔄", description: "Sorteia outra pergunta no lugar da atual.", passive: false },
  SHIELD: { name: "Escudo", emoji: "🛡️", description: "Anula o próximo recuo (queda, empurrão ou provação perdida) e se gasta sozinho.", passive: true },
  DOUBLE: { name: "Dado dobrado", emoji: "✨", description: "Se acertar a pergunta, anda o dobro do dado.", passive: false },
  REROLL: { name: "Rolar de novo", emoji: "🎲", description: "Rola o dado outra vez antes de responder.", passive: false },
  TREE: { name: "Árvore da Vida", emoji: "🌳", description: "Anula o próximo recuo e ainda avança 2 casas.", passive: true },
};

/** Power-ups comuns a todos os cenários (os que podem vir de uma casa de poder). */
export const COMMON_POWER_UPS: PowerUpKind[] = ["FIFTY", "TIME", "SWAP", "SHIELD", "DOUBLE", "REROLL"];

export const BOT_SKILLS: Record<BotSkill, { name: string; accuracy: number }> = {
  APPRENTICE: { name: "Aprendiz", accuracy: 0.5 },
  STUDENT: { name: "Estudante", accuracy: 0.7 },
  MASTER: { name: "Mestre", accuracy: 0.9 },
};

/** Peões que todo jogador tem de graça (os cosméticos de peão entram por cima disso). */
export const FREE_PAWNS = ["🐑", "🕊️", "🐟", "🌿", "⭐", "🦁", "🔥", "🌊", "🍇", "👑"];

export const PAWN_NAMES: Record<string, string> = {
  "🐑": "Ovelha",
  "🕊️": "Pomba",
  "🐟": "Peixe",
  "🌿": "Ramo",
  "⭐": "Estrela",
  "🦁": "Leão",
  "🔥": "Chama",
  "🌊": "Onda",
  "🍇": "Uvas",
  "👑": "Coroa",
};

// ---------------------------------------------------------------------------
// Sorteio com semente (mulberry32): o estado guarda só um número
// ---------------------------------------------------------------------------

type Draft = { s: BoardState; events: BoardEvent[]; bank: QuestionBank };

function rand(draft: { s: { rng: number } }): number {
  const state = draft.s;
  state.rng = (state.rng + 0x6d2b79f5) | 0;
  let t = Math.imul(state.rng ^ (state.rng >>> 15), 1 | state.rng);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function randInt(draft: { s: { rng: number } }, min: number, max: number): number {
  return min + Math.floor(rand(draft) * (max - min + 1));
}

function shuffled<T>(draft: { s: { rng: number } }, items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(rand(draft) * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

// ---------------------------------------------------------------------------
// Tabuleiro
// ---------------------------------------------------------------------------

/** Casa do portão: a última antes da chegada. Quem chega nela responde a pergunta final. */
export const gateIndex = (config: Pick<BoardConfig, "size">) => config.size - 1;

/**
 * Monta as casas: largada, abrigos fixos, e provações, atalhos, quedas e poderes sorteados com
 * espaço entre si. A mesma semente gera o mesmo tabuleiro.
 */
export function buildTiles(config: BoardConfig, rules: ScenarioRules, rng: { s: { rng: number } }): Tile[] {
  const { size } = config;
  const gate = gateIndex(config);
  const tiles: Tile[] = Array.from({ length: size + 1 }, () => ({ kind: "NORMAL" }));
  tiles[0] = { kind: "START" };
  tiles[gate] = { kind: "GATE" };
  tiles[size] = { kind: "FINISH" };

  for (let index = SHELTER_EVERY; index < gate - 2; index += SHELTER_EVERY) {
    tiles[index] = { kind: "SHELTER" };
  }

  const isFree = (index: number) => tiles[index].kind === "NORMAL";
  /** Há outra casa especial colada? Do mesmo tipo, vale a distância maior `spread`. */
  const crowded = (index: number, kind: TileKind, spread: number, mixed = false) => {
    for (let other = Math.max(0, index - spread); other <= Math.min(size, index + spread); other += 1) {
      const otherKind = tiles[other].kind;
      // Largada, abrigos e portão são fixos e podem ficar ao lado das casas sorteadas.
      if (other === index || otherKind === "NORMAL" || SAFE_TILES.includes(otherKind)) {
        continue;
      }
      if ((!mixed && Math.abs(other - index) <= 1) || (otherKind === kind && Math.abs(other - index) <= Math.max(1, spread))) {
        return true;
      }
    }
    return false;
  };

  /** Sorteia `count` casas livres entre `low` e `high`, sem encostar em outra casa especial e com `spread` de folga entre as do mesmo tipo. */
  function place(kind: TileKind, count: number, low: number, high: number, spread: number, make: (index: number) => Tile) {
    const candidates = shuffled(rng, Array.from({ length: Math.max(0, high - low + 1) }, (_, offset) => low + offset));
    let placed = 0;
    // Primeiro com a folga pedida; se o tabuleiro for apertado, tenta sem encostar e, por último, aceita encostar em outro tipo.
    for (const [gap, mixed] of [[spread, false], [1, false], [1, true]] as const) {
      for (const index of candidates) {
        if (placed >= count) {
          return;
        }
        if (!isFree(index) || crowded(index, kind, gap, mixed)) {
          continue;
        }
        tiles[index] = make(index);
        placed += 1;
      }
    }
  }

  place("TRIAL", Math.round(size / 10), 5, gate - 3, 5, () => ({ kind: "TRIAL" }));
  place("SHORTCUT", Math.max(1, Math.round(size / 14)), 3, gate - 8, 4, (index) => ({ kind: "SHORTCUT", to: index + randInt(rng, 3, 5) }));
  place("FALL", Math.max(1, Math.round(size / 14)), 7, gate - 3, 4, (index) => ({ kind: "FALL", to: index - randInt(rng, 3, 4) }));
  if (config.powerUps) {
    place("POWER", Math.round(size / 6), 2, gate - 2, 2, () => ({ kind: "POWER" }));
  }
  return tiles;
}

// ---------------------------------------------------------------------------
// Criação da partida
// ---------------------------------------------------------------------------

export type NewPlayer = { id: string; name: string; pawn: string; bot?: BotSkill | null };

const emptyStats = (): PlayerStats => ({ correct: 0, wrong: 0, streak: 0, bestStreak: 0, pushes: 0, pushed: 0, trialsWon: 0 });

/** Cria a partida: sorteia a ordem dos jogadores, o tabuleiro e o power-up inicial de cada um. */
export function createGame(input: { config: BoardConfig; rules: ScenarioRules; players: NewPlayer[]; seed: number; bank: QuestionBank }): EngineResult {
  const { config, rules, players, seed, bank } = input;
  if (players.length < MIN_PLAYERS || players.length > MAX_PLAYERS) {
    throw new BoardRuleError(`O tabuleiro é de ${MIN_PLAYERS} a ${MAX_PLAYERS} jogadores`);
  }
  if (new Set(players.map((player) => player.id)).size !== players.length) {
    throw new BoardRuleError("Jogadores com o mesmo identificador");
  }
  if (config.size < 10) {
    throw new BoardRuleError("Tabuleiro curto demais");
  }

  const draft: Draft = {
    s: {
      version: 1,
      config: { ...config },
      rules,
      tiles: [],
      players: [],
      turn: 0,
      round: 1,
      phase: "ROLL",
      die: null,
      bonus: 0,
      doubled: false,
      powerUsed: false,
      pending: null,
      askedIds: [],
      winnerId: null,
      rng: seed | 0,
    },
    events: [],
    bank,
  };

  draft.s.tiles = buildTiles(config, rules, draft);
  draft.s.players = shuffled(draft, players).map((player) => ({
    id: player.id,
    name: player.name,
    pawn: player.pawn,
    bot: player.bot ? { skill: player.bot } : null,
    position: 0,
    powerUps: config.powerUps ? [COMMON_POWER_UPS[randInt(draft, 0, COMMON_POWER_UPS.length - 1)]] : [],
    stats: emptyStats(),
  }));
  announceTurn(draft);
  return finish(draft);
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

export const currentPlayer = (state: BoardState): BoardPlayer => state.players[state.turn];

export const playerById = (state: BoardState, id: string): BoardPlayer | undefined => state.players.find((player) => player.id === id);

/** Quem lidera (maior posição). */
export const leaderPosition = (state: BoardState): number => Math.max(...state.players.map((player) => player.position));

/** Classificação: o vencedor primeiro, depois por posição (empate pelo maior número de acertos). */
export function standings(state: BoardState): BoardPlayer[] {
  return [...state.players].sort(
    (left, right) =>
      Number(right.id === state.winnerId) - Number(left.id === state.winnerId) || right.position - left.position || right.stats.correct - left.stats.correct,
  );
}

/** O dado de bônus (ajuda ao último colocado) que o jogador receberia agora. */
export function catchUpBonus(state: BoardState, player: BoardPlayer): number {
  return state.config.catchUp && leaderPosition(state) - player.position >= CATCH_UP_GAP ? 1 : 0;
}

export const isPassive = (kind: PowerUpKind): boolean => POWER_UPS[kind].passive;

/** Quais power-ups o jogador da vez pode usar agora (para habilitar os botões). */
export function usablePowerUps(state: BoardState): PowerUpKind[] {
  if (state.powerUsed || state.phase === "FINISHED") {
    return [];
  }
  const player = currentPlayer(state);
  const kinds = new Set<PowerUpKind>();
  for (const kind of player.powerUps) {
    if (canUse(state, kind)) {
      kinds.add(kind);
    }
  }
  return [...kinds];
}

function canUse(state: BoardState, kind: PowerUpKind): boolean {
  const pending = state.pending;
  switch (kind) {
    case "DOUBLE":
      return !state.doubled && (state.phase === "ROLL" || (state.phase === "QUESTION" && pending?.kind === "MOVE"));
    case "REROLL":
      return state.phase === "QUESTION" && pending?.kind === "MOVE";
    case "FIFTY":
      return isAsking(state) && pending !== null && pending.removed.length === 0;
    case "TIME":
    case "SWAP":
      return isAsking(state);
    default:
      return false;
  }
}

const isAsking = (state: BoardState) => state.phase === "QUESTION" || state.phase === "TRIAL_QUESTION" || state.phase === "FINAL_QUESTION";

// ---------------------------------------------------------------------------
// Funções internas
// ---------------------------------------------------------------------------

function finish(draft: Draft): EngineResult {
  return { state: draft.s, events: draft.events };
}

function begin(state: BoardState, bank: QuestionBank): Draft {
  return { s: structuredClone(state), events: [], bank };
}

function requirePhase(state: BoardState, ...phases: Phase[]) {
  if (!phases.includes(state.phase)) {
    throw new BoardRuleError(`Jogada fora de hora (fase ${state.phase})`);
  }
}

const current = (draft: Draft): BoardPlayer => draft.s.players[draft.s.turn];

const isHard = (difficulty: Difficulty) => difficulty === "HARD" || difficulty === "VERY_HARD";

/** Sorteia uma pergunta ainda não usada na partida; provação e final preferem as difíceis. */
function drawQuestion(draft: Draft, kind: QuestionKind, exclude: number[] = []): number {
  const { pool } = draft.bank;
  if (pool.length === 0) {
    throw new BoardRuleError("Sem perguntas para sortear");
  }
  const blocked = (id: number) => exclude.includes(id);
  let fresh = pool.filter((question) => !draft.s.askedIds.includes(question.id) && !blocked(question.id));
  if (fresh.length === 0) {
    // Acabaram as perguntas: o baralho recomeça (menos as da vez, se der).
    draft.s.askedIds = [];
    draft.events.push({ type: "RECYCLED" });
    fresh = pool.filter((question) => !blocked(question.id));
    if (fresh.length === 0) {
      fresh = [...pool];
    }
  }
  const preferred = kind === "MOVE" ? fresh : fresh.filter((question) => isHard(question.difficulty));
  const options = preferred.length > 0 ? preferred : fresh;
  const picked = options[Math.floor(rand(draft) * options.length)];
  draft.s.askedIds.push(picked.id);
  return picked.id;
}

function ask(draft: Draft, kind: QuestionKind) {
  const questionId = drawQuestion(draft, kind);
  draft.s.pending = { questionId, kind, removed: [], extraSeconds: 0 };
  draft.s.phase = kind === "MOVE" ? "QUESTION" : kind === "TRIAL" ? "TRIAL_QUESTION" : "FINAL_QUESTION";
  draft.events.push({ type: "QUESTION", playerId: current(draft).id, kind, questionId });
}

function announceTurn(draft: Draft) {
  const player = current(draft);
  draft.events.push({ type: "TURN", playerId: player.id, round: draft.s.round });
  // Quem está no portão não rola o dado: vai direto à pergunta final.
  if (player.position === gateIndex(draft.s.config)) {
    draft.events.push({ type: "GATE", playerId: player.id });
    ask(draft, "FINAL");
  }
}

function endTurn(draft: Draft) {
  const state = draft.s;
  state.die = null;
  state.bonus = 0;
  state.doubled = false;
  state.powerUsed = false;
  state.pending = null;
  state.phase = "ROLL";
  state.turn = (state.turn + 1) % state.players.length;
  if (state.turn === 0) {
    state.round += 1;
  }
  announceTurn(draft);
}

function moveTo(draft: Draft, player: BoardPlayer, to: number, reason: MoveReason) {
  const from = player.position;
  player.position = Math.max(0, Math.min(to, gateIndex(draft.s.config)));
  if (player.position !== from) {
    draft.events.push({ type: "MOVED", playerId: player.id, from, to: player.position, reason });
  }
}

/** Escudo ou Árvore da Vida: se o jogador tem um, gasta e anula o recuo. A Árvore ainda avança 2 casas. */
function absorb(draft: Draft, player: BoardPlayer, against: "FALL" | "PUSH" | "TRIAL"): boolean {
  const kind: PowerUpKind | undefined = player.powerUps.includes("TREE") ? "TREE" : player.powerUps.includes("SHIELD") ? "SHIELD" : undefined;
  if (!kind) {
    return false;
  }
  player.powerUps.splice(player.powerUps.indexOf(kind), 1);
  draft.events.push({ type: "SHIELD", playerId: player.id, power: kind, against });
  if (kind === "TREE") {
    // Nunca empurra para o portão sozinho: a Árvore só ajuda até a casa antes dele.
    moveTo(draft, player, Math.min(player.position + 2, gateIndex(draft.s.config) - 1), "TREE");
  }
  return true;
}

function grantPower(draft: Draft, player: BoardPlayer) {
  if (!draft.s.config.powerUps) {
    return;
  }
  if (player.powerUps.length >= MAX_POWER_UPS) {
    draft.events.push({ type: "POWER_FULL", playerId: player.id });
    return;
  }
  const exclusive = draft.s.rules.exclusive;
  // O exclusivo do cenário pesa o dobro.
  const bag: PowerUpKind[] = [...COMMON_POWER_UPS, ...(exclusive ? [exclusive, exclusive] : [])];
  const power = bag[Math.floor(rand(draft) * bag.length)];
  player.powerUps.push(power);
  draft.events.push({ type: "POWER_GAINED", playerId: player.id, power });
}

/** Casas onde ninguém é empurrado. */
const SAFE_TILES: TileKind[] = ["START", "SHELTER", "GATE", "FINISH"];

/** Cair na casa de um rival o empurra para trás (menos em abrigo, portão ou largada, ou se ele tiver escudo). */
function applyPush(draft: Draft, mover: BoardPlayer) {
  if (!draft.s.config.push || SAFE_TILES.includes(draft.s.tiles[mover.position].kind)) {
    return;
  }
  for (const rival of draft.s.players) {
    if (rival.id === mover.id || rival.position !== mover.position) {
      continue;
    }
    if (absorb(draft, rival, "PUSH")) {
      continue;
    }
    const from = rival.position;
    rival.position = Math.max(0, from - PUSH_BACK);
    mover.stats.pushes += 1;
    rival.stats.pushed += 1;
    draft.events.push({ type: "PUSHED", playerId: rival.id, byId: mover.id, from, to: rival.position });
  }
}

/** Chegou ao portão (ou passou dele): a pergunta final decide a vitória. */
function reachGate(draft: Draft, player: BoardPlayer, reason: MoveReason) {
  moveTo(draft, player, gateIndex(draft.s.config), reason);
  draft.events.push({ type: "GATE", playerId: player.id });
  ask(draft, "FINAL");
}

/** Efeito da casa onde o peão parou depois de andar pelo dado. */
function landOn(draft: Draft, player: BoardPlayer) {
  const tile = draft.s.tiles[player.position];
  switch (tile.kind) {
    case "SHORTCUT":
      moveTo(draft, player, tile.to ?? player.position, "SHORTCUT");
      break;
    case "FALL":
      if (absorb(draft, player, "FALL")) {
        break;
      }
      moveTo(draft, player, tile.to ?? player.position, "FALL");
      break;
    case "POWER":
      grantPower(draft, player);
      break;
    case "SHELTER":
      if (draft.s.rules.shelterGrants) {
        grantPower(draft, player);
      }
      break;
    default:
      break;
  }
  applyPush(draft, player);
  // A provação vale só para quem para nela de verdade (atalho e queda não encadeiam).
  if (draft.s.tiles[player.position].kind === "TRIAL" && tile.kind === "TRIAL") {
    draft.events.push({ type: "TRIAL", playerId: player.id, stage: "OFFER" });
    if (draft.s.rules.trial.optional) {
      draft.s.phase = "TRIAL_OFFER";
      draft.s.pending = null;
    } else {
      ask(draft, "TRIAL");
    }
    return;
  }
  endTurn(draft);
}

// ---------------------------------------------------------------------------
// Ações do jogador da vez
// ---------------------------------------------------------------------------

/** Rola o dado (1 a 6, mais o bônus de ajuda) e sorteia a pergunta que decide se o peão anda. */
export function rollDice(state: BoardState, bank: QuestionBank): EngineResult {
  requirePhase(state, "ROLL");
  const draft = begin(state, bank);
  const player = current(draft);
  const die = randInt(draft, 1, 6);
  draft.s.die = die;
  draft.s.bonus = catchUpBonus(draft.s, player);
  draft.events.push({ type: "ROLLED", playerId: player.id, die, bonus: draft.s.bonus, doubled: draft.s.doubled });
  ask(draft, "MOVE");
  return finish(draft);
}

/** Usa um power-up ativo da mochila (um por vez). Os passivos (escudo) se gastam sozinhos. */
export function usePowerUp(state: BoardState, bank: QuestionBank, kind: PowerUpKind): EngineResult {
  const draft = begin(state, bank);
  const player = current(draft);
  if (isPassive(kind)) {
    throw new BoardRuleError("Este power-up se usa sozinho");
  }
  if (!player.powerUps.includes(kind)) {
    throw new BoardRuleError("Você não tem este power-up");
  }
  if (state.powerUsed) {
    throw new BoardRuleError("Só um power-up por vez");
  }
  if (!canUse(state, kind)) {
    throw new BoardRuleError("Este power-up não serve agora");
  }

  const pending = draft.s.pending;
  switch (kind) {
    case "DOUBLE":
      draft.s.doubled = true;
      break;
    case "REROLL": {
      const die = randInt(draft, 1, 6);
      draft.s.die = die;
      draft.events.push({ type: "REROLLED", playerId: player.id, die });
      break;
    }
    case "TIME":
      if (pending) {
        pending.extraSeconds += EXTRA_SECONDS;
      }
      break;
    case "FIFTY":
      if (pending) {
        const correct = draft.bank.correctOption(pending.questionId);
        const wrong = (["A", "B", "C", "D"] as OptionLetter[]).filter((letter) => letter !== correct);
        pending.removed = shuffled(draft, wrong).slice(0, 2);
      }
      break;
    case "SWAP":
      if (pending) {
        const previous = pending.questionId;
        pending.questionId = drawQuestion(draft, pending.kind, [previous]);
        pending.removed = [];
        draft.events.push({ type: "QUESTION", playerId: player.id, kind: pending.kind, questionId: pending.questionId });
      }
      break;
    default:
      break;
  }

  player.powerUps.splice(player.powerUps.indexOf(kind), 1);
  draft.s.powerUsed = true;
  draft.events.push({ type: "POWER_USED", playerId: player.id, power: kind });
  return finish(draft);
}

/** Aceita ou recusa a provação (só nos cenários em que ela é opcional). */
export function answerTrialOffer(state: BoardState, bank: QuestionBank, accept: boolean): EngineResult {
  requirePhase(state, "TRIAL_OFFER");
  const draft = begin(state, bank);
  const player = current(draft);
  if (accept) {
    draft.events.push({ type: "TRIAL", playerId: player.id, stage: "ACCEPTED" });
    ask(draft, "TRIAL");
  } else {
    draft.events.push({ type: "TRIAL", playerId: player.id, stage: "DECLINED" });
    endTurn(draft);
  }
  return finish(draft);
}

/** Resolve a pergunta da vez. `correct` é falso também quando o tempo acabou. */
export function answerQuestion(state: BoardState, bank: QuestionBank, correct: boolean): EngineResult {
  requirePhase(state, "QUESTION", "TRIAL_QUESTION", "FINAL_QUESTION");
  const draft = begin(state, bank);
  const player = current(draft);
  const kind = draft.s.pending?.kind ?? "MOVE";
  draft.events.push({ type: "ANSWERED", playerId: player.id, kind, correct });

  if (correct) {
    player.stats.correct += 1;
    player.stats.streak += 1;
    player.stats.bestStreak = Math.max(player.stats.bestStreak, player.stats.streak);
  } else {
    player.stats.wrong += 1;
    player.stats.streak = 0;
  }

  draft.s.pending = null;

  if (kind === "FINAL") {
    if (correct) {
      draft.s.phase = "FINISHED";
      draft.s.winnerId = player.id;
      player.position = draft.s.config.size;
      draft.events.push({ type: "MOVED", playerId: player.id, from: gateIndex(draft.s.config), to: player.position, reason: "DICE" });
      draft.events.push({ type: "WON", playerId: player.id });
    } else {
      endTurn(draft);
    }
    return finish(draft);
  }

  if (kind === "TRIAL") {
    const { reward, penalty } = draft.s.rules.trial;
    if (correct) {
      player.stats.trialsWon += 1;
      draft.events.push({ type: "TRIAL", playerId: player.id, stage: "WON" });
      const target = player.position + reward;
      if (target >= gateIndex(draft.s.config)) {
        reachGate(draft, player, "TRIAL");
        return finish(draft);
      }
      moveTo(draft, player, target, "TRIAL");
      applyPush(draft, player);
    } else {
      draft.events.push({ type: "TRIAL", playerId: player.id, stage: "LOST" });
      if (!absorb(draft, player, "TRIAL")) {
        moveTo(draft, player, player.position - penalty, "TRIAL_PENALTY");
      }
    }
    endTurn(draft);
    return finish(draft);
  }

  // Pergunta de movimento.
  if (!correct) {
    endTurn(draft);
    return finish(draft);
  }
  const steps = ((draft.s.die ?? 0) + draft.s.bonus) * (draft.s.doubled ? 2 : 1);
  const target = player.position + steps;
  if (target >= gateIndex(draft.s.config)) {
    reachGate(draft, player, "DICE");
    return finish(draft);
  }
  moveTo(draft, player, target, "DICE");
  landOn(draft, player);
  return finish(draft);
}
