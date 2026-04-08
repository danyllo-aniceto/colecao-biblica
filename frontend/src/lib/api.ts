const defaultBaseUrl = 'http://localhost:8080';

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? defaultBaseUrl;
}

export function buildApiUrl(path: string) {
  const baseUrl = getApiBaseUrl();
  return new URL(path, baseUrl).toString();
}
