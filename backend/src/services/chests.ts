import type { Prisma, StickerRarity } from "@prisma/client";
import type { Db } from "../db/prisma";
import { EMERALD_SET_NAMES } from "./default-cosmetics";
import { CHEST_SPECS, chestStickerWeight, pityActive, planChest, type ChestTier } from "./game-rules";
import { grantCosmetic } from "./cosmetics";
import type { HelperField } from "./helpers";
import { CHEST_BOOSTS } from "./progression";
import { applyReward, availableRewards, type UserWallet } from "./rewards";
import type { GameSettings } from "./settings";

/** O que o baú trouxe, na ordem em que aparece na animação (as figurinhas por último). */
export type ChestPrizeView =
  | { kind: "COINS"; amount: number }
  | { kind: "HELPER"; name: string; amount: number }
  | { kind: "STICKER"; characterId: number | null; name: string | null; rarity: string | null; imageUrl: string | null; unlocked: boolean; duplicate: boolean }
  | { kind: "COSMETIC"; name: string; rarity: string };

/** Baú de Esmeralda: não é da partida, vem da campanha ao conquistar a figurinha especial. */
export type SpecialChestTier = ChestTier | "EMERALD";

export type ChestOpening = {
  tier: ChestTier;
  coins: number;
  prizes: ChestPrizeView[];
  gotSticker: boolean;
  /** Garantia contra azar usada neste baú. */
  pityUsed: boolean;
};

export const RARITY_RANK: Record<string, number> = { COMMON: 0, RARE: 1, EPIC: 2, LEGENDARY: 3, SPECIAL: 4 };

type Tx = Db | Prisma.TransactionClient;

/**
 * Abre um baú de verdade: sorteia o conteúdo (`planChest`) e entrega ao jogador. Altera `wallet` em memória
 * (moedas e ajudas; o chamador salva o usuário) e grava figurinhas e itens visuais. Serve para o baú da partida
 * e para os baús vendidos na loja. `stickerPity`: baús seguidos sem figurinha (garantia contra azar); omita na loja.
 */
export async function openChestRewards(
  tx: Tx,
  wallet: UserWallet,
  requested: ChestTier,
  settings: GameSettings,
  random: () => number,
  options: { stickerPity?: number } = {},
): Promise<ChestOpening> {
  let tier = requested;
  const rewards = await availableRewards(tx as Db, await tx.rewardDefinition.findMany({ where: { active: true }, orderBy: { id: "asc" } }));
  const stickerRewards = rewards.filter((reward) => reward.rewardType === "STICKER" || reward.rewardType === "STICKER_PACK");
  // Sem figurinha épica/lendária publicada, o diamante vira ouro.
  if (tier === "DIAMOND" && !stickerRewards.some((reward) => chestStickerWeight("DIAMOND", reward) > 0)) tier = "GOLD";

  // Itens visuais que o jogador ainda não tem, agrupados por raridade (só se o baú pode trazer item).
  const cosmeticOptions = CHEST_SPECS[tier].cosmetic.chance > 0 ? await tx.cosmetic.findMany({ where: { active: true, inChestPool: true, owners: { none: { userId: wallet.id } } } }) : [];
  const cosmeticRarities = [...new Set(cosmeticOptions.map((cosmetic) => cosmetic.rarity))] as StickerRarity[];

  const pityUsed = options.stickerPity !== undefined && pityActive(options.stickerPity, settings.pityThreshold) && stickerRewards.length > 0;
  const plan = planChest(
    tier,
    {
      stickerRewards,
      helperPool: CHEST_BOOSTS.filter((helper) => wallet[helper.field] < settings[helper.maxSetting]).map((helper) => ({ field: helper.field, name: helper.name })),
      forceSticker: pityUsed,
      cosmeticRarities,
    },
    random,
  );

  const prizes: ChestPrizeView[] = [{ kind: "COINS", amount: plan.coins }];
  wallet.coins += plan.coins;
  for (const helper of plan.helpers) {
    wallet[helper.field as HelperField] += 1;
    prizes.push({ kind: "HELPER", name: helper.name, amount: 1 });
  }
  for (const picked of plan.stickers) {
    const reward = stickerRewards.find((item) => item.id === picked.rewardId);
    if (!reward) continue;
    const applied = await applyReward(tx as Db, wallet, reward, settings, random, { newStickerPercent: settings.chestNewStickerPercent });
    prizes.push({ kind: "STICKER", characterId: applied.characterId, name: applied.characterName, rarity: applied.characterRarity, imageUrl: applied.characterImageUrl, unlocked: applied.characterUnlocked, duplicate: applied.duplicate });
  }
  if (plan.cosmeticRarity) {
    const matching = cosmeticOptions.filter((cosmetic) => cosmetic.rarity === plan.cosmeticRarity);
    const cosmetic = matching.length > 0 ? matching[Math.floor(random() * matching.length)] : null;
    if (cosmetic && (await grantCosmetic(tx as Db, wallet.id, cosmetic.id, "CHEST"))) prizes.push({ kind: "COSMETIC", name: cosmetic.name, rarity: cosmetic.rarity });
  }
  return { tier, coins: plan.coins, prizes, gotSticker: plan.stickers.length > 0, pityUsed };
}

