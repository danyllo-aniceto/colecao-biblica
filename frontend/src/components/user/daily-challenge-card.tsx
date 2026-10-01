import { useEffect, useState } from 'react';
import CalendarTodayRoundedIcon from '@mui/icons-material/CalendarTodayRounded';
import LeaderboardRoundedIcon from '@mui/icons-material/LeaderboardRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/game/game-ui';
import { cn } from '@/lib/cn';
import { getDailyChallenge, type DailyChallenge } from '@/lib/user-api';
import { PlayerChip } from '@/components/user/rewards/player-profile-modal';

function formatSeconds(seconds: number | null) {
  if (seconds === null) return '';
  const minutes = Math.floor(seconds / 60);
  return minutes > 0 ? `${minutes} min ${seconds % 60} s` : `${seconds} s`;
}

/** Desafio do dia: mesmas perguntas para todos, uma tentativa por dia e ranking próprio. */
export function DailyChallengeCard({ onStart, starting, currentUserId }: { onStart: () => void; starting: boolean; currentUserId?: number }) {
  const [data, setData] = useState<DailyChallenge | null>(null);
  const [rankingOpen, setRankingOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getDailyChallenge(page, 10)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [page]);

  const available = data?.attemptStatus === null && (data?.totalQuestions ?? 0) > 0;

  return (
    <section className="panel relative overflow-hidden p-5 sm:p-6">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-accent/25 blur-3xl" />
      <div className="relative flex flex-wrap items-center gap-4">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-on-accent">
          <CalendarTodayRoundedIcon sx={{ fontSize: 30 }} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl font-bold text-ink">Desafio do dia</h3>
          <p className="text-sm text-muted">
            {data ? `${data.totalQuestions} perguntas iguais para todos · uma tentativa por dia` : 'As mesmas perguntas para todos os jogadores.'}
          </p>
          {data?.me ? (
            <p className="mt-1 text-sm font-bold text-ink">
              Seu resultado: {data.me.correctAnswers}/{data.me.questionsAnswered} · {formatSeconds(data.me.seconds)} · {data.me.position}º lugar
            </p>
          ) : data?.attemptStatus === 'ABANDONED' ? (
            <p className="mt-1 text-sm font-bold text-muted">Tentativa de hoje usada (partida abandonada).</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {loading && !data ? <Spinner /> : null}
          {available ? (
            <Button variant="accent" onClick={onStart} loading={starting}>
              {starting ? null : <PlayArrowRoundedIcon />}
              Jogar desafio
            </Button>
          ) : data && data.attemptStatus !== null ? (
            <span className="rounded-full bg-success/15 px-3 py-1.5 font-display text-sm font-bold text-success-strong dark:text-success">Volte amanhã!</span>
          ) : null}
          <Button variant="secondary" onClick={() => setRankingOpen(true)}>
            <LeaderboardRoundedIcon fontSize="small" />
            Ranking do dia
          </Button>
        </div>
      </div>

      <Modal open={rankingOpen} title="Ranking do desafio de hoje" description="Mais acertos primeiro; no empate, quem terminou mais rápido." onClose={() => setRankingOpen(false)}>
        {!data ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : data.totalElements === 0 ? (
          <EmptyState icon={<LeaderboardRoundedIcon fontSize="large" />} title="Ninguém terminou o desafio ainda">
            Seja o primeiro!
          </EmptyState>
        ) : (
          <div className="space-y-3">
            <ol className="divide-y divide-edge overflow-hidden rounded-2xl border border-edge">
              {data.content.map((entry) => (
                <li key={entry.userId} className={cn('flex items-center gap-3 px-4 py-3', entry.userId === currentUserId && 'bg-accent/10')}>
                  <span className="w-8 text-center font-display text-lg font-bold text-muted">{entry.position}</span>
                  <PlayerChip userId={entry.userId} name={entry.userName} look={entry.look} suffix={entry.userId === currentUserId ? '(você)' : undefined} size="xs" />
                  <span className="text-right text-sm">
                    <span className="block font-bold text-ink">
                      {entry.correctAnswers}/{entry.questionsAnswered}
                    </span>
                    <span className="block text-xs text-muted">{formatSeconds(entry.seconds)}</span>
                  </span>
                </li>
              ))}
            </ol>
            <Pagination page={page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} itemLabel="jogadores" />
          </div>
        )}
      </Modal>
    </section>
  );
}
