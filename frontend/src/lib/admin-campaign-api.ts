import type { Landmark, PathStyle } from '@board/layout';
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
  musicUrl: string | null;
  /** Imagem de fundo da tela do quiz neste cenário. */
  quizBackgroundUrl?: string | null;
  boardImageUrl?: string | null;
  duelImageUrl?: string | null;
  boardPathStyle?: PathStyle | null;
  boardLandmarks?: Landmark[] | null;
  fragmentCharacterId: number | null;
  fragmentCharacter: { id: number; name: string } | null;
  sortOrder: number;
  active: boolean;
  system: boolean;
  nodeCount: number;
  questionCount: number;
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
  musicUrl: string | null;
  /** Imagem de fundo da tela do quiz neste cenário. */
  quizBackgroundUrl?: string | null;
  boardImageUrl?: string | null;
  duelImageUrl?: string | null;
  boardPathStyle?: PathStyle | null;
  boardLandmarks?: Landmark[] | null;
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

export type NodePosition = { id: number; posX: number | null; posY: number | null };

/** Salva de uma vez a posição das paradas (editor visual); x e y nulos voltam ao zigue-zague automático. */
export const saveNodePositions = (scenarioId: number, positions: NodePosition[]) =>
  apiRequest<{ saved: number }>(`/campaign/admin/scenarios/${scenarioId}/positions`, json('PUT', { positions }), 'Não foi possível salvar as posições.');

/** Todas as paradas do cenário (busca página a página). */
export async function listAllNodes(scenarioId: number): Promise<AdminNode[]> {
  const nodes: AdminNode[] = [];
  for (let page = 0; page < 20; page += 1) {
    const response = await listNodesAdmin(scenarioId, { page, size: 50 });
    nodes.push(...response.content);
    if (page + 1 >= response.totalPages) break;
  }
  return nodes;
}

/** Mesma regra do servidor: posição automática (zigue-zague de baixo para cima) quando o admin não definiu. */
export function defaultNodePosition(index: number, total: number): { x: number; y: number } {
  const columns = [22, 62, 30, 70, 38, 78];
  const span = Math.max(total - 1, 1);
  return { x: columns[index % columns.length], y: Math.round(90 - (index / span) * 78) };
}
