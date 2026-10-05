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

export type PowerUpKind =
  | "FIFTY"
  | "TIME"
  | "SWAP"
  | "SHIELD"
  | "DOUBLE"
  | "REROLL"
  // Exclusivos dos cenários
  | "TREE"
  | "DOVE"
  | "TENT"
  | "STAFF"
  | "MANNA"
  | "TRUMPET"
  | "WISDOM"
  | "FOURTH"
  | "NET"
  | "LIGHT";

export type TileKind = "START" | "NORMAL" | "SHELTER" | "POWER" | "TRIAL" | "SHORTCUT" | "FALL" | "GATE" | "FINISH" | "WALL" | "FIRE" | "DEN" | "VIGIL";

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
  /** Emoji do peão ou o endereço da imagem (peão cadastrado pelo painel). */
  pawn: string;
  bot: { skill: BotSkill } | null;
  position: number;
  powerUps: PowerUpKind[];
  stats: PlayerStats;
  /** Vezes que ainda vai ficar sem jogar (cova dos leões). */
  skip: number;
  /** Imune a recuos até o fim desta rodada (0 = não). Quarto homem. */
  immuneRound: number;
};

/** Perigo que muda de lugar a cada tantas rodadas (dilúvio, pragas). */
export type HazardRules = {
  name: string;
  description: string;
  /** A cada quantas rodadas sorteia novas casas. */
  every: number;
  /** Quantas casas (para tabuleiro de 40; escala com o tamanho). */
  count: number;
  /** Quanto recua quem para nelas. */
  penalty: number;
  /** Como o perigo se chama em cada sorteio (ex.: cada praga). */
  labels: Array<{ emoji: string; name: string }>;
};

/** Regras próprias de cada cenário (dados, para o painel poder editar depois). */
export type ScenarioRules = {
  slug: string;
  /** Casa de provação: pergunta difícil, "tudo ou nada" (ou vigília, em que todos respondem). */
  trial: {
    name: string;
    description: string;
    reward: number;
    penalty: number;
    optional: boolean;
    /** Acertar também dá um power-up. */
    rewardPower?: boolean;
    /** Errar também faz perder um power-up da mochila. */
    losePower?: boolean;
    /** Acertar também adianta o último colocado em tantas casas. */
    shareWithLast?: number;
  };
  /** As casas da provação são vigílias: todos respondem à mesma pergunta e só quem acerta avança. */
  vigil?: boolean;
  /** As casas de abrigo também dão um power-up. */
  shelterGrants: boolean;
  /** Power-up exclusivo do cenário (mais comum nas casas de poder). */
  exclusive: PowerUpKind | null;
  /** Todos começam com este power-up a mais. */
  startPower?: PowerUpKind | null;
  /** Texto do evento próprio do cenário, para a ajuda e a escolha do cenário. */
  event?: { name: string; description: string } | null;
  hazard?: HazardRules | null;
  /** Muros: param o peão até acertar duas perguntas seguidas; todos caem na rodada indicada. */
  walls?: { count: number; fallsAtRound: number } | null;
  /** Fornalha: casas de fogo que fazem recuar. */
  fire?: { count: number; penalty: number } | null;
  /** Cova dos leões: quem para nela fica uma vez sem jogar, mas ganha um escudo. */
  den?: { count: number } | null;
  /** Tempestade: em algumas rodadas, quem erra a pergunta é levado para trás. */
  storm?: { chance: number; drift: number } | null;
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

export type Phase = "ROLL" | "QUESTION" | "TRIAL_OFFER" | "TRIAL_QUESTION" | "FINAL_QUESTION" | "WALL_QUESTION" | "VIGIL_QUESTION" | "FINISHED";
export type QuestionKind = "MOVE" | "TRIAL" | "FINAL" | "WALL" | "VIGIL";

export type PendingQuestion = {
  questionId: number;
  kind: QuestionKind;
  /** Alternativas eliminadas por 50/50, Pomba ou Luz. */
  removed: OptionLetter[];
  /** Segundos somados pelo power-up de tempo. */
  extraSeconds: number;
  /** A Pomba mostra o versículo da pergunta. */
  hint: boolean;
  /** Muro: acertos seguidos que faltam/já feitos. */
  need?: number;
  got?: number;
  /** Muro derrubado no meio do caminho: para onde o peão segue (se o dado mandava mais longe). */
  carry?: number | null;
};

export type VigilState = { order: string[]; index: number; results: Record<string, boolean>; starterId: string };

export type HazardState = { tiles: number[]; emoji: string; name: string };

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
  /** Já usou um power-up nesta vez (só um por vez; Maná e Sabedoria não contam). */
  powerUsed: boolean;
  pending: PendingQuestion | null;
  askedIds: number[];
  winnerId: string | null;
  rng: number;
  /** Perigo do cenário nesta rodada (dilúvio, praga). */
  hazard: HazardState | null;
  /** Tempestade ativa nesta rodada. */
  storm: boolean;
  vigil: VigilState | null;
};

