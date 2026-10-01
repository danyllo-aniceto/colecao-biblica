import { randomInt } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma, transaction, type Db } from "../db/prisma";
import { HttpError, badRequest, forbidden, notFound } from "../lib/errors";
import { env } from "../lib/env";
import { pageOf } from "../lib/pagination";
import { checkAchievements } from "./achievements";
import { dayRangeInTimeZone } from "./game-rules";
import { moderateText } from "./moderation";
import { grantStickerOrDuplicate } from "./rewards";
import { getSettings } from "./settings";
import { visibleCharacter } from "./visibility";
import { playerLooks } from "./cosmetics";

type Tx = Prisma.TransactionClient;

/**
 * Amigos, conversa e trocas de figurinhas repetidas.
 * - Amizade só por código (sem busca por nome/e-mail) e com aceite.
 * - Conversa e trocas só entre amigos aceitos; bloquear corta tudo.
 * - Só cópias repetidas são trocadas: ninguém perde a única figurinha.
 */

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const MAX_FRIENDS = 200;
const MESSAGES_PER_MINUTE = 20;

const userCard = { select: { id: true, name: true, level: true } } as const;

// ---------------------------------------------------------------------------
// Código de amigo e relação entre dois jogadores
// ---------------------------------------------------------------------------

function newCode() {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
}

/** Código do jogador (criado na primeira vez). */
export async function ensureFriendCode(userId: number): Promise<string> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { friendCode: true } });
  if (user.friendCode) return user.friendCode;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      const saved = await prisma.user.update({ where: { id: userId }, data: { friendCode: newCode() } });
      return saved.friendCode!;
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
    }
  }
  throw new Error("Não foi possível gerar o código de amigo");
}

async function relationRows(db: Db, a: number, b: number) {
  return db.friendship.findMany({
    where: {
      OR: [
        { requesterId: a, addresseeId: b },
        { requesterId: b, addresseeId: a },
      ],
    },
  });
}

export async function areFriends(db: Db, a: number, b: number) {
  return (await relationRows(db, a, b)).some((row) => row.status === "ACCEPTED");
}

async function requireFriends(db: Db, a: number, b: number) {
  if (!(await areFriends(db, a, b))) {
    throw forbidden("Vocês precisam ser amigos para isso");
  }
}

async function friendIds(db: Db, userId: number): Promise<number[]> {
  const rows = await db.friendship.findMany({
    where: { status: "ACCEPTED", OR: [{ requesterId: userId }, { addresseeId: userId }] },
    select: { requesterId: true, addresseeId: true },
  });
  return rows.map((row) => (row.requesterId === userId ? row.addresseeId : row.requesterId));
}

