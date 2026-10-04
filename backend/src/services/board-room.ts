import { randomInt } from "node:crypto";
import { Prisma, type BoardRoom, type BoardRoomPlayer, type BoardRoomStatus } from "@prisma/client";
import { prisma, transaction } from "../db/prisma";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { botAction } from "../board/bots";
import {
  BOARD_SIZES,
  BoardRuleError,
  DEFAULT_CONFIG,
  EXTRA_SECONDS,
  FREE_PAWNS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  TIME_OPTIONS,
  answerQuestion,
  answerTrialOffer,
  createGame,
  currentPlayer,
  rollDice,
  usePowerUp,
  type BoardConfig,
  type BoardEvent,
  type BoardState,
  type BotSkill,
  type EngineResult,
  type OptionLetter,
  type PowerUpKind,
  type QuestionBank,
} from "../board/engine";
import { calloutsFor, pickCallouts, type Callout } from "../board/callouts";
import { eventMessage } from "../board/messages";
import { boardRulesFor } from "../board/scenarios";
import { pickBoardPool, type BoardPoolItem } from "./board";
import { areFriends } from "./social";

/**
 * Salas online do Modo Tabuleiro.
 *
 * Sem WebSocket (a API roda em funções da Vercel): o cliente consulta a sala a cada poucos segundos e só baixa
 * o estado quando a versão muda. Tudo que é "sozinho" (bots jogando, tempo esgotado, fim do gabarito) acontece
 * de forma preguiçosa: a próxima consulta ou jogada alcança o relógio da sala e resolve o que já venceu, na ordem.
 */

type Tx = Prisma.TransactionClient;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
/** Tempo para todos lerem o gabarito antes da jogada valer (quem respondeu pode adiantar). */
const REVEAL_MS = 7000;
const BOT_REVEAL_MS = 2200;
/** Folga entre o fim do cronômetro na tela e o servidor dar a pergunta como perdida. */
const GRACE_MS = 3000;
const ROLL_IDLE_MS = 60_000;
const TRIAL_IDLE_MS = 30_000;
/** Faltas seguidas (tempo esgotado) para um bot assumir o lugar. */
const AFK_LIMIT = 3;
const MAX_LOG = 40;
const MAX_STEPS = 40;
const CONNECTED_MS = 20_000;
const SEEN_WRITE_MS = 8000;
const NAME_MAX = 24;
const BOT_NAMES = ["Davi", "Ester", "Daniel", "Rute", "Calebe", "Débora", "Josué", "Miriã", "Neemias", "Lídia", "Samuel", "Ana"];
const BOT_SKILLS_LIST: BotSkill[] = ["APPRENTICE", "STUDENT", "MASTER"];

type Reveal = {
  playerId: string;
  questionId: number;
  selected: OptionLetter | null;
  correct: boolean;
  timedOut: boolean;
  correctOption: OptionLetter;
  bot: boolean;
  at: number;
};

/** Aviso animado guardado na sala: o `id` deixa cada aparelho tocar o aviso uma vez só. */
type FeedItem = Callout & { id: string };
const MAX_FEED = 12;

type Work = {
  room: BoardRoom;
  players: BoardRoomPlayer[];
  status: BoardRoomStatus;
  hostId: number;
  scenarioId: number;
  config: BoardConfig;
  state: BoardState | null;
  pool: BoardPoolItem[];
  reveal: Reveal | null;
  log: string[];
  feed: FeedItem[];
  dueAt: number | null;
  deadlineAt: number | null;
  dirtyPlayers: Set<number>;
  poolDirty: boolean;
  touched: boolean;
  justFinished: boolean;
  deleted: boolean;
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Identificador do jogador dentro do motor: pessoas "u<id>", bots "b<vaga>". */
const keyOf = (player: Pick<BoardRoomPlayer, "userId" | "slot">) => (player.userId ? `u${player.userId}` : `b${player.slot}`);
const isHuman = (player: BoardRoomPlayer) => player.userId !== null && !player.replaced;
const normalizeCode = (code: string) => code.trim().toUpperCase();

function bankOf(pool: BoardPoolItem[]): QuestionBank {
  const byId = new Map(pool.map((item) => [item.id, item.correct]));
  return { pool: pool.map((item) => ({ id: item.id, difficulty: item.difficulty })), correctOption: (id) => byId.get(id) ?? "A" };
}

/** Erros de regra do motor viram resposta 400 com a mensagem. */
function guarded<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof BoardRuleError) throw badRequest(error.message);
    throw error;
  }
}

function lines(events: BoardEvent[], state: BoardState): string[] {
  return events.map((event) => eventMessage(event, state)).filter((line): line is string => Boolean(line));
}

function pushFeed(work: Work, callouts: Callout[], at: number) {
  if (callouts.length === 0) return;
  const items = pickCallouts(callouts).map((callout, index) => ({ ...callout, id: `${at}-${index}` }));
  work.feed = [...work.feed, ...items].slice(-MAX_FEED);
}

function pushLog(work: Work, newLines: string[]) {
  if (newLines.length > 0) work.log = [...work.log, ...newLines].slice(-MAX_LOG);
}

