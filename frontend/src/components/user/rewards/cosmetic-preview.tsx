import { PlayerAvatar, PlayerTitle, ReactionGlyph } from '@/components/game/player-look';
import { albumCoverStyle, surfaceStyle } from '@/lib/look-background';
import type { Cosmetic } from '@/lib/rewards-api';

export const COSMETIC_TYPE_LABELS: Record<Cosmetic['type'], { one: string; many: string }> = {
  AVATAR: { one: 'Ícone', many: 'Ícones' },
  FRAME: { one: 'Moldura', many: 'Molduras' },
  TITLE: { one: 'Título', many: 'Títulos' },
  NAME_COLOR: { one: 'Cor do nome', many: 'Cores do nome' },
  REACTION: { one: 'Reação', many: 'Reações' },
  PROFILE_BG: { one: 'Fundo de perfil', many: 'Fundos de perfil' },
  ALBUM_COVER: { one: 'Capa do álbum', many: 'Capas do álbum' },
};

/** Como o item fica no jogador: usa o ícone atual para mostrar molduras. */
export function CosmeticPreview({ item, playerName, avatarUrl, size = 'lg' }: { item: Cosmetic; playerName: string; avatarUrl?: string | null; size?: 'md' | 'lg' }) {
  switch (item.type) {
    case 'AVATAR':
      return <PlayerAvatar look={{ avatarUrl: item.imageUrl ?? null, frame: null }} name={playerName} size={size} />;
    case 'FRAME':
      return <PlayerAvatar look={{ avatarUrl: avatarUrl ?? null, frame: { imageUrl: item.imageUrl ?? null, color: item.color ?? null, style: item.style ?? 'solid' } }} name={playerName} size={size} />;
    case 'TITLE':
      return <PlayerTitle title={{ name: item.name, color: item.color ?? null, style: item.style ?? 'plain', rarity: item.rarity }} className="max-w-full text-sm" />;
    case 'NAME_COLOR':
      return (
        <span className="truncate font-display text-lg font-bold" style={{ color: item.color ?? undefined }}>
          {playerName}
        </span>
      );
    case 'REACTION':
      return <ReactionGlyph reaction={item} size={size === 'lg' ? 'md' : 'sm'} />;
    case 'PROFILE_BG':
      return (
        <span className="flex h-full min-h-12 w-full items-center gap-2 overflow-hidden rounded-xl px-2" style={surfaceStyle(item)}>
          <PlayerAvatar look={{ avatarUrl: avatarUrl ?? null, frame: null }} name={playerName} size="sm" />
          <span className="h-2 w-10 rounded-full bg-white/70" />
        </span>
      );
    case 'ALBUM_COVER':
      return (
        <span className="album-cover relative flex h-16 w-12 shrink-0 items-center justify-center rounded-md" style={albumCoverStyle(item)}>
          <span className="h-10 w-7 rounded-sm bg-[var(--album-paper)] opacity-90" />
        </span>
      );
  }
}

/** Como se ganha um item que o jogador ainda não tem. */
export function unlockHint(item: Cosmetic & { progress?: { current: number; target: number } | null; forSale?: boolean }) {
  if (item.unlock === 'FREE') return 'Grátis';
  if (item.unlock === 'SHOP') return item.forSale === false ? 'Fora de venda' : `${(item.priceCoins ?? 0).toLocaleString('pt-BR')} moedas na loja`;
  if (item.unlock === 'REQUIREMENT') {
    const target = Number.isFinite(item.progress?.target) ? item.progress?.target : null;
    return `${item.requirementLabel ?? 'Meta'}${item.requirementValue && target ? `: ${Math.min(item.progress?.current ?? 0, target)}/${target}` : ''}`;
  }
  return item.inChestPool ? 'Pode sair no baú de nível' : 'Prêmio especial (passe, coleções ou eventos)';
}
