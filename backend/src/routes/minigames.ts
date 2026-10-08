import { Router } from "express";
import { prisma } from "../db/prisma";
import { readPage } from "../lib/pagination";
import { currentUser } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { finishMiniGame, guessHangman, startMiniGame } from "../services/minigame-play";
import { getMiniGames, peitoralGallery, weeklyRanking } from "../services/minigames";
import { z } from "../lib/validation";

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

/** Começa uma partida: o gabarito fica no servidor e a tela recebe só o jogo. */
miniGamesRouter.post(
  "/:game/start",
  asyncHandler(async (req, res) => {
    res.json(await startMiniGame(currentUser(req).id, String(req.params.game)));
  }),
);

/** Termina a partida: o servidor confere a resposta e calcula os pontos (a tela nunca manda a pontuação). */
miniGamesRouter.post(
  "/runs/:run/finish",
  asyncHandler(async (req, res) => {
    res.json(await finishMiniGame(currentUser(req).id, String(req.params.run), req.body));
  }),
);

/** Forca: um palpite por vez, conferido no servidor. */
miniGamesRouter.post(
  "/runs/:run/guess",
  asyncHandler(async (req, res) => {
    const { letter } = z.object({ letter: z.string().min(1).max(4) }).parse(req.body);
    res.json(await guessHangman(currentUser(req).id, String(req.params.run), letter));
  }),
);