function freeSlot(players: BoardRoomPlayer[]): number {
  for (let slot = 0; slot < MAX_PLAYERS; slot += 1) if (!players.some((player) => player.slot === slot)) return slot;
  throw badRequest("A sala está cheia");
}

/** Peões básicos de todos: os cosméticos de peão grátis e ativos do painel (os emojis de fábrica se não houver nenhum). */
async function basicPawns(tx: Tx): Promise<string[]> {
  const rows = await tx.cosmetic.findMany({
    where: { type: "PAWN", unlock: "FREE", active: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { imageUrl: true, style: true },
  });
  const values = rows.map((row) => row.imageUrl || row.style).filter((value): value is string => Boolean(value));
  return values.length > 0 ? values : FREE_PAWNS;
}

async function freePawn(tx: Tx, players: BoardRoomPlayer[]): Promise<string> {
  const basics = await basicPawns(tx);
  return basics.find((pawn) => !players.some((player) => player.pawn === pawn)) ?? basics[0];
}

/** Peão liberado para o jogador: os básicos de todos ou um peão do painel que ele tem. */
async function allowedPawn(tx: Tx, userId: number, pawn: string | undefined | null): Promise<boolean> {
  if (!pawn) return false;
  if ((await basicPawns(tx)).includes(pawn)) return true;
  const owned = await tx.userCosmetic.findFirst({
    where: { userId, cosmetic: { type: "PAWN", active: true, OR: [{ imageUrl: pawn }, { style: pawn }] } },
    select: { id: true },
  });
  return Boolean(owned);
}

/** Valida o peão pedido: se já está em uso por outro ou não é do jogador, cai para um livre. */
async function choosePawn(tx: Tx, userId: number, players: BoardRoomPlayer[], wanted: string | undefined | null, selfId?: number) {
  if (wanted && !players.some((player) => player.pawn === wanted && player.id !== selfId) && (await allowedPawn(tx, userId, wanted))) return wanted;
  return freePawn(tx, players.filter((player) => player.id !== selfId));
}

export function validateConfig(input: Partial<BoardConfig> | undefined, base: BoardConfig = DEFAULT_CONFIG): BoardConfig {
  const config = { ...base, ...(input ?? {}) };
  if (!(BOARD_SIZES as readonly number[]).includes(config.size)) throw badRequest("Tamanho de tabuleiro inválido");
  if (!(TIME_OPTIONS as readonly number[]).includes(config.timeSeconds)) throw badRequest("Tempo por pergunta inválido");
  return { size: config.size, timeSeconds: config.timeSeconds, powerUps: Boolean(config.powerUps), push: Boolean(config.push), catchUp: Boolean(config.catchUp) };
}

// ---------------------------------------------------------------------------
// Relógio da sala (tudo "sozinho" acontece aqui)
// ---------------------------------------------------------------------------

/** Define quando o servidor precisa agir de novo e até quando o jogador da vez tem para jogar. */
function scheduleNext(work: Work, base: number) {
  const state = work.state;
  if (!state || state.phase === "FINISHED" || work.status !== "PLAYING") {
    work.dueAt = null;
    work.deadlineAt = null;
    return;
  }
  if (work.reveal) {
    work.dueAt = work.reveal.at + (work.reveal.bot ? BOT_REVEAL_MS : REVEAL_MS);
    work.deadlineAt = null;
    return;
  }
  const current = currentPlayer(state);
  if (current.bot) {
    const delay = state.phase === "ROLL" ? 1100 : state.phase === "TRIAL_OFFER" ? 1000 : 1600 + Math.random() * 2200;
    work.dueAt = base + delay;
    work.deadlineAt = null;
  } else if (state.phase === "ROLL") {
    work.deadlineAt = base + ROLL_IDLE_MS;
    work.dueAt = work.deadlineAt;
  } else if (state.phase === "TRIAL_OFFER") {
    work.deadlineAt = base + TRIAL_IDLE_MS;
    work.dueAt = work.deadlineAt;
  } else {
    work.deadlineAt = base + (state.config.timeSeconds + (state.pending?.extraSeconds ?? 0)) * 1000;
    work.dueAt = work.deadlineAt + GRACE_MS;
  }
}

/** Aplica o resultado do motor: guarda o estado, escreve o histórico e marca o fim da partida. */
function applyResult(work: Work, result: EngineResult, at: number, reschedule = true) {
  work.state = result.state;
  work.touched = true;
  pushLog(work, lines(result.events, result.state));
  pushFeed(work, calloutsFor(result.events, result.state), at);
  if (result.state.phase === "FINISHED" && work.status === "PLAYING") {
    work.status = "FINISHED";
    work.justFinished = true;
  }
  if (reschedule) scheduleNext(work, at);
}

function rowOf(work: Work, playerKey: string) {
  return work.players.find((player) => keyOf(player) === playerKey);
}

/** Um bot assume o lugar de quem saiu ou ficou ausente. */
function replaceWithBot(work: Work, row: BoardRoomPlayer) {
  row.replaced = true;
  row.bot = "STUDENT";
  work.dirtyPlayers.add(row.id);
  const enginePlayer = work.state?.players.find((player) => player.id === keyOf(row));
  if (enginePlayer) enginePlayer.bot = { skill: "STUDENT" };
  work.touched = true;
}

function pickWrong(bank: QuestionBank, questionId: number, removed: OptionLetter[]): OptionLetter | null {
  const right = bank.correctOption(questionId);
  const wrong = (["A", "B", "C", "D"] as OptionLetter[]).filter((letter) => letter !== right && !removed.includes(letter));
  return wrong[Math.floor(Math.random() * wrong.length)] ?? null;
}

/** Faz o que venceu no relógio: gabarito a aplicar, bot a jogar ou jogador ausente. */
function stepDue(work: Work) {
  const state = work.state;
  const due = work.dueAt;
  if (!state || due === null) return;
  const bank = bankOf(work.pool);

  if (work.reveal) {
    const reveal = work.reveal;
    work.reveal = null;
    applyResult(work, guarded(() => answerQuestion(state, bank, reveal.correct)), due);
    return;
  }

  const current = currentPlayer(state);
  if (current.bot) {
    const action = botAction(state, bank);
    if (action.type === "ROLL") applyResult(work, guarded(() => rollDice(state, bank)), due);
    else if (action.type === "POWER") applyResult(work, guarded(() => usePowerUp(state, bank, action.kind, action.targetId)), due);
    else if (action.type === "TRIAL") applyResult(work, guarded(() => answerTrialOffer(state, bank, action.accept)), due);
    else if (state.pending) {
      const right = bank.correctOption(state.pending.questionId);
      const selected = action.correct ? right : pickWrong(bank, state.pending.questionId, state.pending.removed);
      work.reveal = { playerId: current.id, questionId: state.pending.questionId, selected, correct: selected === right, timedOut: false, correctOption: right, bot: true, at: due };
      work.touched = true;
      scheduleNext(work, due);
    }
    return;
  }

  // Pessoa ausente: o tempo acabou. Faltas seguidas passam o lugar a um bot.
  const row = rowOf(work, current.id);
  if (row) {
    row.afkStrikes += 1;
    work.dirtyPlayers.add(row.id);
  }
  if (state.phase === "ROLL") {
    applyResult(work, guarded(() => rollDice(state, bank)), due);
  } else if (state.phase === "TRIAL_OFFER") {
    applyResult(work, guarded(() => answerTrialOffer(state, bank, false)), due);
  } else if (state.pending) {
    work.reveal = {
      playerId: current.id,
      questionId: state.pending.questionId,
      selected: null,
      correct: false,
      timedOut: true,
      correctOption: bank.correctOption(state.pending.questionId),
      bot: false,
      at: due,
    };
    work.touched = true;
    scheduleNext(work, due);
  }
  if (row && row.afkStrikes >= AFK_LIMIT) {
    replaceWithBot(work, row);
    pushLog(work, [`${row.name} ficou ausente e um bot assumiu o lugar`]);
    scheduleNext(work, due);
  }
}

/** Alcança o relógio: resolve, em ordem, tudo que já venceu até `now`. */
function advance(work: Work, now: number) {
  if (work.status !== "PLAYING" || !work.state) return;
  for (let step = 0; step < MAX_STEPS && work.dueAt !== null && work.dueAt <= now && work.status === "PLAYING"; step += 1) {
    stepDue(work);
  }
}

// ---------------------------------------------------------------------------
// Carregar, guardar e montar a visão
// ---------------------------------------------------------------------------

async function load(tx: Tx, code: string): Promise<Work> {
  await tx.$queryRaw`SELECT id FROM board_rooms WHERE code = ${code} FOR UPDATE`;
  const room = await tx.boardRoom.findUnique({ where: { code }, include: { players: { orderBy: { slot: "asc" } } } });
  if (!room) throw notFound("Sala não encontrada. Confira o código.");
  const { players, ...bare } = room;
  return {
    room: bare,
    players,
    status: room.status,
    hostId: room.hostId,
    scenarioId: room.scenarioId,
    config: room.config as unknown as BoardConfig,
    state: (room.state as unknown as BoardState | null) ?? null,
    pool: (room.pool as unknown as BoardPoolItem[] | null) ?? [],
    reveal: (room.reveal as unknown as Reveal | null) ?? null,
    log: (room.log as unknown as string[]) ?? [],
    feed: (room.feed as unknown as FeedItem[] | null) ?? [],
    dueAt: room.dueAt?.getTime() ?? null,
    deadlineAt: room.deadlineAt?.getTime() ?? null,
    dirtyPlayers: new Set(),
    poolDirty: false,
    touched: false,
    justFinished: false,
    deleted: false,
  };
}

async function persist(tx: Tx, work: Work, now: number) {
  if (work.deleted) return;
  for (const row of work.players) {
    if (!work.dirtyPlayers.has(row.id)) continue;
    await tx.boardRoomPlayer.update({
      where: { id: row.id },
      data: { name: row.name, pawn: row.pawn, bot: row.bot, replaced: row.replaced, afkStrikes: row.afkStrikes, lastSeenAt: row.lastSeenAt },
    });
  }
  if (!work.touched) return;

  if (work.justFinished) {
    // Vitória online só conta com 2 ou mais pessoas na sala (contra bots sozinho não vale).
    const humans = work.players.filter((player) => player.userId !== null);
    const winnerId = work.state?.winnerId ?? null;
    const winner = humans.find((player) => keyOf(player) === winnerId && !player.replaced);
    if (winner?.userId && humans.length >= 2) {
      await tx.user.update({ where: { id: winner.userId }, data: { boardWins: { increment: 1 } } });
    }
  }

  await tx.boardRoom.update({
    where: { id: work.room.id },
    data: {
      hostId: work.hostId,
      scenarioId: work.scenarioId,
      status: work.status,
      config: work.config as unknown as Prisma.InputJsonValue,
      state: work.state ? (work.state as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      ...(work.poolDirty ? { pool: work.pool.length > 0 ? (work.pool as unknown as Prisma.InputJsonValue) : Prisma.JsonNull } : {}),
      reveal: work.reveal ? (work.reveal as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      log: work.log as unknown as Prisma.InputJsonValue,
      feed: work.feed as unknown as Prisma.InputJsonValue,
      version: { increment: 1 },
      dueAt: work.dueAt === null ? null : new Date(work.dueAt),
      deadlineAt: work.deadlineAt === null ? null : new Date(work.deadlineAt),
      startedAt: work.status === "PLAYING" && !work.room.startedAt ? new Date(now) : undefined,
      finishedAt: work.status === "FINISHED" ? new Date(now) : work.status === "LOBBY" ? null : undefined,
    },
  });
  if (work.status === "LOBBY") {
    // A sala voltou a reunir gente (revanche): convites antigos não valem.
    await tx.boardInvite.deleteMany({ where: { roomId: work.room.id } });
  }
}

type QuestionView = {
  id: number;
  text: string;
  difficulty: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  bibleReference: string | null;
};

async function buildView(tx: Tx, work: Work, userId: number, now: number) {
  const [scenario, host] = await Promise.all([
    tx.scenario.findUniqueOrThrow({
      where: { id: work.scenarioId },
      select: { id: true, slug: true, name: true, color: true, verse: true, verseReference: true, iconImageUrl: true, quizBackgroundUrl: true, boardImageUrl: true, boardPathStyle: true, boardLandmarks: true, musicUrl: true },
    }),
    tx.user.findUnique({ where: { id: work.hostId }, select: { name: true } }),
  ]);

  const state = work.state;
  let question: QuestionView | null = null;
  let reveal: (Omit<Reveal, "at" | "bot"> & { explanation: string | null; bibleReference: string | null }) | null = null;
  const pending = state?.pending ?? null;
  if (pending) {
    const row = await tx.question.findUnique({
      where: { id: pending.questionId },
      select: { id: true, text: true, difficulty: true, optionA: true, optionB: true, optionC: true, optionD: true, bibleReference: true, explanation: true },
    });
    if (row) {
      const showReference = pending.hint || Boolean(work.reveal);
      question = {
        id: row.id,
        text: row.text,
        difficulty: row.difficulty,
        optionA: row.optionA,
        optionB: row.optionB,
        optionC: row.optionC,
        optionD: row.optionD,
        bibleReference: showReference ? row.bibleReference : null,
      };
      if (work.reveal && work.reveal.questionId === row.id) {
        const { at: _at, bot: _bot, ...rest } = work.reveal;
        reveal = { ...rest, explanation: row.explanation, bibleReference: row.bibleReference };
      }
    }
  }

  const me = work.players.find((player) => player.userId === userId && !player.replaced) ?? null;
  const wins = work.status === "FINISHED" ? (await tx.user.findUnique({ where: { id: userId }, select: { boardWins: true } }))?.boardWins ?? 0 : null;

  return {
    changed: true as const,
    code: work.room.code,
    status: work.status,
    version: work.room.version + (work.touched ? 1 : 0),
    serverNow: now,
    hostUserId: work.hostId,
    hostName: host?.name ?? "",
    scenario,
    config: work.config,
    players: work.players.map((player) => ({
      key: keyOf(player),
      slot: player.slot,
      userId: player.userId,
      name: player.name,
      pawn: player.pawn,
      bot: player.bot as BotSkill | null,
      replaced: player.replaced,
      isHost: player.userId === work.hostId && !player.replaced,
      connected: player.bot ? true : now - player.lastSeenAt.getTime() < CONNECTED_MS,
    })),
    me: me ? { key: keyOf(me), userId, isHost: userId === work.hostId, wins } : null,
    // O sorteio e as perguntas já usadas não vão para o cliente.
    state: state ? { ...state, rng: 0, askedIds: [] } : null,
    question,
    reveal,
    log: work.log,
    feed: work.feed,
    deadlineAt: work.deadlineAt,
  };
}

export type RoomView = Awaited<ReturnType<typeof buildView>>;
export type RoomUnchanged = { changed: false; version: number; serverNow: number };

/** Abre a sala trancada, alcança o relógio, roda a ação e devolve a visão de quem pediu. */
async function runTx(tx: Tx, code: string, userId: number, opts: { member: boolean }, fn: (work: Work, me: BoardRoomPlayer | null, now: number) => Promise<void> | void) {
  const work = await load(tx, normalizeCode(code));
  const now = Date.now();
  const me = work.players.find((player) => player.userId === userId && !player.replaced) ?? null;
  if (opts.member && !me) throw forbidden("Você não está nesta sala");
  if (me && now - me.lastSeenAt.getTime() > SEEN_WRITE_MS) {
    me.lastSeenAt = new Date(now);
    work.dirtyPlayers.add(me.id);
  }
  advance(work, now);
  await fn(work, me, now);
  await persist(tx, work, now);
  if (work.deleted) return null;
  return buildView(tx, work, userId, now);
}

const run = (code: string, userId: number, opts: { member: boolean }, fn: Parameters<typeof runTx>[4]) => transaction((tx) => runTx(tx, code, userId, opts, fn));

// ---------------------------------------------------------------------------
// Criar, entrar, sair
// ---------------------------------------------------------------------------

/** Tira a pessoa da sala (lobby: sai de vez; jogo: um bot assume). Apaga a sala se não sobrar ninguém. */
async function removeMember(tx: Tx, work: Work, me: BoardRoomPlayer, now: number) {
  if (work.status === "PLAYING") {
    replaceWithBot(work, me);
    pushLog(work, [`${me.name} saiu e um bot assumiu o lugar`]);
    const humans = work.players.filter(isHuman);
    if (humans.length === 0) {
      // Só sobraram bots: ninguém para jogar.
      work.status = "FINISHED";
      work.reveal = null;
      work.dueAt = null;
      work.deadlineAt = null;
    } else {
      scheduleNext(work, now);
    }
    work.touched = true;
  } else {
    await tx.boardRoomPlayer.delete({ where: { id: me.id } });
    work.players = work.players.filter((player) => player.id !== me.id);
    work.touched = true;
  }
  const humans = work.players.filter(isHuman);
  if (humans.length === 0 && work.status !== "PLAYING") {
    await tx.boardRoom.delete({ where: { id: work.room.id } });
    work.deleted = true;
    return;
  }
  if (work.hostId === me.userId && humans.length > 0) work.hostId = humans[0].userId as number;
}

/** Antes de criar ou entrar em outra sala, a pessoa sai das que estavam abertas. */
async function leaveOtherRooms(tx: Tx, userId: number, exceptCode?: string) {
  const rows = await tx.boardRoomPlayer.findMany({ where: { userId, replaced: false, room: { code: { not: exceptCode ?? "" } } }, select: { room: { select: { code: true } } } });
  for (const row of rows) {
    const work = await load(tx, row.room.code);
    const me = work.players.find((player) => player.userId === userId && !player.replaced);
    if (!me) continue;
    const now = Date.now();
    await removeMember(tx, work, me, now);
    await persist(tx, work, now);
  }
}

async function newCode(tx: Tx): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
    if (!(await tx.boardRoom.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
  throw badRequest("Não foi possível gerar o código da sala. Tente de novo.");
}

export async function createRoom(userId: number, input: { scenarioId: number; config?: Partial<BoardConfig>; pawn?: string | null }) {
  const config = validateConfig(input.config);
  // Salas esquecidas (mais de um dia) saem do caminho.
  await prisma.boardRoom.deleteMany({ where: { updatedAt: { lt: new Date(Date.now() - ROOM_TTL_MS) } } });
  const code = await transaction(async (tx) => {
    const scenario = await tx.scenario.findFirst({ where: { id: input.scenarioId, active: true }, select: { id: true } });
    if (!scenario) throw notFound("Cenário não encontrado");
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });
    await leaveOtherRooms(tx, userId);
    const code = await newCode(tx);
    const pawn = await choosePawn(tx, userId, [], input.pawn);
    await tx.boardRoom.create({
      data: {
        code,
        hostId: userId,
        scenarioId: scenario.id,
        config: config as unknown as Prisma.InputJsonValue,
        players: { create: { slot: 0, userId, name: user.name.slice(0, NAME_MAX), pawn } },
      },
    });
    return code;
  });
  return getRoom(code, userId);
}

export async function joinRoom(userId: number, rawCode: string, input: { pawn?: string | null }) {
  const code = normalizeCode(rawCode);
  return transaction(async (tx) => {
    const existing = await tx.boardRoom.findUnique({ where: { code }, select: { id: true, status: true } });
    if (!existing) throw notFound("Sala não encontrada. Confira o código.");
    const already = await tx.boardRoomPlayer.findFirst({ where: { roomId: existing.id, userId, replaced: false }, select: { id: true } });
    if (!already) await leaveOtherRooms(tx, userId, code);
    return runTx(tx, code, userId, { member: false }, async (work, me, now) => {
      if (me) return; // já está na sala: só devolve a visão
      if (work.status !== "LOBBY") throw badRequest("A partida desta sala já começou");
      if (work.players.length >= MAX_PLAYERS) throw badRequest("A sala está cheia (6 jogadores)");
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });
      // Quem tinha sido substituído por bot nesta sala não volta no meio; aqui só entra gente nova.
      const pawn = await choosePawn(tx, userId, work.players, input.pawn);
      const row = await tx.boardRoomPlayer.create({ data: { roomId: work.room.id, slot: freeSlot(work.players), userId, name: user.name.slice(0, NAME_MAX), pawn, lastSeenAt: new Date(now) } });
      work.players = [...work.players, row].sort((left, right) => left.slot - right.slot);
      await tx.boardInvite.deleteMany({ where: { roomId: work.room.id, toUserId: userId } });
      pushLog(work, [`${row.name} entrou na sala`]);
      work.touched = true;
    });
  });
}

