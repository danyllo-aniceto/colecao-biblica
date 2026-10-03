import { useState, type FormEvent } from 'react';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import ViewCarouselRoundedIcon from '@mui/icons-material/ViewCarouselRounded';
import { Segmented } from '@/components/ui/segmented';
import { PlayerAvatar, PlayerName } from '@/components/game/player-look';
import { PlayerProfileModal } from '@/components/user/rewards/player-profile-modal';
import { ShowcasePicker } from '@/components/user/rewards/showcase-picker';
import { VisualLocker } from '@/components/user/rewards/visual-locker';
import { QUIZ_HELPERS } from '@/lib/quiz-helpers';
import { rewardVisual } from '@/lib/reward-visual';
import { surfaceStyle } from '@/lib/look-background';
import type { PlayerLook } from '@/lib/rewards-api';
import type { UserSticker } from '@/lib/user-api';
import { cn } from '@/lib/cn';
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { InstallAppButton } from '@/components/pwa/install-app-button';
import { APP_VERSION } from '@/lib/pwa';
import { BoostChips, CoinChip, LevelBadge, ProgressBar, SectionHeading, StatTile, levelProgress } from '@/components/game/game-ui';
import { AchievementsPanel } from '@/components/user/achievements-panel';
import { MatchHistoryPanel } from '@/components/user/match-history-panel';
import type { UserProfile } from '@/types/auth';

export type AccountFormState = { name: string; email: string; password: string };

type ProfileSectionProps = {
  profile: UserProfile | null;
  ownedCount: number;
  totalCount: number;
  form: AccountFormState;
  onChangeForm: (updater: (current: AccountFormState) => AccountFormState) => void;
  submitting: boolean;
  deleting: boolean;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onAskDelete: () => void;
  onSignOut: () => void;
  look: PlayerLook | null;
  onLookChange: (look: PlayerLook) => void;
  collection: UserSticker[];
  onShowcaseChange: (showcase: number[]) => void;
};

type Tab = 'summary' | 'visual' | 'account';

