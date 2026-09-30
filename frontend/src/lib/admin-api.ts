import { apiRequest, apiRequestVoid } from '@/lib/http';
import type { UserProfile } from '@/types/auth';

export type Role = 'ADMIN' | 'USER';
export type StickerRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
export type QuestionDifficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'VERY_HARD';
export type RewardType = 'STICKER' | 'EXTRA_LIFE' | 'EXTRA_TIME' | 'XP_MULTIPLIER' | 'COINS';
export type ShopItemType = 'STICKER' | 'GAME_BONUS' | 'ECONOMY';

export type PaginatedResponse<T> = {
  content: T[];
  totalElements?: number;
  totalPages?: number;
  number?: number;
  size?: number;
};

export type AdminCharacter = {
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
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
};

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
  active: boolean;
};

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
  ticketAmount?: number | null;
  dropChance: number;
  active: boolean;
};

export type AdminShopItem = {
  id: number;
  name: string;
  description: string;
  itemType: ShopItemType;
  priceCoins: number;
  rewardDefinitionId?: number | null;
  rewardName?: string | null;
  active: boolean;
};

export type GameSettings = {
  maxQuestionsPerMatch: number;
  startingLives: number;
  rewardMatchLimitPerDay: number;
  characterStudyXpPercent: number;
  maxExtraLifeBoosts: number;
  maxExtraTimeBoosts: number;
  maxDoubleXpBoosts: number;
  doubleXpMultiplier: number;
  extraTimeSeconds: number;
  rewardMinCorrectAnswers: number;
  characterStickerMinAccuracyPercent: number;
};

export type CreateCharacterPayload = {
  name: string;
  imageUrl?: string;
  rarity: StickerRarity;
  shortSummary: string;
  fullDescription: string;
  bibleBooks?: string;
  bibleReferences?: string;
  historicalPeriod?: string;
  narrativeRole?: string;
  genealogy?: string;
  curiosities?: string;
  importantEvents?: string;
  keyVerses?: string;
  keywords?: string;
};

export type CreateQuestionPayload = {
  text: string;
  difficulty: QuestionDifficulty;
  timeLimitSeconds: number;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  relatedCharacterId?: number | null;
  active?: boolean;
};

export type CreateRewardPayload = {
  name: string;
  rewardType: RewardType;
  stickerRarity?: StickerRarity | null;
  stickerCharacterId?: number | null;
  coinAmount?: number | null;
  extraLives?: number | null;
  extraTimeSeconds?: number | null;
  xpMultiplier?: number | null;
  ticketAmount?: number | null;
  dropChance: number;
  active?: boolean;
};

export type CreateShopItemPayload = {
  name: string;
  description: string;
  itemType: ShopItemType;
  priceCoins: number;
  rewardDefinitionId?: number | null;
  active?: boolean;
};

export type UpdateSettingsPayload = Partial<GameSettings>;

export type CreateUserPayload = {
  name: string;
  email: string;
  password: string;
  role: Role;
};

export type UpdateUserPayload = Partial<CreateUserPayload>;

export type ListUsersParams = {
  page?: number;
  size?: number;
  name?: string;
  email?: string;
};

export async function listUsers(params: ListUsersParams = {}): Promise<PaginatedResponse<UserProfile>> {
  const query = new URLSearchParams();
  query.set('page', String(params.page ?? 0));
  query.set('size', String(params.size ?? 10));

  if (params.name?.trim()) {
    query.set('name', params.name.trim());
  }

  if (params.email?.trim()) {
    query.set('email', params.email.trim());
  }

  return apiRequest<PaginatedResponse<UserProfile>>(`/users?${query.toString()}`, { method: 'GET' }, 'Não foi possível carregar os usuários.');
}

export async function createUser(payload: CreateUserPayload): Promise<UserProfile> {
  return apiRequest<UserProfile>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, 'Não foi possível criar o usuário.');
}

