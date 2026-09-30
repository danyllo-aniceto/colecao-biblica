import type { Prisma, Question, QuizSession, QuizType, User } from "@prisma/client";
import { lockUser, prisma, transaction, type Db } from "../db/prisma";
import { badRequest, notFound } from "../lib/errors";
import { env } from "../lib/env";
import {
  applyCharacterStudyPercent,
  availableSeconds,
  calculateLevel,
  calculateScore,
  calculateXp,
  dayRangeInTimeZone,
  isTimeExpired,
  reachedStickerAccuracy,
  remainingSeconds,
  requiredCorrectAnswersForReward,
  shuffle,
  weightedPick,
} from "./game-rules";
import { applyReward, grantStickerIfMissing, walletData } from "./rewards";
import { getSettings, type GameSettings } from "./settings";

type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------------------
// Formato das respostas
// ---------------------------------------------------------------------------

function timerOf(session: QuizSession, question: Question) {
  return {
    startedAt: session.currentQuestionStartedAt,
    timeLimitSeconds: question.timeLimitSeconds,
    extraSeconds: session.currentQuestionExtraSeconds,
  };
}

function toQuestionView(session: QuizSession, question: Question) {
  const timer = timerOf(session, question);
  return {
    id: question.id,
    text: question.text,
    difficulty: question.difficulty,
    timeLimitSeconds: availableSeconds(timer),
    remainingSeconds: remainingSeconds(timer),
    optionA: question.optionA,
    optionB: question.optionB,
    optionC: question.optionC,
    optionD: question.optionD,
  };
}

function toStatusResponse(session: QuizSession, currentQuestion: Question | null) {
  return {
    sessionId: session.id,
    quizType: session.quizType,
    status: session.status,
    totalQuestions: session.totalQuestions,
    currentQuestionIndex: session.currentQuestionIndex,
    livesRemaining: session.livesRemaining,
    correctAnswers: session.correctAnswers,
    wrongAnswers: session.wrongAnswers,
    xpMultiplier: session.xpMultiplier,
    extraTimeUsed: session.extraTimeUsed,
    extraLifeUsed: session.extraLifeUsed,
    xpMultiplierUsed: session.xpMultiplierUsed,
    currentQuestion: currentQuestion ? toQuestionView(session, currentQuestion) : null,
  };
}

export type MatchResult = Awaited<ReturnType<typeof finalizeMatch>>;

// ---------------------------------------------------------------------------
// Sessões
// ---------------------------------------------------------------------------

async function getOwnedSession(db: Db, sessionId: number, userId: number, lock = false): Promise<QuizSession> {
  if (lock) {
    // Trava a sessão: duas respostas simultâneas para a mesma pergunta não contam em dobro.
    await (db as Tx).$queryRaw`SELECT id FROM quiz_sessions WHERE id = ${sessionId} FOR UPDATE`;
  }
  const session = await db.quizSession.findFirst({ where: { id: sessionId, userId } });
  if (!session) {
    throw notFound("Sessão de quiz não encontrada");
  }
  return session;
}

async function getCurrentQuestion(db: Db, session: QuizSession): Promise<Question> {
  const index = session.currentQuestionIndex;
  if (session.questionIds.length === 0) {
    throw badRequest("Sessão sem perguntas configuradas");
  }
  if (index < 0 || index >= session.questionIds.length) {
    throw badRequest("Índice de pergunta inválido na sessão");
  }
  const question = await db.question.findUnique({ where: { id: session.questionIds[index] } });
  if (!question) {
    throw notFound("Pergunta da sessão não encontrada");
  }
  return question;
}

function ensureInProgress(session: QuizSession) {
  if (session.status !== "IN_PROGRESS") {
    throw badRequest("Sessão de quiz já finalizada");
  }
}

type StartInput = { quizType: QuizType; characterId?: number | null; questionLimit?: number | null };

