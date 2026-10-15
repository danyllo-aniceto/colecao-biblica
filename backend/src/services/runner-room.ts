import { randomInt } from "node:crypto";
import { Prisma, type RunnerRoom, type RunnerRoomPlayer, type RunnerRoomStatus } from "@prisma/client";
import { prisma, transaction } from "../db/prisma";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { maxTicksOf } from "../runner/engine";
import { BOT_SKILLS, MAX_ROOM_PLAYERS, MIN_ROOM_RUNNERS, OFFLINE_MS, officialTicks, raceOver, rankRace, RACE_SLACK_MS, sanitizeReport, START_DELAY_MS, type RaceRunner, type RoomBotSkill } from "../runner/room";
import { parseSegments, verifyRun } from "../runner/verify";
import { TICKS_PER_SECOND } from "../runner/types";
import { preparedLevelBySlug } from "./runner-progress";

/**
 * Salas da corrida online (até 4). Mesmo molde do Tabuleiro e do Duelo: sem WebSocket, o app consulta a sala e tudo que acontece "sozinho" (fora da
 * corrida por falta de sinal, fim da corrida) é resolvido de forma preguiçosa por `advance()` na próxima consulta, com a linha da sala trancada.
 * Cada jogador corre no próprio aparelho: manda a posição a cada ~1 s (só para os outros verem) e, ao terminar, a partida inteira com os toques, que o
 * servidor repete (`verifyRun`); o tempo oficial vem dos passos conferidos. O aparelho do anfitrião joga pelos bots e manda a partida deles, que
 * também é conferida. Nada do modo dá XP, moedas, estrelas nem ranking.
 */

type Tx = Prisma.TransactionClient;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 5;
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const CONNECTED_MS = 20_000;
const SEEN_WRITE_MS = 8000;
const NAME_MAX = 24;
const BOT_NAMES = ["Davi", "Ester", "Daniel", "Rute", "Calebe", "Débora", "Josué", "Miriã", "Neemias", "Lídia", "Samuel", "Ana"];

type Work = {
  room: RunnerRoom;
  players: RunnerRoomPlayer[];
  status: RunnerRoomStatus;
  hostId: number;
  levelSlug: string;
  startAt: number | null;
  firstFinishAt: number | null;
  dirtyPlayers: Set<number>;
  touched: boolean;
  /** Mudança que não sobe a versão (posição dos corredores). */
  quiet: boolean;
  deleted: boolean;
  /** Tempo máximo da corrida (da fase), só preenchido quando a sala está correndo. */
  maxMs: number;
};

const normalizeCode = (code: string) => code.trim().toUpperCase();
const isBot = (player: RunnerRoomPlayer) => player.userId === null;
const humans = (players: RunnerRoomPlayer[]) => players.filter((player) => player.userId !== null);
const keyOf = (player: Pick<RunnerRoomPlayer, "userId" | "slot">) => (player.userId ? `u${player.userId}` : `b${player.slot}`);

function freeSlot(players: RunnerRoomPlayer[]): number {
  for (let slot = 0; slot < MAX_ROOM_PLAYERS; slot += 1) if (!players.some((player) => player.slot === slot)) return slot;
  throw badRequest("A sala está cheia");
}

const runnersOf = (work: Work): RaceRunner[] =>
  work.players.map((player) => ({ slot: player.slot, name: player.name, bot: isBot(player), finished: player.finished, finishTicks: player.finishTicks, progress: player.progress / 1000, words: player.words, deaths: player.deaths, out: player.out }));

/** Tempo máximo da corrida de uma fase: o da fase mais uma folga. */
async function maxMsOf(levelSlug: string): Promise<number> {
  const found = await preparedLevelBySlug(prisma, levelSlug);
  return found ? Math.ceil((maxTicksOf(found.level) / TICKS_PER_SECOND) * 1000) + RACE_SLACK_MS : 10 * 60 * 1000;
}

