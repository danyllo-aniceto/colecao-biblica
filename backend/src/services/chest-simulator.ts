import type { StickerRarity } from "@prisma/client";
import { prisma } from "../db/prisma";
import { CHEST_SPECS, chestStickerWeight, pickPackRarity, planChest, type ChestTier } from "./game-rules";
import { CHEST_BOOSTS } from "./progression";
import { availableRewards } from "./rewards";
import { getSettings } from "./settings";
import { visibleCharacter } from "./visibility";

const TIERS: ChestTier[] = ["BRONZE", "SILVER", "GOLD", "DIAMOND"];
const RARITIES: StickerRarity[] = ["COMMON", "RARE", "EPIC", "LEGENDARY"];

export type SimulatedPrize =
  | { kind: "COINS"; amount: number }
  | { kind: "HELPER"; name: string; amount: number }
  | { kind: "STICKER"; characterId: number | null; name: string | null; rarity: string | null; imageUrl: string | null; unlocked: boolean; duplicate: boolean }
  | { kind: "COSMETIC"; name: string };

/**
 * Simula a abertura dos baús com as regras e os dados de verdade (recompensas, personagens publicados e
 * configurações atuais), sem gravar nada. Serve para o admin conferir se o que cada baú entrega está bom.
 */
export async function simulateChests(runs: number) {
  const [settings, rewards, characters] = await Promise.all([
    getSettings(prisma),
    prisma.rewardDefinition.findMany({ where: { active: true }, orderBy: { id: "asc" } }),
    prisma.biblicalCharacter.findMany({ where: { ...visibleCharacter(), rarity: { not: "SPECIAL" } }, select: { id: true, name: true, rarity: true, imageUrl: true } }),
  ]);
  const available = await availableRewards(prisma, rewards);
  const stickerRewards = available.filter((reward) => reward.rewardType === "STICKER" || reward.rewardType === "STICKER_PACK");
  const publishedRarities = new Set(characters.map((character) => character.rarity));
  const raresAndEpics = await prisma.cosmetic.findMany({ where: { active: true, inChestPool: true, rarity: { in: ["RARE", "EPIC"] } }, select: { name: true } });

  const rarityOf = (rewardId: number): StickerRarity | null => {
    const reward = stickerRewards.find((item) => item.id === rewardId);
    if (!reward) return null;
    if (reward.rewardType === "STICKER_PACK") return pickPackRarity(settings, publishedRarities);
    return reward.stickerRarity;
  };
  const characterOf = (rarity: StickerRarity | null) => {
    const options = characters.filter((character) => character.rarity === rarity);
    return options.length > 0 ? options[Math.floor(Math.random() * options.length)] : null;
  };
  const helperPool = CHEST_BOOSTS.map((boost) => ({ field: boost.field as string, name: boost.name }));

  const roll = (tier: ChestTier) => planChest(tier, { stickerRewards, helperPool, forceSticker: false, cosmeticAvailable: raresAndEpics.length > 0 }, Math.random);

  const tiers = Object.fromEntries(
    TIERS.map((tier) => {
      // Diamante sem épica/lendária publicada vira ouro no jogo: mostra o aviso em vez de números enganosos.
      const possible = tier !== "DIAMOND" || stickerRewards.some((reward) => chestStickerWeight("DIAMOND", reward) > 0);
      let coins = 0;
      let stickers = 0;
      let withSticker = 0;
      let withTwo = 0;
      let cosmetic = 0;
      let helpers = 0;
      const rarity: Record<string, number> = Object.fromEntries(RARITIES.map((item) => [item, 0]));
      const helperCount: Record<string, number> = {};
      for (let index = 0; index < runs; index += 1) {
        const plan = roll(tier);
        coins += plan.coins;
        stickers += plan.stickers.length;
        if (plan.stickers.length >= 1) withSticker += 1;
        if (plan.stickers.length >= 2) withTwo += 1;
        if (plan.cosmetic) cosmetic += 1;
        helpers += plan.helpers.length;
        for (const helper of plan.helpers) helperCount[helper.name] = (helperCount[helper.name] ?? 0) + 1;
        for (const sticker of plan.stickers) {
          const resolved = rarityOf(sticker.rewardId);
          if (resolved) rarity[resolved] += 1;
        }
      }
      const samples: SimulatedPrize[][] = Array.from({ length: 3 }, () => {
        const plan = roll(tier);
        const prizes: SimulatedPrize[] = [{ kind: "COINS", amount: plan.coins }];
        for (const helper of plan.helpers) prizes.push({ kind: "HELPER", name: helper.name, amount: 1 });
        for (const sticker of plan.stickers) {
          const resolved = rarityOf(sticker.rewardId);
          const character = characterOf(resolved);
          prizes.push({ kind: "STICKER", characterId: character?.id ?? null, name: character?.name ?? "Figurinha", rarity: resolved, imageUrl: character?.imageUrl ?? null, unlocked: true, duplicate: false });
        }
        if (plan.cosmetic) prizes.push({ kind: "COSMETIC", name: raresAndEpics[Math.floor(Math.random() * raresAndEpics.length)]?.name ?? "Item visual raro" });
        return prizes;
      });
      return [
        tier,
        {
          possible,
          spec: CHEST_SPECS[tier],
          avgCoins: coins / runs,
          avgHelpers: helpers / runs,
          avgStickers: stickers / runs,
          chanceSticker: withSticker / runs,
          chanceTwoStickers: withTwo / runs,
          chanceCosmetic: cosmetic / runs,
          rarityPerChest: Object.fromEntries(RARITIES.map((item) => [item, rarity[item] / runs])),
          helpers: Object.fromEntries(Object.entries(helperCount).map(([name, count]) => [name, count / runs])),
          samples,
        },
      ];
    }),
  );

  return {
    runs,
    publishedByRarity: Object.fromEntries(RARITIES.map((item) => [item, characters.filter((character) => character.rarity === item).length])),
    thresholds: {
      bronze: settings.rewardMinCorrectAnswers,
      silver: settings.chestSilverMinCorrect,
      gold: settings.chestGoldMinCorrect,
      diamond: settings.chestDiamondMinCorrect,
      dailyLimit: settings.rewardMatchLimitPerDay,
      diamondPerDay: settings.chestDiamondLimitPerDay,
      newStickerPercent: settings.chestNewStickerPercent,
      pityThreshold: settings.pityThreshold,
      startingLives: settings.startingLives,
    },
    tiers,
  };
}
