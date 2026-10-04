import { useCallback, useEffect, useMemo, useState } from 'react';
import CasinoRoundedIcon from '@mui/icons-material/CasinoRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import MeetingRoomRoundedIcon from '@mui/icons-material/MeetingRoomRounded';
import { createGame } from '@board/engine';
import { boardRulesFor } from '@board/scenarios';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialogs';
import { errorMessage, useToast } from '@/components/ui/toast';
import { JoinRoomModal } from '@/components/user/board/join-room-modal';
import { OnlineRoom } from '@/components/user/board/online-room';
import { PENDING_ROOM_EVENT, createRoom, joinRoom, myRoom, takePendingRoom, type RoomView } from '@/lib/board-room-api';
import { SectionHeading } from '@/components/game/game-ui';
import { useCampaign } from '@/components/user/campaign/campaign-provider';
import { BoardGame } from '@/components/user/board/board-game';
import { BoardSetupModal, type BoardSetup } from '@/components/user/board/board-setup';
import { fetchBoardQuestions } from '@/lib/board-api';
import { clearLocalBoard, loadLocalBoard, saveLocalBoard, type LocalBoardGame } from '@/lib/board-local';

/** Perguntas por partida: as do tabuleiro e dos jogadores; o motor recomeça o baralho se acabar. */
const questionCount = (size: number, players: number) => Math.min(200, Math.max(40, Math.round(size * players * 0.9)));
const MIN_QUESTIONS = 12;

