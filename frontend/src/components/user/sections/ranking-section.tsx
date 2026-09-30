'use client';

import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import { EmptyState, LevelBadge, SectionHeading } from '@/components/game/game-ui';
import type { RankingEntry } from '@/lib/user-api';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const PODIUM = [
  { place: 2, height: 'h-24', color: 'bg-[#c7cedd] text-[#2b3040]', ring: 'ring-[#c7cedd]' },
  { place: 1, height: 'h-32', color: 'bg-primary text-on-primary', ring: 'ring-primary' },
  { place: 3, height: 'h-20', color: 'bg-[#e39a5c] text-[#3a1f08]', ring: 'ring-[#e39a5c]' },
];

export function RankingSection({ ranking, currentUserId }: { ranking: RankingEntry[]; currentUserId?: number }) {
  if (ranking.length === 0) {
    return (
      <div className="space-y-5">
        <SectionHeading title="Ranking" />
        <EmptyState icon={<EmojiEventsRoundedIcon fontSize="large" />} title="Ninguém pontuou ainda">
          Jogue uma partida e seja o primeiro.
        </EmptyState>
      </div>
    );
  }

  const me = ranking.find((entry) => entry.userId === currentUserId);
  const rest = ranking.slice(3);

  return (
    <div className="space-y-5">
      <SectionHeading title="Ranking" subtitle="Os 50 melhores por pontos (desempate por XP)." />

      <section className="panel overflow-hidden px-4 pt-8">
        <div className="mx-auto grid max-w-lg grid-cols-3 items-end gap-3">
          {PODIUM.map((slot) => {
            const entry = ranking.find((item) => item.position === slot.place);
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
                <span className={cn('max-w-full truncate font-display text-sm font-semibold', isMe ? 'text-accent-strong dark:text-accent' : 'text-ink')}>
                  {isMe ? 'Você' : entry.userName}
                </span>
                <span className="text-xs font-bold text-muted">{entry.totalScore.toLocaleString('pt-BR')} pts</span>
                <div className={cn('flex w-full items-start justify-center rounded-t-2xl pt-2 font-display text-3xl font-bold', slot.height, slot.color)}>{slot.place}</div>
              </div>
            );
          })}
        </div>
      </section>

      {me && me.position > 3 ? (
        <div className="panel flex items-center gap-3 border-2 border-accent p-4">
          <span className="font-display text-2xl font-bold text-accent-strong dark:text-accent">#{me.position}</span>
          <span className="flex-1 font-display font-semibold text-ink">Sua posição</span>
          <span className="font-bold text-ink">{me.totalScore.toLocaleString('pt-BR')} pts</span>
        </div>
      ) : null}

      {rest.length > 0 ? (
        <ol className="panel divide-y divide-edge overflow-hidden">
          {rest.map((entry) => {
            const isMe = entry.userId === currentUserId;
            return (
              <li key={entry.userId} className={cn('flex items-center gap-3 px-4 py-3', isMe && 'bg-accent/10')}>
                <span className="w-8 text-center font-display text-lg font-bold text-muted">{entry.position}</span>
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
    </div>
  );
}
