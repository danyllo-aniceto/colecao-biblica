import { useEffect, useState } from 'react';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import { Pagination } from '@/components/ui/pagination';
import { Segmented } from '@/components/ui/segmented';
import { LeaguePanel } from '@/components/user/league-panel';
import { LoadingState, Spinner } from '@/components/ui/spinner';
import { Alert, EmptyState, LevelBadge, SectionHeading } from '@/components/game/game-ui';
import { cn } from '@/lib/cn';
import { listRanking, type RankingPage } from '@/lib/user-api';

const PODIUM = [
  { place: 2, height: 'h-24', color: 'bg-[#c7cedd] text-[#2b3040]', ring: 'ring-[#c7cedd]' },
  { place: 1, height: 'h-32', color: 'bg-primary text-on-primary', ring: 'ring-primary' },
  { place: 3, height: 'h-20', color: 'bg-[#e39a5c] text-[#3a1f08]', ring: 'ring-[#e39a5c]' },
];

const PAGE_SIZE = 20;

/** Ranking: liga da semana (zera toda segunda) e ranking geral de todos os tempos. */
export function RankingSection({ currentUserId, onWallet }: { currentUserId?: number; onWallet: (wallet: { userCoins: number }) => void }) {
  const [tab, setTab] = useState<'league' | 'general'>('league');
  return (
    <div className="space-y-5">
      <SectionHeading title="Ranking" subtitle={tab === 'league' ? 'Liga da semana: todo mundo começa do zero na segunda.' : 'Pontos de todos os tempos (desempate por XP).'} />
      <Segmented
        aria-label="Tipo de ranking"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'league', label: 'Liga da semana' },
          { value: 'general', label: 'Geral' },
        ]}
      />
      {tab === 'league' ? <LeaguePanel currentUserId={currentUserId} onClaimed={onWallet} /> : <GeneralRanking currentUserId={currentUserId} />}
    </div>
  );
}

function GeneralRanking({ currentUserId }: { currentUserId?: number }) {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<RankingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    listRanking(page, PAGE_SIZE)
      .then((response) => {
        if (!ignore) {
          setData(response);
          setError(null);
        }
      })
      .catch((reason: unknown) => !ignore && setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o ranking.'))
      .finally(() => !ignore && setLoading(false));
    return () => {
      ignore = true;
    };
  }, [page]);

  if (!data) {
    return (
      <div className="space-y-5">{error ? <Alert tone="danger">{error}</Alert> : <LoadingState label="Carregando ranking..." />}</div>
    );
  }

  if (data.totalElements === 0) {
    return (
      <div className="space-y-5">
        <EmptyState icon={<EmojiEventsRoundedIcon fontSize="large" />} title="Ninguém pontuou ainda">
          Jogue uma partida e seja o primeiro.
        </EmptyState>
      </div>
    );
  }

  const entries = data.content;
  const list = page === 0 ? entries.filter((entry) => entry.position > 3) : entries;

  return (
    <div className="space-y-5">
      {loading ? (
        <div className="flex justify-end">
          <Spinner />
        </div>
      ) : null}

      {page === 0 ? (
        <section className="panel overflow-hidden px-4 pt-8">
          <div className="mx-auto grid max-w-lg grid-cols-3 items-end gap-3">
            {PODIUM.map((slot) => {
              const entry = entries.find((item) => item.position === slot.place);
              if (!entry) {
                return <div key={slot.place} />;
              }
              const isMe = entry.userId === currentUserId;
              return (
                <div key={slot.place} className="animate-pop-in flex flex-col items-center gap-2 text-center" style={{ animationDelay: `${(3 - slot.place) * 120}ms` }}>
                  {slot.place === 1 ? <WorkspacePremiumRoundedIcon className="animate-float text-primary" sx={{ fontSize: 36 }} /> : null}
                  <span className={cn('flex h-14 w-14 items-center justify-center rounded-full bg-surface-3 font-display text-lg font-bold text-ink ring-4', slot.ring)}>
                    {entry.userName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className={cn('max-w-full truncate font-display text-sm font-semibold', isMe ? 'text-accent-strong dark:text-accent' : 'text-ink')}>{isMe ? 'Você' : entry.userName}</span>
                  <span className="text-xs font-bold text-muted">{entry.totalScore.toLocaleString('pt-BR')} pts</span>
                  <div className={cn('flex w-full items-start justify-center rounded-t-2xl pt-2 font-display text-3xl font-bold', slot.height, slot.color)}>{slot.place}</div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="panel flex items-center gap-3 border-2 border-accent p-4">
        <span className="font-display text-2xl font-bold text-accent-strong dark:text-accent">#{data.me.position}</span>
        <span className="flex-1 font-display font-semibold text-ink">Sua posição</span>
        <span className="font-bold text-ink">{data.me.totalScore.toLocaleString('pt-BR')} pts</span>
      </div>

      {list.length > 0 ? (
        <ol className="panel divide-y divide-edge overflow-hidden">
          {list.map((entry) => {
            const isMe = entry.userId === currentUserId;
            return (
              <li key={entry.userId} className={cn('flex items-center gap-3 px-4 py-3', isMe && 'bg-accent/10')}>
                <span className="w-10 text-center font-display text-lg font-bold text-muted">{entry.position}</span>
                <LevelBadge level={entry.level} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate font-display font-semibold', isMe ? 'text-accent-strong dark:text-accent' : 'text-ink')}>{isMe ? `${entry.userName} (você)` : entry.userName}</p>
                  <p className="text-xs font-semibold text-muted">{entry.xp.toLocaleString('pt-BR')} XP</p>
                </div>
                <span className="font-display font-bold text-ink">{entry.totalScore.toLocaleString('pt-BR')}</span>
              </li>
            );
          })}
        </ol>
      ) : null}

      <Pagination page={page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} itemLabel="jogadores" />
    </div>
  );
}
