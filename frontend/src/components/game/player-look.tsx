import { useState, type CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import type { PlayerLook } from '@/lib/rewards-api';

const SIZES = { xs: 'h-7 w-7 text-[10px]', sm: 'h-9 w-9 text-xs', md: 'h-11 w-11 text-sm', lg: 'h-16 w-16 text-lg', xl: 'h-24 w-24 text-2xl' } as const;
const RING = { xs: 'p-[2px]', sm: 'p-[2px]', md: 'p-[3px]', lg: 'p-1', xl: 'p-1.5' } as const;

export function initials(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts.length > 1 ? parts.at(-1)![0] : '')).toUpperCase();
}

/** Rosto do ícone: se a imagem não carregar (ainda não enviada), volta para as iniciais. */
function AvatarFace({ url, name }: { url?: string | null; name?: string | null }) {
  const [failed, setFailed] = useState(false);
  return url && !failed ? (
    <img src={url} alt="" draggable={false} className="h-full w-full rounded-full object-cover" onError={() => setFailed(true)} />
  ) : (
    <span className="flex h-full w-full items-center justify-center rounded-full bg-accent/20 font-display font-bold text-accent-strong dark:text-accent">{initials(name)}</span>
  );
}

/** Ícone do jogador com a moldura equipada (sem ícone, mostra as iniciais). */
export function PlayerAvatar({
  look,
  name,
  size = 'md',
  className,
}: {
  look?: Pick<PlayerLook, 'avatarUrl' | 'frame'> | null;
  name?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const frame = look?.frame;
  const face = <AvatarFace key={look?.avatarUrl ?? 'none'} url={look?.avatarUrl} name={name} />;
  if (!frame) {
    return <span className={cn('inline-flex shrink-0 overflow-hidden rounded-full', SIZES[size], className)}>{face}</span>;
  }
  const style = { '--frame-color': frame.color ?? undefined } as CSSProperties;
  return (
    <span className={cn('avatar-frame inline-flex shrink-0', `frame-${frame.style ?? 'solid'}`, SIZES[size], RING[size], className)} style={style}>
      {frame.imageUrl ? <img src={frame.imageUrl} alt="" className="pointer-events-none absolute inset-0 z-10 h-full w-full" /> : null}
      <span className="block h-full w-full overflow-hidden rounded-full bg-surface">{face}</span>
    </span>
  );
}

/** Título que brilha embaixo do nome. */
export function PlayerTitle({ title, className }: { title?: PlayerLook['title'] | null; className?: string }) {
  if (!title) return null;
  return (
    <span className={cn('player-title truncate text-xs', `title-${title.style ?? 'plain'}`, className)} style={{ '--title-color': title.color ?? 'var(--muted)' } as CSSProperties}>
      {title.name}
    </span>
  );
}

/** Brasão do perfil: imagem enviada pelo admin, ou o emoji sobre a cor do brasão. */
export function BadgeMark({ badge, size = 'md', className }: { badge?: PlayerLook['badge'] | null; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string }) {
  if (!badge) return null;
  const box = size === 'lg' ? 'h-16 w-16 text-4xl' : size === 'md' ? 'h-9 w-9 text-xl' : size === 'sm' ? 'h-6 w-6 text-sm' : 'h-4 w-4 text-[10px]';
  return (
    <span
      role="img"
      aria-label={`Brasão: ${badge.name}`}
      className={cn('inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full leading-none ring-2 ring-[var(--badge-color)]', box, className)}
      style={{ '--badge-color': badge.color ?? 'var(--primary)', backgroundColor: 'color-mix(in srgb, var(--badge-color) 22%, var(--surface))' } as CSSProperties}
    >
      {badge.imageUrl ? <img src={badge.imageUrl} alt="" className="h-full w-full object-contain" /> : badge.style}
    </span>
  );
}

/** Nome na cor equipada + título embaixo. */
export function PlayerName({ name, look, className, nameClassName, badgeSize = 'xs' }: { name: string; look?: PlayerLook | null; className?: string; nameClassName?: string; badgeSize?: 'xs' | 'sm' | 'md' }) {
  return (
    <span className={cn('flex min-w-0 flex-col leading-tight', className)}>
      <span className="flex min-w-0 items-center gap-1">
        <span className={cn('truncate font-display font-bold text-ink', nameClassName)} style={look?.nameColor ? { color: look.nameColor } : undefined}>
          {name}
        </span>
        <BadgeMark badge={look?.badge} size={badgeSize} />
      </span>
      <PlayerTitle title={look?.title} />
    </span>
  );
}

/** Reação do chat: imagem enviada pelo admin ou emoji. */
export function ReactionGlyph({ reaction, size = 'md', animate = false }: { reaction: { name: string; imageUrl?: string | null; style?: string | null; animation?: string | null }; size?: 'sm' | 'md' | 'lg'; animate?: boolean }) {
  const box = size === 'lg' ? 'h-24 w-24 text-7xl' : size === 'md' ? 'h-12 w-12 text-4xl' : 'h-8 w-8 text-2xl';
  return (
    <span className={cn('inline-flex items-center justify-center leading-none', box, animate && `reaction-${reaction.animation && /^[a-z]+$/.test(reaction.animation) ? reaction.animation : 'pop'}`)} role="img" aria-label={reaction.name}>
      {reaction.imageUrl ? <img src={reaction.imageUrl} alt="" className="h-full w-full object-contain" /> : reaction.style}
    </span>
  );
}
