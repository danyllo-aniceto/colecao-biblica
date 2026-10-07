import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type BotSkill, type OptionLetter, type PowerUpKind } from '@board/engine';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialogs';
import { LoadingState } from '@/components/ui/spinner';
import { errorMessage, useToast } from '@/components/ui/toast';
import { BoardLobby, shareRoom } from '@/components/user/board/board-lobby';
import { BoardScreen } from '@/components/user/board/board-screen';
import { BoardSetupModal } from '@/components/user/board/board-setup';
import type { Reveal } from '@/components/user/board/board-question';
import type { CampaignScenario } from '@/lib/campaign-api';
import { playSfx } from '@/lib/sound/sfx';
import {
  addRoomBot,
  answerRoom,
  continueRoom,
  getRoom,
  leaveRoom,
  powerRoom,
  rematchRoom,
  removeRoomPlayer,
  rollRoom,
  setRoomBotSkill,
  setRoomPawn,
  startRoom,
  trialRoom,
  updateRoomConfig,
  type RoomView,
} from '@/lib/board-room-api';

/** Intervalo de consulta: rápido durante a partida, mais calmo no lobby e no pódio. */
const POLL_PLAYING_MS = 1500;
const POLL_IDLE_MS = 3000;
const FATAL = /não está nesta sala|não encontrada/i;
const sleep = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

type Props = {
  code: string;
  /** Visão que já veio de criar/entrar na sala (evita uma tela vazia). */
  initial?: RoomView | null;
  scenarios: CampaignScenario[];
  /** Fecha a sala na tela (a pessoa saiu ou foi tirada). */
  onClose: () => void;
};

