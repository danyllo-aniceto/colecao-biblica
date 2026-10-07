import type { CSSProperties } from 'react';

type Surface = { imageUrl?: string | null; color?: string | null } | null | undefined;

const safeUrl = (url: string) => url.replace(/["\\()]/g, (char) => encodeURIComponent(char));

/** Fundo de um item visual (fundo de perfil, capa do álbum): a imagem cobre tudo; sem imagem, degradê a partir da cor. */
export function surfaceStyle(item: Surface): CSSProperties | undefined {
  if (!item || (!item.imageUrl && !item.color)) return undefined;
  const color = item.color ?? '#5a2fd6';
  const gradient = `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 55%, black))`;
  return item.imageUrl
    ? { backgroundColor: color, backgroundImage: `url("${safeUrl(item.imageUrl)}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundImage: gradient };
}

/** Capa do álbum: troca as cores do livro (a imagem da capa vai na folha de abertura, ver `coverImageStyle`). */
export function albumCoverStyle(item: Surface): CSSProperties | undefined {
  if (!item?.color) return undefined;
  return { '--album-cover': item.color, '--album-cover-strong': `color-mix(in srgb, ${item.color} 55%, black)` } as CSSProperties;
}

/** Imagem da capa em tela cheia na folha de abertura do álbum. */
export function coverImageStyle(imageUrl?: string | null): CSSProperties | undefined {
  if (!imageUrl) return undefined;
  return { backgroundImage: `url("${safeUrl(imageUrl)}")`, backgroundSize: 'cover', backgroundPosition: 'center' };
}
