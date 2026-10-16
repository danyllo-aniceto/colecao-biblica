import { apiRequest, apiRequestVoid } from '@/lib/http';
import type { PaginatedResponse } from '@/lib/admin-api';
import type { Scenario } from '@runner/campaign';
import type { Pose, SoundKey, Sounds, SpriteSheet, Sprites } from '@runner/characters';
import type { ArtKey, Form } from '@runner/types';
import type { RunSegment } from '@runner/verify';

/** Personagem da Corrida como o servidor entrega (sprites e sons enviados pelo painel). */
export type RunnerCharacterDto = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  color: string;
  active: boolean;
  sortOrder: number;
  unlockLevel: string | null;
  sprites: Sprites;
  sounds: Sounds;
  /** Os que já vêm com o jogo não podem ser excluídos (só desativados). */
  system: boolean;
};

/** Campos que o painel manda: ausente não altera; `null` limpa (pose, som, descrição). */
export type RunnerCharacterInput = {
  name?: string;
  description?: string | null;
  color?: string;
  active?: boolean;
  sortOrder?: number;
  unlockLevel?: string | null;
  sprites?: Partial<Record<Pose, SpriteSheet | null>>;
  sounds?: Partial<Record<SoundKey, string[] | null>>;
};

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

/** Personagens ativos (jogador). */
export const getRunnerCharacters = () => apiRequest<RunnerCharacterDto[]>('/runner/characters', { method: 'GET' }, 'Não foi possível carregar os personagens da Corrida.');

export function listAdminRunnerCharacters(params: { page: number; size: number; q?: string }) {
  const query = new URLSearchParams({ page: String(params.page), size: String(params.size) });
  if (params.q) query.set('q', params.q);
  return apiRequest<PaginatedResponse<RunnerCharacterDto>>(`/runner/admin/characters?${query.toString()}`, { method: 'GET' }, 'Não foi possível carregar os personagens.');
}

export const createRunnerCharacter = (input: RunnerCharacterInput & { name: string }) =>
  apiRequest<RunnerCharacterDto>('/runner/admin/characters', json('POST', input), 'Não foi possível criar o personagem.');

export const updateRunnerCharacter = (id: number, input: RunnerCharacterInput) =>
  apiRequest<RunnerCharacterDto>(`/runner/admin/characters/${id}`, json('PUT', input), 'Não foi possível salvar o personagem.');

export const deleteRunnerCharacter = (id: number) => apiRequestVoid(`/runner/admin/characters/${id}`, { method: 'DELETE' }, 'Não foi possível excluir o personagem.');

// ---------- Campanha: cenários e fases ----------

export type ScenarioArtDto = Partial<Record<ArtKey, string>>;

/** Cenário como o painel recebe (com a contagem de fases). */
export type RunnerScenarioDto = {
  id: number;
  slug: string;
  name: string;
  story: string | null;
  skyTop: string;
  skyBottom: string;
  art: ScenarioArtDto;
  musicUrl: string | null;
  active: boolean;
  sortOrder: number;
  system: boolean;
  levelCount: number;
};

export type RunnerScenarioInput = {
  name?: string;
  story?: string | null;
  skyTop?: string;
  skyBottom?: string;
  /** Chave ausente não altera; `null` remove a imagem. */
  art?: Partial<Record<ArtKey, string | null>>;
  musicUrl?: string | null;
  active?: boolean;
  sortOrder?: number;
};

export type RunnerLevelDto = {
  id: number;
  slug: string;
  scenarioId: number;
  scenarioName: string | null;
  name: string;
  seed: number;
  seconds: number;
  order: Form[];
  verseRef: string;
  verseText: string;
  forks: boolean;
  powers: boolean;
  difficulty: number;
  active: boolean;
  sortOrder: number;
  system: boolean;
};

export type RunnerLevelInput = {
  scenarioId?: number;
  name?: string;
  seed?: number;
  seconds?: number;
  order?: Form[];
  verseRef?: string;
  verseText?: string;
  forks?: boolean;
  powers?: boolean;
  difficulty?: number;
  active?: boolean;
  sortOrder?: number;
};

