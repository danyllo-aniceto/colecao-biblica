import { randomInt } from "node:crypto";
import { Prisma, type DuelRoom, type DuelRoomPlayer, type DuelRoomStatus } from "@prisma/client";
import { prisma, transaction } from "../db/prisma";
import { badRequest, forbidden, HttpError, notFound } from "../lib/errors";
import { botTeam } from "../duel/bot-team";
import { playBotTurn, type BotSkill } from "../duel/bots";
import { doubleStakes, newDuel, retreat, setReady, stage, unstage, viewFor, whyNotDouble, whyNotRetreat, whyNotStage } from "../duel/engine";
import { applyRound, newSeries, SERIES_FORMATS, type Series, type SeriesFormat } from "../duel/series";
import { TEAM_SIZE, type CardDef, type DuelEvent, type DuelState, type Side, type TeamCard } from "../duel/types";
import { toCardDef } from "./duel-cards";
import { getSettings } from "./settings";
import { areFriends } from "./social";
import { visibleCharacter } from "./visibility";

/**
 * Salas online do Duelo de Figurinhas.
 *
 * Mesmo molde do Tabuleiro: sem WebSocket (a API roda em funções da Vercel), o cliente consulta a sala a cada poucos
 * segundos e só baixa o estado quando a versão muda. O motor roda aqui, com as mãos dos dois, e cada jogador recebe só
 * a `viewFor` do seu lado (mão e baralho do rival, jogadas ainda não reveladas e arenas fechadas nunca saem do servidor).
 * Tudo que é "sozinho" (bot jogando, tempo do turno, próxima rodada) acontece de forma preguiçosa: a próxima consulta
 * ou jogada alcança o relógio da sala e resolve o que já venceu, na ordem.
 */

type Tx = Prisma.TransactionClient;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_PLAYERS = 2;
export const TURN_OPTIONS = [30, 45, 60] as const;
/** Folga entre o fim do cronômetro na tela e o servidor jogar pela pessoa. */
const GRACE_MS = 2500;
/** Tempo que cada passo da repetição leva na tela (estimativa): o prazo do turno só começa depois dela. */
const STEP_MS = 2300;
const MAX_PLAYBACK_MS = 30_000;
/** Depois de uma rodada, espera os dois tocarem em "Próxima rodada" por este tempo; vencido, a próxima começa sozinha. */
const ROUND_BREAK_MS = 60_000;
/** Faltas seguidas (tempo esgotado) para um bot assumir o lugar. */
const AFK_LIMIT = 3;
const MAX_LOG = 40;
const MAX_STEPS = 60;
const CONNECTED_MS = 20_000;
const SEEN_WRITE_MS = 8000;
const NAME_MAX = 24;
const BOT_NAMES = ["Davi", "Ester", "Daniel", "Rute", "Calebe", "Débora", "Josué", "Miriã", "Neemias", "Lídia", "Samuel", "Ana"];
const BOT_SKILLS: BotSkill[] = ["APPRENTICE", "STUDENT", "MASTER"];
const MAX_DECK_SLOT = 5;

export type DuelRoomConfig = { format: SeriesFormat; levels: boolean; turnSeconds: number };
export const DEFAULT_DUEL_CONFIG: DuelRoomConfig = { format: "bo3", levels: false, turnSeconds: 45 };

type Teams = [TeamCard[], TeamCard[]];

type Work = {
  room: DuelRoom;
  players: DuelRoomPlayer[];
  status: DuelRoomStatus;
  hostId: number;
  config: DuelRoomConfig;
  state: DuelState | null;
  series: Series | null;
  teams: Teams | null;
  acks: number[];
  log: string[];
  dueAt: number | null;
  deadlineAt: number | null;
  dirtyPlayers: Set<number>;
  touched: boolean;
  /** Mudança que só o dono vê (colocar figurinha na mesa): não sobe a versão. */
  quiet: boolean;
  deleted: boolean;
};

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const keyOf = (player: Pick<DuelRoomPlayer, "userId" | "slot">) => (player.userId ? `u${player.userId}` : `b${player.slot}`);
const isHuman = (player: DuelRoomPlayer) => player.userId !== null && !player.replaced;
/** Pessoas na sala (bots não contam: um amigo que chega toma o lugar do bot). */
const humanCount = (players: Array<{ userId: number | null }>) => players.filter((player) => player.userId !== null).length;
const normalizeCode = (code: string) => code.trim().toUpperCase();
const sideOf = (player: Pick<DuelRoomPlayer, "slot">): Side => (player.slot === 0 ? 0 : 1);
const other = (side: Side): Side => (side === 0 ? 1 : 0);

