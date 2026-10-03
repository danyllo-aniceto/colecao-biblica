import type { BiblicalCharacter, Prisma, RewardDefinition, RewardType, ShopItemType, StickerRarity, User } from "@prisma/client";
import type { Db } from "../db/prisma";
import { badRequest } from "../lib/errors";
import { isCampaignOnlyRarity, pickPackRarity } from "./game-rules";
import { HELPERS, helperByReward, type HelperField } from "./helpers";
import type { GameSettings } from "./settings";
import { visibleCharacter } from "./visibility";

export type RewardApplication = {
  rewardType: RewardType;
  rewardName: string;
  characterId: number | null;
  characterName: string | null;
  characterRarity: StickerRarity | null;
  characterImageUrl: string | null;
  characterUnlocked: boolean;
  /** A figurinha já era do jogador: a cópia foi guardada como repetida (para vender ou fundir). */
  duplicate: boolean;
  /** Item visual concedido (recompensa do tipo COSMETIC). */
  cosmeticId: number | null;
  cosmeticName: string | null;
  cosmeticType: string | null;
  /** O item visual já era do jogador: virou moedas. */
  cosmeticConvertedCoins: number;
};

/** Moedas dadas no lugar de um item visual que o jogador já tem. */
export const DUPLICATE_COSMETIC_COINS = 50;

/** Campos do usuário que as recompensas alteram. */
export type UserWallet = Pick<User, "id" | "coins" | "extraLifeBoosts" | "extraTimeBoosts" | "doubleXpBoosts" | "hintBoosts" | "streakFreezes" | HelperField>;

/** Só figurinhas visíveis entram no jogo (rascunhos e agendadas ficam no painel). */
const visible = () => visibleCharacter();

async function ownedCharacterIds(db: Db, userId: number): Promise<Set<number>> {
  const stickers = await db.userSticker.findMany({ where: { userId }, select: { characterId: true } });
  return new Set(stickers.map((sticker) => sticker.characterId));
}

/** Concede a figurinha se o usuário ainda não a tiver. Retorna true se ela foi desbloqueada agora. */
export async function grantStickerIfMissing(db: Db, userId: number, characterId: number): Promise<boolean> {
  const result = await db.userSticker.createMany({ data: [{ userId, characterId }], skipDuplicates: true });
  return result.count > 0;
}

/** Concede a figurinha; se já existir, guarda mais uma cópia repetida. Retorna true se é nova. */
export async function grantStickerOrDuplicate(db: Db, userId: number, characterId: number): Promise<boolean> {
  if (await grantStickerIfMissing(db, userId, characterId)) {
    return true;
  }
  // A carta especial é única: não acumula repetidas (não dá para trocar, vender nem fundir).
  const character = await db.biblicalCharacter.findUnique({ where: { id: characterId }, select: { rarity: true } });
  if (character && isCampaignOnlyRarity(character.rarity)) {
    return false;
  }
  await db.userSticker.update({ where: { userId_characterId: { userId, characterId } }, data: { duplicates: { increment: 1 } } });
  return false;
}

async function randomCharacterOfRarity(db: Db, userId: number, rarity: StickerRarity, random: () => number, newPercent = 100): Promise<BiblicalCharacter | null> {
  const byRarity = await db.biblicalCharacter.findMany({ where: { rarity, ...visible() }, orderBy: { id: "asc" } });
  if (byRarity.length === 0) {
    return null;
  }
  // Prefere figurinhas que o usuário ainda não tem.
  const owned = await ownedCharacterIds(db, userId);
  const missing = byRarity.filter((character) => !owned.has(character.id));
  // `newPercent` < 100: nos baús, às vezes a figurinha vem repetida mesmo faltando outras (as repetidas têm uso).
  const preferMissing = missing.length > 0 && (newPercent >= 100 || random() * 100 < newPercent);
  const pool = preferMissing ? missing : byRarity;
  return pool[Math.floor(random() * pool.length)];
}

