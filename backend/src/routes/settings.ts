import { Router } from "express";
import { prisma } from "../db/prisma";
import { z } from "../lib/validation";
import { requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { getSettings, updateSettings } from "../services/settings";

export const settingsRouter = Router();

const int = (min: number, max: number) => z.number().int().min(min).max(max).nullish();

const updateSchema = z.object({
  maxQuestionsPerMatch: int(1, 1000),
  startingLives: int(1, 20),
  rewardMatchLimitPerDay: int(0, 20),
  characterStudyXpPercent: int(0, 100),
  maxExtraLifeBoosts: int(1, 20),
  maxExtraTimeBoosts: int(1, 20),
  maxDoubleXpBoosts: int(1, 20),
  doubleXpMultiplier: z.number().min(1).max(10).nullish(),
  extraTimeSeconds: int(1, 120),
  rewardMinCorrectAnswers: int(1, 100),
  characterStickerMinAccuracyPercent: int(0, 100),
  maxHintBoosts: int(1, 20),
  coinsPerCorrectAnswer: int(0, 100),
  perfectMatchBonusCoins: int(0, 1000),
  coinMatchLimitPerDay: int(0, 100),
  duplicateCoinsCommon: int(0, 10_000),
  duplicateCoinsRare: int(0, 10_000),
  duplicateCoinsEpic: int(0, 10_000),
  duplicateCoinsLegendary: int(0, 10_000),
  dailyRewardBaseCoins: int(0, 10_000),
  dailyRewardStepCoins: int(0, 10_000),
  dailyRewardDay7Coins: int(0, 10_000),
  packOddsCommon: int(0, 1000),
  packOddsRare: int(0, 1000),
  packOddsEpic: int(0, 1000),
  packOddsLegendary: int(0, 1000),
  maxStreakFreezes: int(1, 10),
  pityThreshold: int(0, 50),
  fuseCost: int(2, 10),
  dailyChallengeQuestions: int(3, 30),
  leagueFirstCoins: int(0, 100_000),
  leagueSecondCoins: int(0, 100_000),
  leagueThirdCoins: int(0, 100_000),
  chatEnabled: int(0, 1),
  tradesPerDay: int(0, 100),
  maxPendingTrades: int(1, 100),
  tradeExpireDays: int(1, 60),
  maxSkipBoosts: int(1, 20),
  maxSecondChanceBoosts: int(1, 20),
  maxCrowdBoosts: int(1, 20),
  maxVerseHintBoosts: int(1, 20),
  maxFreezeTimeBoosts: int(1, 20),
  maxDoubleCoinsBoosts: int(1, 20),
  maxComboShieldBoosts: int(1, 20),
  doubleCoinsMultiplier: z.number().min(1).max(10).nullish(),
  comboStartAt: int(2, 20),
  comboPointsPerAnswer: int(0, 100),
  comboCoinsPerAnswer: int(0, 20),
  chestBaseCoins: int(0, 10_000),
  chestCoinsPerLevel: int(0, 1000),
  chestCosmeticChance: int(0, 100),
});

settingsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await getSettings(prisma));
  }),
);

settingsRouter.put(
  "/admin",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = updateSchema.parse(req.body);
    const changes = Object.fromEntries(Object.entries(input).filter(([, value]) => value != null)) as Record<string, number>;
    res.json(await updateSettings(prisma, changes));
  }),
);