export function ProfileSection({
  profile,
  ownedCount,
  totalCount,
  form,
  onChangeForm,
  submitting,
  deleting,
  onSave,
  onAskDelete,
  onSignOut,
  look,
  onLookChange,
  collection,
  onShowcaseChange,
}: ProfileSectionProps) {
  const progress = levelProgress(profile?.xp ?? 0);
  const [tab, setTab] = useState<Tab>('summary');
  const [previewing, setPreviewing] = useState(false);
  const [pickingShowcase, setPickingShowcase] = useState(false);

  return (
    <div className="space-y-5">
      <section className="panel relative overflow-hidden p-6" style={surfaceStyle(look?.profileBg)}>
        {look?.profileBg ? <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-surface/90 via-surface/65 to-surface/20" /> : null}
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-violet/25 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-5">
          <span className="relative">
            <PlayerAvatar look={look} name={profile?.name} size="xl" />
            <span className="absolute -bottom-1 -right-1">
              <LevelBadge level={profile?.level ?? 1} size="sm" />
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="sr-only">{profile?.name ?? 'Jogador'}</h1>
            <PlayerName name={profile?.name ?? 'Jogador'} look={look} nameClassName="text-3xl" className="[&_.player-title]:text-sm" />
            <p className="truncate text-sm font-semibold text-muted">{profile?.email}</p>
            <div className="mt-3 max-w-sm">
              <div className="mb-1 flex justify-between text-xs font-bold text-muted">
                <span>Nível {profile?.level ?? 1}</span>
                <span>
                  {progress.current}/{progress.needed} XP
                </span>
              </div>
              <ProgressBar value={progress.percent} />
            </div>
          </div>
        </div>
        <div className="relative mt-5 flex flex-wrap gap-2">
          <CoinChip value={profile?.coins ?? 0} />
          <BoostChips life={profile?.extraLifeBoosts ?? 0} time={profile?.extraTimeBoosts ?? 0} xp={profile?.doubleXpBoosts ?? 0} hint={profile?.hintBoosts ?? 0} freeze={profile?.streakFreezes ?? 0} />
        </div>
        <div className="relative mt-4 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setPreviewing(true)} disabled={!profile}>
            <VisibilityRoundedIcon fontSize="small" /> Como os outros me veem
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setPickingShowcase(true)}>
            <ViewCarouselRoundedIcon fontSize="small" /> Vitrine
          </Button>
        </div>
      </section>

      <Segmented
        aria-label="Parte do perfil"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'summary', label: 'Resumo' },
          { value: 'visual', label: 'Visual' },
          { value: 'account', label: 'Conta' },
        ]}
      />

      {tab === 'visual' ? <VisualLocker playerName={profile?.name ?? 'Você'} onLookChange={onLookChange} /> : null}

      {tab === 'summary' ? (
      <>
      <div className="grid grid-cols-2 gap-3">
        <StatTile icon={<CollectionsBookmarkRoundedIcon />} label="Figurinhas" value={`${ownedCount}/${totalCount}`} tone="accent" />
        <StatTile icon={<EmojiEventsRoundedIcon />} label="Pontos" value={(profile?.totalScore ?? 0).toLocaleString('pt-BR')} />
      </div>

      <section className="panel space-y-3 p-5 sm:p-6">
        <SectionHeading title="Minhas ajudas" subtitle="Use uma de cada por partida. Compre mais na loja ou ganhe no baú e no passe." />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {QUIZ_HELPERS.map((helper) => {
            const { icon, tint } = rewardVisual(helper.rewardType, 22);
            const count = profile?.[helper.field] ?? 0;
            return (
              <div key={helper.field} className={cn('flex items-center gap-2 rounded-2xl bg-surface-2 p-2.5', count === 0 && 'opacity-60')}>
                <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', tint)}>{icon}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{helper.name}</span>
                <span className="font-display font-bold text-ink">{count}</span>
              </div>
            );
          })}
        </div>
      </section>

      <AchievementsPanel />

      <MatchHistoryPanel />
      </>
      ) : null}

      {tab === 'account' ? (
      <>
      <section className="panel space-y-4 p-5 sm:p-6">
        <SectionHeading title="Aparência e app" />
        <div className="flex flex-wrap gap-3">
          <ThemeToggle />
          <InstallAppButton />
          <Button variant="secondary" onClick={onSignOut}>
            <LogoutRoundedIcon fontSize="small" />
            Sair
          </Button>
        </div>
      </section>

      <form className="panel space-y-4 p-5 sm:p-6" onSubmit={onSave}>
        <SectionHeading title="Minha conta" />
        <label className="block space-y-2">
          <span className="text-sm font-bold text-muted">Nome</span>
          <Input value={form.name} onChange={(event) => onChangeForm((current) => ({ ...current, name: event.target.value }))} required />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-bold text-muted">E-mail</span>
          <Input type="email" value={form.email} onChange={(event) => onChangeForm((current) => ({ ...current, email: event.target.value }))} required />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-bold text-muted">Nova senha</span>
          <Input
            type="password"
            value={form.password}
            onChange={(event) => onChangeForm((current) => ({ ...current, password: event.target.value }))}
            placeholder="Deixe em branco para manter a atual"
            autoComplete="new-password"
          />
        </label>
        <Button type="submit" loading={submitting}>
          {submitting ? 'Salvando...' : 'Salvar alterações'}
        </Button>
      </form>

      <section className="panel space-y-3 border-danger/40 p-5 sm:p-6">
        <h2 className="font-display text-xl font-bold text-danger">Zona de perigo</h2>
        <p className="text-sm text-muted">Excluir a conta remove seu acesso, sua coleção e seu lugar no ranking.</p>
        <Button variant="danger" onClick={onAskDelete} loading={deleting}>
          Excluir minha conta
        </Button>
      </section>
      </>
      ) : null}

      <PlayerProfileModal userId={previewing && profile ? profile.id : null} onClose={() => setPreviewing(false)} />
      {pickingShowcase ? (
        <ShowcasePicker
          collection={collection}
          initial={profile?.showcase ?? []}
          onClose={() => setPickingShowcase(false)}
          onSaved={(saved) => {
            onShowcaseChange(saved.showcase.map((character) => character.id));
            setPickingShowcase(false);
          }}
        />
      ) : null}

      <p className="text-center text-xs text-muted">Versão do app: {APP_VERSION}</p>
    </div>
  );
}
