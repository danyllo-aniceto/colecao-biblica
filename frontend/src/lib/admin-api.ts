import { apiRequest, apiRequestVoid } from '@/lib/http';
import type { UserProfile } from '@/types/auth';
import type { ChestPrize } from '@/lib/user-api';

export type Role = 'ADMIN' | 'USER';
export type StickerRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'SPECIAL';
export type Testament = 'OLD' | 'NEW';
export type QuestionDifficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'VERY_HARD';
export type RewardType =
  | 'STICKER'
  | 'STICKER_PACK'
  | 'EXTRA_LIFE'
  | 'EXTRA_TIME'
  | 'XP_MULTIPLIER'
  | 'FIFTY_FIFTY'
  | 'STREAK_FREEZE'
  | 'COINS'
  | 'SKIP_QUESTION'
  | 'SECOND_CHANCE'
  | 'CROWD_HELP'
  | 'VERSE_HINT'
  | 'FREEZE_TIME'
  | 'DOUBLE_COINS'
  | 'COMBO_SHIELD'
  | 'COSMETIC'
  | 'CHEST_BRONZE'
  | 'CHEST_SILVER'
  | 'CHEST_GOLD';
export type ReportStatus = 'OPEN' | 'RESOLVED' | 'DISMISSED';
export type ReportReason = 'WRONG_ANSWER' | 'TYPO' | 'CONFUSING' | 'OTHER';
export type ShopItemType = 'STICKER' | 'GAME_BONUS' | 'ECONOMY';

export type PaginatedResponse<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

export type AdminCharacter = {
  id: number;
  name: string;
  imageUrl?: string | null;
  rarity: StickerRarity;
  testament?: Testament | null;
  published: boolean;
  publishAt?: string | null;
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
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
};

/** Linha da lista do painel (sem os textos longos). */
export type AdminCharacterSummary = Pick<AdminCharacter, 'id' | 'name' | 'imageUrl' | 'rarity' | 'testament' | 'published' | 'publishAt' | 'bibleBooks' | 'historicalPeriod' | 'narrativeRole' | 'updatedAt'> & {
  questionCount: number;
};

export type CharacterOption = { id: number; name: string; rarity: StickerRarity; published: boolean };

export type AdminQuestion = {
  id: number;
  text: string;
  difficulty: QuestionDifficulty;
  timeLimitSeconds: number;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  relatedCharacterId?: number | null;
  relatedCharacterName?: string | null;
  scenarioId?: number | null;
  scenarioName?: string | null;
  explanation?: string | null;
  bibleReference?: string | null;
  active: boolean;
  timesAnswered: number;
  timesCorrect: number;
  /** Dificuldade pela taxa de acerto (null com menos de 20 respostas). */
  suggestedDifficulty: QuestionDifficulty | null;
};

export type AdminReport = {
  id: number;
  reason: ReportReason;
  message?: string | null;
  status: ReportStatus;
  createdAt: string;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  userName: string;
  questionId: number;
  questionText: string;
  questionActive: boolean;
  questionReports: number;
};

export type BulkQuestionRow = Partial<Record<'text' | 'optionA' | 'optionB' | 'optionC' | 'optionD' | 'correctOption' | 'difficulty' | 'timeLimitSeconds' | 'character' | 'explanation' | 'bibleReference', string>>;

export type BulkImportResult = { valid: number; created: number; errors: Array<{ row: number; message: string }> };

export type AdminReward = {
  id: number;
  name: string;
  rewardType: RewardType;
  stickerRarity?: StickerRarity | null;
  stickerCharacterId?: number | null;
  stickerCharacterName?: string | null;
  coinAmount?: number | null;
  extraLives?: number | null;
  extraTimeSeconds?: number | null;
  xpMultiplier?: number | null;
  hintAmount?: number | null;
  boostAmount?: number | null;
  cosmeticId?: number | null;
  dropChance: number;
  active: boolean;
  system: boolean;
};

export type AdminShopItem = {
  id: number;
  name: string;
  description: string;
  itemType: ShopItemType;
  priceCoins: number;
  rewardDefinitionId?: number | null;
  rewardName?: string | null;
  rewardType?: RewardType | null;
  rewardRarity?: StickerRarity | null;
  active: boolean;
  system: boolean;
};

