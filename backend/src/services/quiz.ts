import type { Prisma, Question, QuizSession, QuizType, User } from "@prisma/client";
import { lockUser, prisma, transaction, type Db } from "../db/prisma";
import { badRequest, notFound } from "../lib/errors";
import { env } from "../lib/env";
import {
  availableSeconds,
  calculateLevel,
  calculateMatchCoins,
  dailyChallengeQuestionIds,
  dayKeyInTimeZone,
  pityActive,
  calculateScore,
  calculateXp,
  comboBonus,
  crowdPercentages,
  applyDailyXpLimit,
  CHEST_BONUS_COINS,
  DIAMOND_COSMETIC_CHANCE,
  chestRewardWeight,
  chestTierFor,
  type ChestTier,
  dayRangeInTimeZone,
  isCampaignOnlyRarity,
  multiplyCoins,
  pickGeneralQuestionIds,
  nextCombo,
  isTimeExpired,
  pickFiftyFiftyRemovals,
  remainingSeconds,
  requiredCorrectAnswersForReward,
  shuffle,
  studyStatus,
  weightedPick,
} from "./game-rules";
import { currentScenarioIdFor } from "./campaign";
import { checkAchievements } from "./achievements";
import { applyReward, availableRewards, grantStickerIfMissing, walletData } from "./rewards";
import { getSettings, type GameSettings } from "./settings";
import { pageOf } from "../lib/pagination";
import { visibleCharacter } from "./visibility";
import { activeEvent } from "./events";
import { checkCosmetics, grantCosmetic, playerLooks } from "./cosmetics";
import { CHEST_BOOSTS as CHEST_HELPERS } from "./progression";
import type { HelperField } from "./helpers";

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

/** Ampulheta: a pergunta congelada não tem prazo. */
function expired(session: QuizSession, question: Question) {
  return session.frozenQuestionId !== question.id && isTimeExpired(timerOf(session, question));
}

function removedOptionsOf(session: QuizSession, question: Question): string[] {
  const removed = session.fiftyFiftyQuestionId === question.id && session.fiftyFiftyRemoved ? session.fiftyFiftyRemoved.split("") : [];
  if (session.secondChanceQuestionId === question.id && session.secondChanceRemoved) removed.push(session.secondChanceRemoved);
  return removed;
}