/** Erros do motor (mensagens em português) viram resposta 400. */
function guarded<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof Error && !(error instanceof HttpError) && !(error instanceof Prisma.PrismaClientKnownRequestError)) throw badRequest(error.message);
    throw error;
  }
}

function pushLog(work: Work, lines: string[]) {
  if (lines.length > 0) work.log = [...work.log, ...lines].slice(-MAX_LOG);
}

function freeSlot(players: DuelRoomPlayer[]): number {
  for (let slot = 0; slot < MAX_PLAYERS; slot += 1) if (!players.some((player) => player.slot === slot)) return slot;
  throw badRequest("A sala está cheia");
}

export function validateConfig(input: Partial<DuelRoomConfig> | undefined, base: DuelRoomConfig = DEFAULT_DUEL_CONFIG): DuelRoomConfig {
  const config = { ...base, ...(input ?? {}) };
  if (!SERIES_FORMATS.some((entry) => entry.id === config.format)) throw badRequest("Tipo de partida inválido");
  if (!(TURN_OPTIONS as readonly number[]).includes(config.turnSeconds)) throw badRequest("Tempo por turno inválido");
  return { format: config.format, levels: Boolean(config.levels), turnSeconds: config.turnSeconds };
}

/** Quanto tempo a tela leva repetindo o que aconteceu (para o prazo do turno só valer depois disso). */
function playbackMs(events: DuelEvent[]): number {
  const steps = events.filter((event) => event.snap && !["play", "draw", "win"].includes(event.type)).length;
  return Math.min(MAX_PLAYBACK_MS, steps === 0 ? 0 : 1500 + steps * STEP_MS);
}

// ---------------------------------------------------------------------------
// Relógio e andamento da sala
// ---------------------------------------------------------------------------

/** Define quando o servidor precisa agir de novo e até quando os jogadores têm para jogar o turno. */
function scheduleNext(work: Work, base: number) {
  const state = work.state;
  if (!state || work.status !== "PLAYING") {
    work.dueAt = null;
    work.deadlineAt = null;
    return;
  }
  if (state.status === "finished") {
    // Entre rodadas: espera os "Próxima rodada"; vencido o tempo, a próxima começa sozinha.
    work.deadlineAt = null;
    work.dueAt = base + ROUND_BREAK_MS;
    return;
  }
  work.deadlineAt = base + work.config.turnSeconds * 1000;
  work.dueAt = work.deadlineAt + GRACE_MS;
}

/** Guarda o novo estado da rodada; se ela acabou, conta no placar da série. */
function commit(work: Work, next: DuelState, at: number) {
  const previous = work.state;
  work.state = next;
  work.touched = true;
  if (previous && previous.status === "playing" && next.status === "finished" && next.result && work.series) {
    work.series = applyRound(work.series, next.result);
    const round = work.series.history.length;
    const winner = next.result.winner === null ? null : work.players.find((player) => sideOf(player) === next.result!.winner);
    pushLog(work, [winner ? `Rodada ${round}: ${winner.name} venceu (aposta ${next.result.stakes}${next.result.retreated !== null ? ", o rival desistiu" : ""}).` : `Rodada ${round}: empate.`]);
    if (work.series.over) {
      work.status = "FINISHED";
      const champion = work.series.winner === null ? null : work.players.find((player) => sideOf(player) === work.series!.winner);
      pushLog(work, [champion ? `${champion.name} venceu o duelo!` : "O duelo terminou empatado."]);
    }
  }
  // O prazo só recomeça quando o turno (ou a rodada) muda; colocar figurinha, dobrar ou dizer "Pronto" não estica o tempo.
  const advanced = !previous || previous.turn !== next.turn || previous.status !== next.status || previous.nextUid > next.nextUid;
  if (advanced) scheduleNext(work, at + playbackMs(next.events));
  if (work.status === "FINISHED") {
    work.dueAt = null;
    work.deadlineAt = null;
  }
}

