import { useEffect, useState } from 'react';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import { Pagination } from '@/components/ui/pagination';
import { LoadingState, Spinner } from '@/components/ui/spinner';
import { Alert, EmptyState, LevelBadge } from '@/components/game/game-ui';
import { PlayerChip } from '@/components/user/rewards/player-profile-modal';
import { cn } from '@/lib/cn';
import { getPeitoralGallery, type GalleryPage } from '@/lib/minigames-api';

const PAGE_SIZE = 10;

const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

/** Galeria dos Peitorais: quem reuniu as 12 pedras, do primeiro ao mais recente. */
export function PeitoralGallery({ currentUserId }: { currentUserId?: number }) {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<GalleryPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    getPeitoralGallery(page, PAGE_SIZE)
      .then((response) => {
        if (!ignore) {
          setData(response);
          setError(null);
        }
      })
      .catch((reason: unknown) => !ignore && setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a galeria.'))
      .finally(() => !ignore && setLoading(false));
    return () => {
      ignore = true;
    };
  }, [page]);

  if (!data) return error ? <Alert tone="danger">{error}</Alert> : <LoadingState label="Carregando galeria..." />;

  if (data.totalElements === 0) {
    return (
      <EmptyState icon={<ShieldRoundedIcon fontSize="large" />} title="Nenhum Peitoral completo ainda">
        Reúna as 12 pedras e seja o primeiro a entrar na galeria.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex justify-end">
          <Spinner />
        </div>
      ) : null}
      {data.me ? <p className="rounded-2xl bg-[#e0b43a]/15 p-3 text-sm font-bold text-ink">🛡️ Você completou o Peitoral em {dateLabel(data.me.completedAt)}.</p> : null}
      <ol className="panel divide-y divide-edge overflow-hidden">
        {data.content.map((entry) => {
          const isMe = entry.userId === currentUserId;
          return (
            <li key={entry.userId} className={cn('flex items-center gap-3 px-4 py-3', isMe && 'bg-accent/10')}>
              <span className="w-10 text-center font-display text-lg font-bold text-muted">{entry.position}</span>
              <PlayerChip userId={entry.userId} name={entry.userName} look={entry.look} suffix={isMe ? '(você)' : undefined} />
              <LevelBadge level={entry.level} size="sm" />
              <span className="hidden text-xs font-semibold text-muted sm:block">{dateLabel(entry.completedAt)}</span>
            </li>
          );
        })}
      </ol>
      <Pagination page={page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} itemLabel="peitorais" />
    </div>
  );
}
