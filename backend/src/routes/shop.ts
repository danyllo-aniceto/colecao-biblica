import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { lockUser, prisma, transaction } from "../db/prisma";
import { badRequest, notFound } from "../lib/errors";
import { parseId, requiredText, z } from "../lib/validation";
import { currentUser, requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { rewardRef, toShopItemResponse } from "../services/mappers";
import { applyReward, ensureRewardIsUseful, validateShopReward, walletData } from "../services/rewards";
import { getSettings } from "../services/settings";

export const shopRouter = Router();

const include = { rewardDefinition: rewardRef } as const;

const updateSchema = z.object({
  name: requiredText(150).optional(),
  description: requiredText(2000).optional(),
  itemType: z.enum(["STICKER", "GAME_BONUS", "ECONOMY"]).nullish(),
  priceCoins: z.number().int().min(0).nullish(),
  rewardDefinitionId: z.number().int().positive().nullish(),
  active: z.boolean().nullish(),
});

shopRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const items = await prisma.shopItem.findMany({ where: { active: true }, include, orderBy: [{ priceCoins: "asc" }, { id: "asc" }] });
    res.json(items.map(toShopItemResponse));
  }),
);

shopRouter.post("/admin", requireAdmin, () => {
  throw badRequest("Os itens da loja são fixos do sistema e não podem ser criados");
});

shopRouter.put(
  "/admin/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const input = updateSchema.parse(req.body);
    const item = await prisma.shopItem.findUnique({ where: { id } });
    if (!item) {
      throw notFound("Item da loja não encontrado");
    }

    const data: Prisma.ShopItemUncheckedUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.itemType != null) data.itemType = input.itemType;
    if (input.priceCoins != null) data.priceCoins = input.priceCoins;
    if (input.rewardDefinitionId != null) {
      const reward = await prisma.rewardDefinition.findUnique({ where: { id: input.rewardDefinitionId } });
      if (!reward) {
        throw notFound("Recompensa da loja não encontrada");
      }
      validateShopReward(reward);
      data.rewardDefinitionId = reward.id;
    }
    if (input.active != null) data.active = input.active;

    res.json(toShopItemResponse(await prisma.shopItem.update({ where: { id }, data, include })));
  }),
);

shopRouter.delete("/admin/:id", requireAdmin, () => {
  throw badRequest("Os itens da loja são fixos do sistema e não podem ser removidos");
});

shopRouter.post(
  "/buy/:id",
  asyncHandler(async (req, res) => {
    const itemId = parseId(req.params.id);
    const userId = currentUser(req).id;

    const result = await transaction(async (tx) => {
      const item = await tx.shopItem.findUnique({ where: { id: itemId }, include: { rewardDefinition: true } });
      if (!item) throw notFound("Item da loja não encontrado");
      if (!item.active) throw badRequest("Item da loja inativo");
      const reward = item.rewardDefinition;
      if (!reward) throw badRequest("Item da loja sem recompensa configurada");
      validateShopReward(reward);

      await lockUser(tx, userId);
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      if (user.coins < item.priceCoins) {
        throw badRequest("Moedas insuficientes");
      }

      const settings = await getSettings(tx);
      await ensureRewardIsUseful(tx, user, reward, settings);

      const wallet = { ...user, coins: user.coins - item.priceCoins };
      const applied = await applyReward(tx, wallet, reward, settings);
      const saved = await tx.user.update({ where: { id: userId }, data: walletData(wallet) });

      return {
        item: toShopItemResponse(item),
        rewardType: applied.rewardType,
        characterId: applied.characterId,
        characterName: applied.characterName,
        characterRarity: applied.characterRarity,
        characterUnlocked: applied.characterUnlocked,
        userCoins: saved.coins,
        extraLifeBoosts: saved.extraLifeBoosts,
        extraTimeBoosts: saved.extraTimeBoosts,
        doubleXpBoosts: saved.doubleXpBoosts,
      };
    });

    res.json(result);
  }),
);
