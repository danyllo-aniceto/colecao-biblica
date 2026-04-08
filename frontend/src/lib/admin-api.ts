import { buildApiUrl } from '@/lib/api';
import type { ApiErrorResponse, UserProfile } from '@/types/auth';

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

export async function listUsers(token: string, params: ListUsersParams = {}): Promise<PaginatedResponse<UserProfile>> {
  const query = new URLSearchParams();
  query.set('page', String(params.page ?? 0));
  query.set('size', String(params.size ?? 10));

  if (params.name?.trim()) {
    query.set('name', params.name.trim());
  }

  if (params.email?.trim()) {
    query.set('email', params.email.trim());
  }

  return requestJson<PaginatedResponse<UserProfile>>(token, `/users?${query.toString()}`, { method: 'GET' }, 'Não foi possível carregar os usuários.');
}

export async function createUser(token: string, payload: CreateUserPayload): Promise<UserProfile> {
  return requestJson<UserProfile>(token, '/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, 'Não foi possível criar o usuário.');
}

export async function updateUser(token: string, id: number, payload: UpdateUserPayload): Promise<UserProfile> {
  return requestJson<UserProfile>(token, `/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, 'Não foi possível atualizar o usuário.');
}

export async function deleteUser(token: string, id: number): Promise<void> {
  return requestVoid(token, `/users/${id}`, { method: 'DELETE' }, 'Não foi possível excluir o usuário.');
}

export async function listCharacters(token: string): Promise<AdminCharacter[]> {
  return requestJson<AdminCharacter[]>(token, '/characters', { method: 'GET' }, 'Não foi possível carregar os personagens.');
}

export async function createCharacter(token: string, payload: CreateCharacterPayload): Promise<AdminCharacter> {
  return requestJson<AdminCharacter>(token, '/characters/admin', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, 'Não foi possível criar o personagem.');
}

export async function updateCharacter(token: string, id: number, payload: Partial<CreateCharacterPayload>): Promise<AdminCharacter> {
  return requestJson<AdminCharacter>(token, `/characters/admin/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, 'Não foi possível atualizar o personagem.');
}

export async function deleteCharacter(token: string, id: number): Promise<void> {
  return requestVoid(token, `/characters/admin/${id}`, { method: 'DELETE' }, 'Não foi possível excluir o personagem.');
}

export async function listQuestions(token: string): Promise<AdminQuestion[]> {
  return requestJson<AdminQuestion[]>(token, '/questions', { method: 'GET' }, 'Não foi possível carregar as perguntas.');
}

export async function createQuestion(token: string, payload: CreateQuestionPayload): Promise<AdminQuestion> {
  return requestJson<AdminQuestion>(token, '/questions/admin', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, 'Não foi possível criar a pergunta.');
}

export async function updateQuestion(token: string, id: number, payload: Partial<CreateQuestionPayload>): Promise<AdminQuestion> {
  return requestJson<AdminQuestion>(token, `/questions/admin/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, 'Não foi possível atualizar a pergunta.');
}

export async function deleteQuestion(token: string, id: number): Promise<void> {
  return requestVoid(token, `/questions/admin/${id}`, { method: 'DELETE' }, 'Não foi possível excluir a pergunta.');
}

export async function listRewards(token: string): Promise<AdminReward[]> {
  return requestJson<AdminReward[]>(token, '/rewards', { method: 'GET' }, 'Não foi possível carregar as recompensas.');
}

export async function createReward(token: string, payload: CreateRewardPayload): Promise<AdminReward> {
  return requestJson<AdminReward>(token, '/rewards/admin', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, 'Não foi possível criar a recompensa.');
}

export async function updateReward(token: string, id: number, payload: Partial<CreateRewardPayload>): Promise<AdminReward> {
  return requestJson<AdminReward>(token, `/rewards/admin/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, 'Não foi possível atualizar a recompensa.');
}

export async function deleteReward(token: string, id: number): Promise<void> {
  return requestVoid(token, `/rewards/admin/${id}`, { method: 'DELETE' }, 'Não foi possível excluir a recompensa.');
}

export async function listShopItems(token: string): Promise<AdminShopItem[]> {
  return requestJson<AdminShopItem[]>(token, '/shop', { method: 'GET' }, 'Não foi possível carregar a loja.');
}

export async function createShopItem(token: string, payload: CreateShopItemPayload): Promise<AdminShopItem> {
  return requestJson<AdminShopItem>(token, '/shop/admin', {
    method: 'POST',
    body: JSON.stringify(payload),
  }, 'Não foi possível criar o item da loja.');
}

export async function updateShopItem(token: string, id: number, payload: Partial<CreateShopItemPayload>): Promise<AdminShopItem> {
  return requestJson<AdminShopItem>(token, `/shop/admin/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, 'Não foi possível atualizar o item da loja.');
}

export async function deleteShopItem(token: string, id: number): Promise<void> {
  return requestVoid(token, `/shop/admin/${id}`, { method: 'DELETE' }, 'Não foi possível excluir o item da loja.');
}

export async function getSettings(token: string): Promise<GameSettings> {
  return requestJson<GameSettings>(token, '/settings', { method: 'GET' }, 'Não foi possível carregar as configurações.');
}

export async function updateSettings(token: string, payload: UpdateSettingsPayload): Promise<GameSettings> {
  return requestJson<GameSettings>(token, '/settings/admin', {
    method: 'PUT',
    body: JSON.stringify(payload),
  }, 'Não foi possível atualizar as configurações.');
}