export async function startSession(user: User, input: StartInput) {
  const settings = await getSettings(prisma);
  const maxQuestions = settings.maxQuestionsPerMatch;
  const requested = input.questionLimit ?? Math.min(10, maxQuestions);
  const questionLimit = Math.max(1, Math.min(requested, maxQuestions));

  let characterId: number | null = null;
  if (input.quizType === "CHARACTER_STUDY") {
    if (!input.characterId) {
      throw badRequest("characterId é obrigatório no quiz de personagem");
    }
    const character = await prisma.biblicalCharacter.findUnique({ where: { id: input.characterId }, select: { id: true } });
    if (!character) {
      throw notFound("Personagem não encontrado");
    }
    characterId = character.id;
  }

  const available = await prisma.question.findMany({
    where: { active: true, ...(characterId ? { relatedCharacterId: characterId } : {}) },
    select: { id: true },
  });
  if (available.length === 0) {
    throw badRequest("Não há perguntas disponíveis para iniciar a sessão");
  }

  const selected = shuffle(available.map((question) => question.id)).slice(0, questionLimit);

  const existing = await prisma.quizSession.findFirst({ where: { userId: user.id, status: "IN_PROGRESS" }, select: { id: true } });
  if (existing) {
    throw badRequest("Já existe uma sessão de quiz em andamento para este usuário");
  }

  const now = new Date();
  let session: QuizSession;
  try {
    session = await prisma.quizSession.create({
      data: {
        userId: user.id,
        quizType: input.quizType,
        characterId,
        status: "IN_PROGRESS",
        startedAt: now,
        totalQuestions: selected.length,
        currentQuestionIndex: 0,
        livesRemaining: settings.startingLives,
        xpMultiplier: 1,
        questionIds: selected,
        currentQuestionStartedAt: now,
        currentQuestionExtraSeconds: 0,
      },
    });
  } catch (error) {
    // Índice único parcial: outra aba abriu uma partida no mesmo instante.
    if ((error as { code?: string }).code === "P2002") {
      throw badRequest("Já existe uma sessão de quiz em andamento para este usuário");
    }
    throw error;
  }

  return toStatusResponse(session, await getCurrentQuestion(prisma, session));
}

export async function getSessionStatus(user: User, sessionId: number) {
  const session = await getOwnedSession(prisma, sessionId, user.id);
  const question = session.status === "IN_PROGRESS" ? await getCurrentQuestion(prisma, session) : null;
  return toStatusResponse(session, question);
}

export async function getActiveSession(user: User) {
  const session = await prisma.quizSession.findFirst({
    where: { userId: user.id, status: "IN_PROGRESS" },
    orderBy: { startedAt: "desc" },
  });
  if (!session) {
    throw notFound("Nenhuma sessão ativa encontrada");
  }
  return toStatusResponse(session, await getCurrentQuestion(prisma, session));
}

type AnswerInput = {
  questionId: number;
  selectedOption?: string | null;
  useExtraLife?: boolean | null;
  useXpMultiplier?: boolean | null;
};

export async function answerQuestion(userId: number, sessionId: number, input: AnswerInput) {
  return transaction(async (tx) => {
    const session = await getOwnedSession(tx, sessionId, userId, true);
    ensureInProgress(session);

    const question = await getCurrentQuestion(tx, session);
    if (question.id !== input.questionId) {
      throw badRequest("A pergunta informada não corresponde à pergunta atual da sessão");
    }

    await lockUser(tx, userId);
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const settings = await getSettings(tx);

    // Sem alternativa ou fora do prazo conta como erro, independente do que o cliente enviou.
    const timedOut = !input.selectedOption || isTimeExpired(timerOf(session, question));
    const correct = !timedOut && question.correctOption.toUpperCase() === input.selectedOption!.toUpperCase();

    const userChanges: Prisma.UserUpdateInput = {};
    let extraLifeApplied = false;

    if (!correct && input.useExtraLife) {
      if (session.extraLifeUsed) throw badRequest("Bônus de vida extra já foi usado nesta partida");
      if (user.extraLifeBoosts <= 0) throw badRequest("Você não possui bônus de vida extra");
      userChanges.extraLifeBoosts = user.extraLifeBoosts - 1;
      session.extraLifeUsed = true;
      extraLifeApplied = true;
    }

    if (input.useXpMultiplier) {
      if (session.xpMultiplierUsed) throw badRequest("Bônus de XP em dobro já foi usado nesta partida");
      if (user.doubleXpBoosts <= 0) throw badRequest("Você não possui bônus de XP em dobro");
      userChanges.doubleXpBoosts = user.doubleXpBoosts - 1;
      session.xpMultiplier = settings.doubleXpMultiplier;
      session.xpMultiplierUsed = true;
    }

    if (correct) {
      session.correctAnswers += 1;
    } else {
      session.wrongAnswers += 1;
      if (!extraLifeApplied) {
        session.livesRemaining -= 1;
      }
    }

    session.currentQuestionIndex += 1;
    session.currentQuestionStartedAt = new Date();
    session.currentQuestionExtraSeconds = 0;

    const finished = session.livesRemaining <= 0 || session.currentQuestionIndex >= session.totalQuestions;
    if (finished) {
      session.status = "FINISHED";
      session.finishedAt = new Date();
    }

    const updatedUser = Object.keys(userChanges).length > 0 ? await tx.user.update({ where: { id: userId }, data: userChanges }) : user;
    const saved = await tx.quizSession.update({
      where: { id: session.id },
      data: {
        correctAnswers: session.correctAnswers,
        wrongAnswers: session.wrongAnswers,
        livesRemaining: session.livesRemaining,
        currentQuestionIndex: session.currentQuestionIndex,
        currentQuestionStartedAt: session.currentQuestionStartedAt,
        currentQuestionExtraSeconds: 0,
        extraLifeUsed: session.extraLifeUsed,
        xpMultiplier: session.xpMultiplier,
        xpMultiplierUsed: session.xpMultiplierUsed,
        status: session.status,
        finishedAt: session.finishedAt,
      },
    });

    const matchResult = finished
      ? await finalizeMatch(tx, updatedUser, settings, {
          quizType: saved.quizType,
          questionsAnswered: saved.currentQuestionIndex,
          correctAnswers: saved.correctAnswers,
          wrongAnswers: saved.wrongAnswers,
          characterId: saved.characterId,
          xpMultiplier: saved.xpMultiplier,
          startedAt: saved.startedAt,
        })
      : null;

    const nextQuestion = finished ? null : toQuestionView(saved, await getCurrentQuestion(tx, saved));

    return {
      correct,
      timedOut,
      livesRemaining: Math.max(saved.livesRemaining, 0),
      correctAnswers: saved.correctAnswers,
      wrongAnswers: saved.wrongAnswers,
      finished,
      extraTimeUsed: saved.extraTimeUsed,
      extraLifeUsed: saved.extraLifeUsed,
      xpMultiplierUsed: saved.xpMultiplierUsed,
      nextQuestion,
      matchResult,
    };
  });
}

