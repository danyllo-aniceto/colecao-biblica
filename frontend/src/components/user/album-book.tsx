import { useEffect, useRef, useState, type ReactNode } from 'react';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import { Pagination } from '@/components/ui/pagination';
import { StickerCard } from '@/components/game/sticker-card';
import type { StickerRarity } from '@/lib/admin-api';
import { cn } from '@/lib/cn';
import { RARITY_ORDER, getRarityLabel } from '@/lib/rarity-theme';
import type { CharacterEntry } from '@/lib/user-api';

/** Figurinhas por folha: 2×2 no celular (uma folha por vez) e 3×2 com o álbum aberto em duas folhas. */
const PER_PAGE_NARROW = 4;
const PER_PAGE_WIDE = 6;
const FLIP_MS = 650;
const TILTS = [-2.2, 1.6, -0.8, 2.4, -1.4, 0.9];

type Flip = { from: number; to: number };

function useWide() {
  const query = '(min-width: 768px)';
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setWide(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return wide;
}

type AlbumBookProps = {
  /** Só as figurinhas conquistadas (já filtradas e ordenadas). */
  items: CharacterEntry[];
  totalCharacters: number;
  ownedCount: number;
  duplicatesById: Map<number, number>;
  onOpenSticker: (id: number) => void;
  /** Muda quando os filtros mudam: o álbum volta para a primeira folha. */
  resetKey: string;
  /** Figurinha a mostrar ao abrir (volta da ficha): o álbum abre na folha dela. */
  focusId?: number | null;
  onFocused?: () => void;
};

/**
 * Álbum de verdade: capa, folhas de papel e a folha virando ao trocar de página
 * (setas, arrastar no celular, setas do teclado ou a paginação embaixo).
 */
export function AlbumBook({ items, totalCharacters, ownedCount, duplicatesById, onOpenSticker, resetKey, focusId = null, onFocused }: AlbumBookProps) {
  const wide = useWide();
  const perPage = wide ? PER_PAGE_WIDE : PER_PAGE_NARROW;
  const [view, setView] = useState(0);
  const [flip, setFlip] = useState<Flip | null>(null);
  const touchX = useRef<number | null>(null);
  const fallback = useRef<number | null>(null);

  // Folha 0 é a abertura do álbum; depois vêm as folhas de figurinhas.
  const stickerPages: CharacterEntry[][] = [];
  for (let index = 0; index < items.length; index += perPage) stickerPages.push(items.slice(index, index + perPage));
  const pageCount = 1 + Math.max(stickerPages.length, 1);
  const viewCount = wide ? Math.ceil(pageCount / 2) : pageCount;

  useEffect(() => {
    setFlip(null);
    const index = focusId === null ? -1 : items.findIndex((item) => item.id === focusId);
    if (index === -1) {
      setView(0);
      return;
    }
    // Folha 0 é a abertura; a figurinha está na folha 1 + posição / por folha.
    const sheet = 1 + Math.floor(index / perPage);
    setView(wide ? Math.floor(sheet / 2) : sheet);
    onFocused?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, wide]);

  useEffect(() => {
    if (view > viewCount - 1) setView(Math.max(viewCount - 1, 0));
  }, [view, viewCount]);

  useEffect(() => () => window.clearTimeout(fallback.current ?? undefined), []);

  function finish(to: number) {
    window.clearTimeout(fallback.current ?? undefined);
    setView(to);
    setFlip(null);
  }

  function go(to: number) {
    if (flip || to === view || to < 0 || to > viewCount - 1) return;
    setFlip({ from: view, to });
    // Garantia caso o navegador não dispare o fim da animação (aba em segundo plano).
    fallback.current = window.setTimeout(() => finish(to), FLIP_MS + 200);
  }

  function renderPage(index: number, side: 'left' | 'right' | 'single') {
    const paper = cn('album-paper relative flex min-h-full w-full flex-col p-3 sm:p-5', side === 'left' && 'album-paper-left', side === 'right' && 'album-paper-right');
    if (index === 0) {
      return (
        <div className={paper}>
          <AlbumIntro items={items} ownedCount={ownedCount} totalCharacters={totalCharacters} />
        </div>
      );
    }
    const stickers = stickerPages[index - 1];
    if (!stickers) {
      return (
        <div className={cn(paper, 'items-center justify-center text-center')}>
          {items.length === 0 ? (
            <>
              <CollectionsBookmarkRoundedIcon className="text-muted/60" sx={{ fontSize: 56 }} />
              <p className="mt-2 font-display text-lg font-bold text-ink">Nenhuma figurinha aqui</p>
              <p className="max-w-[16rem] text-sm text-muted">Jogue, compre pacotes ou troque com amigos para colar figurinhas no álbum.</p>
            </>
          ) : (
            <p className="font-display text-sm font-semibold text-muted/70">Fim do álbum (por enquanto)</p>
          )}
        </div>
      );
    }
    return (
      <div className={paper}>
        <div className={cn('grid flex-1 content-start gap-3 sm:gap-4', wide ? 'grid-cols-3' : 'grid-cols-2')}>
          {stickers.map((character, position) => (
            <div key={character.id} className="relative" style={{ transform: `rotate(${TILTS[(character.id + position) % TILTS.length]}deg)` }}>
              {/* Cantoneiras que "seguram" a figurinha na folha. */}
              <span className="pointer-events-none absolute -left-1 -top-1 z-10 h-4 w-4 border-l-4 border-t-4 border-edge-strong/80" />
              <span className="pointer-events-none absolute -bottom-1 -right-1 z-10 h-4 w-4 border-b-4 border-r-4 border-edge-strong/80" />
              <StickerCard
                name={character.name}
                rarity={character.rarity}
                imageUrl={character.imageUrl}
                owned
                size="sm"
                duplicates={duplicatesById.get(character.id) ?? 0}
                onClick={() => onOpenSticker(character.id)}
              />
            </div>
          ))}
        </div>
        <p className={cn('mt-3 font-display text-xs font-bold text-muted', side === 'left' ? 'text-left' : side === 'right' ? 'text-right' : 'text-center')}>{index}</p>
      </div>
    );
  }

  // O que fica parado embaixo e o que vira por cima, conforme o sentido da virada.
  let base: ReactNode;
  let leaf: ReactNode = null;
  const forward = flip ? flip.to > flip.from : true;
  const done = flip ? () => finish(flip.to) : undefined;

  if (wide) {
    const left = (spread: number) => spread * 2;
    const right = (spread: number) => spread * 2 + 1;
    const leftPage = flip ? (forward ? left(flip.from) : left(flip.to)) : left(view);
    const rightPage = flip ? (forward ? right(flip.to) : right(flip.from)) : right(view);
    base = (
      <div className="grid grid-cols-2">
        <div className="flex min-h-[34rem]">{renderPage(leftPage, 'left')}</div>
        <div className="flex min-h-[34rem]">{renderPage(rightPage, 'right')}</div>
      </div>
    );
    if (flip) {
      leaf = (
        <div className={cn('album-leaf pointer-events-none absolute inset-y-0 z-20 w-1/2', forward ? 'album-leaf-next right-0' : 'album-leaf-prev left-0')} onAnimationEnd={(event) => event.target === event.currentTarget && done?.()}>
          <div className="album-face">{forward ? renderPage(right(flip.from), 'right') : renderPage(left(flip.from), 'left')}</div>
          <div className="album-face album-face-back">{forward ? renderPage(left(flip.to), 'left') : renderPage(right(flip.to), 'right')}</div>
        </div>
      );
    }
  } else {
    base = <div className="flex min-h-[31rem]">{renderPage(flip ? (forward ? flip.to : flip.from) : view, 'single')}</div>;
    if (flip) {
      leaf = (
        <div className={cn('album-leaf pointer-events-none absolute inset-0 z-20', forward ? 'album-leaf-next' : 'album-leaf-in')} onAnimationEnd={(event) => event.target === event.currentTarget && done?.()}>
          <div className="album-face">{renderPage(forward ? flip.from : flip.to, 'single')}</div>
          <div className="album-face album-face-back album-paper" />
        </div>
      );
    }
  }

  const current = flip ? flip.to : view;

  return (
    <div className="space-y-4">
      <div className="relative">
        <div
          role="region"
          aria-roledescription="álbum"
          aria-label={`Álbum de figurinhas, ${wide ? 'páginas' : 'página'} ${current + 1} de ${viewCount}`}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight') go(view + 1);
            if (event.key === 'ArrowLeft') go(view - 1);
          }}
          onTouchStart={(event) => {
            touchX.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            if (touchX.current === null) return;
            const delta = (event.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
            touchX.current = null;
            if (delta < -50) go(view + 1);
            if (delta > 50) go(view - 1);
          }}
          className="album-cover rounded-[1.75rem] p-2 outline-none focus-visible:ring-4 focus-visible:ring-primary/40 sm:p-3"
        >
          <div className="relative overflow-hidden rounded-2xl [perspective:1800px]">
            {base}
            {leaf}
            {wide ? <span className="pointer-events-none absolute inset-y-0 left-1/2 z-30 w-px -translate-x-1/2 bg-[var(--album-fold)]" /> : null}
          </div>
        </div>
        <TurnButton side="left" disabled={current === 0 || flip !== null} onClick={() => go(view - 1)} />
        <TurnButton side="right" disabled={current >= viewCount - 1 || flip !== null} onClick={() => go(view + 1)} />
      </div>

      <Pagination page={current} totalPages={viewCount} onPageChange={go} itemLabel={wide ? 'páginas duplas' : 'páginas'} />
    </div>
  );
}

