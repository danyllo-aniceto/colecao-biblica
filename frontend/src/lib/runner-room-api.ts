import { apiRequest, apiRequestVoid, fetchApi, safeParseJson } from '@/lib/http';
import type { RoomBotSkill } from '@runner/room';
import type { RunSegment } from '@runner/verify';

export type RunnerRoomStatus = 'LOBBY' | 'RACING' | 'FINISHED';

export type RunnerRoomPlayer = {
  key: string;
  slot: number;
  userId: number | null;
  name: string;
  characterSlug: string | null;
  bot: RoomBotSkill | null;
  isHost: boolean;
  connected: boolean;
  finished: boolean;
  /** Tempo oficial da chegada, em passos de 1/60 s. */
  finishTicks: number | null;
  out: boolean;
  /** Posição relatada pelo aparelho (só com a corrida em andamento ou acabada). */
  x?: number;
  y?: number;
  form?: string;
  dead?: boolean;
  deaths?: number;
  words?: number;
  progress?: number;
};

export type RunnerRoomResult = {
  slot: number;
  name: string;
  bot: boolean;
  place: number;
  finished: boolean;
  ticks: number | null;
  progress: number;
  words: number;
  deaths: number;
  out: boolean;
};

export type RunnerRoomView = {
  changed: true;
  code: string;
  status: RunnerRoomStatus;
  version: number;
  serverNow: number;
  hostUserId: number;
  hostName: string;
  levelSlug: string;
  levelName: string | null;
  maxPlayers: number;
  /** Largada pelo relógio do servidor (ms). */
  startAt: number | null;
  players: RunnerRoomPlayer[];
  me: { slot: number; key: string; userId: number; isHost: boolean } | null;
  results: RunnerRoomResult[] | null;
};

export type RunnerRoomUnchanged = {
  changed: false;
  version: number;
  serverNow: number;
};
export type PublicRunnerRoom = {
  code: string;
  status: RunnerRoomStatus;
  hostName: string;
  levelName: string | null;
  players: number;
  maxPlayers: number;
};
export type RaceReport = {
  x: number;
  y: number;
  form: string;
  dead: boolean;
  deaths: number;
  words: number;
};

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const base = (code: string) => `/runner-room/${encodeURIComponent(code)}`;

export const createRunnerRoom = (input: { levelSlug: string; characterSlug?: string | null }) => apiRequest<RunnerRoomView>('/runner-room', json('POST', input), 'Não foi possível criar a sala.');
export const joinRunnerRoom = (code: string, characterSlug?: string | null) =>
  apiRequest<RunnerRoomView>(`${base(code)}/join`, json('POST', { characterSlug: characterSlug ?? null }), 'Não foi possível entrar na sala.');
export const leaveRunnerRoom = (code: string) => apiRequestVoid(`${base(code)}/leave`, json('POST'), 'Não foi possível sair da sala.');
export const myRunnerRoom = () => apiRequest<{ code: string; status: RunnerRoomStatus } | null>('/runner-room/mine', { method: 'GET' }, 'Não foi possível verificar sua sala.');

/** Consulta a sala. No lobby, com a versão atual o servidor responde "nada mudou" sem mandar a sala. */
export const getRunnerRoom = (code: string, since?: number) =>
  apiRequest<RunnerRoomView | RunnerRoomUnchanged>(`${base(code)}${since === undefined ? '' : `?since=${since}`}`, { method: 'GET' }, 'Não foi possível atualizar a sala.');

export const setRunnerRoomLevel = (code: string, levelSlug: string) => apiRequest<RunnerRoomView>(`${base(code)}/level`, json('PUT', { levelSlug }), 'Não foi possível mudar a fase.');
export const setRunnerRoomCharacter = (code: string, characterSlug: string | null) =>
  apiRequest<RunnerRoomView>(`${base(code)}/character`, json('PUT', { characterSlug }), 'Não foi possível escolher o personagem.');
export const addRunnerRoomBot = (code: string, skill: RoomBotSkill) => apiRequest<RunnerRoomView>(`${base(code)}/bots`, json('POST', { skill }), 'Não foi possível chamar o bot.');
export const setRunnerRoomBotSkill = (code: string, slot: number, skill: RoomBotSkill) =>
  apiRequest<RunnerRoomView>(`${base(code)}/bots/${slot}`, json('PUT', { skill }), 'Não foi possível mudar o nível do bot.');
export const removeRunnerRoomPlayer = (code: string, slot: number) => apiRequest<RunnerRoomView>(`${base(code)}/players/${slot}`, { method: 'DELETE' }, 'Não foi possível tirar o jogador.');
export const startRunnerRace = (code: string) => apiRequest<RunnerRoomView>(`${base(code)}/start`, json('POST'), 'Não foi possível largar.');
export const rematchRunnerRoom = (code: string) => apiRequest<RunnerRoomView>(`${base(code)}/rematch`, json('POST'), 'Não foi possível pedir a revanche.');

/** Posição do aparelho (e a dos bots, quando é o anfitrião): devolve a sala para ver os rivais. */
export const reportRunnerProgress = (code: string, report: RaceReport, bots?: Array<{ slot: number; report: RaceReport }>) =>
  apiRequest<RunnerRoomView>(`${base(code)}/progress`, json('POST', { report, ...(bots && bots.length > 0 ? { bots } : {}) }), 'Não foi possível atualizar a corrida.');

/** Chegada: a partida inteira para o servidor repetir e conferir (`slot` só para o anfitrião mandar a de um bot). */
export const finishRunnerRace = (code: string, segments: RunSegment[], slot?: number) =>
  apiRequest<RunnerRoomView>(`${base(code)}/finish`, json('POST', { segments, ...(slot === undefined ? {} : { slot }) }), 'Não foi possível enviar a chegada.');

/** Prévia do convite, sem login (a pessoa ainda pode não ter conta). */
export async function getPublicRunnerRoom(code: string): Promise<PublicRunnerRoom> {
  const response = await fetchApi(`/runner-public/${encodeURIComponent(code)}`);
  const body = await safeParseJson<PublicRunnerRoom & { message?: string }>(response);
  if (!response.ok || !body) throw new Error(body?.message ?? 'Sala não encontrada. Confira o código.');
  return body;
}

/** Sala da Corrida que a pessoa quer abrir assim que chegar ao painel (link de convite). */
const PENDING_KEY = 'colecao-biblica:corrida-pendente';
export const PENDING_RUNNER_EVENT = 'colecao-biblica:corrida-pendente';
export function setPendingRunnerRoom(code: string) {
  try {
    window.sessionStorage.setItem(PENDING_KEY, code.toUpperCase());
  } catch {
    // Sem armazenamento: a pessoa digita o código.
  }
  window.dispatchEvent(new Event(PENDING_RUNNER_EVENT));
}
export function peekPendingRunnerRoom(): string | null {
  try {
    return window.sessionStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}
export function takePendingRunnerRoom(): string | null {
  const code = peekPendingRunnerRoom();
  try {
    window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // ignora
  }
  return code;
}

export const runnerRoomLink = (code: string) => `${window.location.origin}/corrida/${code}`;
