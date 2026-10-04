import type { CSSProperties } from 'react';

/**
 * Fundo do tabuleiro de um cenário: a imagem cobre o caminho e uma película leve na cor do tema
 * mantém as casas legíveis nos temas claro e escuro. O jogo e a prévia do painel usam esta função.
 * Sem imagem, vale o fundo normal da tela do jogo.
 */
export function boardBackgroundStyle(url?: string | null): CSSProperties | undefined {
  if (!url) return undefined;
  const safe = url.replace(/["\\()]/g, (char) => encodeURIComponent(char));
  return {
    backgroundImage: `linear-gradient(color-mix(in srgb, var(--bg) 18%, transparent), color-mix(in srgb, var(--bg) 32%, transparent)), url("${safe}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };
}
