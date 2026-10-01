import type { ReactNode } from 'react';
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import { BoostChips, CoinChip, LevelBadge, ProgressBar, levelProgress } from '@/components/game/game-ui';
import { InstallAppButton } from '@/components/pwa/install-app-button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import type { UserProfile } from '@/types/auth';

export type SectionId = 'home' | 'stickers' | 'quiz' | 'shop' | 'ranking' | 'settings';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

const NAV_ITEMS: Array<{ id: SectionId; label: string; icon: ReactNode }> = [
  { id: 'home', label: 'Início', icon: <HomeRoundedIcon /> },
  { id: 'stickers', label: 'Álbum', icon: <CollectionsBookmarkRoundedIcon /> },
  { id: 'quiz', label: 'Jogar', icon: <PlayArrowRoundedIcon /> },
  { id: 'shop', label: 'Loja', icon: <StorefrontRoundedIcon /> },
  { id: 'ranking', label: 'Ranking', icon: <EmojiEventsRoundedIcon /> },
];

function initials(name?: string) {
  if (!name) {
    return '?';
  }
  const parts = name.trim().split(/\s+/);
  return (parts[0][0] + (parts.length > 1 ? parts.at(-1)![0] : '')).toUpperCase();
}

/** Barra do jogador: nível, XP, moedas e bônus sempre à vista. */
export function PlayerHud({
  profile,
  section,
  onNavigate,
}: {
  profile: UserProfile | null;
  section: SectionId;
  onNavigate: (id: SectionId) => void;
}) {
  const xp = profile?.xp ?? 0;
  const progress = levelProgress(xp);

  return (
    <header className="sticky top-0 z-40 border-b border-edge bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <img src="/icons/icon-192.png" alt="Coleção Bíblica" width={40} height={40} className="hidden h-10 w-10 rounded-xl sm:block" />

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <LevelBadge level={profile?.level ?? 1} />
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-display text-base font-semibold text-ink">{profile?.name ?? 'Jogador'}</span>
              <span className="shrink-0 text-xs font-bold text-muted">
                {progress.current}/{progress.needed} XP
              </span>
            </div>
            <ProgressBar value={progress.percent} className="mt-1 h-2.5" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <CoinChip value={profile?.coins ?? 0} />
          <div className="hidden items-center gap-2 lg:flex">
            <BoostChips life={profile?.extraLifeBoosts ?? 0} time={profile?.extraTimeBoosts ?? 0} xp={profile?.doubleXpBoosts ?? 0} hint={profile?.hintBoosts ?? 0} />
          </div>
          <div className="hidden sm:block">
            <ThemeToggle compact />
          </div>
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            aria-label="Meu perfil"
            aria-current={section === 'settings' ? 'page' : undefined}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-2xl font-display text-sm font-bold transition',
              section === 'settings' ? 'bg-primary text-on-primary' : 'bg-accent/20 text-accent-strong hover:bg-accent/30 dark:text-accent',
            )}
          >
            {initials(profile?.name)}
          </button>
        </div>
      </div>

      <nav className="mx-auto hidden max-w-6xl gap-1 px-4 pb-3 sm:flex sm:px-6" aria-label="Seções">
        {NAV_ITEMS.map((item) => {
          const active = section === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex h-10 items-center gap-2 rounded-2xl px-4 font-display text-sm font-semibold transition',
                active ? 'bg-primary text-on-primary shadow-[0_3px_0_var(--primary-strong)]' : 'text-muted hover:bg-surface-3 hover:text-ink',
              )}
            >
              {item.icon}
              {item.label}
            </button>
          );
        })}
        <div className="ml-auto">
          <InstallAppButton />
        </div>
      </nav>
    </header>
  );
}

/** Navegação inferior do celular, com "Jogar" em destaque no centro. */
export function BottomNav({ section, onNavigate }: { section: SectionId; onNavigate: (id: SectionId) => void }) {
  return (
    <nav
      aria-label="Seções"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl sm:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5 items-end px-2">
        {NAV_ITEMS.map((item) => {
          const active = section === item.id;
          const isPlay = item.id === 'quiz';
          return (
            <li key={item.id} className="flex justify-center">
              <button
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={active ? 'page' : undefined}
                className="flex w-full flex-col items-center gap-0.5 pb-2 pt-2 font-display text-[11px] font-semibold"
              >
                {isPlay ? (
                  <span
                    className={cn(
                      '-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-on-primary shadow-[0_4px_0_var(--primary-strong)]',
                      !active && 'animate-glow-pulse',
                    )}
                  >
                    <PlayArrowRoundedIcon sx={{ fontSize: 34 }} />
                  </span>
                ) : (
                  <span className={cn('flex h-8 w-12 items-center justify-center rounded-full transition', active ? 'bg-primary/20 text-primary-strong dark:text-primary' : 'text-muted')}>
                    {item.icon}
                  </span>
                )}
                <span className={active ? 'text-ink' : 'text-muted'}>{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
