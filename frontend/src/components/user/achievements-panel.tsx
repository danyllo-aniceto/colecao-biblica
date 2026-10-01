import { useEffect, useState, type ReactNode } from 'react';
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import LocalFireDepartmentRoundedIcon from '@mui/icons-material/LocalFireDepartmentRounded';
import PersonSearchRoundedIcon from '@mui/icons-material/PersonSearchRounded';
import RepeatRoundedIcon from '@mui/icons-material/RepeatRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Spinner } from '@/components/ui/spinner';
import { CoinIcon, ProgressBar, SectionHeading } from '@/components/game/game-ui';
import { cn } from '@/lib/cn';
import { listAchievements, type Achievement } from '@/lib/user-api';

const ICONS: Record<string, ReactNode> = {
  flag: <FlagRoundedIcon />,
  repeat: <RepeatRoundedIcon />,
  fire: <LocalFireDepartmentRoundedIcon />,
  star: <StarRoundedIcon />,
  person: <PersonSearchRoundedIcon />,
  level: <TrendingUpRoundedIcon />,
  album: <CollectionsBookmarkRoundedIcon />,
  crown: <WorkspacePremiumRoundedIcon />,
  trophy: <EmojiEventsRoundedIcon />,
  calendar: <CalendarMonthRoundedIcon />,
  note: <EditNoteRoundedIcon />,
};

/** Metas permanentes: cada uma paga moedas uma vez. */
export function AchievementsPanel() {
  const [items, setItems] = useState<Achievement[] | null>(null);
  // Desbloqueadas primeiro; depois as mais perto de completar.
  const sorted = (items ?? []).slice().sort((left, right) => Number(right.unlocked) - Number(left.unlocked) || right.current / (right.target || 1) - left.current / (left.target || 1));
  const paging = usePagination(sorted, 6);

  useEffect(() => {
    listAchievements()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  const unlocked = items?.filter((item) => item.unlocked).length ?? 0;

  return (
    <section className="panel space-y-4 p-5 sm:p-6">
      <SectionHeading title="Conquistas" subtitle={items ? `${unlocked} de ${items.length} desbloqueadas` : undefined} />
      {items === null ? (
        <div className="flex justify-center py-6">
          <Spinner size="lg" />
        </div>
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2">
            {paging.pageItems.map((item) => (
              <li key={item.code} className={cn('flex gap-3 rounded-2xl border-2 p-3', item.unlocked ? 'border-primary/50 bg-primary/10' : 'border-edge bg-surface-2')}>
                <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', item.unlocked ? 'bg-primary text-on-primary' : 'bg-surface-3 text-muted')}>
                  {ICONS[item.icon] ?? <EmojiEventsRoundedIcon />}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-display font-bold text-ink">{item.title}</p>
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-muted">
                      <CoinIcon className="h-4 w-4" />
                      {item.coins}
                    </span>
                  </div>
                  <p className="text-xs text-muted">{item.description}</p>
                  {item.unlocked ? (
                    <p className="text-xs font-bold text-success-strong dark:text-success">
                      Conquistada{item.unlockedAt ? ` em ${new Date(item.unlockedAt).toLocaleDateString('pt-BR')}` : ''}
                    </p>
                  ) : item.target > 0 ? (
                    <div className="flex items-center gap-2">
                      <ProgressBar value={(item.current / item.target) * 100} className="h-2" />
                      <span className="shrink-0 text-xs font-bold text-muted">
                        {item.current}/{item.target}
                      </span>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={paging.page} totalPages={paging.totalPages} totalElements={paging.totalElements} onPageChange={paging.setPage} itemLabel="conquistas" />
        </>
      )}
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <AutoStoriesRoundedIcon sx={{ fontSize: 14 }} /> As moedas entram na hora em que a conquista é desbloqueada.
      </p>
    </section>
  );
}