export async function leaveRoom(userId: number, code: string) {
  await transaction((tx) =>
    runTx(tx, code, userId, { member: true }, async (work, me, now) => {
      if (me) await removeMember(tx, work, me, now);
    }),
  );
}

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------

/** Consulta da sala. Com `since` igual à versão atual (e nada vencido no relógio), responde sem baixar o estado. */
export async function getRoom(rawCode: string, userId: number, since?: number): Promise<RoomView | RoomUnchanged> {
  const code = normalizeCode(rawCode);
  const now = Date.now();
  const room = await prisma.boardRoom.findUnique({ where: { code }, include: { players: { select: { id: true, userId: true, replaced: true, lastSeenAt: true } } } });
  if (!room) throw notFound("Sala não encontrada. Confira o código.");
  const mine = room.players.find((player) => player.userId === userId && !player.replaced);
  if (!mine) throw forbidden("Você não está nesta sala");
  const overdue = room.status === "PLAYING" && room.dueAt !== null && room.dueAt.getTime() <= now;
  if (since !== undefined && since === room.version && !overdue) {
    if (now - mine.lastSeenAt.getTime() > SEEN_WRITE_MS) await prisma.boardRoomPlayer.update({ where: { id: mine.id }, data: { lastSeenAt: new Date(now) } });
    return { changed: false, version: room.version, serverNow: now };
  }
  const view = await run(code, userId, { member: true }, () => undefined);
  if (!view) throw notFound("Sala não encontrada. Confira o código.");
  return view;
}

