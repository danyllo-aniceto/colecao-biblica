'use client';

import { useMemo, useState } from 'react';
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { Button } from '@/components/ui/button';
import { fieldClassName } from '@/components/ui/input';
import { EmptyState, ProgressBar, SectionHeading } from '@/components/game/game-ui';
import { Modal } from '@/components/game/modal';
import { StickerCard } from '@/components/game/sticker-card';
import type { StickerRarity } from '@/lib/admin-api';
import { RARITY_ORDER, getRarityLabel } from '@/lib/rarity-theme';
import type { CharacterEntry } from '@/lib/user-api';

type SortOption = 'alphabetical' | 'rarityAsc' | 'rarityDesc';
type OwnershipFilter = 'all' | 'owned' | 'missing';

const PAGE_SIZE = 24;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type AlbumSectionProps = {
  characters: CharacterEntry[];
  ownedIds: Set<number>;
  onOpenSticker: (id: number) => void;
};

export function AlbumSection({ characters, ownedIds, onOpenSticker }: AlbumSectionProps) {
  const [rarity, setRarity] = useState<StickerRarity | 'ALL'>('ALL');
  const [ownership, setOwnership] = useState<OwnershipFilter>('all');
  const [books, setBooks] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('rarityDesc');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const uniqueBooks = useMemo(() => {
    const set = new Set<string>();
    characters.forEach((character) => character.bibleBooks?.split(',').forEach((book) => book.trim() && set.add(book.trim())));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [characters]);

  const filtered = useMemo(() => {
    const order = (value: StickerRarity) => RARITY_ORDER.indexOf(value);
    return characters
      .filter((character) => rarity === 'ALL' || character.rarity === rarity)
      .filter((character) => ownership === 'all' || (ownership === 'owned') === ownedIds.has(character.id))
      .filter((character) => books.length === 0 || books.some((book) => character.bibleBooks?.includes(book)))
      .sort((left, right) => {
        if (sortBy !== 'alphabetical') {
          const diff = order(left.rarity) - order(right.rarity);
          if (diff !== 0) {
            return sortBy === 'rarityAsc' ? diff : -diff;
          }
        }
        return left.name.localeCompare(right.name, 'pt-BR', { sensitivity: 'base' });
      });
  }, [characters, rarity, ownership, books, sortBy, ownedIds]);

  const ownedCount = characters.filter((character) => ownedIds.has(character.id)).length;
  const shown = filtered.slice(0, visible);
  const extraFilters = books.length + (sortBy !== 'rarityDesc' ? 1 : 0);

  function resetPaging<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setVisible(PAGE_SIZE);
    };
  }

  return (
    <div className="space-y-5">
      <section className="panel space-y-4 p-5 sm:p-6">
        <SectionHeading
          title="Meu álbum"
          subtitle={`${ownedCount} de ${characters.length} figurinhas conquistadas`}
          action={
            <Button variant="secondary" size="sm" onClick={() => setFiltersOpen(true)}>
              <TuneRoundedIcon fontSize="small" />
              Filtros{extraFilters ? ` (${extraFilters})` : ''}
            </Button>
          }
        />
        <ProgressBar value={characters.length ? (ownedCount / characters.length) * 100 : 0} className="h-4" />

        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <FilterPill active={rarity === 'ALL'} onClick={() => resetPaging(setRarity)('ALL')}>
            Todas
          </FilterPill>
          {RARITY_ORDER.map((item) => (
            <FilterPill key={item} active={rarity === item} onClick={() => resetPaging(setRarity)(item)} rarity={item}>
              {getRarityLabel(item)}
            </FilterPill>
          ))}
          <span className="mx-1 w-px shrink-0 bg-edge" />
          <FilterPill active={ownership === 'owned'} onClick={() => resetPaging(setOwnership)(ownership === 'owned' ? 'all' : 'owned')}>
            Conquistadas
          </FilterPill>
          <FilterPill active={ownership === 'missing'} onClick={() => resetPaging(setOwnership)(ownership === 'missing' ? 'all' : 'missing')}>
            Faltando
          </FilterPill>
        </div>
      </section>

      {shown.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
          {shown.map((character, index) => (
            <div key={character.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}>
              <StickerCard
                name={character.name}
                rarity={character.rarity}
                imageUrl={character.imageUrl}
                owned={ownedIds.has(character.id)}
                onClick={() => onOpenSticker(character.id)}
              />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={<CollectionsBookmarkRoundedIcon fontSize="large" />} title="Nenhuma figurinha aqui">
          Tente outros filtros.
        </EmptyState>
      )}

      {filtered.length > visible ? (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => setVisible((current) => current + PAGE_SIZE)}>
            Mostrar mais ({filtered.length - visible})
          </Button>
        </div>
      ) : null}

      <Modal
        open={filtersOpen}
        title="Filtros e ordem"
        onClose={() => setFiltersOpen(false)}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setBooks([]);
                setSortBy('rarityDesc');
              }}
            >
              Limpar
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>Ver figurinhas</Button>
          </>
        }
      >
        <div className="space-y-5">
          <label className="block space-y-2">
            <span className="text-sm font-bold text-muted">Ordenar por</span>
            <select className={cn(fieldClassName, 'h-12 w-full')} value={sortBy} onChange={(event) => resetPaging(setSortBy)(event.target.value as SortOption)}>
              <option value="rarityDesc">Mais raras primeiro</option>
              <option value="rarityAsc">Mais comuns primeiro</option>
              <option value="alphabetical">Nome (A–Z)</option>
            </select>
          </label>
          <div className="space-y-2">
            <span className="text-sm font-bold text-muted">Livros da Bíblia</span>
            {uniqueBooks.length === 0 ? <p className="text-sm text-muted">Nenhum livro cadastrado nos personagens.</p> : null}
            <div className="flex flex-wrap gap-2">
              {uniqueBooks.map((book) => (
                <FilterPill
                  key={book}
                  active={books.includes(book)}
                  onClick={() => resetPaging(setBooks)(books.includes(book) ? books.filter((item) => item !== book) : [...books, book])}
                >
                  {book}
                </FilterPill>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function FilterPill({ active, onClick, children, rarity }: { active: boolean; onClick: () => void; children: React.ReactNode; rarity?: StickerRarity }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-rarity={rarity}
      className={cn(
        'rarity inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border-2 px-4 font-display text-sm font-semibold transition',
        active ? (rarity ? 'rarity-chip border-transparent' : 'border-transparent bg-ink text-bg') : 'border-edge bg-surface-2 text-muted hover:text-ink',
      )}
    >
      {rarity && !active ? <span className="h-2.5 w-2.5 rounded-full bg-[var(--r)]" /> : null}
      {children}
    </button>
  );
}
