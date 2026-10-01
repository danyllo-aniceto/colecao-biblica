import { Router } from "express";
import { prisma } from "../db/prisma";
import { env } from "../lib/env";
import { asyncHandler } from "../middleware/errorHandler";
import { dayRangeInTimeZone } from "../services/game-rules";
import { uploadsConfigured } from "../services/uploads";

export const adminRouter = Router();

/** Números da visão geral do painel e pendências de conteúdo. */
adminRouter.get(
  "/stats",
  asyncHandler(async (_req, res) => {
    const { start } = dayRangeInTimeZone(new Date(), env.timezone);
    const weekAgo = new Date(Date.now() - 7 * 86_400_000);

    const [
      users,
      newUsersWeek,
      activeUsersWeek,
      characters,
      drafts,
      withoutImage,
      withoutQuestions,
      questions,
      inactiveQuestions,
      byDifficulty,
      matchesToday,
      matchesWeek,
      stickersGranted,
      byRarity,
    ] = await Promise.all([
      prisma.user.count({ where: { deleted: false, role: "USER" } }),
      prisma.user.count({ where: { deleted: false, role: "USER", createdAt: { gte: weekAgo } } }),
      prisma.quizMatch.groupBy({ by: ["userId"], where: { finishedAt: { gte: weekAgo } } }).then((rows) => rows.length),
      prisma.biblicalCharacter.count(),
      prisma.biblicalCharacter.count({ where: { published: false } }),
      prisma.biblicalCharacter.count({ where: { OR: [{ imageUrl: null }, { imageUrl: "" }] } }),
      prisma.biblicalCharacter.count({ where: { questions: { none: { active: true } } } }),
      prisma.question.count(),
      prisma.question.count({ where: { active: false } }),
      prisma.question.groupBy({ by: ["difficulty"], where: { active: true }, _count: { _all: true } }),
      prisma.quizMatch.count({ where: { finishedAt: { gte: start } } }),
      prisma.quizMatch.count({ where: { finishedAt: { gte: weekAgo } } }),
      prisma.userSticker.count(),
      prisma.biblicalCharacter.groupBy({ by: ["rarity"], where: { published: true }, _count: { _all: true } }),
    ]);

    const generalQuestions = await prisma.question.count({ where: { active: true, relatedCharacterId: null } });

    res.json({
      users,
      newUsersWeek,
      activeUsersWeek,
      characters,
      drafts,
      withoutImage,
      withoutQuestions,
      questions,
      inactiveQuestions,
      generalQuestions,
      questionsByDifficulty: Object.fromEntries(byDifficulty.map((row) => [row.difficulty, row._count._all])),
      charactersByRarity: Object.fromEntries(byRarity.map((row) => [row.rarity, row._count._all])),
      matchesToday,
      matchesWeek,
      stickersGranted,
      uploads: uploadsConfigured() ? "blob" : "inline",
    });
  }),
);