export type MoveReason =
  | "DICE"
  | "TRIAL"
  | "TRIAL_PENALTY"
  | "SHORTCUT"
  | "FALL"
  | "PUSH"
  | "TREE"
  | "HAZARD"
  | "FIRE"
  | "STORM"
  | "SHARE"
  | "VIGIL"
  | "NET"
  | "SWAP"
  | "TENT";

export type SetbackSource = "FALL" | "PUSH" | "TRIAL" | "HAZARD" | "FIRE" | "STORM" | "NET";

export type BoardEvent =
  | { type: "TURN"; playerId: string; round: number }
  | { type: "ROLLED"; playerId: string; die: number; bonus: number; doubled: boolean }
  | { type: "REROLLED"; playerId: string; die: number }
  | { type: "QUESTION"; playerId: string; kind: QuestionKind; questionId: number }
  | { type: "ANSWERED"; playerId: string; kind: QuestionKind; correct: boolean }
  | { type: "MOVED"; playerId: string; from: number; to: number; reason: MoveReason }
  | { type: "PUSHED"; playerId: string; byId: string; from: number; to: number }
  | { type: "SHIELD"; playerId: string; power: PowerUpKind; against: SetbackSource }
  | { type: "POWER_GAINED"; playerId: string; power: PowerUpKind }
  | { type: "POWER_FULL"; playerId: string }
  | { type: "POWER_USED"; playerId: string; power: PowerUpKind }
  | { type: "POWER_LOST"; playerId: string; power: PowerUpKind }
  | { type: "TRIAL"; playerId: string; stage: "OFFER" | "ACCEPTED" | "DECLINED" | "WON" | "LOST" | "TENT" }
  | { type: "GATE"; playerId: string }
  | { type: "WALL"; playerId: string; stage: "STOP" | "BREACHED" | "FAILED" | "TRUMPET" }
  | { type: "WALLS_FELL" }
  | { type: "VIGIL"; playerId: string; stage: "START" | "END" }
  | { type: "HAZARD"; emoji: string; name: string; tiles: number[] }
  | { type: "STORM"; on: boolean }
  | { type: "DEN"; playerId: string }
  | { type: "SKIPPED"; playerId: string }
  | { type: "SWAPPED"; playerId: string; withId: string }
  | { type: "NETTED"; playerId: string; byId: string }
  | { type: "IMMUNE"; playerId: string }
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
export const SHELTER_EVERY = 8;
/** Acertos seguidos para derrubar um muro. */
export const WALL_NEED = 2;
export const NET_PULL = 2;
export const TIME_OPTIONS = [15, 20, 30] as const;
export const DEFAULT_CONFIG: BoardConfig = { size: 40, timeSeconds: 20, powerUps: true, push: true, catchUp: true };

export type PowerUpInfo = { name: string; emoji: string; description: string; passive: boolean };

