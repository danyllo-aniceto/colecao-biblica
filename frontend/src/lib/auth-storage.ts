const ACCESS_TOKEN_KEY = 'colecao-biblica:access-token';
const REFRESH_TOKEN_KEY = 'colecao-biblica:refresh-token';
const PROFILE_KEY = 'colecao-biblica:profile';

function getStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

export function storeAuthTokens(tokens: { accessToken: string; refreshToken: string }) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  storage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearAuthTokens() {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(ACCESS_TOKEN_KEY);
  storage.removeItem(REFRESH_TOKEN_KEY);
}

export function storeAuthProfile(profile: unknown) {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function getAuthProfile<T = unknown>(): T | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  const raw = storage.getItem(PROFILE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearAuthProfile() {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  storage.removeItem(PROFILE_KEY);
}

export function getAccessToken() {
  const storage = getStorage();
  return storage?.getItem(ACCESS_TOKEN_KEY) ?? null;
}

export function getRefreshToken() {
  const storage = getStorage();
  return storage?.getItem(REFRESH_TOKEN_KEY) ?? null;
}