/** O que o Baú de Esmeralda traz (fixo, é o prêmio da figurinha especial): moedas, ajudas, 2 figurinhas, o conjunto exclusivo e a carta. */
export const EMERALD_CHEST = { coins: 1000, helpers: 4 } as const;

/**
 * Abre o Baú de Esmeralda ao conquistar a figurinha especial: 1.000 moedas, 4 ajudas, uma figurinha épica e uma lendária,
 * o conjunto de itens visuais exclusivo (os que o jogador ainda não tem) e, por último, a própria figurinha especial.
 * Altera `wallet` em memória (o chamador salva o usuário).
 */
export async function openEmeraldChest(
  tx: Tx,
  wallet: UserWallet,
  settings: GameSettings,
  random: () => number,
  special: { id: number; name: string; imageUrl: string | null },
): Promise<{ tier: "EMERALD"; prizes: ChestPrizeView[] }> {
  const prizes: ChestPrizeView[] = [{ kind: "COINS", amount: EMERALD_CHEST.coins }];
  wallet.coins += EMERALD_CHEST.coins;

  const pool = CHEST_BOOSTS.filter((helper) => wallet[helper.field] < settings[helper.maxSetting]);
  for (let index = 0; index < EMERALD_CHEST.helpers && pool.length > 0; index += 1) {
    const helper = pool.splice(Math.floor(random() * pool.length), 1)[0];
    wallet[helper.field as HelperField] += 1;
    prizes.push({ kind: "HELPER", name: helper.name, amount: 1 });
  }

  const cosmetics = await tx.cosmetic.findMany({ where: { name: { in: [...EMERALD_SET_NAMES] }, active: true, owners: { none: { userId: wallet.id } } }, orderBy: { id: "asc" } });
  for (const cosmetic of cosmetics) {
    if (await grantCosmetic(tx as Db, wallet.id, cosmetic.id, "CAMPAIGN")) prizes.push({ kind: "COSMETIC", name: cosmetic.name, rarity: cosmetic.rarity });
  }

  const rewards = await availableRewards(tx as Db, await tx.rewardDefinition.findMany({ where: { active: true, rewardType: "STICKER", stickerRarity: { in: ["EPIC", "LEGENDARY"] }, stickerCharacterId: null }, orderBy: { id: "asc" } }));
  for (const rarity of ["EPIC", "LEGENDARY"] as const) {
    const reward = rewards.find((item) => item.stickerRarity === rarity);
    if (!reward) continue;
    const applied = await applyReward(tx as Db, wallet, reward, settings, random, { newStickerPercent: 100 });
    prizes.push({ kind: "STICKER", characterId: applied.characterId, name: applied.characterName, rarity: applied.characterRarity, imageUrl: applied.characterImageUrl, unlocked: applied.characterUnlocked, duplicate: applied.duplicate });
  }

  // A figurinha especial por último: é o grande momento.
  prizes.push({ kind: "STICKER", characterId: special.id, name: special.name, rarity: "SPECIAL", imageUrl: special.imageUrl, unlocked: true, duplicate: false });
  return { tier: "EMERALD", prizes };
}