export const POWER_UPS: Record<PowerUpKind, PowerUpInfo> = {
  FIFTY: { name: "Meio a meio", emoji: "✂️", description: "Elimina duas alternativas erradas da pergunta.", passive: false },
  TIME: { name: "Tempo extra", emoji: "⏳", description: `Soma ${EXTRA_SECONDS} segundos na pergunta.`, passive: false },
  SWAP: { name: "Trocar pergunta", emoji: "🔄", description: "Sorteia outra pergunta no lugar da atual.", passive: false },
  SHIELD: { name: "Escudo", emoji: "🛡️", description: "Anula o próximo recuo (queda, empurrão, fogo, provação perdida...) e se gasta sozinho.", passive: true },
  DOUBLE: { name: "Dado dobrado", emoji: "✨", description: "Se acertar a pergunta, anda o dobro do dado.", passive: false },
  REROLL: { name: "Rolar de novo", emoji: "🎲", description: "Rola o dado outra vez antes de responder.", passive: false },
  TREE: { name: "Árvore da Vida", emoji: "🌳", description: "Anula o próximo recuo e ainda avança 2 casas.", passive: true },
  DOVE: { name: "Pomba", emoji: "🕊️", description: "Elimina uma alternativa errada e mostra o versículo da pergunta.", passive: false },
  TENT: { name: "Tenda", emoji: "⛺", description: "Ao parar numa provação, atravessa sem arriscar e ainda ganha o prêmio dela. Se gasta sozinha.", passive: true },
  STAFF: { name: "Cajado", emoji: "🪄", description: "Antes de rolar, troca de lugar com um rival à sua escolha.", passive: false },
  MANNA: { name: "Maná", emoji: "🍞", description: "Rola o dado de novo antes de responder, sem gastar a vez de usar outro power-up.", passive: false },
  TRUMPET: { name: "Trombeta", emoji: "📯", description: "Derruba o muro à sua frente na hora, sem precisar das duas respostas.", passive: false },
  WISDOM: { name: "Sabedoria", emoji: "📜", description: "Troca a pergunta (não vale na vigília) sem gastar a vez de usar outro power-up.", passive: false },
  FOURTH: { name: "Quarto homem", emoji: "🔥", description: "Antes de rolar, fica imune a recuos até o fim da próxima rodada.", passive: false },
  NET: { name: "Rede", emoji: "🕸️", description: `Antes de rolar, puxa um rival ${NET_PULL} casas para trás (abrigo, portão e escudo protegem).`, passive: false },
  LIGHT: { name: "Luz", emoji: "💡", description: "Revela a resposta: elimina as três alternativas erradas.", passive: false },
};

/** Power-ups comuns a todos os cenários (os que podem vir de uma casa de poder). */
export const COMMON_POWER_UPS: PowerUpKind[] = ["FIFTY", "TIME", "SWAP", "SHIELD", "DOUBLE", "REROLL"];

/** Usos que não gastam a "uma ajuda por vez". */
const FREE_POWERS: PowerUpKind[] = ["MANNA", "WISDOM"];
/** Power-ups que pedem um rival como alvo. */
export const TARGETED_POWERS: PowerUpKind[] = ["STAFF", "NET"];

export const BOT_SKILLS: Record<BotSkill, { name: string; accuracy: number }> = {
  APPRENTICE: { name: "Aprendiz", accuracy: 0.5 },
  STUDENT: { name: "Estudante", accuracy: 0.7 },
  MASTER: { name: "Mestre", accuracy: 0.9 },
};

/** Peões que todo jogador tem de graça (os cosméticos de peão do painel entram por cima disso). */
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

/** O peão é uma imagem (endereço) em vez de um emoji? */
export const isPawnImage = (pawn: string): boolean => pawn.startsWith("/") || pawn.startsWith("http://") || pawn.startsWith("https://");

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

/** Casas onde ninguém é empurrado nem puxado. */
const SAFE_TILES: TileKind[] = ["START", "SHELTER", "GATE", "FINISH"];

/** Escala a quantidade de uma regra (pensada para 40 casas) ao tamanho do tabuleiro. */
const scaled = (count: number, size: number) => Math.max(1, Math.round((count * size) / 40));

