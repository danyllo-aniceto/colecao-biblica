import { lockUser, prisma, transaction, type Db } from "../db/prisma";
import { badRequest } from "../lib/errors";
import { env } from "../lib/env";
import { pageOf } from "../lib/pagination";
import { previousWeekKey, weekKeyInTimeZone, weekRangeInTimeZone } from "./game-rules";
import { getSettings, type GameSettings } from "./settings";

/**
 * Liga semanal: ranking pelos pontos ganhos na semana (segunda a domingo, no
 * fuso do app). Zera toda semana, então quem começou agora também disputa.
 * Os 3 primeiros da semana passada resgatam um prêmio em moedas.
 */

type Standing = { userId: number; score: number; matches: number };

async function standings(db: Db, weekKey: string): Promise<Standing[]> {
  const { start, end } = weekRangeInTimeZone(weekKey, env.timezone);
  const groups = await db.quizMatch.groupBy({
    by: ["userId"],
    where: { finishedAt: { gte: start, lt: end }, user: { deleted: false } },
    _sum: { scoreGained: true },
    _count: { _all: true },
  });
  return groups
    .map((group) => ({ userId: group.userId, score: group._sum.scoreGained ?? 0, matches: group._count._all }))
    .sort((left, right) => right.score - left.score || right.matches - left.matches || left.userId - right.userId);
}

function prizeFor(position: number, settings: GameSettings) {
  return [settings.leagueFirstCoins, settings.leagueSecondCoins, settings.leagueThirdCoins][position - 1] ?? 0;
}

export async function getLeague(userId: number, page: number, size: number) {
  const weekKey = weekKeyInTimeZone(new Date(), env.timezone);
  const lastWeekKey = previousWeekKey(weekKey);
  const [current, last, settings] = await Promise.all([standings(prisma, weekKey), standings(prisma, lastWeekKey), getSettings(prisma)]);

  const slice = current.slice(page * size, page * size + size);
  const users = await prisma.user.findMany({ where: { id: { in: slice.map((entry) => entry.userId) } }, select: { id: true, name: true, level: true } });
  const byId = new Map(users.map((user) => [user.id, user]));
  const content = slice.map((entry, index) => ({
    position: page * size + index + 1,
    userId: entry.userId,
    userName: byId.get(entry.userId)?.name ?? "Jogador",
    level: byId.get(entry.userId)?.level ?? 1,
    score: entry.score,
    matches: entry.matches,
    prize: prizeFor(page * size + index + 1, settings),
  }));

  const myIndex = current.findIndex((entry) => entry.userId === userId);
  const lastIndex = last.findIndex((entry) => entry.userId === userId);
  const lastPosition = lastIndex === -1 ? null : lastIndex + 1;
  const lastPrize = lastPosition ? prizeFor(lastPosition, settings) : 0;
  const claimed = lastPrize > 0 ? Boolean(await prisma.userClaim.findFirst({ where: { userId, kind: "LEAGUE", periodKey: lastWeekKey } })) : false;

  return {
    ...pageOf(content, current.length, page, size),
    weekKey,
    endsAt: weekRangeInTimeZone(weekKey, env.timezone).end,
    prizes: [settings.leagueFirstCoins, settings.leagueSecondCoins, settings.leagueThirdCoins],
    me: myIndex === -1 ? null : { position: myIndex + 1, score: current[myIndex].score, matches: current[myIndex].matches },
    lastWeek: { weekKey: lastWeekKey, position: lastPosition, prize: lastPrize, claimed },
  };
}

/** Resgata o prêmio de top 3 da semana passada (uma vez). */
export async function claimLeaguePrize(userId: number) {
  return transaction(async (tx) => {
    await lockUser(tx, userId);
    const lastWeekKey = previousWeekKey(weekKeyInTimeZone(new Date(), env.timezone));
    const [last, settings] = await Promise.all([standings(tx, lastWeekKey), getSettings(tx)]);
    const position = last.findIndex((entry) => entry.userId === userId) + 1;
    const prize = position > 0 ? prizeFor(position, settings) : 0;
    if (prize <= 0) {
      throw badRequest("Você não ficou entre os 3 primeiros da semana passada");
    }
    const created = await tx.userClaim.createMany({ data: [{ userId, kind: "LEAGUE", code: "TOP3", periodKey: lastWeekKey }], skipDuplicates: true });
    if (created.count === 0) {
      throw badRequest("Prêmio da liga já resgatado");
    }
    const saved = await tx.user.update({ where: { id: userId }, data: { coins: { increment: prize } } });
    return { position, coins: prize, userCoins: saved.coins };
  });
}
