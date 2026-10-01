import { apiRequest, apiRequestVoid } from '@/lib/http';
import type { UserProfile } from '@/types/auth';
import type { PaginatedResponse, StickerRarity, Testament } from '@/lib/admin-api';
import type { PlayerLook, UnlockedCosmetic } from '@/lib/rewards-api';

export type UserSticker = {
  characterId: number;
  characterName: string;
  imageUrl: string | null;
  rarity: StickerRarity;
  acquiredAt?: string;
  /** Cópias repetidas guardadas (vender ou fundir). */
  duplicates: number;
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
  look?: PlayerLook | null;
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

/** Personagem do álbum (versão leve, sem os textos longos). */
export type CharacterEntry = {
  id: number;
  name: string;
  imageUrl?: string | null;
  rarity: StickerRarity;
  testament?: Testament | null;
  bibleBooks?: string | null;
  historicalPeriod?: string | null;
  narrativeRole?: string | null;
  /** Perguntas ativas: sem elas o estudo do personagem não abre. */
  questionCount: number;
};

/** Personagem completo (página da figurinha). */
export type CharacterDetail = {
  id: number;
  name: string;
  imageUrl?: string | null;
  rarity: StickerRarity;
  testament?: Testament | null;
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

export type QuizType = 'GENERAL' | 'CHARACTER_STUDY' | 'DAILY_CHALLENGE';

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
  /** Segundos restantes segundo o servidor (considera tempo extra e recarregamentos). */
  remainingSeconds: number;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  /** Alternativas eliminadas pela dica 50/50 ou já tentadas com a segunda chance. */
  removedOptions?: string[];
  /** Ampulheta: sem prazo nesta pergunta. */
  timeFrozen?: boolean;
  hasVerseHint?: boolean;
  verseHint?: string | null;
  /** Voz da multidão: % por alternativa. */
  crowd?: Record<'A' | 'B' | 'C' | 'D', number> | null;
  secondChanceArmed?: boolean;
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
  extraTimeUsed: boolean;
  extraLifeUsed: boolean;
  xpMultiplierUsed: boolean;
  fiftyFiftyUsed?: boolean;
  skipUsed?: boolean;
  secondChanceUsed?: boolean;
  crowdUsed?: boolean;
  verseHintUsed?: boolean;
  freezeUsed?: boolean;
  doubleCoinsUsed?: boolean;
  comboShieldUsed?: boolean;
  comboShieldArmed?: boolean;
  comboStreak?: number;
  bestCombo?: number;
  comboPoints?: number;
  characterId?: number | null;
  currentQuestion?: QuizQuestionView | null;
};

/** Ajudas novas: rota no servidor de cada uma. */
export type QuizHelperAction = 'skip' | 'second-chance' | 'crowd' | 'verse-hint' | 'freeze' | 'double-coins' | 'combo-shield';

export async function applyQuizHelper(sessionId: number, action: QuizHelperAction): Promise<QuizSessionStatus> {
  return apiRequest<QuizSessionStatus>(`/quiz/sessions/${sessionId}/${action}`, { method: 'POST' }, 'Não foi possível usar a ajuda.');
}

export type UnlockedAchievement = { code: string; title: string; coins: number };

export type AnswerQuizQuestionPayload = {
  questionId: number;
  /** null quando o tempo acabou sem resposta. */
  selectedOption: 'A' | 'B' | 'C' | 'D' | null;
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
  rewardCharacterImageUrl?: string | null;
  rewardCharacterUnlocked?: boolean;
  coinsGained?: number;
  rewardDuplicate?: boolean;
  pityGuaranteed?: boolean;
  /** Prêmios até a figurinha garantida (null quando a garantia está desligada). */
  pityRemaining?: number | null;
  unlockedAchievements?: UnlockedAchievement[];
  unlockedCosmetics?: UnlockedCosmetic[];
  bestCombo?: number;
  comboBonusPoints?: number;
  coinMultiplier?: number;
  eventName?: string | null;
  levelUp?: boolean;
  chestsPending?: number;
  userXp: number;
  userLevel: number;
  userCoins: number;
  rewardMatchesUsedToday: number;
  rewardMatchesLimitPerDay: number;
};

export type AnswerQuizQuestionResult = {
  /** Segunda chance: errou a primeira vez, a alternativa saiu e pode tentar de novo. */
  retry?: boolean;
  removedOption?: string;
  session?: QuizSessionStatus;
  comboStreak?: number;
  comboBonusPoints?: number;
  comboShieldSpent?: boolean;
  correct: boolean;
  timedOut: boolean;
  livesRemaining: number;
  correctAnswers: number;
  wrongAnswers: number;
  finished: boolean;
  extraTimeUsed: boolean;
  extraLifeUsed: boolean;
  xpMultiplierUsed: boolean;
  fiftyFiftyUsed?: boolean;
  correctOption?: string;
  explanation?: string | null;
  bibleReference?: string | null;
  /** Há outra pergunta: ela é aberta (e o tempo começa) com requestNextQuestion. */
  hasNextQuestion?: boolean;
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
    coinsGained?: number;
    rewardGranted: boolean;
    rewardGrantedName?: string | null;
  }>;
};

