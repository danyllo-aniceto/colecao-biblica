import { apiRequest, apiRequestVoid, fetchApi, safeParseJson } from '@/lib/http';
import type { Landmark, PathStyle } from '@board/layout';
import type { Callout } from '@board/callouts';
import type { BoardConfig, BoardState, BotSkill, OptionLetter, PowerUpKind } from '@board/engine';
import type { SheetQuestion } from '@/components/user/board/board-question';

export type RoomStatus = 'LOBBY' | 'PLAYING' | 'FINISHED';

export type RoomPlayer = {
  key: string;
  slot: number;
  userId: number | null;
  name: string;
  pawn: string;
  bot: BotSkill | null;
  replaced: boolean;
  isHost: boolean;
  connected: boolean;
};

export type RoomView = {
  changed: true;
  code: string;
  status: RoomStatus;
  version: number;
  serverNow: number;
  hostUserId: number;
  hostName: string;
  scenario: { id: number; slug: string; name: string; color: string | null; verse: string | null; verseReference: string | null; iconImageUrl: string | null; quizBackgroundUrl: string | null; boardImageUrl: string | null; boardPathStyle: PathStyle | null; boardLandmarks: Landmark[] | null };
  config: BoardConfig;
  players: RoomPlayer[];
  me: { key: string; userId: number; isHost: boolean; wins: number | null } | null;
  state: BoardState | null;
  question: SheetQuestion | null;
  reveal: {
    playerId: string;
    questionId: number;
    selected: OptionLetter | null;
    correct: boolean;
    timedOut: boolean;
    correctOption: OptionLetter;
    explanation: string | null;
    bibleReference: string | null;
  } | null;
  log: string[];
  /** Avisos animados recentes (cada aparelho toca só os que ainda não viu). */
  feed: Array<Callout & { id: string }>;
  deadlineAt: number | null;
};

export type RoomUnchanged = { changed: false; version: number; serverNow: number };

export type RoomInvite = { id: number; code: string; fromName: string; scenarioName: string; players: number; createdAt: string };
export type PublicRoom = { code: string; status: RoomStatus; hostName: string; scenario: { name: string; color: string | null; slug: string; iconImageUrl: string | null }; players: number; maxPlayers: number };

const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const base = (code: string) => `/board/rooms/${encodeURIComponent(code)}`;
const ERROR = 'Não foi possível concluir. Tente de novo.';

export const createRoom = (input: { scenarioId: number; config: BoardConfig; pawn?: string | null }) => apiRequest<RoomView>('/board/rooms', json('POST', input), 'Não foi possível criar a sala.');
export const joinRoom = (code: string, pawn?: string | null) => apiRequest<RoomView>(`${base(code)}/join`, json('POST', { pawn: pawn ?? null }), 'Não foi possível entrar na sala.');
export const leaveRoom = (code: string) => apiRequestVoid(`${base(code)}/leave`, json('POST'), 'Não foi possível sair da sala.');
export const myRoom = () => apiRequest<{ code: string; status: RoomStatus; scenarioName: string } | null>('/board/rooms/mine', { method: 'GET' }, 'Não foi possível verificar sua sala.');

/** Consulta a sala. Com a versão atual, o servidor responde "nada mudou" sem mandar o estado. */
export const getRoom = (code: string, since?: number) =>
  apiRequest<RoomView | RoomUnchanged>(`${base(code)}${since === undefined ? '' : `?since=${since}`}`, { method: 'GET' }, 'Não foi possível atualizar a sala.');

export const updateRoomConfig = (code: string, input: { scenarioId?: number; config?: Partial<BoardConfig> }) => apiRequest<RoomView>(`${base(code)}/config`, json('PUT', input), 'Não foi possível mudar as regras.');
export const setRoomPawn = (code: string, pawn: string) => apiRequest<RoomView>(`${base(code)}/pawn`, json('PUT', { pawn }), 'Não foi possível trocar o peão.');
export const addRoomBot = (code: string, skill: BotSkill) => apiRequest<RoomView>(`${base(code)}/bots`, json('POST', { skill }), 'Não foi possível chamar o bot.');
export const setRoomBotSkill = (code: string, slot: number, skill: BotSkill) => apiRequest<RoomView>(`${base(code)}/bots/${slot}`, json('PUT', { skill }), 'Não foi possível mudar o nível do bot.');
export const removeRoomPlayer = (code: string, slot: number) => apiRequest<RoomView>(`${base(code)}/players/${slot}`, { method: 'DELETE' }, 'Não foi possível tirar o jogador.');
export const startRoom = (code: string) => apiRequest<RoomView>(`${base(code)}/start`, json('POST'), 'Não foi possível começar a partida.');
export const rematchRoom = (code: string) => apiRequest<RoomView>(`${base(code)}/rematch`, json('POST'), 'Não foi possível pedir a revanche.');
export const rollRoom = (code: string) => apiRequest<RoomView>(`${base(code)}/roll`, json('POST'), 'Não foi possível rolar o dado.');
export const powerRoom = (code: string, kind: PowerUpKind, targetId?: string) => apiRequest<RoomView>(`${base(code)}/power`, json('POST', { kind, targetId }), 'Não foi possível usar o power-up.');
export const trialRoom = (code: string, accept: boolean) => apiRequest<RoomView>(`${base(code)}/trial`, json('POST', { accept }), ERROR);
export const answerRoom = (code: string, selected: OptionLetter | null) => apiRequest<RoomView>(`${base(code)}/answer`, json('POST', { selected }), 'Não foi possível enviar a resposta.');
export const continueRoom = (code: string) => apiRequest<RoomView>(`${base(code)}/continue`, json('POST'), ERROR);
export const inviteToRoom = (code: string, friendId: number) => apiRequestVoid(`${base(code)}/invite`, json('POST', { friendId }), 'Não foi possível enviar o convite.');

export const listRoomInvites = () => apiRequest<RoomInvite[]>('/board/invites', { method: 'GET' }, 'Não foi possível ver seus convites.');
export const dismissRoomInvite = (id: number) => apiRequestVoid(`/board/invites/${id}`, { method: 'DELETE' }, 'Não foi possível dispensar o convite.');

/** Prévia do convite, sem login (a pessoa ainda pode não ter conta). */
export async function getPublicRoom(code: string): Promise<PublicRoom> {
  const response = await fetchApi(`/board-public/${encodeURIComponent(code)}`);
  const body = await safeParseJson<PublicRoom & { message?: string }>(response);
  if (!response.ok || !body) throw new Error(body?.message ?? 'Sala não encontrada. Confira o código.');
  return body;
}

/** Sala que a pessoa quer abrir assim que chegar ao painel (link de convite ou convite de amigo). */
const PENDING_KEY = 'colecao-biblica:sala-pendente';
export const PENDING_ROOM_EVENT = 'colecao-biblica:sala-pendente';
export function setPendingRoom(code: string) {
  try {
    window.sessionStorage.setItem(PENDING_KEY, code.toUpperCase());
  } catch {
    // Sem armazenamento: a pessoa digita o código.
  }
  window.dispatchEvent(new Event(PENDING_ROOM_EVENT));
}
export function peekPendingRoom(): string | null {
  try {
    return window.sessionStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
}
export function takePendingRoom(): string | null {
  const code = peekPendingRoom();
  try {
    window.sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // ignora
  }
  return code;
}

export function roomLink(code: string) {
  return `${window.location.origin}/sala/${code}`;
}