async function publishedRarities(db: Db): Promise<Set<StickerRarity>> {
  const byRarity = await db.biblicalCharacter.groupBy({ by: ["rarity"], where: visible(), _count: { _all: true } });
  return new Set(byRarity.filter((group) => group._count._all > 0).map((group) => group.rarity));
}

async function pickStickerCharacter(
  db: Db,
  userId: number,
  reward: RewardDefinition,
  settings: GameSettings,
  random: () => number,
  newPercent = 100,
): Promise<BiblicalCharacter> {
  if (reward.rewardType === "STICKER_PACK") {
    const rarity = pickPackRarity(settings, await publishedRarities(db), random);
    const character = rarity ? await randomCharacterOfRarity(db, userId, rarity, random, newPercent) : null;
    if (character) {
      return character;
    }
    throw badRequest("Ainda não há figurinhas para o pacote surpresa");
  }

  if (reward.stickerCharacterId) {
    const character = await db.biblicalCharacter.findFirst({ where: { id: reward.stickerCharacterId, rarity: { not: "SPECIAL" }, ...visible() } });
    if (character) {
      return character;
    }
  }

  if (reward.stickerRarity) {
    const character = await randomCharacterOfRarity(db, userId, reward.stickerRarity, random, newPercent);
    if (character) {
      return character;
    }
  }

  throw badRequest("Recompensa de figurinha precisa de raridade ou personagem vinculado");
}

/**
 * Aplica a recompensa: altera `wallet` em memória (o chamador salva o usuário)
 * e grava a figurinha, quando houver.
 */
export async function applyReward(
  db: Db,
  wallet: UserWallet,
  reward: RewardDefinition,
  settings: GameSettings,
  random: () => number = Math.random,
  options: { newStickerPercent?: number } = {},
): Promise<RewardApplication> {
  const base: RewardApplication = {
    rewardType: reward.rewardType,
    rewardName: reward.name,
    characterId: null,
    characterName: null,
    characterRarity: null,
    characterImageUrl: null,
    characterUnlocked: false,
    duplicate: false,
    cosmeticId: null,
    cosmeticName: null,
    cosmeticType: null,
    cosmeticConvertedCoins: 0,
  };

  const helper = helperByReward(reward.rewardType);
  if (helper) {
    wallet[helper.field] = Math.min(wallet[helper.field] + Math.max(reward.boostAmount ?? 1, 1), settings[helper.maxSetting]);
    return base;
  }

  switch (reward.rewardType) {
    case "COSMETIC": {
      const cosmetic = reward.cosmeticId ? await db.cosmetic.findUnique({ where: { id: reward.cosmeticId } }) : null;
      if (!cosmetic) throw badRequest("Recompensa de item visual sem item vinculado");
      const created = await db.userCosmetic.createMany({ data: [{ userId: wallet.id, cosmeticId: cosmetic.id, source: "REWARD" }], skipDuplicates: true });
      const converted = created.count === 0 ? DUPLICATE_COSMETIC_COINS : 0;
      wallet.coins += converted;
      return { ...base, cosmeticId: cosmetic.id, cosmeticName: cosmetic.name, cosmeticType: cosmetic.type, cosmeticConvertedCoins: converted };
    }
    case "COINS":
      wallet.coins += reward.coinAmount ?? 0;
      return base;
    case "EXTRA_LIFE":
      wallet.extraLifeBoosts = Math.min(wallet.extraLifeBoosts + Math.max(reward.extraLives ?? 0, 1), settings.maxExtraLifeBoosts);
      return base;
    case "EXTRA_TIME":
      wallet.extraTimeBoosts = Math.min(wallet.extraTimeBoosts + Math.max(reward.extraTimeSeconds ?? 0, 1), settings.maxExtraTimeBoosts);
      return base;
    case "XP_MULTIPLIER":
      wallet.doubleXpBoosts = Math.min(wallet.doubleXpBoosts + 1, settings.maxDoubleXpBoosts);
      return base;
    case "FIFTY_FIFTY":
      wallet.hintBoosts = Math.min(wallet.hintBoosts + Math.max(reward.hintAmount ?? 0, 1), settings.maxHintBoosts);
      return base;
    case "STREAK_FREEZE":
      wallet.streakFreezes = Math.min(wallet.streakFreezes + 1, settings.maxStreakFreezes);
      return base;
    case "STICKER":
    case "STICKER_PACK": {
      const character = await pickStickerCharacter(db, wallet.id, reward, settings, random, options.newStickerPercent);
      const unlocked = await grantStickerOrDuplicate(db, wallet.id, character.id);
      return {
        ...base,
        characterId: character.id,
        characterName: character.name,
        characterRarity: character.rarity,
        characterImageUrl: character.imageUrl,
        characterUnlocked: unlocked,
        duplicate: !unlocked,
      };
    }
    default:
      throw badRequest("Tipo de recompensa desconhecido");
  }
}

