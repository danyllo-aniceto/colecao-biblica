import type { BiblicalCharacter, Question, RewardDefinition, ShopItem, User } from "@prisma/client";
import { suggestedDifficulty } from "./game-rules";
import { helperCounts } from "./helpers";

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
    hintBoosts: user.hintBoosts,
    streakFreezes: user.streakFreezes,
    stickerPity: user.stickerPity,
    friendCode: user.friendCode,
    ...helperCounts(user),
    bestCombo: user.bestCombo,
    chestsPending: Math.max(0, user.level - user.chestLevel),
    avatarId: user.avatarId,
    frameId: user.frameId,
    titleId: user.titleId,
    nameColorId: user.nameColorId,
    profileBgId: user.profileBgId,
    albumCoverId: user.albumCoverId,
    badgeId: user.badgeId,
    showcase: user.showcase,
    dailyStreak: user.dailyStreak,
    lastDailyClaim: user.lastDailyClaim,
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
    testament: character.testament,
    published: character.published,
    publishAt: character.publishAt,
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

/** Versão leve para o álbum e listas (sem os textos longos). */
export function toCharacterSummary(character: BiblicalCharacter, questionCount = 0) {
  return {
    id: character.id,
    name: character.name,
    imageUrl: character.imageUrl,
    rarity: character.rarity,
    testament: character.testament,
    published: character.published,
    publishAt: character.publishAt,
    bibleBooks: character.bibleBooks,
    historicalPeriod: character.historicalPeriod,
    narrativeRole: character.narrativeRole,
    questionCount,
    updatedAt: character.updatedAt,
  };
}

export type QuestionWithCharacter = Question & { relatedCharacter: Pick<BiblicalCharacter, "id" | "name"> | null; scenario?: { id: number; name: string } | null };

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
    scenarioId: question.scenarioId,
    scenarioName: question.scenario?.name ?? null,
    explanation: question.explanation,
    bibleReference: question.bibleReference,
    active: question.active,
    timesAnswered: question.timesAnswered,
    timesCorrect: question.timesCorrect,
    suggestedDifficulty: suggestedDifficulty(question.timesAnswered, question.timesCorrect),
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
    hintAmount: reward.hintAmount,
    boostAmount: reward.boostAmount,
    cosmeticId: reward.cosmeticId,
    dropChance: reward.dropChance,
    active: reward.active,
    system: reward.system,
  };
}

export type ShopItemWithReward = ShopItem & { rewardDefinition: Pick<RewardDefinition, "id" | "name" | "rewardType" | "stickerRarity"> | null };

export function toShopItemResponse(item: ShopItemWithReward) {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    itemType: item.itemType,
    priceCoins: item.priceCoins,
    rewardDefinitionId: item.rewardDefinition?.id ?? null,
    rewardName: item.rewardDefinition?.name ?? null,
    rewardType: item.rewardDefinition?.rewardType ?? null,
    rewardRarity: item.rewardDefinition?.stickerRarity ?? null,
    active: item.active,
    system: item.system,
  };
}

export const characterRef = { select: { id: true, name: true } } as const;
export const rewardRef = { select: { id: true, name: true, rewardType: true, stickerRarity: true } } as const;
