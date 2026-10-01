import type { Db } from "../db/prisma";

type SettingDefinition = {
  key: string;
  defaultValue: number;
  description: string;
  kind: "int" | "float";
};

/** Configurações do jogo editáveis pelo admin (tabela game_settings, chave → valor). */
export const SETTINGS = {
  maxQuestionsPerMatch: { key: "quiz.general.maxQuestions", defaultValue: 100, description: "Máximo de perguntas por partida geral", kind: "int" },
  startingLives: { key: "quiz.general.startingLives", defaultValue: 3, description: "Vidas iniciais por partida geral", kind: "int" },
  rewardMatchLimitPerDay: { key: "quiz.general.rewardLimitPerDay", defaultValue: 4, description: "Limite diário de partidas com recompensa", kind: "int" },
  characterStudyXpPercent: { key: "quiz.characterStudy.xpPercent", defaultValue: 35, description: "Percentual de XP em quiz de personagem", kind: "int" },
  maxExtraLifeBoosts: { key: "reward.boost.maxExtraLife", defaultValue: 5, description: "Máximo de bônus de vida extra acumulados por usuário", kind: "int" },
  maxExtraTimeBoosts: { key: "reward.boost.maxExtraTime", defaultValue: 5, description: "Máximo de bônus de tempo extra acumulados por usuário", kind: "int" },
  maxDoubleXpBoosts: { key: "reward.boost.maxDoubleXp", defaultValue: 5, description: "Máximo de bônus de XP em dobro acumulados por usuário", kind: "int" },
  doubleXpMultiplier: { key: "reward.boost.doubleXpMultiplier", defaultValue: 2.0, description: "Multiplicador aplicado ao usar XP em dobro", kind: "float" },
  extraTimeSeconds: { key: "reward.boost.extraTimeSeconds", defaultValue: 15, description: "Segundos adicionados ao usar tempo extra", kind: "int" },
  rewardMinCorrectAnswers: { key: "quiz.general.rewardMinCorrectAnswers", defaultValue: 7, description: "Acertos mínimos no quiz geral para concorrer a recompensa", kind: "int" },
  characterStickerMinAccuracyPercent: {
    key: "quiz.characterStudy.stickerMinAccuracyPercent",
    defaultValue: 70,
    description: "Aproveitamento mínimo (%) no quiz de personagem para ganhar a figurinha",
    kind: "int",
  },
  maxHintBoosts: { key: "reward.boost.maxHint", defaultValue: 5, description: "Máximo de dicas 50/50 acumuladas por usuário", kind: "int" },
  coinsPerCorrectAnswer: { key: "economy.coinsPerCorrectAnswer", defaultValue: 2, description: "Moedas por acerto ao terminar uma partida", kind: "int" },
  perfectMatchBonusCoins: { key: "economy.perfectMatchBonusCoins", defaultValue: 15, description: "Moedas extras por partida sem erros (mínimo de 5 perguntas)", kind: "int" },
  coinMatchLimitPerDay: { key: "economy.coinMatchLimitPerDay", defaultValue: 10, description: "Partidas por dia que rendem moedas por acerto", kind: "int" },
  duplicateCoinsCommon: { key: "economy.duplicateCoins.common", defaultValue: 15, description: "Moedas por figurinha comum repetida", kind: "int" },
  duplicateCoinsRare: { key: "economy.duplicateCoins.rare", defaultValue: 40, description: "Moedas por figurinha rara repetida", kind: "int" },
  duplicateCoinsEpic: { key: "economy.duplicateCoins.epic", defaultValue: 90, description: "Moedas por figurinha épica repetida", kind: "int" },
  duplicateCoinsLegendary: { key: "economy.duplicateCoins.legendary", defaultValue: 200, description: "Moedas por figurinha lendária repetida", kind: "int" },
  dailyRewardBaseCoins: { key: "daily.baseCoins", defaultValue: 20, description: "Moedas do prêmio diário no 1º dia da sequência", kind: "int" },
  dailyRewardStepCoins: { key: "daily.stepCoins", defaultValue: 10, description: "Moedas a mais por dia seguido (dias 2 a 6)", kind: "int" },
  dailyRewardDay7Coins: { key: "daily.day7Coins", defaultValue: 120, description: "Moedas do 7º dia seguido (também dá 1 dica 50/50)", kind: "int" },
  packOddsCommon: { key: "pack.odds.common", defaultValue: 60, description: "Peso da raridade comum no pacote surpresa", kind: "int" },
  packOddsRare: { key: "pack.odds.rare", defaultValue: 28, description: "Peso da raridade rara no pacote surpresa", kind: "int" },
  packOddsEpic: { key: "pack.odds.epic", defaultValue: 10, description: "Peso da raridade épica no pacote surpresa", kind: "int" },
  packOddsLegendary: { key: "pack.odds.legendary", defaultValue: 2, description: "Peso da raridade lendária no pacote surpresa", kind: "int" },
  maxStreakFreezes: { key: "reward.boost.maxStreakFreeze", defaultValue: 2, description: "Máximo de protetores de sequência guardados", kind: "int" },
  pityThreshold: { key: "reward.pityThreshold", defaultValue: 5, description: "Prêmios seguidos sem figurinha até a próxima ser garantida (0 desliga)", kind: "int" },
  fuseCost: { key: "collection.fuseCost", defaultValue: 3, description: "Repetidas da mesma raridade para fundir em uma de raridade acima", kind: "int" },
  dailyChallengeQuestions: { key: "challenge.questions", defaultValue: 10, description: "Perguntas do desafio do dia", kind: "int" },
  leagueFirstCoins: { key: "league.firstCoins", defaultValue: 500, description: "Moedas do 1º lugar da liga semanal", kind: "int" },
  leagueSecondCoins: { key: "league.secondCoins", defaultValue: 300, description: "Moedas do 2º lugar da liga semanal", kind: "int" },
  leagueThirdCoins: { key: "league.thirdCoins", defaultValue: 150, description: "Moedas do 3º lugar da liga semanal", kind: "int" },
} satisfies Record<string, SettingDefinition>;

