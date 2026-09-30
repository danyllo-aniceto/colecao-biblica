import { apiRequest, extractErrorMessage, fetchApi, safeParseJson } from '@/lib/http';
import type { ApiErrorResponse, AuthResponse, LoginRequest, RegisterRequest, UserProfile } from '@/types/auth';

export async function login(payload: LoginRequest): Promise<AuthResponse> {
  const response = await fetchApi('/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const body = await safeParseJson<AuthResponse & ApiErrorResponse>(response);

  if (!response.ok || !body?.accessToken || !body?.refreshToken) {
    throw new Error(extractErrorMessage(body, 'Falha ao autenticar. Verifique seus dados.'));
  }

  return {
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
  };
}

export async function register(payload: RegisterRequest): Promise<void> {
  const response = await fetchApi('/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (response.ok) {
    return;
  }

  const body = await safeParseJson<ApiErrorResponse>(response);
  throw new Error(extractErrorMessage(body, 'Não foi possível criar o usuário.'));
}

export async function getCurrentUser(): Promise<UserProfile> {
  const body = await apiRequest<UserProfile>('/users/me', { method: 'GET' }, 'Não foi possível carregar o usuário atual.');

  if (!body?.id || !body?.role) {
    throw new Error('Não foi possível carregar o usuário atual.');
  }

  return body;
}
