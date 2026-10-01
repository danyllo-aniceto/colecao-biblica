import { useEffect, useState } from 'react';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ContentCutRoundedIcon from '@mui/icons-material/ContentCutRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Spinner } from '@/components/ui/spinner';
import { errorMessage, useToast } from '@/components/ui/toast';
import { CoinIcon, ProgressBar } from '@/components/game/game-ui';
import { cn } from '@/lib/cn';
import { claimMission, listMissions, type Mission } from '@/lib/user-api';

/** Tempo restante até o fim do período ("termina em 5 h", "termina em 3 dias"). */
function remaining(endsAt: string) {
  const hours = Math.max(0, Math.round((new Date(endsAt).getTime() - Date.now()) / 3_600_000));
  if (hours < 1) return 'termina em menos de 1 h';
  if (hours < 48) return `termina em ${hours} h`;
  return `termina em ${Math.round(hours / 24)} dias`;
}

/** Missões diárias (3, mudam todo dia) e semanais, com resgate da recompensa. */
export function MissionsCard({ onClaimed }: { onClaimed: (result: { userCoins: number; hintBoosts: number }) => void }) {
  const toast = useToast();
  const [missions, setMissions] = useState<Mission[] | null>(null);
  const [period, setPeriod] = useState<'DAILY' | 'WEEKLY'>('DAILY');
  const [claiming, setClaiming] = useState<string | null>(null);

  function load() {
    listMissions()
      .then(setMissions)
      .catch(() => setMissions([]));
  }

  useEffect(load, []);

  async function claim(mission: Mission) {
    setClaiming(mission.code);
    try {
      const result = await claimMission(mission.code);
      onClaimed(result);
      toast.success('Missão concluída!', { description: `+${result.coins} moedas${result.hints ? ` e +${result.hints} dica 50/50` : ''}`, icon: <CoinIcon /> });
      load();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setClaiming(null);
    }
  }

  const visible = (missions ?? []).filter((mission) => mission.period === period);
  const ready = (missions ?? []).filter((mission) => mission.completed && !mission.claimed).length;

  return (
    <section className="panel space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15 text-accent-strong dark:text-accent">
            <TaskAltRoundedIcon />
            {ready > 0 ? <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">{ready}</span> : null}
          </span>
          <div>
            <h2 className="font-display text-xl font-bold text-ink">Missões</h2>
            <p className="text-sm text-muted">{visible[0] ? remaining(visible[0].endsAt) : 'Metas que renovam e dão moedas'}</p>
          </div>
        </div>
        <div className="w-56">
          <Segmented
            aria-label="Período das missões"
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'DAILY', label: 'Hoje' },
              { value: 'WEEKLY', label: 'Semana' },
            ]}
          />
        </div>
      </div>

      {missions === null ? (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((mission) => (
            <li key={mission.code} className={cn('flex items-center gap-3 rounded-2xl p-3', mission.claimed ? 'bg-success/10' : 'bg-surface-2')}>
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className={cn('font-display font-semibold', mission.claimed ? 'text-muted line-through' : 'text-ink')}>{mission.title}</p>
                  <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-ink">
                    <CoinIcon className="h-4 w-4" />
                    {mission.coins}
                    {mission.hints ? <ContentCutRoundedIcon sx={{ fontSize: 16 }} className="ml-1 text-violet" /> : null}
                  </span>
                </div>
                {!mission.claimed ? (
                  <div className="flex items-center gap-2">
                    <ProgressBar value={(mission.current / mission.target) * 100} className="h-2" />
                    <span className="shrink-0 text-xs font-bold text-muted">
                      {mission.current}/{mission.target}
                    </span>
                  </div>
                ) : null}
              </div>
              {mission.claimed ? (
                <CheckCircleRoundedIcon className="text-success" aria-label="Resgatada" />
              ) : mission.completed ? (
                <Button size="sm" onClick={() => void claim(mission)} loading={claiming === mission.code} className="animate-glow-pulse">
                  Resgatar
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
