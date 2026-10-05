import { Router } from "express";
import { prisma } from "../db/prisma";
import { imageRef, z } from "../lib/validation";
import { requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";

/** Capas dos modos de jogo da aba Jogar: qualquer jogador lê, só o admin troca. */
export const gameModesRouter = Router();

export const GAME_MODES = ["QUIZ", "BOARD", "DUEL"] as const;
const select = { mode: true, imageUrl: true } as const;

gameModesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.json(await prisma.gameModeDesign.findMany({ select }));
  }),
);

gameModesRouter.put(
  "/admin/:mode",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const mode = z.enum(GAME_MODES).parse(String(req.params.mode).toUpperCase());
    const input = z.object({ imageUrl: imageRef() }).parse(req.body);
    const data = { imageUrl: input.imageUrl ?? null };
    res.json(await prisma.gameModeDesign.upsert({ where: { mode }, create: { mode, ...data }, update: data, select }));
  }),
);
