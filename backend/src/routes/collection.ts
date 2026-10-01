import { Router } from "express";
import { prisma } from "../db/prisma";
import { currentUser } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { z } from "../lib/validation";
import { fuseDuplicates, sellDuplicates } from "../services/collection";
import { visibleCharacter } from "../services/visibility";

export const collectionRouter = Router();

collectionRouter.get(
  "/my",
  asyncHandler(async (req, res) => {
    const stickers = await prisma.userSticker.findMany({
      // Figurinha de personagem que voltou a ser rascunho some do álbum até ser republicada.
      where: { userId: currentUser(req).id, character: visibleCharacter() },
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
        duplicates: sticker.duplicates,
      })),
    );
  }),
);

collectionRouter.get(
  "/my/progress",
  asyncHandler(async (req, res) => {
    const [owned, total] = await Promise.all([
      prisma.userSticker.count({ where: { userId: currentUser(req).id, character: visibleCharacter() } }),
      prisma.biblicalCharacter.count({ where: visibleCharacter() }),
    ]);
    res.json({ owned, total });
  }),
);

const sellSchema = z.object({ characterId: z.number().int().positive(), quantity: z.number().int().min(1).max(100).default(1) });
const fuseSchema = z.object({ rarity: z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY"]) });

collectionRouter.post(
  "/sell",
  asyncHandler(async (req, res) => {
    const input = sellSchema.parse(req.body);
    res.json(await sellDuplicates(currentUser(req).id, input.characterId, input.quantity));
  }),
);

collectionRouter.post(
  "/fuse",
  asyncHandler(async (req, res) => {
    res.json(await fuseDuplicates(currentUser(req).id, fuseSchema.parse(req.body).rarity));
  }),
);
