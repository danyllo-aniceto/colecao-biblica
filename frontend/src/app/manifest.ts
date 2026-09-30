import type { MetadataRoute } from 'next';
import { THEME_COLORS } from '@/lib/theme';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Coleção Bíblica',
    short_name: 'Coleção Bíblica',
    description: 'Aprenda sobre a Bíblia jogando quizzes, colecionando figurinhas e subindo no ranking.',
    lang: 'pt-BR',
    dir: 'ltr',
    // Usuário sem sessão é redirecionado para o login pela própria rota.
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    background_color: THEME_COLORS.light,
    theme_color: THEME_COLORS.light,
    categories: ['education', 'games', 'books'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