/**
 * Monta as casas: largada, abrigos fixos, e provações, atalhos, quedas, poderes e as casas próprias do
 * cenário sorteados com espaço entre si. A mesma semente gera o mesmo tabuleiro.
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

  place(rules.vigil ? "VIGIL" : "TRIAL", Math.max(2, Math.round(size / 13)), 5, gate - 3, 5, () => ({ kind: rules.vigil ? "VIGIL" : "TRIAL" }));
  if (rules.walls) {
    place("WALL", scaled(rules.walls.count, size), 7, gate - 4, 6, () => ({ kind: "WALL" }));
  }
  if (rules.fire) {
    place("FIRE", scaled(rules.fire.count, size), 4, gate - 3, 4, () => ({ kind: "FIRE" }));
  }
  if (rules.den) {
    place("DEN", scaled(rules.den.count, size), 5, gate - 3, 5, () => ({ kind: "DEN" }));
  }
  place("SHORTCUT", Math.max(1, Math.round(size / 18)), 3, gate - 8, 5, (index) => ({ kind: "SHORTCUT", to: index + randInt(rng, 3, 5) }));
  place("FALL", Math.max(1, Math.round(size / 18)), 7, gate - 3, 5, (index) => ({ kind: "FALL", to: index - randInt(rng, 3, 4) }));
  if (config.powerUps) {
    place("POWER", Math.round(size / 9), 2, gate - 2, 3, () => ({ kind: "POWER" }));
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
      hazard: null,
      storm: false,
      vigil: null,
    },
    events: [],
    bank,
  };

  draft.s.tiles = buildTiles(config, rules, draft);
  draft.s.players = shuffled(draft, players).map((player) => {
    const powerUps: PowerUpKind[] = config.powerUps ? [COMMON_POWER_UPS[randInt(draft, 0, COMMON_POWER_UPS.length - 1)]] : [];
    if (config.powerUps && rules.startPower) {
      powerUps.push(rules.startPower);
    }
    return {
      id: player.id,
      name: player.name,
      pawn: player.pawn,
      bot: player.bot ? { skill: player.bot } : null,
      position: 0,
      powerUps,
      stats: emptyStats(),
      skip: 0,
      immuneRound: 0,
    };
  });
  startRound(draft);
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

const isAsking = (state: BoardState) =>
  state.phase === "QUESTION" || state.phase === "TRIAL_QUESTION" || state.phase === "FINAL_QUESTION" || state.phase === "WALL_QUESTION" || state.phase === "VIGIL_QUESTION";

/** Rivais que o power-up com alvo (Cajado, Rede) pode escolher agora. */
export function powerTargets(state: BoardState, kind: PowerUpKind): string[] {
  if (state.phase !== "ROLL") {
    return [];
  }
  const me = currentPlayer(state);
  const gate = gateIndex(state.config);
  return state.players
    .filter((rival) => {
      if (rival.id === me.id) {
        return false;
      }
      if (kind === "STAFF") {
        return rival.position !== me.position && rival.position < gate && state.tiles[rival.position].kind !== "WALL";
      }
      return rival.position > 0 && !SAFE_TILES.includes(state.tiles[rival.position].kind);
    })
    .map((rival) => rival.id);
}

function canUse(state: BoardState, kind: PowerUpKind): boolean {
  const pending = state.pending;
  const me = currentPlayer(state);
  switch (kind) {
    case "DOUBLE":
      return !state.doubled && (state.phase === "ROLL" || (state.phase === "QUESTION" && pending?.kind === "MOVE"));
    case "REROLL":
    case "MANNA":
      return state.phase === "QUESTION" && pending?.kind === "MOVE";
    case "FIFTY":
      return isAsking(state) && pending !== null && pending.removed.length < 2;
    case "DOVE":
      return isAsking(state) && pending !== null && !pending.hint && pending.removed.length < 3;
    case "LIGHT":
      return isAsking(state) && pending !== null && pending.removed.length < 3;
    case "TIME":
      return isAsking(state);
    case "SWAP":
    case "WISDOM":
      return isAsking(state) && pending?.kind !== "VIGIL";
    case "TRUMPET":
      return state.phase === "WALL_QUESTION";
    case "STAFF":
    case "NET":
      return powerTargets(state, kind).length > 0;
    case "FOURTH":
      return state.phase === "ROLL" && me.immuneRound < state.round + 1;
    default:
      return false;
  }
}

/** Quais power-ups o jogador da vez pode usar agora (para habilitar os botões). */
export function usablePowerUps(state: BoardState): PowerUpKind[] {
  if (state.phase === "FINISHED") {
    return [];
  }
  const player = currentPlayer(state);
  const kinds = new Set<PowerUpKind>();
  for (const kind of player.powerUps) {
    if ((state.powerUsed && !FREE_POWERS.includes(kind)) || !canUse(state, kind)) {
      continue;
    }
    kinds.add(kind);
  }
  return [...kinds];
}

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
  const wantsHard = kind === "TRIAL" || kind === "FINAL";
  const preferred = wantsHard ? fresh.filter((question) => isHard(question.difficulty)) : fresh;
  const options = preferred.length > 0 ? preferred : fresh;
  const picked = options[Math.floor(rand(draft) * options.length)];
  draft.s.askedIds.push(picked.id);
  return picked.id;
}

const PHASE_OF: Record<QuestionKind, Phase> = {
  MOVE: "QUESTION",
  TRIAL: "TRIAL_QUESTION",
  FINAL: "FINAL_QUESTION",
  WALL: "WALL_QUESTION",
  VIGIL: "VIGIL_QUESTION",
};