/** Campanha ativa (jogador): cenários com as fases prontas para o app montar. */
export const getRunnerCampaign = () => apiRequest<{ scenarios: Scenario[] }>('/runner/campaign', { method: 'GET' }, 'Não foi possível carregar a campanha da Corrida.');

function pageQuery(params: { page: number; size: number; q?: string; scenarioId?: string }) {
  const query = new URLSearchParams({ page: String(params.page), size: String(params.size) });
  if (params.q) query.set('q', params.q);
  if (params.scenarioId) query.set('scenarioId', params.scenarioId);
  return query.toString();
}

export const listAdminRunnerScenarios = (params: { page: number; size: number; q?: string }) =>
  apiRequest<PaginatedResponse<RunnerScenarioDto>>(`/runner/admin/scenarios?${pageQuery(params)}`, { method: 'GET' }, 'Não foi possível carregar os cenários.');
export const runnerScenarioOptions = () => apiRequest<Array<{ id: number; name: string }>>('/runner/admin/scenario-options', { method: 'GET' }, 'Não foi possível carregar os cenários.');
export const createRunnerScenario = (input: RunnerScenarioInput & { name: string }) => apiRequest<RunnerScenarioDto>('/runner/admin/scenarios', json('POST', input), 'Não foi possível criar o cenário.');
export const updateRunnerScenario = (id: number, input: RunnerScenarioInput) => apiRequest<RunnerScenarioDto>(`/runner/admin/scenarios/${id}`, json('PUT', input), 'Não foi possível salvar o cenário.');
export const deleteRunnerScenario = (id: number) => apiRequestVoid(`/runner/admin/scenarios/${id}`, { method: 'DELETE' }, 'Não foi possível excluir o cenário.');

export const runnerLevelOptions = () => apiRequest<Array<{ slug: string; name: string; scenarioName: string }>>('/runner/admin/level-options', { method: 'GET' }, 'Não foi possível carregar as fases.');

export const listAdminRunnerLevels = (params: { page: number; size: number; q?: string; scenarioId?: string }) =>
  apiRequest<PaginatedResponse<RunnerLevelDto>>(`/runner/admin/levels?${pageQuery(params)}`, { method: 'GET' }, 'Não foi possível carregar as fases.');
export const createRunnerLevel = (input: RunnerLevelInput & Required<Pick<RunnerLevelInput, 'scenarioId' | 'name' | 'seed' | 'seconds' | 'order' | 'verseRef' | 'verseText'>>) =>
  apiRequest<RunnerLevelDto>('/runner/admin/levels', json('POST', input), 'Não foi possível criar a fase.');
export const updateRunnerLevel = (id: number, input: RunnerLevelInput) => apiRequest<RunnerLevelDto>(`/runner/admin/levels/${id}`, json('PUT', input), 'Não foi possível salvar a fase.');
export const deleteRunnerLevel = (id: number) => apiRequestVoid(`/runner/admin/levels/${id}`, { method: 'DELETE' }, 'Não foi possível excluir a fase.');

// ---------- Progresso da campanha (conferido pelo servidor) ----------

/** Melhor resultado do jogador numa fase. */
export type RunnerProgressDto = { progress: number; words: number; finished: boolean; allWords: boolean; clean: boolean; stars: number };

export const getRunnerProgress = () => apiRequest<{ levels: Record<string, RunnerProgressDto> }>('/runner/progress', { method: 'GET' }, 'Não foi possível carregar o seu progresso na Corrida.');

/** Manda a partida (corrente de tentativas com os toques): o servidor repete tudo, confere e guarda o melhor. */
export const postRunnerResult = (levelSlug: string, segments: RunSegment[]) =>
  apiRequest<RunnerProgressDto & { newlyFinished: boolean }>(`/runner/levels/${encodeURIComponent(levelSlug)}/result`, json('POST', { segments }), 'Não foi possível enviar o resultado da fase.');
