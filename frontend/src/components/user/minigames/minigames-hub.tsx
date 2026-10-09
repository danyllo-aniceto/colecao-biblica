import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { Button } from '@/components/ui/button';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Segmented } from '@/components/ui/segmented';
import { LoadingState, Spinner } from '@/components/ui/spinner';
import { Alert, EmptyState, LevelBadge } from '@/components/game/game-ui';
import { PlayerChip } from '@/components/user/rewards/player-profile-modal';
import { PeitoralGallery } from '@/components/user/minigames/peitoral-gallery';
import { MiniGamePlay } from '@/components/user/minigames/mini-game-play';
import { CoinIcon } from '@/components/game/game-ui';
import { cn } from '@/lib/cn';
import { getMiniGames, getMiniRanking, type MiniGameInfo, type MiniGamesOverview, type MiniRankingPage } from '@/lib/minigames-api';

type Tab = 'games' | 'ranking' | 'gallery';

/** O jogo ocupa a tela inteira (igual para o jogador e para o administrador testando): por cima do app, com rolagem própria. */
function FullScreen({ children, background }: { children: ReactNode; background?: string | null }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Mini game" className="fixed inset-0 z-[60] overflow-y-auto bg-bg px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
      {background ? (
        // Fundo do jogo enviado pelo painel: cobre a tela e fica clareado para as letras e os botões continuarem legíveis.
        <div aria-hidden className="pointer-events-none fixed inset-0">
          <img src={background} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-bg/55" />
        </div>
      ) : null}
      <div className="relative">{children}</div>
    </div>,
    document.body,
  );
}