export type GameSettings = {
  maxQuestionsPerMatch: number;
  startingLives: number;
  rewardMatchLimitPerDay: number;
  chestDiamondMinCorrect: number;
  chestDiamondLimitPerDay: number;
  friendSalePriceCommon: number;
  friendSalePriceRare: number;
  friendSalePriceEpic: number;
  friendSalePriceLegendary: number;
  friendSaleFeePercent: number;
  chestSilverMinCorrect: number;
  chestGoldMinCorrect: number;
  xpFullMatchesPerDay: number;
  xpAfterLimitPercent: number;
  maxExtraLifeBoosts: number;
  maxExtraTimeBoosts: number;
  maxDoubleXpBoosts: number;
  maxHintBoosts: number;
  doubleXpMultiplier: number;
  extraTimeSeconds: number;
  rewardMinCorrectAnswers: number;
  coinsPerCorrectAnswer: number;
  perfectMatchBonusCoins: number;
  coinMatchLimitPerDay: number;
  duplicateCoinsCommon: number;
  duplicateCoinsRare: number;
  duplicateCoinsEpic: number;
  duplicateCoinsLegendary: number;
  dailyRewardBaseCoins: number;
  dailyRewardStepCoins: number;
  dailyRewardDay7Coins: number;
  packOddsCommon: number;
  packOddsRare: number;
  packOddsEpic: number;
  packOddsLegendary: number;
  maxStreakFreezes: number;
  pityThreshold: number;
  fuseCost: number;
  dailyChallengeQuestions: number;
  leagueFirstCoins: number;
  leagueSecondCoins: number;
  leagueThirdCoins: number;
  chatEnabled: number;
  tradesPerDay: number;
  maxPendingTrades: number;
  tradeExpireDays: number;
  maxSkipBoosts: number;
  maxSecondChanceBoosts: number;
  maxCrowdBoosts: number;
  maxVerseHintBoosts: number;
  maxFreezeTimeBoosts: number;
  maxDoubleCoinsBoosts: number;
  maxComboShieldBoosts: number;
  doubleCoinsMultiplier: number;
  comboStartAt: number;
  comboPointsPerAnswer: number;
  comboCoinsPerAnswer: number;
  chestBaseCoins: number;
  chestCoinsPerLevel: number;
  chestCosmeticChance: number;
  chestMaxCoins: number;
  shopStickerLimitPerDay: number;
};

export type AdminStats = {
  users: number;
  newUsersWeek: number;
  activeUsersWeek: number;
  characters: number;
  drafts: number;
  withoutImage: number;
  withoutQuestions: number;
  questions: number;
  inactiveQuestions: number;
  generalQuestions: number;
  scheduled: number;
  openReports: number;
  needsCalibration: number;
  questionsByDifficulty: Partial<Record<QuestionDifficulty, number>>;
  charactersByRarity: Partial<Record<StickerRarity, number>>;
  matchesToday: number;
  matchesWeek: number;
  stickersGranted: number;
  uploads: 'blob' | 'inline';
};

export type CharacterPayload = {
  name: string;
  rarity: StickerRarity;
  published: boolean;
  shortSummary: string;
  fullDescription: string;
  /** null limpa o campo. */
  imageUrl: string | null;
  testament: Testament | null;
  /** ISO 8601; null = sem agendamento. */
  publishAt: string | null;
  bibleBooks: string | null;
  bibleReferences: string | null;
  historicalPeriod: string | null;
  narrativeRole: string | null;
  genealogy: string | null;
  curiosities: string | null;
  importantEvents: string | null;
  keyVerses: string | null;
  keywords: string | null;
};

export type QuestionPayload = {
  text: string;
  difficulty: QuestionDifficulty;
  timeLimitSeconds: number;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  relatedCharacterId: number | null;
  scenarioId?: number | null;
  explanation: string | null;
  bibleReference: string | null;
  active: boolean;
};

export type CreateRewardPayload = {
  name: string;
  rewardType: RewardType;
  stickerRarity?: StickerRarity | null;
  stickerCharacterId?: number | null;
  cosmeticId?: number | null;
  amount?: number | null;
  dropChance: number;
  active?: boolean;
};

