import { useCallback, useEffect, useState, type ReactNode } from 'react';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import { useSearchParams } from 'react-router-dom';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import ExtensionRoundedIcon from '@mui/icons-material/ExtensionRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import QuizRoundedIcon from '@mui/icons-material/QuizRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import { useAuth } from '@/components/providers/auth-provider';
import { InstallAppButton } from '@/components/pwa/install-app-button';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Tooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/cn';
import { CharacterEditor } from './screens/character-editor';
import { CharactersScreen } from './screens/characters-screen';
import { OverviewScreen } from './screens/overview-screen';
import { QuestionsScreen } from './screens/questions-screen';
import { ReportsScreen } from './screens/reports-screen';
import { countOpenReports } from '@/lib/admin-api';
import { RewardsScreen } from './screens/rewards-screen';
import { SettingsScreen } from './screens/settings-screen';
import { ShopScreen } from './screens/shop-screen';
import { CosmeticsScreen } from './screens/cosmetics-screen';
import { CollectionsScreen } from './screens/collections-screen';
import { SeasonScreen } from './screens/season-screen';
import { CampaignScreen } from './screens/campaign-screen';
import { ChestsScreen } from './screens/chests-screen';
import { MissionsScreen } from './screens/missions-screen';
import { DuelScreen } from './screens/duel-screen';
import StyleRoundedIcon from '@mui/icons-material/StyleRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import WorkspacesRoundedIcon from '@mui/icons-material/WorkspacesRounded';
import MilitaryTechRoundedIcon from '@mui/icons-material/MilitaryTechRounded';
import { UsersScreen } from './screens/users-screen';

export type AdminScreen = 'visao-geral' | 'usuarios' | 'personagens' | 'perguntas' | 'reportes' | 'recompensas' | 'loja' | 'visual' | 'colecoes' | 'temporada' | 'campanha' | 'missoes' | 'baus' | 'duelo' | 'configuracoes';

const SCREENS: Array<{ id: AdminScreen; label: string; description: string; icon: ReactNode }> = [
  { id: 'visao-geral', label: 'Visão geral', description: 'Números do jogo e o que falta no conteúdo.', icon: <DashboardRoundedIcon fontSize="inherit" /> },
  { id: 'personagens', label: 'Personagens', description: 'Figurinhas do álbum: textos, imagens, diagramas e publicação.', icon: <ExtensionRoundedIcon fontSize="inherit" /> },
  { id: 'perguntas', label: 'Perguntas', description: 'Banco de perguntas das partidas, com explicação e referência.', icon: <QuizRoundedIcon fontSize="inherit" /> },
  { id: 'reportes', label: 'Reportes', description: 'Perguntas que os jogadores marcaram como erradas ou confusas.', icon: <FlagRoundedIcon fontSize="inherit" /> },
  { id: 'recompensas', label: 'Recompensas', description: 'Prêmios usados pela loja e pelos baús. Nos baús, só as recompensas de figurinha e o pacote surpresa entram no sorteio (moedas e ajudas vêm direto de cada baú).', icon: <EmojiEventsRoundedIcon fontSize="inherit" /> },
  { id: 'loja', label: 'Loja', description: 'Itens que os jogadores compram com moedas.', icon: <StorefrontRoundedIcon fontSize="inherit" /> },
  { id: 'visual', label: 'Visual', description: 'Ícones, molduras, títulos, cores do nome, reações, fundos, capas e peões do tabuleiro.', icon: <PaletteRoundedIcon fontSize="inherit" /> },
  { id: 'colecoes', label: 'Coleções', description: 'Grupos de figurinhas com prêmio para quem completar.', icon: <WorkspacesRoundedIcon fontSize="inherit" /> },
  { id: 'temporada', label: 'Passe e eventos', description: 'Trilha mensal de prêmios e eventos com bônus por tempo limitado.', icon: <MilitaryTechRoundedIcon fontSize="inherit" /> },
  { id: 'campanha', label: 'Campanha', description: 'Cenários do caminho, paradas por nível, mapas, imagem do tabuleiro e recompensas.', icon: <MapRoundedIcon fontSize="inherit" /> },
  { id: 'missoes', label: 'Missões', description: 'Metas diárias e semanais com prêmios variados.', icon: <TaskAltRoundedIcon fontSize="inherit" /> },
  { id: 'duelo', label: 'Duelo de Cartas', description: 'Cartas, poderes e Times prontos do Duelo; cadastro por personagem ou por planilha.', icon: <StyleRoundedIcon fontSize="inherit" /> },
  { id: 'baus', label: 'Simulador de baús', description: 'Abre baús de teste e mostra o que cada nível entrega, com as regras de agora.', icon: <Inventory2RoundedIcon fontSize="inherit" /> },
  { id: 'usuarios', label: 'Usuários', description: 'Contas, papéis e ajustes de saldo.', icon: <PeopleAltRoundedIcon fontSize="inherit" /> },
  { id: 'configuracoes', label: 'Configurações', description: 'Regras do jogo, economia e prêmio diário.', icon: <SettingsRoundedIcon fontSize="inherit" /> },
];