export function walletData(wallet: UserWallet): Prisma.UserUpdateInput {
  return {
    coins: wallet.coins,
    extraLifeBoosts: wallet.extraLifeBoosts,
    extraTimeBoosts: wallet.extraTimeBoosts,
    doubleXpBoosts: wallet.doubleXpBoosts,
    hintBoosts: wallet.hintBoosts,
    streakFreezes: wallet.streakFreezes,
    ...Object.fromEntries(HELPERS.map((helper) => [helper.field, wallet[helper.field]])),
  };
}

/**
 * Recompensas que podem sair no sorteio agora: figurinha de uma raridade sem
 * nenhum personagem publicado fica de fora (senão a partida terminaria em erro).
 */
export async function availableRewards(db: Db, rewards: RewardDefinition[]): Promise<RewardDefinition[]> {
  const rarities = await publishedRarities(db);
  return rewards.filter((reward) => {
    if (reward.rewardType === "STICKER_PACK") return rarities.size > 0;
    if (reward.rewardType !== "STICKER") return true;
    if (reward.stickerCharacterId) return true;
    return reward.stickerRarity !== null && rarities.has(reward.stickerRarity);
  });
}

/** Garante que a compra terá efeito, para não cobrar moedas por nada. */
export async function ensureRewardIsUseful(db: Db, wallet: UserWallet, reward: RewardDefinition, settings: GameSettings) {
  const helper = helperByReward(reward.rewardType);
  if (helper) {
    if (wallet[helper.field] >= settings[helper.maxSetting]) throw badRequest(`Você já tem o máximo de "${helper.name}"`);
    return;
  }
  switch (reward.rewardType) {
    case "COSMETIC":
      if (reward.cosmeticId && (await db.userCosmetic.findUnique({ where: { userId_cosmeticId: { userId: wallet.id, cosmeticId: reward.cosmeticId } } }))) {
        throw badRequest("Você já tem este item");
      }
      return;
    case "EXTRA_LIFE":
      if (wallet.extraLifeBoosts >= settings.maxExtraLifeBoosts) throw badRequest("Você já atingiu o limite de vidas extras");
      return;
    case "EXTRA_TIME":
      if (wallet.extraTimeBoosts >= settings.maxExtraTimeBoosts) throw badRequest("Você já atingiu o limite de bônus de tempo extra");
      return;
    case "XP_MULTIPLIER":
      if (wallet.doubleXpBoosts >= settings.maxDoubleXpBoosts) throw badRequest("Você já atingiu o limite de bônus de XP em dobro");
      return;
    case "FIFTY_FIFTY":
      if (wallet.hintBoosts >= settings.maxHintBoosts) throw badRequest("Você já atingiu o limite de dicas 50/50");
      return;
    case "STREAK_FREEZE":
      if (wallet.streakFreezes >= settings.maxStreakFreezes) throw badRequest("Você já tem o máximo de protetores de sequência");
      return;
    case "STICKER_PACK":
      if ((await publishedRarities(db)).size === 0) throw badRequest("Ainda não há figurinhas para o pacote surpresa");
      return;
    case "STICKER": {
      if (reward.stickerCharacterId) {
        const owned = await db.userSticker.findUnique({
          where: { userId_characterId: { userId: wallet.id, characterId: reward.stickerCharacterId } },
        });
        if (owned) throw badRequest("Você já possui esta figurinha");
        return;
      }
      if (reward.stickerRarity) {
        const byRarity = await db.biblicalCharacter.findMany({ where: { rarity: reward.stickerRarity, ...visible() }, select: { id: true } });
        if (byRarity.length === 0) throw badRequest("Ainda não há figurinhas desta raridade");
        const owned = await ownedCharacterIds(db, wallet.id);
        if (byRarity.every((character) => owned.has(character.id))) {
          throw badRequest("Você já possui todas as figurinhas desta raridade");
        }
      }
      return;
    }
    default:
      return;
  }
}

