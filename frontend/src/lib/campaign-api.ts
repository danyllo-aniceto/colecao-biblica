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
  /** Dá um fragmento da carta especial. */
  fragment: boolean;
  rewardCoins: number;
  reward: { id: number; name: string; rewardType: string } | null;
  cosmetic: Cosmetic | null;
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
  scenarios: CampaignScenario[];
};

export type ClaimNodeResult = {
  nodeId: number;
  coins: number;
  reward: { rewardName: string; characterName: string | null } | null;
  cosmeticGranted: boolean;
  cosmeticName: string | null;
  fragments: { claimed: number; total: number } | null;
  specialUnlocked: boolean;
  special: { id: number; name: string; imageUrl: string | null } | null;
  unlockedAchievements: UnlockedAchievement[];
  user: UserProfile;
};

export const getCampaign = () => apiRequest<Campaign>('/campaign', { method: 'GET' }, 'Não foi possível carregar a campanha.');

export const claimCampaignNode = (id: number) =>
  apiRequest<ClaimNodeResult>(`/campaign/nodes/${id}/claim`, { method: 'POST' }, 'Não foi possível resgatar esta parada.');
