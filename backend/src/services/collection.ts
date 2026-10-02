import type { StickerRarity } from "@prisma/client";
import { lockUser, transaction } from "../db/prisma";
import { badRequest, notFound } from "../lib/errors";
import { checkAchievements } from "./achievements";
import { duplicateStickerCoins, isCampaignOnlyRarity } from "./game-rules";
import { grantStickerOrDuplicate } from "./rewards";
import { getSettings } from "./settings";
import { visibleCharacter } from "./visibility";

/** Raridade de cima na fusão (lendária não sobe). */
export const NEXT_RARITY: Partial<Record<StickerRarity, StickerRarity>> = { COMMON: "RARE", RARE: "EPIC", EPIC: "LEGENDARY" };

/** Vende repetidas de uma figurinha pelo valor configurado da raridade. */
export async function sellDuplicates(userId: number, characterId: number, quantity: number) {
  return transaction(async (tx) => {
    await lockUser(tx, userId);
    const sticker = await tx.userSticker.findUnique({ where: { userId_characterId: { userId, characterId } }, include: { character: true } });
    if (!sticker || sticker.duplicates <= 0) {
      throw notFound("Você não tem repetidas desta figurinha");
    }
    if (isCampaignOnlyRarity(sticker.character.rarity)) {
      throw badRequest("A figurinha especial não pode ser vendida");
    }
    const amount = Math.min(Math.max(1, quantity), sticker.duplicates);
    const settings = await getSettings(tx);
    const coins = duplicateStickerCoins(sticker.character.rarity, settings) * amount;
    await tx.userSticker.update({ where: { id: sticker.id }, data: { duplicates: { decrement: amount } } });
    const saved = await tx.user.update({ where: { id: userId }, data: { coins: { increment: coins } } });
    return { sold: amount, coins, userCoins: saved.coins };
  });
}

/**
 * Fusão: gasta N repetidas de uma raridade (das figurinhas com mais cópias
 * primeiro) e entrega uma figurinha da raridade acima, de preferência nova.
 */
export async function fuseDuplicates(userId: number, rarity: StickerRarity, random: () => number = Math.random) {
  const target = NEXT_RARITY[rarity];
  if (!target) {
    throw badRequest("Figurinhas lendárias não podem ser fundidas");
  }
  return transaction(async (tx) => {
    await lockUser(tx, userId);
    const settings = await getSettings(tx);
    const stickers = await tx.userSticker.findMany({
      where: { userId, duplicates: { gt: 0 }, character: { rarity } },
      orderBy: [{ duplicates: "desc" }, { id: "asc" }],
    });
    const available = stickers.reduce((sum, sticker) => sum + sticker.duplicates, 0);
    if (available < settings.fuseCost) {
      throw badRequest(`Você precisa de ${settings.fuseCost} repetidas desta raridade (tem ${available})`);
    }

    const candidates = await tx.biblicalCharacter.findMany({ where: { rarity: target, ...visibleCharacter() }, orderBy: { id: "asc" } });
    if (candidates.length === 0) {
      throw badRequest("Ainda não há figurinhas da raridade de cima para receber");
    }

    let remaining = settings.fuseCost;
    for (const sticker of stickers) {
      if (remaining === 0) break;
      const take = Math.min(sticker.duplicates, remaining);
      await tx.userSticker.update({ where: { id: sticker.id }, data: { duplicates: { decrement: take } } });
      remaining -= take;
    }

    const owned = new Set((await tx.userSticker.findMany({ where: { userId }, select: { characterId: true } })).map((row) => row.characterId));
    const missing = candidates.filter((character) => !owned.has(character.id));
    const pool = missing.length > 0 ? missing : candidates;
    const character = pool[Math.floor(random() * pool.length)];
    const unlocked = await grantStickerOrDuplicate(tx, userId, character.id);
    const unlockedAchievements = await checkAchievements(tx, userId);
    const saved = await tx.user.findUniqueOrThrow({ where: { id: userId } });

    return {
      spent: settings.fuseCost,
      characterId: character.id,
      characterName: character.name,
      characterRarity: character.rarity,
      characterImageUrl: character.imageUrl,
      characterUnlocked: unlocked,
      duplicate: !unlocked,
      unlockedAchievements,
      userCoins: saved.coins,
    };
  });
}