/** Consome um bônus de tempo extra e estende o prazo da pergunta atual. */
export async function useExtraTime(userId: number, sessionId: number) {
  return transaction(async (tx) => {
    const session = await getOwnedSession(tx, sessionId, userId, true);
    ensureInProgress(session);
    if (session.extraTimeUsed) {
      throw badRequest("Bônus de tempo extra já foi usado nesta partida");
    }

    await lockUser(tx, userId);
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.extraTimeBoosts <= 0) {
      throw badRequest("Você não possui bônus de tempo extra");
    }

    const question = await getCurrentQuestion(tx, session);
    if (isTimeExpired(timerOf(session, question))) {
      throw badRequest("O tempo desta pergunta já acabou");
    }

    const settings = await getSettings(tx);
    await tx.user.update({ where: { id: userId }, data: { extraTimeBoosts: user.extraTimeBoosts - 1 } });
    const saved = await tx.quizSession.update({
      where: { id: session.id },
      data: { extraTimeUsed: true, currentQuestionExtraSeconds: session.currentQuestionExtraSeconds + settings.extraTimeSeconds },
    });

    return toStatusResponse(saved, question);
  });
}

export async function abandonSession(userId: number, sessionId: number) {
  return transaction(async (tx) => {
    const session = await getOwnedSession(tx, sessionId, userId, true);
    if (session.status !== "IN_PROGRESS") {
      throw badRequest("Apenas sessões em andamento podem ser abandonadas");
    }
    const saved = await tx.quizSession.update({
      where: { id: session.id },
      data: { status: "ABANDONED", finishedAt: new Date() },
    });
    return toStatusResponse(saved, null);
  });
}

export async function getHistory(userId: number, limit: number) {
  const take = Math.max(1, Math.min(limit, 100));
  const [sessions, matches] = await Promise.all([
    prisma.quizSession.findMany({ where: { userId }, orderBy: { startedAt: "desc" }, take }),
    prisma.quizMatch.findMany({ where: { userId }, orderBy: { finishedAt: "desc" }, take }),
  ]);

  return {
    sessions: sessions.map((session) => ({
      sessionId: session.id,
      quizType: session.quizType,
      status: session.status,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      totalQuestions: session.totalQuestions,
      correctAnswers: session.correctAnswers,
      wrongAnswers: session.wrongAnswers,
      livesRemaining: session.livesRemaining,
    })),
    matches: matches.map((match) => ({
      matchId: match.id,
      quizType: match.quizType,
      startedAt: match.startedAt,
      finishedAt: match.finishedAt,
      questionsAnswered: match.questionsAnswered,
      correctAnswers: match.correctAnswers,
      wrongAnswers: match.wrongAnswers,
      xpGained: match.xpGained,
      scoreGained: match.scoreGained,
      rewardGranted: match.rewardGranted,
      rewardGrantedName: match.rewardGrantedName,
    })),
  };
}