/** Alcança o relógio: quem ficou sem sinal sai da corrida (e, sem o anfitrião, os bots também); a corrida acaba quando deve. */
function advance(work: Work, now: number) {
  if (work.status !== "RACING" || work.startAt === null) return;
  const host = work.players.find((player) => player.userId === work.hostId);
  for (const player of work.players) {
    if (player.finished || player.out) continue;
    const silent = isBot(player) ? !host || host.out || (!host.finished && now - host.lastSeenAt.getTime() > OFFLINE_MS) : now - player.lastSeenAt.getTime() > OFFLINE_MS;
    if (silent && now >= work.startAt) {
      player.out = true;
      work.dirtyPlayers.add(player.id);
      work.touched = true;
      work.quiet = false;
    }
  }
  if (raceOver(runnersOf(work), now, work.firstFinishAt, work.startAt, work.maxMs)) {
    work.status = "FINISHED";
    work.touched = true;
    work.quiet = false;
  }
}

async function load(tx: Tx, code: string): Promise<Work> {
  await tx.$queryRaw`SELECT id FROM runner_rooms WHERE code = ${code} FOR UPDATE`;
  const room = await tx.runnerRoom.findUnique({ where: { code }, include: { players: { orderBy: { slot: "asc" } } } });
  if (!room) throw notFound("Sala não encontrada. Confira o código.");
  const { players, ...bare } = room;
  return {
    room: bare,
    players,
    status: room.status,
    hostId: room.hostId,
    levelSlug: room.levelSlug,
    startAt: room.startAt?.getTime() ?? null,
    firstFinishAt: room.firstFinishAt?.getTime() ?? null,
    dirtyPlayers: new Set(),
    touched: false,
    quiet: false,
    deleted: false,
    maxMs: room.status === "RACING" ? await maxMsOf(room.levelSlug) : 0,
  };
}

async function persist(tx: Tx, work: Work, now: number) {
  if (work.deleted) return;
  for (const row of work.players) {
    if (!work.dirtyPlayers.has(row.id)) continue;
    await tx.runnerRoomPlayer.update({
      where: { id: row.id },
      data: {
        name: row.name,
        characterSlug: row.characterSlug,
        bot: row.bot,
        x: row.x,
        y: row.y,
        form: row.form,
        dead: row.dead,
        deaths: row.deaths,
        words: row.words,
        progress: row.progress,
        finished: row.finished,
        finishTicks: row.finishTicks,
        out: row.out,
        reportedAt: row.reportedAt,
        lastSeenAt: row.lastSeenAt,
      },
    });
  }
  if (!work.touched) return;
  await tx.runnerRoom.update({
    where: { id: work.room.id },
    data: {
      hostId: work.hostId,
      status: work.status,
      levelSlug: work.levelSlug,
      startAt: work.startAt === null ? null : new Date(work.startAt),
      firstFinishAt: work.firstFinishAt === null ? null : new Date(work.firstFinishAt),
      ...(work.quiet ? {} : { version: { increment: 1 } }),
      finishedAt: work.status === "FINISHED" ? new Date(now) : work.status === "LOBBY" ? null : undefined,
    },
  });
}

