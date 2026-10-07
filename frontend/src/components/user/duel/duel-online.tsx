import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { snapshotOfView, type DuelView } from '@duel/engine';
import type { CardDef, DuelEvent, Side, Snapshot, Staged } from '@duel/types';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialogs';
import { LoadingState } from '@/components/ui/spinner';
import { errorMessage, useToast } from '@/components/ui/toast';
import { useCampaign } from '@/components/user/campaign/campaign-provider';
import type { CardArt } from '@/components/user/duel/duel-card';
import { DuelHelpModal } from '@/components/user/duel/duel-help';
import { DuelHistoryModal, type HistoryEntry } from '@/components/user/duel/duel-history';
import { DuelDeckManager } from '@/components/user/duel/duel-deck-manager';
import { DuelLobby, shareDuelRoom } from '@/components/user/duel/duel-lobby';
import { durationOf, narrate, recordLines, stakesText, stepsFrom } from '@/components/user/duel/duel-playback';
import { DuelRoundModal } from '@/components/user/duel/duel-round-modal';
import { DuelTable, type DuelSpeed, type Stage } from '@/components/user/duel/duel-table';
import type { DuelDeck } from '@/lib/duel-api';
import {
  addDuelRoomBot,
  doubleDuelRoom,
  getDuelRoom,
  leaveDuelRoom,
  nextDuelRound,
  readyDuelRoom,
  rematchDuelRoom,
  removeDuelRoomPlayer,
  retreatDuelRoom,
  setDuelRoomBotSkill,
  setDuelRoomDeck,
  stageDuelRoom,
  startDuelRoom,
  unstageDuelRoom,
  updateDuelRoomConfig,
  type DuelRoomView,
} from '@/lib/duel-room-api';
import { cn } from '@/lib/cn';
import { scenarioMapSrc, scenarioThemeVars } from '@/lib/campaign-theme';
import { useBoardMusic } from '@/lib/sound/board-music';
import { playSfx } from '@/lib/sound/sfx';

/** Intervalo de consulta: rápido durante o duelo, mais calmo no lobby. */
const POLL_PLAYING_MS = 1500;
const POLL_IDLE_MS = 3000;
const FATAL = /não está nesta sala|não encontrada/i;
const SPEED_KEY = 'colecao-biblica:duel-speed';
const HELP_KEY = 'colecao-biblica:duel-help';

type Props = {
  code: string;
  /** Visão que já veio de criar/entrar na sala (evita uma tela vazia). */
  initial?: DuelRoomView | null;
  /** Times salvos do jogador (para escolher no lobby). */
  decks: DuelDeck[];
  /** Figurinhas do Duelo que o jogador tem (para montar Times na sala de espera) e quantas ainda faltam. */
  ownedCards: CardDef[];
  missing: number;
  /** Recarrega os Times depois de criar, editar ou excluir. */
  onDecksChanged: () => void;
  art: CardArt;
  /** Fecha a sala na tela (a pessoa saiu ou foi tirada). */
  onClose: () => void;
};

