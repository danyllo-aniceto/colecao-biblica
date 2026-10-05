import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import LocalFireDepartmentRoundedIcon from '@mui/icons-material/LocalFireDepartmentRounded';
import SportsEsportsRoundedIcon from '@mui/icons-material/SportsEsportsRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import { Modal } from '@/components/ui/modal';
import { LoadingState } from '@/components/ui/spinner';
import { errorMessage } from '@/components/ui/toast';
import { Alert, LevelBadge, ProgressBar } from '@/components/game/game-ui';
import { PlayerAvatar, PlayerName } from '@/components/game/player-look';
import { StickerCard } from '@/components/game/sticker-card';
import { surfaceStyle } from '@/lib/look-background';
import { getPlayerProfile, type PlayerLook, type PlayerProfile } from '@/lib/rewards-api';

/** Cartão do jogador: o que os outros veem (ícone, título, álbum, vitrine e números). */
export function PlayerProfileCard({ profile }: { profile: PlayerProfile }) {
  const percent = profile.album.total ? Math.round((profile.album.owned / profile.album.total) * 100) : 0;
  const stats = [
    { icon: <SportsEsportsRoundedIcon fontSize="small" />, label: 'Partidas', value: profile.stats.matches },
    { icon: <EmojiEventsRoundedIcon fontSize="small" />, label: 'Conquistas', value: profile.stats.achievements },
    { icon: <LocalFireDepartmentRoundedIcon fontSize="small" />, label: 'Melhor sequência', value: profile.stats.bestCombo },
    { icon: <WorkspacePremiumRoundedIcon fontSize="small" />, label: 'Ligas vencidas', value: profile.stats.leagueWins },
  ];
  return (
    <div className="space-y-5">
      <div className="relative -mx-1 flex items-center gap-4 overflow-hidden rounded-3xl p-3" style={surfaceStyle(profile.look.profileBg)}>
        {profile.look.profileBg ? <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-surface/90 via-surface/65 to-surface/20" /> : null}
        <span className="relative">
          <PlayerAvatar look={profile.look} name={profile.name} size="xl" />
        </span>
        <div className="relative min-w-0 flex-1 space-y-1">
          <PlayerName name={profile.name} look={profile.look} nameClassName="text-2xl" className="[&_.player-title]:text-sm" />
          <div className="flex items-center gap-2 text-sm font-semibold text-muted">
            <LevelBadge level={profile.level} size="sm" /> Nível {profile.level}
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm font-bold text-muted">
          <span className="flex items-center gap-1.5">
            <CollectionsBookmarkRoundedIcon fontSize="small" /> Álbum
          </span>
          <span>
            {profile.album.owned}/{profile.album.total} · {percent}%
          </span>
        </div>
        <ProgressBar value={percent} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center gap-2 rounded-2xl bg-surface-2 p-3">
            <span className="text-muted">{stat.icon}</span>
            <div>
              <p className="font-display text-lg font-bold leading-none text-ink">{stat.value.toLocaleString('pt-BR')}</p>
              <p className="text-xs font-semibold text-muted">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>
      {profile.showcase.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Vitrine</p>
          <div className="grid grid-cols-3 gap-2">
            {profile.showcase.map((character) => (
              <StickerCard key={character.id} name={character.name} rarity={character.rarity} imageUrl={character.imageUrl} owned size="sm" />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PlayerProfileModal({ userId, onClose }: { userId: number | null; onClose: () => void }) {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (userId === null) return;
    setProfile(null);
    setError(null);
    getPlayerProfile(userId)
      .then(setProfile)
      .catch((reason: unknown) => setError(errorMessage(reason)));
  }, [userId]);

  return (
    <Modal open={userId !== null} size="sm" title="Perfil do jogador" onClose={onClose}>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {!profile && !error ? <LoadingState label="Abrindo o perfil..." /> : null}
      {profile ? <PlayerProfileCard profile={profile} /> : null}
    </Modal>
  );
}

const ProfileContext = createContext<(userId: number) => void>(() => undefined);

/** Deixa qualquer lista (ranking, liga, amigos, conversa) abrir o perfil de um jogador. */
export function PlayerProfileProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<number | null>(null);
  return (
    <ProfileContext.Provider value={setUserId}>
      {children}
      <PlayerProfileModal userId={userId} onClose={() => setUserId(null)} />
    </ProfileContext.Provider>
  );
}

export const useOpenProfile = () => useContext(ProfileContext);

/** Avatar + nome (com cor e título) que abre o perfil ao tocar. */
export function PlayerChip({ userId, name, look, suffix, size = 'sm' }: { userId: number; name: string; look?: PlayerLook | null; suffix?: string; size?: 'xs' | 'sm' | 'md' }) {
  const open = useOpenProfile();
  return (
    <button type="button" onClick={() => open(userId)} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl text-left transition hover:opacity-80" aria-label={`Ver perfil de ${name}`}>
      <PlayerAvatar look={look} name={name} size={size} />
      <PlayerName name={suffix ? `${name} ${suffix}` : name} look={look} />
    </button>
  );
}
