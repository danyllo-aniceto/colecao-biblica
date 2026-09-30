import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { SESSION_EXPIRED_EVENT } from '@/lib/http';
import { clearCachedUserData } from '@/lib/pwa';
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
  const navigate = useNavigate();
  const [isHydrated, setIsHydrated] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);

  const signOut = useCallback(() => {
    clearAuthTokens();
    clearAuthProfile();
    clearCachedUserData();
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
    navigate('/', { replace: true });
  }, [navigate]);

  // Sincroniza uma única vez com o localStorage após a hidratação (o servidor não tem acesso a ele).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const storedAccessToken = getAccessToken();
    const storedRefreshToken = getRefreshToken();
    const storedProfile = getAuthProfile<UserProfile>();

    setAccessToken(storedAccessToken);
    setRefreshToken(storedRefreshToken);
    setUser(storedProfile);
    setIsHydrated(true);

    if (storedAccessToken && storedRefreshToken && !storedProfile) {
      getCurrentUser()
        .then((profile) => {
          setUser(profile);
          storeAuthProfile(profile);
        })
        .catch(() => {
          signOut();
        });
    }
  }, [signOut]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // A camada HTTP avisa quando o refresh token também expirou.
  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, signOut);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, signOut);
  }, [signOut]);

  const startSession = useCallback(async (tokens: AuthResponse) => {
    // Descarta dados offline de uma sessão anterior (possivelmente de outro usuário).
    clearCachedUserData();
    storeAuthTokens(tokens);
    setAccessToken(tokens.accessToken);
    setRefreshToken(tokens.refreshToken);
    const profile = await getCurrentUser();
    storeAuthProfile(profile);
    setUser(profile);
    return tokens;
  }, []);

  const signIn = useCallback(async (payload: LoginRequest) => {
    return startSession(await login(payload));
  }, [startSession]);

  const signUp = useCallback(async (payload: RegisterRequest) => {
    await register(payload);
    return startSession(await login({ email: payload.email, password: payload.password }));
  }, [startSession]);

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
  }, [accessToken, refreshToken, isHydrated, user, signIn, signUp, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
