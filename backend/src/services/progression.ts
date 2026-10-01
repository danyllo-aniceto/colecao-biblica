import type { Cosmetic, User } from "@prisma/client";
import { lockUser, prisma, transaction } from "../db/prisma";
import { badRequest, notFound } from "../lib/errors";
import { env } from "../lib/env";
import { checkAchievements } from "./achievements";
import { grantCosmetic, toCosmeticResponse } from "./cosmetics";
import { activeEvent } from "./events";
import { chestCoins, monthKeyInTimeZone, monthRangeInTimeZone } from "./game-rules";
import { HELPERS } from "./helpers";
import { toUserResponse } from "./mappers";
import { applyReward, walletData } from "./rewards";
import { getSettings, type GameSettings } from "./settings";
import { visibleCharacter } from "./visibility";

/** Moedas no lugar de uma ajuda quando o jogador já tem o máximo de todas. */
const CHEST_FULL_BOOSTS_COINS = 25;

/** Todas as ajudas que o baú pode trazer (as antigas e as novas). */
const CHEST_BOOSTS = [
  { field: "extraLifeBoosts", maxSetting: "maxExtraLifeBoosts", name: "Vida extra" },
  { field: "extraTimeBoosts", maxSetting: "maxExtraTimeBoosts", name: "Tempo extra" },
  { field: "doubleXpBoosts", maxSetting: "maxDoubleXpBoosts", name: "XP em dobro" },
  { field: "hintBoosts", maxSetting: "maxHintBoosts", name: "Dica 50/50" },
  ...HELPERS,
] as const satisfies ReadonlyArray<{ field: keyof User; maxSetting: keyof GameSettings; name: string }>;

// ---------------------------------------------------------------------------
// Baú de nível
// ---------------------------------------------------------------------------

/**
 * Abre o próximo baú pendente (um por nível alcançado): moedas que crescem
 * com o nível, uma ajuda sorteada e, às vezes, um item visual do baú.
 */
export async function openChest(userId: number, random: () => number = Math.random) {
  return transaction(async (tx) => {
    await lockUser(tx, userId);
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.level <= user.chestLevel) throw badRequest("Nenhum baú para abrir. Suba de nível para ganhar o próximo!");
    const settings = await getSettings(tx);
    const level = user.chestLevel + 1;

    let coins = chestCoins(level, settings);
    const room = CHEST_BOOSTS.filter((boost) => user[boost.field] < settings[boost.maxSetting]);
    const boost = room.length > 0 ? room[Math.floor(random() * room.length)] : null;
    if (!boost) coins += CHEST_FULL_BOOSTS_COINS;

    let cosmetic: Cosmetic | null = null;
    if (random() * 100 < settings.chestCosmeticChance) {
      const pool = await tx.cosmetic.findMany({ where: { active: true, inChestPool: true, owners: { none: { userId } } } });
      cosmetic = pool.length > 0 ? pool[Math.floor(random() * pool.length)] : null;
      if (cosmetic) await grantCosmetic(tx, userId, cosmetic.id, "CHEST");
    }

    const saved = await tx.user.update({
      where: { id: userId },
      data: { chestLevel: level, coins: user.coins + coins, ...(boost ? { [boost.field]: user[boost.field] + 1 } : {}) },
    });
    return {
      level,
      coins,
      boost: boost ? { field: boost.field, name: boost.name } : null,
      cosmetic: cosmetic ? toCosmeticResponse(cosmetic) : null,
      chestsPending: Math.max(0, saved.level - saved.chestLevel),
      user: toUserResponse(saved),
    };
  });
}

// ---------------------------------------------------------------------------
// Coleções temáticas
// ---------------------------------------------------------------------------

const ONCE = "once";

export async function listCollections(userId: number) {
  const [collections, owned, claims] = await Promise.all([
    prisma.characterCollection.findMany({
      where: { active: true },
      include: {
        characters: { where: visibleCharacter(), select: { id: true, name: true, rarity: true, imageUrl: true }, orderBy: { name: "asc" } },
        rewardCosmetic: true,
      },
      orderBy: { id: "asc" },
    }),
    prisma.userSticker.findMany({ where: { userId }, select: { characterId: true } }).then((rows) => new Set(rows.map((row) => row.characterId))),
    prisma.userClaim.findMany({ where: { userId, kind: "COLLECTION" }, select: { code: true } }).then((rows) => new Set(rows.map((row) => row.code))),
  ]);
  return collections
    .filter((collection) => collection.characters.length > 0)
    .map((collection) => {
      const characters = collection.characters.map((character) => ({ ...character, owned: owned.has(character.id) }));
      const ownedCount = characters.filter((character) => character.owned).length;
      return {
        id: collection.id,
        name: collection.name,
        description: collection.description,
        rewardCoins: collection.rewardCoins,
        rewardCosmetic: collection.rewardCosmetic ? toCosmeticResponse(collection.rewardCosmetic) : null,
        // Figurinhas que faltam aparecem só com raridade (sem revelar nome nem imagem).
        characters: characters.map((character) =>
          character.owned ? character : { id: character.id, name: null, rarity: character.rarity, imageUrl: null, owned: false },
        ),
        owned: ownedCount,
        total: characters.length,
        complete: ownedCount === characters.length,
        claimed: claims.has(String(collection.id)),
      };
    });
}

