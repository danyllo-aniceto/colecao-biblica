import type { FormEvent } from 'react';
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
};

export function ProfileSection({ profile, ownedCount, totalCount, form, onChangeForm, submitting, deleting, onSave, onAskDelete, onSignOut }: ProfileSectionProps) {
  const progress = levelProgress(profile?.xp ?? 0);

  return (
    <div className="space-y-5">
      <section className="panel relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-violet/25 blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-5">
          <LevelBadge level={profile?.level ?? 1} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-3xl font-bold text-ink">{profile?.name ?? 'Jogador'}</h1>
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
          <BoostChips life={profile?.extraLifeBoosts ?? 0} time={profile?.extraTimeBoosts ?? 0} xp={profile?.doubleXpBoosts ?? 0} hint={profile?.hintBoosts ?? 0} />
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <StatTile icon={<CollectionsBookmarkRoundedIcon />} label="Figurinhas" value={`${ownedCount}/${totalCount}`} tone="accent" />
        <StatTile icon={<EmojiEventsRoundedIcon />} label="Pontos" value={(profile?.totalScore ?? 0).toLocaleString('pt-BR')} />
      </div>

      <AchievementsPanel />

      <MatchHistoryPanel />

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

      <p className="text-center text-xs text-muted">Versão do app: {APP_VERSION}</p>
    </div>
  );
}