export type UpdateRewardPayload = Partial<{
  name: string;
  stickerRarity: StickerRarity | null;
  stickerCharacterId: number | null;
  coinAmount: number;
  extraLives: number;
  extraTimeSeconds: number;
  hintAmount: number;
  boostAmount: number;
  cosmeticId: number | null;
  dropChance: number;
  active: boolean;
}>;

export type ShopItemPayload = {
  name: string;
  description: string;
  itemType: ShopItemType;
  priceCoins: number;
  rewardDefinitionId: number | null;
  active: boolean;
};

export type CreateUserPayload = {
  name: string;
  email: string;
  password: string;
  role: Role;
};

export type UpdateUserPayload = Partial<CreateUserPayload>;

export type GrantPayload = Partial<
  Record<
    | 'coins'
    | 'extraLifeBoosts'
    | 'extraTimeBoosts'
    | 'doubleXpBoosts'
    | 'hintBoosts'
    | 'streakFreezes'
    | 'skipBoosts'
    | 'secondChanceBoosts'
    | 'crowdBoosts'
    | 'verseHintBoosts'
    | 'freezeTimeBoosts'
    | 'doubleCoinsBoosts'
    | 'comboShieldBoosts',
    number
  >
>;

type Query = Record<string, string | number | undefined | null>;

function withQuery(path: string, params: Query) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      query.set(key, String(value).trim());
    }
  });
  const text = query.toString();
  return text ? `${path}?${text}` : path;
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

// Usuários ---------------------------------------------------------------

export function listUsers(params: { page: number; size: number; name?: string; email?: string; role?: string }) {
  return apiRequest<PaginatedResponse<UserProfile>>(withQuery('/users', params), { method: 'GET' }, 'Não foi possível carregar os usuários.');
}

export function createUser(payload: CreateUserPayload) {
  return apiRequest<UserProfile>('/users', json('POST', payload), 'Não foi possível criar o usuário.');
}

export function updateUser(id: number, payload: UpdateUserPayload) {
  return apiRequest<UserProfile>(`/users/${id}`, json('PUT', payload), 'Não foi possível atualizar o usuário.');
}

export function grantUser(id: number, payload: GrantPayload) {
  return apiRequest<UserProfile>(`/users/${id}/grant`, json('POST', payload), 'Não foi possível ajustar o saldo.');
}

export function resetUser(id: number, includeSocial: boolean) {
  return apiRequest<UserProfile>(`/users/${id}/reset`, json('POST', { includeSocial }), 'Não foi possível resetar o jogador.');
}

export function resetAllUsers(includeSocial: boolean) {
  return apiRequest<{ reset: number }>('/users/reset-all', json('POST', { includeSocial, confirm: 'RESETAR' }), 'Não foi possível resetar os jogadores.');
}

export function deleteUser(id: number) {
  return apiRequestVoid(`/users/${id}`, { method: 'DELETE' }, 'Não foi possível excluir o usuário.');
}

// Personagens ------------------------------------------------------------

export type CharacterFilters = { page: number; size: number; search?: string; rarity?: string; status?: string; issue?: string };

export function listCharactersPage(params: CharacterFilters) {
  return apiRequest<PaginatedResponse<AdminCharacterSummary>>(withQuery('/characters/admin/list', params), { method: 'GET' }, 'Não foi possível carregar os personagens.');
}

export function listCharacterOptions() {
  return apiRequest<CharacterOption[]>('/characters/admin/options', { method: 'GET' }, 'Não foi possível carregar os personagens.');
}

export function getCharacter(id: number) {
  return apiRequest<AdminCharacter>(`/characters/admin/${id}`, { method: 'GET' }, 'Não foi possível carregar o personagem.');
}

export function createCharacter(payload: CharacterPayload) {
  return apiRequest<AdminCharacter>('/characters/admin', json('POST', payload), 'Não foi possível criar o personagem.');
}

export function updateCharacter(id: number, payload: Partial<CharacterPayload>) {
  return apiRequest<AdminCharacter>(`/characters/admin/${id}`, json('PUT', payload), 'Não foi possível atualizar o personagem.');
}

export function deleteCharacter(id: number) {
  return apiRequestVoid(`/characters/admin/${id}`, { method: 'DELETE' }, 'Não foi possível excluir o personagem.');
}

// Perguntas --------------------------------------------------------------

export type QuestionFilters = { page: number; size: number; search?: string; difficulty?: string; characterId?: string; scenarioId?: string; status?: string; calibration?: string; reported?: string };

