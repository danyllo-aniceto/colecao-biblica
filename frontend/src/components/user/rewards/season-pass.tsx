import { useCallback, useEffect, useState } from 'react';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import MilitaryTechRoundedIcon from '@mui/icons-material/MilitaryTechRounded';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { LoadingState, Spinner } from '@/components/ui/spinner';
import { errorMessage, useToast } from '@/components/ui/toast';
import { CoinIcon, ProgressBar } from '@/components/game/game-ui';
import { CosmeticPreview } from '@/components/user/rewards/cosmetic-preview';
import { cn } from '@/lib/cn';
import { rewardVisual } from '@/lib/reward-visual';
import { claimPassTier, getSeasonPass, type PassTierView, type SeasonPass } from '@/lib/rewards-api';
import type { UnlockedAchievement } from '@/lib/user-api';
import type { UserProfile } from '@/types/auth';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function daysLeft(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

function TierReward({ tier, playerName }: { tier: PassTierView; playerName: string }) {
  return (
    <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
      {tier.rewardCoins > 0 ? (
        <span className="inline-flex items-center gap-1">
          <CoinIcon className="h-4 w-4" /> {tier.rewardCoins}
        </span>
      ) : null}
      {tier.reward ? (
        <span className="inline-flex items-center gap-1">
          <span className={cn('inline-flex h-6 w-6 items-center justify-center rounded-lg', rewardVisual(tier.reward.rewardType, 16).tint)}>{rewardVisual(tier.reward.rewardType, 16).icon}</span>
          {tier.reward.name}
        </span>
      ) : null}
      {tier.cosmetic ? (
        <span className={cn('inline-flex items-center gap-1.5', tier.cosmeticOwned && 'opacity-60')}>
          <span className="inline-flex max-w-[9rem] items-center">
            <CosmeticPreview item={tier.cosmetic} playerName={playerName} size="md" />
          </span>
          {tier.cosmetic.type === 'TITLE' ? null : tier.cosmetic.name}
        </span>
      ) : null}
      {tier.cosmeticOwned && tier.duplicateCoins !== null ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary-strong dark:text-primary">
          Você já tem este item: vira <CoinIcon className="h-3.5 w-3.5" /> +{tier.duplicateCoins}
        </span>
      ) : null}
    </span>
  );
}

/** Passe da temporada: trilha mensal de prêmios liberada pelo XP do mês. */
export function SeasonPassCard({ profile, onClaimed }: { profile: UserProfile | null; onClaimed: (user: UserProfile, achievements: UnlockedAchievement[]) => void }) {
  const toast = useToast();
  const [pass, setPass] = useState<SeasonPass | null>(null);
  const [open, setOpen] = useState(false);
  const [claiming, setClaiming] = useState<number | null>(null);
  const paging = usePagination(pass?.tiers ?? [], 5);

  const load = useCallback(() => {
    getSeasonPass()
      .then(setPass)
      .catch(() => setPass(null));
  }, []);

  useEffect(load, [load]);

  if (!pass || !pass.pass || pass.tiers.length === 0) return null;
  const top = pass.tiers.at(-1)!.requiredXp;
  const next = pass.tiers.find((tier) => !tier.reached);
  const ready = pass.tiers.filter((tier) => tier.reached && !tier.claimed).length;
  const month = MONTHS[Number(pass.monthKey.slice(5, 7)) - 1];

  async function claim(tier: PassTierView) {
    setClaiming(tier.id);
    try {
      const result = await claimPassTier(tier.id);
      onClaimed(result.user, result.unlockedAchievements);
      toast.success(`Prêmio do degrau ${tier.level} resgatado!`, {
        description: [
          result.coins ? `+${result.coins} moedas` : null,
          result.reward?.characterName ?? result.reward?.rewardName,
          result.cosmeticGranted ? tier.cosmetic?.name : null,
          result.duplicate ? `Item repetido: +${result.duplicate.coins} moedas${result.duplicate.reward ? ` e ${result.duplicate.reward.characterName ?? result.duplicate.reward.rewardName}` : ''}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      });
      load();
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setClaiming(null);
    }
  }

  return (
    <section className="panel relative space-y-3 overflow-hidden p-5" style={pass.pass.color ? { borderColor: pass.pass.color } : undefined}>
      {pass.pass.imageUrl ? (
        <>
          <img src={pass.pass.imageUrl} alt="" aria-hidden="true" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-surface/90 to-surface/30" />
        </>
      ) : null}
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
            <MilitaryTechRoundedIcon style={pass.pass.color ? { color: pass.pass.color } : undefined} className="text-violet" /> {pass.pass.name}
          </h3>
          <p className="text-sm text-muted">
            {pass.xp.toLocaleString('pt-BR')} XP em {month} · acaba em {daysLeft(pass.endsAt)} dias
          </p>
          {pass.pass.description ? <p className="mt-0.5 text-xs font-semibold text-muted">{pass.pass.description}</p> : null}
        </div>
        <Button size="sm" variant={ready ? 'primary' : 'secondary'} onClick={() => setOpen(true)}>
          {ready ? `Resgatar (${ready})` : 'Ver trilha'}
        </Button>
      </div>
      <ProgressBar className="relative" value={Math.min(100, (pass.xp / top) * 100)} />
      <p className="relative text-xs font-semibold text-muted">
        {next ? `Próximo prêmio com ${next.requiredXp.toLocaleString('pt-BR')} XP (faltam ${(next.requiredXp - pass.xp).toLocaleString('pt-BR')}).` : 'Você completou a trilha deste mês!'}
        {pass.nextPass ? ` · No mês que vem: ${pass.nextPass.name}.` : ''}
      </p>

      <Modal open={open} size="md" title={pass.pass.name} description={`Todo XP que você ganha em ${month} sobe a trilha. No dia 1º vem o próximo passe${pass.nextPass ? `: ${pass.nextPass.name}` : ''}.`} onClose={() => setOpen(false)}>
        {!pass ? <LoadingState /> : null}
        <ol className="space-y-2">
          {paging.pageItems.map((tier) => (
            <li key={tier.id} className={cn('flex items-center gap-3 rounded-2xl border-2 p-3', tier.claimed ? 'border-success/40 bg-success/5' : tier.reached ? 'border-primary bg-primary/10' : 'border-edge')}>
              <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display font-bold', tier.reached ? 'bg-primary text-on-primary' : 'bg-surface-3 text-muted')}>{tier.level}</span>
              <div className="min-w-0 flex-1 space-y-1">
                <TierReward tier={tier} playerName={profile?.name ?? 'Você'} />
                <p className="text-xs font-semibold text-muted">{tier.requiredXp.toLocaleString('pt-BR')} XP</p>
              </div>
              {tier.claimed ? (
                <CheckCircleRoundedIcon className="text-success" />
              ) : tier.reached ? (
                <Button size="sm" onClick={() => void claim(tier)} loading={claiming === tier.id} disabled={claiming !== null}>
                  Resgatar
                </Button>
              ) : (
                <LockRoundedIcon className="text-muted" fontSize="small" />
              )}
            </li>
          ))}
        </ol>
        {claiming !== null ? <Spinner className="sr-only" /> : null}
        {paging.totalPages > 1 ? <Pagination className="mt-3" page={paging.page} totalPages={paging.totalPages} totalElements={paging.totalElements} onPageChange={paging.setPage} itemLabel="degraus" /> : null}
      </Modal>
    </section>
  );
}
