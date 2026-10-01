import { Router } from "express";
import { prisma } from "../db/prisma";
import { currentUser } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";

export const collectionRouter = Router();

collectionRouter.get(
  "/my",
  asyncHandler(async (req, res) => {
    const stickers = await prisma.userSticker.findMany({
      // Figurinha de personagem que voltou a ser rascunho some do álbum até ser republicada.
      where: { userId: currentUser(req).id, character: { published: true } },
      include: { character: { select: { id: true, name: true, imageUrl: true, rarity: true } } },
      orderBy: { acquiredAt: "asc" },
    });
    res.json(
      stickers.map((sticker) => ({
        characterId: sticker.character.id,
        characterName: sticker.character.name,
        imageUrl: sticker.character.imageUrl,
        rarity: sticker.character.rarity,
        acquiredAt: sticker.acquiredAt,
      })),
    );
  }),
);

collectionRouter.get(
  "/my/progress",
  asyncHandler(async (req, res) => {
    const [owned, total] = await Promise.all([
      prisma.userSticker.count({ where: { userId: currentUser(req).id, character: { published: true } } }),
      prisma.biblicalCharacter.count({ where: { published: true } }),
    ]);
    res.json({ owned, total });
  }),
);
