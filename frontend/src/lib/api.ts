/** A API roda no mesmo domínio do app, em /api (função serverless na Vercel, proxy do Vite no dev). */
const API_PREFIX = '/api';

export function buildApiUrl(path: string) {
  return `${API_PREFIX}${path}`;
}