function ask(draft: Draft, kind: QuestionKind, extra: Partial<PendingQuestion> & { questionId?: number } = {}) {
  const questionId = extra.questionId ?? drawQuestion(draft, kind);
  draft.s.pending = { questionId, kind, removed: [], extraSeconds: 0, hint: false, ...extra };
  draft.s.phase = PHASE_OF[kind];
  draft.events.push({ type: "QUESTION", playerId: current(draft).id, kind, questionId });
}

/** Começa uma rodada: derruba os muros no prazo, sorteia o perigo do cenário e a tempestade. */
function startRound(draft: Draft) {
  const state = draft.s;
  const { rules } = state;
  const gate = gateIndex(state.config);

  if (rules.walls && state.round >= rules.walls.fallsAtRound && state.tiles.some((tile) => tile.kind === "WALL")) {
    state.tiles = state.tiles.map((tile) => (tile.kind === "WALL" ? { kind: "NORMAL" } : tile));
    draft.events.push({ type: "WALLS_FELL" });
  }

  if (rules.hazard && (state.round - 1) % rules.hazard.every === 0) {
    const candidates = state.tiles.flatMap((tile, index) => (tile.kind === "NORMAL" && index >= 2 && index <= gate - 2 ? [index] : []));
    const tiles = shuffled(draft, candidates)
      .slice(0, scaled(rules.hazard.count, state.config.size))
      .sort((left, right) => left - right);
    const label = rules.hazard.labels[randInt(draft, 0, rules.hazard.labels.length - 1)] ?? { emoji: "⚠️", name: rules.hazard.name };
    state.hazard = { tiles, emoji: label.emoji, name: label.name };
    draft.events.push({ type: "HAZARD", emoji: label.emoji, name: label.name, tiles });
  }

  if (rules.storm) {
    const was = state.storm;
    state.storm = rand(draft) < rules.storm.chance;
    if (state.storm || was) {
      draft.events.push({ type: "STORM", on: state.storm });
    }
  }
}

function announceTurn(draft: Draft) {
  const player = current(draft);
  draft.events.push({ type: "TURN", playerId: player.id, round: draft.s.round });
  const tile = draft.s.tiles[player.position];
  // Quem está no portão não rola o dado: vai direto à pergunta final.
  if (player.position === gateIndex(draft.s.config)) {
    draft.events.push({ type: "GATE", playerId: player.id });
    ask(draft, "FINAL");
  } else if (tile.kind === "WALL") {
    // Parado diante de um muro: precisa derrubá-lo antes de jogar.
    ask(draft, "WALL", { need: WALL_NEED, got: 0, carry: null });
  }
}

