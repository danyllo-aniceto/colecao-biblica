import { useEffect, useState, type ReactNode } from 'react';
import { Segmented } from '@/components/ui/segmented';
import { CosmeticShop } from '@/components/user/rewards/cosmetic-shop';
import type { UserProfile } from '@/types/auth';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import { Button } from '@/components/ui/button';
import { Alert, CoinChip, CoinIcon, EmptyState, SectionHeading } from '@/components/game/game-ui';
import { cn } from '@/lib/cn';
import { rewardVisual } from '@/lib/reward-visual';
import type { StickerRarity } from '@/lib/admin-api';
import { RARITY_ORDER, getRarityLabel } from '@/lib/rarity-theme';
import { getShopLimits, type GameRules, type ShopItem } from '@/lib/user-api';

/** Visual de cada item a partir da recompensa que ele entrega. */
function describeItem(item: ShopItem): { rarity?: StickerRarity; icon: ReactNode; tint: string } {
  if (item.rewardType === 'STICKER') return { rarity: item.rewardRarity ?? 'COMMON', ...rewardVisual('STICKER') , tint: '' };
  return rewardVisual(item.rewardType);
}

function packOdds(rules: GameRules | null) {
  if (!rules) return null;
  const weights: Record<StickerRarity, number> = { COMMON: rules.packOddsCommon, RARE: rules.packOddsRare, EPIC: rules.packOddsEpic, LEGENDARY: rules.packOddsLegendary };
  const total = Object.values(weights).reduce((sum, value) => sum + Math.max(0, value), 0);
  return total > 0 ? RARITY_ORDER.map((rarity) => ({ rarity, percent: (Math.max(0, weights[rarity]) / total) * 100 })) : null;
}

type ShopSectionProps = {
  items: ShopItem[];
  coins: number;
  gameRules: GameRules | null;
  buyingItemId: number | null;
  error: string | null;
  onBuy: (item: ShopItem) => void;
  profile: UserProfile | null;
  onCoins: (coins: number) => void;
};

export function ShopSection({ items, coins, gameRules, buyingItemId, error, onBuy, profile, onCoins }: ShopSectionProps) {
  const [tab, setTab] = useState<'items' | 'visual'>('items');
  const [limits, setLimits] = useState<{ stickerLimitPerDay: number; stickersBoughtToday: number } | null>(null);

  // Recarrega o limite diário de figurinhas ao abrir e depois de cada compra.
  useEffect(() => {
    if (buyingItemId !== null) return;
    getShopLimits()
      .then(setLimits)
      .catch(() => setLimits(null));
  }, [buyingItemId]);
  const stickersLeft = limits && limits.stickerLimitPerDay > 0 ? Math.max(0, limits.stickerLimitPerDay - limits.stickersBoughtToday) : null;
  const odds = packOdds(gameRules);
  const groups = [
    {
      title: 'Figurinhas',
      description:
        stickersLeft === null
          ? 'Sorteia uma figurinha que você ainda não tem.'
          : stickersLeft > 0
            ? `Sorteia uma figurinha que você ainda não tem. Você pode comprar mais ${stickersLeft} hoje.`
            : 'Você já comprou as figurinhas de hoje. Jogue para ganhar mais ou volte amanhã!',
      items: items.filter((item) => item.itemType === 'STICKER'),
    },
    { title: 'Ajudas para as partidas', description: 'Ficam guardadas; use uma de cada por partida.', items: items.filter((item) => item.itemType !== 'STICKER') },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="space-y-6">
      <SectionHeading title="Loja" subtitle="Troque suas moedas por figurinhas, ajudas e visual." action={<CoinChip value={coins} className="h-11 text-base" />} />

      <Segmented
        aria-label="Parte da loja"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'items', label: 'Figurinhas e ajudas' },
          { value: 'visual', label: 'Visual' },
        ]}
      />

      {tab === 'visual' ? <CosmeticShop profile={profile} coins={coins} onCoins={onCoins} /> : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {tab === 'items' && items.length === 0 && !error ? (
        <EmptyState icon={<StorefrontRoundedIcon fontSize="large" />} title="A loja está vazia">
          Volte mais tarde.
        </EmptyState>
      ) : null}

      {tab === 'visual' ? null : groups.map((group) => (
        <section key={group.title} className="space-y-3">
          <div>
            <h3 className="font-display text-xl font-bold text-ink">{group.title}</h3>
            <p className="text-sm text-muted">{group.description}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((item) => {
              const { rarity, icon, tint } = describeItem(item);
              const canAfford = coins >= item.priceCoins;
              const buying = buyingItemId === item.id;

              return (
                <article key={item.id} className="panel flex flex-col overflow-hidden">
                  <div data-rarity={rarity} className={cn('flex h-32 items-center justify-center', rarity ? 'rarity rarity-bg' : 'bg-surface-2')}>
                    <span className={cn('flex h-20 w-20 items-center justify-center rounded-3xl', rarity ? 'rarity-frame rarity-text bg-surface' : tint)}>{icon}</span>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <div>
                      <h4 className="font-display text-xl font-bold text-ink">{item.name}</h4>
                      <p className="mt-1 text-sm text-muted">{item.description}</p>
                    </div>
                    {item.rewardType === 'STICKER_PACK' && odds ? (
                      <ul className="grid grid-cols-4 gap-1 text-center" aria-label="Chances do pacote">
                        {odds.map(({ rarity: oddsRarity, percent }) => (
                          <li key={oddsRarity} data-rarity={oddsRarity} className="rarity rarity-bg rounded-xl px-1 py-1.5">
                            <span className="rarity-text block font-display text-sm font-bold">{percent.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>
                            <span className="block text-[10px] font-bold text-muted">{getRarityLabel(oddsRarity)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <Button
                      className="mt-auto w-full"
                      variant={canAfford ? 'primary' : 'secondary'}
                      onClick={() => onBuy(item)}
                      disabled={!canAfford || (buyingItemId !== null && !buying) || (item.itemType === 'STICKER' && stickersLeft === 0)}
                      loading={buying}
                    >
                      {buying ? null : <CoinIcon />}
                      {buying ? 'Comprando...' : item.priceCoins.toLocaleString('pt-BR')}
                    </Button>
                    {!canAfford ? <p className="text-center text-xs font-semibold text-muted">Faltam {(item.priceCoins - coins).toLocaleString('pt-BR')} moedas</p> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
