import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { CoinIcon } from '@/components/game/game-ui';
import { StickerCard } from '@/components/game/sticker-card';
import { cn } from '@/lib/cn';
import { getRarityLabel } from '@/lib/rarity-theme';
import { rewardVisual } from '@/lib/reward-visual';
import type { RewardResult } from '@/lib/rewards-api';

export type RewardReveal = {
  title: string;
  coins: number;
  /** Recompensas entregues (a principal e, no passe, a do item repetido). */
  rewards: RewardResult[];
  /** Item visual novo ganho (nome). */
  cosmeticName?: string | null;
  note?: string | null;
};

/** O que o resgate trouxe de relevante para mostrar numa janela (figurinha ou item visual)? */
export function worthRevealing(reveal: RewardReveal) {
  return reveal.rewards.some((reward) => reward.characterName) || Boolean(reveal.cosmeticName);
}

/** Janela "Você ganhou!": mostra a figurinha sorteada (nova ou repetida), moedas, ajudas e itens visuais de um resgate. */
export function RewardRevealModal({ reveal, onClose }: { reveal: RewardReveal | null; onClose: () => void }) {
  const stickers = reveal?.rewards.filter((reward) => reward.characterName) ?? [];
  const others = reveal?.rewards.filter((reward) => !reward.characterName && reward.rewardType !== 'COSMETIC') ?? [];

  return (
    <Modal open={reveal !== null} size="sm" title={reveal?.title ?? ''} onClose={onClose} footer={<Button onClick={onClose}>Continuar</Button>}>
      {reveal ? (
        <div className="space-y-4 text-center">
          <p className="font-display text-lg font-bold text-ink">Você ganhou!</p>

          {stickers.length > 0 ? (
            <div className="flex flex-wrap items-start justify-center gap-4">
              {stickers.map((reward, index) => (
                <div key={index} className="animate-pop-in w-36 space-y-1.5">
                  <StickerCard name={reward.characterName ?? 'Figurinha'} rarity={reward.characterRarity ?? 'COMMON'} imageUrl={reward.characterImageUrl} owned size="sm" />
                  <p className="font-display text-sm font-bold text-ink">{reward.characterName}</p>
                  {reward.characterRarity ? <p className="text-xs font-bold uppercase tracking-wider text-muted">{getRarityLabel(reward.characterRarity)}</p> : null}
                  <p className={cn('text-xs font-bold', reward.characterUnlocked ? 'text-success-strong dark:text-success' : 'text-muted')}>{reward.characterUnlocked ? 'Nova no seu álbum!' : 'Repetida: foi para as repetidas'}</p>
                </div>
              ))}
            </div>
          ) : null}

          <ul className="space-y-2 text-left">
            {reveal.coins > 0 ? (
              <li className="flex items-center gap-3 rounded-2xl bg-primary/15 p-3">
                <CoinIcon className="h-6 w-6" />
                <span className="font-display font-bold text-ink">+{reveal.coins} moedas</span>
              </li>
            ) : null}
            {others.map((reward, index) => (
              <li key={index} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
                <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', rewardVisual(reward.rewardType, 20).tint)}>{rewardVisual(reward.rewardType, 20).icon}</span>
                <span className="font-display font-bold text-ink">{reward.rewardName}</span>
              </li>
            ))}
            {reveal.cosmeticName ? (
              <li className="flex items-center gap-3 rounded-2xl bg-accent/15 p-3">
                <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', rewardVisual('COSMETIC', 20).tint)}>{rewardVisual('COSMETIC', 20).icon}</span>
                <span className="font-display font-bold text-ink">Item visual: {reveal.cosmeticName}</span>
              </li>
            ) : null}
          </ul>
          {reveal.note ? <p className="text-xs font-semibold text-muted">{reveal.note}</p> : null}
        </div>
      ) : null}
    </Modal>
  );
}