async function buildView(tx: Tx, work: Work, userId: number, now: number) {
  const host = await tx.user.findUnique({ where: { id: work.hostId }, select: { name: true } });
  const me = work.players.find((player) => player.userId === userId) ?? null;
  const found = await preparedLevelBySlug(tx, work.levelSlug);
  const racing = work.status !== "LOBBY";
  return {
    changed: true as const,
    code: work.room.code,
    status: work.status,
    version: work.room.version + (work.touched && !work.quiet ? 1 : 0),
    serverNow: now,
    hostUserId: work.hostId,
    hostName: host?.name ?? "",
    levelSlug: work.levelSlug,
    levelName: found?.name ?? null,
    maxPlayers: MAX_ROOM_PLAYERS,
    /** Largada (relógio do servidor): o aparelho acerta o próprio relógio por `serverNow`. */
    startAt: work.startAt,
    players: work.players.map((player) => ({
      key: keyOf(player),
      slot: player.slot,
      userId: player.userId,
      name: player.name,
      characterSlug: player.characterSlug,
      bot: player.bot as RoomBotSkill | null,
      isHost: player.userId === work.hostId,
      connected: player.userId === null ? true : now - player.lastSeenAt.getTime() < CONNECTED_MS,
      finished: player.finished,
      finishTicks: player.finishTicks,
      out: player.out,
      ...(racing ? { x: player.x, y: player.y, form: player.form, dead: player.dead, deaths: player.deaths, words: player.words, progress: player.progress / 1000 } : {}),
    })),
    me: me ? { slot: me.slot, key: keyOf(me), userId, isHost: userId === work.hostId } : null,
    /** Placar da corrida (só quando acabou): quem chegou pelo tempo oficial e quem foi mais longe. */
    results: work.status === "FINISHED" ? rankRace(runnersOf(work)).map((entry) => ({ slot: entry.slot, name: entry.name, bot: entry.bot, place: entry.place, finished: entry.finished, ticks: entry.finishTicks, progress: entry.progress, words: entry.words, deaths: entry.deaths, out: entry.out })) : null,
  };
}

export type RunnerRoomView = Awaited<ReturnType<typeof buildView>>;
export type RunnerRoomUnchanged = { changed: false; version: number; serverNow: number };

async function runTx(tx: Tx, code: string, userId: number, opts: { member: boolean }, fn: (work: Work, me: RunnerRoomPlayer | null, now: number) => Promise<void> | void) {
  const work = await load(tx, normalizeCode(code));
  const now = Date.now();
  const me = work.players.find((player) => player.userId === userId) ?? null;
  if (opts.member && !me) throw forbidden("Você não está nesta sala");
  if (me && now - me.lastSeenAt.getTime() > SEEN_WRITE_MS) {
    me.lastSeenAt = new Date(now);
    work.dirtyPlayers.add(me.id);
  }
  advance(work, now);
  await fn(work, me, now);
  advance(work, now);
  await persist(tx, work, now);
  if (work.deleted) return null;
  return buildView(tx, work, userId, now);
}

const run = (code: string, userId: number, opts: { member: boolean }, fn: Parameters<typeof runTx>[4]) => transaction((tx) => runTx(tx, code, userId, opts, fn));

const requireHost = (work: Work, userId: number) => {
  if (work.hostId !== userId) throw forbidden("Só quem criou a sala pode fazer isso");
};
const requireLobby = (work: Work) => {
  if (work.status !== "LOBBY") throw badRequest("Isso só dá para fazer antes da corrida começar");
};

