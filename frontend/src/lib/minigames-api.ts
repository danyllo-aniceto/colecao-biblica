import { apiRequest } from '@/lib/http';
import type { PaginatedResponse } from '@/lib/admin-api';
import type { PlayerLook } from '@/lib/rewards-api';

export type MiniGameInfo = {
  id: string;
  name: string;
  emoji: string;
  text: string;
  /** Pedra do Peitoral que libera o jogo (1 a 12). */
  stoneSlot: number;
  stoneName: string | null;
  /** O jogo já existe no app (os demais aparecem como "em preparo"). */
  ready: boolean;
  unlocked: boolean;
};

export type MiniGamesOverview = { games: MiniGameInfo[]; rankingUnlocked: boolean; weekKey: string };

export type MiniRankingEntry = { position: number; userId: number; userName: string; level: number; look: PlayerLook | null; total: number };
export type MiniRankingPage = PaginatedResponse<MiniRankingEntry> & { weekKey: string; me: { position: number; total: number } | null };

export type GalleryEntry = { position: number; userId: number; userName: string; level: number; look: PlayerLook | null; completedAt: string };
export type GalleryPage = PaginatedResponse<GalleryEntry> & { me: { completedAt: string } | null };

export const getMiniGames = () => apiRequest<MiniGamesOverview>('/minigames', { method: 'GET' }, 'Não foi possível carregar os mini games.');

export const getMiniRanking = (page = 0, size = 20) => apiRequest<MiniRankingPage>(`/minigames/ranking?page=${page}&size=${size}`, { method: 'GET' }, 'Não foi possível carregar o ranking dos mini games.');

export const getPeitoralGallery = (page = 0, size = 20) => apiRequest<GalleryPage>(`/minigames/gallery?page=${page}&size=${size}`, { method: 'GET' }, 'Não foi possível carregar a Galeria dos Peitorais.');
