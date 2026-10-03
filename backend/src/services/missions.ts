import type { Prisma } from "@prisma/client";
import type { Db } from "../db/prisma";
import { lockUser, transaction } from "../db/prisma";
import { badRequest, notFound } from "../lib/errors";
import { env } from "../lib/env";
import {
  PERFECT_MATCH_MIN_QUESTIONS,
  dayKeyInTimeZone,
  dayRangeInTimeZone,
  hashString,
  seededRandom,
  shuffle,
  weekKeyInTimeZone,
  weekRangeInTimeZone,
} from "./game-rules";
import { toUserResponse } from "./mappers";
import { applyReward, walletData } from "./rewards";
import { getSettings } from "./settings";

/**
 * Missões: metas curtas que renovam (3 diárias sorteadas por jogador + 3
 * semanais fixas). O progresso é calculado das partidas, figurinhas e
 * anotações do período; o resgate fica em user_claims (uma vez por período).
 */

type Range = { start: Date; end: Date };
type Period = "DAILY" | "WEEKLY";

const inRange = (range: Range) => ({ gte: range.start, lt: range.end });

// Estudo de personagem não conta para missões (não rende nada, só acumula acertos).
const notStudy = { quizType: { not: "CHARACTER_STUDY" as const } };

const matchesIn = (db: Db, userId: number, range: Range, extra: object = {}) => db.quizMatch.count({ where: { userId, finishedAt: inRange(range), ...notStudy, ...extra } });

const correctIn = async (db: Db, userId: number, range: Range) =>
  (await db.quizMatch.aggregate({ where: { userId, finishedAt: inRange(range), ...notStudy }, _sum: { correctAnswers: true } }))._sum.correctAnswers ?? 0;

const stickersIn = (db: Db, userId: number, range: Range) => db.userSticker.count({ where: { userId, acquiredAt: inRange(range) } });

/** O que cada missão conta (o painel escolhe uma destas). */
export const MISSION_METRICS = {
  PLAY_MATCHES: { label: "Partidas terminadas", progress: (db: Db, u: number, r: Range) => matchesIn(db, u, r) },
  CORRECT_ANSWERS: { label: "Perguntas acertadas", progress: correctIn },
  DAILY_CHALLENGE: { label: "Desafio do dia jogado", progress: (db: Db, u: number, r: Range) => matchesIn(db, u, r, { quizType: "DAILY_CHALLENGE" }) },
  PERFECT_MATCH: {
    label: `Partidas sem erros (${PERFECT_MATCH_MIN_QUESTIONS}+ perguntas)`,
    progress: (db: Db, u: number, r: Range) => matchesIn(db, u, r, { wrongAnswers: 0, correctAnswers: { gte: PERFECT_MATCH_MIN_QUESTIONS } }),
  },
  WRITE_NOTE: { label: "Anotações em figurinhas", progress: (db: Db, u: number, r: Range) => db.userComment.count({ where: { userId: u, createdAt: inRange(r) } }) },
  NEW_STICKERS: { label: "Figurinhas novas", progress: stickersIn },
} as const;

export type MissionMetric = keyof typeof MISSION_METRICS;
export const MISSION_METRIC_KEYS = Object.keys(MISSION_METRICS) as [MissionMetric, ...MissionMetric[]];

const missionInclude = { rewardDefinition: { select: { id: true, name: true, rewardType: true } } } as const;
type MissionRow = Prisma.MissionGetPayload<{ include: typeof missionInclude }>;

const DAILY_COUNT = 3;

/** As 3 missões diárias de cada jogador mudam todo dia (sorteio estável no dia, entre as ativas). */
export function pickDailyMissions<T extends { id: number }>(pool: T[], userId: number, dayKey: string): T[] {
  const ordered = [...pool].sort((left, right) => left.id - right.id);
  return shuffle(ordered, seededRandom(hashString(`missoes:${userId}:${dayKey}`))).slice(0, DAILY_COUNT);
}

function currentPeriods(now = new Date()) {
  const dayKey = dayKeyInTimeZone(now, env.timezone);
  const weekKey = weekKeyInTimeZone(now, env.timezone);
  return {
    dayKey,
    weekKey,
    day: dayRangeInTimeZone(now, env.timezone),
    week: weekRangeInTimeZone(weekKey, env.timezone),
  };
}

