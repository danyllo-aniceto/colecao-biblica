import { apiRequest, apiRequestVoid } from '@/lib/http';
import type { PaginatedResponse, StickerRarity } from '@/lib/admin-api';
import type { Cosmetic, CosmeticType, CosmeticUnlock, GameEvent } from '@/lib/rewards-api';

const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const query = (params: Record<string, string | number | undefined>) =>
  Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');

export type AdminCosmetic = Cosmetic & { owners: number; eventName: string | null };

export type CosmeticPayload = {
  type?: CosmeticType;
  name: string;
  description?: string | null;
  rarity: StickerRarity;
  imageUrl?: string | null;
  color?: string | null;
  style?: string | null;
  animation?: string | null;
  pack?: string | null;
  unlock: CosmeticUnlock;
  priceCoins?: number | null;
  requirement?: string | null;
  requirementValue?: number | null;
  inChestPool: boolean;
  eventId?: number | null;
  active: boolean;
  sortOrder?: number;
};

export type CosmeticMeta = {
  requirements: Array<{ code: string; label: string; needsValue: boolean }>;
  titleStyles: string[];
  frameStyles: string[];
  reactionAnimations: string[];
};

export const listCosmeticsAdmin = (params: { page: number; size: number; type?: string; search?: string }) =>
  apiRequest<PaginatedResponse<AdminCosmetic>>(`/cosmetics/admin/list?${query(params)}`, { method: 'GET' }, 'Não foi possível carregar os itens visuais.');
export const getCosmeticMeta = () => apiRequest<CosmeticMeta>('/cosmetics/admin/requirements', { method: 'GET' }, 'Não foi possível carregar as metas.');
export const createCosmetic = (payload: CosmeticPayload) => apiRequest<Cosmetic>('/cosmetics/admin', json('POST', payload), 'Não foi possível criar o item.');
export const updateCosmetic = (id: number, payload: Partial<CosmeticPayload>) => apiRequest<Cosmetic>(`/cosmetics/admin/${id}`, json('PUT', payload), 'Não foi possível salvar o item.');
export const deleteCosmetic = (id: number) => apiRequestVoid(`/cosmetics/admin/${id}`, { method: 'DELETE' }, 'Não foi possível excluir o item.');
export const grantCosmetic = (id: number, userId: number) =>
  apiRequest<{ granted: boolean }>(`/cosmetics/admin/${id}/grant`, json('POST', { userId }), 'Não foi possível dar o item ao jogador.');

export type AdminCollection = {
  id: number;
  name: string;
  description?: string | null;
  rewardCoins: number;
  rewardCosmeticId?: number | null;
  rewardCosmetic?: { id: number; name: string; type: CosmeticType } | null;
  active: boolean;
  characters: Array<{ id: number; name: string }>;
};

export type CollectionPayload = { name: string; description?: string | null; rewardCoins: number; rewardCosmeticId?: number | null; characterIds: number[]; active: boolean };

export const listCollectionsAdmin = (params: { page: number; size: number }) =>
  apiRequest<PaginatedResponse<AdminCollection>>(`/collections/admin/list?${query(params)}`, { method: 'GET' }, 'Não foi possível carregar as coleções.');
export const createCollection = (payload: CollectionPayload) => apiRequest('/collections/admin', json('POST', payload), 'Não foi possível criar a coleção.');
export const updateCollection = (id: number, payload: CollectionPayload) => apiRequest(`/collections/admin/${id}`, json('PUT', payload), 'Não foi possível salvar a coleção.');
export const deleteCollection = (id: number) => apiRequestVoid(`/collections/admin/${id}`, { method: 'DELETE' }, 'Não foi possível excluir a coleção.');

export type AdminPassTier = {
  id: number;
  level: number;
  requiredXp: number;
  rewardCoins: number;
  rewardDefinitionId?: number | null;
  rewardCosmeticId?: number | null;
  rewardDefinition?: { id: number; name: string } | null;
  rewardCosmetic?: { id: number; name: string; type: CosmeticType } | null;
  active: boolean;
};

export type PassTierPayload = { level: number; requiredXp: number; rewardCoins: number; rewardDefinitionId?: number | null; rewardCosmeticId?: number | null; active: boolean };

export const listPassTiers = () => apiRequest<AdminPassTier[]>('/pass/admin/tiers', { method: 'GET' }, 'Não foi possível carregar o passe.');
export const createPassTier = (payload: PassTierPayload) => apiRequest('/pass/admin/tiers', json('POST', payload), 'Não foi possível criar o degrau.');
export const updatePassTier = (id: number, payload: PassTierPayload) => apiRequest(`/pass/admin/tiers/${id}`, json('PUT', payload), 'Não foi possível salvar o degrau.');
export const deletePassTier = (id: number) => apiRequestVoid(`/pass/admin/tiers/${id}`, { method: 'DELETE' }, 'Não foi possível excluir o degrau.');

export type AdminEvent = GameEvent & { cosmetics: number };
export type EventPayload = {
  name: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  xpMultiplier: number;
  coinMultiplier: number;
  color?: string | null;
  imageUrl?: string | null;
  active: boolean;
};

export const listEventsAdmin = (params: { page: number; size: number }) =>
  apiRequest<PaginatedResponse<AdminEvent>>(`/events/admin/list?${query(params)}`, { method: 'GET' }, 'Não foi possível carregar os eventos.');
export const createEvent = (payload: EventPayload) => apiRequest('/events/admin', json('POST', payload), 'Não foi possível criar o evento.');
export const updateEvent = (id: number, payload: EventPayload) => apiRequest(`/events/admin/${id}`, json('PUT', payload), 'Não foi possível salvar o evento.');
export const deleteEvent = (id: number) => apiRequestVoid(`/events/admin/${id}`, { method: 'DELETE' }, 'Não foi possível excluir o evento.');
