import { useCallback, useEffect, useState } from 'react';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import MilitaryTechRoundedIcon from '@mui/icons-material/MilitaryTechRounded';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Pagination, usePagination } from '@/components/ui/pagination';
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

/** Cartão do passe (nome, tema, XP do mês, progresso). Só apresentação: serve ao jogador e à prévia do painel. */
export function PassCardView({ pass, onOpenTrail }: { pass: SeasonPass; onOpenTrail?: () => void }) {
  const info = pass.pass;
  if (!info) return null;
  const top = Math.max(pass.tiers.at(-1)?.requiredXp ?? 1, 1);
  const next = pass.tiers.find((tier) => !tier.reached);
  const ready = pass.tiers.filter((tier) => tier.reached && !tier.claimed).length;
  const month = MONTHS[Number(pass.monthKey.slice(5, 7)) - 1];

  return (
    <section className="panel relative space-y-3 overflow-hidden p-5" style={info.color ? { borderColor: info.color } : undefined}>
      {info.imageUrl ? (
        <>
          <img src={info.imageUrl} alt="" aria-hidden="true" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-surface/90 to-surface/30" />
        </>
      ) : null}
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
            <MilitaryTechRoundedIcon style={info.color ? { color: info.color } : undefined} className="text-violet" /> {info.name}
          </h3>
          <p className="text-sm text-muted">
            {pass.xp.toLocaleString('pt-BR')} XP em {month} · acaba em {daysLeft(pass.endsAt)} dias
          </p>
          {info.description ? <p className="mt-0.5 text-xs font-semibold text-muted">{info.description}</p> : null}
        </div>
        <Button size="sm" variant={ready ? 'primary' : 'secondary'} onClick={onOpenTrail} className={cn('shrink-0 whitespace-nowrap', !onOpenTrail && 'pointer-events-none')} tabIndex={onOpenTrail ? undefined : -1}>
          {ready ? `Resgatar (${ready})` : 'Ver trilha'}
        </Button>
      </div>
      <ProgressBar className="relative" value={Math.min(100, (pass.xp / top) * 100)} />
      <p className="relative text-xs font-semibold text-muted">
        {pass.tiers.length === 0
          ? 'Este passe ainda não tem degraus.'
          : next
            ? `Próximo prêmio com ${next.requiredXp.toLocaleString('pt-BR')} XP (faltam ${(next.requiredXp - pass.xp).toLocaleString('pt-BR')}).`
            : 'Você completou a trilha deste mês!'}
        {pass.nextPass ? ` · No mês que vem: ${pass.nextPass.name}.` : ''}
      </p>
    </section>
  );
}

/** Lista de degraus do passe, paginada. Sem `onClaim` (prévia do painel) o botão de resgate não aparece. */
export function PassTrail({ pass, playerName, claiming, onClaim, pageSize = 5 }: { pass: SeasonPass; playerName: string; claiming?: number | null; onClaim?: (tier: PassTierView) => void; pageSize?: number }) {
  const paging = usePagination(pass.tiers, pageSize);
  return (
    <>
      <ol className="space-y-2">
        {paging.pageItems.map((tier) => (
          <li key={tier.id} className={cn('flex items-center gap-3 rounded-2xl border-2 p-3', tier.claimed ? 'border-success/40 bg-success/5' : tier.reached ? 'border-primary bg-primary/10' : 'border-edge')}>
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display font-bold', tier.reached ? 'bg-primary text-on-primary' : 'bg-surface-3 text-muted')}>{tier.level}</span>
            <div className="min-w-0 flex-1 space-y-1">
              <TierReward tier={tier} playerName={playerName} />
              <p className="text-xs font-semibold text-muted">{tier.requiredXp.toLocaleString('pt-BR')} XP</p>
            </div>
            {tier.claimed ? (
              <CheckCircleRoundedIcon className="text-success" />
            ) : tier.reached && onClaim ? (
              <Button size="sm" onClick={() => onClaim(tier)} loading={claiming === tier.id} disabled={claiming !== null && claiming !== undefined}>
                Resgatar
              </Button>
            ) : tier.reached ? (
              <span className="text-xs font-bold text-primary-strong dark:text-primary">Liberado</span>
            ) : (
              <LockRoundedIcon className="text-muted" fontSize="small" />
            )}
          </li>
        ))}
      </ol>
      {paging.totalPages > 1 ? <Pagination className="mt-3" page={paging.page} totalPages={paging.totalPages} totalElements={paging.totalElements} onPageChange={paging.setPage} itemLabel="degraus" /> : null}
    </>
  );
}

/** Passe da temporada: trilha mensal de prêmios liberada pelo XP do mês. */
export function SeasonPassCard({ profile, onClaimed }: { profile: UserProfile | null; onClaimed: (user: UserProfile, achievements: UnlockedAchievement[]) => void }) {
  const toast = useToast();
  const [pass, setPass] = useState<SeasonPass | null>(null);
  const [open, setOpen] = useState(false);
  const [claiming, setClaiming] = useState<number | null>(null);

  const load = useCallback(() => {
    getSeasonPass()
      .then(setPass)
      .catch(() => setPass(null));
  }, []);

  useEffect(load, [load]);

  if (!pass || !pass.pass || pass.tiers.length === 0) return null;
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
    <>
      <PassCardView pass={pass} onOpenTrail={() => setOpen(true)} />
      <Modal
        open={open}
        size="md"
        title={pass.pass.name}
        description={`Todo XP que você ganha em ${month} sobe a trilha. No dia 1º vem o próximo passe${pass.nextPass ? `: ${pass.nextPass.name}` : ''}.`}
        onClose={() => setOpen(false)}
      >
        <PassTrail pass={pass} playerName={profile?.name ?? 'Você'} claiming={claiming} onClaim={(tier) => void claim(tier)} />
      </Modal>
    </>
  );
}
