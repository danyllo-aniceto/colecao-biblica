import { useEffect, useState } from 'react';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ContentCutRoundedIcon from '@mui/icons-material/ContentCutRounded';
import LocalFireDepartmentRoundedIcon from '@mui/icons-material/LocalFireDepartmentRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import { Tooltip } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { errorMessage, useToast } from '@/components/ui/toast';
import { CoinIcon } from '@/components/game/game-ui';
import { cn } from '@/lib/cn';
import { claimDailyReward, getDailyReward, type DailyClaimResult, type DailyRewardStatus } from '@/lib/user-api';

/** Prêmio diário: ciclo de 7 dias que cresce a cada dia seguido. */
export function DailyRewardCard({ onClaimed }: { onClaimed: (result: DailyClaimResult) => void }) {
  const toast = useToast();
  const [status, setStatus] = useState<DailyRewardStatus | null>(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    getDailyReward()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  async function claim() {
    setClaiming(true);
    try {
      const result = await claimDailyReward();
      onClaimed(result);
      setStatus(await getDailyReward());
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setClaiming(false);
    }
  }

  if (!status) {
    return (
      <section className="panel flex items-center justify-center p-6">
        <Spinner />
      </section>
    );
  }

  // Dias do ciclo já resgatados: os anteriores ao próximo (ou o de hoje, se já pegou).
  const doneUntil = status.canClaim ? status.nextDay - 1 : (status.todayDay ?? 0);

  return (
    <section className="panel space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/20 text-primary-strong dark:text-primary">
            <CalendarMonthRoundedIcon />
          </span>
          <div>
            <h2 className="font-display text-xl font-bold text-ink">Prêmio diário</h2>
            <p className="flex items-center gap-1 text-sm font-semibold text-muted">
              <LocalFireDepartmentRoundedIcon fontSize="small" className={status.streak > 0 ? 'text-danger' : ''} />
              {status.streak > 0 ? `${status.streak} dia(s) seguido(s)` : 'Volte todo dia para aumentar o prêmio'}
            </p>
            {status.streakFreezes > 0 ? (
              <Tooltip content="Protetor de sequência: se você esquecer um dia, ele é usado sozinho e a sequência continua.">
                <span tabIndex={0} className="mt-1 inline-flex items-center gap-1 rounded-full bg-info/15 px-2 py-0.5 text-xs font-bold text-info-strong dark:text-info">
                  <ShieldRoundedIcon sx={{ fontSize: 14 }} /> {status.streakFreezes} protetor(es)
                </span>
              </Tooltip>
            ) : null}
          </div>
        </div>
        {status.canClaim ? (
          <Button onClick={() => void claim()} loading={claiming} className="animate-glow-pulse">
            {claiming ? 'Resgatando...' : `Resgatar dia ${status.nextDay}`}
          </Button>
        ) : (
          <span className="rounded-full bg-success/15 px-3 py-1.5 font-display text-sm font-bold text-success-strong dark:text-success">Volte amanhã!</span>
        )}
      </div>
      {status.canClaim && status.freezesToUse > 0 ? (
        <p className="flex items-center gap-2 rounded-2xl bg-info/10 px-3 py-2 text-sm font-semibold text-info-strong dark:text-info">
          <ShieldRoundedIcon fontSize="small" />
          Você esqueceu {status.freezesToUse === 1 ? 'um dia' : `${status.freezesToUse} dias`}, mas seu protetor vai salvar a sequência.
        </p>
      ) : null}
      <ol className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {status.cycle.map((reward) => {
          const done = reward.day <= doneUntil;
          const next = status.canClaim && reward.day === status.nextDay;
          return (
            <li
              key={reward.day}
              className={cn(
                'flex flex-col items-center gap-1 rounded-2xl border-2 px-1 py-2 text-center',
                done ? 'border-success/40 bg-success/10' : next ? 'border-primary bg-primary/15' : 'border-edge bg-surface-2',
                reward.day === 7 && !done && 'border-violet/60',
              )}
            >
              <span className="text-[10px] font-bold uppercase text-muted">Dia {reward.day}</span>
              {done ? <CheckRoundedIcon className="text-success" /> : reward.hints ? <ContentCutRoundedIcon className="text-violet" fontSize="small" /> : <CoinIcon className="h-5 w-5" />}
              <span className="font-display text-xs font-bold text-ink sm:text-sm">{reward.coins}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