async function newCode(tx: Tx): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
    if (!(await tx.runnerRoom.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
  throw badRequest("Não foi possível gerar o código da sala. Tente de novo.");
}

/** A fase da sala precisa existir (fixa do app ou ativa na campanha). */
async function checkLevel(levelSlug: string): Promise<void> {
  if (!(await preparedLevelBySlug(prisma, levelSlug))) throw badRequest("Essa fase não está disponível");
}

/** Ao criar ou entrar: personagem inexistente ou desativado vira "sem personagem" (corredor padrão), sem derrubar a entrada na sala. */
async function softCharacter(tx: Tx, slug: string | null | undefined): Promise<string | null> {
  if (!slug) return null;
  const found = await tx.runnerCharacter.findFirst({ where: { slug, active: true }, select: { slug: true } });
  return found?.slug ?? null;
}

/** O personagem escolhido precisa existir e estar ativo (sem ele, o corredor aparece na cor padrão). */
async function checkCharacter(tx: Tx, slug: string | null | undefined): Promise<string | null> {
  if (!slug) return null;
  const found = await tx.runnerCharacter.findFirst({ where: { slug, active: true }, select: { slug: true } });
  if (!found) throw badRequest("Esse personagem não está disponível");
  return found.slug;
}

function resetRunner(player: RunnerRoomPlayer) {
  Object.assign(player, { x: 0, y: 0, form: "RUN", dead: false, deaths: 0, words: 0, progress: 0, finished: false, finishTicks: null, out: false, reportedAt: null });
}

// ---------------------------------------------------------------------------
// Criar, entrar, sair
// ---------------------------------------------------------------------------

/** Tira a pessoa da sala: no lobby sai de vez; na corrida fica "fora" (e, se era o anfitrião, os bots também). Apaga a sala se não sobrar pessoa. */
async function removeMember(tx: Tx, work: Work, me: RunnerRoomPlayer, now: number) {
  if (work.status === "RACING" && !me.finished) {
    me.out = true;
    work.dirtyPlayers.add(me.id);
    work.touched = true;
    work.quiet = false;
  } else {
    await tx.runnerRoomPlayer.delete({ where: { id: me.id } });
    work.players = work.players.filter((player) => player.id !== me.id);
    work.touched = true;
    work.quiet = false;
  }
  const people = humans(work.players);
  if (people.length === 0) {
    await tx.runnerRoom.delete({ where: { id: work.room.id } });
    work.deleted = true;
    return;
  }
  if (work.hostId === me.userId) {
    const next = people.find((player) => !player.out) ?? people[0];
    // Os bots eram jogados pelo aparelho do antigo anfitrião: na corrida, saem com ele.
    work.hostId = next.userId as number;
    if (work.status === "RACING") {
      for (const player of work.players) {
        if (isBot(player) && !player.finished && !player.out) {
          player.out = true;
          work.dirtyPlayers.add(player.id);
        }
      }
    }
  }
  advance(work, now);
}

async function leaveOtherRooms(tx: Tx, userId: number, exceptCode?: string) {
  const rows = await tx.runnerRoomPlayer.findMany({ where: { userId, room: { code: { not: exceptCode ?? "" } } }, select: { room: { select: { code: true } } } });
  for (const row of rows) {
    const work = await load(tx, row.room.code);
    const me = work.players.find((player) => player.userId === userId);
    if (!me) continue;
    const now = Date.now();
    await removeMember(tx, work, me, now);
    await persist(tx, work, now);
  }
}

export async function createRoom(userId: number, input: { levelSlug: string; characterSlug?: string | null }) {
  await checkLevel(input.levelSlug);
  await prisma.runnerRoom.deleteMany({ where: { updatedAt: { lt: new Date(Date.now() - ROOM_TTL_MS) } } });
  const code = await transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });
    await leaveOtherRooms(tx, userId);
    const code = await newCode(tx);
    const characterSlug = await softCharacter(tx, input.characterSlug);
    await tx.runnerRoom.create({
      data: { code, hostId: userId, levelSlug: input.levelSlug, players: { create: { slot: 0, userId, name: user.name.slice(0, NAME_MAX), characterSlug } } },
    });
    return code;
  });
  return getRoom(code, userId);
}

