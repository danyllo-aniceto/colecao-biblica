import type { CardDef } from '@duel/types';
import { apiRequest, apiRequestVoid } from '@/lib/http';
import type { PaginatedResponse } from '@/lib/admin-api';

export type DuelDeckInfo = { id: string; name: string; description: string; cards: string[] };

/** Cartas disponíveis e Times prontos (o que o jogo usa). */
export const getDuelCards = () => apiRequest<{ cards: CardDef[]; decks: DuelDeckInfo[] }>('/duel/cards', { method: 'GET' }, 'Não foi possível carregar as cartas.');

export type DuelCardRecord = {
  cost: number;
  power: number;
  tags: string[];
  trigger: string | null;
  effects: string | null;
  domText: string | null;
  available: boolean;
  teams: string[];
};

export type DuelCharacterRow = {
  characterId: number;
  name: string;
  rarity: string;
  historicalPeriod: string | null;
  narrativeRole: string | null;
  card: DuelCardRecord | null;
};

export type DuelExportRow = DuelCharacterRow & { testament: string | null; keywords: string | null; shortSummary: string };

const query = (params: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== '').map(([key, value]) => [key, String(value)])).toString();

export const listDuelCharacters = (params: { page: number; size: number; search?: string; status?: string }) =>
  apiRequest<PaginatedResponse<DuelCharacterRow>>(`/duel/admin/cards?${query(params)}`, { method: 'GET' }, 'Não foi possível carregar as cartas.');

export const exportDuelRows = () => apiRequest<{ rows: DuelExportRow[] }>('/duel/admin/export', { method: 'GET' }, 'Não foi possível baixar os personagens.');

const json = (method: string, body: unknown): RequestInit => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

export const saveDuelCard = (characterId: number, card: DuelCardRecord) =>
  apiRequest<{ card: DuelCardRecord; warnings: string[] }>(`/duel/admin/cards/${characterId}`, json('PUT', card), 'Não foi possível salvar a carta.');

export const deleteDuelCard = (characterId: number) => apiRequestVoid(`/duel/admin/cards/${characterId}`, { method: 'DELETE' }, 'Não foi possível excluir a carta.');

export type DuelImportRow = { name: string; cost: string; power: string; tags?: string; trigger?: string; effects?: string; text?: string; available?: string; teams?: string };

export type DuelImportResult = {
  dryRun: boolean;
  total: number;
  valid: number;
  created: number;
  updated: number;
  errors: Array<{ row: number; name: string; message: string }>;
  warnings: Array<{ row: number; name: string; message: string }>;
  teams: Array<{ name: string; count: number; ready: boolean }>;
  preview: Array<{ name: string; cost: number; power: number; tags: string[]; created: boolean; description: string; available: boolean }>;
};

export const importDuelCards = (rows: DuelImportRow[], dryRun: boolean) =>
  apiRequest<DuelImportResult>('/duel/admin/import', json('POST', { rows, dryRun }), 'Não foi possível importar as cartas.');