function TurnButton({ side, disabled, onClick }: { side: 'left' | 'right'; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === 'left' ? 'Voltar a folha' : 'Virar a folha'}
      className={cn(
        'absolute top-1/2 z-40 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-edge bg-surface text-ink shadow-lg transition hover:scale-105 disabled:pointer-events-none disabled:opacity-0',
        side === 'left' ? '-left-2 sm:-left-5' : '-right-2 sm:-right-5',
      )}
    >
      {side === 'left' ? <ChevronLeftRoundedIcon /> : <ChevronRightRoundedIcon />}
    </button>
  );
}

function AlbumIntro({ items, ownedCount, totalCharacters }: { items: CharacterEntry[]; ownedCount: number; totalCharacters: number }) {
  const byRarity = (rarity: StickerRarity) => items.filter((item) => item.rarity === rarity).length;
  const percent = totalCharacters ? Math.round((ownedCount / totalCharacters) * 100) : 0;
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <img src="/icons/icon-192.png" alt="" width={72} height={72} className="h-18 w-18 drop-shadow-md" />
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.3em] text-muted">Coleção Bíblica</p>
        <h3 className="font-display text-3xl font-bold text-ink">Meu álbum</h3>
      </div>
      <div className="rounded-3xl border-2 border-dashed border-edge-strong px-6 py-3">
        <p className="font-display text-4xl font-bold text-ink">
          {ownedCount}
          <span className="text-xl text-muted">/{totalCharacters}</span>
        </p>
        <p className="text-sm font-semibold text-muted">{percent}% completo</p>
      </div>
      <ul className="grid w-full max-w-xs grid-cols-2 gap-2 text-left">
        {RARITY_ORDER.map((rarity) => (
          <li key={rarity} data-rarity={rarity} className="rarity flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="h-3 w-3 rounded-full bg-[var(--r)]" />
            {getRarityLabel(rarity)}: {byRarity(rarity)}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">Arraste para o lado ou use as setas para virar a página.</p>
    </div>
  );
}