export async function updateUser(id: number, payload: UpdateUserPayload): Promise<UserProfile> {
  return apiRequest<UserProfile>(`/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, 'Não foi possível atualizar o usuário.');
}

export async function deleteUser(id: number): Promise<void> {
  return apiRequestVoid(`/users/${id}`, { method: 'DELETE' }, 'Não foi possível excluir o usuário.');
}

export async function listCharacters(): Promise<AdminCharacter[]> {
  return apiRequest<AdminCharacter[]>('/characters', { method: 'GET' }, 'Não foi possível carregar os personagens.');
}

export async function createCharacter(payload: CreateCharacterPayload): Promise<AdminCharacter> {
  return apiRequest<AdminCharacter>('/characters/admin', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, 'Não foi possível criar o personagem.');
}

export async function updateCharacter(id: number, payload: Partial<CreateCharacterPayload>): Promise<AdminCharacter> {
  return apiRequest<AdminCharacter>(`/characters/admin/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, 'Não foi possível atualizar o personagem.');
}

export async function deleteCharacter(id: number): Promise<void> {
  return apiRequestVoid(`/characters/admin/${id}`, { method: 'DELETE' }, 'Não foi possível excluir o personagem.');
}

export async function listQuestions(): Promise<AdminQuestion[]> {
  return apiRequest<AdminQuestion[]>('/questions', { method: 'GET' }, 'Não foi possível carregar as perguntas.');
}

export async function createQuestion(payload: CreateQuestionPayload): Promise<AdminQuestion> {
  return apiRequest<AdminQuestion>('/questions/admin', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, 'Não foi possível criar a pergunta.');
}

export async function updateQuestion(id: number, payload: Partial<CreateQuestionPayload>): Promise<AdminQuestion> {
  return apiRequest<AdminQuestion>(`/questions/admin/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, 'Não foi possível atualizar a pergunta.');
}

export async function deleteQuestion(id: number): Promise<void> {
  return apiRequestVoid(`/questions/admin/${id}`, { method: 'DELETE' }, 'Não foi possível excluir a pergunta.');
}

export async function listRewards(): Promise<AdminReward[]> {
  return apiRequest<AdminReward[]>('/rewards', { method: 'GET' }, 'Não foi possível carregar as recompensas.');
}

export async function createReward(payload: CreateRewardPayload): Promise<AdminReward> {
  return apiRequest<AdminReward>('/rewards/admin', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, 'Não foi possível criar a recompensa.');
}

export async function updateReward(id: number, payload: Partial<CreateRewardPayload>): Promise<AdminReward> {
  return apiRequest<AdminReward>(`/rewards/admin/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, 'Não foi possível atualizar a recompensa.');
}

export async function deleteReward(id: number): Promise<void> {
  return apiRequestVoid(`/rewards/admin/${id}`, { method: 'DELETE' }, 'Não foi possível excluir a recompensa.');
}

export async function listShopItems(): Promise<AdminShopItem[]> {
  return apiRequest<AdminShopItem[]>('/shop', { method: 'GET' }, 'Não foi possível carregar a loja.');
}

export async function createShopItem(payload: CreateShopItemPayload): Promise<AdminShopItem> {
  return apiRequest<AdminShopItem>('/shop/admin', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, 'Não foi possível criar o item da loja.');
}

export async function updateShopItem(id: number, payload: Partial<CreateShopItemPayload>): Promise<AdminShopItem> {
  return apiRequest<AdminShopItem>(`/shop/admin/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, 'Não foi possível atualizar o item da loja.');
}

export async function deleteShopItem(id: number): Promise<void> {
  return apiRequestVoid(`/shop/admin/${id}`, { method: 'DELETE' }, 'Não foi possível excluir o item da loja.');
}

export async function getSettings(): Promise<GameSettings> {
  return apiRequest<GameSettings>('/settings', { method: 'GET' }, 'Não foi possível carregar as configurações.');
}

export async function updateSettings(payload: UpdateSettingsPayload): Promise<GameSettings> {
  return apiRequest<GameSettings>('/settings/admin', {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, 'Não foi possível atualizar as configurações.');
}
