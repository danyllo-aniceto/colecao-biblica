import { Router } from "express";
import { lockUser, prisma, transaction } from "../db/prisma";
import { badRequest } from "../lib/errors";
import { env } from "../lib/env";
import { currentUser } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { checkAchievements } from "../services/achievements";
import { DAILY_CYCLE_DAYS, cycleDay, dailyRewardFor, dailyStatus } from "../services/game-rules";
import { getSettings, type GameSettings } from "../services/settings";

export const dailyRouter = Router();

function cycleOf(settings: GameSettings) {
  return Array.from({ length: DAILY_CYCLE_DAYS }, (_, index) => ({ day: index + 1, ...dailyRewardFor(index + 1, settings) }));
}

/** Situação do prêmio diário: se dá para resgatar, a sequência e os prêmios do ciclo de 7 dias. */
dailyRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const settings = await getSettings(prisma);
    const status = dailyStatus(user.lastDailyClaim, user.dailyStreak, new Date(), env.timezone);
    // Se a sequência quebrou, o próximo resgate volta ao dia 1.
    const streak = status.claimedToday ? user.dailyStreak : status.nextStreak - 1;
    res.json({
      canClaim: !status.claimedToday,
      streak,
      nextDay: cycleDay(status.claimedToday ? user.dailyStreak + 1 : status.nextStreak),
      todayDay: status.claimedToday ? cycleDay(user.dailyStreak) : null,
      cycle: cycleOf(settings),
    });
  }),
);

dailyRouter.post(
  "/claim",
  asyncHandler(async (req, res) => {
    const userId = currentUser(req).id;
    const result = await transaction(async (tx) => {
      await lockUser(tx, userId);
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      const now = new Date();
      const status = dailyStatus(user.lastDailyClaim, user.dailyStreak, now, env.timezone);
      if (status.claimedToday) {
        throw badRequest("Você já resgatou o prêmio de hoje. Volte amanhã!");
      }

      const settings = await getSettings(tx);
      const day = cycleDay(status.nextStreak);
      const reward = dailyRewardFor(day, settings);
      const hints = Math.min(user.hintBoosts + reward.hints, settings.maxHintBoosts);
      await tx.user.update({
        where: { id: userId },
        data: { coins: user.coins + reward.coins, hintBoosts: hints, dailyStreak: status.nextStreak, lastDailyClaim: now },
      });
      const unlockedAchievements = await checkAchievements(tx, userId);
      const saved = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      return {
        day,
        streak: saved.dailyStreak,
        coins: reward.coins,
        hints: hints - user.hintBoosts,
        unlockedAchievements,
        userCoins: saved.coins,
        hintBoosts: saved.hintBoosts,
      };
    });
    res.json(result);
  }),
);