/** Os bots jogam o turno assim que ele começa (sem ver nada do rival além do que é público). */
function botsPlay(work: Work, at: number) {
  for (let guard = 0; guard < 4; guard += 1) {
    const state = work.state;
    if (!state || state.status !== "playing") return;
    const bot = work.players.find((player) => player.bot && !isHuman(player) && !state.players[sideOf(player)].ready);
    if (!bot) return;
    commit(work, playBotTurn(state, sideOf(bot), bot.bot as BotSkill), at);
  }
}

function startRound(work: Work, at: number) {
  if (!work.teams || !work.series) return;
  work.acks = [];
  commit(work, newDuel({ teams: work.teams, seed: randomInt(2 ** 31 - 1), stakesMatter: work.config.format !== "single" }), at);
  botsPlay(work, at);
}

/** Um bot assume o lugar de quem saiu ou ficou ausente. */
function replaceWithBot(work: Work, row: DuelRoomPlayer) {
  row.replaced = true;
  row.bot = "STUDENT";
  work.dirtyPlayers.add(row.id);
  work.touched = true;
}

/** Faz o que venceu no relógio: o tempo do turno acabou (joga pela pessoa ausente) ou a próxima rodada deve começar. */
function stepDue(work: Work) {
  const state = work.state;
  const due = work.dueAt;
  if (!state || due === null) return;

  if (state.status === "finished") {
    startRound(work, due);
    return;
  }

  for (const row of work.players) {
    const side = sideOf(row);
    if (!isHuman(row) || work.state!.players[side].ready || work.state!.status !== "playing") continue;
    row.afkStrikes += 1;
    work.dirtyPlayers.add(row.id);
    if (row.afkStrikes >= AFK_LIMIT) {
      replaceWithBot(work, row);
      pushLog(work, [`${row.name} ficou ausente e um bot assumiu o lugar`]);
      botsPlay(work, due);
    } else {
      // Vale o que a pessoa já tinha colocado na mesa.
      commit(work, setReady(work.state!, side), due);
      botsPlay(work, due);
    }
  }
  // Nada andou (todos já estavam prontos): evita laço — reagenda a partir do prazo vencido.
  if (work.dueAt !== null && work.dueAt <= due) scheduleNext(work, due);
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
  await tx.$queryRaw`SELECT id FROM duel_rooms WHERE code = ${code} FOR UPDATE`;
  const room = await tx.duelRoom.findUnique({ where: { code }, include: { players: { orderBy: { slot: "asc" } } } });
  if (!room) throw notFound("Sala não encontrada. Confira o código.");
  const { players, ...bare } = room;
  return {
    room: bare,
    players,
    status: room.status,
    hostId: room.hostId,
    config: room.config as unknown as DuelRoomConfig,
    state: (room.state as unknown as DuelState | null) ?? null,
    series: (room.series as unknown as Series | null) ?? null,
    teams: (room.teams as unknown as Teams | null) ?? null,
    acks: (room.acks as unknown as number[]) ?? [],
    log: (room.log as unknown as string[]) ?? [],
    dueAt: room.dueAt?.getTime() ?? null,
    deadlineAt: room.deadlineAt?.getTime() ?? null,
    dirtyPlayers: new Set(),
    touched: false,
    quiet: false,
    deleted: false,
  };
}

async function persist(tx: Tx, work: Work, now: number) {
  if (work.deleted) return;
  for (const row of work.players) {
    if (!work.dirtyPlayers.has(row.id)) continue;
    await tx.duelRoomPlayer.update({
      where: { id: row.id },
      data: { name: row.name, bot: row.bot, replaced: row.replaced, afkStrikes: row.afkStrikes, deckSlot: row.deckSlot, lastSeenAt: row.lastSeenAt },
    });
  }
  if (!work.touched) return;

  const json = (value: unknown) => (value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue));
  await tx.duelRoom.update({
    where: { id: work.room.id },
    data: {
      hostId: work.hostId,
      status: work.status,
      config: work.config as unknown as Prisma.InputJsonValue,
      state: json(work.state),
      series: json(work.series),
      teams: json(work.teams),
      acks: work.acks,
      log: work.log,
      ...(work.quiet ? {} : { version: { increment: 1 } }),
      dueAt: work.dueAt === null ? null : new Date(work.dueAt),
      deadlineAt: work.deadlineAt === null ? null : new Date(work.deadlineAt),
      startedAt: work.status === "PLAYING" && !work.room.startedAt ? new Date(now) : undefined,
      finishedAt: work.status === "FINISHED" ? new Date(now) : work.status === "LOBBY" ? null : undefined,
    },
  });
  if (work.status === "LOBBY") {
    // A sala voltou a reunir gente (revanche): convites antigos não valem.
    await tx.duelInvite.deleteMany({ where: { roomId: work.room.id } });
  }
}

