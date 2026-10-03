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
  rewardMatchLimitPerDay: { key: "quiz.general.rewardLimitPerDay", defaultValue: 3, description: "Limite diário de partidas com recompensa", kind: "int" },
  maxExtraLifeBoosts: { key: "reward.boost.maxExtraLife", defaultValue: 5, description: "Máximo de bônus de vida extra acumulados por usuário", kind: "int" },
  maxExtraTimeBoosts: { key: "reward.boost.maxExtraTime", defaultValue: 5, description: "Máximo de bônus de tempo extra acumulados por usuário", kind: "int" },
  maxDoubleXpBoosts: { key: "reward.boost.maxDoubleXp", defaultValue: 5, description: "Máximo de bônus de XP em dobro acumulados por usuário", kind: "int" },
  doubleXpMultiplier: { key: "reward.boost.doubleXpMultiplier", defaultValue: 2.0, description: "Multiplicador aplicado ao usar XP em dobro", kind: "float" },
  extraTimeSeconds: { key: "reward.boost.extraTimeSeconds", defaultValue: 15, description: "Segundos adicionados ao usar tempo extra", kind: "int" },
  rewardMinCorrectAnswers: { key: "quiz.general.rewardMinCorrectAnswers", defaultValue: 7, description: "Acertos mínimos no quiz geral para concorrer a recompensa", kind: "int" },
  maxHintBoosts: { key: "reward.boost.maxHint", defaultValue: 5, description: "Máximo de dicas 50/50 acumuladas por usuário", kind: "int" },
  coinsPerCorrectAnswer: { key: "economy.coinsPerCorrectAnswer", defaultValue: 2, description: "Moedas por acerto ao terminar uma partida", kind: "int" },
  perfectMatchBonusCoins: { key: "economy.perfectMatchBonusCoins", defaultValue: 20, description: "Moedas extras por partida sem erros (mínimo de 5 perguntas)", kind: "int" },
  coinMatchLimitPerDay: { key: "economy.coinMatchLimitPerDay", defaultValue: 6, description: "Partidas por dia que rendem moedas por acerto", kind: "int" },
  duplicateCoinsCommon: { key: "economy.duplicateCoins.common", defaultValue: 15, description: "Moedas por figurinha comum repetida", kind: "int" },
  duplicateCoinsRare: { key: "economy.duplicateCoins.rare", defaultValue: 40, description: "Moedas por figurinha rara repetida", kind: "int" },
  duplicateCoinsEpic: { key: "economy.duplicateCoins.epic", defaultValue: 90, description: "Moedas por figurinha épica repetida", kind: "int" },
  duplicateCoinsLegendary: { key: "economy.duplicateCoins.legendary", defaultValue: 200, description: "Moedas por figurinha lendária repetida", kind: "int" },
  dailyRewardBaseCoins: { key: "daily.baseCoins", defaultValue: 20, description: "Moedas do prêmio diário no 1º dia da sequência", kind: "int" },
  dailyRewardStepCoins: { key: "daily.stepCoins", defaultValue: 10, description: "Moedas a mais por dia seguido (dias 2 a 6)", kind: "int" },
  dailyRewardDay7Coins: { key: "daily.day7Coins", defaultValue: 120, description: "Moedas do 7º dia seguido (também dá 1 dica 50/50)", kind: "int" },
  packOddsCommon: { key: "pack.odds.common", defaultValue: 62, description: "Peso da raridade comum no pacote surpresa", kind: "int" },
  packOddsRare: { key: "pack.odds.rare", defaultValue: 28, description: "Peso da raridade rara no pacote surpresa", kind: "int" },
  packOddsEpic: { key: "pack.odds.epic", defaultValue: 9, description: "Peso da raridade épica no pacote surpresa", kind: "int" },
  packOddsLegendary: { key: "pack.odds.legendary", defaultValue: 1, description: "Peso da raridade lendária no pacote surpresa", kind: "int" },
  maxStreakFreezes: { key: "reward.boost.maxStreakFreeze", defaultValue: 2, description: "Máximo de protetores de sequência guardados", kind: "int" },
  pityThreshold: { key: "reward.pityThreshold", defaultValue: 6, description: "Prêmios seguidos sem figurinha até a próxima ser garantida (0 desliga)", kind: "int" },
  fuseCost: { key: "collection.fuseCost", defaultValue: 3, description: "Repetidas da mesma raridade para fundir em uma de raridade acima", kind: "int" },
  dailyChallengeQuestions: { key: "challenge.questions", defaultValue: 10, description: "Perguntas do desafio do dia", kind: "int" },
  leagueFirstCoins: { key: "league.firstCoins", defaultValue: 500, description: "Moedas do 1º lugar da liga semanal", kind: "int" },
  leagueSecondCoins: { key: "league.secondCoins", defaultValue: 300, description: "Moedas do 2º lugar da liga semanal", kind: "int" },
  leagueThirdCoins: { key: "league.thirdCoins", defaultValue: 150, description: "Moedas do 3º lugar da liga semanal", kind: "int" },
  chatEnabled: { key: "social.chatEnabled", defaultValue: 1, description: "Conversa entre amigos ligada (1) ou desligada (0)", kind: "int" },
  tradesPerDay: { key: "social.tradesPerDay", defaultValue: 5, description: "Trocas/presentes concluídos por jogador por dia", kind: "int" },
  maxPendingTrades: { key: "social.maxPendingTrades", defaultValue: 10, description: "Propostas de troca abertas por jogador", kind: "int" },
  tradeExpireDays: { key: "social.tradeExpireDays", defaultValue: 7, description: "Dias até uma proposta de troca expirar", kind: "int" },
  maxSkipBoosts: { key: "reward.boost.maxSkip", defaultValue: 3, description: "Máximo de \"pular pergunta\" guardados", kind: "int" },
  maxSecondChanceBoosts: { key: "reward.boost.maxSecondChance", defaultValue: 3, description: "Máximo de segundas chances guardadas", kind: "int" },
  maxCrowdBoosts: { key: "reward.boost.maxCrowd", defaultValue: 3, description: "Máximo de \"voz da multidão\" guardados", kind: "int" },
  maxVerseHintBoosts: { key: "reward.boost.maxVerseHint", defaultValue: 3, description: "Máximo de pistas do versículo guardadas", kind: "int" },
  maxFreezeTimeBoosts: { key: "reward.boost.maxFreezeTime", defaultValue: 3, description: "Máximo de ampulhetas guardadas", kind: "int" },
  maxDoubleCoinsBoosts: { key: "reward.boost.maxDoubleCoins", defaultValue: 3, description: "Máximo de bênçãos dobradas (moedas em dobro) guardadas", kind: "int" },
  maxComboShieldBoosts: { key: "reward.boost.maxComboShield", defaultValue: 3, description: "Máximo de escudos de sequência guardados", kind: "int" },
  doubleCoinsMultiplier: { key: "reward.boost.doubleCoinsMultiplier", defaultValue: 2.0, description: "Multiplicador de moedas da bênção dobrada", kind: "float" },
  comboStartAt: { key: "combo.startAt", defaultValue: 3, description: "Acertos seguidos para começar o bônus de sequência", kind: "int" },
  comboPointsPerAnswer: { key: "combo.pointsPerAnswer", defaultValue: 5, description: "Pontos extras por acerto dentro da sequência", kind: "int" },
  comboCoinsPerAnswer: { key: "combo.coinsPerAnswer", defaultValue: 1, description: "Moedas extras por acerto dentro da sequência", kind: "int" },
  chestBaseCoins: { key: "chest.baseCoins", defaultValue: 30, description: "Moedas fixas do baú de nível", kind: "int" },
  chestCoinsPerLevel: { key: "chest.coinsPerLevel", defaultValue: 5, description: "Moedas a mais no baú por nível alcançado", kind: "int" },
  chestMaxCoins: { key: "chest.maxCoins", defaultValue: 150, description: "Teto de moedas de um baú de nível (0 = sem teto)", kind: "int" },
  shopStickerLimitPerDay: { key: "shop.stickerLimitPerDay", defaultValue: 2, description: "Figurinhas (e pacotes) que o jogador pode comprar por dia (0 = sem limite)", kind: "int" },
  chestCosmeticChance: { key: "chest.cosmeticChance", defaultValue: 15, description: "Chance (%) do baú trazer um item visual", kind: "int" },
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