export async function joinRoom(userId: number, rawCode: string, input: { characterSlug?: string | null }) {
  const code = normalizeCode(rawCode);
  return transaction(async (tx) => {
    const existing = await tx.runnerRoom.findUnique({ where: { code }, select: { id: true } });
    if (!existing) throw notFound("Sala não encontrada. Confira o código.");
    const already = await tx.runnerRoomPlayer.findFirst({ where: { roomId: existing.id, userId }, select: { id: true } });
    if (!already) await leaveOtherRooms(tx, userId, code);
    return runTx(tx, code, userId, { member: false }, async (work, me, now) => {
      if (me) return;
      if (work.status !== "LOBBY") throw badRequest("A corrida desta sala já começou");
      if (humans(work.players).length >= MAX_ROOM_PLAYERS) throw badRequest("A sala está cheia (4 jogadores)");
      // Quem chega toma o lugar de um bot quando a sala já está com as 4 vagas ocupadas.
      const bot = work.players.find(isBot);
      if (bot && work.players.length >= MAX_ROOM_PLAYERS) {
        await tx.runnerRoomPlayer.delete({ where: { id: bot.id } });
        work.players = work.players.filter((player) => player.id !== bot.id);
      }
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true } });
      const characterSlug = await softCharacter(tx, input.characterSlug);
      const row = await tx.runnerRoomPlayer.create({ data: { roomId: work.room.id, slot: freeSlot(work.players), userId, name: user.name.slice(0, NAME_MAX), characterSlug, lastSeenAt: new Date(now) } });
      work.players = [...work.players, row].sort((left, right) => left.slot - right.slot);
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

/** Consulta da sala. No lobby e no placar, com `since` igual à versão atual responde "nada mudou"; correndo, sempre devolve a sala (as posições mudam o tempo todo). */
export async function getRoom(rawCode: string, userId: number, since?: number): Promise<RunnerRoomView | RunnerRoomUnchanged> {
  const code = normalizeCode(rawCode);
  const now = Date.now();
  const room = await prisma.runnerRoom.findUnique({ where: { code }, include: { players: { select: { id: true, userId: true, lastSeenAt: true } } } });
  if (!room) throw notFound("Sala não encontrada. Confira o código.");
  const mine = room.players.find((player) => player.userId === userId);
  if (!mine) throw forbidden("Você não está nesta sala");
  if (since !== undefined && since === room.version && room.status !== "RACING") {
    if (now - mine.lastSeenAt.getTime() > SEEN_WRITE_MS) await prisma.runnerRoomPlayer.update({ where: { id: mine.id }, data: { lastSeenAt: new Date(now) } });
    return { changed: false, version: room.version, serverNow: now };
  }
  const view = await run(code, userId, { member: true }, () => undefined);
  if (!view) throw notFound("Sala não encontrada. Confira o código.");
  return view;
}

export async function myRoom(userId: number) {
  const row = await prisma.runnerRoomPlayer.findFirst({
    where: { userId, room: { status: { in: ["LOBBY", "RACING"] } } },
    orderBy: { joinedAt: "desc" },
    select: { room: { select: { code: true, status: true } } },
  });
  return row ? { code: row.room.code, status: row.room.status } : null;
}

/** Prévia pública da sala para o link de convite (sem login). */
export async function publicRoom(rawCode: string) {
  const room = await prisma.runnerRoom.findUnique({
    where: { code: normalizeCode(rawCode) },
    select: { code: true, status: true, levelSlug: true, host: { select: { name: true } }, players: { select: { userId: true } } },
  });
  if (!room) throw notFound("Sala não encontrada. Confira o código.");
  const level = await preparedLevelBySlug(prisma, room.levelSlug);
  return { code: room.code, status: room.status, hostName: room.host.name, levelName: level?.name ?? null, players: room.players.filter((player) => player.userId !== null).length, maxPlayers: MAX_ROOM_PLAYERS };
}

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------

export function updateLevel(userId: number, code: string, levelSlug: string) {
  return transaction(async (tx) => {
    await checkLevel(levelSlug);
    return runTx(tx, code, userId, { member: true }, (work) => {
      requireHost(work, userId);
      requireLobby(work);
      work.levelSlug = levelSlug;
      work.touched = true;
    });
  });
}

export function setCharacter(userId: number, code: string, characterSlug: string | null) {
  return transaction(async (tx) => {
    const slug = await checkCharacter(tx, characterSlug);
    return runTx(tx, code, userId, { member: true }, (work, me) => {
      requireLobby(work);
      if (!me) return;
      me.characterSlug = slug;
      work.dirtyPlayers.add(me.id);
      work.touched = true;
    });
  });
}

/** Bot da sala: personagem ainda não usado na sala (ou nome da lista), com o nível pedido. */
async function pickBot(tx: Tx, players: RunnerRoomPlayer[]) {
  const used = new Set(players.map((player) => player.characterSlug).filter((slug): slug is string => Boolean(slug)));
  const free = await tx.runnerCharacter.findMany({ where: { active: true, slug: { notIn: [...used] } }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { slug: true, name: true } });
  if (free.length > 0) return { characterSlug: free[0].slug, name: free[0].name };
  const names = new Set(players.map((player) => player.name));
  return { characterSlug: null, name: BOT_NAMES.find((name) => !names.has(name)) ?? "Bot" };
}

export function addBot(userId: number, code: string, skill: RoomBotSkill) {
  return transaction(async (tx) =>
    runTx(tx, code, userId, { member: true }, async (work, _me, now) => {
      requireHost(work, userId);
      requireLobby(work);
      if (!BOT_SKILLS.includes(skill)) throw badRequest("Nível de bot inválido");
      if (work.players.length >= MAX_ROOM_PLAYERS) throw badRequest("A sala está cheia");
      const picked = await pickBot(tx, work.players);
      const row = await tx.runnerRoomPlayer.create({ data: { roomId: work.room.id, slot: freeSlot(work.players), userId: null, name: picked.name, characterSlug: picked.characterSlug, bot: skill, lastSeenAt: new Date(now) } });
      work.players = [...work.players, row].sort((left, right) => left.slot - right.slot);
      work.touched = true;
    }),
  );
}

export function setBotSkill(userId: number, code: string, slot: number, skill: RoomBotSkill) {
  return run(code, userId, { member: true }, (work) => {
    requireHost(work, userId);
    requireLobby(work);
    if (!BOT_SKILLS.includes(skill)) throw badRequest("Nível de bot inválido");
    const row = work.players.find((player) => player.slot === slot && isBot(player));
    if (!row) throw notFound("Esse bot não está na sala");
    row.bot = skill;
    work.dirtyPlayers.add(row.id);
    work.touched = true;
  });
}

/** O anfitrião tira um bot ou uma pessoa do lobby (nunca a si mesmo: para isso é "sair"). */
export function removePlayer(userId: number, code: string, slot: number) {
  return transaction(async (tx) =>
    runTx(tx, code, userId, { member: true }, async (work) => {
      requireHost(work, userId);
      requireLobby(work);
      const row = work.players.find((player) => player.slot === slot);
      if (!row) throw notFound("Esse jogador não está na sala");
      if (row.userId === userId) throw badRequest("Para sair da sala, use o botão Sair");
      await tx.runnerRoomPlayer.delete({ where: { id: row.id } });
      work.players = work.players.filter((player) => player.id !== row.id);
      work.touched = true;
    }),
  );
}

// ---------------------------------------------------------------------------
// Corrida
// ---------------------------------------------------------------------------

export function startRace(userId: number, code: string) {
  return transaction(async (tx) => {
    return runTx(tx, code, userId, { member: true }, async (work, _me, now) => {
      requireHost(work, userId);
      requireLobby(work);
      if (work.players.length < MIN_ROOM_RUNNERS) throw badRequest("Chame um amigo ou um bot: a corrida precisa de pelo menos 2 corredores");
      await checkLevel(work.levelSlug);
      for (const player of work.players) {
        resetRunner(player);
        player.lastSeenAt = new Date(now);
        work.dirtyPlayers.add(player.id);
      }
      work.status = "RACING";
      work.startAt = now + START_DELAY_MS;
      work.firstFinishAt = null;
      work.maxMs = await maxMsOf(work.levelSlug);
      work.touched = true;
    });
  });
}

/** O anfitrião volta a sala para o lobby (mesma gente, mesma fase) para uma nova corrida. Quem estava fora por falta de sinal sai da sala. */
export function rematch(userId: number, code: string) {
  return transaction(async (tx) =>
    runTx(tx, code, userId, { member: true }, async (work) => {
      requireHost(work, userId);
      if (work.status !== "FINISHED") throw badRequest("A revanche só vale depois do fim da corrida");
      const gone = work.players.filter((player) => player.userId !== null && player.out && player.userId !== userId);
      for (const player of gone) await tx.runnerRoomPlayer.delete({ where: { id: player.id } });
      work.players = work.players.filter((player) => !gone.includes(player));
      for (const player of work.players) {
        resetRunner(player);
        work.dirtyPlayers.add(player.id);
      }
      work.status = "LOBBY";
      work.startAt = null;
      work.firstFinishAt = null;
      work.touched = true;
    }),
  );
}

/** Corredor que o pedido controla: ele mesmo ou, para o anfitrião, um bot da sala. */
function target(work: Work, me: RunnerRoomPlayer | null, userId: number, slot: number | undefined): RunnerRoomPlayer {
  if (slot === undefined || slot === me?.slot) {
    if (!me) throw forbidden("Você não está nesta sala");
    return me;
  }
  requireHost(work, userId);
  const row = work.players.find((player) => player.slot === slot && isBot(player));
  if (!row) throw forbidden("Só o anfitrião manda a partida dos bots");
  return row;
}

function requireRacing(work: Work, now: number) {
  if (work.status !== "RACING" || work.startAt === null) throw badRequest("A corrida não está em andamento");
  if (now < work.startAt - 2000) throw badRequest("A corrida ainda não largou");
}

export type RaceReport = { x: number; y: number; form: string; dead?: boolean; deaths: number; words: number };

/** Posição do aparelho (a cada ~1 s): serve só para os outros verem o corredor. O anfitrião manda também a dos bots. Não sobe a versão. */
export function reportProgress(userId: number, code: string, input: { report: unknown; bots?: Array<{ slot: number; report: unknown }> }) {
  return transaction(async (tx) =>
    runTx(tx, code, userId, { member: true }, async (work, me, now) => {
      requireRacing(work, now);
      const level = await preparedLevelBySlug(tx, work.levelSlug);
      if (!level) throw badRequest("Essa fase não está disponível");
      const apply = (row: RunnerRoomPlayer, raw: unknown) => {
        if (row.finished || row.out) return;
        const report = sanitizeReport(raw, level.level.endX);
        if (!report) throw badRequest("Relatório de posição inválido");
        Object.assign(row, { x: report.x, y: report.y, form: report.form, dead: report.dead, deaths: report.deaths, words: report.words, progress: Math.round(report.progress * 1000), reportedAt: new Date(now) });
        if (row.userId !== null) row.lastSeenAt = new Date(now);
        work.dirtyPlayers.add(row.id);
      };
      if (me) apply(me, input.report);
      for (const item of input.bots ?? []) apply(target(work, me, userId, item.slot), item.report);
      // Quem só reportou posição não mexe na versão (mas o relógio pode ter acabado a corrida: `advance` marca).
      if (!work.touched) {
        work.touched = true;
        work.quiet = true;
      }
    }),
  );
}

/** Chegada: o servidor repete a partida inteira (os toques de cada tentativa) e guarda o tempo oficial. */
export function finishRace(userId: number, code: string, input: { slot?: number; segments?: unknown }) {
  return transaction(async (tx) =>
    runTx(tx, code, userId, { member: true }, async (work, me, now) => {
      requireRacing(work, now);
      const row = target(work, me, userId, input.slot);
      if (row.finished) return;
      if (row.out) throw badRequest("Você saiu desta corrida");
      const found = await preparedLevelBySlug(tx, work.levelSlug);
      if (!found) throw badRequest("Essa fase não está disponível");
      const segments = parseSegments(input.segments, maxTicksOf(found.level));
      if (!segments) throw badRequest("Partida inválida");
      const verdict = verifyRun(found.level, segments);
      if (!verdict.ok) throw badRequest(verdict.reason);
      if (!verdict.finished) throw badRequest("A partida enviada não termina a fase");
      Object.assign(row, { finished: true, finishTicks: officialTicks(verdict.steps, verdict.deaths), progress: 1000, words: verdict.words, deaths: verdict.deaths, dead: false, reportedAt: new Date(now) });
      if (row.userId !== null) row.lastSeenAt = new Date(now);
      work.dirtyPlayers.add(row.id);
      if (work.firstFinishAt === null) work.firstFinishAt = now;
      work.touched = true;
    }),
  );
}