/** Loja não vende moedas nem figurinha lendária direta (essa só sai no sorteio ou no pacote). */
export function validateShopReward(reward: Pick<RewardDefinition, "rewardType" | "stickerRarity">) {
  if (reward.rewardType === "COINS") {
    throw badRequest("Itens de loja não podem conceder moedas");
  }
  if (reward.rewardType === "STICKER" && reward.stickerRarity === "LEGENDARY") {
    throw badRequest("Figurinhas lendárias não podem ser compradas na loja");
  }
}

type FixedReward = {
  name: string;
  rewardType: RewardType;
  stickerRarity: StickerRarity | null;
  coinAmount: number;
  extraLives: number;
  extraTimeSeconds: number;
  xpMultiplier: number;
  hintAmount?: number;
  boostAmount?: number;
  dropChance: number;
};

export const FIXED_REWARDS: FixedReward[] = [
  { name: "Figurinha Comum", rewardType: "STICKER", stickerRarity: "COMMON", coinAmount: 0, extraLives: 0, extraTimeSeconds: 0, xpMultiplier: 1, dropChance: 9 },
  { name: "Figurinha Rara", rewardType: "STICKER", stickerRarity: "RARE", coinAmount: 0, extraLives: 0, extraTimeSeconds: 0, xpMultiplier: 1, dropChance: 3.5 },
  { name: "Figurinha Épica", rewardType: "STICKER", stickerRarity: "EPIC", coinAmount: 0, extraLives: 0, extraTimeSeconds: 0, xpMultiplier: 1, dropChance: 1.2 },
  { name: "Figurinha Lendária", rewardType: "STICKER", stickerRarity: "LEGENDARY", coinAmount: 0, extraLives: 0, extraTimeSeconds: 0, xpMultiplier: 1, dropChance: 0.4 },
  { name: "Moedas", rewardType: "COINS", stickerRarity: null, coinAmount: 40, extraLives: 0, extraTimeSeconds: 0, xpMultiplier: 1, dropChance: 30 },
  { name: "XP em dobro", rewardType: "XP_MULTIPLIER", stickerRarity: null, coinAmount: 0, extraLives: 0, extraTimeSeconds: 0, xpMultiplier: 2, dropChance: 6 },
  { name: "Vida extra", rewardType: "EXTRA_LIFE", stickerRarity: null, coinAmount: 0, extraLives: 1, extraTimeSeconds: 0, xpMultiplier: 1, dropChance: 5 },
  { name: "Tempo extra", rewardType: "EXTRA_TIME", stickerRarity: null, coinAmount: 0, extraLives: 0, extraTimeSeconds: 1, xpMultiplier: 1, dropChance: 4 },
  { name: "Dica 50/50", rewardType: "FIFTY_FIFTY", stickerRarity: null, coinAmount: 0, extraLives: 0, extraTimeSeconds: 0, xpMultiplier: 1, hintAmount: 1, dropChance: 5 },
  // Baús vendidos na loja (não entram em sorteio nenhum: dropChance 0).
  { name: "Baú de Bronze", rewardType: "CHEST_BRONZE", stickerRarity: null, coinAmount: 0, extraLives: 0, extraTimeSeconds: 0, xpMultiplier: 1, dropChance: 0 },
  { name: "Baú de Prata", rewardType: "CHEST_SILVER", stickerRarity: null, coinAmount: 0, extraLives: 0, extraTimeSeconds: 0, xpMultiplier: 1, dropChance: 0 },
  { name: "Baú de Ouro", rewardType: "CHEST_GOLD", stickerRarity: null, coinAmount: 0, extraLives: 0, extraTimeSeconds: 0, xpMultiplier: 1, dropChance: 0 },
  { name: "Pacote surpresa", rewardType: "STICKER_PACK", stickerRarity: null, coinAmount: 0, extraLives: 0, extraTimeSeconds: 0, xpMultiplier: 1, dropChance: 1.5 },
  { name: "Protetor de sequência", rewardType: "STREAK_FREEZE", stickerRarity: null, coinAmount: 0, extraLives: 0, extraTimeSeconds: 0, xpMultiplier: 1, dropChance: 3 },
  ...HELPERS.map((helper) => ({
    name: helper.name,
    rewardType: helper.rewardType,
    stickerRarity: null,
    coinAmount: 0,
    extraLives: 0,
    extraTimeSeconds: 0,
    xpMultiplier: 1,
    boostAmount: 1,
    dropChance: 3,
  })),
];

