import { useEffect, useMemo, useState } from 'react';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import HourglassTopRoundedIcon from '@mui/icons-material/HourglassTopRounded';
import { ThemeCollections } from '@/components/user/rewards/theme-collections';
import { AlbumBook } from '@/components/user/album-book';
import { DuplicatesModal } from '@/components/user/duplicates-modal';
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import { Button } from '@/components/ui/button';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { EmptyState, ProgressBar, SectionHeading } from '@/components/game/game-ui';
import { Modal } from '@/components/game/modal';
import { StickerCard } from '@/components/game/sticker-card';
import type { StickerRarity, Testament } from '@/lib/admin-api';
import { sortBooks } from '@/lib/bible-books';
import { HISTORICAL_PERIODS, TESTAMENT_LABELS } from '@/lib/labels';
import { RARITY_ORDER, getRarityLabel } from '@/lib/rarity-theme';
import { listUpcoming, type CharacterEntry, type FuseResult, type GameRules, type UpcomingSticker, type UserSticker } from '@/lib/user-api';

type SortOption = 'alphabetical' | 'rarityAsc' | 'rarityDesc' | 'period';
type AlbumTab = 'album' | 'locked' | 'collections';

const PAGE_SIZE = 20;

const booksOf = (value?: string | null) =>
  (value ?? '')
    .split(',')
    .map((book) => book.trim())
    .filter(Boolean);

