import { apiRequest, apiRequestVoid } from '@/lib/http';
import type { PaginatedResponse, StickerRarity } from '@/lib/admin-api';
import type { UnlockedAchievement } from '@/lib/user-api';

export type UserCard = { id: number; name: string; level: number };

export type Friend = {
  userId: number;
  name: string;
  level: number;
  stickers: number;
  duplicates: number;
  unread: number;
  lastMessage: { text: string; createdAt: string; mine: boolean } | null;
};

export type FriendRequests = {
  incoming: Array<{ id: number; createdAt: string; user: UserCard }>;
  outgoing: Array<{ id: number; createdAt: string; user: UserCard }>;
  blocked: Array<{ id: number; createdAt: string; user: UserCard }>;
};

export type SocialSummary = {
  pendingRequests: number;
  pendingTrades: number;
  unreadMessages: number;
};

export type TradeCharacter = {
  id: number;
  name: string;
  rarity: StickerRarity;
  imageUrl?: string | null;
};

export type TradeStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';

export type Trade = {
  id: number;
  proposerId: number;
  receiverId: number;
  status: TradeStatus;
  message?: string | null;
  createdAt: string;
  respondedAt?: string | null;
  offered: TradeCharacter | null;
  requested: TradeCharacter | null;
  proposer?: UserCard;
  receiver?: UserCard;
};

export type ChatMessage = {
  id: number;
  senderId: number;
  text: string;
  createdAt: string;
  readAt?: string | null;
  trade: Trade | null;
};

export type ChatPage = {
  chatEnabled: boolean;
  hasMore: boolean;
  messages: ChatMessage[];
};

export type AlbumCard = {
  characterId: number;
  name: string;
  rarity: StickerRarity;
  imageUrl?: string | null;
  duplicates: number;
};

export type FriendAlbum = {
  friend: UserCard;
  owned: number;
  theirDuplicates: Array<AlbumCard & { iOwn: boolean }>;
  myDuplicates: Array<AlbumCard & { theyOwn: boolean }>;
};

export type TradeResponse = {
  trade: Trade;
  received: (TradeCharacter & { unlocked: boolean }) | null;
  unlockedAchievements: UnlockedAchievement[];
};

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

export const getMyFriendCode = () => apiRequest<{ friendCode: string }>('/social/me', { method: 'GET' }, 'Não foi possível carregar seu código.');
export const getSocialSummary = () => apiRequest<SocialSummary>('/social/summary', { method: 'GET' }, 'Não foi possível carregar os avisos.');
export const listFriends = (page = 0, size = 20) => apiRequest<PaginatedResponse<Friend>>(`/social/friends?page=${page}&size=${size}`, { method: 'GET' }, 'Não foi possível carregar seus amigos.');
export const sendFriendRequest = (code: string) =>
  apiRequest<{
    status: 'PENDING' | 'ACCEPTED';
    friend: { id: number; name: string };
  }>('/social/friends/request', json('POST', { code }), 'Não foi possível enviar o pedido.');
export const listFriendRequests = () => apiRequest<FriendRequests>('/social/friends/requests', { method: 'GET' }, 'Não foi possível carregar os pedidos.');
export const respondFriendRequest = (id: number, accept: boolean) =>
  apiRequest<{ status: string; unlockedAchievements?: UnlockedAchievement[] }>(`/social/friends/requests/${id}/${accept ? 'accept' : 'decline'}`, json('POST'), 'Não foi possível responder o pedido.');
export const cancelFriendRequest = (id: number) => apiRequestVoid(`/social/friends/requests/${id}`, { method: 'DELETE' }, 'Não foi possível cancelar o pedido.');
export const removeFriend = (userId: number) => apiRequestVoid(`/social/friends/${userId}`, { method: 'DELETE' }, 'Não foi possível desfazer a amizade.');
export const blockUser = (userId: number) => apiRequestVoid(`/social/friends/${userId}/block`, json('POST'), 'Não foi possível bloquear.');
export const unblockUser = (userId: number) => apiRequestVoid(`/social/friends/${userId}/block`, { method: 'DELETE' }, 'Não foi possível desbloquear.');
export const getFriendAlbum = (userId: number) => apiRequest<FriendAlbum>(`/social/friends/${userId}/album`, { method: 'GET' }, 'Não foi possível abrir o álbum do amigo.');
export const getChat = (userId: number, before?: number) =>
  apiRequest<ChatPage>(`/social/chat/${userId}?limit=30${before ? `&before=${before}` : ''}`, { method: 'GET' }, 'Não foi possível carregar a conversa.');
export const sendChatMessage = (userId: number, text: string) => apiRequest<ChatMessage>(`/social/chat/${userId}`, json('POST', { text }), 'Não foi possível enviar a mensagem.');
export const createTrade = (payload: { toUserId: number; offeredCharacterId?: number | null; requestedCharacterId?: number | null; message?: string }) =>
  apiRequest<Trade>('/social/trades', json('POST', payload), 'Não foi possível enviar a proposta.');
export const listTrades = (box: 'received' | 'sent' | 'history', page = 0, size = 10) =>
  apiRequest<PaginatedResponse<Trade>>(`/social/trades?box=${box}&page=${page}&size=${size}`, { method: 'GET' }, 'Não foi possível carregar as trocas.');
export const respondTrade = (id: number, action: 'accept' | 'decline' | 'cancel') =>
  apiRequest<TradeResponse>(`/social/trades/${id}/${action}`, json('POST'), 'Não foi possível responder a proposta.');