/** Cartão "Tabuleiro" da aba Jogar: cria uma partida local (um aparelho) ou retoma a que ficou guardada. */
export function BoardHub({ playerName }: { playerName: string }) {
  const { campaign } = useCampaign();
  const dialogs = useDialogs();
  const toast = useToast();
  const [setupOpen, setSetupOpen] = useState(false);
  const [game, setGame] = useState<LocalBoardGame | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const [saved, setSaved] = useState<LocalBoardGame | null>(() => loadLocalBoard());
  const [lastSetup, setLastSetup] = useState<BoardSetup | null>(null);
  const [onlineSetup, setOnlineSetup] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  /** Sala online aberta na tela (com a visão que veio de criar/entrar, para não piscar vazia). */
  const [room, setRoom] = useState<{ code: string; initial: RoomView | null } | null>(null);
  const [current, setCurrent] = useState<{ code: string; scenarioName: string } | null>(null);

  const scenarios = useMemo(() => campaign?.scenarios ?? [], [campaign]);

  // Sala em que a pessoa já está (para voltar a ela) e salas pedidas por link ou convite de amigo.
  const refreshCurrent = useCallback(() => {
    myRoom()
      .then((found) => setCurrent(found ? { code: found.code, scenarioName: found.scenarioName } : null))
      .catch(() => setCurrent(null));
  }, []);

  const openPending = useCallback(async () => {
    const code = takePendingRoom();
    if (!code) return;
    try {
      setRoom({ code, initial: await joinRoom(code) });
    } catch (reason) {
      toast.error(errorMessage(reason, 'Não foi possível entrar na sala.'));
      refreshCurrent();
    }
  }, [toast, refreshCurrent]);

  useEffect(() => {
    refreshCurrent();
    void openPending();
    const listener = () => void openPending();
    window.addEventListener(PENDING_ROOM_EVENT, listener);
    return () => window.removeEventListener(PENDING_ROOM_EVENT, listener);
  }, [refreshCurrent, openPending]);

  /** Sorteia perguntas e tabuleiro e deixa a partida pronta. */
  const build = useCallback(
    async (setup: BoardSetup): Promise<LocalBoardGame> => {
      const scenario = scenarios.find((item) => item.id === setup.scenarioId);
      if (!scenario) throw new Error('Escolha um cenário.');
      const questions = await fetchBoardQuestions({ scenarioId: scenario.id, count: questionCount(setup.config.size, setup.players.length) });
      if (questions.length < MIN_QUESTIONS) throw new Error('Ainda não há perguntas suficientes para uma partida de tabuleiro.');
      const { state } = createGame({
        config: setup.config,
        rules: boardRulesFor(scenario.slug),
        players: setup.players.map((player) => ({ id: player.id, name: player.name, pawn: player.pawn, bot: player.bot })),
        seed: Math.floor(Math.random() * 2 ** 31),
        bank: {
          pool: questions.map((question) => ({ id: question.id, difficulty: question.difficulty })),
          correctOption: (id) => questions.find((question) => question.id === id)?.correctOption ?? 'A',
        },
      });
      return {
        version: 2,
        scenario: { id: scenario.id, slug: scenario.slug, name: scenario.name, color: scenario.color, background: scenario.quizBackgroundUrl ?? null, boardImage: scenario.boardImageUrl ?? null },
        state,
        questions,
        log: [],
        savedAt: Date.now(),
      };
    },
    [scenarios],
  );

  const begin = useCallback((next: LocalBoardGame) => {
    saveLocalBoard(next);
    setSaved(next);
    setGame(next);
    setGameKey((current) => current + 1);
  }, []);

  async function handleStart(setup: BoardSetup) {
    const next = await build(setup);
    setLastSetup(setup);
    setSetupOpen(false);
    begin(next);
  }

  async function handleRematch() {
    // Sem a configuração da sessão (partida retomada), refaz a mesa a partir da partida guardada.
    const base: BoardSetup | null =
      lastSetup ??
      (game
        ? {
            scenarioId: game.scenario.id,
            players: game.state.players.map((player) => ({ id: player.id, name: player.name, pawn: player.pawn, bot: player.bot?.skill ?? null })),
            config: game.state.config,
          }
        : null);
    if (!base) return;
    begin(await build(base));
  }

  async function handleCreateOnline(setup: BoardSetup) {
    const created = await createRoom({ scenarioId: setup.scenarioId, config: setup.config });
    setOnlineSetup(false);
    setRoom({ code: created.code, initial: created });
  }

  async function handleJoinCode(code: string) {
    const joined = await joinRoom(code);
    setJoinOpen(false);
    setRoom({ code: joined.code, initial: joined });
  }

  function closeRoom() {
    setRoom(null);
    refreshCurrent();
  }

  function exitGame() {
    setGame(null);
    setSaved(loadLocalBoard());
  }

  async function discard() {
    const ok = await dialogs.confirm({
      title: 'Descartar a partida guardada?',
      message: 'Ela não poderá ser retomada.',
      confirmLabel: 'Descartar',
      tone: 'danger',
    });
    if (!ok) return;
    clearLocalBoard();
    setSaved(null);
  }

  return (
    <section className="space-y-3" aria-label="Tabuleiro">
      <SectionHeading title="Jogue com amigos" subtitle="Partidas sem XP nem moedas: é só diversão." />
      <div className="panel space-y-4 p-4 sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-violet text-white" aria-hidden="true">
            <CasinoRoundedIcon sx={{ fontSize: 32 }} />
          </span>
          <div className="min-w-0 space-y-1">
            <h3 className="font-display text-xl font-bold text-ink">Tabuleiro</h3>
            <p className="text-sm font-semibold text-muted">
              Role o dado, responda a pergunta e só anda quem acerta. Chegue primeiro no fim do caminho de um cenário! De 2 a 6 jogadores, no mesmo aparelho ou online com os amigos, com bots para completar a mesa.
            </p>
          </div>
        </div>

        {saved ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-2 p-3">
            <p className="text-sm font-semibold text-ink">
              Partida guardada: <b>{saved.scenario.name}</b> · rodada {saved.state.round} · {saved.state.players.length} jogadores
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="accent" onClick={() => begin(saved)}>
                Continuar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void discard()}>
                Descartar
              </Button>
            </div>
          </div>
        ) : null}

        {current && !room ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-accent/15 p-3">
            <p className="text-sm font-semibold text-ink">
              Você está na sala <b className="tracking-widest">{current.code}</b> · {current.scenarioName}
            </p>
            <Button size="sm" variant="accent" onClick={() => setRoom({ code: current.code, initial: null })}>
              Voltar para a sala
            </Button>
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-3">
          <Button size="lg" onClick={() => setSetupOpen(true)} disabled={scenarios.length === 0}>
            <CasinoRoundedIcon /> No mesmo aparelho
          </Button>
          <Button size="lg" variant="accent" onClick={() => setOnlineSetup(true)} disabled={scenarios.length === 0}>
            <GroupsRoundedIcon /> Criar sala online
          </Button>
          <Button size="lg" variant="secondary" onClick={() => setJoinOpen(true)}>
            <MeetingRoomRoundedIcon /> Entrar com código
          </Button>
        </div>
      </div>

      {setupOpen ? (
        <BoardSetupModal
          open
          scenarios={scenarios}
          defaultScenarioId={campaign?.currentScenarioId ?? null}
          playerName={playerName}
          onClose={() => setSetupOpen(false)}
          onStart={handleStart}
        />
      ) : null}

      {onlineSetup ? (
        <BoardSetupModal
          open
          mode="online"
          scenarios={scenarios}
          defaultScenarioId={campaign?.currentScenarioId ?? null}
          playerName={playerName}
          onClose={() => setOnlineSetup(false)}
          onStart={handleCreateOnline}
        />
      ) : null}
      {joinOpen ? <JoinRoomModal open onClose={() => setJoinOpen(false)} onJoin={handleJoinCode} /> : null}
      {room ? <OnlineRoom key={room.code} code={room.code} initial={room.initial} scenarios={scenarios} onClose={closeRoom} /> : null}

      {game ? <BoardGame key={gameKey} game={game} onExit={exitGame} onRematch={handleRematch} /> : null}
    </section>
  );
}
