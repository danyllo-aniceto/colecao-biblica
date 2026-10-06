export type LoginRequest = {
  email: string;
  password: string;
};

export type RegisterRequest = {
  name: string;
  email: string;
  password: string;
  role: 'USER';
};

export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
};

export type UserProfile = {
  id: number;
  xp?: number;
  level?: number;
  coins?: number;
  totalScore?: number;
  extraLifeBoosts?: number;
  extraTimeBoosts?: number;
  doubleXpBoosts?: number;
  hintBoosts?: number;
  streakFreezes?: number;
  stickerPity?: number;
  dailyStreak?: number;
  friendCode?: string | null;
  skipBoosts?: number;
  secondChanceBoosts?: number;
  crowdBoosts?: number;
  verseHintBoosts?: number;
  freezeTimeBoosts?: number;
  doubleCoinsBoosts?: number;
  comboShieldBoosts?: number;
  bestCombo?: number;
  chestsPending?: number;
  avatarId?: number | null;
  frameId?: number | null;
  titleId?: number | null;
  nameColorId?: number | null;
  profileBgId?: number | null;
  albumCoverId?: number | null;
  badgeId?: number | null;
  showcase?: number[];
  lastDailyClaim?: string | null;
  name: string;
  email: string;
  role: 'ADMIN' | 'USER';
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  deleted?: boolean;
  deletedAt?: string | null;
  deletedBy?: string | null;
};

export type ApiErrorResponse = {
  message?: string;
};
