import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import CasinoRoundedIcon from '@mui/icons-material/CasinoRounded';
import StyleRoundedIcon from '@mui/icons-material/StyleRounded';
import { Alert } from '@/components/game/game-ui';
import { useAuth } from '@/components/providers/auth-provider';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/spinner';
import { ScenarioIcon } from '@/components/user/campaign/scenario-art';
import { getPublicRoom, setPendingRoom, type PublicRoom } from '@/lib/board-room-api';
import { getPublicDuelRoom, setPendingDuelRoom } from '@/lib/duel-room-api';
import { scenarioThemeVars } from '@/lib/campaign-theme';

type InviteRoom = Omit<PublicRoom, 'scenario'> & { scenario?: PublicRoom['scenario'] };

/**
 * Link de convite de uma sala do Tabuleiro (/sala/ABCDE) ou do Duelo de Cartas (/duelo/ABCDE). Quem já tem conta entra
 * direto; quem não tem vê o convite e é levado a criar a conta, que depois abre a sala sozinha.
 */
export function RoomInvitePage({ game = 'board' }: { game?: 'board' | 'duel' }) {
  const duel = game === 'duel';
  const fetchRoom: (code: string) => Promise<InviteRoom> = duel ? getPublicDuelRoom : getPublicRoom;
  const rememberRoom = duel ? setPendingDuelRoom : setPendingRoom;
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const { isHydrated, isAuthenticated } = useAuth();
  const [room, setRoom] = useState<InviteRoom | null>(null);
  const [error, setError] = useState<string | null>(null);
  const clean = code.trim().toUpperCase();

  useEffect(() => {
    let alive = true;
    fetchRoom(clean)
      .then((found) => alive && setRoom(found))
      .catch((reason: unknown) => alive && setError(reason instanceof Error ? reason.message : 'Sala não encontrada.'));
    return () => {
      alive = false;
    };
  }, [clean]);

  const open = room?.status === 'LOBBY' && room.players < room.maxPlayers;

  // Já logado: guarda a sala e segue para o painel, que abre a sala na aba Jogar.
  useEffect(() => {
    if (isHydrated && isAuthenticated && room && open) {
      rememberRoom(clean);
      navigate('/dashboard', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, isAuthenticated, room, open, clean, navigate]);

  function goTo(path: string) {
    rememberRoom(clean);
    navigate(path);
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 px-4 py-8">
      <div className="flex justify-end">
        <ThemeToggle compact />
      </div>
      {!room && !error ? <LoadingState label="Abrindo o convite..." /> : null}
      {error ? (
        <div className="panel space-y-4 p-6 text-center">
          <Alert tone="danger">{error}</Alert>
          <Button className="w-full" onClick={() => navigate('/')}>
            Ir para o início
          </Button>
        </div>
      ) : null}
      {room ? (
        <section className="panel animate-pop-in space-y-5 p-6 text-center" style={scenarioThemeVars(room.scenario?.color)}>
          <span className="mx-auto flex w-fit rounded-3xl">
            {room.scenario ? (
              <ScenarioIcon scenario={{ slug: room.scenario.slug, iconImageUrl: room.scenario.iconImageUrl }} size={88} />
            ) : (
              <span className="flex h-[88px] w-[88px] items-center justify-center rounded-3xl bg-primary text-on-primary">
                <StyleRoundedIcon sx={{ fontSize: 52 }} />
              </span>
            )}
          </span>
          <div className="space-y-1">
            <p className="flex items-center justify-center gap-1.5 text-sm font-bold text-muted">
              {duel ? <StyleRoundedIcon fontSize="small" /> : <CasinoRoundedIcon fontSize="small" />} {duel ? 'Duelo de Cartas' : 'Tabuleiro Bíblico'}
            </p>
            <h1 className="font-display text-2xl font-bold text-ink">{room.hostName} chamou você para jogar!</h1>
            <p className="text-sm font-semibold text-muted">
              {room.scenario ? `${room.scenario.name} · ` : ''}{room.players} de {room.maxPlayers} jogadores · sala <b className="tracking-widest text-ink">{room.code}</b>
            </p>
          </div>

          {!open ? (
            <>
              <Alert tone="info">{room.status === 'LOBBY' ? 'Essa sala já está cheia.' : 'A partida desta sala já começou. Peça um novo convite quando ela terminar.'}</Alert>
              <Button className="w-full" onClick={() => navigate(isAuthenticated ? '/dashboard' : '/')}>
                {isAuthenticated ? 'Ir para o painel' : 'Ir para o início'}
              </Button>
            </>
          ) : isHydrated && !isAuthenticated ? (
            <>
              <Alert tone="info">Para jogar online é preciso ter uma conta gratuita. É rápido, e a sala abre sozinha assim que você entrar.</Alert>
              <div className="space-y-2">
                <Button size="lg" className="w-full" onClick={() => goTo('/?conta=criar')}>
                  Criar minha conta e jogar
                </Button>
                <Button size="lg" variant="secondary" className="w-full" onClick={() => goTo('/')}>
                  Já tenho conta
                </Button>
              </div>
            </>
          ) : (
            <LoadingState label="Entrando na sala..." />
          )}
        </section>
      ) : null}
    </main>
  );
}