export type MatchEntry = QuizHistory['matches'][number];

export type GameRules = {
  maxQuestionsPerMatch: number;
  startingLives: number;
  rewardMatchLimitPerDay: number;
  characterStudyXpPercent: number;
  extraTimeSeconds: number;
  rewardMinCorrectAnswers: number;
  characterStickerMinAccuracyPercent: number;
  coinsPerCorrectAnswer: number;
  perfectMatchBonusCoins: number;
  coinMatchLimitPerDay: number;
  maxHintBoosts: number;
  packOddsCommon: number;
  packOddsRare: number;
  packOddsEpic: number;
  packOddsLegendary: number;
  duplicateCoinsCommon: number;
  duplicateCoinsRare: number;
  duplicateCoinsEpic: number;
  duplicateCoinsLegendary: number;
  fuseCost: number;
  dailyChallengeQuestions: number;
  pityThreshold: number;
};

export type ShopItem = {
  id: number;
  name: string;
  description: string;
  itemType: 'STICKER' | 'GAME_BONUS' | 'ECONOMY';
  priceCoins: number;
  rewardDefinitionId?: number | null;
  rewardName?: string | null;
  rewardType?: string | null;
  rewardRarity?: StickerRarity | null;
  active: boolean;
};

export type RankingPage = PaginatedResponse<RankingEntry> & { me: RankingEntry };

export type DailyRewardStatus = {
  canClaim: boolean;
  streak: number;
  streakFreezes: number;
  /** Protetores que o próximo resgate vai gastar para salvar a sequência. */
  freezesToUse: number;
  nextDay: number;
  todayDay: number | null;
  cycle: Array<{ day: number; coins: number; hints: number }>;
};

export type DailyClaimResult = {
  day: number;
  streak: number;
  coins: number;
  hints: number;
  freezesUsed: number;
  unlockedAchievements: UnlockedAchievement[];
  userCoins: number;
  hintBoosts: number;
};

export type Achievement = {
  code: string;
  title: string;
  description: string;
  icon: string;
  coins: number;
  current: number;
  target: number;
  unlocked: boolean;
  unlockedAt: string | null;
};

export type ShopPurchaseResult = {
  item: ShopItem;
  rewardType?: string | null;
  characterId?: number | null;
  characterName?: string | null;
  characterRarity?: StickerRarity | null;
  characterImageUrl?: string | null;
  characterUnlocked: boolean;
  duplicate?: boolean;
  unlockedAchievements?: UnlockedAchievement[];
  userCoins: number;
  extraLifeBoosts: number;
  extraTimeBoosts: number;
  doubleXpBoosts: number;
  hintBoosts: number;
  streakFreezes: number;
  skipBoosts?: number;
  secondChanceBoosts?: number;
  crowdBoosts?: number;
  verseHintBoosts?: number;
  freezeTimeBoosts?: number;
  doubleCoinsBoosts?: number;
  comboShieldBoosts?: number;
};

export async function getGameRules(): Promise<GameRules> {
  return apiRequest<GameRules>('/settings', { method: 'GET' }, 'Não foi possível carregar as regras do jogo.');
}

export async function listShopItems(): Promise<ShopItem[]> {
  return apiRequest<ShopItem[]>('/shop', { method: 'GET' }, 'Não foi possível carregar a loja.');
}

export async function getShopLimits(): Promise<{ stickerLimitPerDay: number; stickersBoughtToday: number }> {
  return apiRequest('/shop/limits', { method: 'GET' }, 'Não foi possível carregar os limites da loja.');
}

export async function buyShopItem(id: number): Promise<ShopPurchaseResult> {
  return apiRequest<ShopPurchaseResult>(`/shop/buy/${id}`, { method: 'POST' }, 'Não foi possível concluir a compra.');
}

export async function getCollection(): Promise<UserSticker[]> {
  return apiRequest<UserSticker[]>('/collection/my', { method: 'GET' }, 'Não foi possível carregar suas figurinhas.');
}

