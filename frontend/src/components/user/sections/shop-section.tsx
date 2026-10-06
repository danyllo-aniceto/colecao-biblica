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
import { DROP_RARITIES, getRarityLabel } from '@/lib/rarity-theme';
import { getShopLimits, type ChestTierName, type GameRules, type ShopItem } from '@/lib/user-api';
import { ChestIcon, useChestLook } from '@/components/user/chest-opening';

/** Visual de cada item a partir da recompensa que ele entrega. */
function describeItem(item: ShopItem): { rarity?: StickerRarity; icon: ReactNode; tint: string } {
  if (item.rewardType === 'STICKER') return { rarity: item.rewardRarity ?? 'COMMON', ...rewardVisual('STICKER') , tint: '' };
  return rewardVisual(item.rewardType);
}

function packOdds(rules: GameRules | null) {
  if (!rules) return null;
  const weights: Partial<Record<StickerRarity, number>> = { COMMON: rules.packOddsCommon, RARE: rules.packOddsRare, EPIC: rules.packOddsEpic, LEGENDARY: rules.packOddsLegendary };
  const total = Object.values(weights).reduce((sum, value) => sum + Math.max(0, value), 0);
  return total > 0 ? DROP_RARITIES.map((rarity) => ({ rarity, percent: (Math.max(0, weights[rarity] ?? 0) / total) * 100 })) : null;
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

type ShopTab = 'figurinhas' | 'poderes' | 'cosmeticos';

/** O que cada baú da loja traz (o jogador vê antes de comprar). */
const CHEST_CONTENTS: Record<string, { tier: ChestTierName; lines: string[] }> = {
  CHEST_BRONZE: { tier: 'BRONZE', lines: ['10 moedas', '1 ajuda', 'Chance de figurinha'] },
  CHEST_SILVER: { tier: 'SILVER', lines: ['25 moedas', '2 ajudas', 'Boa chance de figurinha', 'Chance de item visual'] },
  CHEST_GOLD: { tier: 'GOLD', lines: ['50 moedas', '2 ajudas', 'Figurinha garantida (raras favorecidas)', 'Chance de item visual'] },
};

export function ShopSection({ items, coins, gameRules, buyingItemId, error, onBuy, profile, onCoins }: ShopSectionProps) {
  const [tab, setTab] = useState<ShopTab>('figurinhas');
  const [limits, setLimits] = useState<{ stickerLimitPerDay: number; stickersBoughtToday: number; chestLimitPerDay: number; chestsBoughtToday: number } | null>(null);

  // Recarrega o limite diário de figurinhas ao abrir e depois de cada compra.
  useEffect(() => {
    if (buyingItemId !== null) return;
    getShopLimits()
      .then(setLimits)
      .catch(() => setLimits(null));
  }, [buyingItemId]);
  const stickersLeft = limits && limits.stickerLimitPerDay > 0 ? Math.max(0, limits.stickerLimitPerDay - limits.stickersBoughtToday) : null;
  const chestsLeft = limits && limits.chestLimitPerDay > 0 ? Math.max(0, limits.chestLimitPerDay - limits.chestsBoughtToday) : null;
  const odds = packOdds(gameRules);

  const stickerItems = items.filter((item) => item.itemType === 'STICKER');
  const chests = stickerItems.filter((item) => (item.rewardType ?? '').startsWith('CHEST_')).sort((left, right) => left.priceCoins - right.priceCoins);
  const packs = stickerItems.filter((item) => item.rewardType === 'STICKER_PACK');
  const singles = stickerItems.filter((item) => item.rewardType === 'STICKER').sort((left, right) => left.priceCoins - right.priceCoins);
  const powers = items.filter((item) => item.itemType !== 'STICKER');
  const chestNote =
    chestsLeft === null
      ? ''
      : chestsLeft > 0
        ? `Você ainda pode comprar ${chestsLeft} baú(s) hoje.`
        : 'Você já comprou o limite de baús de hoje. Jogue para ganhar mais ou volte amanhã!';
  const stickerNote =
    stickersLeft === null ? '' : stickersLeft > 0 ? `Pacote e figurinhas dividem um limite diário: você ainda pode comprar ${stickersLeft} hoje.` : 'Você já comprou o limite de pacotes e figurinhas de hoje. Jogue para ganhar mais ou volte amanhã!';

  const groups: Array<{ title: string; description: string; items: ShopItem[]; kind: 'chest' | 'item' }> =
    tab === 'figurinhas'
      ? [
          { title: 'Baús', description: `Abrem na hora, com a mesma animação dos baús das partidas. O baú de diamante só se ganha jogando. ${chestNote}`, items: chests, kind: 'chest' as const },
          { title: 'Pacote de figurinhas', description: `Sorteia a raridade pelas chances abaixo e depois a figurinha. ${stickerNote}`, items: packs, kind: 'item' as const },
          { title: 'Figurinha por raridade', description: 'Você escolhe a raridade; a figurinha é sorteada entre as que você ainda não tem.', items: singles, kind: 'item' as const },
        ]
      : tab === 'poderes'
        ? [{ title: 'Poderes para as partidas', description: 'Ficam guardados; use uma de cada por partida.', items: powers, kind: 'item' as const }]
        : [];
  const visibleGroups = groups.filter((group) => group.items.length > 0);

  return (
    <div className="space-y-6">
      <SectionHeading title="Loja" subtitle="Troque suas moedas por baús, figurinhas, poderes e visual." action={<CoinChip value={coins} className="h-11 text-base" />} />

      <Segmented
        aria-label="Parte da loja"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'figurinhas', label: 'Figurinhas' },
          { value: 'poderes', label: 'Poderes' },
          { value: 'cosmeticos', label: 'Cosméticos' },
        ]}
      />

      {tab === 'cosmeticos' ? <CosmeticShop profile={profile} coins={coins} onCoins={onCoins} /> : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {tab !== 'cosmeticos' && visibleGroups.length === 0 && !error ? (
        <EmptyState icon={<StorefrontRoundedIcon fontSize="large" />} title="Nada por aqui ainda">
          Volte mais tarde.
        </EmptyState>
      ) : null}

      {visibleGroups.map((group) => (
        <section key={group.title} className="space-y-3">
          <div>
            <h3 className="font-display text-xl font-bold text-ink">{group.title}</h3>
            <p className="text-sm text-muted">{group.description}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((item) => {
              const { rarity, icon, tint } = describeItem(item);
              const chest = item.rewardType ? CHEST_CONTENTS[item.rewardType] : undefined;
              const canAfford = coins >= item.priceCoins;
              const buying = buyingItemId === item.id;

              return (
                <article key={item.id} className="panel flex flex-col overflow-hidden">
                  {chest ? (
                    <ChestBanner tier={chest.tier} />
                  ) : (
                    <div data-rarity={rarity} className={cn('flex h-32 items-center justify-center', rarity ? 'rarity rarity-bg' : 'bg-surface-2')}>
                      <span className={cn('flex h-20 w-20 items-center justify-center rounded-3xl', rarity ? 'rarity-frame rarity-text bg-surface' : tint)}>{icon}</span>
                    </div>
                  )}
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <div>
                      <h4 className="font-display text-xl font-bold text-ink">{item.name}</h4>
                      <p className="mt-1 text-sm text-muted">{item.description}</p>
                    </div>
                    {chest ? (
                      <ul className="space-y-1 text-sm font-semibold text-ink" aria-label="O que o baú traz">
                        {chest.lines.map((line) => (
                          <li key={line} className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                            {line}
                          </li>
                        ))}
                      </ul>
                    ) : null}
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
                      disabled={!canAfford || (buyingItemId !== null && !buying) || (item.itemType === 'STICKER' && (((item.rewardType ?? '').startsWith('CHEST_') ? chestsLeft : stickersLeft) === 0))}
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

/** Topo do cartão de um baú da loja, com a arte cadastrada (ou o desenho padrão). */
function ChestBanner({ tier }: { tier: ChestTierName }) {
  const look = useChestLook(tier);
  return (
    <div className="flex h-36 items-center justify-center" style={{ background: `radial-gradient(circle, ${look.color}55, transparent 72%)` }}>
      <ChestIcon tier={tier} className="h-28 w-32 drop-shadow-lg" />
    </div>
  );
}
