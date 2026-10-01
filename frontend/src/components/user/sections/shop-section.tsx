import type { ReactNode } from 'react';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import CardGiftcardRoundedIcon from '@mui/icons-material/CardGiftcardRounded';
import ContentCutRoundedIcon from '@mui/icons-material/ContentCutRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import { Button } from '@/components/ui/button';
import { Alert, CoinChip, CoinIcon, EmptyState, SectionHeading } from '@/components/game/game-ui';
import { cn } from '@/lib/cn';
import type { StickerRarity } from '@/lib/admin-api';
import { RARITY_ORDER, getRarityLabel } from '@/lib/rarity-theme';
import type { GameRules, ShopItem } from '@/lib/user-api';

/** Visual de cada item a partir da recompensa que ele entrega. */
function describeItem(item: ShopItem): { rarity?: StickerRarity; icon: ReactNode; tint: string } {
  switch (item.rewardType) {
    case 'STICKER':
      return { rarity: item.rewardRarity ?? 'COMMON', icon: <MenuBookRoundedIcon sx={{ fontSize: 40 }} />, tint: '' };
    case 'STICKER_PACK':
      return { icon: <CardGiftcardRoundedIcon sx={{ fontSize: 40 }} />, tint: 'bg-[linear-gradient(135deg,var(--violet),var(--info))] text-white' };
    case 'EXTRA_LIFE':
      return { icon: <FavoriteRoundedIcon sx={{ fontSize: 40 }} />, tint: 'bg-danger/15 text-danger' };
    case 'EXTRA_TIME':
      return { icon: <TimerRoundedIcon sx={{ fontSize: 40 }} />, tint: 'bg-info/15 text-info' };
    case 'FIFTY_FIFTY':
      return { icon: <ContentCutRoundedIcon sx={{ fontSize: 40 }} />, tint: 'bg-violet/15 text-violet' };
    case 'STREAK_FREEZE':
      return { icon: <ShieldRoundedIcon sx={{ fontSize: 40 }} />, tint: 'bg-info/15 text-info' };
    default:
      return { icon: <BoltRoundedIcon sx={{ fontSize: 40 }} />, tint: 'bg-primary/20 text-primary-strong dark:text-primary' };
  }
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
};

export function ShopSection({ items, coins, gameRules, buyingItemId, error, onBuy }: ShopSectionProps) {
  const odds = packOdds(gameRules);
  const groups = [
    { title: 'Figurinhas', description: 'Sorteia uma figurinha que você ainda não tem.', items: items.filter((item) => item.itemType === 'STICKER') },
    { title: 'Bônus para as partidas', description: 'Ficam guardados; use um de cada por partida.', items: items.filter((item) => item.itemType !== 'STICKER') },
  ].filter((group) => group.items.length > 0);

  return (
    <div className="space-y-6">
      <SectionHeading title="Loja" subtitle="Troque suas moedas por figurinhas e bônus." action={<CoinChip value={coins} className="h-11 text-base" />} />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {items.length === 0 && !error ? (
        <EmptyState icon={<StorefrontRoundedIcon fontSize="large" />} title="A loja está vazia">
          Volte mais tarde.
        </EmptyState>
      ) : null}

      {groups.map((group) => (
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
                      disabled={!canAfford || (buyingItemId !== null && !buying)}
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
