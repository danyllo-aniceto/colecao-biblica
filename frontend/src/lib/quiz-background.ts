import type { CSSProperties } from 'react';

/**
 * Fundo da tela do quiz de um cenário: a imagem cobre a tela e uma película na cor do tema deixa
 * o texto legível nos temas claro e escuro. A tela do jogo e a prévia do painel usam esta mesma função.
 */
export function quizBackgroundStyle(url?: string | null): CSSProperties | undefined {
  if (!url) return undefined;
  const safe = url.replace(/["\\()]/g, (char) => encodeURIComponent(char));
  return {
    backgroundImage: `linear-gradient(color-mix(in srgb, var(--bg) 40%, transparent), color-mix(in srgb, var(--bg) 60%, transparent)), url("${safe}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  };
}