async function buildView(tx: Tx, work: Work, userId: number, now: number) {
  const host = await tx.user.findUnique({ where: { id: work.hostId }, select: { name: true } });
  const me = work.players.find((player) => player.userId === userId && !player.replaced) ?? null;
  const myDeck = me?.deckSlot ? await tx.duelDeck.findUnique({ where: { userId_slot: { userId, slot: me.deckSlot } }, select: { name: true } }) : null;

  return {
    changed: true as const,
    code: work.room.code,
    status: work.status,
    version: work.room.version + (work.touched && !work.quiet ? 1 : 0),
    serverNow: now,
    hostUserId: work.hostId,
    hostName: host?.name ?? "",
    config: work.config,
    players: work.players.map((player) => ({
      key: keyOf(player),
      slot: player.slot,
      userId: player.userId,
      name: player.name,
      bot: player.bot as BotSkill | null,
      replaced: player.replaced,
      isHost: player.userId === work.hostId && !player.replaced,
      connected: player.bot ? true : now - player.lastSeenAt.getTime() < CONNECTED_MS,
      /** Só se sabe se o outro já escolheu o Time, não qual. */
      hasDeck: player.bot ? true : player.deckSlot !== null,
    })),
    me: me ? { slot: me.slot, key: keyOf(me), userId, isHost: userId === work.hostId, deckSlot: me.deckSlot, deckName: myDeck?.name ?? null } : null,
    series: work.series,
    // A visão do duelo é a do seu lado: o servidor nunca manda a mão do rival, o baralho nem o sorteio.
    duel: work.state && me ? viewFor(work.state, sideOf(me)) : null,
    round: work.series ? work.series.history.length + (work.state?.status === "finished" ? 0 : 1) : 0,
    /** Entre rodadas: até quando espera e quem já pediu a próxima. */
    roundBreak: work.state?.status === "finished" && work.status === "PLAYING" ? { dueAt: work.dueAt, acks: work.acks } : null,
    log: work.log,
    deadlineAt: work.deadlineAt,
  };
}

export type DuelRoomView = Awaited<ReturnType<typeof buildView>>;
export type DuelRoomUnchanged = { changed: false; version: number; serverNow: number };

/** Abre a sala trancada, alcança o relógio, roda a ação e devolve a visão de quem pediu. */
async function runTx(tx: Tx, code: string, userId: number, opts: { member: boolean }, fn: (work: Work, me: DuelRoomPlayer | null, now: number) => Promise<void> | void) {
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
async function removeMember(tx: Tx, work: Work, me: DuelRoomPlayer, now: number) {
  if (work.status === "PLAYING") {
    replaceWithBot(work, me);
    pushLog(work, [`${me.name} saiu e um bot assumiu o lugar`]);
    if (work.players.filter(isHuman).length === 0) {
      // Só sobraram bots: ninguém para jogar.
      work.status = "FINISHED";
      work.dueAt = null;
      work.deadlineAt = null;
    } else {
      botsPlay(work, now);
      scheduleNext(work, now);
    }
    work.touched = true;
  } else {
    await tx.duelRoomPlayer.delete({ where: { id: me.id } });
    work.players = work.players.filter((player) => player.id !== me.id);
    work.touched = true;
  }
  const humans = work.players.filter(isHuman);
  if (humans.length === 0 && work.status !== "PLAYING") {
    await tx.duelRoom.delete({ where: { id: work.room.id } });
    work.deleted = true;
    return;
  }
  if (work.hostId === me.userId && humans.length > 0) work.hostId = humans[0].userId as number;
}

/** Antes de criar ou entrar em outra sala, a pessoa sai das que estavam abertas. */
async function leaveOtherRooms(tx: Tx, userId: number, exceptCode?: string) {
  const rows = await tx.duelRoomPlayer.findMany({ where: { userId, replaced: false, room: { code: { not: exceptCode ?? "" } } }, select: { room: { select: { code: true } } } });
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
    if (!(await tx.duelRoom.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
  throw badRequest("Não foi possível gerar o código da sala. Tente de novo.");
}

/** O Time escolhido precisa existir e ser do jogador. */
async function checkDeck(tx: Tx, userId: number, deckSlot: number | null | undefined): Promise<number | null> {
  if (deckSlot === null || deckSlot === undefined) return null;
  if (!Number.isInteger(deckSlot) || deckSlot < 1 || deckSlot > MAX_DECK_SLOT) throw badRequest("Time inválido");
  const deck = await tx.duelDeck.findUnique({ where: { userId_slot: { userId, slot: deckSlot } }, select: { id: true } });
  if (!deck) throw badRequest("Esse Time não existe mais. Escolha outro.");
  return deckSlot;
}

export async function createRoom(userId: number, input: { config?: Partial<DuelRoomConfig>; deckSlot?: number | null }) {
  const config = validateConfig(input.config);
  // Salas esquecidas (mais de um dia) saem do caminho.
  await prisma.duelRoom.deleteMany({ where: { updatedAt: { lt: new Date(Date.now() - ROOM_TTL_MS) } } });
  const code = await transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });
    await leaveOtherRooms(tx, userId);
    const code = await newCode(tx);
    const deckSlot = await checkDeck(tx, userId, input.deckSlot);
    await tx.duelRoom.create({
      data: {
        code,
        hostId: userId,
        config: config as unknown as Prisma.InputJsonValue,
        players: { create: { slot: 0, userId, name: user.name.slice(0, NAME_MAX), deckSlot } },
      },
    });
    return code;
  });
  return getRoom(code, userId);
}