function toQuestionView(session: QuizSession, question: Question) {
  const timer = timerOf(session, question);
  const removedOptions = removedOptionsOf(session, question);
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
    // Alternativas eliminadas pela dica 50/50 ou já tentadas com a segunda chance.
    removedOptions,
    timeFrozen: session.frozenQuestionId === question.id,
    hasVerseHint: Boolean(question.bibleReference?.trim()),
    verseHint: session.verseHintQuestionId === question.id ? question.bibleReference : null,
    crowd:
      session.crowdQuestionId === question.id
        ? crowdPercentages({ A: question.answersA, B: question.answersB, C: question.answersC, D: question.answersD }, question.correctOption, question.difficulty, removedOptions)
        : null,
    secondChanceArmed: session.secondChanceQuestionId === question.id && !session.secondChanceRemoved,
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
    fiftyFiftyUsed: session.fiftyFiftyUsed,
    skipUsed: session.skipUsed,
    secondChanceUsed: session.secondChanceUsed,
    crowdUsed: session.crowdUsed,
    verseHintUsed: session.verseHintUsed,
    freezeUsed: session.freezeUsed,
    doubleCoinsUsed: session.doubleCoinsUsed,
    comboShieldUsed: session.comboShieldUsed,
    comboShieldArmed: session.comboShieldArmed,
    comboStreak: session.comboStreak,
    bestCombo: session.bestCombo,
    comboPoints: session.comboPoints,
    characterId: session.characterId,
    training: session.training,
    marathon: session.quizType === "GENERAL" && !session.training,
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

/**
 * O cronômetro de cada pergunta só começa quando ela é mostrada: depois de
 * responder, o jogador vê o gabarito com calma e pede a próxima.
 */
async function ensureQuestionStarted(db: Db, session: QuizSession): Promise<QuizSession> {
  if (session.status !== "IN_PROGRESS" || session.currentQuestionStartedAt) {
    return session;
  }
  return db.quizSession.update({ where: { id: session.id }, data: { currentQuestionStartedAt: new Date() } });
}

function ensureInProgress(session: QuizSession) {
  if (session.status !== "IN_PROGRESS") {
    throw badRequest("Sessão de quiz já finalizada");
  }
}

type StartInput = { quizType: QuizType; characterId?: number | null; questionLimit?: number | null; training?: boolean | null };

export async function startSession(user: User, input: StartInput) {
  const settings = await getSettings(prisma);
  const maxQuestions = settings.maxQuestionsPerMatch;
  const requested = input.questionLimit ?? Math.min(10, maxQuestions);
  // Quiz geral sem treino é a maratona: sorteia o máximo de perguntas e acaba quando as vidas zeram.
  const marathon = input.quizType === "GENERAL" && !input.training;
  const questionLimit = marathon ? maxQuestions : Math.max(1, Math.min(requested, maxQuestions));

  let characterId: number | null = null;
  if (input.quizType === "CHARACTER_STUDY") {
    if (!input.characterId) {
      throw badRequest("characterId é obrigatório no quiz de personagem");
    }
    const character = await prisma.biblicalCharacter.findFirst({ where: { id: input.characterId, ...visibleCharacter() }, select: { id: true } });
    if (!character) {
      throw notFound("Personagem não encontrado");
    }
    // O estudo é só para quem já tem a figurinha: não libera nada, apenas acumula acertos.
    const owned = await prisma.userSticker.findUnique({ where: { userId_characterId: { userId: user.id, characterId: character.id } }, select: { id: true } });
    if (!owned) {
      throw badRequest("Conquiste a figurinha deste personagem para estudá-lo");
    }
    characterId = character.id;
  }

  const available = await prisma.question.findMany({
    where: { active: true, ...(characterId ? { relatedCharacterId: characterId } : {}) },
    select: { id: true },
  });
  if (available.length === 0) {
    throw badRequest(characterId ? "Este personagem ainda não tem perguntas. Escolha outro." : "Não há perguntas disponíveis para iniciar a sessão");
  }

  let selected: number[];
  if (input.quizType === "DAILY_CHALLENGE") {
    // Uma tentativa por dia (abandonar também conta) e as mesmas perguntas para todos.
    const { start, end } = dayRangeInTimeZone(new Date(), env.timezone);
    const played = await prisma.quizSession.count({ where: { userId: user.id, quizType: "DAILY_CHALLENGE", startedAt: { gte: start, lt: end } } });
    if (played > 0) {
      throw badRequest("Você já fez o desafio de hoje. Volte amanhã para um novo!");
    }
    selected = dailyChallengeQuestionIds(
      available.map((question) => question.id),
      dayKeyInTimeZone(new Date(), env.timezone),
      settings.dailyChallengeQuestions,
    );
  } else {
    const scenarioId = input.quizType === "GENERAL" ? await currentScenarioIdFor(prisma, user.id) : null;
    const scenarioIds = scenarioId ? new Set((await prisma.question.findMany({ where: { active: true, scenarioId }, select: { id: true } })).map((question) => question.id)) : new Set<number>();
    selected = pickGeneralQuestionIds(
      available.filter((question) => scenarioIds.has(question.id)).map((question) => question.id),
      available.filter((question) => !scenarioIds.has(question.id)).map((question) => question.id),
      questionLimit,
    );
  }

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
        training: input.quizType === "GENERAL" && Boolean(input.training),
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
  const session = await ensureQuestionStarted(prisma, await getOwnedSession(prisma, sessionId, user.id));
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
  const started = await ensureQuestionStarted(prisma, session);
  return toStatusResponse(started, await getCurrentQuestion(prisma, started));
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
    const timedOut = !input.selectedOption || expired(session, question);
    const selected = input.selectedOption?.toUpperCase() ?? null;
    if (!timedOut && selected && removedOptionsOf(session, question).includes(selected)) {
      throw badRequest("Essa alternativa já foi eliminada");
    }
    const correct = !timedOut && question.correctOption.toUpperCase() === selected;

    // Segunda chance armada: o primeiro erro não conta, a alternativa sai e o jogador tenta de novo.
    if (!correct && !timedOut && selected && session.secondChanceQuestionId === question.id && !session.secondChanceRemoved) {
      const saved = await tx.quizSession.update({ where: { id: session.id }, data: { secondChanceRemoved: selected } });
      return {
        retry: true,
        removedOption: selected,
        correct: false,
        timedOut: false,
        livesRemaining: saved.livesRemaining,
        correctAnswers: saved.correctAnswers,
        wrongAnswers: saved.wrongAnswers,
        finished: false,
        comboStreak: saved.comboStreak,
        hasNextQuestion: true,
        session: toStatusResponse(saved, question),
      };
    }

    // Estatística da pergunta: taxa de acerto (calibrar dificuldade) e votos por alternativa (voz da multidão).
    const voteField = selected && !timedOut ? ({ A: "answersA", B: "answersB", C: "answersC", D: "answersD" } as const)[selected as "A" | "B" | "C" | "D"] : undefined;
    await tx.question.update({
      where: { id: question.id },
      data: { timesAnswered: { increment: 1 }, ...(correct ? { timesCorrect: { increment: 1 } } : {}), ...(voteField ? { [voteField]: { increment: 1 } } : {}) },
    });

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

    // Sequência de acertos: bônus a partir do N-ésimo acerto seguido; o escudo segura um erro.
    const combo = nextCombo(session.comboStreak, correct, session.comboShieldArmed);
    session.comboStreak = combo.streak;
    if (combo.shieldSpent) session.comboShieldArmed = false;
    session.bestCombo = Math.max(session.bestCombo, session.comboStreak);
    const bonus = correct ? comboBonus(session.comboStreak, settings) : { points: 0, coins: 0 };
    session.comboPoints += bonus.points;
    session.comboCoins += bonus.coins;

    if (correct) {
      session.correctAnswers += 1;
    } else {
      session.wrongAnswers += 1;
      if (!extraLifeApplied) {
        session.livesRemaining -= 1;
      }
    }

    session.currentQuestionIndex += 1;
    // A próxima pergunta só começa a contar quando for pedida (POST /next).
    session.currentQuestionStartedAt = null;
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
        comboStreak: session.comboStreak,
        bestCombo: session.bestCombo,
        comboPoints: session.comboPoints,
        comboCoins: session.comboCoins,
        comboShieldArmed: session.comboShieldArmed,
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
          training: saved.training,
          xpMultiplier: saved.xpMultiplier,
          startedAt: saved.startedAt,
          comboPoints: saved.comboPoints,
          comboCoins: saved.comboCoins,
          bestCombo: saved.bestCombo,
          coinMultiplier: saved.doubleCoinsUsed ? settings.doubleCoinsMultiplier : 1,
        })
      : null;

    return {
      retry: false,
      correct,
      timedOut,
      comboStreak: saved.comboStreak,
      comboBonusPoints: bonus.points,
      comboShieldSpent: combo.shieldSpent,
      livesRemaining: Math.max(saved.livesRemaining, 0),
      correctAnswers: saved.correctAnswers,
      wrongAnswers: saved.wrongAnswers,
      finished,
      extraTimeUsed: saved.extraTimeUsed,
      extraLifeUsed: saved.extraLifeUsed,
      xpMultiplierUsed: saved.xpMultiplierUsed,
      // A resposta já foi registrada: pode mostrar o gabarito e a explicação.
      correctOption: question.correctOption,
      explanation: question.explanation,
      bibleReference: question.bibleReference,
      fiftyFiftyUsed: saved.fiftyFiftyUsed,
      hasNextQuestion: !finished,
      matchResult,
    };
  });
}

