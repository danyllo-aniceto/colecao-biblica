import type { BiblicalCharacter, Question, RewardDefinition, ShopItem, User } from "@prisma/client";

/** Formato das respostas JSON (mesmos campos da API original, que o frontend já usa). */

export function toUserResponse(user: User) {
  return {
    id: user.id,
    xp: user.xp,
    level: user.level,
    coins: user.coins,
    totalScore: user.totalScore,
    extraLifeBoosts: user.extraLifeBoosts,
    extraTimeBoosts: user.extraTimeBoosts,
    doubleXpBoosts: user.doubleXpBoosts,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    createdBy: user.createdBy,
    updatedBy: user.updatedBy,
    deleted: user.deleted,
    deletedAt: user.deletedAt,
    deletedBy: user.deletedBy,
  };
}

export function toCharacterResponse(character: BiblicalCharacter) {
  return {
    id: character.id,
    name: character.name,
    imageUrl: character.imageUrl,
    rarity: character.rarity,
    shortSummary: character.shortSummary,
    fullDescription: character.fullDescription,
    bibleBooks: character.bibleBooks,
    bibleReferences: character.bibleReferences,
    historicalPeriod: character.historicalPeriod,
    narrativeRole: character.narrativeRole,
    genealogy: character.genealogy,
    curiosities: character.curiosities,
    importantEvents: character.importantEvents,
    keyVerses: character.keyVerses,
    keywords: character.keywords,
    createdAt: character.createdAt,
    createdBy: character.createdBy,
    updatedAt: character.updatedAt,
  };
}

export type QuestionWithCharacter = Question & { relatedCharacter: Pick<BiblicalCharacter, "id" | "name"> | null };

export function toQuestionResponse(question: QuestionWithCharacter) {
  return {
    id: question.id,
    text: question.text,
    difficulty: question.difficulty,
    timeLimitSeconds: question.timeLimitSeconds,
    optionA: question.optionA,
    optionB: question.optionB,
    optionC: question.optionC,
    optionD: question.optionD,
    correctOption: question.correctOption,
    relatedCharacterId: question.relatedCharacter?.id ?? null,
    relatedCharacterName: question.relatedCharacter?.name ?? null,
    active: question.active,
  };
}

export type RewardWithCharacter = RewardDefinition & { stickerCharacter: Pick<BiblicalCharacter, "id" | "name"> | null };

export function toRewardResponse(reward: RewardWithCharacter) {
  return {
    id: reward.id,
    name: reward.name,
    rewardType: reward.rewardType,
    stickerRarity: reward.stickerRarity,
    stickerCharacterId: reward.stickerCharacter?.id ?? null,
    stickerCharacterName: reward.stickerCharacter?.name ?? null,
    coinAmount: reward.coinAmount,
    extraLives: reward.extraLives,
    extraTimeSeconds: reward.extraTimeSeconds,
    xpMultiplier: reward.xpMultiplier,
    dropChance: reward.dropChance,
    active: reward.active,
  };
}

export type ShopItemWithReward = ShopItem & { rewardDefinition: Pick<RewardDefinition, "id" | "name"> | null };

export function toShopItemResponse(item: ShopItemWithReward) {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    itemType: item.itemType,
    priceCoins: item.priceCoins,
    rewardDefinitionId: item.rewardDefinition?.id ?? null,
    rewardName: item.rewardDefinition?.name ?? null,
    active: item.active,
  };
}

export const characterRef = { select: { id: true, name: true } } as const;
export const rewardRef = { select: { id: true, name: true } } as const;