/** Atalhos que as telas usam para navegar (ex.: da visão geral para a lista filtrada). */
export type AdminNavigate = (screen: AdminScreen, params?: Record<string, string>) => void;

export function AdminDashboard() {
  const { user, signOut } = useAuth();
  const [params, setParams] = useSearchParams();
  const screen = (SCREENS.find((item) => item.id === params.get('tela'))?.id ?? 'visao-geral') as AdminScreen;
  const editing = params.get('editar');

  const navigate = useCallback<AdminNavigate>(
    (next, extra = {}) => {
      setParams({ tela: next, ...extra });
      window.scrollTo({ top: 0 });
    },
    [setParams],
  );

  const active = SCREENS.find((item) => item.id === screen) ?? SCREENS[0];
  const [openReports, setOpenReports] = useState(0);
  const refreshReports = useCallback(() => {
    countOpenReports()
      .then((result) => setOpenReports(result.open))
      .catch(() => setOpenReports(0));
  }, []);
  useEffect(refreshReports, [refreshReports, screen]);

  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="sticky top-0 z-30 border-b border-edge bg-surface/95 backdrop-blur-xl lg:h-dvh lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 px-4 py-3 lg:px-5 lg:py-6">
          <img src="/icons/icon-192.png" alt="" width={40} height={40} className="h-10 w-10 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-base font-bold text-ink">Coleção Bíblica</p>
            <p className="text-xs font-bold uppercase tracking-wider text-accent-strong dark:text-accent">Painel admin</p>
          </div>
          <div className="flex items-center gap-2 lg:hidden">
            <ThemeToggle compact />
            <Tooltip content="Sair">
              <button type="button" onClick={signOut} aria-label="Sair" className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-3 text-muted hover:text-ink">
                <LogoutRoundedIcon fontSize="small" />
              </button>
            </Tooltip>
          </div>
        </div>

        <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-0" aria-label="Telas do painel">
          {SCREENS.map((item) => {
            const current = screen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'inline-flex h-11 shrink-0 items-center gap-3 rounded-2xl px-4 font-display text-sm font-semibold transition',
                  current ? 'bg-primary text-on-primary shadow-[0_3px_0_var(--primary-strong)]' : 'text-muted hover:bg-surface-3 hover:text-ink',
                )}
              >
                <span className="inline-flex text-lg">{item.icon}</span>
                {item.label}
                {item.id === 'reportes' && openReports > 0 ? (
                  <span className={cn('ml-auto rounded-full px-2 text-xs font-bold', current ? 'bg-on-primary/20' : 'bg-danger text-white')} aria-label={`${openReports} abertos`}>
                    {openReports}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="hidden space-y-3 p-5 lg:absolute lg:inset-x-0 lg:bottom-0 lg:block">
          <p className="truncate text-sm font-semibold text-muted">{user ? user.name : 'Administrador'}</p>
          <div className="flex flex-wrap gap-2">
            <ThemeToggle compact />
            <InstallAppButton />
            <Button variant="secondary" size="sm" onClick={signOut}>
              <LogoutRoundedIcon fontSize="small" />
              Sair
            </Button>
          </div>
        </div>
      </aside>

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {screen === 'personagens' && editing ? (
          <CharacterEditor
            key={editing}
            characterId={editing === 'novo' ? null : Number(editing)}
            onClose={() => navigate('personagens')}
            onNavigate={navigate}
          />
        ) : (
          <>
            <header>
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Administração</p>
              <h1 className="font-display text-3xl font-bold text-ink sm:text-4xl">{active.label}</h1>
              <p className="mt-1 text-sm text-muted">{active.description}</p>
            </header>

            {screen === 'visao-geral' ? <OverviewScreen onNavigate={navigate} /> : null}
            {screen === 'personagens' ? <CharactersScreen params={params} onNavigate={navigate} /> : null}
            {screen === 'perguntas' ? <QuestionsScreen params={params} /> : null}
            {screen === 'reportes' ? <ReportsScreen onChanged={refreshReports} /> : null}
            {screen === 'recompensas' ? <RewardsScreen /> : null}
            {screen === 'missoes' ? <MissionsScreen /> : null}
            {screen === 'loja' ? <ShopScreen /> : null}
            {screen === 'visual' ? <CosmeticsScreen /> : null}
            {screen === 'colecoes' ? <CollectionsScreen /> : null}
            {screen === 'temporada' ? <SeasonScreen /> : null}
            {screen === 'campanha' ? <CampaignScreen /> : null}
            {screen === 'baus' ? <ChestsScreen /> : null}
            {screen === 'duelo' ? <DuelScreen /> : null}
            {screen === 'usuarios' ? <UsersScreen /> : null}
            {screen === 'configuracoes' ? <SettingsScreen /> : null}
          </>
        )}
      </div>
    </main>
  );
}