export function listQuestions(params: QuestionFilters) {
  return apiRequest<PaginatedResponse<AdminQuestion>>(withQuery('/questions', params), { method: 'GET' }, 'Não foi possível carregar as perguntas.');
}

export function getQuestion(id: number) {
  return apiRequest<AdminQuestion>(`/questions/${id}`, { method: 'GET' }, 'Não foi possível carregar a pergunta.');
}

export function createQuestion(payload: QuestionPayload) {
  return apiRequest<AdminQuestion>('/questions/admin', json('POST', payload), 'Não foi possível criar a pergunta.');
}

export function updateQuestion(id: number, payload: Partial<QuestionPayload>) {
  return apiRequest<AdminQuestion>(`/questions/admin/${id}`, json('PUT', payload), 'Não foi possível atualizar a pergunta.');
}

export function deleteQuestion(id: number) {
  return apiRequestVoid(`/questions/admin/${id}`, { method: 'DELETE' }, 'Não foi possível excluir a pergunta.');
}

export function importQuestions(rows: BulkQuestionRow[], dryRun: boolean) {
  return apiRequest<BulkImportResult>('/questions/admin/bulk', json('POST', { rows, dryRun }), 'Não foi possível importar as perguntas.');
}

export type BulkCharacterRow = Partial<
  Record<'name' | 'rarity' | 'testament' | 'shortSummary' | 'fullDescription' | 'curiosities' | 'bibleReferences' | 'narrativeRole' | 'historicalPeriod' | 'bibleBooks' | 'keyVerses' | 'keywords' | 'published' | 'imageUrl' | 'publishAt' | 'genealogy' | 'importantEvents', string>
>;

export type BulkCharacterResult = BulkImportResult & { updated: number; willCreate: number; willUpdate: number };

export function importCharacters(rows: BulkCharacterRow[], dryRun: boolean) {
  return apiRequest<BulkCharacterResult>('/characters/admin/bulk', json('POST', { rows, dryRun }), 'Não foi possível importar os personagens.');
}

export function applySuggestedDifficulty(ids: number[]) {
  return apiRequest<{ updated: number }>('/questions/admin/apply-suggestions', json('POST', { ids }), 'Não foi possível aplicar as sugestões.');
}

// Reportes ---------------------------------------------------------------

export function listReports(params: { page: number; size: number; status?: string }) {
  return apiRequest<PaginatedResponse<AdminReport>>(withQuery('/reports/admin', params), { method: 'GET' }, 'Não foi possível carregar os reportes.');
}

export function countOpenReports() {
  return apiRequest<{ open: number }>('/reports/admin/count', { method: 'GET' }, 'Não foi possível contar os reportes.');
}

export function updateReport(id: number, status: ReportStatus) {
  return apiRequest<{ ok: boolean }>(`/reports/admin/${id}`, json('PUT', { status }), 'Não foi possível atualizar o reporte.');
}

// Recompensas e loja -----------------------------------------------------

export function listRewards() {
  return apiRequest<AdminReward[]>('/rewards', { method: 'GET' }, 'Não foi possível carregar as recompensas.');
}

export function createReward(payload: CreateRewardPayload) {
  return apiRequest<AdminReward>('/rewards/admin', json('POST', payload), 'Não foi possível criar a recompensa.');
}

export function updateReward(id: number, payload: UpdateRewardPayload) {
  return apiRequest<AdminReward>(`/rewards/admin/${id}`, json('PUT', payload), 'Não foi possível atualizar a recompensa.');
}

export function deleteReward(id: number) {
  return apiRequestVoid(`/rewards/admin/${id}`, { method: 'DELETE' }, 'Não foi possível excluir a recompensa.');
}

export function listShopItemsAdmin() {
  return apiRequest<AdminShopItem[]>('/shop/admin', { method: 'GET' }, 'Não foi possível carregar a loja.');
}

export function createShopItem(payload: ShopItemPayload) {
  return apiRequest<AdminShopItem>('/shop/admin', json('POST', payload), 'Não foi possível criar o item da loja.');
}

export function updateShopItem(id: number, payload: Partial<ShopItemPayload>) {
  return apiRequest<AdminShopItem>(`/shop/admin/${id}`, json('PUT', payload), 'Não foi possível atualizar o item da loja.');
}

