import type { Prisma } from "@prisma/client";
import { transaction } from "../db/prisma";
import { HELPERS } from "./helpers";

export type ResetOptions = {
  /** Apaga também amizades e conversas (por padrão ficam, para os testadores não perderem os amigos). */
  includeSocial?: boolean;
};

/** Campos do jogador que voltam ao valor de uma conta nova. */
function freshProgress(): Prisma.UserUpdateManyMutationInput {
  return {
    xp: 0,
    level: 1,
    coins: 0,
    totalScore: 0,
    extraLifeBoosts: 0,
    extraTimeBoosts: 0,
    doubleXpBoosts: 0,
    hintBoosts: 0,
    dailyStreak: 0,
    lastDailyClaim: null,
    streakFreezes: 0,
    stickerPity: 0,
    bestCombo: 0,
    chestLevel: 1,
    showcase: [],
    ...Object.fromEntries(HELPERS.map((helper) => [helper.field, 0])),
  };
}

/**
 * Devolve os jogadores ao começo, como se a conta fosse nova: moedas, XP, nível, ajudas, figurinhas, estudos,
 * anotações, partidas, conquistas, resgates (missões, prêmio diário, campanha, passe, coleções, liga), itens
 * visuais e trocas. Mantém a conta (nome, e-mail, senha, papel e código de amigo). Os itens visuais grátis
 * voltam sozinhos no próximo acesso. Reportes de perguntas ficam (são feedback para o painel).
 */
export async function resetUsersProgress(userIds: number[], options: ResetOptions = {}) {
  if (userIds.length === 0) return 0;
  await transaction(async (tx) => {
    const mine = { in: userIds };
    await tx.trade.deleteMany({ where: { OR: [{ proposerId: mine }, { receiverId: mine }] } });
    await tx.userSticker.deleteMany({ where: { userId: mine } });
    await tx.characterStudy.deleteMany({ where: { userId: mine } });
    await tx.userComment.deleteMany({ where: { userId: mine } });
    await tx.quizMatch.deleteMany({ where: { userId: mine } });
    await tx.quizSession.deleteMany({ where: { userId: mine } });
    await tx.userAchievement.deleteMany({ where: { userId: mine } });
    await tx.userClaim.deleteMany({ where: { userId: mine } });
    await tx.userCosmetic.deleteMany({ where: { userId: mine } });
    if (options.includeSocial) {
      await tx.message.deleteMany({ where: { OR: [{ senderId: mine }, { receiverId: mine }] } });
      await tx.friendship.deleteMany({ where: { OR: [{ requesterId: mine }, { addresseeId: mine }] } });
    }
    await tx.user.updateMany({ where: { id: mine }, data: { ...freshProgress(), avatarId: null, frameId: null, titleId: null, nameColorId: null, profileBgId: null, albumCoverId: null } });
  });
  return userIds.length;
}
