import { apiRequest, apiRequestVoid } from '@/lib/http';
import type { PaginatedResponse } from '@/lib/admin-api';
import type { Pose, SoundKey, Sounds, SpriteSheet, Sprites } from '@runner/characters';

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
  sounds?: Partial<Record<SoundKey, string | null>>;
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
