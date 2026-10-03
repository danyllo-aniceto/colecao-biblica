import type { Db } from "../db/prisma";
import { PERFECT_MATCH_MIN_QUESTIONS } from "./game-rules";
import { visibleCharacter } from "./visibility";

/**
 * Conquistas: metas permanentes que dão moedas uma única vez. Ficam no código
 * (não no banco) para valerem iguais em todo deploy; o banco guarda só quem
 * desbloqueou o quê.
 */

export type AchievementStats = {
  matches: number;
  perfectMatches: number;
  level: number;
  stickers: number;
  totalStickers: number;
  legendaryStickers: number;
  dailyStreak: number;
  notes: number;
  friends: number;
  trades: number;
};

type AchievementDefinition = {
  code: string;
  title: string;
  description: string;
  icon: string;
  coins: number;
  /** Progresso atual e meta (a conquista é liberada quando current >= target). */
  progress: (stats: AchievementStats) => { current: number; target: number };
};

export const ACHIEVEMENTS: AchievementDefinition[] = [
  { code: "FIRST_MATCH", title: "Primeiros passos", description: "Termine sua primeira partida.", icon: "flag", coins: 30, progress: (s) => ({ current: s.matches, target: 1 }) },
  { code: "MATCHES_10", title: "Dedicado", description: "Termine 10 partidas.", icon: "repeat", coins: 100, progress: (s) => ({ current: s.matches, target: 10 }) },
  { code: "MATCHES_50", title: "Incansável", description: "Termine 50 partidas.", icon: "fire", coins: 300, progress: (s) => ({ current: s.matches, target: 50 }) },
  {
    code: "PERFECT_MATCH",
    title: "Gabarito",
    description: `Acerte todas as perguntas de uma partida com ${PERFECT_MATCH_MIN_QUESTIONS} ou mais perguntas.`,
    icon: "star",
    coins: 100,
    progress: (s) => ({ current: s.perfectMatches, target: 1 }),
  },
  { code: "LEVEL_5", title: "Discípulo", description: "Chegue ao nível 5.", icon: "level", coins: 150, progress: (s) => ({ current: s.level, target: 5 }) },
  { code: "LEVEL_10", title: "Mestre", description: "Chegue ao nível 10.", icon: "level", coins: 300, progress: (s) => ({ current: s.level, target: 10 }) },
  { code: "STICKERS_10", title: "Colecionador", description: "Tenha 10 figurinhas no álbum.", icon: "album", coins: 150, progress: (s) => ({ current: s.stickers, target: 10 }) },
  { code: "LEGENDARY", title: "Lenda", description: "Conquiste uma figurinha lendária.", icon: "crown", coins: 200, progress: (s) => ({ current: s.legendaryStickers, target: 1 }) },
  {
    code: "ALBUM_COMPLETE",
    title: "Álbum completo",
    description: "Tenha todas as figurinhas publicadas.",
    icon: "trophy",
    coins: 1000,
    // Sem figurinhas publicadas a meta fica impossível (evita liberar com 0 de 0).
    progress: (s) => ({ current: s.stickers, target: s.totalStickers > 0 ? s.totalStickers : Number.POSITIVE_INFINITY }),
  },
  { code: "STREAK_7", title: "Fiel", description: "Resgate o prêmio diário 7 dias seguidos.", icon: "calendar", coins: 200, progress: (s) => ({ current: s.dailyStreak, target: 7 }) },
  { code: "FRIENDS_3", title: "Comunhão", description: "Tenha 3 amigos no app.", icon: "people", coins: 60, progress: (s) => ({ current: s.friends, target: 3 }) },
  { code: "FIRST_TRADE", title: "Partilha", description: "Conclua sua primeira troca ou presente com um amigo.", icon: "swap", coins: 50, progress: (s) => ({ current: s.trades, target: 1 }) },
  { code: "NOTES_5", title: "Estudioso", description: "Escreva anotações em 5 figurinhas.", icon: "note", coins: 80, progress: (s) => ({ current: s.notes, target: 5 }) },
];

