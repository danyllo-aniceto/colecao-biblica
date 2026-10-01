import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { lockUser, prisma, transaction } from "../db/prisma";
import { badRequest, notFound } from "../lib/errors";
import { parseId, requiredText, z } from "../lib/validation";
import { currentUser, requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { rewardRef, toShopItemResponse } from "../services/mappers";
import { checkAchievements } from "../services/achievements";
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

const createSchema = z.object({
  name: requiredText(150),
  description: requiredText(2000),
  itemType: z.enum(["STICKER", "GAME_BONUS", "ECONOMY"]),
  priceCoins: z.number().int().min(1).max(100_000),
  rewardDefinitionId: z.number().int().positive(),
  active: z.boolean().optional(),
});

async function shopReward(id: number) {
  const reward = await prisma.rewardDefinition.findUnique({ where: { id } });
  if (!reward) {
    throw notFound("Recompensa da loja não encontrada");
  }
  validateShopReward(reward);
  return reward;
}

async function ensureNameAvailable(name: string, exceptId?: number) {
  const existing = await prisma.shopItem.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (existing) throw badRequest("Já existe um item com esse nome");
}

/** Painel: todos os itens, inclusive os inativos. */
shopRouter.get(
  "/admin",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const items = await prisma.shopItem.findMany({ include, orderBy: [{ system: "desc" }, { priceCoins: "asc" }, { id: "asc" }] });
    res.json(items.map(toShopItemResponse));
  }),
);

shopRouter.post(
  "/admin",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    await ensureNameAvailable(input.name);
    const reward = await shopReward(input.rewardDefinitionId);
    const item = await prisma.shopItem.create({
      data: {
        name: input.name,
        description: input.description,
        itemType: input.itemType,
        priceCoins: input.priceCoins,
        rewardDefinitionId: reward.id,
        active: input.active ?? true,
        system: false,
      },
      include,
    });
    res.status(201).json(toShopItemResponse(item));
  }),
);

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
    if (input.description !== undefined) data.description = input.description;
    if (input.priceCoins != null) data.priceCoins = input.priceCoins;
    if (input.active != null) data.active = input.active;
    // Nome, tipo e recompensa dos itens do sistema são fixos (o deploy os reaplica).
    if (!item.system) {
      if (input.name !== undefined && input.name !== item.name) {
        await ensureNameAvailable(input.name, item.id);
        data.name = input.name;
      }
      if (input.itemType != null) data.itemType = input.itemType;
      if (input.rewardDefinitionId != null) data.rewardDefinitionId = (await shopReward(input.rewardDefinitionId)).id;
    }

    res.json(toShopItemResponse(await prisma.shopItem.update({ where: { id }, data, include })));
  }),
);

shopRouter.delete(
  "/admin/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const item = await prisma.shopItem.findUnique({ where: { id: parseId(req.params.id) } });
    if (!item) {
      throw notFound("Item da loja não encontrado");
    }
    if (item.system) {
      throw badRequest("Os itens fixos da loja não podem ser removidos. Você pode desativá-los.");
    }
    await prisma.shopItem.delete({ where: { id: item.id } });
    res.status(204).end();
  }),
);

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
      await tx.user.update({ where: { id: userId }, data: walletData(wallet) });
      const unlockedAchievements = await checkAchievements(tx, userId);
      const saved = await tx.user.findUniqueOrThrow({ where: { id: userId } });

      return {
        item: toShopItemResponse(item),
        rewardType: applied.rewardType,
        characterId: applied.characterId,
        characterName: applied.characterName,
        characterRarity: applied.characterRarity,
        characterImageUrl: applied.characterImageUrl,
        characterUnlocked: applied.characterUnlocked,
        duplicateCoins: applied.duplicateCoins,
        unlockedAchievements,
        userCoins: saved.coins,
        extraLifeBoosts: saved.extraLifeBoosts,
        extraTimeBoosts: saved.extraTimeBoosts,
        doubleXpBoosts: saved.doubleXpBoosts,
        hintBoosts: saved.hintBoosts,
      };
    });

    res.json(result);
  }),
);