/** Cancela propostas de troca abertas entre dois jogadores (ao desfazer amizade ou bloquear). */
async function cancelPendingTrades(db: Db, a: number, b: number) {
  await db.trade.updateMany({
    where: {
      status: "PENDING",
      OR: [
        { proposerId: a, receiverId: b },
        { proposerId: b, receiverId: a },
      ],
    },
    data: { status: "CANCELLED", respondedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Amizades
// ---------------------------------------------------------------------------

export async function sendFriendRequest(userId: number, rawCode: string) {
  const code = rawCode.trim().toUpperCase();
  const target = await prisma.user.findFirst({ where: { friendCode: code, deleted: false }, select: { id: true, name: true } });
  if (!target) throw notFound("Nenhum jogador com esse código");
  if (target.id === userId) throw badRequest("Esse é o seu próprio código");

  const rows = await relationRows(prisma, userId, target.id);
  // Bloqueio (de qualquer lado) não é revelado.
  if (rows.some((row) => row.status === "BLOCKED")) throw badRequest("Não foi possível adicionar este jogador");
  if (rows.some((row) => row.status === "ACCEPTED")) throw badRequest(`Você e ${target.name} já são amigos`);
  if (rows.some((row) => row.status === "PENDING" && row.requesterId === userId)) throw badRequest("Pedido já enviado. Aguarde a resposta.");

  // A outra pessoa já tinha pedido: os dois querem, vira amizade direto.
  const incoming = rows.find((row) => row.status === "PENDING" && row.requesterId === target.id);
  if (incoming) {
    await prisma.friendship.update({ where: { id: incoming.id }, data: { status: "ACCEPTED" } });
    await checkAchievements(prisma, userId);
    await checkAchievements(prisma, target.id);
    return { status: "ACCEPTED" as const, friend: target };
  }

  if ((await friendIds(prisma, userId)).length >= MAX_FRIENDS) throw badRequest(`Limite de ${MAX_FRIENDS} amigos atingido`);
  await prisma.friendship.create({ data: { requesterId: userId, addresseeId: target.id } });
  return { status: "PENDING" as const, friend: target };
}

export async function respondFriendRequest(userId: number, requestId: number, accept: boolean) {
  const request = await prisma.friendship.findFirst({ where: { id: requestId, addresseeId: userId, status: "PENDING" } });
  if (!request) throw notFound("Pedido de amizade não encontrado");
  if (!accept) {
    await prisma.friendship.delete({ where: { id: request.id } });
    return { status: "DECLINED" as const };
  }
  await prisma.friendship.update({ where: { id: request.id }, data: { status: "ACCEPTED" } });
  const unlocked = await checkAchievements(prisma, userId);
  await checkAchievements(prisma, request.requesterId);
  return { status: "ACCEPTED" as const, unlockedAchievements: unlocked };
}

export async function cancelFriendRequest(userId: number, requestId: number) {
  const deleted = await prisma.friendship.deleteMany({ where: { id: requestId, requesterId: userId, status: "PENDING" } });
  if (deleted.count === 0) throw notFound("Pedido de amizade não encontrado");
}

export async function removeFriend(userId: number, friendId: number) {
  await prisma.friendship.deleteMany({
    where: {
      status: "ACCEPTED",
      OR: [
        { requesterId: userId, addresseeId: friendId },
        { requesterId: friendId, addresseeId: userId },
      ],
    },
  });
  await cancelPendingTrades(prisma, userId, friendId);
}

export async function blockUser(userId: number, otherId: number) {
  if (userId === otherId) throw badRequest("Você não pode bloquear a si mesmo");
  await transaction(async (tx) => {
    await tx.friendship.deleteMany({
      where: {
        OR: [
          { requesterId: userId, addresseeId: otherId },
          { requesterId: otherId, addresseeId: userId },
        ],
      },
    });
    await tx.friendship.create({ data: { requesterId: userId, addresseeId: otherId, status: "BLOCKED" } });
    await cancelPendingTrades(tx, userId, otherId);
  });
}

export async function unblockUser(userId: number, otherId: number) {
  await prisma.friendship.deleteMany({ where: { requesterId: userId, addresseeId: otherId, status: "BLOCKED" } });
}

/** Amigos com o número de mensagens não lidas e a última mensagem. */
export async function listFriends(userId: number, page: number, size: number) {
  const ids = await friendIds(prisma, userId);
  if (ids.length === 0) return pageOf([], 0, page, size);

  const [users, unread, stickers, lastMessages] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids }, deleted: false }, select: { id: true, name: true, level: true } }),
    prisma.message.groupBy({ by: ["senderId"], where: { receiverId: userId, readAt: null, senderId: { in: ids } }, _count: { _all: true } }),
    prisma.userSticker.groupBy({ by: ["userId"], where: { userId: { in: ids }, character: visibleCharacter() }, _count: { _all: true }, _sum: { duplicates: true } }),
    Promise.all(
      ids.map((friendId) =>
        prisma.message.findFirst({
          where: {
            OR: [
              { senderId: userId, receiverId: friendId },
              { senderId: friendId, receiverId: userId },
            ],
          },
          orderBy: { id: "desc" },
          select: { text: true, createdAt: true, senderId: true },
        }),
      ),
    ),
  ]);

  const looks = await playerLooks(prisma, ids);
  const unreadBy = new Map(unread.map((row) => [row.senderId, row._count._all]));
  const stickersBy = new Map(stickers.map((row) => [row.userId, { owned: row._count._all, duplicates: row._sum.duplicates ?? 0 }]));
  const lastBy = new Map(ids.map((friendId, index) => [friendId, lastMessages[index]]));

  const friends = users
    .map((user) => {
      const last = lastBy.get(user.id);
      return {
        userId: user.id,
        name: user.name,
        level: user.level,
        look: looks.get(user.id) ?? null,
        stickers: stickersBy.get(user.id)?.owned ?? 0,
        duplicates: stickersBy.get(user.id)?.duplicates ?? 0,
        unread: unreadBy.get(user.id) ?? 0,
        lastMessage: last ? { text: last.text, createdAt: last.createdAt, mine: last.senderId === userId } : null,
      };
    })
    // Conversas recentes primeiro; quem nunca conversou, por nome.
    .sort((left, right) => {
      const l = left.lastMessage?.createdAt.getTime() ?? 0;
      const r = right.lastMessage?.createdAt.getTime() ?? 0;
      return r - l || left.name.localeCompare(right.name, "pt-BR");
    });

  return pageOf(friends.slice(page * size, page * size + size), friends.length, page, size);
}