export function deleteShopItem(id: number) {
  return apiRequestVoid(`/shop/admin/${id}`, { method: 'DELETE' }, 'Não foi possível excluir o item da loja.');
}

// Configurações e visão geral -------------------------------------------

export function getSettings() {
  return apiRequest<GameSettings>('/settings', { method: 'GET' }, 'Não foi possível carregar as configurações.');
}

export function updateSettings(payload: Partial<GameSettings>) {
  return apiRequest<GameSettings>('/settings/admin', json('PUT', payload), 'Não foi possível atualizar as configurações.');
}

export function getAdminStats() {
  return apiRequest<AdminStats>('/admin/stats', { method: 'GET' }, 'Não foi possível carregar a visão geral.');
}

// Simulador de baús ------------------------------------------------------

export type SimulatedChestTier = {
  possible: boolean;
  spec: { coins: number; helpers: number; stickerChance: number; extraStickerChance: number; cosmetic: { chance: number; weights: Record<string, number> } };
  avgCoins: number;
  avgHelpers: number;
  avgStickers: number;
  chanceSticker: number;
  chanceTwoStickers: number;
  chanceCosmetic: number;
  cosmeticByRarity: Record<string, number>;
  rarityPerChest: Record<'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY', number>;
  helpers: Record<string, number>;
  samples: ChestPrize[][];
};

export type ChestSimulation = {
  runs: number;
  publishedByRarity: Record<string, number>;
  cosmeticsInChestPool: Record<string, number>;
  thresholds: {
    bronze: number;
    silver: number;
    gold: number;
    diamond: number;
    dailyLimit: number;
    diamondPerDay: number;
    newStickerPercent: number;
    pityThreshold: number;
    startingLives: number;
  };
  tiers: Record<'BRONZE' | 'SILVER' | 'GOLD' | 'DIAMOND', SimulatedChestTier>;
};

export function simulateChests(runs: number) {
  return apiRequest<ChestSimulation>('/admin/chests/simulate', json('POST', { runs }), 'Não foi possível simular os baús.');
}

// Missões ----------------------------------------------------------------

export type MissionPeriod = 'DAILY' | 'WEEKLY';

export type AdminMission = {
  id: number;
  code: string;
  period: MissionPeriod;
  metric: string;
  title: string;
  target: number;
  rewardCoins: number;
  rewardDefinitionId: number | null;
  reward: { id: number; name: string; rewardType: string } | null;
  active: boolean;
  system: boolean;
};

export type AdminMissionPayload = {
  title: string;
  target: number;
  rewardCoins: number;
  rewardDefinitionId: number | null;
  active: boolean;
  period?: MissionPeriod;
  metric?: string;
};

export function listMissionsAdmin() {
  return apiRequest<{ metrics: Array<{ value: string; label: string }>; missions: AdminMission[] }>('/missions/admin', { method: 'GET' }, 'Não foi possível carregar as missões.');
}

export function createMission(payload: AdminMissionPayload) {
  return apiRequest<AdminMission>('/missions/admin', json('POST', payload), 'Não foi possível criar a missão.');
}

export function updateMission(id: number, payload: Partial<AdminMissionPayload>) {
  return apiRequest<AdminMission>(`/missions/admin/${id}`, json('PUT', payload), 'Não foi possível atualizar a missão.');
}

export function deleteMission(id: number) {
  return apiRequestVoid(`/missions/admin/${id}`, { method: 'DELETE' }, 'Não foi possível excluir a missão.');
}

export function importMissions(rows: Array<Record<string, string>>, dryRun: boolean) {
  return apiRequest<BulkImportResult>('/missions/admin/bulk', json('POST', { rows, dryRun }), 'Não foi possível importar as missões.');
}

export function importReactions(rows: Array<Record<string, string>>, dryRun: boolean) {
  return apiRequest<BulkImportResult>('/cosmetics/admin/bulk-reactions', json('POST', { rows, dryRun }), 'Não foi possível importar as reações.');
}

export function importCosmetics(rows: Array<Record<string, string>>, dryRun: boolean) {
  return apiRequest<BulkImportResult>('/cosmetics/admin/bulk', json('POST', { rows, dryRun }), 'Não foi possível importar os itens visuais.');
}
