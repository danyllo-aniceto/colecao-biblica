import { buildApiUrl } from '@/lib/api';
import type { ApiErrorResponse, UserProfile } from '@/types/auth';
import type { StickerRarity } from '@/lib/admin-api';

async function safeParseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function extractErrorMessage(payload: ApiErrorResponse | null, fallback: string) {
  return payload?.message ?? fallback;
}

async function requestJson<T>(token: string, path: string, init: RequestInit, fallbackError: string): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  const body = await safeParseJson<T & ApiErrorResponse>(response);

  if (!response.ok) {
    throw new Error(extractErrorMessage(body, fallbackError));
  }

  return body as T;
}

async function requestVoid(token: string, path: string, init: RequestInit, fallbackError: string): Promise<void> {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await safeParseJson<ApiErrorResponse>(response);
    throw new Error(extractErrorMessage(body, fallbackError));
  }
}

export type UserSticker = {
  characterId: number;
  characterName: string;
  imageUrl: string | null;
  rarity: StickerRarity;
  acquiredAt?: string;
};

export type CollectionProgress = {
  owned: number;
  total: number;
};

export type RankingEntry = {
  position: number;
  userId: number;
  userName: string;
  level: number;
  totalScore: number;
  xp: number;
};

export type CommentEntry = {
  id: number;
  characterId: number;
  characterName: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
};

export type CharacterEntry = {
  id: number;
  name: string;
  imageUrl?: string | null;
  rarity: StickerRarity;
  shortSummary: string;
  fullDescription: string;
  bibleBooks?: string | null;
  bibleReferences?: string | null;
  historicalPeriod?: string | null;
  narrativeRole?: string | null;
  genealogy?: string | null;
  curiosities?: string | null;
  importantEvents?: string | null;
  keyVerses?: string | null;
  keywords?: string | null;
};

export type QuizType = 'GENERAL' | 'CHARACTER_STUDY';

export type StartQuizSessionPayload = {
  quizType: QuizType;
  characterId?: number | null;
  questionLimit?: number | null;
};

export type QuizQuestionView = {
  id?: number;
  text: string;
  difficulty?: string;
  timeLimitSeconds: number;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
};

export type QuizSessionStatus = {
  sessionId: number;
  quizType: QuizType;
  status: string;
  totalQuestions: number;
  currentQuestionIndex: number;
  livesRemaining: number;
  correctAnswers: number;
  wrongAnswers: number;
  xpMultiplier: number;
  currentQuestion?: QuizQuestionView | null;
};

export type AnswerQuizQuestionPayload = {
  questionId: number;
  selectedOption: 'A' | 'B' | 'C' | 'D';
  useExtraTime?: boolean;
  useExtraLife?: boolean;
  useXpMultiplier?: boolean;
};

export type QuizMatchResult = {
  matchId: number;
  xpGained: number;
  scoreGained: number;
  rewardGranted: boolean;
  rewardName?: string | null;
  rewardType?: string | null;
  rewardCharacterId?: number | null;
  rewardCharacterName?: string | null;
  rewardCharacterRarity?: StickerRarity | null;
  rewardCharacterUnlocked?: boolean;
  userXp: number;
  userLevel: number;
  userCoins: number;
  rewardMatchesUsedToday: number;
  rewardMatchesLimitPerDay: number;
};

export type AnswerQuizQuestionResult = {
  correct: boolean;
  livesRemaining: number;
  correctAnswers: number;
  wrongAnswers: number;
  finished: boolean;
  nextQuestion?: QuizQuestionView | null;
  matchResult?: QuizMatchResult | null;
};

export type QuizHistory = {
  sessions: Array<{
    sessionId: number;
    quizType: QuizType;
    status: string;
    startedAt?: string;
    finishedAt?: string;
    totalQuestions: number;
    correctAnswers: number;
    wrongAnswers: number;
    livesRemaining: number;
  }>;
  matches: Array<{
    matchId: number;
    quizType: QuizType;
    startedAt?: string;
    finishedAt?: string;
    questionsAnswered: number;
    correctAnswers: number;
    wrongAnswers: number;
    xpGained: number;
    scoreGained: number;
    rewardGranted: boolean;
    rewardGrantedName?: string | null;
  }>;
};

export async function getCollection(token: string): Promise<UserSticker[]> {
  return requestJson<UserSticker[]>(token, '/collection/my', { method: 'GET' }, 'Não foi possível carregar suas figurinhas.');
}

export async function getCollectionProgress(token: string): Promise<CollectionProgress> {
  return requestJson<CollectionProgress>(token, '/collection/my/progress', { method: 'GET' }, 'Não foi possível carregar o progresso da coleção.');
}

export async function listRanking(token: string): Promise<RankingEntry[]> {
  return requestJson<RankingEntry[]>(token, '/ranking', { method: 'GET' }, 'Não foi possível carregar o ranking.');
}

export async function getMyComments(token: string): Promise<CommentEntry[]> {
  return requestJson<CommentEntry[]>(token, '/comments/my', { method: 'GET' }, 'Não foi possível carregar os comentários.');
}

export async function createComment(token: string, payload: { characterId: number; text: string }): Promise<CommentEntry> {
  return requestJson<CommentEntry>(token, '/comments', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, 'Não foi possível salvar o comentário.');
}

export async function updateComment(token: string, id: number, payload: { text: string }): Promise<CommentEntry> {
  return requestJson<CommentEntry>(token, `/comments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, 'Não foi possível atualizar o comentário.');
}

export async function listCharacters(token: string): Promise<CharacterEntry[]> {
  return requestJson<CharacterEntry[]>(token, '/characters', { method: 'GET' }, 'Não foi possível carregar os personagens.');
}

export async function getCurrentUser(token: string): Promise<UserProfile> {
  return requestJson<UserProfile>(token, '/users/me', { method: 'GET' }, 'Não foi possível carregar seu perfil.');
}

export async function updateCurrentUser(token: string, id: number, payload: { name?: string; email?: string; password?: string }): Promise<UserProfile> {
  return requestJson<UserProfile>(token, `/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, 'Não foi possível atualizar sua conta.');
}

export async function deleteCurrentUser(token: string, id: number): Promise<void> {
  return requestVoid(token, `/users/${id}`, { method: 'DELETE' }, 'Não foi possível excluir sua conta.');
}

export async function startQuizSession(token: string, payload: StartQuizSessionPayload): Promise<QuizSessionStatus> {
  return requestJson<QuizSessionStatus>(token, '/quiz/sessions/start', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, 'Não foi possível iniciar o quiz.');
}

export async function getActiveQuizSession(token: string): Promise<QuizSessionStatus> {
  return requestJson<QuizSessionStatus>(token, '/quiz/sessions/active', { method: 'GET' }, 'Não foi possível carregar a sessão ativa.');
}

export async function answerQuizQuestion(token: string, sessionId: number, payload: AnswerQuizQuestionPayload): Promise<AnswerQuizQuestionResult> {
  return requestJson<AnswerQuizQuestionResult>(token, `/quiz/sessions/${sessionId}/answer`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, 'Não foi possível responder a pergunta.');
}

export async function abandonQuizSession(token: string, sessionId: number): Promise<QuizSessionStatus> {
  return requestJson<QuizSessionStatus>(token, `/quiz/sessions/${sessionId}/abandon`, {
    method: 'POST',
  }, 'Não foi possível abandonar a sessão.');
}

export async function getQuizHistory(token: string, limit = 5): Promise<QuizHistory> {
  return requestJson<QuizHistory>(token, `/quiz/history?limit=${limit}`, { method: 'GET' }, 'Não foi possível carregar o histórico do quiz.');
}