export async function listFriendRequests(userId: number) {
  const [incoming, outgoing, blocked] = await Promise.all([
    prisma.friendship.findMany({ where: { addresseeId: userId, status: "PENDING" }, include: { requester: userCard }, orderBy: { createdAt: "desc" } }),
    prisma.friendship.findMany({ where: { requesterId: userId, status: "PENDING" }, include: { addressee: userCard }, orderBy: { createdAt: "desc" } }),
    prisma.friendship.findMany({ where: { requesterId: userId, status: "BLOCKED" }, include: { addressee: userCard }, orderBy: { createdAt: "desc" } }),
  ]);
  return {
    incoming: incoming.map((row) => ({ id: row.id, createdAt: row.createdAt, user: row.requester })),
    outgoing: outgoing.map((row) => ({ id: row.id, createdAt: row.createdAt, user: row.addressee })),
    blocked: blocked.map((row) => ({ id: row.id, createdAt: row.createdAt, user: row.addressee })),
  };
}

/** Números para os avisos (bolinhas) do menu. */
export async function socialSummary(userId: number) {
  await expireTrades(prisma);
  const ids = await friendIds(prisma, userId);
  const [pendingRequests, pendingTrades, unreadMessages] = await Promise.all([
    prisma.friendship.count({ where: { addresseeId: userId, status: "PENDING" } }),
    prisma.trade.count({ where: { receiverId: userId, status: "PENDING" } }),
    prisma.message.count({ where: { receiverId: userId, readAt: null, senderId: { in: ids } } }),
  ]);
  return { pendingRequests, pendingTrades, unreadMessages };
}

/** Álbum do amigo para montar uma troca: as repetidas de cada um e quem já tem o quê. */
export async function friendAlbum(userId: number, friendId: number) {
  await requireFriends(prisma, userId, friendId);
  const [friend, mine, theirs] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: friendId }, select: { id: true, name: true, level: true } }),
    prisma.userSticker.findMany({ where: { userId, character: visibleCharacter() }, include: { character: true } }),
    prisma.userSticker.findMany({ where: { userId: friendId, character: visibleCharacter() }, include: { character: true } }),
  ]);
  const mineById = new Map(mine.map((sticker) => [sticker.characterId, sticker]));
  const theirsById = new Map(theirs.map((sticker) => [sticker.characterId, sticker]));
  const card = (sticker: (typeof mine)[number]) => ({
    characterId: sticker.characterId,
    name: sticker.character.name,
    rarity: sticker.character.rarity,
    imageUrl: sticker.character.imageUrl,
    duplicates: sticker.duplicates,
  });
  return {
    friend,
    owned: theirs.length,
    // O que posso pedir: repetidas do amigo (marcando as que me faltam).
    theirDuplicates: theirs.filter((sticker) => sticker.duplicates > 0).map((sticker) => ({ ...card(sticker), iOwn: mineById.has(sticker.characterId) })),
    // O que posso oferecer: minhas repetidas (marcando as que faltam para o amigo).
    myDuplicates: mine.filter((sticker) => sticker.duplicates > 0).map((sticker) => ({ ...card(sticker), theyOwn: theirsById.has(sticker.characterId) })),
  };
}

// ---------------------------------------------------------------------------
// Conversa
// ---------------------------------------------------------------------------