function GameCard({ game, onPlay }: { game: MiniGameInfo; onPlay: (game: MiniGameInfo) => void }) {
  const state = !game.unlocked ? 'locked' : game.ready ? 'ready' : 'soon';
  return (
    <li className={cn('panel flex flex-col overflow-hidden', state === 'locked' && 'opacity-70')}>
      {game.coverUrl ? (
        <div className="relative aspect-video w-full overflow-hidden bg-surface-3">
          <img src={game.coverUrl} alt="" loading="lazy" className={cn('absolute inset-0 h-full w-full object-cover', state === 'locked' && 'grayscale')} />
          {state === 'locked' ? (
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
              <LockRoundedIcon fontSize="large" />
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-1 items-start gap-3 p-4">
        <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-3 text-2xl', state === 'locked' && 'grayscale')} aria-hidden>
          {game.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display font-bold text-ink">{game.name}</span>
          <span className="block text-sm font-semibold text-muted">{game.text}</span>
          <span className="mt-2 flex items-center gap-1.5 text-xs font-bold">
            {state === 'locked' ? (
              <>
                <LockRoundedIcon sx={{ fontSize: 16 }} className="text-muted" />
                <span className="text-muted">Libera com a pedra {game.stoneName ?? game.stoneSlot} do Peitoral</span>
              </>
            ) : state === 'soon' ? (
              <span className="rounded-full bg-success/15 px-2.5 py-1 text-success">Liberado · chega em breve</span>
            ) : (
              <Button size="sm" onClick={() => onPlay(game)}>
                Jogar
              </Button>
            )}
          </span>
        </span>
      </div>
    </li>
  );
}

function WeeklyRanking({ currentUserId }: { currentUserId?: number }) {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<MiniRankingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    getMiniRanking(page, 20)
      .then((response) => {
        if (!ignore) {
          setData(response);
          setError(null);
        }
      })
      .catch((reason: unknown) => !ignore && setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o ranking.'))
      .finally(() => !ignore && setLoading(false));
    return () => {
      ignore = true;
    };
  }, [page]);

  if (!data) return error ? <Alert tone="danger">{error}</Alert> : <LoadingState label="Carregando ranking..." />;
  if (data.totalElements === 0) {
    return (
      <EmptyState icon={<EmojiEventsRoundedIcon fontSize="large" />} title="Ninguém pontuou nesta semana">
        O ranking zera toda segunda. Jogue um mini game e seja o primeiro.
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
      {data.me ? (
        <div className="panel flex items-center gap-3 border-2 border-accent p-4">
          <span className="font-display text-2xl font-bold text-accent-strong dark:text-accent">#{data.me.position}</span>
          <span className="flex-1 font-display font-semibold text-ink">Sua posição</span>
          <span className="font-bold text-ink">{data.me.total.toLocaleString('pt-BR')} pts</span>
        </div>
      ) : null}
      <ol className="panel divide-y divide-edge overflow-hidden">
        {data.content.map((entry) => {
          const isMe = entry.userId === currentUserId;
          return (
            <li key={entry.userId} className={cn('flex items-center gap-3 px-4 py-3', isMe && 'bg-accent/10')}>
              <span className="w-10 text-center font-display text-lg font-bold text-muted">{entry.position}</span>
              <PlayerChip userId={entry.userId} name={entry.userName} look={entry.look} suffix={isMe ? '(você)' : undefined} />
              <LevelBadge level={entry.level} size="sm" />
              <span className="font-display font-bold text-ink">{entry.total.toLocaleString('pt-BR')}</span>
            </li>
          );
        })}
      </ol>
      <Pagination page={page} totalPages={data.totalPages} totalElements={data.totalElements} onPageChange={setPage} itemLabel="jogadores" />
    </div>
  );
}

/** Tela dos mini games: os jogos (cada pedra libera um), o ranking semanal (Peitoral Completo) e a Galeria dos Peitorais. Sem XP nem moedas. */
export function MiniGamesHub({ currentUserId, onWallet }: { currentUserId?: number; onWallet: (wallet: { userCoins: number }) => void }) {
  const [tab, setTab] = useState<Tab>('games');
  const [playing, setPlaying] = useState<MiniGameInfo | null>(null);
  const [overview, setOverview] = useState<MiniGamesOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [reload, setReload] = useState(0);

  useEffect(() => {
    let ignore = false;
    getMiniGames()
      .then((response) => !ignore && setOverview(response))
      .catch((reason: unknown) => !ignore && setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os mini games.'));
    return () => {
      ignore = true;
    };
  }, [reload]);

  const games = overview?.games ?? [];
  const list = usePagination(games, 6);

  if (!overview) return error ? <Alert tone="danger">{error}</Alert> : <LoadingState label="Carregando mini games..." />;

  if (playing) {
    return (
      <FullScreen background={playing.backgroundUrl}>
        <MiniGamePlay
          game={playing}
          onWallet={onWallet}
          onExit={() => {
            setPlaying(null);
            setReload((value) => value + 1);
          }}
        />
      </FullScreen>
    );
  }

  const unlockedCount = games.filter((game) => game.unlocked).length;
  return (
    <div className="space-y-5">
      <Segmented
        aria-label="Seção dos mini games"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'games', label: 'Jogos' },
          { value: 'ranking', label: 'Ranking' },
          { value: 'gallery', label: 'Galeria' },
        ]}
      />

      {tab === 'games' ? (
        <div className="space-y-4">
          {overview.adminPreview ? <Alert tone="info">Modo administrador: todos os jogos estão liberados para você testar. Seu placar não entra no ranking dos jogadores.</Alert> : null}
          <p className="text-sm font-semibold text-muted">
            Cada pedra do Peitoral libera um ou dois mini games. Você libera {unlockedCount} de {games.length}. Mini games não dão XP: valem pela diversão, pelas moedas do dia e pelo ranking semanal.
          </p>
          <p className="flex items-center gap-1.5 rounded-xl bg-primary/10 p-2 text-xs font-bold text-ink">
            <CoinIcon className="h-4 w-4" /> A primeira vitória do dia em cada jogo rende {overview.coins.perWin} moedas (até {overview.coins.limit} jogos por dia). Hoje: {overview.coins.winsToday}/{overview.coins.limit}.
          </p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {list.pageItems.map((game) => (
              <GameCard key={game.id} game={game} onPlay={setPlaying} />
            ))}
          </ul>
          <Pagination page={list.page} totalPages={list.totalPages} totalElements={list.totalElements} onPageChange={list.setPage} itemLabel="mini games" />
        </div>
      ) : null}

      {tab === 'ranking' ? (
        overview.rankingUnlocked ? (
          <WeeklyRanking currentUserId={currentUserId} />
        ) : (
          <EmptyState icon={<LockRoundedIcon fontSize="large" />} title="Ranking semanal bloqueado">
            Complete o Peitoral do Sumo Sacerdote (as 12 pedras) para disputar o ranking semanal dos mini games. Ele zera toda segunda.
          </EmptyState>
        )
      ) : null}

      {tab === 'gallery' ? <PeitoralGallery currentUserId={currentUserId} /> : null}
    </div>
  );
}