/** Sala online: acompanha o servidor por consultas curtas e mostra o lobby, a partida ou o pódio. */
export function OnlineRoom({ code, initial = null, scenarios, onClose }: Props) {
  const toast = useToast();
  const dialogs = useDialogs();
  const [view, setView] = useState<RoomView | null>(initial);
  const [fatal, setFatal] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clockOffset, setClockOffset] = useState(initial ? initial.serverNow - Date.now() : 0);
  const [rolling, setRolling] = useState(false);
  const [face, setFace] = useState<number | null>(null);
  const [flash, setFlash] = useState<number[]>([]);
  const [editing, setEditing] = useState(false);

  const viewRef = useRef<RoomView | null>(initial);
  const versionRef = useRef(initial?.version ?? 0);
  const busyRef = useRef(false);
  const pollingRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const apply = useCallback((next: RoomView) => {
    // Respostas fora de ordem (uma consulta lenta chegando depois de uma jogada) não voltam no tempo.
    if (viewRef.current && next.version < viewRef.current.version) return;
    viewRef.current = next;
    versionRef.current = next.version;
    setView(next);
    setClockOffset(next.serverNow - Date.now());
  }, []);

  const poll = useCallback(async () => {
    if (pollingRef.current || busyRef.current) return;
    pollingRef.current = true;
    try {
      const result = await getRoom(code, versionRef.current);
      if (!mounted.current) return;
      setOffline(false);
      if (result.changed) apply(result);
      else setClockOffset(result.serverNow - Date.now());
    } catch (reason) {
      if (!mounted.current) return;
      const message = errorMessage(reason, '');
      if (FATAL.test(message)) setFatal(message.includes('não encontrada') ? 'Esta sala não existe mais.' : 'Você não está mais nesta sala.');
      else setOffline(true);
    } finally {
      pollingRef.current = false;
    }
  }, [code, apply]);

  // Consulta em laço enquanto a aba está visível; ao voltar para a aba, atualiza na hora.
  useEffect(() => {
    let timer = 0;
    const tick = () => {
      if (document.visibilityState === 'visible') void poll();
      timer = window.setTimeout(tick, viewRef.current?.status === 'PLAYING' ? POLL_PLAYING_MS : POLL_IDLE_MS);
    };
    tick();
    const onVisible = () => document.visibilityState === 'visible' && void poll();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [poll]);

  // Efeitos de quem acompanha: casas que mudaram acendem e os sons marcam o que aconteceu.
  const previous = useRef<RoomView | null>(initial);
  useEffect(() => {
    const before = previous.current;
    previous.current = view;
    if (!view?.state || !before?.state) return;
    const moved = view.state.players.filter((player) => before.state?.players.find((item) => item.id === player.id)?.position !== player.position).map((player) => player.position);
    if (moved.length > 0) {
      setFlash(moved);
      const timer = window.setTimeout(() => mounted.current && setFlash([]), 1800);
      if (view.state.winnerId && !before.state.winnerId) playSfx('reward');
      else playSfx('soft');
      return () => window.clearTimeout(timer);
    }
    if (view.state.winnerId && !before.state.winnerId) playSfx('reward');
    else if (view.reveal && !before.reveal) playSfx(view.reveal.correct ? 'correct' : 'wrong');
    else if (view.state.turn !== before.state.turn && view.state.players[view.state.turn].id === view.me?.key) {
      // Sua vez: um toque no som e uma vibração curta (se o aparelho tiver).
      playSfx('toggleOn');
      navigator.vibrate?.(60);
    }
  }, [view]);

  /** Roda uma ação no servidor e já mostra o que ele devolveu. */
  const act = useCallback(
    async (fn: () => Promise<RoomView>) => {
      busyRef.current = true;
      setBusy(true);
      try {
        apply(await fn());
      } catch (reason) {
        const message = errorMessage(reason);
        if (FATAL.test(message)) setFatal(message.includes('não encontrada') ? 'Esta sala não existe mais.' : 'Você não está mais nesta sala.');
        else toast.error(message);
        // Resincroniza: o estado pode ter andado (tempo esgotado, bot) enquanto a pessoa decidia.
        busyRef.current = false;
        void poll();
      } finally {
        busyRef.current = false;
        if (mounted.current) setBusy(false);
      }
    },
    [apply, poll, toast],
  );

  const roll = useCallback(async () => {
    setRolling(true);
    const shuffle = window.setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 90);
    playSfx('click');
    try {
      await act(async () => {
        const [next] = await Promise.all([rollRoom(code), sleep(700)]);
        return next;
      });
    } finally {
      window.clearInterval(shuffle);
      if (mounted.current) setRolling(false);
    }
  }, [act, code]);

  async function leave() {
    const playing = view?.status === 'PLAYING';
    const ok = await dialogs.confirm({
      title: 'Sair da sala?',
      message: playing ? 'A partida continua e um bot assume o seu lugar. Você não volta para esta partida.' : 'Você pode entrar de novo com o código da sala.',
      confirmLabel: 'Sair',
      tone: 'primary',
    });
    if (!ok) return;
    await exit();
  }

  async function exit() {
    try {
      await leaveRoom(code);
    } catch {
      // Se a sala já acabou ou a pessoa já saiu, só fecha a tela.
    }
    onClose();
  }

  const reveal = useMemo<Reveal | null>(() => {
    if (!view?.reveal) return null;
    const { reveal: server, me } = view;
    return {
      selected: server.selected,
      correct: server.correct,
      timedOut: server.timedOut,
      bot: false,
      correctOption: server.correctOption,
      explanation: server.explanation,
      bibleReference: server.bibleReference,
      canContinue: server.playerId === me?.key,
    };
  }, [view]);

  if (fatal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg p-6">
        <div className="panel max-w-sm space-y-4 p-6 text-center">
          <Alert tone="danger">{fatal}</Alert>
          <Button className="w-full" onClick={onClose}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  if (!view) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg p-4">
        <LoadingState label="Entrando na sala..." />
      </div>
    );
  }

  // Quem foi trocado por um bot (ausência) ou retirado perde a vaga.
  if (!view.me) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg p-6">
        <div className="panel max-w-sm space-y-4 p-6 text-center">
          <Alert tone="info">Você não está mais nesta sala: um bot assumiu o seu lugar por falta de resposta.</Alert>
          <Button className="w-full" onClick={onClose}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  const offlineBanner = offline ? (
    <div className="mx-auto w-full max-w-2xl shrink-0 px-3 pb-2">
      <Alert tone="danger">Sem conexão com o servidor. Tentando reconectar...</Alert>
    </div>
  ) : null;

  if (view.status === 'LOBBY' || !view.state) {
    return (
      <>
        <BoardLobby
          view={view}
          busy={busy}
          connectionLost={offline}
          actions={{
            onLeave: () => void leave(),
            onStart: () => void act(() => startRoom(code)),
            onEditRules: () => setEditing(true),
            onAddBot: (skill: BotSkill) => void act(() => addRoomBot(code, skill)),
            onBotSkill: (slot, skill) => void act(() => setRoomBotSkill(code, slot, skill)),
            onRemove: (slot) => void act(() => removeRoomPlayer(code, slot)),
            onPawn: (pawn) => void act(() => setRoomPawn(code, pawn)),
          }}
        />
        {editing ? (
          <BoardSetupModal
            open
            mode="online"
            scenarios={scenarios}
            defaultScenarioId={view.scenario.id}
            initial={{ scenarioId: view.scenario.id, config: view.config }}
            submitLabel="Salvar regras"
            playerName=""
            onClose={() => setEditing(false)}
            onStart={async (setup) => {
              apply(await updateRoomConfig(code, { scenarioId: setup.scenarioId, config: setup.config }));
              setEditing(false);
            }}
          />
        ) : null}
      </>
    );
  }

  const wins = view.me.wins;
  return (
    <BoardScreen
      theme={{ name: view.scenario.name, color: view.scenario.color, background: view.scenario.quizBackgroundUrl, boardImage: view.scenario.boardImageUrl, pathStyle: view.scenario.boardPathStyle, landmarks: view.scenario.boardLandmarks, music: view.scenario.musicUrl }}
      state={view.state}
      log={view.log}
      feed={view.feed ?? []}
      flash={flash}
      question={view.question}
      reveal={reveal}
      controlledBy={view.me.key}
      rolling={rolling}
      face={face}
      busy={busy}
      deadlineAt={view.deadlineAt}
      clockOffset={clockOffset}
      badge={
        <button
          type="button"
          onClick={() => void shareRoom(code, toast)}
          aria-label={`Sala ${code}: tocar para compartilhar o link`}
          className="shrink-0 rounded-xl bg-surface-3 px-2 py-1 font-display text-xs font-bold tracking-widest text-ink transition hover:bg-surface-2"
        >
          {code}
        </button>
      }
      notice={offlineBanner}
      onRoll={() => void roll()}
      onAnswer={(selected: OptionLetter | null) => void act(() => answerRoom(code, selected))}
      onContinue={() => void act(() => continueRoom(code))}
      onPower={(kind: PowerUpKind, targetId?: string) => void act(() => powerRoom(code, kind, targetId))}
      onTrial={(accept) => void act(() => trialRoom(code, accept))}
      onLeave={() => void leave()}
      onExit={() => void exit()}
      onRematch={async () => apply(await rematchRoom(code))}
      canRematch={view.me.isHost}
      resultNote={wins !== null ? <p className="text-center text-sm font-bold text-ink">🏆 Suas vitórias online: {wins}</p> : null}
    />
  );
}