export async function claimCollection(userId: number, collectionId: number) {
  return transaction(async (tx) => {
    const collection = await tx.characterCollection.findFirst({
      where: { id: collectionId, active: true },
      include: { characters: { where: visibleCharacter(), select: { id: true } } },
    });
    if (!collection || collection.characters.length === 0) throw notFound("Coleção não encontrada");
    await lockUser(tx, userId);
    const owned = await tx.userSticker.count({ where: { userId, characterId: { in: collection.characters.map((character) => character.id) } } });
    if (owned < collection.characters.length) throw badRequest("Complete a coleção para resgatar o prêmio");
    const created = await tx.userClaim.createMany({ data: [{ userId, kind: "COLLECTION", code: String(collection.id), periodKey: ONCE }], skipDuplicates: true });
    if (created.count === 0) throw badRequest("Prêmio desta coleção já resgatado");
    const saved = await tx.user.update({ where: { id: userId }, data: { coins: { increment: collection.rewardCoins } } });
    const cosmeticGranted = collection.rewardCosmeticId ? await grantCosmetic(tx, userId, collection.rewardCosmeticId, "COLLECTION") : false;
    return { coins: collection.rewardCoins, cosmeticGranted, userCoins: saved.coins };
  });
}

// ---------------------------------------------------------------------------
// Passe da temporada (mensal)
// ---------------------------------------------------------------------------

async function monthXp(userId: number, monthKey: string) {
  const { start, end } = monthRangeInTimeZone(monthKey, env.timezone);
  const sum = await prisma.quizMatch.aggregate({ where: { userId, finishedAt: { gte: start, lt: end } }, _sum: { xpGained: true } });
  return sum._sum.xpGained ?? 0;
}

const tierInclude = { rewardDefinition: { select: { id: true, name: true, rewardType: true } }, rewardCosmetic: true } as const;

export async function getPass(userId: number) {
  const monthKey = monthKeyInTimeZone(new Date(), env.timezone);
  const [tiers, xp, claims] = await Promise.all([
    prisma.passTier.findMany({ where: { active: true }, include: tierInclude, orderBy: { level: "asc" } }),
    monthXp(userId, monthKey),
    prisma.userClaim.findMany({ where: { userId, kind: "PASS", periodKey: monthKey }, select: { code: true } }).then((rows) => new Set(rows.map((row) => row.code))),
  ]);
  return {
    monthKey,
    endsAt: monthRangeInTimeZone(monthKey, env.timezone).end,
    xp,
    tiers: tiers.map((tier) => ({
      id: tier.id,
      level: tier.level,
      requiredXp: tier.requiredXp,
      rewardCoins: tier.rewardCoins,
      reward: tier.rewardDefinition,
      cosmetic: tier.rewardCosmetic ? toCosmeticResponse(tier.rewardCosmetic) : null,
      reached: xp >= tier.requiredXp,
      claimed: claims.has(String(tier.id)),
    })),
  };
}

export async function claimPassTier(userId: number, tierId: number) {
  const monthKey = monthKeyInTimeZone(new Date(), env.timezone);
  const xp = await monthXp(userId, monthKey);
  return transaction(async (tx) => {
    const tier = await tx.passTier.findFirst({ where: { id: tierId, active: true }, include: { rewardDefinition: true } });
    if (!tier) throw notFound("Degrau do passe não encontrado");
    if (xp < tier.requiredXp) throw badRequest(`Faltam ${tier.requiredXp - xp} XP neste mês para este prêmio`);
    await lockUser(tx, userId);
    const created = await tx.userClaim.createMany({ data: [{ userId, kind: "PASS", code: String(tier.id), periodKey: monthKey }], skipDuplicates: true });
    if (created.count === 0) throw badRequest("Prêmio já resgatado neste mês");
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const settings = await getSettings(tx);
    const wallet = { ...user, coins: user.coins + tier.rewardCoins };
    const applied = tier.rewardDefinition ? await applyReward(tx, wallet, tier.rewardDefinition, settings) : null;
    await tx.user.update({ where: { id: userId }, data: walletData(wallet) });
    const cosmeticGranted = tier.rewardCosmeticId ? await grantCosmetic(tx, userId, tier.rewardCosmeticId, "PASS") : false;
    const unlockedAchievements = await checkAchievements(tx, userId);
    const saved = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    return { coins: tier.rewardCoins, reward: applied, cosmeticGranted, unlockedAchievements, user: toUserResponse(saved) };
  });
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

export async function getActiveEvent() {
  const event = await activeEvent(prisma);
  if (!event) return null;
  const items = await prisma.cosmetic.count({ where: { eventId: event.id, active: true, unlock: "SHOP" } });
  return { ...event, items };
}