async function missionsWithPeriod(db: Db, userId: number, now = new Date()) {
  const periods = currentPeriods(now);
  const missions = await db.mission.findMany({ where: { active: true }, include: missionInclude, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  const daily = pickDailyMissions(missions.filter((mission) => mission.period === "DAILY"), userId, periods.dayKey).map((mission) => ({ mission, periodKey: periods.dayKey, range: periods.day, endsAt: periods.day.end }));
  const weekly = missions.filter((mission) => mission.period === "WEEKLY").map((mission) => ({ mission, periodKey: periods.weekKey, range: periods.week, endsAt: periods.week.end }));
  return [...daily, ...weekly];
}

const progressOf = (mission: MissionRow, db: Db, userId: number, range: Range) => (MISSION_METRICS[mission.metric as MissionMetric] ?? MISSION_METRICS.PLAY_MATCHES).progress(db, userId, range);

export async function listMissions(db: Db, userId: number) {
  const entries = await missionsWithPeriod(db, userId);
  const claims = await db.userClaim.findMany({
    where: { userId, kind: "MISSION", periodKey: { in: [...new Set(entries.map((entry) => entry.periodKey))] } },
    select: { code: true, periodKey: true },
  });
  const claimed = new Set(claims.map((claim) => `${claim.code}:${claim.periodKey}`));
  return Promise.all(
    entries.map(async ({ mission, periodKey, range, endsAt }) => {
      const current = await progressOf(mission, db, userId, range);
      return {
        code: mission.code,
        period: mission.period as Period,
        title: mission.title,
        coins: mission.rewardCoins,
        reward: mission.rewardDefinition,
        current: Math.min(current, mission.target),
        target: mission.target,
        completed: current >= mission.target,
        claimed: claimed.has(`${mission.code}:${periodKey}`),
        endsAt,
      };
    }),
  );
}

export async function claimMission(userId: number, code: string) {
  return transaction(async (tx) => {
    const entry = (await missionsWithPeriod(tx, userId)).find((item) => item.mission.code === code);
    if (!entry) {
      throw notFound("Missão não disponível hoje");
    }
    await lockUser(tx, userId);
    const current = await progressOf(entry.mission, tx, userId, entry.range);
    if (current < entry.mission.target) {
      throw badRequest("Missão ainda não concluída");
    }
    const created = await tx.userClaim.createMany({ data: [{ userId, kind: "MISSION", code, periodKey: entry.periodKey }], skipDuplicates: true });
    if (created.count === 0) {
      throw badRequest("Recompensa desta missão já resgatada");
    }
    const [user, settings] = await Promise.all([tx.user.findUniqueOrThrow({ where: { id: userId } }), getSettings(tx)]);
    const wallet = { ...user, coins: user.coins + entry.mission.rewardCoins };
    const rewardDefinition = entry.mission.rewardDefinitionId ? await tx.rewardDefinition.findUnique({ where: { id: entry.mission.rewardDefinitionId } }) : null;
    const reward = rewardDefinition ? await applyReward(tx, wallet, rewardDefinition, settings) : null;
    const saved = await tx.user.update({ where: { id: userId }, data: walletData(wallet) });
    return {
      code,
      coins: entry.mission.rewardCoins + (reward?.cosmeticConvertedCoins ?? 0),
      // Recompensa completa (figurinha sorteada, item visual...): a tela mostra o que o jogador ganhou.
      reward,
      user: toUserResponse(saved),
    };
  });
}

/** Missões de lançamento (criadas só se faltarem; depois o painel manda). Cada uma entrega moedas e/ou uma recompensa diferente. */
const DEFAULT_MISSIONS: Array<{ code: string; period: Period; metric: MissionMetric; title: string; target: number; coins: number; reward?: string }> = [
  { code: "D_PLAY_2", period: "DAILY", metric: "PLAY_MATCHES", title: "Termine 2 partidas", target: 2, coins: 25 },
  { code: "D_CORRECT_15", period: "DAILY", metric: "CORRECT_ANSWERS", title: "Acerte 15 perguntas", target: 15, coins: 20, reward: "Tempo extra" },
  { code: "D_CHALLENGE", period: "DAILY", metric: "DAILY_CHALLENGE", title: "Jogue o desafio do dia", target: 1, coins: 20, reward: "Vida extra" },
  { code: "D_PERFECT", period: "DAILY", metric: "PERFECT_MATCH", title: `Faça uma partida sem erros (${PERFECT_MATCH_MIN_QUESTIONS}+ perguntas)`, target: 1, coins: 20, reward: "XP em dobro" },
  { code: "D_NOTE", period: "DAILY", metric: "WRITE_NOTE", title: "Escreva uma anotação em uma figurinha", target: 1, coins: 20 },
  { code: "D_STICKER", period: "DAILY", metric: "NEW_STICKERS", title: "Ganhe uma figurinha nova", target: 1, coins: 20, reward: "Dica 50/50" },
  { code: "W_PLAY_15", period: "WEEKLY", metric: "PLAY_MATCHES", title: "Termine 15 partidas na semana", target: 15, coins: 80, reward: "Pacote surpresa" },
  { code: "W_CORRECT_100", period: "WEEKLY", metric: "CORRECT_ANSWERS", title: "Acerte 100 perguntas na semana", target: 100, coins: 80, reward: "Protetor de sequência" },
  { code: "W_STICKERS_3", period: "WEEKLY", metric: "NEW_STICKERS", title: "Ganhe 3 figurinhas novas na semana", target: 3, coins: 100, reward: "Dica 50/50" },
];

/** Cria as missões padrão que ainda não existem (por código). Nunca sobrescreve o que o admin editou. */
export async function ensureDefaultMissions(db: Db) {
  const existing = new Set((await db.mission.findMany({ select: { code: true } })).map((mission) => mission.code));
  const rewards = await db.rewardDefinition.findMany({ select: { id: true, name: true } });
  for (const [index, mission] of DEFAULT_MISSIONS.entries()) {
    if (existing.has(mission.code)) continue;
    const reward = mission.reward ? rewards.find((item) => item.name.toLowerCase() === mission.reward!.toLowerCase()) : null;
    await db.mission.create({
      data: { code: mission.code, period: mission.period, metric: mission.metric, title: mission.title, target: mission.target, rewardCoins: mission.coins, rewardDefinitionId: reward?.id ?? null, system: true, sortOrder: index * 10 },
    });
  }
}
