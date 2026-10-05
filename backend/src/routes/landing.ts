import { Router } from "express";
import { prisma } from "../db/prisma";
import { asyncHandler } from "../middleware/errorHandler";
import { visibleCharacter } from "../services/visibility";

/** Dados públicos da página inicial (sem login). */
export const landingRouter = Router();

/** Personagens de exemplo mostrados na página inicial: nome, raridade e imagem já cadastrados. */
export const LANDING_STICKERS = ["Rute", "Davi", "Ester", "Paulo"] as const;

landingRouter.get(
  "/stickers",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.biblicalCharacter.findMany({
      where: { name: { in: [...LANDING_STICKERS] }, ...visibleCharacter() },
      select: { name: true, rarity: true, imageUrl: true },
    });
    res.json(LANDING_STICKERS.flatMap((name) => rows.filter((row) => row.name === name)));
  }),
);
