import { Router } from "express";
import type { Prisma, RewardDefinition } from "@prisma/client";
import { prisma } from "../db/prisma";
import { badRequest, notFound } from "../lib/errors";
import { parseId, requiredText, z } from "../lib/validation";
import { requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { isCampaignOnlyRarity } from "../services/game-rules";
import { characterRef, toRewardResponse } from "../services/mappers";

export const rewardsRouter = Router();

const include = { stickerCharacter: characterRef } as const;

const rewardType = z.enum([
  "STICKER",
  "STICKER_PACK",
  "EXTRA_LIFE",
  "EXTRA_TIME",
  "XP_MULTIPLIER",
  "FIFTY_FIFTY",
  "COINS",
  "STREAK_FREEZE",
  "SKIP_QUESTION",
  "SECOND_CHANCE",
  "CROWD_HELP",
  "VERSE_HINT",
  "FREEZE_TIME",
  "DOUBLE_COINS",
  "COMBO_SHIELD",
  "COSMETIC",
]);
const rarity = z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY"]);
const amount = z.number().int().min(1).max(10_000);

// Recompensas do sistema: só quantidades, chance e status. As criadas pelo admin aceitam tudo.
const updateSchema = z.object({
  name: requiredText(150).optional(),
  stickerRarity: rarity.nullish(),
  stickerCharacterId: z.number().int().positive().nullish(),
  coinAmount: z.number().int().min(0).max(10_000).nullish(),
  extraLives: z.number().int().min(0).max(20).nullish(),
  extraTimeSeconds: z.number().int().min(0).max(20).nullish(),
  xpMultiplier: z.number().min(0).nullish(),
  hintAmount: z.number().int().min(0).max(20).nullish(),
  boostAmount: z.number().int().min(0).max(20).nullish(),
  cosmeticId: z.number().int().positive().nullish(),
  dropChance: z.number().nullish(),
  active: z.boolean().nullish(),
});

const createSchema = z.object({
  name: requiredText(150),
  rewardType,
  stickerRarity: rarity.nullish(),
  stickerCharacterId: z.number().int().positive().nullish(),
  cosmeticId: z.number().int().positive().nullish(),
  amount: amount.nullish(),
  dropChance: z.number().positive().max(1000),
  active: z.boolean().optional(),
});

/** Campo de quantidade usado por cada tipo de recompensa. */
function amountData(type: RewardDefinition["rewardType"], value: number): Partial<RewardDefinition> {
  switch (type) {
    case "COINS":
      return { coinAmount: value };
    case "EXTRA_LIFE":
      return { extraLives: value };
    case "EXTRA_TIME":
      return { extraTimeSeconds: value };
    case "FIFTY_FIFTY":
      return { hintAmount: value };
    case "SKIP_QUESTION":
    case "SECOND_CHANCE":
    case "CROWD_HELP":
    case "VERSE_HINT":
    case "FREEZE_TIME":
    case "DOUBLE_COINS":
    case "COMBO_SHIELD":
      return { boostAmount: Math.min(value, 20) };
    default:
      return {};
  }
}

async function ensureStickerTarget(type: string, stickerRarity?: string | null, characterId?: number | null) {
  if (type !== "STICKER") return;
  if (!stickerRarity && !characterId) {
    throw badRequest("Figurinha precisa de uma raridade ou de um personagem");
  }
  if (characterId) {
    const character = await prisma.biblicalCharacter.findUnique({ where: { id: characterId }, select: { id: true, rarity: true } });
    if (!character) throw notFound("Personagem não encontrado");
    if (isCampaignOnlyRarity(character.rarity)) throw badRequest("A figurinha especial só pode ser ganha na campanha");
  }
}

async function ensureCosmeticTarget(type: string, cosmeticId?: number | null) {
  if (type !== "COSMETIC") return;
  if (!cosmeticId) throw badRequest("Escolha o item visual da recompensa");
  const cosmetic = await prisma.cosmetic.findUnique({ where: { id: cosmeticId }, select: { type: true } });
  if (!cosmetic) throw notFound("Item visual não encontrado");
}

async function ensureNameAvailable(name: string, exceptId?: number) {
  const existing = await prisma.rewardDefinition.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (existing) throw badRequest("Já existe uma recompensa com esse nome");
}

rewardsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const rewards = await prisma.rewardDefinition.findMany({ include, orderBy: [{ system: "desc" }, { id: "asc" }] });
    res.json(rewards.map(toRewardResponse));
  }),
);

