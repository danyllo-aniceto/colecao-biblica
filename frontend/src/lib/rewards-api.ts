import { apiRequest } from '@/lib/http';
import type { StickerRarity } from '@/lib/admin-api';
import type { UnlockedAchievement } from '@/lib/user-api';
import type { UserProfile } from '@/types/auth';

export type CosmeticType = 'AVATAR' | 'FRAME' | 'TITLE' | 'NAME_COLOR' | 'REACTION';
export type CosmeticUnlock = 'FREE' | 'SHOP' | 'REQUIREMENT' | 'REWARD';

export type Cosmetic = {
  id: number;
  type: CosmeticType;
  name: string;
  description?: string | null;
  rarity: StickerRarity;
  imageUrl?: string | null;
  color?: string | null;
  /** Título: plain/glow/rainbow/pulse/shimmer/wave. Moldura: solid/wood/copper/silver/gold/fire/rainbow/ice/sunset/laurel/aurora/neon/royal/galaxy/pearl/pentecost. Reação: emoji. */
  style?: string | null;
  unlock: CosmeticUnlock;
  priceCoins?: number | null;
  requirement?: string | null;
  requirementValue?: number | null;
  requirementLabel?: string | null;
  inChestPool: boolean;
  eventId?: number | null;
  active: boolean;
  system: boolean;
  sortOrder: number;
};

export type InventoryItem = Cosmetic & {
  owned: boolean;
  acquiredAt: string | null;
  forSale: boolean;
  eventName: string | null;
  eventEndsAt: string | null;
  progress: { current: number; target: number } | null;
};

export type UnlockedCosmetic = { id: number; name: string; type: CosmeticType; rarity: StickerRarity };

export type Inventory = {
  unlocked: UnlockedCosmetic[];
  equipped: { avatarId: number | null; frameId: number | null; titleId: number | null; nameColorId: number | null };
  coins: number;
  items: InventoryItem[];
};

/** Aparência de um jogador (ranking, amigos, conversa, perfil). */
export type PlayerLook = {
  avatarUrl: string | null;
  frame: { imageUrl: string | null; color: string | null; style: string | null } | null;
  title: { name: string; color: string | null; style: string | null; rarity: string } | null;
  nameColor: string | null;
};

export type PlayerProfile = {
  id: number;
  name: string;
  level: number;
  xp: number;
  memberSince: string;
  look: PlayerLook;
  album: { owned: number; total: number };
  stats: { matches: number; achievements: number; dailyStreak: number; bestCombo: number; leagueWins: number };
  showcase: Array<{ id: number; name: string; rarity: StickerRarity; imageUrl?: string | null }>;
};

export type ChestResult = {
  level: number;
  coins: number;
  boost: { field: string; name: string } | null;
  cosmetic: Cosmetic | null;
  chestsPending: number;
  user: UserProfile;
};

export type CollectionCard = { id: number; name: string | null; rarity: StickerRarity; imageUrl?: string | null; owned: boolean };

export type ThemeCollection = {
  id: number;
  name: string;
  description?: string | null;
  rewardCoins: number;
  rewardCosmetic: Cosmetic | null;
  characters: CollectionCard[];
  owned: number;
  total: number;
  complete: boolean;
  claimed: boolean;
};

export type PassTierView = {
  id: number;
  level: number;
  requiredXp: number;
  rewardCoins: number;
  reward: { id: number; name: string; rewardType: string } | null;
  cosmetic: Cosmetic | null;
  reached: boolean;
  claimed: boolean;
};

export type SeasonPass = { monthKey: string; endsAt: string; xp: number; tiers: PassTierView[] };

export type GameEvent = {
  id: number;
  name: string;
  description?: string | null;
  startsAt: string;
  endsAt: string;
  xpMultiplier: number;
  coinMultiplier: number;
  color?: string | null;
  imageUrl?: string | null;
  active: boolean;
  cosmetics?: Cosmetic[];
};

export const getInventory = () => apiRequest<Inventory>('/cosmetics', { method: 'GET' }, 'Não foi possível carregar seus itens.');
export const buyCosmetic = (id: number) =>
  apiRequest<{ cosmetic: Cosmetic; userCoins: number }>(`/cosmetics/${id}/buy`, { method: 'POST' }, 'Não foi possível comprar o item.');
export const equipCosmetic = (type: CosmeticType, cosmeticId: number | null) =>
  apiRequest<PlayerLook>('/cosmetics/equip', { method: 'PUT', body: JSON.stringify({ type, cosmeticId }) }, 'Não foi possível equipar o item.');
export const setShowcase = (characterIds: number[]) =>
  apiRequest<PlayerProfile>('/cosmetics/showcase', { method: 'PUT', body: JSON.stringify({ characterIds }) }, 'Não foi possível salvar a vitrine.');
export const getPlayerProfile = (userId: number) => apiRequest<PlayerProfile>(`/cosmetics/profile/${userId}`, { method: 'GET' }, 'Não foi possível abrir o perfil.');
export const openChest = () => apiRequest<ChestResult>('/chests/open', { method: 'POST' }, 'Não foi possível abrir o baú.');
export const listThemeCollections = () => apiRequest<ThemeCollection[]>('/collections', { method: 'GET' }, 'Não foi possível carregar as coleções.');
export const claimThemeCollection = (id: number) =>
  apiRequest<{ coins: number; cosmeticGranted: boolean; userCoins: number }>(`/collections/${id}/claim`, { method: 'POST' }, 'Não foi possível resgatar a coleção.');
export const getSeasonPass = () => apiRequest<SeasonPass>('/pass', { method: 'GET' }, 'Não foi possível carregar o passe.');
export const claimPassTier = (id: number) =>
  apiRequest<{ coins: number; reward: { rewardName: string; characterName: string | null } | null; cosmeticGranted: boolean; unlockedAchievements: UnlockedAchievement[]; user: UserProfile }>(
    `/pass/tiers/${id}/claim`,
    { method: 'POST' },
    'Não foi possível resgatar o prêmio do passe.',
  );
export const getActiveEvent = () => apiRequest<GameEvent | null>('/events/active', { method: 'GET' }, 'Não foi possível carregar o evento.');