export async function joinRoom(userId: number, rawCode: string, input: { deckSlot?: number | null }) {
  const code = normalizeCode(rawCode);
  return transaction(async (tx) => {
    const existing = await tx.duelRoom.findUnique({ where: { code }, select: { id: true } });
    if (!existing) throw notFound("Sala não encontrada. Confira o código.");
    const already = await tx.duelRoomPlayer.findFirst({ where: { roomId: existing.id, userId, replaced: false }, select: { id: true } });
    if (!already) await leaveOtherRooms(tx, userId, code);
    return runTx(tx, code, userId, { member: false }, async (work, me, now) => {
      if (me) return; // já está na sala: só devolve a visão
      if (work.status !== "LOBBY") throw badRequest("A partida desta sala já começou");
      // Só pessoas enchem a sala: se a vaga está com um bot, quem chegou toma o lugar dele.
      if (humanCount(work.players) >= MAX_PLAYERS) throw badRequest("A sala está cheia (2 jogadores)");
      const bot = work.players.find((player) => player.userId === null);
      if (bot && work.players.length >= MAX_PLAYERS) {
        await tx.duelRoomPlayer.delete({ where: { id: bot.id } });
        work.players = work.players.filter((player) => player.id !== bot.id);
      }
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });
      const deckSlot = await checkDeck(tx, userId, input.deckSlot);
      const row = await tx.duelRoomPlayer.create({ data: { roomId: work.room.id, slot: freeSlot(work.players), userId, name: user.name.slice(0, NAME_MAX), deckSlot, lastSeenAt: new Date(now) } });
      work.players = [...work.players, row].sort((left, right) => left.slot - right.slot);
      await tx.duelInvite.deleteMany({ where: { roomId: work.room.id, toUserId: userId } });
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
export async function getRoom(rawCode: string, userId: number, since?: number): Promise<DuelRoomView | DuelRoomUnchanged> {
  const code = normalizeCode(rawCode);
  const now = Date.now();
  const room = await prisma.duelRoom.findUnique({ where: { code }, include: { players: { select: { id: true, userId: true, replaced: true, lastSeenAt: true } } } });
  if (!room) throw notFound("Sala não encontrada. Confira o código.");
  const mine = room.players.find((player) => player.userId === userId && !player.replaced);
  if (!mine) throw forbidden("Você não está nesta sala");
  const overdue = room.status === "PLAYING" && room.dueAt !== null && room.dueAt.getTime() <= now;
  if (since !== undefined && since === room.version && !overdue) {
    if (now - mine.lastSeenAt.getTime() > SEEN_WRITE_MS) await prisma.duelRoomPlayer.update({ where: { id: mine.id }, data: { lastSeenAt: new Date(now) } });
    return { changed: false, version: room.version, serverNow: now };
  }
  const view = await run(code, userId, { member: true }, () => undefined);
  if (!view) throw notFound("Sala não encontrada. Confira o código.");
  return view;
}

/** Sala em que a pessoa está agora (para voltar a ela). */
export async function myRoom(userId: number) {
  const row = await prisma.duelRoomPlayer.findFirst({
    where: { userId, replaced: false, room: { status: { in: ["LOBBY", "PLAYING"] } } },
    orderBy: { joinedAt: "desc" },
    select: { room: { select: { code: true, status: true } } },
  });
  return row ? { code: row.room.code, status: row.room.status } : null;
}

/** Prévia pública da sala para o link de convite (sem login): nada além do que o convite mostra. */
export async function publicRoom(rawCode: string) {
  const room = await prisma.duelRoom.findUnique({
    where: { code: normalizeCode(rawCode) },
    select: { code: true, status: true, host: { select: { name: true } }, players: { select: { id: true, userId: true } } },
  });
  if (!room) throw notFound("Sala não encontrada. Confira o código.");
  return { code: room.code, status: room.status, hostName: room.host.name, players: room.players.filter((player) => player.userId !== null).length, maxPlayers: MAX_PLAYERS };
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

export function updateConfig(userId: number, code: string, input: { config?: Partial<DuelRoomConfig> }) {
  return run(code, userId, { member: true }, (work) => {
    requireHost(work, userId);
    requireLobby(work);
    if (input.config) work.config = validateConfig(input.config, work.config);
    work.touched = true;
  });
}

export function setDeck(userId: number, code: string, deckSlot: number) {
  return transaction((tx) =>
    runTx(tx, code, userId, { member: true }, async (work, me) => {
      requireLobby(work);
      if (!me) return;
      me.deckSlot = await checkDeck(tx, userId, deckSlot);
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
      if (!BOT_SKILLS.includes(skill)) throw badRequest("Nível de bot inválido");
      if (work.players.length >= MAX_PLAYERS) throw badRequest("A sala está cheia (2 jogadores)");
      const taken = new Set(work.players.map((player) => player.name));
      const name = BOT_NAMES.find((candidate) => !taken.has(candidate)) ?? "Bot";
      const row = await tx.duelRoomPlayer.create({ data: { roomId: work.room.id, slot: freeSlot(work.players), name, bot: skill } });
      work.players = [...work.players, row].sort((left, right) => left.slot - right.slot);
      work.touched = true;
    }),
  );
}

export function setBotSkill(userId: number, code: string, slot: number, skill: BotSkill) {
  return run(code, userId, { member: true }, (work) => {
    requireHost(work, userId);
    requireLobby(work);
    const row = work.players.find((player) => player.slot === slot && player.bot && !player.userId);
    if (!row || !BOT_SKILLS.includes(skill)) throw badRequest("Bot não encontrado");
    row.bot = skill;
    work.dirtyPlayers.add(row.id);
    work.touched = true;
  });
}

/** Tira o bot ou expulsa a pessoa (só no lobby). */
export function removePlayer(userId: number, code: string, slot: number) {
  return transaction((tx) =>
    runTx(tx, code, userId, { member: true }, async (work) => {
      requireHost(work, userId);
      requireLobby(work);
      const row = work.players.find((player) => player.slot === slot);
      if (!row) throw notFound("Jogador não encontrado");
      if (row.userId === userId) throw badRequest("Para sair da sala, use o botão de sair");
      await tx.duelRoomPlayer.delete({ where: { id: row.id } });
      work.players = work.players.filter((player) => player.id !== row.id);
      pushLog(work, [row.bot ? `${row.name} (bot) saiu da mesa` : `${row.name} foi retirado da sala`]);
      work.touched = true;
    }),
  );
}

/** Time de um jogador para a partida: figurinhas do Time salvo (todas disponíveis e ainda dele) com o nível das figurinhas. */
async function humanTeam(tx: Tx, row: DuelRoomPlayer, config: DuelRoomConfig): Promise<TeamCard[]> {
  if (row.deckSlot === null || row.userId === null) throw badRequest(`${row.name} ainda não escolheu um Time`);
  const deck = await tx.duelDeck.findUnique({ where: { userId_slot: { userId: row.userId, slot: row.deckSlot } } });
  if (!deck) throw badRequest(`${row.name} precisa escolher um Time`);
  const [cards, stickers] = await Promise.all([
    tx.duelCard.findMany({ where: { characterId: { in: deck.characterIds }, available: true, character: visibleCharacter() }, include: { character: { select: { id: true, name: true, imageUrl: true } } } }),
    tx.userSticker.findMany({ where: { userId: row.userId, characterId: { in: deck.characterIds } }, select: { characterId: true, level: true } }),
  ]);
  const defs = new Map(cards.flatMap((card) => toCardDef(card) ?? []).map((def) => [def.id, def]));
  const levels = new Map(stickers.map((sticker) => [sticker.characterId, sticker.level]));
  const team: TeamCard[] = [];
  for (const id of deck.characterIds) {
    const def = defs.get(String(id));
    if (!def || !levels.has(id)) throw badRequest(`${row.name}: o Time "${deck.name}" tem figurinha que saiu do jogo ou que não é mais dele. Edite o Time.`);
    team.push({ def, level: config.levels ? (levels.get(id) ?? 1) : 1 });
  }
  if (team.length !== TEAM_SIZE) throw badRequest(`${row.name}: o Time "${deck.name}" precisa de ${TEAM_SIZE} figurinhas`);
  return team;
}

export function startGame(userId: number, code: string) {
  return transaction((tx) =>
    runTx(tx, code, userId, { member: true }, async (work, _me, now) => {
      requireHost(work, userId);
      requireLobby(work);
      if (work.players.length < MAX_PLAYERS) throw badRequest("Chame um amigo ou um bot para jogar");
      const teams: TeamCard[][] = [[], []];
      for (const row of work.players.filter(isHuman)) teams[row.slot] = await humanTeam(tx, row, work.config);
      const bots = work.players.filter((row) => !isHuman(row));
      if (bots.length > 0) {
        const humanCards = teams.flat();
        const average = humanCards.length ? Math.round(humanCards.reduce((sum, card) => sum + (card.level ?? 1), 0) / humanCards.length) : 1;
        const rows = await tx.duelCard.findMany({ where: { available: true, character: visibleCharacter() }, include: { character: { select: { id: true, name: true, imageUrl: true } } } });
        const pool: CardDef[] = rows.flatMap((row) => toCardDef(row) ?? []);
        for (const bot of bots) {
          const built = botTeam(pool, randomInt(2 ** 31 - 1), work.config.levels ? average : 1);
          if (!built) throw badRequest("Ainda não há figurinhas suficientes no Duelo para o bot montar um Time.");
          teams[bot.slot] = built;
        }
      }
      work.teams = [teams[0], teams[1]];
      work.series = newSeries(work.config.format);
      work.log = [];
      work.status = "PLAYING";
      work.players.forEach((player) => {
        player.afkStrikes = 0;
        work.dirtyPlayers.add(player.id);
      });
      startRound(work, now);
      await tx.duelInvite.deleteMany({ where: { roomId: work.room.id } });
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
        await tx.duelRoomPlayer.deleteMany({ where: { id: { in: gone.map((player) => player.id) } } });
        work.players = work.players.filter((player) => !player.replaced);
      }
      work.status = "LOBBY";
      work.state = null;
      work.series = null;
      work.teams = null;
      work.acks = [];
      work.log = [];
      work.dueAt = null;
      work.deadlineAt = null;
      work.touched = true;
    }),
  );
}

// ---------------------------------------------------------------------------
// Jogadas
// ---------------------------------------------------------------------------

/** Garante que a rodada está em andamento e devolve o lado de quem pediu. */
function requireRound(work: Work, me: DuelRoomPlayer | null): { state: DuelState; side: Side } {
  if (!me) throw forbidden("Você não está nesta sala");
  const state = work.state;
  if (work.status !== "PLAYING" || !state || state.status !== "playing") throw badRequest("A rodada não está em andamento");
  return { state, side: sideOf(me) };
}

export function stageCard(userId: number, code: string, uid: number, lane: number) {
  return run(code, userId, { member: true }, (work, me, now) => {
    const { state, side } = requireRound(work, me);
    const why = whyNotStage(state, side, uid, lane);
    if (why) throw badRequest(why);
    // Colocar figurinha na mesa é segredo do dono: o rival não vê, então a versão só sobe se algo mais mudou antes.
    const secret = !work.touched;
    commit(work, stage(state, side, uid, lane), now);
    work.quiet = secret;
  });
}

export function unstageCard(userId: number, code: string, uid: number) {
  return run(code, userId, { member: true }, (work, me, now) => {
    const { state, side } = requireRound(work, me);
    const secret = !work.touched;
    commit(work, guarded(() => unstage(state, side, uid)), now);
    work.quiet = secret;
  });
}

/** "Pronto": se o rival já está pronto, o turno é resolvido na hora. */
export function ready(userId: number, code: string) {
  return run(code, userId, { member: true }, (work, me, now) => {
    const { state, side } = requireRound(work, me);
    if (state.players[side].ready) return;
    if (me) {
      me.afkStrikes = 0;
      work.dirtyPlayers.add(me.id);
    }
    commit(work, guarded(() => setReady(state, side)), now);
    botsPlay(work, now);
  });
}

export function doubleDown(userId: number, code: string) {
  return run(code, userId, { member: true }, (work, me, now) => {
    const { state, side } = requireRound(work, me);
    const why = whyNotDouble(state, side);
    if (why) throw badRequest(why);
    commit(work, doubleStakes(state, side), now);
  });
}

export function giveUp(userId: number, code: string) {
  return run(code, userId, { member: true }, (work, me, now) => {
    const { state, side } = requireRound(work, me);
    const why = whyNotRetreat(state, side);
    if (why) throw badRequest(why);
    commit(work, retreat(state, side), now);
  });
}

/** Depois de uma rodada: quem quer seguir toca em "Próxima rodada"; com todos de acordo, ela começa. */
export function nextRound(userId: number, code: string) {
  return run(code, userId, { member: true }, (work, me, now) => {
    if (!me) throw forbidden("Você não está nesta sala");
    const state = work.state;
    if (work.status !== "PLAYING" || !state || state.status !== "finished") throw badRequest("A rodada ainda não terminou");
    if (!work.acks.includes(me.slot)) work.acks = [...work.acks, me.slot];
    work.touched = true;
    const waiting = work.players.filter(isHuman).some((player) => !work.acks.includes(player.slot));
    if (!waiting) startRound(work, now);
  });
}

// ---------------------------------------------------------------------------
// Convites
// ---------------------------------------------------------------------------

export function inviteFriend(userId: number, code: string, friendId: number) {
  return transaction((tx) =>
    runTx(tx, code, userId, { member: true }, async (work) => {
      requireLobby(work);
      if (humanCount(work.players) >= MAX_PLAYERS) throw badRequest("A sala está cheia (2 jogadores)");
      if (work.players.some((player) => player.userId === friendId)) throw badRequest("Essa pessoa já está na sala");
      if (!(await areFriends(tx, userId, friendId))) throw forbidden("Você só pode convidar amigos");
      await tx.duelInvite.upsert({
        where: { roomId_toUserId: { roomId: work.room.id, toUserId: friendId } },
        create: { roomId: work.room.id, fromUserId: userId, toUserId: friendId },
        update: { fromUserId: userId, createdAt: new Date() },
      });
      // O convite também cai na conversa do amigo (com o botão para entrar), porque o aviso na tela só aparece com o app aberto.
      const settings = await getSettings(tx);
      if (settings.chatEnabled === 1) {
        const text = `⚔️ Te chamei para um Duelo de Figurinhas! Entre na sala: /duelo/${work.room.code}`;
        const already = await tx.message.findFirst({ where: { senderId: userId, receiverId: friendId, text, createdAt: { gt: new Date(Date.now() - 10 * 60 * 1000) } }, select: { id: true } });
        if (!already) await tx.message.create({ data: { senderId: userId, receiverId: friendId, text } });
      }
    }),
  );
}

/** Convites que o jogador recebeu para salas que ainda estão reunindo gente. */
export async function listInvites(userId: number) {
  const invites = await prisma.duelInvite.findMany({
    where: { toUserId: userId, createdAt: { gt: new Date(Date.now() - 2 * 60 * 60 * 1000) }, room: { status: "LOBBY", players: { none: { userId } } } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, createdAt: true, from: { select: { name: true } }, room: { select: { code: true, players: { select: { id: true, userId: true } } } } },
  });
  return invites
    .filter((invite) => humanCount(invite.room.players) < MAX_PLAYERS)
    .map((invite) => ({ id: invite.id, code: invite.room.code, fromName: invite.from.name, players: humanCount(invite.room.players), createdAt: invite.createdAt }));
}

export async function dismissInvite(userId: number, inviteId: number) {
  await prisma.duelInvite.deleteMany({ where: { id: inviteId, toUserId: userId } });
}