const periodIndex = (period?: string | null) => {
  const index = (HISTORICAL_PERIODS as readonly string[]).indexOf(period ?? '');
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type AlbumSectionProps = {
  characters: CharacterEntry[];
  ownedIds: Set<number>;
  collection: UserSticker[];
  gameRules: GameRules | null;
  onOpenSticker: (id: number) => void;
  onWallet: (wallet: { userCoins: number }) => void;
  onFused: (result: FuseResult) => void;
  playerName: string;
};

/** "em 3 dias", "amanhã", "hoje às 18:00". */
function untilLabel(date: string) {
  const target = new Date(date);
  const days = Math.round((new Date(target).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return `hoje às ${target.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  if (days === 1) return 'amanhã';
  return `em ${days} dias`;
}

export function AlbumSection({ characters, ownedIds, collection, gameRules, onOpenSticker, onWallet, onFused, playerName }: AlbumSectionProps) {
  const [rarity, setRarity] = useState<StickerRarity | 'ALL'>('ALL');
  const [tab, setTab] = useState<AlbumTab>('album');
  const [books, setBooks] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>('rarityDesc');
  const [testament, setTestament] = useState<Testament | ''>('');
  const [period, setPeriod] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [duplicatesOpen, setDuplicatesOpen] = useState(false);
  const [upcoming, setUpcoming] = useState<UpcomingSticker[]>([]);
  const duplicatesById = useMemo(() => new Map(collection.map((sticker) => [sticker.characterId, sticker.duplicates])), [collection]);
  const totalDuplicates = collection.reduce((sum, sticker) => sum + sticker.duplicates, 0);

  useEffect(() => {
    listUpcoming()
      .then(setUpcoming)
      .catch(() => setUpcoming([]));
  }, []);

  const uniqueBooks = useMemo(() => sortBooks([...new Set(characters.flatMap((character) => booksOf(character.bibleBooks)))]), [characters]);
  const uniquePeriods = useMemo(
    () => [...new Set(characters.map((character) => character.historicalPeriod).filter((value): value is string => Boolean(value)))].sort((a, b) => periodIndex(a) - periodIndex(b) || a.localeCompare(b, 'pt-BR')),
    [characters],
  );

  const filtered = useMemo(() => {
    const order = (value: StickerRarity) => RARITY_ORDER.indexOf(value);
    return characters
      .filter((character) => rarity === 'ALL' || character.rarity === rarity)
      .filter((character) => books.length === 0 || booksOf(character.bibleBooks).some((book) => books.includes(book)))
      .filter((character) => !testament || character.testament === testament)
      .filter((character) => !period || character.historicalPeriod === period)
      .sort((left, right) => {
        if (sortBy === 'period') {
          const diff = periodIndex(left.historicalPeriod) - periodIndex(right.historicalPeriod);
          if (diff !== 0) return diff;
        } else if (sortBy !== 'alphabetical') {
          const diff = order(left.rarity) - order(right.rarity);
          if (diff !== 0) {
            return sortBy === 'rarityAsc' ? diff : -diff;
          }
        }
        return left.name.localeCompare(right.name, 'pt-BR', { sensitivity: 'base' });
      });
  }, [characters, rarity, books, sortBy, testament, period]);

  const ownedCount = characters.filter((character) => ownedIds.has(character.id)).length;
  const ownedFiltered = useMemo(() => filtered.filter((character) => ownedIds.has(character.id)), [filtered, ownedIds]);
  const lockedFiltered = useMemo(() => filtered.filter((character) => !ownedIds.has(character.id)), [filtered, ownedIds]);
  const lockedTotal = characters.length - ownedCount;
  const paging = usePagination(lockedFiltered, PAGE_SIZE);
  const shown = paging.pageItems;
  const resetKey = [rarity, sortBy, testament, period, books.join('|')].join(';');
  const extraFilters = books.length + (sortBy !== 'rarityDesc' ? 1 : 0) + (testament ? 1 : 0) + (period ? 1 : 0);

  function resetPaging<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      paging.reset();
    };
  }

  return (
    <div className="space-y-5">
      <section className="panel space-y-4 p-5 sm:p-6">
        <SectionHeading
          title="Meu álbum"
          subtitle={`${ownedCount} de ${characters.length} figurinhas conquistadas`}
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={() => setDuplicatesOpen(true)}>
                <AutoAwesomeRoundedIcon fontSize="small" />
                Repetidas{totalDuplicates ? ` (${totalDuplicates})` : ''}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setFiltersOpen(true)}>
                <TuneRoundedIcon fontSize="small" />
                Filtros{extraFilters ? ` (${extraFilters})` : ''}
              </Button>
            </div>
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
        </div>
      </section>

      <Segmented
        aria-label="Parte do álbum"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'album', label: `Álbum (${ownedCount})` },
          { value: 'locked', label: `Faltam (${lockedTotal})` },
          { value: 'collections', label: 'Coleções' },
        ]}
      />

      {tab === 'collections' ? <ThemeCollections playerName={playerName} onCoins={(coins) => onWallet({ userCoins: coins })} refreshKey={collection.length} /> : null}

      {tab === 'album' ? (
        <AlbumBook items={ownedFiltered} totalCharacters={characters.length} ownedCount={ownedCount} duplicatesById={duplicatesById} onOpenSticker={onOpenSticker} resetKey={resetKey} />
      ) : null}

      {tab === 'locked' && upcoming.length > 0 ? (
        <section className="panel space-y-3 p-5">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
            <HourglassTopRoundedIcon className="text-violet" /> Em breve no álbum
          </h3>
          <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
            {upcoming.map((item, index) => (
              <div key={`${item.publishAt}-${index}`} data-rarity={item.rarity} className="rarity rarity-bg flex w-28 shrink-0 flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-[var(--r)] p-3 text-center">
                <span className="rarity-text font-display text-3xl font-bold">?</span>
                <span className="rarity-text text-xs font-bold uppercase">{getRarityLabel(item.rarity)}</span>
                <span className="text-xs font-semibold text-muted">{untilLabel(item.publishAt)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {tab === 'locked' ? (
        shown.length > 0 ? (
          <>
            <p className="text-sm text-muted">Estas ainda não estão no seu álbum. Conquiste jogando, na loja ou trocando com amigos para ver a ficha completa.</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
              {shown.map((character, index) => (
                <div key={character.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}>
                  <StickerCard name={character.name} rarity={character.rarity} imageUrl={character.imageUrl} owned={false} />
                </div>
              ))}
            </div>
          </>
        ) : (
          <EmptyState icon={<CollectionsBookmarkRoundedIcon fontSize="large" />} title={lockedTotal === 0 ? 'Álbum completo!' : 'Nenhuma figurinha aqui'}>
            {lockedTotal === 0 ? 'Você conquistou todas as figurinhas publicadas até agora.' : 'Tente outros filtros.'}
          </EmptyState>
        )
      ) : null}

      {tab === 'locked' && lockedFiltered.length > 0 ? (
        <Pagination
          page={paging.page}
          totalPages={paging.totalPages}
          totalElements={paging.totalElements}
          onPageChange={(next) => {
            paging.setPage(next);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          itemLabel="figurinhas"
        />
      ) : null}

      <DuplicatesModal
        open={duplicatesOpen}
        onClose={() => setDuplicatesOpen(false)}
        collection={collection}
        rules={gameRules}
        onChanged={onWallet}
        onFused={(result) => {
          setDuplicatesOpen(false);
          onFused(result);
        }}
      />

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
                setTestament('');
                setPeriod('');
                paging.reset();
              }}
            >
              Limpar
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>Ver figurinhas</Button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <span className="text-sm font-bold text-muted">Ordenar por</span>
            <Select<SortOption>
              aria-label="Ordenar por"
              value={sortBy}
              onChange={(value) => resetPaging(setSortBy)(value)}
              options={[
                { value: 'rarityDesc', label: 'Mais raras primeiro' },
                { value: 'rarityAsc', label: 'Mais comuns primeiro' },
                { value: 'period', label: 'Ordem da história bíblica' },
                { value: 'alphabetical', label: 'Nome (A–Z)' },
              ]}
            />
          </div>
          <div className="space-y-2">
            <span className="text-sm font-bold text-muted">Testamento</span>
            <div className="flex flex-wrap gap-2">
              <FilterPill active={testament === ''} onClick={() => resetPaging(setTestament)('')}>
                Todos
              </FilterPill>
              {(Object.keys(TESTAMENT_LABELS) as Testament[]).map((item) => (
                <FilterPill key={item} active={testament === item} onClick={() => resetPaging(setTestament)(item)}>
                  {TESTAMENT_LABELS[item]}
                </FilterPill>
              ))}
            </div>
          </div>
          {uniquePeriods.length > 0 ? (
            <div className="space-y-2">
              <span className="text-sm font-bold text-muted">Período</span>
              <Select
                aria-label="Período"
                value={period}
                onChange={(value) => resetPaging(setPeriod)(value)}
                options={[{ value: '', label: 'Todos os períodos' }, ...uniquePeriods.map((item) => ({ value: item, label: item }))]}
              />
            </div>
          ) : null}
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