/** Sala em que a pessoa está agora (para voltar a ela). */
export async function myRoom(userId: number) {
  const row = await prisma.boardRoomPlayer.findFirst({
    where: { userId, replaced: false, room: { status: { in: ["LOBBY", "PLAYING"] } } },
    orderBy: { joinedAt: "desc" },
    select: { room: { select: { code: true, status: true, scenario: { select: { name: true } } } } },
  });
  return row ? { code: row.room.code, status: row.room.status, scenarioName: row.room.scenario.name } : null;
}

/** Prévia pública da sala para o link de convite (sem login): nada além do que o convite mostra. */
export async function publicRoom(rawCode: string) {
  const room = await prisma.boardRoom.findUnique({
    where: { code: normalizeCode(rawCode) },
    select: { code: true, status: true, host: { select: { name: true } }, scenario: { select: { name: true, color: true, slug: true, iconImageUrl: true } }, players: { select: { id: true } } },
  });
  if (!room) throw notFound("Sala não encontrada. Confira o código.");
  return { code: room.code, status: room.status, hostName: room.host.name, scenario: room.scenario, players: room.players.length, maxPlayers: MAX_PLAYERS };
}

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------

function requireHost(work: Work, userId: number) {
  if (work.hostId !== userId) throw forbidden("Só quem criou a sala pode fazer isso");
}

