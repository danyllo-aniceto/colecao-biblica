import { Router } from "express";
import { env } from "../lib/env";
import { dayKeyInTimeZone } from "../services/game-rules";

const STICKER_PURCHASE = "SHOP_STICKER";
const CHEST_PURCHASE = "SHOP_CHEST";
const CHEST_TIER_BY_REWARD = { CHEST_BRONZE: "BRONZE", CHEST_SILVER: "SILVER", CHEST_GOLD: "GOLD" } as const;
const chestTierOf = (type: string) => CHEST_TIER_BY_REWARD[type as keyof typeof CHEST_TIER_BY_REWARD] ?? null;
/** Figurinha, pacote e baú contam no limite diário de compras de figurinhas. */
/** Figurinha avulsa ou pacote (os baús têm o próprio limite diário). */
const isStickerReward = (type: string) => type === "STICKER" || type === "STICKER_PACK";
import { helperCounts } from "../services/helpers";
import type { Prisma, StickerRarity } from "@prisma/client";
import { lockUser, prisma, transaction } from "../db/prisma";
import { badRequest, notFound } from "../lib/errors";
import { parseId, requiredText, z } from "../lib/validation";
import { currentUser, requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { rewardRef, toShopItemResponse } from "../services/mappers";
import { checkAchievements } from "../services/achievements";
import { openChestRewards } from "../services/chests";
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

/** Quantas figurinhas (e pacotes) e quantos baús o jogador ainda pode comprar hoje. */
shopRouter.get(
  "/limits",
  asyncHandler(async (req, res) => {
    const settings = await getSettings(prisma);
    const where = { userId: currentUser(req).id, periodKey: dayKeyInTimeZone(new Date(), env.timezone) };
    const [bought, chestsBought] = await Promise.all([prisma.userClaim.count({ where: { ...where, kind: STICKER_PURCHASE } }), prisma.userClaim.count({ where: { ...where, kind: CHEST_PURCHASE } })]);
    res.json({ stickerLimitPerDay: settings.shopStickerLimitPerDay, stickersBoughtToday: bought, chestLimitPerDay: settings.shopChestLimitPerDay, chestsBoughtToday: chestsBought });
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

      // Limite diário de figurinhas compradas: a loja complementa, não substitui o jogo.
      if (isStickerReward(reward.rewardType) && settings.shopStickerLimitPerDay > 0) {
        const dayKey = dayKeyInTimeZone(new Date(), env.timezone);
        const bought = await tx.userClaim.count({ where: { userId, kind: STICKER_PURCHASE, periodKey: dayKey } });
        if (bought >= settings.shopStickerLimitPerDay) {
          throw badRequest(`Você já comprou ${settings.shopStickerLimitPerDay} figurinha(s) hoje. Jogue para ganhar mais ou volte amanhã!`);
        }
        await tx.userClaim.create({ data: { userId, kind: STICKER_PURCHASE, code: `n${bought + 1}`, periodKey: dayKey } });
      }

      // Limite diário de baús comprados (separado do das figurinhas e pacotes).
      if (chestTierOf(reward.rewardType) !== null && settings.shopChestLimitPerDay > 0) {
        const dayKey = dayKeyInTimeZone(new Date(), env.timezone);
        const bought = await tx.userClaim.count({ where: { userId, kind: CHEST_PURCHASE, periodKey: dayKey } });
        if (bought >= settings.shopChestLimitPerDay) {
          throw badRequest(`Você já comprou ${settings.shopChestLimitPerDay} baú(s) hoje. Jogue para ganhar mais ou volte amanhã!`);
        }
        await tx.userClaim.create({ data: { userId, kind: CHEST_PURCHASE, code: `n${bought + 1}`, periodKey: dayKey } });
      }

      const wallet = { ...user, coins: user.coins - item.priceCoins };
      // Baú comprado: abre na hora, com o mesmo conteúdo do baú da partida (o de diamante nunca é vendido).
      const chestTier = chestTierOf(reward.rewardType);
      const chest = chestTier ? await openChestRewards(tx, wallet, chestTier, settings, Math.random) : null;
      const bestSticker = chest?.prizes.filter((prize): prize is Extract<(typeof chest.prizes)[number], { kind: "STICKER" }> => prize.kind === "STICKER").at(-1) ?? null;
      const applied = chest
        ? {
            rewardType: reward.rewardType,
            characterId: bestSticker?.characterId ?? null,
            characterName: bestSticker?.name ?? null,
            characterRarity: (bestSticker?.rarity ?? null) as StickerRarity | null,
            characterImageUrl: bestSticker?.imageUrl ?? null,
            characterUnlocked: bestSticker?.unlocked ?? false,
            duplicate: bestSticker?.duplicate ?? false,
            cosmeticId: null,
            cosmeticName: null,
          }
        : await applyReward(tx, wallet, reward, settings);
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
        duplicate: applied.duplicate,
        unlockedAchievements,
        userCoins: saved.coins,
        extraLifeBoosts: saved.extraLifeBoosts,
        extraTimeBoosts: saved.extraTimeBoosts,
        doubleXpBoosts: saved.doubleXpBoosts,
        hintBoosts: saved.hintBoosts,
        streakFreezes: saved.streakFreezes,
        ...helperCounts(saved),
        cosmeticId: applied.cosmeticId,
        cosmeticName: applied.cosmeticName,
        chestTier: chest?.tier ?? null,
        chestPrizes: chest?.prizes ?? [],
      };
    });

    res.json(result);
  }),
);
