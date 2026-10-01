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
import { getSettings } from "./settings";

/**
 * Missões: metas curtas que renovam (3 diárias sorteadas por jogador + 3
 * semanais fixas). O progresso é calculado das partidas, figurinhas e
 * anotações do período; o resgate fica em user_claims (uma vez por período).
 */

type Range = { start: Date; end: Date };
type Period = "DAILY" | "WEEKLY";

type MissionDefinition = {
  code: string;
  period: Period;
  title: string;
  coins: number;
  hints?: number;
  target: number;
  progress: (db: Db, userId: number, range: Range) => Promise<number>;
};

const inRange = (range: Range) => ({ gte: range.start, lt: range.end });

const matchesIn = (db: Db, userId: number, range: Range, extra: object = {}) => db.quizMatch.count({ where: { userId, finishedAt: inRange(range), ...extra } });

const correctIn = async (db: Db, userId: number, range: Range) =>
  (await db.quizMatch.aggregate({ where: { userId, finishedAt: inRange(range) }, _sum: { correctAnswers: true } }))._sum.correctAnswers ?? 0;

const stickersIn = (db: Db, userId: number, range: Range) => db.userSticker.count({ where: { userId, acquiredAt: inRange(range) } });

export const MISSIONS: MissionDefinition[] = [
  { code: "D_PLAY_2", period: "DAILY", title: "Termine 2 partidas", coins: 30, target: 2, progress: (db, u, r) => matchesIn(db, u, r) },
  { code: "D_CORRECT_15", period: "DAILY", title: "Acerte 15 perguntas", coins: 40, target: 15, progress: correctIn },
  { code: "D_STUDY", period: "DAILY", title: "Faça um estudo de personagem", coins: 30, target: 1, progress: (db, u, r) => matchesIn(db, u, r, { quizType: "CHARACTER_STUDY" }) },
  { code: "D_CHALLENGE", period: "DAILY", title: "Jogue o desafio do dia", coins: 40, target: 1, progress: (db, u, r) => matchesIn(db, u, r, { quizType: "DAILY_CHALLENGE" }) },
  {
    code: "D_PERFECT",
    period: "DAILY",
    title: `Faça uma partida sem erros (${PERFECT_MATCH_MIN_QUESTIONS}+ perguntas)`,
    coins: 50,
    target: 1,
    progress: (db, u, r) => matchesIn(db, u, r, { wrongAnswers: 0, correctAnswers: { gte: PERFECT_MATCH_MIN_QUESTIONS } }),
  },
  { code: "D_NOTE", period: "DAILY", title: "Escreva uma anotação em uma figurinha", coins: 25, target: 1, progress: (db, u, r) => db.userComment.count({ where: { userId: u, createdAt: inRange(r) } }) },
  { code: "D_STICKER", period: "DAILY", title: "Ganhe uma figurinha nova", coins: 40, target: 1, progress: stickersIn },
  { code: "W_PLAY_15", period: "WEEKLY", title: "Termine 15 partidas na semana", coins: 150, target: 15, progress: (db, u, r) => matchesIn(db, u, r) },
  { code: "W_CORRECT_100", period: "WEEKLY", title: "Acerte 100 perguntas na semana", coins: 200, target: 100, progress: correctIn },
  { code: "W_STICKERS_3", period: "WEEKLY", title: "Ganhe 3 figurinhas novas na semana", coins: 150, hints: 1, target: 3, progress: stickersIn },
];

const DAILY_COUNT = 3;

/** As 3 missões diárias de cada jogador mudam todo dia (sorteio estável no dia). */
export function dailyMissionsFor(userId: number, dayKey: string) {
  const pool = MISSIONS.filter((mission) => mission.period === "DAILY");
  return shuffle(pool, seededRandom(hashString(`missoes:${userId}:${dayKey}`))).slice(0, DAILY_COUNT);
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

function missionsWithPeriod(userId: number, now = new Date()) {
  const periods = currentPeriods(now);
  const daily = dailyMissionsFor(userId, periods.dayKey).map((mission) => ({ mission, periodKey: periods.dayKey, range: periods.day, endsAt: periods.day.end }));
  const weekly = MISSIONS.filter((mission) => mission.period === "WEEKLY").map((mission) => ({
    mission,
    periodKey: periods.weekKey,
    range: periods.week,
    endsAt: periods.week.end,
  }));
  return [...daily, ...weekly];
}

export async function listMissions(db: Db, userId: number) {
  const entries = missionsWithPeriod(userId);
  const claims = await db.userClaim.findMany({
    where: { userId, kind: "MISSION", periodKey: { in: [...new Set(entries.map((entry) => entry.periodKey))] } },
    select: { code: true, periodKey: true },
  });
  const claimed = new Set(claims.map((claim) => `${claim.code}:${claim.periodKey}`));
  return Promise.all(
    entries.map(async ({ mission, periodKey, range, endsAt }) => {
      const current = await mission.progress(db, userId, range);
      return {
        code: mission.code,
        period: mission.period,
        title: mission.title,
        coins: mission.coins,
        hints: mission.hints ?? 0,
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
    const entry = missionsWithPeriod(userId).find((item) => item.mission.code === code);
    if (!entry) {
      throw notFound("Missão não disponível hoje");
    }
    await lockUser(tx, userId);
    const current = await entry.mission.progress(tx, userId, entry.range);
    if (current < entry.mission.target) {
      throw badRequest("Missão ainda não concluída");
    }
    const created = await tx.userClaim.createMany({ data: [{ userId, kind: "MISSION", code, periodKey: entry.periodKey }], skipDuplicates: true });
    if (created.count === 0) {
      throw badRequest("Recompensa desta missão já resgatada");
    }
    const [user, settings] = await Promise.all([tx.user.findUniqueOrThrow({ where: { id: userId } }), getSettings(tx)]);
    const hints = Math.min(user.hintBoosts + (entry.mission.hints ?? 0), settings.maxHintBoosts);
    const saved = await tx.user.update({ where: { id: userId }, data: { coins: user.coins + entry.mission.coins, hintBoosts: hints } });
    return { code, coins: entry.mission.coins, hints: hints - user.hintBoosts, userCoins: saved.coins, hintBoosts: saved.hintBoosts };
  });
}