const tradeInclude = {
  offeredCharacter: { select: { id: true, name: true, rarity: true, imageUrl: true } },
  requestedCharacter: { select: { id: true, name: true, rarity: true, imageUrl: true } },
} as const;

type TradeWithCharacters = Prisma.TradeGetPayload<{ include: typeof tradeInclude }>;

function toTrade(trade: TradeWithCharacters) {
  return {
    id: trade.id,
    proposerId: trade.proposerId,
    receiverId: trade.receiverId,
    status: trade.status,
    message: trade.message,
    createdAt: trade.createdAt,
    respondedAt: trade.respondedAt,
    offered: trade.offeredCharacter,
    requested: trade.requestedCharacter,
  };
}

export async function getMessages(userId: number, friendId: number, before: number | null, limit: number) {
  await requireFriends(prisma, userId, friendId);
  await expireTrades(prisma);
  const take = Math.max(1, Math.min(limit, 50));
  const rows = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: userId, receiverId: friendId },
        { senderId: friendId, receiverId: userId },
      ],
      ...(before ? { id: { lt: before } } : {}),
    },
    orderBy: { id: "desc" },
    take: take + 1,
    include: { trade: { include: tradeInclude }, reaction: { select: reactionSelect } },
  });
  // Abrir a conversa marca como lidas as mensagens recebidas.
  await prisma.message.updateMany({ where: { senderId: friendId, receiverId: userId, readAt: null }, data: { readAt: new Date() } });
  const settings = await getSettings(prisma);
  return {
    chatEnabled: settings.chatEnabled === 1,
    hasMore: rows.length > take,
    messages: rows
      .slice(0, take)
      .reverse()
      .map((message) => ({
        id: message.id,
        senderId: message.senderId,
        text: message.text,
        createdAt: message.createdAt,
        readAt: message.readAt,
        trade: message.trade ? toTrade(message.trade) : null,
        reaction: message.reaction,
      })),
  };
}

const reactionSelect = { id: true, name: true, imageUrl: true, style: true } as const;

/** Reações que o jogador pode mandar (as que ele tem). */
export async function myReactions(userId: number) {
  const rows = await prisma.userCosmetic.findMany({
    where: { userId, cosmetic: { type: "REACTION", active: true } },
    select: { cosmetic: { select: reactionSelect } },
    orderBy: { cosmetic: { sortOrder: "asc" } },
  });
  return rows.map((row) => row.cosmetic);
}

/** Manda uma reação animada (um item visual do tipo REACTION que o jogador tem). */
export async function sendReaction(userId: number, friendId: number, reactionId: number) {
  const settings = await getSettings(prisma);
  if (settings.chatEnabled !== 1) throw badRequest("A conversa está desligada no momento");
  await requireFriends(prisma, userId, friendId);
  const owned = await prisma.userCosmetic.findFirst({ where: { userId, cosmeticId: reactionId, cosmetic: { type: "REACTION", active: true } }, include: { cosmetic: true } });
  if (!owned) throw badRequest("Você não tem esta reação");
  const recent = await prisma.message.count({ where: { senderId: userId, tradeId: null, createdAt: { gte: new Date(Date.now() - 60_000) } } });
  if (recent >= MESSAGES_PER_MINUTE) throw new HttpError(429, "Muitas mensagens seguidas. Espere um pouco.");
  const message = await prisma.message.create({ data: { senderId: userId, receiverId: friendId, text: `Reação: ${owned.cosmetic.name}`, reactionId } });
  const { id, name, imageUrl, style } = owned.cosmetic;
  return { id: message.id, senderId: userId, text: message.text, createdAt: message.createdAt, readAt: null, trade: null, reaction: { id, name, imageUrl, style } };
}

export async function sendMessage(userId: number, friendId: number, text: string) {
  const settings = await getSettings(prisma);
  if (settings.chatEnabled !== 1) throw badRequest("A conversa está desligada no momento");
  await requireFriends(prisma, userId, friendId);
  const recent = await prisma.message.count({ where: { senderId: userId, tradeId: null, createdAt: { gte: new Date(Date.now() - 60_000) } } });
  if (recent >= MESSAGES_PER_MINUTE) throw new HttpError(429, "Muitas mensagens seguidas. Espere um pouco.");
  const message = await prisma.message.create({ data: { senderId: userId, receiverId: friendId, text: moderateText(text.trim()) } });
  return { id: message.id, senderId: message.senderId, text: message.text, createdAt: message.createdAt, readAt: null, trade: null, reaction: null };
}