// ---------------------------------------------------------------------------
// Fim da partida: XP, pontos, nível e prêmio
// ---------------------------------------------------------------------------

type MatchStats = {
  quizType: QuizType;
  questionsAnswered: number;
  correctAnswers: number;
  wrongAnswers: number;
  characterId: number | null;
  xpMultiplier: number;
  startedAt: Date;
};

async function rewardedMatchesToday(tx: Tx, userId: number) {
  const { start, end } = dayRangeInTimeZone(new Date(), env.timezone);
  return tx.quizMatch.count({
    where: { userId, quizType: "GENERAL", rewardGranted: true, finishedAt: { gte: start, lt: end } },
  });
}

export async function finalizeMatch(tx: Tx, user: User, settings: GameSettings, stats: MatchStats, random: () => number = Math.random) {
  let xp = calculateXp(stats.correctAnswers, stats.questionsAnswered, stats.xpMultiplier);
  const score = calculateScore(stats.correctAnswers, stats.wrongAnswers);

  let rewardGranted = false;
  let rewardName: string | null = null;
  let rewardType: string | null = null;
  let rewardCharacterId: number | null = null;
  let rewardCharacterName: string | null = null;
  let rewardCharacterRarity: string | null = null;
  let rewardCharacterUnlocked = false;

  if (stats.quizType === "CHARACTER_STUDY") {
    xp = applyCharacterStudyPercent(xp, settings.characterStudyXpPercent);

    // A figurinha do personagem só é liberada com aproveitamento mínimo.
    if (stats.characterId && reachedStickerAccuracy(stats.correctAnswers, stats.questionsAnswered, settings.characterStickerMinAccuracyPercent)) {
      const character = await tx.biblicalCharacter.findUnique({ where: { id: stats.characterId } });
      if (character) {
        rewardType = "STICKER";
        rewardCharacterId = character.id;
        rewardCharacterName = character.name;
        rewardCharacterRarity = character.rarity;
        rewardCharacterUnlocked = await grantStickerIfMissing(tx, user.id, character.id);
      }
    }
  }

  const wallet = {
    id: user.id,
    coins: user.coins,
    extraLifeBoosts: user.extraLifeBoosts,
    extraTimeBoosts: user.extraTimeBoosts,
    doubleXpBoosts: user.doubleXpBoosts,
  };
  const totalXp = user.xp + xp;

  const dailyLimit = settings.rewardMatchLimitPerDay;
  if (stats.quizType === "GENERAL") {
    const activeQuestions = await tx.question.count({ where: { active: true } });
    const required = requiredCorrectAnswersForReward(settings.rewardMinCorrectAnswers, activeQuestions);
    if (stats.correctAnswers >= required && (await rewardedMatchesToday(tx, user.id)) < dailyLimit) {
      const rewards = await tx.rewardDefinition.findMany({ where: { active: true }, orderBy: { id: "asc" } });
      const drawn = weightedPick(rewards, (reward) => reward.dropChance, random);
      if (drawn) {
        const applied = await applyReward(tx, wallet, drawn, settings, random);
        rewardGranted = true;
        rewardName = drawn.name;
        rewardType = applied.rewardType;
        rewardCharacterId = applied.characterId;
        rewardCharacterName = applied.characterName;
        rewardCharacterRarity = applied.characterRarity;
        rewardCharacterUnlocked = applied.characterUnlocked;
      }
    }
  }

  const updated = await tx.user.update({
    where: { id: user.id },
    data: {
      ...walletData(wallet),
      xp: totalXp,
      totalScore: user.totalScore + score,
      level: calculateLevel(totalXp),
    },
  });

  const match = await tx.quizMatch.create({
    data: {
      userId: user.id,
      quizType: stats.quizType,
      startedAt: stats.startedAt,
      finishedAt: new Date(),
      questionsAnswered: stats.questionsAnswered,
      correctAnswers: stats.correctAnswers,
      wrongAnswers: stats.wrongAnswers,
      xpGained: xp,
      scoreGained: score,
      rewardGranted,
      rewardGrantedName: rewardName,
    },
  });

  return {
    matchId: match.id,
    xpGained: xp,
    scoreGained: score,
    rewardGranted,
    rewardName,
    rewardType,
    rewardCharacterId,
    rewardCharacterName,
    rewardCharacterRarity,
    rewardCharacterUnlocked,
    userXp: updated.xp,
    userLevel: updated.level,
    userCoins: updated.coins,
    rewardMatchesUsedToday: await rewardedMatchesToday(tx, user.id),
    rewardMatchesLimitPerDay: dailyLimit,
  };
}