export async function getCollectionProgress(): Promise<CollectionProgress> {
  return apiRequest<CollectionProgress>('/collection/my/progress', { method: 'GET' }, 'Não foi possível carregar o progresso da coleção.');
}

export async function listRanking(page = 0, size = 20): Promise<RankingPage> {
  return apiRequest<RankingPage>(`/ranking?page=${page}&size=${size}`, { method: 'GET' }, 'Não foi possível carregar o ranking.');
}

export async function getMyComments(): Promise<CommentEntry[]> {
  return apiRequest<CommentEntry[]>('/comments/my', { method: 'GET' }, 'Não foi possível carregar os comentários.');
}

export async function createComment(payload: { characterId: number; text: string }): Promise<CommentEntry & { unlockedAchievements?: UnlockedAchievement[] }> {
  return apiRequest<CommentEntry & { unlockedAchievements?: UnlockedAchievement[] }>('/comments', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, 'Não foi possível salvar o comentário.');
}

export async function updateComment(id: number, payload: { text: string }): Promise<CommentEntry> {
  return apiRequest<CommentEntry>(`/comments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, 'Não foi possível atualizar o comentário.');
}

export async function listCharacters(): Promise<CharacterEntry[]> {
  return apiRequest<CharacterEntry[]>('/characters', { method: 'GET' }, 'Não foi possível carregar os personagens.');
}

export async function getCharacterDetail(id: number): Promise<CharacterDetail> {
  return apiRequest<CharacterDetail>(`/characters/${id}`, { method: 'GET' }, 'Não foi possível carregar a figurinha.');
}

export async function getCurrentUser(): Promise<UserProfile> {
  return apiRequest<UserProfile>('/users/me', { method: 'GET' }, 'Não foi possível carregar seu perfil.');
}

export async function updateCurrentUser(id: number, payload: { name?: string; email?: string; password?: string }): Promise<UserProfile> {
  return apiRequest<UserProfile>(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, 'Não foi possível atualizar sua conta.');
}

export async function deleteCurrentUser(id: number): Promise<void> {
  return apiRequestVoid(`/users/${id}`, { method: 'DELETE' }, 'Não foi possível excluir sua conta.');
}

export async function startQuizSession(payload: StartQuizSessionPayload): Promise<QuizSessionStatus> {
  return apiRequest<QuizSessionStatus>('/quiz/sessions/start', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, 'Não foi possível iniciar o quiz.');
}

export async function getActiveQuizSession(): Promise<QuizSessionStatus> {
  return apiRequest<QuizSessionStatus>('/quiz/sessions/active', { method: 'GET' }, 'Não foi possível carregar a sessão ativa.');
}

export async function answerQuizQuestion(sessionId: number, payload: AnswerQuizQuestionPayload): Promise<AnswerQuizQuestionResult> {
  return apiRequest<AnswerQuizQuestionResult>(`/quiz/sessions/${sessionId}/answer`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }, 'Não foi possível responder a pergunta.');
}

export async function requestQuizExtraTime(sessionId: number): Promise<QuizSessionStatus> {
  return apiRequest<QuizSessionStatus>(`/quiz/sessions/${sessionId}/extra-time`, {
    method: 'POST',
  }, 'Não foi possível usar o tempo extra.');
}

export async function abandonQuizSession(sessionId: number): Promise<QuizSessionStatus> {
  return apiRequest<QuizSessionStatus>(`/quiz/sessions/${sessionId}/abandon`, {
    method: 'POST',
  }, 'Não foi possível abandonar a sessão.');
}

export async function getQuizHistory(limit = 5): Promise<QuizHistory> {
  return apiRequest<QuizHistory>(`/quiz/history?limit=${limit}`, { method: 'GET' }, 'Não foi possível carregar o histórico do quiz.');
}
export async function getQuizMatches(page = 0, size = 10): Promise<PaginatedResponse<MatchEntry>> {
  return apiRequest<PaginatedResponse<MatchEntry>>(`/quiz/matches?page=${page}&size=${size}`, { method: 'GET' }, 'Não foi possível carregar o histórico.');
}

export async function requestFiftyFifty(sessionId: number): Promise<QuizSessionStatus> {
  return apiRequest<QuizSessionStatus>(`/quiz/sessions/${sessionId}/fifty-fifty`, { method: 'POST' }, 'Não foi possível usar a dica 50/50.');
}

export async function getDailyReward(): Promise<DailyRewardStatus> {
  return apiRequest<DailyRewardStatus>('/daily-reward', { method: 'GET' }, 'Não foi possível carregar o prêmio diário.');
}

export async function claimDailyReward(): Promise<DailyClaimResult> {
  return apiRequest<DailyClaimResult>('/daily-reward/claim', { method: 'POST' }, 'Não foi possível resgatar o prêmio diário.');
}

export async function listAchievements(): Promise<Achievement[]> {
  return apiRequest<Achievement[]>('/achievements', { method: 'GET' }, 'Não foi possível carregar as conquistas.');
}

export async function requestNextQuestion(sessionId: number): Promise<QuizSessionStatus> {
  return apiRequest<QuizSessionStatus>(`/quiz/sessions/${sessionId}/next`, { method: 'POST' }, 'Não foi possível abrir a próxima pergunta.');
}

export type Mission = {
  code: string;
  period: 'DAILY' | 'WEEKLY';
  title: string;
  coins: number;
  hints: number;
  current: number;
  target: number;
  completed: boolean;
  claimed: boolean;
  endsAt: string;
};

export type LeagueEntry = { position: number; userId: number; userName: string; level: number; look?: PlayerLook | null; score: number; matches: number; prize: number };

export type LeaguePage = PaginatedResponse<LeagueEntry> & {
  weekKey: string;
  endsAt: string;
  prizes: number[];
  me: { position: number; score: number; matches: number } | null;
  lastWeek: { weekKey: string; position: number | null; prize: number; claimed: boolean };
};

export type ChallengeEntry = { position: number; userId: number; userName: string; level: number; look?: PlayerLook | null; correctAnswers: number; questionsAnswered: number; seconds: number | null };

export type DailyChallenge = PaginatedResponse<ChallengeEntry> & {
  dayKey: string;
  endsAt: string;
  totalQuestions: number;
  attemptStatus: 'IN_PROGRESS' | 'FINISHED' | 'ABANDONED' | null;
  me: ChallengeEntry | null;
};

export type UpcomingSticker = { rarity: StickerRarity; publishAt: string; testament?: Testament | null };

export type FuseResult = {
  spent: number;
  characterId: number;
  characterName: string;
  characterRarity: StickerRarity;
  characterImageUrl?: string | null;
  characterUnlocked: boolean;
  duplicate: boolean;
  unlockedAchievements: UnlockedAchievement[];
  userCoins: number;
};

export type ReportReason = 'WRONG_ANSWER' | 'TYPO' | 'CONFUSING' | 'OTHER';

export async function listMissions(): Promise<Mission[]> {
  return apiRequest<Mission[]>('/missions', { method: 'GET' }, 'Não foi possível carregar as missões.');
}

export async function claimMission(code: string): Promise<{ code: string; coins: number; hints: number; userCoins: number; hintBoosts: number }> {
  return apiRequest(`/missions/${code}/claim`, { method: 'POST' }, 'Não foi possível resgatar a missão.');
}

export async function getLeague(page = 0, size = 20): Promise<LeaguePage> {
  return apiRequest<LeaguePage>(`/league?page=${page}&size=${size}`, { method: 'GET' }, 'Não foi possível carregar a liga.');
}

export async function claimLeague(): Promise<{ position: number; coins: number; userCoins: number }> {
  return apiRequest('/league/claim', { method: 'POST' }, 'Não foi possível resgatar o prêmio da liga.');
}

export async function getDailyChallenge(page = 0, size = 10): Promise<DailyChallenge> {
  return apiRequest<DailyChallenge>(`/quiz/daily-challenge?page=${page}&size=${size}`, { method: 'GET' }, 'Não foi possível carregar o desafio do dia.');
}

export async function listUpcoming(): Promise<UpcomingSticker[]> {
  return apiRequest<UpcomingSticker[]>('/characters/upcoming', { method: 'GET' }, 'Não foi possível carregar as próximas figurinhas.');
}

export async function sellDuplicates(characterId: number, quantity: number): Promise<{ sold: number; coins: number; userCoins: number }> {
  return apiRequest('/collection/sell', { method: 'POST', body: JSON.stringify({ characterId, quantity }) }, 'Não foi possível vender as repetidas.');
}

export async function fuseDuplicates(rarity: StickerRarity): Promise<FuseResult> {
  return apiRequest<FuseResult>('/collection/fuse', { method: 'POST', body: JSON.stringify({ rarity }) }, 'Não foi possível fazer a fusão.');
}

export async function reportQuestion(payload: { questionId: number; reason: ReportReason; message?: string }): Promise<void> {
  await apiRequest('/reports', { method: 'POST', body: JSON.stringify(payload) }, 'Não foi possível enviar o reporte.');
}
