import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { badRequest } from "../lib/errors";
import { parseId, z } from "../lib/validation";
import { requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { characterRef, toRewardResponse } from "../services/mappers";

export const rewardsRouter = Router();

const include = { stickerCharacter: characterRef } as const;

// Tipo e raridade são fixos; o admin ajusta só quantidades, chance e se está ativa.
const updateSchema = z.object({
  coinAmount: z.number().int().min(0).nullish(),
  extraLives: z.number().int().min(0).nullish(),
  extraTimeSeconds: z.number().int().min(0).nullish(),
  xpMultiplier: z.number().min(0).nullish(),
  dropChance: z.number().nullish(),
  active: z.boolean().nullish(),
});

rewardsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rewards = await prisma.rewardDefinition.findMany({ include, orderBy: { id: "asc" } });
    res.json(rewards.map(toRewardResponse));
  }),
);

rewardsRouter.post("/admin", requireAdmin, () => {
  throw badRequest("As recompensas são fixas do sistema. Apenas probabilidade e configuração podem ser alteradas");
});

rewardsRouter.put(
  "/admin/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const input = updateSchema.parse(req.body);
    const reward = await prisma.rewardDefinition.findUnique({ where: { id } });
    if (!reward) {
      throw badRequest("Recompensa não encontrada");
    }

    const data: Prisma.RewardDefinitionUpdateInput = {};
    if (input.coinAmount != null) data.coinAmount = input.coinAmount;
    if (input.extraLives != null) data.extraLives = input.extraLives;
    if (input.extraTimeSeconds != null) data.extraTimeSeconds = input.extraTimeSeconds;
    if (input.xpMultiplier != null) data.xpMultiplier = input.xpMultiplier;
    if (input.dropChance != null) {
      if (input.dropChance <= 0) {
        throw badRequest("Chance de drop deve ser maior que zero");
      }
      data.dropChance = input.dropChance;
    }
    if (input.active != null) data.active = input.active;

    res.json(toRewardResponse(await prisma.rewardDefinition.update({ where: { id }, data, include })));
  }),
);

rewardsRouter.delete("/admin/:id", requireAdmin, () => {
  throw badRequest("As recompensas são fixas do sistema e não podem ser removidas");
});
