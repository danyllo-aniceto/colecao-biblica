'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getAccessToken,
  getRefreshToken,
  clearAuthTokens,
  storeAuthTokens,
  storeAuthProfile,
  getAuthProfile,
  clearAuthProfile,
} from '@/lib/auth-storage';
import { getCurrentUser, login, register } from '@/lib/auth-client';
import type { AuthResponse, LoginRequest, RegisterRequest, UserProfile } from '@/types/auth';

type AuthState = {
  isAuthenticated: boolean;
  isHydrated: boolean;
  accessToken: string | null;
  refreshToken: string | null;
  user: UserProfile | null;
  isAdmin: boolean;
  signIn: (payload: LoginRequest) => Promise<AuthResponse>;
  signUp: (payload: RegisterRequest) => Promise<AuthResponse>;
  signOut: () => void;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const storedAccessToken = getAccessToken();
    const storedRefreshToken = getRefreshToken();
    const storedProfile = getAuthProfile<UserProfile>();

    setAccessToken(storedAccessToken);
    setRefreshToken(storedRefreshToken);
    setUser(storedProfile);
    setIsHydrated(true);

    if (storedAccessToken && storedRefreshToken && !storedProfile) {
      getCurrentUser(storedAccessToken)
        .then((profile) => {
          setUser(profile);
          storeAuthProfile(profile);
        })
        .catch(() => {
          clearAuthTokens();
          clearAuthProfile();
          setAccessToken(null);
          setRefreshToken(null);
          setUser(null);
          router.replace('/');
        });
    }
  }, [router]);

  async function signIn(payload: LoginRequest) {
    const tokens = await login(payload);
    storeAuthTokens(tokens);
    setAccessToken(tokens.accessToken);
    setRefreshToken(tokens.refreshToken);
    const profile = await getCurrentUser(tokens.accessToken);
    storeAuthProfile(profile);
    setUser(profile);
    return tokens;
  }

  async function signUp(payload: RegisterRequest) {
    await register(payload);
    const tokens = await login({ email: payload.email, password: payload.password });
    storeAuthTokens(tokens);
    setAccessToken(tokens.accessToken);
    setRefreshToken(tokens.refreshToken);
    const profile = await getCurrentUser(tokens.accessToken);
    storeAuthProfile(profile);
    setUser(profile);
    return tokens;
  }

  function signOut() {
    clearAuthTokens();
    clearAuthProfile();
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    router.replace('/');
  }

  const value = useMemo<AuthState>(() => {
    return {
      isAuthenticated: Boolean(accessToken && refreshToken && user),
      isHydrated,
      accessToken,
      refreshToken,
      user,
      isAdmin: user?.role === 'ADMIN',
      signIn,
      signUp,
      signOut,
    };
  }, [accessToken, refreshToken, isHydrated, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