function requireLobby(work: Work) {
  if (work.status !== "LOBBY") throw badRequest("Isso só dá para fazer antes da partida começar");
}

export function updateConfig(userId: number, code: string, input: { scenarioId?: number; config?: Partial<BoardConfig> }) {
  return transaction((tx) =>
    runTx(tx, code, userId, { member: true }, async (work) => {
      requireHost(work, userId);
      requireLobby(work);
      if (input.scenarioId && input.scenarioId !== work.scenarioId) {
        const scenario = await tx.scenario.findFirst({ where: { id: input.scenarioId, active: true }, select: { id: true } });
        if (!scenario) throw notFound("Cenário não encontrado");
        work.scenarioId = scenario.id;
      }
      if (input.config) work.config = validateConfig(input.config, work.config);
      work.touched = true;
    }),
  );
}

export function setPawn(userId: number, code: string, pawn: string) {
  return transaction((tx) =>
    runTx(tx, code, userId, { member: true }, async (work, me) => {
      requireLobby(work);
      if (!me) return;
      const chosen = await choosePawn(tx, userId, work.players, pawn, me.id);
      if (chosen !== pawn) throw badRequest("Este peão não está disponível");
      me.pawn = chosen;
      work.dirtyPlayers.add(me.id);
      work.touched = true;
    }),
  );
}