rewardsRouter.post(
  "/admin",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    await ensureNameAvailable(input.name);
    await ensureStickerTarget(input.rewardType, input.stickerRarity, input.stickerCharacterId);
    await ensureCosmeticTarget(input.rewardType, input.cosmeticId);
    const isSticker = input.rewardType === "STICKER";
    const reward = await prisma.rewardDefinition.create({
      data: {
        name: input.name,
        rewardType: input.rewardType,
        stickerRarity: isSticker ? (input.stickerRarity ?? null) : null,
        stickerCharacterId: isSticker ? (input.stickerCharacterId ?? null) : null,
        cosmeticId: input.rewardType === "COSMETIC" ? (input.cosmeticId ?? null) : null,
        xpMultiplier: 1,
        ...amountData(input.rewardType, input.amount ?? 1),
        dropChance: input.dropChance,
        active: input.active ?? true,
        system: false,
      },
      include,
    });
    res.status(201).json(toRewardResponse(reward));
  }),
);

rewardsRouter.put(
  "/admin/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const input = updateSchema.parse(req.body);
    const reward = await prisma.rewardDefinition.findUnique({ where: { id } });
    if (!reward) {
      throw notFound("Recompensa não encontrada");
    }

    const data: Prisma.RewardDefinitionUncheckedUpdateInput = {};
    if (input.coinAmount != null) data.coinAmount = input.coinAmount;
    if (input.extraLives != null) data.extraLives = input.extraLives;
    if (input.extraTimeSeconds != null) data.extraTimeSeconds = input.extraTimeSeconds;
    if (input.xpMultiplier != null) data.xpMultiplier = input.xpMultiplier;
    if (input.hintAmount != null) data.hintAmount = input.hintAmount;
    if (input.boostAmount != null) data.boostAmount = input.boostAmount;
    if (input.dropChance != null) {
      if (input.dropChance <= 0) {
        throw badRequest("Chance de drop deve ser maior que zero");
      }
      data.dropChance = input.dropChance;
    }
    if (input.active != null) data.active = input.active;

    // Identidade só muda nas recompensas criadas pelo admin.
    if (!reward.system) {
      if (input.name !== undefined && input.name !== reward.name) {
        await ensureNameAvailable(input.name, reward.id);
        data.name = input.name;
      }
      if (reward.rewardType === "STICKER" && (input.stickerRarity !== undefined || input.stickerCharacterId !== undefined)) {
        const nextRarity = input.stickerRarity !== undefined ? input.stickerRarity : reward.stickerRarity;
        const nextCharacter = input.stickerCharacterId !== undefined ? input.stickerCharacterId : reward.stickerCharacterId;
        await ensureStickerTarget("STICKER", nextRarity, nextCharacter);
        data.stickerRarity = nextRarity;
        data.stickerCharacterId = nextCharacter;
      }
      if (reward.rewardType === "COSMETIC" && input.cosmeticId !== undefined) {
        await ensureCosmeticTarget("COSMETIC", input.cosmeticId);
        data.cosmeticId = input.cosmeticId;
      }
    }

    res.json(toRewardResponse(await prisma.rewardDefinition.update({ where: { id }, data, include })));
  }),
);

rewardsRouter.delete(
  "/admin/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const reward = await prisma.rewardDefinition.findUnique({ where: { id }, include: { shopItems: { select: { name: true } } } });
    if (!reward) {
      throw notFound("Recompensa não encontrada");
    }
    if (reward.system) {
      throw badRequest("As recompensas do sistema não podem ser removidas. Você pode desativá-las.");
    }
    if (reward.shopItems.length > 0) {
      throw badRequest(`Recompensa usada na loja (${reward.shopItems.map((item) => item.name).join(", ")}). Remova o item primeiro.`);
    }
    await prisma.rewardDefinition.delete({ where: { id } });
    res.status(204).end();
  }),
);
