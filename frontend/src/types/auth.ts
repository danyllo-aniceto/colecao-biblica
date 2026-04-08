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
