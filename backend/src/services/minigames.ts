import type { Db } from "../db/prisma";
import { env } from "../lib/env";
import { badRequest, notFound } from "../lib/errors";
import { pageOf } from "../lib/pagination";
import { dayKeyInTimeZone, MINI_GAMES, MINI_GAME_DAILY_COIN_WINS, MINI_GAME_WIN_COINS, miniGameUnlocked, weekKeyInTimeZone } from "./game-rules";
import { getBreastplate } from "./breastplate";
import { playerLooks } from "./cosmetics";

const FINAL_KIND = "BREASTPLATE";

/** Os mini games do jogador: quais estão liberados (pedra resgatada) e se o ranking semanal já abriu (Peitoral Completo). */
export async function getMiniGames(db: Db, userId: number) {
  const [breastplate, user] = await Promise.all([getBreastplate(db, userId), db.user.findUnique({ where: { id: userId }, select: { role: true } })]);
  // O administrador tem tudo liberado para testar os jogos (e não entra no ranking dos jogadores).
  const preview = user?.role === "ADMIN";
  const claimedSlots = breastplate.stones.filter((stone) => stone.state === "claimed").map((stone) => stone.slot);
  const stoneBySlot = new Map(breastplate.stones.map((stone) => [stone.slot, stone]));
  const day = dayKeyInTimeZone(new Date(), env.timezone);
  const winsToday = await db.userClaim.count({ where: { userId, kind: "MINIGAME", periodKey: day } });
  const designs = new Map((await db.miniGameDesign.findMany()).map((design) => [design.gameId, design]));
  return {
    games: MINI_GAMES.map((game) => ({
      id: game.id,
      name: game.name,
      emoji: game.emoji,
      text: game.text,
      stoneSlot: game.stoneSlot,
      stoneName: game.stoneSlot === null ? null : (stoneBySlot.get(game.stoneSlot)?.name ?? null),
      ready: game.ready,
      coverUrl: designs.get(game.id)?.coverUrl ?? null,
      backgroundUrl: designs.get(game.id)?.backgroundUrl ?? null,
      backUrl: designs.get(game.id)?.backUrl ?? null,
      unlocked: preview || miniGameUnlocked(game, claimedSlots),
    })),
    rankingUnlocked: preview || breastplate.finalClaimed,
    adminPreview: preview,
    /** Moedas da primeira vitória do dia em cada jogo, até `limit` jogos por dia. */
    coins: { perWin: MINI_GAME_WIN_COINS, limit: MINI_GAME_DAILY_COIN_WINS, winsToday },
    weekKey: weekKeyInTimeZone(new Date(), env.timezone),
  };
}

/**
 * Guarda a pontuação da semana (só a melhor de cada jogo). Quem chama é a rota do próprio jogo, que já conferiu a partida no servidor:
 * não há rota pública para enviar pontos. Só entra no ranking quem completou o Peitoral.
 */
export async function recordMiniGameScore(db: Db, userId: number, gameId: string, score: number) {
  const game = MINI_GAMES.find((item) => item.id === gameId);
  if (!game) throw notFound("Mini game não encontrado");
  if (!Number.isInteger(score) || score < 0) throw badRequest("Pontuação inválida");
  const { games, rankingUnlocked, weekKey } = await getMiniGames(db, userId);
  if (!games.find((item) => item.id === gameId)?.unlocked) throw badRequest("Esse mini game ainda não foi liberado");
  if (!rankingUnlocked) return { recorded: false, best: score, weekKey };
  const current = await db.miniGameScore.findUnique({ where: { userId_gameId_weekKey: { userId, gameId, weekKey } }, select: { score: true } });
  if (current && current.score >= score) return { recorded: false, best: current.score, weekKey };
  await db.miniGameScore.upsert({ where: { userId_gameId_weekKey: { userId, gameId, weekKey } }, create: { userId, gameId, weekKey, score }, update: { score } });
  return { recorded: true, best: score, weekKey };
}

/** Ranking semanal dos mini games (liberado a quem completou o Peitoral): soma da melhor pontuação de cada jogo. */
export async function weeklyRanking(db: Db, userId: number, skip: number, take: number, page: number, size: number) {
  const { rankingUnlocked, weekKey } = await getMiniGames(db, userId);
  if (!rankingUnlocked) throw badRequest("O ranking semanal dos mini games abre para quem completa o Peitoral");
  const where = { weekKey, user: { deleted: false, role: "USER" as const } };
  const grouped = await db.miniGameScore.groupBy({ by: ["userId"], where, _sum: { score: true }, orderBy: [{ _sum: { score: "desc" } }, { userId: "asc" }] });
  const names = await db.user.findMany({ where: { id: { in: grouped.map((row) => row.userId) } }, select: { id: true, name: true, level: true } });
  const looks = await playerLooks(db, grouped.slice(skip, skip + take).map((row) => row.userId).concat(userId));
  const nameOf = new Map(names.map((user) => [user.id, user]));
  const rows = grouped.map((row, index) => ({ position: index + 1, userId: row.userId, total: row._sum.score ?? 0 }));
  const content = rows.slice(skip, skip + take).map((row) => ({ ...row, userName: nameOf.get(row.userId)?.name ?? "Jogador", level: nameOf.get(row.userId)?.level ?? 1, look: looks.get(row.userId) ?? null }));
  const mine = rows.find((row) => row.userId === userId) ?? null;
  return { ...pageOf(content, rows.length, page, size), weekKey, me: mine ? { position: mine.position, total: mine.total } : null };
}

/** Galeria dos Peitorais: quem completou as 12 pedras, do primeiro ao mais recente. */
export async function peitoralGallery(db: Db, userId: number, skip: number, take: number, page: number, size: number) {
  const where = { kind: FINAL_KIND, user: { deleted: false } };
  const [claims, total] = await Promise.all([
    db.userClaim.findMany({ where, orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip, take, select: { userId: true, createdAt: true, user: { select: { name: true, level: true } } } }),
    db.userClaim.count({ where }),
  ]);
  const looks = await playerLooks(db, claims.map((claim) => claim.userId));
  const content = claims.map((claim, index) => ({ position: skip + index + 1, userId: claim.userId, userName: claim.user.name, level: claim.user.level, look: looks.get(claim.userId) ?? null, completedAt: claim.createdAt.toISOString() }));
  const mine = await db.userClaim.findFirst({ where: { userId, kind: FINAL_KIND }, select: { createdAt: true } });
  return { ...pageOf(content, total, page, size), me: mine ? { completedAt: mine.createdAt.toISOString() } : null };
}

/** Capa do cartão e fundo da tela de um mini game (painel). Campo ausente não altera; vazio limpa. */
export async function saveMiniGameDesign(db: Db, gameId: string, input: { coverUrl?: string | null; backgroundUrl?: string | null; backUrl?: string | null }) {
  if (!MINI_GAMES.some((game) => game.id === gameId)) throw notFound("Mini game não encontrado");
  const data = { ...(input.coverUrl !== undefined ? { coverUrl: input.coverUrl } : {}), ...(input.backgroundUrl !== undefined ? { backgroundUrl: input.backgroundUrl } : {}), ...(input.backUrl !== undefined ? { backUrl: input.backUrl } : {}) };
  const saved = await db.miniGameDesign.upsert({ where: { gameId }, create: { gameId, ...data }, update: data, select: { gameId: true, coverUrl: true, backgroundUrl: true, backUrl: true } });
  return saved;
}
