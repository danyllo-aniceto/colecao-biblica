import { Router } from "express";
import { prisma } from "../db/prisma";
import { currentUser } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { listAchievements } from "../services/achievements";

export const achievementsRouter = Router();

achievementsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await listAchievements(prisma, currentUser(req).id));
  }),
);