export async function loadStats(db: Db, userId: number): Promise<AchievementStats> {
  const [user, matches, perfectMatches, stickers, totalStickers, legendaryStickers, notes, friends, trades] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { level: true, dailyStreak: true } }),
    db.quizMatch.count({ where: { userId, quizType: { not: "CHARACTER_STUDY" } } }),
    db.quizMatch.count({ where: { userId, quizType: { not: "CHARACTER_STUDY" }, wrongAnswers: 0, correctAnswers: { gte: PERFECT_MATCH_MIN_QUESTIONS } } }),
    db.userSticker.count({ where: { userId, character: visibleCharacter() } }),
    db.biblicalCharacter.count({ where: visibleCharacter() }),
    db.userSticker.count({ where: { userId, character: { rarity: "LEGENDARY" } } }),
    db.userComment.groupBy({ by: ["characterId"], where: { userId } }).then((groups) => groups.length),
    db.friendship.count({ where: { status: "ACCEPTED", OR: [{ requesterId: userId }, { addresseeId: userId }] } }),
    db.trade.count({ where: { status: "ACCEPTED", OR: [{ proposerId: userId }, { receiverId: userId }] } }),
  ]);
  return { matches, perfectMatches, level: user.level, stickers, totalStickers, legendaryStickers, dailyStreak: user.dailyStreak, notes, friends, trades };
}

export type UnlockedAchievement = { code: string; title: string; coins: number };

/**
 * Libera as conquistas alcançadas e credita as moedas. Chamado ao fim da
 * partida, na compra, no prêmio diário e nas anotações (dentro da transação).
 */
export async function checkAchievements(db: Db, userId: number): Promise<UnlockedAchievement[]> {
  const [stats, owned] = await Promise.all([
    loadStats(db, userId),
    db.userAchievement.findMany({ where: { userId }, select: { code: true } }).then((rows) => new Set(rows.map((row) => row.code))),
  ]);

  const reached = ACHIEVEMENTS.filter((achievement) => {
    if (owned.has(achievement.code)) return false;
    const { current, target } = achievement.progress(stats);
    return current >= target;
  });
  if (reached.length === 0) {
    return [];
  }

  // skipDuplicates: duas requisições simultâneas não pagam a mesma conquista duas vezes.
  const unlocked: UnlockedAchievement[] = [];
  for (const achievement of reached) {
    const created = await db.userAchievement.createMany({ data: [{ userId, code: achievement.code }], skipDuplicates: true });
    if (created.count > 0) {
      unlocked.push({ code: achievement.code, title: achievement.title, coins: achievement.coins });
    }
  }
  const coins = unlocked.reduce((sum, achievement) => sum + achievement.coins, 0);
  if (coins > 0) {
    await db.user.update({ where: { id: userId }, data: { coins: { increment: coins } } });
  }
  return unlocked;
}

/** Lista para a tela de conquistas: todas, com progresso e data de desbloqueio. */
export async function listAchievements(db: Db, userId: number) {
  const [stats, rows] = await Promise.all([loadStats(db, userId), db.userAchievement.findMany({ where: { userId } })]);
  const unlockedAt = new Map(rows.map((row) => [row.code, row.unlockedAt]));
  return ACHIEVEMENTS.map((achievement) => {
    const { current, target } = achievement.progress(stats);
    const finiteTarget = Number.isFinite(target) ? target : 0;
    return {
      code: achievement.code,
      title: achievement.title,
      description: achievement.description,
      icon: achievement.icon,
      coins: achievement.coins,
      current: Math.min(current, finiteTarget || current),
      target: finiteTarget,
      unlocked: unlockedAt.has(achievement.code),
      unlockedAt: unlockedAt.get(achievement.code) ?? null,
    };
  });
}