/** Sala online do Duelo: acompanha o servidor por consultas curtas e mostra o lobby ou o duelo. */
export function OnlineDuel({ code, initial = null, decks, ownedCards, missing, onDecksChanged, art, onClose }: Props) {
  const toast = useToast();
  const dialogs = useDialogs();
  const [view, setView] = useState<DuelRoomView | null>(initial);
  const [fatal, setFatal] = useState<string | null>(null);
  const [offline, setOffline] = useState(false);
  const [managing, setManaging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clockOffset, setClockOffset] = useState(initial ? initial.serverNow - Date.now() : 0);

  const viewRef = useRef<DuelRoomView | null>(initial);
  const versionRef = useRef(initial?.version ?? 0);
  /** Ações em andamento: a consulta espera para não trazer o estado de antes da jogada. */
  const inFlight = useRef(0);
  const pollingRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const apply = useCallback((next: DuelRoomView) => {
    // Respostas fora de ordem (uma consulta lenta chegando depois de uma jogada) não voltam no tempo.
    if (viewRef.current && next.version < viewRef.current.version) return;
    viewRef.current = next;
    versionRef.current = next.version;
    setView(next);
    setClockOffset(next.serverNow - Date.now());
  }, []);

  const poll = useCallback(async () => {
    if (pollingRef.current || inFlight.current > 0) return;
    pollingRef.current = true;
    try {
      const result = await getDuelRoom(code, versionRef.current);
      if (!mounted.current || inFlight.current > 0) return;
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

  /** Roda uma ação no servidor e já mostra o que ele devolveu. `quiet` não trava a mesa (colocar figurinha). */
  const act = useCallback(
    async (fn: () => Promise<DuelRoomView>, options: { quiet?: boolean } = {}) => {
      inFlight.current += 1;
      if (!options.quiet) setBusy(true);
      try {
        apply(await fn());
      } catch (reason) {
        const message = errorMessage(reason);
        if (FATAL.test(message)) setFatal(message.includes('não encontrada') ? 'Esta sala não existe mais.' : 'Você não está mais nesta sala.');
        else toast.error(message);
        throw reason;
      } finally {
        inFlight.current -= 1;
        if (!options.quiet && mounted.current) setBusy(false);
        // Resincroniza (o estado pode ter andado, por tempo esgotado ou bot, enquanto a pessoa decidia).
        if (inFlight.current === 0) void poll();
      }
    },
    [apply, poll, toast],
  );
  const run = useCallback((fn: () => Promise<DuelRoomView>, options?: { quiet?: boolean }) => act(fn, options).catch(() => undefined), [act]);

  // Quem entra na sala já com algum Time salvo leva o primeiro; dá para trocar no lobby.
  const autoDeck = useRef(false);
  useEffect(() => {
    if (autoDeck.current || !view || view.status !== 'LOBBY' || !view.me || view.me.deckSlot !== null || decks.length === 0) return;
    autoDeck.current = true;
    void run(() => setDuelRoomDeck(code, decks[0].slot));
  }, [view, decks, code, run]);

  async function leave() {
    const playing = view?.status === 'PLAYING';
    const ok = await dialogs.confirm({
      title: 'Sair da sala?',
      message: playing ? 'O duelo continua e um bot assume o seu lugar. Você não volta para esta partida.' : 'Você pode entrar de novo com o código da sala.',
      confirmLabel: 'Sair',
      tone: 'primary',
    });
    if (!ok) return;
    await exit();
  }

  async function exit() {
    try {
      await leaveDuelRoom(code);
    } catch {
      // Se a sala já acabou ou a pessoa já saiu, só fecha a tela.
    }
    onClose();
  }

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

  if (view.status === 'LOBBY' || !view.duel || !view.series) {
    return (
      <>
      <DuelLobby
        view={view}
        decks={decks}
        busy={busy}
        connectionLost={offline}
        actions={{
          onManageDecks: () => setManaging(true),
          onLeave: () => void leave(),
          onStart: () => void run(() => startDuelRoom(code)),
          onAddBot: (skill) => void run(() => addDuelRoomBot(code, skill)),
          onBotSkill: (slot, skill) => void run(() => setDuelRoomBotSkill(code, slot, skill)),
          onRemove: (slot) => void run(() => removeDuelRoomPlayer(code, slot)),
          onDeck: (slot) => void run(() => setDuelRoomDeck(code, slot)),
          onConfig: (config) => void run(() => updateDuelRoomConfig(code, config)),
        }}
      />
      <DuelDeckManager
        open={managing}
        onClose={() => setManaging(false)}
        decks={decks}
        cards={ownedCards}
        art={art}
        missing={missing}
        currentSlot={view.me.deckSlot}
        onUse={(slot) => void run(() => setDuelRoomDeck(code, slot))}
        onChanged={(slot) => {
          onDecksChanged();
          // O Time que acabou de ser salvo já vai para a sala.
          if (slot !== undefined) void run(() => setDuelRoomDeck(code, slot));
        }}
      />
      </>
    );
  }

  return (
    <OnlineMatch
      room={view}
      art={art}
      busy={busy}
      offline={offline}
      clockOffset={clockOffset}
      onStage={(uid, lane) => act(() => stageDuelRoom(code, uid, lane), { quiet: true })}
      onUnstage={(uid) => act(() => unstageDuelRoom(code, uid), { quiet: true })}
      onReady={() => void run(() => readyDuelRoom(code))}
      onDouble={() => void run(() => doubleDuelRoom(code))}
      onRetreat={() => void run(() => retreatDuelRoom(code))}
      onNext={() => void run(() => nextDuelRound(code))}
      onRematch={() => void run(() => rematchDuelRoom(code))}
      onShare={() => void shareDuelRoom(code, toast)}
      onLeave={() => void leave()}
      onExit={() => void exit()}
    />
  );
}

/** A mesma lista de jogadas colocadas, já descontando o Vigor (para a mesa reagir antes de o servidor responder). */
function withStaged(view: DuelView, staged: Staged[]): DuelView {
  const spent = staged.reduce((sum, play) => sum + (view.hand.find((card) => card.uid === play.uid)?.def.cost ?? 0), 0);
  return { ...view, staged, energyLeft: view.energy - spent };
}

type MatchProps = {
  room: DuelRoomView;
  art: CardArt;
  busy: boolean;
  offline: boolean;
  clockOffset: number;
  onStage: (uid: number, lane: number) => Promise<void>;
  onUnstage: (uid: number) => Promise<void>;
  onReady: () => void;
  onDouble: () => void;
  onRetreat: () => void;
  onNext: () => void;
  onRematch: () => void;
  onShare: () => void;
  onLeave: () => void;
  onExit: () => void;
};

/** A mesa do duelo online: o servidor manda a visão do seu lado e a tela repete passo a passo o que o turno fez. */
function OnlineMatch({ room, art, busy, offline, clockOffset, onStage, onUnstage, onReady, onDouble, onRetreat, onNext, onRematch, onShare, onLeave, onExit }: MatchProps) {
  const { campaign, current } = useCampaign();
  const dialogs = useDialogs();
  const duel = room.duel!;
  const series = room.series!;
  const me = room.me!;
  const you: Side = duel.you;
  const foe: Side = you === 0 ? 1 : 0;
  const opponent = room.players.find((player) => player.slot !== me.slot);

  const [selected, setSelected] = useState<number | null>(null);
  const [local, setLocal] = useState<Staged[] | null>(null);
  /** Lista de jogadas colocadas já com as mudanças que ainda estão a caminho do servidor (para várias jogadas seguidas). */
  const stagedNow = useRef<Staged[]>([]);
  const [playback, setPlayback] = useState<{ steps: DuelEvent[]; before: Snapshot; index: number } | null>(null);
  const [summary, setSummary] = useState(false);
  const [helpOpen, setHelpOpen] = useState(() => !localStorage.getItem(HELP_KEY));
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [speed, setSpeed] = useState<DuelSpeed>(() => (localStorage.getItem(SPEED_KEY) === 'rapido' ? 'rapido' : 'normal'));
  const [now, setNow] = useState(() => Date.now());
  const pending = useRef(0);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const historyId = useRef(0);
  const last = useRef<{ round: number; turn: number; status: string; events: number; snap: Snapshot } | null>(null);

  // O que mudou desde a última visão: os acontecimentos novos viram passos da repetição.
  useEffect(() => {
    const before = last.current;
    last.current = { round: room.round, turn: duel.turn, status: duel.status, events: duel.events.length, snap: snapshotOfView(duel) };
    if (!before) return;
    const sameTurn = before.round === room.round && before.turn === duel.turn && before.status === duel.status;
    const fresh = sameTurn ? duel.events.slice(before.events) : duel.events;
    const steps = stepsFrom(fresh, before.snap);
    if (steps.length === 0) return;
    setPlayback((previous) => (previous ? { ...previous, steps: [...previous.steps, ...steps] } : { steps, before: before.snap, index: 0 }));
    const lines = recordLines(fresh, you);
    if (lines.length > 0) {
      historyId.current += 1;
      setHistory((entries) => [...entries, { id: historyId.current, label: `Rodada ${room.round} · turno ${before.turn}${duel.status === 'finished' ? ' (fim)' : ''}`, lines }]);
    }
    setSelected(null);
  }, [room, duel, you]);

  const advance = useCallback(() => {
    setPlayback((previous) => {
      if (!previous) return previous;
      return previous.index + 1 >= previous.steps.length ? null : { ...previous, index: previous.index + 1 };
    });
  }, []);

  // Avança os passos sozinho, no ritmo escolhido; toque na mesa adianta.
  const step = playback ? playback.steps[playback.index] : null;
  useEffect(() => {
    if (!playback || !step) return;
    const timer = window.setTimeout(advance, durationOf(step) * (speed === 'rapido' ? 0.45 : 1));
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback?.index, playback?.steps, speed]);

  // Som de cada passo.
  useEffect(() => {
    if (!step) return;
    if (step.type === 'reveal') playSfx('flip');
    else if (step.type === 'destroy' || step.type === 'discard') playSfx('wrong');
    else if (step.type === 'double') playSfx('coin');
    else if (step.type === 'power' && (step.amount ?? 0) > 0) playSfx('success');
    else if (step.type === 'power' || step.type === 'create' || step.type === 'convert') playSfx('soft');
    else if (step.type === 'scenario') playSfx('open');
  }, [step]);

  // Fim da rodada: o resumo abre depois de a repetição acabar.
  const roundOver = duel.status === 'finished';
  useEffect(() => {
    if (!roundOver) {
      setSummary(false);
      return;
    }
    playSfx(duel.result?.winner === you ? 'success' : duel.result?.winner === null ? 'soft' : 'error');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundOver, room.round]);
  useEffect(() => {
    if (roundOver && !playback) {
      const timer = window.setTimeout(() => setSummary(true), 900);
      return () => window.clearTimeout(timer);
    }
  }, [roundOver, playback]);

  // Cronômetro do turno (o relógio do servidor manda).
  useEffect(() => {
    if (room.deadlineAt === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [room.deadlineAt]);
  const remaining = room.deadlineAt === null || roundOver ? null : Math.max(0, Math.ceil((room.deadlineAt - (now + clockOffset)) / 1000));
  // Durante a repetição do turno o prazo ainda inclui o tempo dela: o anel fica cheio até o relógio de verdade começar.
  const timer = remaining === null ? null : { remaining: Math.min(remaining, room.config.turnSeconds), total: room.config.turnSeconds, waiting: duel.ready };
  const alarm = timer && !timer.waiting && !playback && timer.remaining > 0 && timer.remaining <= 5 ? timer.remaining : null;
  useEffect(() => {
    if (alarm === null) return;
    playSfx('reelTick');
    navigator.vibrate?.(30);
  }, [alarm]);

  /** Coloca ou tira figurinha já na tela e confirma no servidor, na mesma ordem em que a pessoa fez. */
  const enqueue = useCallback((optimistic: Staged[], send: () => Promise<void>) => {
    pending.current += 1;
    stagedNow.current = optimistic;
    setLocal(optimistic);
    chain.current = chain.current.then(() =>
      send()
        .catch(() => undefined)
        .finally(() => {
          pending.current -= 1;
          if (pending.current === 0) setLocal(null);
        }),
    );
  }, []);

  const shown = useMemo(() => (local ? withStaged(duel, local) : duel), [duel, local]);
  // Sem nada a caminho, o que vale é o que o servidor disse.
  const baseStaged = () => (pending.current > 0 ? stagedNow.current : duel.staged);

  function handleStage(uid: number, lane: number) {
    const base = baseStaged();
    if (base.some((play) => play.uid === uid)) return;
    playSfx('soft');
    enqueue([...base, { uid, lane }], () => onStage(uid, lane));
    setSelected(null);
  }

  function handleUnstage(uid: number) {
    enqueue(
      baseStaged().filter((play) => play.uid !== uid),
      () => onUnstage(uid),
    );
  }

  /** Muda uma figurinha já colocada para outra arena (tira e coloca de novo, na ordem). */
  function handleRestage(uid: number, lane: number) {
    playSfx('soft');
    enqueue([...baseStaged().filter((play) => play.uid !== uid), { uid, lane }], async () => {
      await onUnstage(uid);
      await onStage(uid, lane);
    });
  }

  async function handleRetreat() {
    const ok = await dialogs.confirm({ title: 'Desistir da rodada?', message: `Você perde o que está valendo (×${duel.retreatCost}) e o rival vence esta rodada.`, confirmLabel: 'Desistir', tone: 'danger' });
    if (ok) onRetreat();
  }

  async function handleExit() {
    if (series.over) onExit();
    else onLeave();
  }

  const scenarioBySlug = (id: string) => campaign?.scenarios.find((scenario) => scenario.slug === id);
  const laneImage = useCallback(
    (id: string) => {
      const scenario = campaign?.scenarios.find((entry) => entry.slug === id);
      return scenario ? (scenario.duelImageUrl ?? scenarioMapSrc(scenario)) : null;
    },
    [campaign],
  );

  // Música do primeiro cenário aberto (se liberada para o jogador).
  const firstScenario = duel.lanes.find((lane) => lane.open)?.scenario;
  const music = firstScenario ? scenarioBySlug(firstScenario.id) : undefined;
  useBoardMusic(music?.musicUnlocked ? music.musicUrl : null);

  const stage: Stage | null = playback && step ? { event: { ...step, text: narrate(step, you) }, snap: step.snap!, prev: playback.index === 0 ? playback.before : (playback.steps[playback.index - 1].snap ?? playback.before), index: playback.index, total: playback.steps.length } : null;

  const foeName = opponent ? `${opponent.name}${opponent.bot ? ' (bot)' : ''}${!opponent.connected ? ' · sem conexão' : ''}` : 'Rival';
  const acked = room.roundBreak?.acks.includes(me.slot) ?? false;
  const waitingHuman = opponent && !opponent.bot && !opponent.replaced && !(room.roundBreak?.acks.includes(opponent.slot) ?? false);

  const score =
    series.format === 'bo3' ? (
      <span className="rounded-2xl bg-surface-3 px-2 py-1 text-xs font-bold text-ink" aria-label={`Rodadas: você ${series.wins[you]}, rival ${series.wins[foe]}`}>
        🏅 {series.wins[you]}×{series.wins[foe]}
      </span>
    ) : series.format === 'lives' ? (
      <span className="rounded-2xl bg-surface-3 px-2 py-1 text-xs font-bold text-ink" aria-label={`Vidas: você ${series.lives[you]}, rival ${series.lives[foe]}`}>
        ❤ {Math.max(series.lives[you], 0)}×{Math.max(series.lives[foe], 0)}
      </span>
    ) : null;

  const extra = (
    <>
      {offline ? <span className="rounded-2xl bg-danger/15 px-2 py-1 text-xs font-bold text-danger">Sem conexão</span> : null}
      {score}
      <button type="button" onClick={onShare} aria-label={`Sala ${room.code}: tocar para compartilhar o link`} className="rounded-xl bg-surface-3 px-2 py-1 font-display text-xs font-bold tracking-widest text-ink transition hover:bg-surface-2">
        {room.code}
      </button>
    </>
  );

  return (
    <div className="contents" style={scenarioThemeVars(current?.color)}>
      <DuelTable
        view={shown}
        art={art}
        opponentName={foeName}
        laneImage={laneImage}
        selectedUid={selected}
        onSelect={setSelected}
        onStage={handleStage}
        onUnstage={handleUnstage}
        onRestage={handleRestage}
        stakesText={stakesText(series, shown.stakes)}
        timer={timer}
        onReady={() => {
          setSelected(null);
          onReady();
        }}
        onDouble={onDouble}
        onRetreat={() => void handleRetreat()}
        onExit={() => void handleExit()}
        onHelp={() => setHelpOpen(true)}
        onHistory={() => setHistoryOpen(true)}
        stage={stage}
        onAdvance={advance}
        onSkip={() => setPlayback(null)}
        speed={speed}
        onSpeed={() => {
          const next: DuelSpeed = speed === 'normal' ? 'rapido' : 'normal';
          setSpeed(next);
          localStorage.setItem(SPEED_KEY, next);
        }}
        busy={busy}
        extra={extra}
      />

      <DuelHelpModal
        open={helpOpen}
        onClose={() => {
          setHelpOpen(false);
          localStorage.setItem(HELP_KEY, '1');
        }}
      />
      <DuelHistoryModal open={historyOpen} entries={history} onClose={() => setHistoryOpen(false)} />

      <DuelRoundModal
        open={summary}
        result={duel.result}
        arenaName={(index) => {
          const id = duel.lanes[index]?.scenario?.id;
          return (id && scenarioBySlug(id)?.name) || duel.lanes[index]?.scenario?.name || `Arena ${index + 1}`;
        }}
        you={you}
        series={series}
        foeName={opponent?.name ?? 'rival'}
        footer={
          series.over ? (
            <>
              <Button variant="secondary" onClick={onExit}>
                Sair
              </Button>
              {me.isHost ? <Button onClick={onRematch} loading={busy}>Revanche</Button> : <span className="self-center text-sm font-semibold text-muted">Aguardando o anfitrião...</span>}
            </>
          ) : acked ? (
            <span className="flex items-center gap-2 self-center text-sm font-semibold text-muted">{waitingHuman ? `Esperando ${opponent?.name ?? 'o rival'}...` : 'Começando...'}</span>
          ) : (
            <Button onClick={onNext} loading={busy}>
              Próxima rodada
            </Button>
          )
        }
      />
    </div>
  );
}
