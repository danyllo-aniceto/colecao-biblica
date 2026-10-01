import { useEffect, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CloudDoneRoundedIcon from '@mui/icons-material/CloudDoneRounded';
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import HideImageRoundedIcon from '@mui/icons-material/HideImageRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import QuizRoundedIcon from '@mui/icons-material/QuizRounded';
import SportsEsportsRoundedIcon from '@mui/icons-material/SportsEsportsRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/spinner';
import { Alert, ProgressBar } from '@/components/game/game-ui';
import { getAdminStats, type AdminStats } from '@/lib/admin-api';
import { DIFFICULTY_LABELS } from '@/lib/labels';
import { RARITY_ORDER, getRarityLabel } from '@/lib/rarity-theme';
import { AdminPanel, Metric } from '../admin-ui';
import type { AdminNavigate } from '../admin-dashboard';

export function OverviewScreen({ onNavigate }: { onNavigate: AdminNavigate }) {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAdminStats()
      .then(setStats)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a visão geral.'));
  }, []);

  if (error) return <Alert tone="danger">{error}</Alert>;
  if (!stats) return <LoadingState label="Carregando a visão geral..." />;

  const pending = [
    { count: stats.withoutQuestions, label: 'personagens sem perguntas ativas', hint: 'Sem perguntas, o estudo de personagem não funciona para eles.', icon: <QuizRoundedIcon />, go: () => onNavigate('personagens', { pendencia: 'noQuestions' }) },
    { count: stats.withoutImage, label: 'personagens sem imagem', hint: 'A figurinha aparece só com o ícone de livro.', icon: <HideImageRoundedIcon />, go: () => onNavigate('personagens', { pendencia: 'noImage' }) },
    { count: stats.drafts, label: 'personagens em rascunho', hint: 'Rascunhos não aparecem no álbum dos jogadores.', icon: <EditNoteRoundedIcon />, go: () => onNavigate('personagens', { status: 'draft' }) },
    { count: stats.inactiveQuestions, label: 'perguntas inativas', hint: 'Não entram nas partidas.', icon: <QuizRoundedIcon />, go: () => onNavigate('perguntas', { status: 'inactive' }) },
  ].filter((item) => item.count > 0);

  const activeQuestions = stats.questions - stats.inactiveQuestions;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Jogadores" value={stats.users} hint={`+${stats.newUsersWeek} nos últimos 7 dias`} icon={<PeopleAltRoundedIcon />} tone="info" onClick={() => onNavigate('usuarios')} />
        <Metric label="Ativos na semana" value={stats.activeUsersWeek} hint="jogaram ao menos uma partida" icon={<SportsEsportsRoundedIcon />} tone="accent" />
        <Metric label="Partidas" value={stats.matchesToday} hint={`hoje · ${stats.matchesWeek} na semana`} icon={<SportsEsportsRoundedIcon />} tone="violet" />
        <Metric label="Figurinhas entregues" value={stats.stickersGranted} hint="somando todos os jogadores" icon={<CollectionsBookmarkRoundedIcon />} tone="primary" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminPanel
          title="Pendências de conteúdo"
          description="Toque em uma pendência para abrir a lista já filtrada."
          actions={
            <Button size="sm" onClick={() => onNavigate('personagens', { editar: 'novo' })}>
              <AddRoundedIcon fontSize="small" />
              Novo personagem
            </Button>
          }
        >
          {pending.length === 0 ? (
            <p className="flex items-center gap-2 font-semibold text-success-strong dark:text-success">
              <CheckCircleRoundedIcon /> Tudo em dia! Nenhuma pendência.
            </p>
          ) : (
            <ul className="space-y-2">
              {pending.map((item) => (
                <li key={item.label}>
                  <button type="button" onClick={item.go} className="flex w-full items-center gap-3 rounded-2xl bg-surface-2 p-3 text-left transition hover:bg-surface-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary-strong dark:text-primary">{item.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display font-semibold text-ink">
                        {item.count} {item.label}
                      </span>
                      <span className="block text-xs text-muted">{item.hint}</span>
                    </span>
                    <WarningAmberRoundedIcon className="text-primary-strong dark:text-primary" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2 rounded-2xl border border-edge p-3 text-sm">
            {stats.uploads === 'blob' ? <CloudDoneRoundedIcon className="text-success" /> : <StorageRoundedIcon className="text-info" />}
            <span className="text-muted">
              {stats.uploads === 'blob'
                ? 'Imagens salvas no Vercel Blob.'
                : 'Imagens salvas no banco (Vercel Blob não configurado). Funciona, mas o Blob é mais leve para o app.'}
            </span>
          </div>
        </AdminPanel>

        <AdminPanel title="Conteúdo do jogo" description={`${stats.characters} personagens · ${activeQuestions} perguntas ativas (${stats.generalQuestions} gerais)`}>
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Figurinhas publicadas por raridade</h3>
            {RARITY_ORDER.map((rarity) => {
              const count = stats.charactersByRarity[rarity] ?? 0;
              const total = Math.max(1, stats.characters - stats.drafts);
              return (
                <div key={rarity} className="rarity" data-rarity={rarity}>
                  <div className="mb-1 flex justify-between text-sm font-bold">
                    <span className="rarity-text">{getRarityLabel(rarity)}</span>
                    <span className="text-muted">{count}</span>
                  </div>
                  <ProgressBar value={(count / total) * 100} color="var(--r)" className="h-2.5" />
                </div>
              );
            })}
          </div>
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Perguntas ativas por dificuldade</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(DIFFICULTY_LABELS) as Array<keyof typeof DIFFICULTY_LABELS>).map((difficulty) => (
                <button
                  key={difficulty}
                  type="button"
                  onClick={() => onNavigate('perguntas', { dificuldade: difficulty })}
                  className="rounded-2xl bg-surface-2 p-3 text-center transition hover:bg-surface-3"
                >
                  <span className="block font-display text-2xl font-bold text-ink">{stats.questionsByDifficulty[difficulty] ?? 0}</span>
                  <span className="block text-xs font-bold text-muted">{DIFFICULTY_LABELS[difficulty]}</span>
                </button>
              ))}
            </div>
            {activeQuestions < 10 ? (
              <Alert tone="info">Com menos de 10 perguntas ativas as partidas ficam repetitivas. Cadastre mais para o jogo render.</Alert>
            ) : null}
          </div>
        </AdminPanel>
      </div>
    </div>
  );
}