type FixedShopItem = { name: string; description: string; itemType: ShopItemType; priceCoins: number; rewardName: string };

export const FIXED_SHOP_ITEMS: FixedShopItem[] = [
  { name: "Figurinha Comum", description: "Compra uma figurinha comum aleatória", itemType: "STICKER", priceCoins: 450, rewardName: "Figurinha Comum" },
  { name: "Figurinha Rara", description: "Compra uma figurinha rara aleatória", itemType: "STICKER", priceCoins: 1100, rewardName: "Figurinha Rara" },
  { name: "Figurinha Épica", description: "Compra uma figurinha épica aleatória", itemType: "STICKER", priceCoins: 2800, rewardName: "Figurinha Épica" },
  { name: "XP em dobro", description: "Ativa um multiplicador de XP para a próxima partida", itemType: "GAME_BONUS", priceCoins: 300, rewardName: "XP em dobro" },
  { name: "Vida extra", description: "Adiciona uma vida extra consumível", itemType: "GAME_BONUS", priceCoins: 250, rewardName: "Vida extra" },
  { name: "Tempo extra", description: "Adiciona tempo extra consumível", itemType: "GAME_BONUS", priceCoins: 200, rewardName: "Tempo extra" },
  { name: "Dica 50/50", description: "Elimina duas alternativas erradas de uma pergunta", itemType: "GAME_BONUS", priceCoins: 190, rewardName: "Dica 50/50" },
  { name: "Baú de Bronze", description: "Moedas, uma ajuda e, com sorte, uma figurinha. Abre na hora.", itemType: "STICKER", priceCoins: 600, rewardName: "Baú de Bronze" },
  { name: "Baú de Prata", description: "Moedas, duas ajudas, boa chance de figurinha e, às vezes, um item visual.", itemType: "STICKER", priceCoins: 1100, rewardName: "Baú de Prata" },
  { name: "Baú de Ouro", description: "Moedas, ajudas, figurinha garantida (com chance de rara ou épica) e chance de item visual.", itemType: "STICKER", priceCoins: 2000, rewardName: "Baú de Ouro" },
  {
    name: "Pacote surpresa",
    description: "Uma figurinha de raridade sorteada, que pode até ser lendária. Repetida fica guardada para vender ou fundir.",
    itemType: "STICKER",
    priceCoins: 750,
    rewardName: "Pacote surpresa",
  },
  {
    name: "Protetor de sequência",
    description: "Se você esquecer um dia, o prêmio diário não volta para o 1º dia. É usado sozinho.",
    itemType: "GAME_BONUS",
    priceCoins: 350,
    rewardName: "Protetor de sequência",
  },
  { name: "Pular pergunta", description: "Troca a pergunta por outra, sem perder vida.", itemType: "GAME_BONUS", priceCoins: 220, rewardName: "Pular pergunta" },
  {
    name: "Segunda chance",
    description: "Ative antes de responder: se errar, tenta de novo na mesma pergunta sem perder vida.",
    itemType: "GAME_BONUS",
    priceCoins: 270,
    rewardName: "Segunda chance",
  },
  { name: "Voz da multidão", description: "Mostra quantos % dos jogadores escolheram cada alternativa.", itemType: "GAME_BONUS", priceCoins: 200, rewardName: "Voz da multidão" },
  { name: "Pista do versículo", description: "Mostra a referência bíblica que leva à resposta.", itemType: "GAME_BONUS", priceCoins: 180, rewardName: "Pista do versículo" },
  { name: "Ampulheta", description: "Congela o cronômetro da pergunta atual.", itemType: "GAME_BONUS", priceCoins: 230, rewardName: "Ampulheta" },
  { name: "Bênção dobrada", description: "A partida em que você usar rende o dobro de moedas.", itemType: "GAME_BONUS", priceCoins: 330, rewardName: "Bênção dobrada" },
  {
    name: "Escudo de sequência",
    description: "Um erro não zera a sua sequência de acertos (você ainda perde a vida).",
    itemType: "GAME_BONUS",
    priceCoins: 200,
    rewardName: "Escudo de sequência",
  },
];

