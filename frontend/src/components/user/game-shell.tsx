import { useEffect, useRef, useState, type ReactNode } from 'react';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import VolumeUpRoundedIcon from '@mui/icons-material/VolumeUpRounded';
import { SoundSettingsModal } from '@/components/sound/sound-settings-modal';
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import { BoostChips, CoinChip, LevelBadge, ProgressBar, levelProgress } from '@/components/game/game-ui';
import { InstallAppButton } from '@/components/pwa/install-app-button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Tooltip } from '@/components/ui/tooltip';
import { useCampaign } from '@/components/user/campaign/campaign-provider';
import type { UserProfile } from '@/types/auth';
import { PlayerAvatar } from '@/components/game/player-look';
import type { PlayerLook } from '@/lib/rewards-api';

export type SectionId = 'home' | 'stickers' | 'quiz' | 'shop' | 'ranking' | 'friends' | 'settings';

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

/** Bolinha com o número de avisos (pedidos, propostas e mensagens não lidas). */
function NoticeDot({ value, className }: { value: number; className?: string }) {
  if (!value) return null;
  return (
    <span className={cn('flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold leading-none text-white', className)} aria-label={`${value} aviso(s)`}>
      {value > 9 ? '9+' : value}
    </span>
  );
}

/** Barra do jogador: nível, XP, moedas e bônus sempre à vista. */
export function PlayerHud({
  profile,
  section,
  onNavigate,
  socialNotices = 0,
  look = null,
  onSignOut,
}: {
  onSignOut?: () => void;
  look?: PlayerLook | null;
  profile: UserProfile | null;
  section: SectionId;
  onNavigate: (id: SectionId) => void;
  socialNotices?: number;
}) {
  const xp = profile?.xp ?? 0;
  const progress = levelProgress(xp);
  const campaign = useCampaign();

  return (
    <header className="sticky top-0 z-40 border-b border-edge bg-bg/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <img src="/icons/icon-192.png" alt="Coleção Bíblica" width={40} height={40} className="hidden h-10 w-10 rounded-xl sm:block" />

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Tooltip content="Abrir a campanha" side="bottom">
            <button type="button" onClick={campaign.open} aria-label="Abrir a campanha" className="relative rounded-2xl transition hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/50">
              <LevelBadge level={profile?.level ?? 1} />
              <NoticeDot value={campaign.claimable} className="absolute -right-1 -top-1" />
            </button>
          </Tooltip>
          <div className="min-w-0 flex-1 sm:max-w-xs">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-display text-base font-semibold text-ink" style={look?.nameColor ? { color: look.nameColor } : undefined}>
                {profile?.name ?? 'Jogador'}
              </span>
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
            onClick={() => onNavigate('friends')}
            aria-label="Amigos"
            aria-current={section === 'friends' ? 'page' : undefined}
            className={cn(
              'relative flex h-10 w-10 items-center justify-center rounded-2xl transition sm:hidden',
              section === 'friends' ? 'bg-primary text-on-primary' : 'bg-surface-3 text-muted hover:text-ink',
            )}
          >
            <GroupsRoundedIcon fontSize="small" />
            <NoticeDot value={socialNotices} className="absolute -right-1 -top-1" />
          </button>
          <UserMenu look={look} name={profile?.name} active={section === 'settings'} onProfile={() => onNavigate('settings')} onSignOut={onSignOut} />
        </div>
      </div>

      <nav className="mx-auto hidden max-w-6xl gap-1 px-4 pb-3 sm:flex sm:px-6" aria-label="Seções">
        {[...NAV_ITEMS, { id: 'friends' as const, label: 'Amigos', icon: <GroupsRoundedIcon /> }].map((item) => {
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
              {item.id === 'friends' ? <NoticeDot value={socialNotices} /> : null}
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

/** Avatar do jogador com o menu de perfil, tema e sair (sempre à mão, inclusive no celular). */
function UserMenu({ look, name, active, onProfile, onSignOut }: { look: PlayerLook | null; name?: string; active: boolean; onProfile: () => void; onSignOut?: () => void }) {
  const [open, setOpen] = useState(false);
  const [soundOpen, setSoundOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const item = 'flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left font-display text-sm font-semibold text-ink transition hover:bg-surface-3';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="Menu da conta"
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn('flex items-center justify-center rounded-full transition', (open || active) && 'ring-4 ring-primary/50')}
      >
        <PlayerAvatar look={look} name={name} size="md" />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 w-56 animate-fade-up rounded-2xl border border-edge bg-surface p-1.5 shadow-xl">
          <p className="truncate px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted">{name ?? 'Jogador'}</p>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              onProfile();
            }}
          >
            <PersonRoundedIcon fontSize="small" className="text-primary" />
            Meu perfil
          </button>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              setOpen(false);
              setSoundOpen(true);
            }}
          >
            <VolumeUpRoundedIcon fontSize="small" className="text-primary" />
            Sons e música
          </button>
          <ThemeToggle menuItem />
          {onSignOut ? (
            <button
              type="button"
              role="menuitem"
              className={cn(item, 'text-danger')}
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
            >
              <LogoutRoundedIcon fontSize="small" />
              Sair
            </button>
          ) : null}
        </div>
      ) : null}
      <SoundSettingsModal open={soundOpen} onClose={() => setSoundOpen(false)} />
    </div>
  );
}
