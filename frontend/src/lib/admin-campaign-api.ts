import { apiRequest, apiRequestVoid } from '@/lib/http';
import type { PaginatedResponse, StickerRarity } from '@/lib/admin-api';

const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const query = (params: Record<string, string | number | undefined>) =>
  Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');

export type AdminScenario = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  verse: string | null;
  verseReference: string | null;
  color: string | null;
  mapImageUrl: string | null;
  iconImageUrl: string | null;
  fragmentCharacterId: number | null;
  fragmentCharacter: { id: number; name: string } | null;
  sortOrder: number;
  active: boolean;
  system: boolean;
  nodeCount: number;
};

export type ScenarioPayload = {
  slug?: string;
  name: string;
  description: string | null;
  verse: string | null;
  verseReference: string | null;
  color: string | null;
  mapImageUrl: string | null;
  iconImageUrl: string | null;
  fragmentCharacterId: number | null;
  sortOrder: number;
  active: boolean;
};

export type AdminNode = {
  id: number;
  scenarioId: number;
  level: number;
  title: string | null;
  relic: boolean;
  fragment: boolean;
  rewardCoins: number;
  rewardDefinitionId: number | null;
  rewardCosmeticId: number | null;
  posX: number | null;
  posY: number | null;
  rewardDefinition: { id: number; name: string; rewardType: string } | null;
  rewardCosmetic: { id: number; name: string; type: string; rarity: StickerRarity } | null;
};

export type NodePayload = {
  level: number;
  title: string | null;
  relic: boolean;
  fragment: boolean;
  rewardCoins: number;
  rewardDefinitionId: number | null;
  rewardCosmeticId: number | null;
  posX: number | null;
  posY: number | null;
};

export const listScenariosAdmin = (params: { page: number; size: number }) =>
  apiRequest<PaginatedResponse<AdminScenario>>(`/campaign/admin/scenarios?${query(params)}`, { method: 'GET' }, 'Não foi possível carregar os cenários.');
export const createScenario = (payload: ScenarioPayload) => apiRequest('/campaign/admin/scenarios', json('POST', payload), 'Não foi possível criar o cenário.');
export const updateScenario = (id: number, payload: ScenarioPayload) => apiRequest(`/campaign/admin/scenarios/${id}`, json('PUT', payload), 'Não foi possível salvar o cenário.');
export const deleteScenario = (id: number) => apiRequestVoid(`/campaign/admin/scenarios/${id}`, { method: 'DELETE' }, 'Não foi possível excluir o cenário.');

export const listNodesAdmin = (scenarioId: number, params: { page: number; size: number }) =>
  apiRequest<PaginatedResponse<AdminNode>>(`/campaign/admin/scenarios/${scenarioId}/nodes?${query(params)}`, { method: 'GET' }, 'Não foi possível carregar as paradas.');
export const createNode = (scenarioId: number, payload: NodePayload) => apiRequest(`/campaign/admin/scenarios/${scenarioId}/nodes`, json('POST', payload), 'Não foi possível criar a parada.');
export const updateNode = (id: number, payload: NodePayload) => apiRequest(`/campaign/admin/nodes/${id}`, json('PUT', payload), 'Não foi possível salvar a parada.');
export const deleteNode = (id: number) => apiRequestVoid(`/campaign/admin/nodes/${id}`, { method: 'DELETE' }, 'Não foi possível excluir a parada.');
