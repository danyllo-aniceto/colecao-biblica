import type { ChestPrize } from '@/lib/user-api';
import { apiRequest } from '@/lib/http';
import type { StickerRarity } from '@/lib/admin-api';
import type { Cosmetic } from '@/lib/rewards-api';
import type { UnlockedAchievement } from '@/lib/user-api';
import type { UserProfile } from '@/types/auth';

export type CampaignNodeState = 'claimed' | 'available' | 'locked';

export type CampaignNode = {
  id: number;
  level: number;
  title: string | null;
  /** Última parada do cenário: a relíquia. */
  relic: boolean;
  /** Dá um fragmento da figurinha especial. */
  fragment: boolean;
  rewardCoins: number;
  reward: { id: number; name: string; rewardType: string } | null;
  cosmetic: Cosmetic | null;
  /** Ícone de perfil do cenário, entregue com a relíquia. */
  avatar: Cosmetic | null;
  /** Posição no mapa, em %. */
  x: number;
  y: number;
  state: CampaignNodeState;
};

export type CampaignScenario = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  verse: string | null;
  verseReference: string | null;
  color: string | null;
  mapImageUrl: string | null;
  iconImageUrl: string | null;
  /** Imagem de fundo da tela do quiz neste cenário. */
  quizBackgroundUrl?: string | null;
  /** Imagem de fundo do tabuleiro deste cenário. */
  boardImageUrl?: string | null;
  /** Música do tema: liberada ao chegar ao primeiro nível do cenário. */
  /** Tem música cadastrada (mesmo bloqueada). */
  hasMusic: boolean;
  musicUnlocked: boolean;
  musicUrl: string | null;
  startLevel: number | null;
  endLevel: number | null;
  total: number;
  claimed: number;
  completed: boolean;
  nodes: CampaignNode[];
};

export type CampaignSpecial = {
  character: { id: number; name: string; imageUrl: string | null; rarity: StickerRarity };
  fragments: number;
  totalFragments: number;
  owned: boolean;
};

export type Campaign = {
  level: number;
  currentScenarioId: number | null;
  special: CampaignSpecial | null;
  /** O que o Baú de Esmeralda traz (prêmio da figurinha especial). */
  emeraldChest: { coins: number; helpers: number; stickerRarities: StickerRarity[]; cosmetics: Cosmetic[] };
  scenarios: CampaignScenario[];
};

export type ClaimNodeResult = {
  nodeId: number;
  coins: number;
  reward: { rewardName: string; characterName: string | null } | null;
  cosmeticGranted: boolean;
  cosmeticName: string | null;
  avatarGranted: boolean;
  fragments: { claimed: number; total: number } | null;
  specialUnlocked: boolean;
  special: { id: number; name: string; imageUrl: string | null } | null;
  /** Ao conquistar a figurinha especial: o Baú de Esmeralda e tudo que ele trouxe. */
  emeraldChest?: { tier: 'EMERALD'; prizes: ChestPrize[] } | null;
  unlockedAchievements: UnlockedAchievement[];
  user: UserProfile;
};

export const getCampaign = () => apiRequest<Campaign>('/campaign', { method: 'GET' }, 'Não foi possível carregar a campanha.');

export const claimCampaignNode = (id: number) =>
  apiRequest<ClaimNodeResult>(`/campaign/nodes/${id}/claim`, { method: 'POST' }, 'Não foi possível resgatar esta parada.');