// ---------------------------------------------------------------------------
// Trocas
// ---------------------------------------------------------------------------

/** Propostas antigas expiram (verificado sempre que alguém lista ou responde). */
async function expireTrades(db: Db) {
  const settings = await getSettings(db);
  await db.trade.updateMany({
    where: { status: "PENDING", createdAt: { lt: new Date(Date.now() - settings.tradeExpireDays * 86_400_000) } },
    data: { status: "EXPIRED", respondedAt: new Date() },
  });
}

async function duplicateOf(db: Db, userId: number, characterId: number) {
  return db.userSticker.findFirst({ where: { userId, characterId, character: visibleCharacter() }, include: { character: { select: { name: true } } } });
}

type TradeInput = { toUserId: number; offeredCharacterId?: number | null; requestedCharacterId?: number | null; message?: string | null };

function tradeSummary(offered: string | null, requested: string | null) {
  if (offered && requested) return `Proposta de troca: ${offered} por ${requested}`;
  if (offered) return `Presente: ${offered}`;
  return `Pedido de figurinha: ${requested}`;
}

export async function createTrade(userId: number, input: TradeInput) {
  const offeredId = input.offeredCharacterId ?? null;
  const requestedId = input.requestedCharacterId ?? null;
  if (!offeredId && !requestedId) throw badRequest("Escolha uma figurinha para oferecer ou pedir");
  if (offeredId && offeredId === requestedId) throw badRequest("Escolha figurinhas diferentes");
  await requireFriends(prisma, userId, input.toUserId);

  const settings = await getSettings(prisma);
  await expireTrades(prisma);
  const pending = await prisma.trade.count({ where: { proposerId: userId, status: "PENDING" } });
  if (pending >= settings.maxPendingTrades) throw badRequest(`Você já tem ${pending} propostas abertas. Espere respostas ou cancele alguma.`);

  let offeredName: string | null = null;
  let requestedName: string | null = null;
  if (offeredId) {
    const mine = await duplicateOf(prisma, userId, offeredId);
    if (!mine || mine.duplicates <= 0) throw badRequest("Você só pode oferecer figurinhas repetidas");
    offeredName = mine.character.name;
  }
  if (requestedId) {
    const theirs = await duplicateOf(prisma, input.toUserId, requestedId);
    if (!theirs || theirs.duplicates <= 0) throw badRequest("Seu amigo não tem essa figurinha repetida");
    requestedName = theirs.character.name;
  }

  const note = input.message?.trim() ? moderateText(input.message.trim()) : null;
  const trade = await prisma.trade.create({
    data: { proposerId: userId, receiverId: input.toUserId, offeredCharacterId: offeredId, requestedCharacterId: requestedId, message: note },
    include: tradeInclude,
  });
  await prisma.message.create({ data: { senderId: userId, receiverId: input.toUserId, text: tradeSummary(offeredName, requestedName), tradeId: trade.id } });
  return toTrade(trade);
}

async function acceptedToday(tx: Tx, userId: number) {
  const { start, end } = dayRangeInTimeZone(new Date(), env.timezone);
  return tx.trade.count({ where: { status: "ACCEPTED", respondedAt: { gte: start, lt: end }, OR: [{ proposerId: userId }, { receiverId: userId }] } });
}

/** Passa uma cópia repetida de quem dá para quem recebe. */
async function moveDuplicate(tx: Tx, fromId: number, toId: number, characterId: number) {
  const updated = await tx.userSticker.updateMany({ where: { userId: fromId, characterId, duplicates: { gt: 0 } }, data: { duplicates: { decrement: 1 } } });
  if (updated.count === 0) throw badRequest("A figurinha repetida não está mais disponível. A proposta foi cancelada.");
  return grantStickerOrDuplicate(tx, toId, characterId);
}

