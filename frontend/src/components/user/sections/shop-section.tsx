'use client';

import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import { Button } from '@/components/ui/button';
import { Alert, CoinChip, CoinIcon, EmptyState, SectionHeading } from '@/components/game/game-ui';
import type { StickerRarity } from '@/lib/admin-api';
import type { ShopItem } from '@/lib/user-api';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/** Descobre a raridade ou o tipo de bônus pelo nome da recompensa ligada ao item. */
function describeItem(item: ShopItem): { rarity?: StickerRarity; icon: React.ReactNode; tint: string } {
  const reference = `${item.rewardName ?? ''} ${item.name}`.toLowerCase();

  if (item.itemType === 'STICKER') {
    const rarity: StickerRarity = reference.includes('lend')
      ? 'LEGENDARY'
      : reference.includes('épica') || reference.includes('epica')
        ? 'EPIC'
        : reference.includes('rara')
          ? 'RARE'
          : 'COMMON';
    return { rarity, icon: <MenuBookRoundedIcon sx={{ fontSize: 40 }} />, tint: '' };
  }
  if (reference.includes('vida')) {
    return { icon: <FavoriteRoundedIcon sx={{ fontSize: 40 }} />, tint: 'bg-danger/15 text-danger' };
  }
  if (reference.includes('tempo')) {
    return { icon: <TimerRoundedIcon sx={{ fontSize: 40 }} />, tint: 'bg-info/15 text-info' };
  }
  return { icon: <BoltRoundedIcon sx={{ fontSize: 40 }} />, tint: 'bg-primary/20 text-primary-strong dark:text-primary' };
}

type ShopSectionProps = {
  items: ShopItem[];
  coins: number;
  buyingItemId: number | null;
  feedback: string | null;
  error: string | null;
  onBuy: (item: ShopItem) => void;
};

export function ShopSection({ items, coins, buyingItemId, feedback, error, onBuy }: ShopSectionProps) {
  return (
    <div className="space-y-5">
      <SectionHeading title="Loja" subtitle="Troque suas moedas por figurinhas e bônus." action={<CoinChip value={coins} className="h-11 text-base" />} />

      {feedback ? <Alert tone="success">{feedback}</Alert> : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}

      {items.length === 0 && !error ? (
        <EmptyState icon={<StorefrontRoundedIcon fontSize="large" />} title="A loja está vazia">
          Volte mais tarde.
        </EmptyState>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const { rarity, icon, tint } = describeItem(item);
          const canAfford = coins >= item.priceCoins;
          const buying = buyingItemId === item.id;

          return (
            <article key={item.id} className="panel flex flex-col overflow-hidden">
              <div
                data-rarity={rarity}
                className={cn('flex h-32 items-center justify-center', rarity ? 'rarity rarity-bg' : 'bg-surface-2')}
              >
                <span className={cn('flex h-20 w-20 items-center justify-center rounded-3xl', rarity ? 'rarity-frame rarity-text bg-surface' : tint)}>{icon}</span>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-5">
                <div>
                  <h3 className="font-display text-xl font-bold text-ink">{item.name}</h3>
                  <p className="mt-1 text-sm text-muted">{item.description}</p>
                </div>
                <Button className="mt-auto w-full" variant={canAfford ? 'primary' : 'secondary'} onClick={() => onBuy(item)} disabled={!canAfford || buyingItemId !== null}>
                  <CoinIcon />
                  {buying ? 'Comprando...' : item.priceCoins.toLocaleString('pt-BR')}
                </Button>
                {!canAfford ? <p className="text-center text-xs font-semibold text-muted">Faltam {item.priceCoins - coins} moedas</p> : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