export function addBot(userId: number, code: string, skill: BotSkill) {
  return transaction((tx) =>
    runTx(tx, code, userId, { member: true }, async (work) => {
      requireHost(work, userId);
      requireLobby(work);
      if (!BOT_SKILLS_LIST.includes(skill)) throw badRequest("Nível de bot inválido");
      if (work.players.length >= MAX_PLAYERS) throw badRequest("A sala está cheia (6 jogadores)");
      const taken = new Set(work.players.map((player) => player.name));
      const name = BOT_NAMES.find((candidate) => !taken.has(candidate)) ?? `Bot ${work.players.length + 1}`;
      const row = await tx.boardRoomPlayer.create({ data: { roomId: work.room.id, slot: freeSlot(work.players), name, pawn: await freePawn(tx, work.players), bot: skill } });
      work.players = [...work.players, row].sort((left, right) => left.slot - right.slot);
      work.touched = true;
    }),
  );
}

export function setBotSkill(userId: number, code: string, slot: number, skill: BotSkill) {
  return transaction((tx) =>
    runTx(tx, code, userId, { member: true }, (work) => {
      requireHost(work, userId);
      requireLobby(work);
      const row = work.players.find((player) => player.slot === slot && player.bot && !player.userId);
      if (!row || !BOT_SKILLS_LIST.includes(skill)) throw badRequest("Bot não encontrado");
      row.bot = skill;
      work.dirtyPlayers.add(row.id);
      work.touched = true;
    }),
  );
}

