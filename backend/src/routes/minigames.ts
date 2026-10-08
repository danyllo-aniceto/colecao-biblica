import { Router } from "express";
import { prisma } from "../db/prisma";
import { readPage } from "../lib/pagination";
import { currentUser } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { getMiniGames, peitoralGallery, weeklyRanking } from "../services/minigames";

/** Mini games: catálogo com a liberação por pedra, ranking semanal (Peitoral Completo) e a Galeria dos Peitorais. Não dão XP nem moedas. */
export const miniGamesRouter = Router();

miniGamesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await getMiniGames(prisma, currentUser(req).id));
  }),
);

miniGamesRouter.get(
  "/ranking",
  asyncHandler(async (req, res) => {
    const { page, size, skip, take } = readPage(req, 20, 100);
    res.json(await weeklyRanking(prisma, currentUser(req).id, skip, take, page, size));
  }),
);

miniGamesRouter.get(
  "/gallery",
  asyncHandler(async (req, res) => {
    const { page, size, skip, take } = readPage(req, 20, 100);
    res.json(await peitoralGallery(prisma, currentUser(req).id, skip, take, page, size));
  }),
);