const sameName = (left: string, right: string) => left.localeCompare(right, "pt-BR", { sensitivity: "accent" }) === 0;

/**
 * Recompensas fixas do sistema: a identidade (tipo/raridade) é sempre
 * reaplicada; valores ajustáveis pelo admin só recebem o padrão na criação.
 */
export async function ensureFixedRewards(db: Db) {
  const existing = await db.rewardDefinition.findMany();
  for (const fixed of FIXED_REWARDS) {
    const current = existing.find((reward) => sameName(reward.name, fixed.name));
    const identity = { rewardType: fixed.rewardType, stickerRarity: fixed.stickerRarity, stickerCharacterId: null, system: true };
    if (current) {
      await db.rewardDefinition.update({ where: { id: current.id }, data: identity });
    } else {
      await db.rewardDefinition.create({
        data: {
          name: fixed.name,
          ...identity,
          coinAmount: fixed.coinAmount,
          extraLives: fixed.extraLives,
          extraTimeSeconds: fixed.extraTimeSeconds,
          xpMultiplier: fixed.xpMultiplier,
          hintAmount: fixed.hintAmount ?? null,
          boostAmount: fixed.boostAmount ?? null,
          dropChance: fixed.dropChance,
          active: true,
        },
      });
    }
  }
}

const OUTDATED_DESCRIPTIONS = ["Uma figurinha de raridade sorteada, que pode até ser lendária. Repetida vira moedas."];

/** Itens fixos da loja. Itens criados pelo admin (system = false) não são alterados. */
export async function ensureFixedShopItems(db: Db) {
  const rewards = await db.rewardDefinition.findMany();
  const items = await db.shopItem.findMany();

  for (const fixed of FIXED_SHOP_ITEMS) {
    const reward = rewards.find((candidate) => sameName(candidate.name, fixed.rewardName)) ?? null;
    if (reward) {
      validateShopReward(reward);
    }
    const current = items.find((item) => sameName(item.name, fixed.name));
    const identity = { itemType: fixed.itemType, rewardDefinitionId: reward?.id ?? null, system: true };
    if (current) {
      // Texto antigo do pacote (antes as repetidas viravam moedas na hora).
      const outdated = OUTDATED_DESCRIPTIONS.includes(current.description) ? { description: fixed.description } : {};
      await db.shopItem.update({ where: { id: current.id }, data: { ...identity, ...outdated } });
    } else {
      await db.shopItem.create({
        data: { name: fixed.name, description: fixed.description, priceCoins: fixed.priceCoins, active: true, ...identity },
      });
    }
  }
}
