import LockRoundedIcon from '@mui/icons-material/LockRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import type { StickerRarity } from '@/lib/admin-api';
import { getRarityLabel } from '@/lib/rarity-theme';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type StickerCardProps = {
  name: string;
  rarity: StickerRarity;
  imageUrl?: string | null;
  owned: boolean;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Cópias repetidas guardadas (mostra o selo "x2", "x3"...). */
  duplicates?: number;
  /** Nível da figurinha (1 a 5): aparece como selo a partir do nível 2. */
  level?: number;
  /** Carrega a imagem na hora (revelação do baú: não pode aparecer vazia nem atrasada). */
  eager?: boolean;
};

/**
 * Figurinha do álbum: moldura e brilho na cor da raridade. Bloqueada, fica toda
 * cinza, desabilitada e com cadeado; a lendária ganha um brilho que atravessa a carta.
 */
export function StickerCard({ name, rarity, imageUrl, owned, onClick, size = 'md', className, duplicates = 0, level = 1, eager = false }: StickerCardProps) {
  const interactive = Boolean(onClick) && owned;
  const Tag = interactive ? 'button' : 'div';

  return (
    <Tag
      type={interactive ? 'button' : undefined}
      onClick={interactive ? onClick : undefined}
      data-rarity={rarity}
      aria-disabled={owned ? undefined : true}
      aria-label={owned ? `${name}, figurinha ${getRarityLabel(rarity)}` : `${name}, figurinha ${getRarityLabel(rarity)} bloqueada`}
      className={cn(
        'rarity group relative flex w-full flex-col overflow-hidden rounded-3xl text-left',
        owned ? 'rarity-frame bg-surface' : 'cursor-not-allowed select-none border-2 border-edge bg-surface-3 grayscale',
        interactive && 'transition-transform duration-200 hover:-translate-y-1 hover:rotate-[-1deg] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40',
        owned && (rarity === 'LEGENDARY' || rarity === 'SPECIAL') && 'shine',
        className,
      )}
    >
      <div className={cn('relative aspect-[3/4] w-full overflow-hidden', owned ? 'rarity-bg' : 'bg-surface-3')}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            loading={eager ? 'eager' : 'lazy'}
            decoding={eager ? 'sync' : 'async'}
            draggable={false}
            className={cn('h-full w-full object-cover', !owned && 'opacity-45 grayscale')}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <MenuBookRoundedIcon className={cn(owned ? 'rarity-text' : 'text-muted/50')} sx={{ fontSize: size === 'lg' ? 96 : 56 }} />
          </div>
        )}

        {!owned ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface/80 text-muted shadow-sm">
              <LockRoundedIcon />
            </span>
          </div>
        ) : null}

        <span
          hidden={size === 'sm'}
          className={cn(
            'absolute left-2 top-2 rounded-full px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-wider',
            owned ? 'rarity-chip' : 'bg-surface text-muted',
          )}
        >
          {getRarityLabel(rarity)}
        </span>
        {owned && level > 1 ? (
          <span className="absolute bottom-2 left-2 rounded-full bg-ink px-2 py-0.5 font-display text-[11px] font-bold text-bg" aria-label={`nível ${level}`}>
            Nv {level}
          </span>
        ) : null}
        {owned && duplicates > 0 ? (
          <span className="absolute right-2 top-2 rounded-full bg-ink px-2 py-0.5 font-display text-[11px] font-bold text-bg" aria-label={`${duplicates} repetida(s)`}>
            x{duplicates + 1}
          </span>
        ) : null}
      </div>

      <div className={cn('flex items-center justify-between gap-2 px-3', size === 'sm' ? 'py-2' : 'py-3')}>
        <span className={cn('truncate font-display font-semibold', owned ? 'text-ink' : 'text-muted', size === 'lg' ? 'text-xl' : 'text-sm')}>{name}</span>
      </div>
    </Tag>
  );
}