/** Mostra a próxima pergunta e inicia o cronômetro dela. */
export async function nextQuestion(userId: number, sessionId: number) {
  return transaction(async (tx) => {
    const session = await getOwnedSession(tx, sessionId, userId, true);
    ensureInProgress(session);
    const started = await ensureQuestionStarted(tx, session);
    return toStatusResponse(started, await getCurrentQuestion(tx, started));
  });
}

/** Consome uma dica 50/50 e elimina duas alternativas erradas da pergunta atual. */
export async function useFiftyFifty(userId: number, sessionId: number) {
  return transaction(async (tx) => {
    const session = await getOwnedSession(tx, sessionId, userId, true);
    ensureInProgress(session);
    if (session.fiftyFiftyUsed) {
      throw badRequest("A dica 50/50 já foi usada nesta partida");
    }

    await lockUser(tx, userId);
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.hintBoosts <= 0) {
      throw badRequest("Você não possui dicas 50/50");
    }

    const question = await getCurrentQuestion(tx, session);
    if (expired(session, question)) {
      throw badRequest("O tempo desta pergunta já acabou");
    }

    await tx.user.update({ where: { id: userId }, data: { hintBoosts: user.hintBoosts - 1 } });
    const saved = await tx.quizSession.update({
      where: { id: session.id },
      data: { fiftyFiftyUsed: true, fiftyFiftyQuestionId: question.id, fiftyFiftyRemoved: pickFiftyFiftyRemovals(question.correctOption).join("") },
    });
    return toStatusResponse(saved, question);
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
    if (expired(session, question)) {
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

type HelperUse = {
  field: HelperField;
  /** Já usado nesta partida? */
  used: (session: QuizSession) => boolean;
  usedMessage: string;
  missingMessage: string;
  /** Não deixa usar com o tempo da pergunta esgotado. */
  needsTime?: boolean;
  apply: (tx: Tx, session: QuizSession, question: Question, settings: GameSettings) => Promise<Prisma.QuizSessionUpdateInput>;
};

/** Gasta uma ajuda do inventário e aplica o efeito na pergunta atual (uma vez por partida). */
async function useHelper(userId: number, sessionId: number, helper: HelperUse) {
  return transaction(async (tx) => {
    const session = await getOwnedSession(tx, sessionId, userId, true);
    ensureInProgress(session);
    if (helper.used(session)) throw badRequest(helper.usedMessage);

    await lockUser(tx, userId);
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user[helper.field] <= 0) throw badRequest(helper.missingMessage);

    const question = await getCurrentQuestion(tx, session);
    if (helper.needsTime !== false && expired(session, question)) throw badRequest("O tempo desta pergunta já acabou");

    const settings = await getSettings(tx);
    const data = await helper.apply(tx, session, question, settings);
    await tx.user.update({ where: { id: userId }, data: { [helper.field]: user[helper.field] - 1 } });
    const saved = await tx.quizSession.update({ where: { id: session.id }, data });
    const current = await getCurrentQuestion(tx, saved);
    return toStatusResponse(saved, current);
  });
}

/** Pular: troca a pergunta atual por outra ainda não sorteada, sem perder vida. */
export const skipQuestion = (userId: number, sessionId: number) =>
  useHelper(userId, sessionId, {
    field: "skipBoosts",
    used: (session) => session.skipUsed,
    usedMessage: "Você já pulou uma pergunta nesta partida",
    missingMessage: "Você não tem \"pular pergunta\"",
    apply: async (tx, session) => {
      if (session.quizType === "DAILY_CHALLENGE") throw badRequest("No desafio do dia todos respondem as mesmas perguntas: não dá para pular");
      const candidates = await tx.question.findMany({
        where: { active: true, id: { notIn: session.questionIds }, ...(session.characterId ? { relatedCharacterId: session.characterId } : {}) },
        select: { id: true },
      });
      if (candidates.length === 0) throw badRequest("Não há outra pergunta disponível para trocar");
      const replacement = candidates[Math.floor(Math.random() * candidates.length)].id;
      const questionIds = [...session.questionIds];
      questionIds[session.currentQuestionIndex] = replacement;
      return { skipUsed: true, questionIds, currentQuestionStartedAt: new Date(), currentQuestionExtraSeconds: 0 };
    },
  });

/** Segunda chance: armada na pergunta atual; o primeiro erro nela não conta. */
export const armSecondChance = (userId: number, sessionId: number) =>
  useHelper(userId, sessionId, {
    field: "secondChanceBoosts",
    used: (session) => session.secondChanceUsed,
    usedMessage: "A segunda chance já foi usada nesta partida",
    missingMessage: "Você não tem segunda chance",
    apply: async (_tx, _session, question) => ({ secondChanceUsed: true, secondChanceQuestionId: question.id, secondChanceRemoved: null }),
  });

/** Voz da multidão: mostra o % de cada alternativa na pergunta atual. */
export const useCrowd = (userId: number, sessionId: number) =>
  useHelper(userId, sessionId, {
    field: "crowdBoosts",
    used: (session) => session.crowdUsed,
    usedMessage: "A voz da multidão já foi usada nesta partida",
    missingMessage: "Você não tem \"voz da multidão\"",
    apply: async (_tx, _session, question) => ({ crowdUsed: true, crowdQuestionId: question.id }),
  });

/** Pista do versículo: mostra a referência bíblica da pergunta (só se ela tiver uma). */
export const useVerseHint = (userId: number, sessionId: number) =>
  useHelper(userId, sessionId, {
    field: "verseHintBoosts",
    used: (session) => session.verseHintUsed,
    usedMessage: "A pista do versículo já foi usada nesta partida",
    missingMessage: "Você não tem pista do versículo",
    apply: async (_tx, _session, question) => {
      if (!question.bibleReference?.trim()) throw badRequest("Esta pergunta não tem pista de versículo");
      return { verseHintUsed: true, verseHintQuestionId: question.id };
    },
  });

/** Ampulheta: congela o cronômetro da pergunta atual. */
export const freezeTime = (userId: number, sessionId: number) =>
  useHelper(userId, sessionId, {
    field: "freezeTimeBoosts",
    used: (session) => session.freezeUsed,
    usedMessage: "A ampulheta já foi usada nesta partida",
    missingMessage: "Você não tem ampulheta",
    apply: async (_tx, _session, question) => ({ freezeUsed: true, frozenQuestionId: question.id }),
  });

/** Bênção dobrada: as moedas desta partida saem multiplicadas no fim. */
export const useDoubleCoins = (userId: number, sessionId: number) =>
  useHelper(userId, sessionId, {
    field: "doubleCoinsBoosts",
    used: (session) => session.doubleCoinsUsed,
    usedMessage: "A bênção dobrada já está ativa nesta partida",
    missingMessage: "Você não tem bênção dobrada",
    needsTime: false,
    apply: async () => ({ doubleCoinsUsed: true }),
  });

/** Escudo de sequência: o próximo erro não zera a sequência de acertos. */
export const armComboShield = (userId: number, sessionId: number) =>
  useHelper(userId, sessionId, {
    field: "comboShieldBoosts",
    used: (session) => session.comboShieldUsed,
    usedMessage: "O escudo de sequência já foi usado nesta partida",
    missingMessage: "Você não tem escudo de sequência",
    needsTime: false,
    apply: async () => ({ comboShieldUsed: true, comboShieldArmed: true }),
  });

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

/** Histórico paginado das partidas terminadas. */
export async function getMatchesPage(userId: number, page: number, size: number) {
  const take = Math.max(1, Math.min(size, 50));
  const skip = Math.max(0, page) * take;
  const [matches, total] = await Promise.all([
    prisma.quizMatch.findMany({ where: { userId }, orderBy: { finishedAt: "desc" }, skip, take }),
    prisma.quizMatch.count({ where: { userId } }),
  ]);
  return pageOf(
    matches.map((match) => ({
      matchId: match.id,
      quizType: match.quizType,
      startedAt: match.startedAt,
      finishedAt: match.finishedAt,
      questionsAnswered: match.questionsAnswered,
      correctAnswers: match.correctAnswers,
      wrongAnswers: match.wrongAnswers,
      xpGained: match.xpGained,
      scoreGained: match.scoreGained,
      coinsGained: match.coinsGained,
      rewardGranted: match.rewardGranted,
      rewardGrantedName: match.rewardGrantedName,
    })),
    total,
    Math.max(0, page),
    take,
  );
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
      coinsGained: match.coinsGained,
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
  /** Treino do quiz geral: não rende baú. */
  training?: boolean;
  xpMultiplier: number;
  startedAt: Date;
  comboPoints?: number;
  comboCoins?: number;
  bestCombo?: number;
  /** Bênção dobrada. */
  coinMultiplier?: number;
};

async function rewardedMatchesToday(tx: Tx, userId: number) {
  const { start, end } = dayRangeInTimeZone(new Date(), env.timezone);
  return tx.quizMatch.count({
    where: { userId, quizType: "GENERAL", rewardGranted: true, finishedAt: { gte: start, lt: end } },
  });
}

async function diamondChestsToday(tx: Tx, userId: number) {
  const { start, end } = dayRangeInTimeZone(new Date(), env.timezone);
  return tx.quizMatch.count({ where: { userId, chestTier: "DIAMOND", finishedAt: { gte: start, lt: end } } });
}

async function coinMatchesToday(tx: Tx, userId: number) {
  const { start, end } = dayRangeInTimeZone(new Date(), env.timezone);
  return tx.quizMatch.count({ where: { userId, coinsGained: { gt: 0 }, finishedAt: { gte: start, lt: end } } });
}

export async function finalizeMatch(tx: Tx, user: User, settings: GameSettings, stats: MatchStats, random: () => number = Math.random) {
  const event = await activeEvent(tx);
  // Estudo de personagem não rende XP, pontos, moedas nem prêmios: só acumula acertos (status do personagem).
  const isStudy = stats.quizType === "CHARACTER_STUDY";
  let xp = isStudy ? 0 : calculateXp(stats.correctAnswers, stats.questionsAnswered, stats.xpMultiplier);
  const score = isStudy ? 0 : calculateScore(stats.correctAnswers, stats.wrongAnswers) + (stats.comboPoints ?? 0);

  let rewardGranted = false;
  let rewardName: string | null = null;
  let rewardType: string | null = null;
  let rewardCharacterId: number | null = null;
  let rewardCharacterName: string | null = null;
  let rewardCharacterRarity: string | null = null;
  let rewardCharacterImageUrl: string | null = null;
  let rewardCharacterUnlocked = false;
  let rewardDuplicate = false;
  let pityGuaranteed = false;
  let stickerPity = user.stickerPity;

  let study: ReturnType<typeof studyStatus> | null = null;
  let studyLevelUp = false;
  if (isStudy && stats.characterId) {
    const before = await tx.characterStudy.findUnique({ where: { userId_characterId: { userId: user.id, characterId: stats.characterId } } });
    const saved = await tx.characterStudy.upsert({
      where: { userId_characterId: { userId: user.id, characterId: stats.characterId } },
      create: { userId: user.id, characterId: stats.characterId, correctAnswers: stats.correctAnswers, questionsAnswered: stats.questionsAnswered },
      update: { correctAnswers: { increment: stats.correctAnswers }, questionsAnswered: { increment: stats.questionsAnswered } },
    });
    study = studyStatus(saved.correctAnswers);
    studyLevelUp = study.level > studyStatus(before?.correctAnswers ?? 0).level;
  }

  // Freio diário: depois das primeiras partidas do dia o XP cai (não vale para o estudo, que não dá XP).
  let xpReduced = false;
  if (!isStudy && settings.xpFullMatchesPerDay > 0) {
    const { start, end } = dayRangeInTimeZone(new Date(), env.timezone);
    const playedToday = await tx.quizMatch.count({ where: { userId: user.id, quizType: { not: "CHARACTER_STUDY" }, finishedAt: { gte: start, lt: end } } });
    const limited = applyDailyXpLimit(xp, playedToday, settings.xpFullMatchesPerDay, settings.xpAfterLimitPercent);
    xpReduced = limited < xp;
    xp = limited;
  }

  // Evento ativo multiplica o XP da partida.
  if (event && event.xpMultiplier > 1) xp = Math.round(xp * event.xpMultiplier);

  const wallet = { ...user };
  const totalXp = user.xp + xp;

  // Moedas por acerto: toda partida conta, até o limite diário (evita "farmar" o mesmo quiz).
  let coinsGained = 0;
  if (!isStudy && stats.correctAnswers > 0 && (await coinMatchesToday(tx, user.id)) < settings.coinMatchLimitPerDay) {
    coinsGained = calculateMatchCoins(stats.correctAnswers, stats.wrongAnswers, settings) + (stats.comboCoins ?? 0);
    coinsGained = multiplyCoins(coinsGained, stats.coinMultiplier ?? 1, event?.coinMultiplier ?? 1);
    wallet.coins += coinsGained;
  }

  const dailyLimit = settings.rewardMatchLimitPerDay;
  // Baú da partida: só no quiz geral em maratona (o treino não rende). O nível vem dos acertos.
  let chestTier: ChestTier | null = null;
  let chestCoins = 0;
  const chestExtras: { helperName: string | null; cosmeticName: string | null } = { helperName: null, cosmeticName: null };
  if (stats.quizType === "GENERAL" && !stats.training) {
    const activeQuestions = await tx.question.count({ where: { active: true } });
    const required = requiredCorrectAnswersForReward(settings.rewardMinCorrectAnswers, activeQuestions);
    let tier = chestTierFor(stats.correctAnswers, required, settings.chestSilverMinCorrect, settings.chestGoldMinCorrect, settings.chestDiamondMinCorrect);
    // Diamante tem limite próprio por dia; acima dele, vira ouro.
    if (tier === "DIAMOND" && (settings.chestDiamondLimitPerDay <= 0 || (await diamondChestsToday(tx, user.id)) >= settings.chestDiamondLimitPerDay)) tier = "GOLD";
    if (tier && (await rewardedMatchesToday(tx, user.id)) < dailyLimit) {
      const rewards = await availableRewards(tx, await tx.rewardDefinition.findMany({ where: { active: true }, orderBy: { id: "asc" } }));
      // Garantia contra azar: depois de N baús sem figurinha, só concorrem figurinhas.
      const stickerRewards = rewards.filter((reward) => reward.rewardType === "STICKER" || reward.rewardType === "STICKER_PACK");
      pityGuaranteed = pityActive(stickerPity, settings.pityThreshold) && stickerRewards.length > 0;
      const pool = pityGuaranteed ? stickerRewards : rewards;
      // Ouro e diamante só dão figurinha; se não houver nenhuma disponível, cai no sorteio comum.
      const stickerOnly = (level: ChestTier) => (level === "GOLD" || level === "DIAMOND") && stickerRewards.length > 0;
      const draw = (level: ChestTier) => weightedPick(stickerOnly(level) ? stickerRewards : pool, (reward) => chestRewardWeight(level, reward), random);
      let drawn = draw(tier);
      // Sem figurinha épica/lendária publicada, o diamante vira ouro.
      if (!drawn && tier === "DIAMOND") {
        tier = "GOLD";
        drawn = draw(tier);
      }
      drawn ??= weightedPick(pool, (reward) => reward.dropChance, random);
      if (drawn) {
        chestTier = tier;
        chestCoins = CHEST_BONUS_COINS[tier];
        wallet.coins += chestCoins;
        const applied = await applyReward(tx, wallet, drawn, settings, random);
        rewardGranted = true;
        rewardName = drawn.name;
        rewardType = applied.rewardType;
        rewardCharacterId = applied.characterId;
        rewardCharacterName = applied.characterName;
        rewardCharacterRarity = applied.characterRarity;
        rewardCharacterImageUrl = applied.characterImageUrl;
        rewardCharacterUnlocked = applied.characterUnlocked;
        rewardDuplicate = applied.duplicate;
        stickerPity = applied.characterId ? 0 : stickerPity + 1;

        if (tier === "DIAMOND") {
          // Extras do diamante: uma ajuda sortida (se couber) e, às vezes, um item visual raro.
          const room = CHEST_HELPERS.filter((helper) => wallet[helper.field] < settings[helper.maxSetting]);
          const helper = room.length > 0 ? room[Math.floor(random() * room.length)] : null;
          if (helper) {
            wallet[helper.field] += 1;
            chestExtras.helperName = helper.name;
          }
          if (random() * 100 < DIAMOND_COSMETIC_CHANCE) {
            const options = await tx.cosmetic.findMany({ where: { active: true, inChestPool: true, rarity: { in: ["RARE", "EPIC"] }, owners: { none: { userId: user.id } } } });
            const cosmetic = options.length > 0 ? options[Math.floor(random() * options.length)] : null;
            if (cosmetic && (await grantCosmetic(tx, user.id, cosmetic.id, "CHEST"))) chestExtras.cosmeticName = cosmetic.name;
          }
        }
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
      stickerPity,
      bestCombo: Math.max(user.bestCombo, stats.bestCombo ?? 0),
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
      coinsGained,
      rewardGranted,
      rewardGrantedName: rewardName,
      chestTier,
    },
  });

  const unlockedAchievements = await checkAchievements(tx, user.id);
  const achievementCoins = unlockedAchievements.reduce((sum, achievement) => sum + achievement.coins, 0);
  const unlockedCosmetics = await checkCosmetics(tx, user.id);

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
    rewardCharacterImageUrl,
    rewardCharacterUnlocked,
    coinsGained,
    rewardDuplicate,
    pityGuaranteed,
    // Prêmios que faltam para a figurinha garantida (null quando desligado).
    pityRemaining: settings.pityThreshold > 0 ? Math.max(1, settings.pityThreshold - stickerPity) : null,
    unlockedAchievements,
    unlockedCosmetics,
    bestCombo: stats.bestCombo ?? 0,
    comboBonusPoints: stats.comboPoints ?? 0,
    coinMultiplier: stats.coinMultiplier ?? 1,
    xpReduced,
    studyStatus: study,
    studyLevelUp,
    eventName: event && (event.xpMultiplier > 1 || event.coinMultiplier > 1) ? event.name : null,
    levelUp: updated.level > user.level,
    chestsPending: Math.max(0, updated.level - updated.chestLevel),
    userXp: updated.xp,
    userLevel: updated.level,
    userCoins: updated.coins + achievementCoins,
    chestTier,
    chestCoins,
    chestExtras,
    rewardMatchesUsedToday: await rewardedMatchesToday(tx, user.id),
    rewardMatchesLimitPerDay: dailyLimit,
  };
}

/**
 * Desafio do dia: as mesmas perguntas para todos, uma tentativa por dia.
 * Ranking por acertos e, no empate, por quem terminou mais rápido.
 */
export async function getDailyChallenge(userId: number, page: number, size: number) {
  const now = new Date();
  const { start, end } = dayRangeInTimeZone(now, env.timezone);
  const [settings, activeQuestions, attempt, matches] = await Promise.all([
    getSettings(prisma),
    prisma.question.count({ where: { active: true } }),
    prisma.quizSession.findFirst({ where: { userId, quizType: "DAILY_CHALLENGE", startedAt: { gte: start, lt: end } }, orderBy: { startedAt: "desc" } }),
    prisma.quizMatch.findMany({
      where: { quizType: "DAILY_CHALLENGE", finishedAt: { gte: start, lt: end }, user: { deleted: false, role: "USER" } },
      include: { user: { select: { name: true, level: true } } },
    }),
  ]);

  const durationOf = (match: (typeof matches)[number]) => (match.startedAt ? match.finishedAt.getTime() - match.startedAt.getTime() : Number.MAX_SAFE_INTEGER);
  const ranked = matches
    .sort((left, right) => right.correctAnswers - left.correctAnswers || durationOf(left) - durationOf(right) || left.id - right.id)
    .map((match, index) => ({
      position: index + 1,
      userId: match.userId,
      userName: match.user.name,
      level: match.user.level,
      correctAnswers: match.correctAnswers,
      questionsAnswered: match.questionsAnswered,
      seconds: Number.isFinite(durationOf(match)) ? Math.round(durationOf(match) / 1000) : null,
    }));

  const mine = ranked.find((entry) => entry.userId === userId) ?? null;
  const pageEntries = ranked.slice(page * size, page * size + size);
  const looks = await playerLooks(prisma, pageEntries.map((entry) => entry.userId));
  return {
    ...pageOf(
      pageEntries.map((entry) => ({ ...entry, look: looks.get(entry.userId) ?? null })),
      ranked.length,
      page,
      size,
    ),
    dayKey: dayKeyInTimeZone(now, env.timezone),
    endsAt: end,
    totalQuestions: Math.min(settings.dailyChallengeQuestions, activeQuestions),
    // IN_PROGRESS: começou e não terminou; FINISHED/ABANDONED: tentativa do dia já usada.
    attemptStatus: attempt?.status ?? null,
    me: mine,
  };
}
