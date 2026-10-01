import type { RewardType, User } from "@prisma/client";
import type { GameSettings } from "./settings";

/**
 * Ajudas do quiz guardadas no inventário do jogador. Cada uma tem uma coluna
 * no usuário, um limite guardado (configurações) e um tipo de recompensa.
 */
export const HELPERS = [
  { rewardType: "SKIP_QUESTION", field: "skipBoosts", maxSetting: "maxSkipBoosts", name: "Pular pergunta" },
  { rewardType: "SECOND_CHANCE", field: "secondChanceBoosts", maxSetting: "maxSecondChanceBoosts", name: "Segunda chance" },
  { rewardType: "CROWD_HELP", field: "crowdBoosts", maxSetting: "maxCrowdBoosts", name: "Voz da multidão" },
  { rewardType: "VERSE_HINT", field: "verseHintBoosts", maxSetting: "maxVerseHintBoosts", name: "Pista do versículo" },
  { rewardType: "FREEZE_TIME", field: "freezeTimeBoosts", maxSetting: "maxFreezeTimeBoosts", name: "Ampulheta" },
  { rewardType: "DOUBLE_COINS", field: "doubleCoinsBoosts", maxSetting: "maxDoubleCoinsBoosts", name: "Bênção dobrada" },
  { rewardType: "COMBO_SHIELD", field: "comboShieldBoosts", maxSetting: "maxComboShieldBoosts", name: "Escudo de sequência" },
] as const satisfies ReadonlyArray<{ rewardType: RewardType; field: keyof User; maxSetting: keyof GameSettings; name: string }>;

export type HelperDefinition = (typeof HELPERS)[number];
export type HelperField = HelperDefinition["field"];

export const helperByReward = (type: RewardType) => HELPERS.find((helper) => helper.rewardType === type);

/** Inventário das ajudas novas, para devolver ao app junto com o saldo. */
export function helperCounts(user: Pick<User, HelperField>) {
  return Object.fromEntries(HELPERS.map((helper) => [helper.field, user[helper.field]])) as Record<HelperField, number>;
}
