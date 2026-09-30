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
