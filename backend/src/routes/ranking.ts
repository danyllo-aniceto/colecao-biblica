import { Router } from "express";
import { prisma } from "../db/prisma";
import { asyncHandler } from "../middleware/errorHandler";

export const rankingRouter = Router();

rankingRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      where: { deleted: false },
      orderBy: [{ totalScore: "desc" }, { xp: "desc" }, { id: "asc" }],
      take: 50,
      select: { id: true, name: true, level: true, totalScore: true, xp: true },
    });
    res.json(
      users.map((user, index) => ({
        position: index + 1,
        userId: user.id,
        userName: user.name,
        level: user.level,
        totalScore: user.totalScore,
        xp: user.xp,
      })),
    );
  }),
);