/** Tira um bot ou expulsa uma pessoa (só no lobby). */
export function removePlayer(userId: number, code: string, slot: number) {
  return transaction((tx) =>
    runTx(tx, code, userId, { member: true }, async (work) => {
      requireHost(work, userId);
      requireLobby(work);
      const row = work.players.find((player) => player.slot === slot);
      if (!row) throw notFound("Jogador não encontrado");
      if (row.userId === userId) throw badRequest("Para sair da sala, use o botão de sair");
      await tx.boardRoomPlayer.delete({ where: { id: row.id } });
      work.players = work.players.filter((player) => player.id !== row.id);
      pushLog(work, [row.bot ? `${row.name} (bot) saiu da mesa` : `${row.name} foi retirado da sala`]);
      work.touched = true;
    }),
  );
}

export function startGame(userId: number, code: string) {
  return transaction((tx) =>
    runTx(tx, code, userId, { member: true }, async (work, _me, now) => {
      requireHost(work, userId);
      requireLobby(work);
      if (work.players.length < MIN_PLAYERS) throw badRequest(`São necessários pelo menos ${MIN_PLAYERS} jogadores`);
      const scenario = await tx.scenario.findUniqueOrThrow({ where: { id: work.scenarioId }, select: { slug: true } });
      const count = Math.min(200, Math.max(40, Math.round(work.config.size * work.players.length * 0.9)));
      const pool = await pickBoardPool({ scenarioId: work.scenarioId, count });
      if (pool.length < 12) throw badRequest("Ainda não há perguntas suficientes para uma partida de tabuleiro.");
      const created = guarded(() =>
        createGame({
          config: work.config,
          rules: boardRulesFor(scenario.slug),
          players: work.players.map((player) => ({ id: keyOf(player), name: player.name, pawn: player.pawn, bot: (player.bot as BotSkill | null) ?? null })),
          seed: randomInt(2 ** 31 - 1),
          bank: bankOf(pool),
        }),
      );
      work.pool = pool;
      work.poolDirty = true;
      work.reveal = null;
      work.log = [];
      work.feed = [];
      work.status = "PLAYING";
      work.players.forEach((player) => {
        player.afkStrikes = 0;
        work.dirtyPlayers.add(player.id);
      });
      applyResult(work, created, now, false);
      scheduleNext(work, now);
      await tx.boardInvite.deleteMany({ where: { roomId: work.room.id } });
    }),
  );
}

/** Revanche: a sala volta ao lobby com os mesmos jogadores (quem foi substituído por bot sai). */
export function rematch(userId: number, code: string) {
  return transaction((tx) =>
    runTx(tx, code, userId, { member: true }, async (work) => {
      requireHost(work, userId);
      if (work.status !== "FINISHED") throw badRequest("A partida ainda não terminou");
      const gone = work.players.filter((player) => player.replaced);
      if (gone.length > 0) {
        await tx.boardRoomPlayer.deleteMany({ where: { id: { in: gone.map((player) => player.id) } } });
        work.players = work.players.filter((player) => !player.replaced);
      }
      work.status = "LOBBY";
      work.state = null;
      work.pool = [];
      work.poolDirty = true;
      work.reveal = null;
      work.log = [];
      work.feed = [];
      work.dueAt = null;
      work.deadlineAt = null;
      work.touched = true;
    }),
  );
}

// ---------------------------------------------------------------------------
// Jogadas
// ---------------------------------------------------------------------------

/** Garante que é a vez de quem pediu e que a sala não está esperando o gabarito. */
function requireTurn(work: Work, me: BoardRoomPlayer | null): BoardState {
  if (!me) throw forbidden("Você não está nesta sala");
  const state = work.state;
  if (work.status !== "PLAYING" || !state || state.phase === "FINISHED") throw badRequest("A partida não está em andamento");
  if (work.reveal) throw badRequest("Aguarde o gabarito");
  if (currentPlayer(state).id !== keyOf(me)) throw badRequest("Não é a sua vez");
  me.afkStrikes = 0;
  return state;
}

