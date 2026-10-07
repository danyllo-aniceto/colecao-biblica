import { apiRequest, apiRequestVoid, fetchApi, safeParseJson } from '@/lib/http';
import type { BotSkill } from '@duel/bots';
import type { DuelView } from '@duel/engine';
import type { Series, SeriesFormat } from '@duel/series';

export type DuelRoomStatus = 'LOBBY' | 'PLAYING' | 'FINISHED';

export type DuelRoomConfig = { format: SeriesFormat; levels: boolean; turnSeconds: number };
export const TURN_OPTIONS = [30, 45, 60] as const;

export type DuelRoomPlayer = {
  key: string;
  slot: number;
  userId: number | null;
  name: string;
  bot: BotSkill | null;
  replaced: boolean;
  isHost: boolean;
  connected: boolean;
  hasDeck: boolean;
};

export type DuelRoomView = {
  changed: true;
  code: string;
  status: DuelRoomStatus;
  version: number;
  serverNow: number;
  hostUserId: number;
  hostName: string;
  config: DuelRoomConfig;
  players: DuelRoomPlayer[];
  me: { slot: number; key: string; userId: number; isHost: boolean; deckSlot: number | null; deckName: string | null } | null;
  series: Series | null;
  /** O duelo do seu lado: o servidor nunca manda a mão do rival. */
  duel: DuelView | null;
  round: number;
  roundBreak: { dueAt: number | null; acks: number[] } | null;
  log: string[];
  deadlineAt: number | null;
};

export type DuelRoomUnchanged = { changed: false; version: number; serverNow: number };
export type DuelRoomInvite = { id: number; code: string; fromName: string; players: number; createdAt: string };
export type PublicDuelRoom = { code: string; status: DuelRoomStatus; hostName: string; players: number; maxPlayers: number };

const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const base = (code: string) => `/duel-room/${encodeURIComponent(code)}`;
const ERROR = 'Não foi possível concluir. Tente de novo.';

export const createDuelRoom = (input: { config: Partial<DuelRoomConfig>; deckSlot?: number | null }) => apiRequest<DuelRoomView>('/duel-room', json('POST', input), 'Não foi possível criar a sala.');
export const joinDuelRoom = (code: string, deckSlot?: number | null) => apiRequest<DuelRoomView>(`${base(code)}/join`, json('POST', { deckSlot: deckSlot ?? null }), 'Não foi possível entrar na sala.');
export const leaveDuelRoom = (code: string) => apiRequestVoid(`${base(code)}/leave`, json('POST'), 'Não foi possível sair da sala.');
export const myDuelRoom = () => apiRequest<{ code: string; status: DuelRoomStatus } | null>('/duel-room/mine', { method: 'GET' }, 'Não foi possível verificar sua sala.');

/** Consulta a sala. Com a versão atual, o servidor responde "nada mudou" sem mandar o estado. */
export const getDuelRoom = (code: string, since?: number) =>
  apiRequest<DuelRoomView | DuelRoomUnchanged>(`${base(code)}${since === undefined ? '' : `?since=${since}`}`, { method: 'GET' }, 'Não foi possível atualizar a sala.');

export const updateDuelRoomConfig = (code: string, config: Partial<DuelRoomConfig>) => apiRequest<DuelRoomView>(`${base(code)}/config`, json('PUT', { config }), 'Não foi possível mudar as regras.');
export const setDuelRoomDeck = (code: string, deckSlot: number) => apiRequest<DuelRoomView>(`${base(code)}/deck`, json('PUT', { deckSlot }), 'Não foi possível escolher o Time.');
export const addDuelRoomBot = (code: string, skill: BotSkill) => apiRequest<DuelRoomView>(`${base(code)}/bots`, json('POST', { skill }), 'Não foi possível chamar o bot.');
export const setDuelRoomBotSkill = (code: string, slot: number, skill: BotSkill) => apiRequest<DuelRoomView>(`${base(code)}/bots/${slot}`, json('PUT', { skill }), 'Não foi possível mudar o nível do bot.');
export const removeDuelRoomPlayer = (code: string, slot: number) => apiRequest<DuelRoomView>(`${base(code)}/players/${slot}`, { method: 'DELETE' }, 'Não foi possível tirar o jogador.');
export const startDuelRoom = (code: string) => apiRequest<DuelRoomView>(`${base(code)}/start`, json('POST'), 'Não foi possível começar o duelo.');
export const rematchDuelRoom = (code: string) => apiRequest<DuelRoomView>(`${base(code)}/rematch`, json('POST'), 'Não foi possível pedir a revanche.');
export const stageDuelRoom = (code: string, uid: number, lane: number) => apiRequest<DuelRoomView>(`${base(code)}/stage`, json('POST', { uid, lane }), ERROR);
export const unstageDuelRoom = (code: string, uid: number) => apiRequest<DuelRoomView>(`${base(code)}/unstage`, json('POST', { uid }), ERROR);
export const readyDuelRoom = (code: string) => apiRequest<DuelRoomView>(`${base(code)}/ready`, json('POST'), ERROR);
export const doubleDuelRoom = (code: string) => apiRequest<DuelRoomView>(`${base(code)}/double`, json('POST'), ERROR);
export const retreatDuelRoom = (code: string) => apiRequest<DuelRoomView>(`${base(code)}/retreat`, json('POST'), ERROR);
export const nextDuelRound = (code: string) => apiRequest<DuelRoomView>(`${base(code)}/next`, json('POST'), ERROR);
export const inviteToDuelRoom = (code: string, friendId: number) => apiRequestVoid(`${base(code)}/invite`, json('POST', { friendId }), 'Não foi possível enviar o convite.');

export const listDuelRoomInvites = () => apiRequest<DuelRoomInvite[]>('/duel-room/invites', { method: 'GET' }, 'Não foi possível ver seus convites.');
export const dismissDuelRoomInvite = (id: number) => apiRequestVoid(`/duel-room/invites/${id}`, { method: 'DELETE' }, 'Não foi possível dispensar o convite.');

/** Prévia do convite, sem login (a pessoa ainda pode não ter conta). */
export async function getPublicDuelRoom(code: string): Promise<PublicDuelRoom> {
  const response = await fetchApi(`/duel-public/${encodeURIComponent(code)}`);
  const body = await safeParseJson<PublicDuelRoom & { message?: string }>(response);
  if (!response.ok || !body) throw new Error(body?.message ?? 'Sala não encontrada. Confira o código.');
  return body;
}

/** Sala do Duelo que a pessoa quer abrir assim que chegar ao painel (link de convite ou convite de amigo). */
const PENDING_KEY = 'colecao-biblica:duelo-pendente';
export const PENDING_DUEL_EVENT = 'colecao-biblica:duelo-pendente';
export function setPendingDuelRoom(code: string) {
  try {
    window.sessionStorage.setItem(PENDING_KEY, code.toUpperCase());
  } catch {
    // Sem armazenamento: a pessoa digita o código.
  }
  window.dispatchEvent(new Event(PENDING_DUEL_EVENT));
}
export function peekPendingDuelRoom(): string | null {
  try {
    return window.sessionStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}
export function takePendingDuelRoom(): string | null {
  const code = peekPendingDuelRoom();
  try {
    window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // ignora
  }
  return code;
}

export const duelRoomLink = (code: string) => `${window.location.origin}/duelo/${code}`;