export async function respondTrade(userId: number, tradeId: number, action: "accept" | "decline" | "cancel") {
  await expireTrades(prisma);
  return transaction(async (tx) => {
    // Trava a proposta: dois cliques em "aceitar" não trocam duas vezes.
    await tx.$queryRaw`SELECT id FROM trades WHERE id = ${tradeId} FOR UPDATE`;
    const trade = await tx.trade.findUnique({ where: { id: tradeId }, include: tradeInclude });
    if (!trade || (trade.receiverId !== userId && trade.proposerId !== userId)) throw notFound("Proposta não encontrada");
    if (trade.status !== "PENDING") throw badRequest(trade.status === "EXPIRED" ? "Esta proposta expirou" : "Esta proposta já foi respondida");

    if (action === "cancel") {
      if (trade.proposerId !== userId) throw forbidden("Só quem propôs pode cancelar");
      const saved = await tx.trade.update({ where: { id: trade.id }, data: { status: "CANCELLED", respondedAt: new Date() }, include: tradeInclude });
      return { trade: toTrade(saved), received: null, unlockedAchievements: [] };
    }
    if (trade.receiverId !== userId) throw forbidden("Só quem recebeu a proposta pode responder");

    if (action === "decline") {
      const saved = await tx.trade.update({ where: { id: trade.id }, data: { status: "DECLINED", respondedAt: new Date() }, include: tradeInclude });
      await tx.message.create({ data: { senderId: userId, receiverId: trade.proposerId, text: "Proposta recusada", tradeId: trade.id } });
      return { trade: toTrade(saved), received: null, unlockedAchievements: [] };
    }

    // Aceitar: trava os dois jogadores sempre na mesma ordem (evita impasse entre transações).
    for (const id of [trade.proposerId, trade.receiverId].sort((a, b) => a - b)) {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${id} FOR UPDATE`;
    }
    const settings = await getSettings(tx);
    if ((await acceptedToday(tx, userId)) >= settings.tradesPerDay) throw badRequest(`Você já fez ${settings.tradesPerDay} trocas hoje. Volte amanhã!`);
    if ((await acceptedToday(tx, trade.proposerId)) >= settings.tradesPerDay) throw badRequest("Seu amigo já atingiu o limite de trocas de hoje");
    if (!(await areFriends(tx, trade.proposerId, trade.receiverId))) throw forbidden("Vocês não são mais amigos");

    let receivedUnlocked: boolean | null = null;
    if (trade.offeredCharacterId) receivedUnlocked = await moveDuplicate(tx, trade.proposerId, userId, trade.offeredCharacterId);
    if (trade.requestedCharacterId) await moveDuplicate(tx, userId, trade.proposerId, trade.requestedCharacterId);

    const saved = await tx.trade.update({ where: { id: trade.id }, data: { status: "ACCEPTED", respondedAt: new Date() }, include: tradeInclude });
    await tx.message.create({ data: { senderId: userId, receiverId: trade.proposerId, text: "Troca aceita!", tradeId: trade.id } });
    const unlockedAchievements = await checkAchievements(tx, userId);
    await checkAchievements(tx, trade.proposerId);
    return {
      trade: toTrade(saved),
      received: trade.offeredCharacter ? { ...trade.offeredCharacter, unlocked: receivedUnlocked ?? false } : null,
      unlockedAchievements,
    };
  });
}

export async function listTrades(userId: number, box: "received" | "sent" | "history", page: number, size: number) {
  await expireTrades(prisma);
  const where: Prisma.TradeWhereInput =
    box === "received"
      ? { receiverId: userId, status: "PENDING" }
      : box === "sent"
        ? { proposerId: userId, status: "PENDING" }
        : { status: { not: "PENDING" }, OR: [{ proposerId: userId }, { receiverId: userId }] };
  const [trades, total] = await Promise.all([
    prisma.trade.findMany({
      where,
      orderBy: box === "history" ? { respondedAt: "desc" } : { createdAt: "desc" },
      skip: page * size,
      take: size,
      include: { ...tradeInclude, proposer: userCard, receiver: userCard },
    }),
    prisma.trade.count({ where }),
  ]);
  return pageOf(
    trades.map((trade) => ({ ...toTrade(trade), proposer: trade.proposer, receiver: trade.receiver })),
    total,
    page,
    size,
  );
}