export type SettingName = keyof typeof SETTINGS;
export type GameSettings = Record<SettingName, number>;

const SETTING_NAMES = Object.keys(SETTINGS) as SettingName[];

function parseValue(definition: SettingDefinition, raw: string | undefined): number {
  if (raw === undefined) {
    return definition.defaultValue;
  }
  const value = definition.kind === "int" ? Number.parseInt(raw, 10) : Number.parseFloat(raw);
  return Number.isFinite(value) ? value : definition.defaultValue;
}

/** Lê todas as configurações numa consulta só; chaves ausentes usam o padrão. */
export async function getSettings(db: Db): Promise<GameSettings> {
  const rows = await db.gameSetting.findMany();
  const byKey = new Map(rows.map((row) => [row.settingKey, row.settingValue]));
  const settings = {} as GameSettings;
  for (const name of SETTING_NAMES) {
    const definition: SettingDefinition = SETTINGS[name];
    settings[name] = parseValue(definition, byKey.get(definition.key));
  }
  return settings;
}

function formatValue(definition: SettingDefinition, value: number) {
  // Mantém "2.0" em vez de "2" para multiplicadores, como no banco original.
  return definition.kind === "float" && Number.isInteger(value) ? value.toFixed(1) : String(value);
}

export async function updateSettings(db: Db, changes: Partial<GameSettings>): Promise<GameSettings> {
  for (const name of SETTING_NAMES) {
    const value = changes[name];
    if (value === undefined) {
      continue;
    }
    const definition: SettingDefinition = SETTINGS[name];
    await db.gameSetting.upsert({
      where: { settingKey: definition.key },
      create: { settingKey: definition.key, settingValue: formatValue(definition, value), description: definition.description },
      update: { settingValue: formatValue(definition, value), description: definition.description },
    });
  }
  return getSettings(db);
}

/** Cria as configurações que faltam com o valor padrão, sem mexer nas já alteradas pelo admin. */
export async function ensureDefaultSettings(db: Db) {
  const existing = new Set((await db.gameSetting.findMany({ select: { settingKey: true } })).map((row) => row.settingKey));
  const missing = SETTING_NAMES.map((name) => SETTINGS[name] as SettingDefinition).filter((definition) => !existing.has(definition.key));
  if (missing.length > 0) {
    await db.gameSetting.createMany({
      data: missing.map((definition) => ({
        settingKey: definition.key,
        settingValue: formatValue(definition, definition.defaultValue),
        description: definition.description,
      })),
      skipDuplicates: true,
    });
  }
}