function advanceTurn(draft: Draft) {
  const state = draft.s;
  state.turn = (state.turn + 1) % state.players.length;
  if (state.turn === 0) {
    state.round += 1;
    startRound(draft);
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
  advanceTurn(draft);
  // Quem ficou sem jogar (cova dos leões) perde a vez, uma de cada vez.
  for (let guard = 0; guard < state.players.length && current(draft).skip > 0; guard += 1) {
    current(draft).skip -= 1;
    draft.events.push({ type: "SKIPPED", playerId: current(draft).id });
    advanceTurn(draft);
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

/** Imunidade (Quarto homem), Árvore da Vida ou Escudo: anula um recuo. A Árvore ainda avança 2 casas. */
function absorb(draft: Draft, player: BoardPlayer, against: SetbackSource): boolean {
  if (player.immuneRound >= draft.s.round) {
    draft.events.push({ type: "SHIELD", playerId: player.id, power: "FOURTH", against });
    return true;
  }
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

/** Recua o peão para `to`, a não ser que algo o proteja. Devolve se o recuo valeu. */
function setback(draft: Draft, player: BoardPlayer, to: number, against: SetbackSource, reason: MoveReason): boolean {
  if (absorb(draft, player, against)) {
    return false;
  }
  moveTo(draft, player, to, reason);
  return true;
}

function giveSpecific(draft: Draft, player: BoardPlayer, power: PowerUpKind) {
  if (player.powerUps.length >= MAX_POWER_UPS) {
    draft.events.push({ type: "POWER_FULL", playerId: player.id });
    return;
  }
  player.powerUps.push(power);
  draft.events.push({ type: "POWER_GAINED", playerId: player.id, power });
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
  giveSpecific(draft, player, bag[Math.floor(rand(draft) * bag.length)]);
}

/** Cair na casa de um rival o empurra para trás (menos em abrigo, portão ou largada, ou se ele tiver proteção). */
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

/** Primeiro muro entre a posição (exclusive) e o destino (inclusive). */
function firstWall(state: BoardState, from: number, to: number): number | null {
  for (let index = from + 1; index <= to; index += 1) {
    if (state.tiles[index]?.kind === "WALL") {
      return index;
    }
  }
  return null;
}

/** Chegou ao portão (ou passou dele): a pergunta final decide a vitória. */
function reachGate(draft: Draft, player: BoardPlayer, reason: MoveReason) {
  moveTo(draft, player, gateIndex(draft.s.config), reason);
  draft.events.push({ type: "GATE", playerId: player.id });
  ask(draft, "FINAL");
}

/**
 * Anda o peão até `target`: um muro no caminho o faz parar e pedir as duas respostas; o portão pede a
 * pergunta final; do contrário, anda e (se `land`) resolve a casa onde parou.
 */
function advance(draft: Draft, player: BoardPlayer, target: number, reason: MoveReason, land: boolean) {
  const gate = gateIndex(draft.s.config);
  const wall = firstWall(draft.s, player.position, Math.min(target, gate));
  if (wall !== null) {
    moveTo(draft, player, wall, reason);
    draft.events.push({ type: "WALL", playerId: player.id, stage: "STOP" });
    ask(draft, "WALL", { need: WALL_NEED, got: 0, carry: target });
    return;
  }
  if (target >= gate) {
    reachGate(draft, player, reason);
    return;
  }
  moveTo(draft, player, target, reason);
  if (land) {
    landOn(draft, player);
  } else {
    applyPush(draft, player);
    endTurn(draft);
  }
}

/** Derruba o muro onde o peão está e, se o dado mandava mais longe, segue o caminho. */
function breach(draft: Draft, player: BoardPlayer, carry: number | null | undefined, stage: "BREACHED" | "TRUMPET") {
  draft.s.tiles[player.position] = { kind: "NORMAL" };
  draft.events.push({ type: "WALL", playerId: player.id, stage });
  draft.s.pending = null;
  if (carry !== null && carry !== undefined && carry > player.position) {
    advance(draft, player, carry, "DICE", true);
    return;
  }
  if (carry === null || carry === undefined) {
    // O peão estava parado no muro desde a vez passada: joga normalmente agora.
    draft.s.phase = "ROLL";
    return;
  }
  applyPush(draft, player);
  endTurn(draft);
}

function startVigil(draft: Draft, starter: BoardPlayer) {
  const state = draft.s;
  const startIndex = state.players.findIndex((player) => player.id === starter.id);
  const order = state.players.map((_, offset) => state.players[(startIndex + offset) % state.players.length].id);
  state.vigil = { order, index: 0, results: {}, starterId: starter.id };
  draft.events.push({ type: "TRIAL", playerId: starter.id, stage: "OFFER" });
  draft.events.push({ type: "VIGIL", playerId: starter.id, stage: "START" });
  ask(draft, "VIGIL");
}

/** Efeito da casa onde o peão parou depois de andar pelo dado. */
function landOn(draft: Draft, player: BoardPlayer) {
  const state = draft.s;
  const tile = state.tiles[player.position];
  switch (tile.kind) {
    case "SHORTCUT":
      moveTo(draft, player, tile.to ?? player.position, "SHORTCUT");
      break;
    case "FALL":
      setback(draft, player, tile.to ?? player.position, "FALL", "FALL");
      break;
    case "POWER":
      grantPower(draft, player);
      break;
    case "SHELTER":
      if (state.rules.shelterGrants) {
        grantPower(draft, player);
      }
      break;
    case "FIRE":
      setback(draft, player, player.position - (state.rules.fire?.penalty ?? 3), "FIRE", "FIRE");
      break;
    case "DEN":
      player.skip += 1;
      draft.events.push({ type: "DEN", playerId: player.id });
      giveSpecific(draft, player, "SHIELD");
      break;
    case "NORMAL":
      if (state.hazard?.tiles.includes(player.position) && state.rules.hazard) {
        setback(draft, player, player.position - state.rules.hazard.penalty, "HAZARD", "HAZARD");
      }
      break;
    default:
      break;
  }
  applyPush(draft, player);

  // A provação vale só para quem para nela de verdade (atalho e queda não encadeiam).
  if (tile.kind === "VIGIL") {
    startVigil(draft, player);
    return;
  }
  if (tile.kind === "TRIAL") {
    if (player.powerUps.includes("TENT")) {
      // A Tenda atravessa a provação sem arriscar e ainda dá o prêmio.
      player.powerUps.splice(player.powerUps.indexOf("TENT"), 1);
      draft.events.push({ type: "TRIAL", playerId: player.id, stage: "TENT" });
      advance(draft, player, player.position + state.rules.trial.reward, "TENT", false);
      return;
    }
    draft.events.push({ type: "TRIAL", playerId: player.id, stage: "OFFER" });
    if (state.rules.trial.optional) {
      state.phase = "TRIAL_OFFER";
      state.pending = null;
    } else {
      ask(draft, "TRIAL");
    }
    return;
  }
  endTurn(draft);
}

/** Tira `total` alternativas erradas (as que ainda restam) da pergunta atual. */
function removeWrong(draft: Draft, pending: PendingQuestion, total: number) {
  const correct = draft.bank.correctOption(pending.questionId);
  const remaining = (["A", "B", "C", "D"] as OptionLetter[]).filter((letter) => letter !== correct && !pending.removed.includes(letter));
  pending.removed = [...pending.removed, ...shuffled(draft, remaining).slice(0, Math.max(0, total - pending.removed.length))];
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

/**
 * Usa um power-up ativo da mochila (um por vez, fora Maná e Sabedoria). Os passivos (escudo, Tenda...)
 * se gastam sozinhos. Cajado e Rede pedem o rival em `targetId`.
 */
export function usePowerUp(state: BoardState, bank: QuestionBank, kind: PowerUpKind, targetId?: string): EngineResult {
  const draft = begin(state, bank);
  const player = current(draft);
  if (isPassive(kind)) {
    throw new BoardRuleError("Este power-up se usa sozinho");
  }
  if (!player.powerUps.includes(kind)) {
    throw new BoardRuleError("Você não tem este power-up");
  }
  if (state.powerUsed && !FREE_POWERS.includes(kind)) {
    throw new BoardRuleError("Só um power-up por vez");
  }
  if (!canUse(state, kind)) {
    throw new BoardRuleError("Este power-up não serve agora");
  }
  const target = TARGETED_POWERS.includes(kind) ? draft.s.players.find((rival) => rival.id === targetId) : undefined;
  if (TARGETED_POWERS.includes(kind) && (!target || !powerTargets(state, kind).includes(target.id))) {
    throw new BoardRuleError("Escolha um rival válido");
  }

  const pending = draft.s.pending;
  // O power-up sai da mochila e a "ajuda da vez" é marcada antes do efeito: a Trombeta pode encerrar a vez,
  // e a marca não pode vazar para o próximo jogador.
  player.powerUps.splice(player.powerUps.indexOf(kind), 1);
  if (!FREE_POWERS.includes(kind)) {
    draft.s.powerUsed = true;
  }
  draft.events.push({ type: "POWER_USED", playerId: player.id, power: kind });

  switch (kind) {
    case "DOUBLE":
      draft.s.doubled = true;
      break;
    case "REROLL":
    case "MANNA": {
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
        removeWrong(draft, pending, 2);
      }
      break;
    case "LIGHT":
      if (pending) {
        removeWrong(draft, pending, 3);
      }
      break;
    case "DOVE":
      if (pending) {
        removeWrong(draft, pending, Math.max(1, pending.removed.length + 1));
        pending.hint = true;
      }
      break;
    case "SWAP":
    case "WISDOM":
      if (pending) {
        const previous = pending.questionId;
        pending.questionId = drawQuestion(draft, pending.kind, [previous]);
        pending.removed = [];
        pending.hint = false;
        draft.events.push({ type: "QUESTION", playerId: player.id, kind: pending.kind, questionId: pending.questionId });
      }
      break;
    case "TRUMPET":
      breach(draft, player, pending?.carry, "TRUMPET");
      break;
    case "FOURTH":
      player.immuneRound = draft.s.round + 1;
      draft.events.push({ type: "IMMUNE", playerId: player.id });
      break;
    case "STAFF":
      if (target) {
        [player.position, target.position] = [target.position, player.position];
        draft.events.push({ type: "SWAPPED", playerId: player.id, withId: target.id });
      }
      break;
    case "NET":
      if (target) {
        draft.events.push({ type: "NETTED", playerId: target.id, byId: player.id });
        setback(draft, target, target.position - NET_PULL, "NET", "NET");
      }
      break;
    default:
      break;
  }

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

/** Último colocado (menor posição), fora o jogador indicado. */
function lastPlace(state: BoardState, except: BoardPlayer): BoardPlayer | undefined {
  return state.players.filter((player) => player.id !== except.id).sort((left, right) => left.position - right.position)[0];
}

/** Fim da vigília: quem acertou avança; a vez volta a quem a abriu e segue. */
function finishVigil(draft: Draft) {
  const state = draft.s;
  const vigil = state.vigil;
  if (!vigil) {
    return;
  }
  const gate = gateIndex(state.config);
  for (const id of vigil.order) {
    const player = state.players.find((item) => item.id === id);
    if (player && vigil.results[id]) {
      moveTo(draft, player, Math.min(player.position + state.rules.trial.reward, gate - 1), "VIGIL");
    }
  }
  draft.events.push({ type: "VIGIL", playerId: vigil.starterId, stage: "END" });
  state.turn = state.players.findIndex((player) => player.id === vigil.starterId);
  state.vigil = null;
  endTurn(draft);
}

/** Resolve a pergunta da vez. `correct` é falso também quando o tempo acabou. */
export function answerQuestion(state: BoardState, bank: QuestionBank, correct: boolean): EngineResult {
  requirePhase(state, "QUESTION", "TRIAL_QUESTION", "FINAL_QUESTION", "WALL_QUESTION", "VIGIL_QUESTION");
  const draft = begin(state, bank);
  const player = current(draft);
  const pendingNow = draft.s.pending;
  const kind = pendingNow?.kind ?? "MOVE";
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

  if (kind === "VIGIL") {
    const vigil = draft.s.vigil;
    if (!vigil) {
      endTurn(draft);
      return finish(draft);
    }
    vigil.results[player.id] = correct;
    vigil.index += 1;
    if (vigil.index < vigil.order.length) {
      // Próximo da vigília responde à mesma pergunta.
      draft.s.turn = draft.s.players.findIndex((item) => item.id === vigil.order[vigil.index]);
      draft.s.powerUsed = false;
      ask(draft, "VIGIL", { questionId: pendingNow?.questionId });
    } else {
      finishVigil(draft);
    }
    return finish(draft);
  }

  if (kind === "WALL") {
    const got = (pendingNow?.got ?? 0) + (correct ? 1 : 0);
    if (!correct) {
      draft.events.push({ type: "WALL", playerId: player.id, stage: "FAILED" });
      endTurn(draft);
    } else if (got >= (pendingNow?.need ?? WALL_NEED)) {
      breach(draft, player, pendingNow?.carry, "BREACHED");
    } else {
      ask(draft, "WALL", { need: pendingNow?.need, got, carry: pendingNow?.carry });
    }
    return finish(draft);
  }

  if (kind === "TRIAL") {
    const trial = draft.s.rules.trial;
    if (correct) {
      player.stats.trialsWon += 1;
      draft.events.push({ type: "TRIAL", playerId: player.id, stage: "WON" });
      if (trial.rewardPower) {
        grantPower(draft, player);
      }
      if (trial.shareWithLast) {
        const last = lastPlace(draft.s, player);
        if (last) {
          moveTo(draft, last, Math.min(last.position + trial.shareWithLast, gateIndex(draft.s.config) - 1), "SHARE");
        }
      }
      advance(draft, player, player.position + trial.reward, "TRIAL", false);
    } else {
      draft.events.push({ type: "TRIAL", playerId: player.id, stage: "LOST" });
      if (setback(draft, player, player.position - trial.penalty, "TRIAL", "TRIAL_PENALTY") && trial.losePower && player.powerUps.length > 0) {
        const lost = player.powerUps.splice(randInt(draft, 0, player.powerUps.length - 1), 1)[0];
        draft.events.push({ type: "POWER_LOST", playerId: player.id, power: lost });
      }
      endTurn(draft);
    }
    return finish(draft);
  }

  // Pergunta de movimento.
  if (!correct) {
    const storm = draft.s.rules.storm;
    if (draft.s.storm && storm) {
      setback(draft, player, player.position - storm.drift, "STORM", "STORM");
    }
    endTurn(draft);
    return finish(draft);
  }
  const steps = ((draft.s.die ?? 0) + draft.s.bonus) * (draft.s.doubled ? 2 : 1);
  advance(draft, player, player.position + steps, "DICE", true);
  return finish(draft);
}
