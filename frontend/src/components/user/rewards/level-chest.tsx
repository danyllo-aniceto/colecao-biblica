import { useState } from 'react';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { errorMessage, useToast } from '@/components/ui/toast';
import { CoinIcon } from '@/components/game/game-ui';
import { COSMETIC_TYPE_LABELS, CosmeticPreview } from '@/components/user/rewards/cosmetic-preview';
import { helperByField } from '@/lib/quiz-helpers';
import { rewardVisual } from '@/lib/reward-visual';
import { openChest, type ChestResult } from '@/lib/rewards-api';
import type { UserProfile } from '@/types/auth';

const OLD_BOOST_TYPES: Record<string, string> = { extraLifeBoosts: 'EXTRA_LIFE', extraTimeBoosts: 'EXTRA_TIME', doubleXpBoosts: 'XP_MULTIPLIER', hintBoosts: 'FIFTY_FIFTY' };

/** Baú de nível: aparece quando o jogador sobe de nível e abre com animação. */
export function LevelChestCard({ profile, onOpened }: { profile: UserProfile | null; onOpened: (user: UserProfile) => void }) {
  const toast = useToast();
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState<ChestResult | null>(null);
  const pending = profile?.chestsPending ?? 0;
  if (pending <= 0 && !result) return null;

  async function open() {
    setOpening(true);
    try {
      // Pequena pausa para a animação do baú balançando.
      const [opened] = await Promise.all([openChest(), new Promise((resolve) => window.setTimeout(resolve, 700))]);
      setResult(opened);
      onOpened(opened.user);
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setOpening(false);
    }
  }

  const boostType = result?.boost ? (helperByField(result.boost.field)?.rewardType ?? OLD_BOOST_TYPES[result.boost.field]) : null;

  return (
    <>
      {pending > 0 ? (
        <section className="panel relative flex items-center gap-4 overflow-hidden p-5">
          <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-primary/30 blur-3xl" />
          <span className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-primary text-on-primary shadow-[0_4px_0_var(--primary-strong)] ${opening ? 'chest-shake' : 'animate-float'}`}>
            <Inventory2RoundedIcon sx={{ fontSize: 36 }} />
          </span>
          <div className="relative min-w-0 flex-1">
            <h3 className="font-display text-lg font-bold text-ink">{pending > 1 ? `${pending} baús de nível` : 'Baú de nível'}</h3>
            <p className="text-sm text-muted">Você subiu de nível! Abra para ganhar moedas, uma ajuda e, com sorte, um item visual.</p>
          </div>
          <Button className="relative" onClick={() => void open()} loading={opening}>
            Abrir
          </Button>
        </section>
      ) : null}
      <Modal
        open={result !== null}
        size="sm"
        title={`Baú do nível ${result?.level ?? ''}`}
        onClose={() => setResult(null)}
        footer={<Button onClick={() => setResult(null)}>{(result?.chestsPending ?? 0) > 0 ? 'Fechar (tem mais baús!)' : 'Continuar'}</Button>}
      >
        {result ? (
          <div className="space-y-3">
            <div className="animate-pop-in flex items-center gap-3 rounded-2xl bg-primary/15 p-3">
              <CoinIcon className="h-8 w-8" />
              <span className="font-display text-xl font-bold text-ink">+{result.coins} moedas</span>
            </div>
            {result.boost && boostType ? (
              <div className="animate-pop-in flex items-center gap-3 rounded-2xl bg-surface-2 p-3" style={{ animationDelay: '120ms' }}>
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${rewardVisual(boostType, 24).tint}`}>{rewardVisual(boostType, 24).icon}</span>
                <span className="font-display font-bold text-ink">+1 {result.boost.name}</span>
              </div>
            ) : null}
            {result.cosmetic ? (
              <div data-rarity={result.cosmetic.rarity} className="rarity animate-pop-in flex items-center gap-3 rounded-2xl rarity-bg p-3" style={{ animationDelay: '240ms' }}>
                <span className="flex h-14 w-14 items-center justify-center">
                  <CosmeticPreview item={result.cosmetic} playerName={result.user.name} size="md" />
                </span>
                <span>
                  <span className="block font-display font-bold text-ink">{result.cosmetic.name}</span>
                  <span className="text-xs font-semibold text-muted">Novo {COSMETIC_TYPE_LABELS[result.cosmetic.type].one.toLowerCase()} · equipe em Perfil → Visual</span>
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
