import { useEffect, useState } from 'react';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { LoadingState, Spinner } from '@/components/ui/spinner';
import { errorMessage, useToast } from '@/components/ui/toast';
import { Alert, CoinIcon, EmptyState, LevelBadge } from '@/components/game/game-ui';
import { cn } from '@/lib/cn';
import { claimLeague, getLeague, type LeaguePage } from '@/lib/user-api';

const MEDALS = ['bg-primary text-on-primary', 'bg-[#c7cedd] text-[#2b3040]', 'bg-[#e39a5c] text-[#3a1f08]'];

function timeLeft(endsAt: string) {
  const hours = Math.max(0, Math.round((new Date(endsAt).getTime() - Date.now()) / 3_600_000));
  return hours >= 48 ? `${Math.round(hours / 24)} dias` : `${hours} h`;
}

/** Liga semanal: pontos da semana, zera toda segunda; top 3 ganha moedas. */
export function LeaguePanel({ currentUserId, onClaimed }: { currentUserId?: number; onClaimed: (wallet: { userCoins: number }) => void }) {
  const toast = useToast();
  const [page, setPage] = useState(0);
  const [data, setData] = useState<LeaguePage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

  function load(target = page) {
    setLoading(true);
    getLeague(target, 20)
      .then((response) => {
        setData(response);
        setError(null);
      })
      .catch((reason: unknown) => setError(errorMessage(reason)))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => load(page), [page]);

  async function claim() {
    setClaiming(true);
    try {
      const result = await claimLeague();
      onClaimed(result);
      toast.success(`Prêmio da liga: ${result.position}º lugar!`, { description: `+${result.coins} moedas`, icon: <CoinIcon /> });
      load();
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setClaiming(false);
    }
  }

  if (!data) return error ? <Alert tone="danger">{error}</Alert> : <LoadingState label="Carregando a liga..." />;

  const lastWeek = data.lastWeek;

  return (
    <div className="space-y-4">
      <section className="panel space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-muted">
            <TimerRoundedIcon fontSize="small" /> A semana termina em {timeLeft(data.endsAt)}
          </p>
          {loading ? <Spinner size="sm" /> : null}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {data.prizes.map((prize, index) => (
            <div key={index} className={cn('rounded-2xl p-3 text-center', MEDALS[index])}>
              <span className="block font-display text-lg font-bold">{index + 1}º</span>
              <span className="inline-flex items-center gap-1 text-sm font-bold">
                <CoinIcon className="h-4 w-4" /> {prize}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted">Vale a soma dos pontos das partidas da semana (segunda a domingo). O prêmio é resgatado na semana seguinte.</p>
      </section>

      {lastWeek.prize > 0 && !lastWeek.claimed ? (
        <div className="panel flex flex-wrap items-center gap-3 border-2 border-primary p-4">
          <EmojiEventsRoundedIcon className="text-primary-strong dark:text-primary" />
          <p className="flex-1 font-display font-semibold text-ink">Você ficou em {lastWeek.position}º na semana passada!</p>
          <Button onClick={() => void claim()} loading={claiming} className="animate-glow-pulse">
            Resgatar {lastWeek.prize} moedas
          </Button>
        </div>
      ) : null}

      <div className="panel flex items-center gap-3 border-2 border-accent p-4">
        <span className="font-display text-2xl font-bold text-accent-strong dark:text-accent">{data.me ? `#${data.me.position}` : '–'}</span>
        <span className="flex-1 font-display font-semibold text-ink">{data.me ? 'Sua posição na semana' : 'Jogue uma partida para entrar na liga'}</span>
        {data.me ? <span className="font-bold text-ink">{data.me.score.toLocaleString('pt-BR')} pts</span> : null}
      </div>

      {data.totalElements === 0 ? (
        <EmptyState icon={<EmojiEventsRoundedIcon fontSize="large" />} title="A liga desta semana ainda não começou">
          Seja o primeiro a pontuar!
        </EmptyState>
      ) : (
        <>
          <ol className="panel divide-y divide-edge overflow-hidden">
            {data.content.map((entry) => {
              const isMe = entry.userId === currentUserId;
              return (
                <li key={entry.userId} className={cn('flex items-center gap-3 px-4 py-3', isMe && 'bg-accent/10')}>
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-display font-bold', entry.position <= 3 ? MEDALS[entry.position - 1] : 'text-muted')}>{entry.position}</span>
                  <LevelBadge level={entry.level} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate font-display font-semibold', isMe ? 'text-accent-strong dark:text-accent' : 'text-ink')}>{isMe ? `${entry.userName} (você)` : entry.userName}</p>
                    <p className="text-xs font-semibold text-muted">{entry.matches} partida(s)</p>
                  </div>
                  <span className="font-display font-bold text-ink">{entry.score.toLocaleString('pt-BR')}</span>
                </li>
              );
            })}
          </ol>
          <Pagination page={page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} itemLabel="jogadores" />
        </>
      )}
    </div>
  );
}
