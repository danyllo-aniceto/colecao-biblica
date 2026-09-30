import { buildApiUrl } from '@/lib/api';
import { getAccessToken, getRefreshToken, storeAuthTokens } from '@/lib/auth-storage';
import type { ApiErrorResponse, AuthResponse } from '@/types/auth';

/** Disparado quando a sessão não pode mais ser renovada; o AuthProvider faz o logout. */
export const SESSION_EXPIRED_EVENT = 'colecao-biblica:session-expired';

const NETWORK_ERROR_MESSAGE = 'Sem conexão com o servidor. Verifique sua internet e tente novamente.';

type RefreshResult = { kind: 'ok'; accessToken: string } | { kind: 'invalid' } | { kind: 'network' };

let refreshInFlight: Promise<RefreshResult> | null = null;

export async function safeParseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function extractErrorMessage(payload: ApiErrorResponse | null, fallback: string) {
  return payload?.message ?? fallback;
}

/** fetch que converte falha de rede em uma mensagem amigável. */
export async function fetchApi(path: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(buildApiUrl(path), init);
  } catch {
    throw new Error(NETWORK_ERROR_MESSAGE);
  }
}

async function requestRefresh(): Promise<RefreshResult> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return { kind: 'invalid' };
  }

  let response: Response;
  try {
    response = await fetch(buildApiUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
  } catch {
    // Sem rede não significa sessão inválida: mantém o usuário logado.
    return { kind: 'network' };
  }

  if (!response.ok) {
    return response.status >= 500 ? { kind: 'network' } : { kind: 'invalid' };
  }

  const body = await safeParseJson<AuthResponse>(response);
  if (!body?.accessToken || !body.refreshToken) {
    return { kind: 'invalid' };
  }

  storeAuthTokens(body);
  return { kind: 'ok', accessToken: body.accessToken };
}

/** Renova o access token; chamadas concorrentes compartilham a mesma renovação. */
function refreshAccessToken(): Promise<RefreshResult> {
  if (!refreshInFlight) {
    refreshInFlight = requestRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

function buildHeaders(init: RequestInit, accessToken: string | null): HeadersInit {
  return {
    ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(init.headers ?? {}),
  };
}

/**
 * Requisição autenticada: usa o token mais recente salvo e, ao receber 401,
 * renova a sessão uma vez e repete a requisição.
 */
export async function authorizedFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetchApi(path, { ...init, headers: buildHeaders(init, getAccessToken()) });
  if (response.status !== 401) {
    return response;
  }

  const refreshed = await refreshAccessToken();
  if (refreshed.kind === 'ok') {
    return fetchApi(path, { ...init, headers: buildHeaders(init, refreshed.accessToken) });
  }

  if (refreshed.kind === 'invalid' && typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
  }

  if (refreshed.kind === 'network') {
    throw new Error(NETWORK_ERROR_MESSAGE);
  }

  return response;
}

export async function apiRequest<T>(path: string, init: RequestInit, fallbackError: string): Promise<T> {
  const response = await authorizedFetch(path, init);
  const body = await safeParseJson<T & ApiErrorResponse>(response);

  if (!response.ok) {
    throw new Error(extractErrorMessage(body, fallbackError));
  }

  return body as T;
}

export async function apiRequestVoid(path: string, init: RequestInit, fallbackError: string): Promise<void> {
  const response = await authorizedFetch(path, init);

  if (!response.ok) {
    const body = await safeParseJson<ApiErrorResponse>(response);
    throw new Error(extractErrorMessage(body, fallbackError));
  }
}
