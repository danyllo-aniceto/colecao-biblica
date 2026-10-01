import { QUIZ_TYPE_LABELS } from '@/lib/labels';
import { useEffect, useState } from 'react';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState, SectionHeading } from '@/components/game/game-ui';
import type { PaginatedResponse } from '@/lib/admin-api';
import { getQuizMatches, type MatchEntry } from '@/lib/user-api';

/** Todas as partidas terminadas, página por página. */
export function MatchHistoryPanel() {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<PaginatedResponse<MatchEntry> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getQuizMatches(page, 8)
      .then(setData)
      .catch(() => setData({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 8 }))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <section className="panel space-y-4 p-5 sm:p-6">
      <SectionHeading title="Histórico de partidas" action={loading && data ? <Spinner /> : undefined} />
      {!data ? (
        <div className="flex justify-center py-6">
          <Spinner size="lg" />
        </div>
      ) : data.totalElements === 0 ? (
        <EmptyState icon={<HistoryRoundedIcon fontSize="large" />} title="Nenhuma partida ainda" />
      ) : (
        <>
          <ul className="space-y-2">
            {data.content.map((match) => (
              <li key={match.matchId} className="flex flex-wrap items-center gap-3 rounded-2xl bg-surface-2 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold text-ink">{QUIZ_TYPE_LABELS[match.quizType] ?? 'Partida'}</p>
                  <p className="text-xs font-semibold text-muted">
                    {match.finishedAt ? new Date(match.finishedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''} · {match.correctAnswers}/{match.questionsAnswered} acertos
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone="violet">+{match.xpGained} XP</Badge>
                  {match.coinsGained ? <Badge tone="primary">+{match.coinsGained} moedas</Badge> : null}
                  {match.rewardGranted ? <Badge tone="success">{match.rewardGrantedName ?? 'Prêmio'}</Badge> : null}
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} itemLabel="partidas" />
        </>
      )}
    </section>
  );
}
