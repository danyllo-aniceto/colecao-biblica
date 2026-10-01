import { useCallback, useEffect, useState } from 'react';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import WorkspacesRoundedIcon from '@mui/icons-material/WorkspacesRounded';
import { Button } from '@/components/ui/button';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { LoadingState } from '@/components/ui/spinner';
import { errorMessage, useToast } from '@/components/ui/toast';
import { Alert, CoinIcon, EmptyState, ProgressBar } from '@/components/game/game-ui';
import { StickerCard } from '@/components/game/sticker-card';
import { CosmeticPreview } from '@/components/user/rewards/cosmetic-preview';
import { getRarityLabel } from '@/lib/rarity-theme';
import { claimThemeCollection, listThemeCollections, type ThemeCollection } from '@/lib/rewards-api';

function CollectionCardView({ collection, playerName, onClaimed }: { collection: ThemeCollection; playerName: string; onClaimed: (coins: number) => void }) {
  const toast = useToast();
  const [claiming, setClaiming] = useState(false);
  const paging = usePagination(collection.characters, 8);

  async function claim() {
    setClaiming(true);
    try {
      const result = await claimThemeCollection(collection.id);
      toast.success(`Coleção "${collection.name}" completa!`, {
        description: [result.coins ? `+${result.coins} moedas` : null, result.cosmeticGranted && collection.rewardCosmetic ? collection.rewardCosmetic.name : null].filter(Boolean).join(' · '),
      });
      onClaimed(result.userCoins);
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setClaiming(false);
    }
  }

  return (
    <article className="panel space-y-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold text-ink">{collection.name}</h3>
          {collection.description ? <p className="text-sm text-muted">{collection.description}</p> : null}
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">Prêmio</span>
          {collection.rewardCoins ? (
            <span className="inline-flex items-center gap-1">
              <CoinIcon className="h-4 w-4" />
              {collection.rewardCoins}
            </span>
          ) : null}
          {collection.rewardCosmetic ? (
            <span className="inline-flex items-center gap-1">
              <CosmeticPreview item={collection.rewardCosmetic} playerName={playerName} size="md" />
              {collection.rewardCosmetic.type === 'TITLE' ? null : collection.rewardCosmetic.name}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <ProgressBar value={(collection.owned / collection.total) * 100} className="flex-1" />
        <span className="font-display text-sm font-bold text-ink">
          {collection.owned}/{collection.total}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
        {paging.pageItems.map((card) =>
          card.owned && card.name ? (
            <StickerCard key={card.id} name={card.name} rarity={card.rarity} imageUrl={card.imageUrl} owned size="sm" />
          ) : (
            // A que falta não revela quem é: só a raridade.
            <div key={card.id} data-rarity={card.rarity} className="rarity flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-edge bg-surface-2 text-muted grayscale">
              <HelpOutlineRoundedIcon />
              <span className="text-[10px] font-bold uppercase">{getRarityLabel(card.rarity)}</span>
            </div>
          ),
        )}
      </div>
      {paging.totalPages > 1 ? <Pagination page={paging.page} totalPages={paging.totalPages} totalElements={paging.totalElements} onPageChange={paging.setPage} itemLabel="figurinhas" /> : null}
      {collection.claimed ? (
        <p className="flex items-center gap-1.5 text-sm font-bold text-success-strong dark:text-success">
          <CheckCircleRoundedIcon fontSize="small" /> Prêmio resgatado
        </p>
      ) : collection.complete ? (
        <Button onClick={() => void claim()} loading={claiming}>
          Resgatar prêmio
        </Button>
      ) : (
        <p className="text-sm text-muted">Faltam {collection.total - collection.owned} para completar.</p>
      )}
    </article>
  );
}

/** Coleções temáticas (ex.: os 12 apóstolos): completar dá um prêmio único. */
export function ThemeCollections({ playerName, onCoins, refreshKey }: { playerName: string; onCoins: (coins: number) => void; refreshKey: number }) {
  const [collections, setCollections] = useState<ThemeCollection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const paging = usePagination(collections ?? [], 4);

  const load = useCallback(() => {
    listThemeCollections()
      .then(setCollections)
      .catch((reason: unknown) => setError(errorMessage(reason)));
  }, []);

  useEffect(load, [load, refreshKey]);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!collections) return <LoadingState label="Carregando coleções..." />;
  if (collections.length === 0) {
    return (
      <EmptyState icon={<WorkspacesRoundedIcon fontSize="large" />} title="Nenhuma coleção ainda">
        Em breve: grupos de figurinhas (como os apóstolos ou os reis) com prêmio para quem completar.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-4">
      {paging.pageItems.map((collection) => (
        <CollectionCardView
          key={collection.id}
          collection={collection}
          playerName={playerName}
          onClaimed={(coins) => {
            onCoins(coins);
            load();
          }}
        />
      ))}
      {paging.totalPages > 1 ? <Pagination page={paging.page} totalPages={paging.totalPages} totalElements={paging.totalElements} onPageChange={paging.setPage} itemLabel="coleções" /> : null}
    </div>
  );
}