export function roll(userId: number, code: string) {
  return run(code, userId, { member: true }, (work, me, now) => {
    const state = requireTurn(work, me);
    applyResult(work, guarded(() => rollDice(state, bankOf(work.pool))), now);
    if (me) work.dirtyPlayers.add(me.id);
  });
}

export function usePower(userId: number, code: string, kind: PowerUpKind, targetKey?: string) {
  return run(code, userId, { member: true }, (work, me, now) => {
    const state = requireTurn(work, me);
    const before = { phase: state.phase, turn: state.turn, question: state.pending?.questionId ?? null };
    const result = guarded(() => usePowerUp(state, bankOf(work.pool), kind, targetKey));
    const after = result.state;
    const sameQuestion = before.phase === after.phase && before.turn === after.turn && before.question === (after.pending?.questionId ?? null);
    applyResult(work, result, now, !sameQuestion);
    if (sameQuestion && kind === "TIME" && work.deadlineAt !== null && work.dueAt !== null) {
      // Tempo extra: o cronômetro da pergunta ganha os segundos.
      work.deadlineAt += EXTRA_SECONDS * 1000;
      work.dueAt += EXTRA_SECONDS * 1000;
    }
    if (me) work.dirtyPlayers.add(me.id);
  });
}

export function answerTrial(userId: number, code: string, accept: boolean) {
  return run(code, userId, { member: true }, (work, me, now) => {
    const state = requireTurn(work, me);
    applyResult(work, guarded(() => answerTrialOffer(state, bankOf(work.pool), accept)), now);
    if (me) work.dirtyPlayers.add(me.id);
  });
}

/** Resposta da pergunta: o servidor confere e abre o gabarito para todos; a jogada vale quando o gabarito fecha. */
export function answer(userId: number, code: string, selected: OptionLetter | null) {
  return run(code, userId, { member: true }, (work, me, now) => {
    const state = requireTurn(work, me);
    const pending = state.pending;
    if (!pending) throw badRequest("Não há pergunta aberta");
    if (selected !== null && pending.removed.includes(selected)) throw badRequest("Esta alternativa foi eliminada");
    // O cronômetro da tela já acabou há mais que a folga: vale como tempo esgotado.
    const late = work.deadlineAt !== null && now > work.deadlineAt + GRACE_MS;
    const choice = late ? null : selected;
    const right = bankOf(work.pool).correctOption(pending.questionId);
    work.reveal = { playerId: keyOf(me as BoardRoomPlayer), questionId: pending.questionId, selected: choice, correct: choice !== null && choice === right, timedOut: choice === null, correctOption: right, bot: false, at: now };
    work.touched = true;
    scheduleNext(work, now);
    if (me) work.dirtyPlayers.add(me.id);
  });
}

/** Quem respondeu pode fechar o gabarito antes do tempo e seguir a partida. */
export function continueAfterReveal(userId: number, code: string) {
  return run(code, userId, { member: true }, (work, me, now) => {
    const reveal = work.reveal;
    if (!reveal || !me || reveal.playerId !== keyOf(me)) return;
    const state = work.state;
    if (!state) return;
    work.reveal = null;
    applyResult(work, guarded(() => answerQuestion(state, bankOf(work.pool), reveal.correct)), now);
  });
}

// ---------------------------------------------------------------------------
// Convites
// ---------------------------------------------------------------------------

export function inviteFriend(userId: number, code: string, friendId: number) {
  return transaction((tx) =>
    runTx(tx, code, userId, { member: true }, async (work) => {
      requireLobby(work);
      if (work.players.length >= MAX_PLAYERS) throw badRequest("A sala está cheia (6 jogadores)");
      if (work.players.some((player) => player.userId === friendId)) throw badRequest("Essa pessoa já está na sala");
      if (!(await areFriends(tx, userId, friendId))) throw forbidden("Você só pode convidar amigos");
      await tx.boardInvite.upsert({
        where: { roomId_toUserId: { roomId: work.room.id, toUserId: friendId } },
        create: { roomId: work.room.id, fromUserId: userId, toUserId: friendId },
        update: { fromUserId: userId, createdAt: new Date() },
      });
    }),
  );
}

/** Convites que o jogador recebeu para salas que ainda estão reunindo gente. */
export async function listInvites(userId: number) {
  const invites = await prisma.boardInvite.findMany({
    where: { toUserId: userId, createdAt: { gt: new Date(Date.now() - 2 * 60 * 60 * 1000) }, room: { status: "LOBBY", players: { none: { userId } } } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, createdAt: true, from: { select: { name: true } }, room: { select: { code: true, scenario: { select: { name: true } }, players: { select: { id: true } } } } },
  });
  return invites
    .filter((invite) => invite.room.players.length < MAX_PLAYERS)
    .map((invite) => ({ id: invite.id, code: invite.room.code, fromName: invite.from.name, scenarioName: invite.room.scenario.name, players: invite.room.players.length, createdAt: invite.createdAt }));
}

export async function dismissInvite(userId: number, inviteId: number) {
  await prisma.boardInvite.deleteMany({ where: { id: inviteId, toUserId: userId } });
}
