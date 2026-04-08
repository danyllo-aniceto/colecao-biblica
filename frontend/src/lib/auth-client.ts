import { buildApiUrl } from '@/lib/api';
import type { ApiErrorResponse, AuthResponse, LoginRequest, RegisterRequest, UserProfile } from '@/types/auth';

async function safeParseJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function extractErrorMessage(payload: ApiErrorResponse | null, fallback: string) {
  return payload?.message ?? fallback;
}

export async function login(payload: LoginRequest): Promise<AuthResponse> {
  const response = await fetch(buildApiUrl('/auth/login'), {
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
  const response = await fetch(buildApiUrl('/users'), {
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

export async function getCurrentUser(accessToken: string): Promise<UserProfile> {
  const response = await fetch(buildApiUrl('/users/me'), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await safeParseJson<UserProfile & ApiErrorResponse>(response);

  if (!response.ok || !body?.id || !body?.role) {
    throw new Error(extractErrorMessage(body, 'Não foi possível carregar o usuário atual.'));
  }

  return body;
}

export async function listUsers(accessToken: string): Promise<UserProfile[]> {
  const response = await fetch(buildApiUrl('/users?page=0&size=100'), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await safeParseJson<{ content?: UserProfile[] } & ApiErrorResponse>(response);

  if (!response.ok) {
    throw new Error(extractErrorMessage(body, 'Não foi possível listar os usuários.'));
  }

  return body?.content ?? [];
}
