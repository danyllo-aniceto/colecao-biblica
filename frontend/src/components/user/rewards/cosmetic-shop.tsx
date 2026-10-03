import { useEffect, useMemo, useState } from 'react';
import CelebrationRoundedIcon from '@mui/icons-material/CelebrationRounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import { Button } from '@/components/ui/button';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Segmented } from '@/components/ui/segmented';
import { LoadingState } from '@/components/ui/spinner';
import { errorMessage, useToast } from '@/components/ui/toast';
import { Alert, CoinIcon, EmptyState } from '@/components/game/game-ui';
import { COSMETIC_TYPE_LABELS, CosmeticPreview } from '@/components/user/rewards/cosmetic-preview';
import { cn } from '@/lib/cn';
import { getRarityLabel } from '@/lib/rarity-theme';
import { buyCosmetic, getInventory, type CosmeticType, type Inventory } from '@/lib/rewards-api';
import type { UserProfile } from '@/types/auth';

const TYPES: CosmeticType[] = ['AVATAR', 'FRAME', 'TITLE', 'NAME_COLOR', 'REACTION', 'PROFILE_BG', 'ALBUM_COVER'];

/** Loja de itens visuais: o que está à venda agora (inclui os do evento). */
export function CosmeticShop({ profile, coins, onCoins }: { profile: UserProfile | null; coins: number; onCoins: (coins: number) => void }) {
  const toast = useToast();
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<CosmeticType>('AVATAR');
  const [buying, setBuying] = useState<number | null>(null);

  useEffect(() => {
    getInventory()
      .then(setInventory)
      .catch((reason: unknown) => setError(errorMessage(reason)));
  }, []);

  const avatarUrl = inventory?.items.find((item) => item.id === inventory.equipped.avatarId)?.imageUrl ?? null;
  const forSale = useMemo(() => (inventory?.items ?? []).filter((item) => item.forSale && item.type === type), [inventory, type]);
  const eventItems = (inventory?.items ?? []).filter((item) => item.forSale && item.eventName && !item.owned);
  const paging = usePagination(forSale, 9);

  async function buy(id: number) {
    setBuying(id);
    try {
      const result = await buyCosmetic(id);
      onCoins(result.userCoins);
      setInventory((current) => (current ? { ...current, items: current.items.map((item) => (item.id === id ? { ...item, owned: true } : item)) } : current));
      toast.success(`${result.cosmetic.name} é seu!`, { description: 'Equipe em Perfil → Visual.' });
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setBuying(null);
    }
  }

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!inventory) return <LoadingState label="Abrindo a vitrine..." />;

  return (
    <div className="space-y-4">
      {eventItems.length > 0 ? (
        <div className="flex items-center gap-3 rounded-3xl bg-[linear-gradient(135deg,var(--violet),var(--info))] p-4 text-white">
          <CelebrationRoundedIcon />
          <p className="text-sm font-semibold">
            Itens do evento <strong>{eventItems[0].eventName}</strong> à venda por tempo limitado.
          </p>
        </div>
      ) : null}
      <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
        <Segmented
          aria-label="Tipo de item"
          className="min-w-[46rem]"
          value={type}
          onChange={(next) => {
            setType(next);
            paging.reset();
          }}
          options={TYPES.map((value) => ({ value, label: COSMETIC_TYPE_LABELS[value].many }))}
        />
      </div>
      {forSale.length === 0 ? (
        <EmptyState icon={<PaletteRoundedIcon fontSize="large" />} title="Nada à venda aqui agora">
          Alguns itens só saem por metas, no baú de nível, no passe ou em eventos.
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {paging.pageItems.map((item) => {
            const canAfford = coins >= (item.priceCoins ?? 0);
            return (
              <article key={item.id} data-rarity={item.rarity} className="rarity panel flex items-center gap-4 p-4">
                <span className="rarity-bg flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-3xl px-1">
                  <CosmeticPreview item={item} playerName={profile?.name ?? 'Você'} avatarUrl={avatarUrl} />
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <p className="truncate font-display font-bold text-ink">{item.name}</p>
                    <p className="rarity-text text-xs font-bold uppercase tracking-wider">{getRarityLabel(item.rarity)}</p>
                  </div>
                  {item.owned ? (
                    <p className="text-sm font-bold text-success-strong dark:text-success">Você já tem</p>
                  ) : (
                    <Button size="sm" variant={canAfford ? 'primary' : 'secondary'} disabled={!canAfford || buying !== null} loading={buying === item.id} onClick={() => void buy(item.id)}>
                      {buying === item.id ? null : <CoinIcon />}
                      {(item.priceCoins ?? 0).toLocaleString('pt-BR')}
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
      {paging.totalPages > 1 ? <Pagination page={paging.page} totalPages={paging.totalPages} totalElements={paging.totalElements} onPageChange={paging.setPage} itemLabel="itens" /> : null}
      <p className={cn('text-xs text-muted')}>Os itens comprados ficam no seu perfil para equipar quando quiser.</p>
    </div>
  );
}
