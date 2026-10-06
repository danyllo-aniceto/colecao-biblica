import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { playBotTurn, type BotSkill } from '@duel/bots';
import { doubleStakes, newDuel, retreat, retreatCost, setReady, snapshotOf, stage as stageCard, unstage, viewFor, whyNotStage, type DuelView } from '@duel/engine';
import { applyRound, newSeries, type Series, type SeriesFormat } from '@duel/series';
import type { DuelEvent, DuelState, Side, Snapshot, TeamCard } from '@duel/types';
import { durationOf, narrate, recordLines, stakesText, stepsFrom } from '@/components/user/duel/duel-playback';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialogs';
import { useToast } from '@/components/ui/toast';
import { useCampaign } from '@/components/user/campaign/campaign-provider';
import { DuelHelpModal } from '@/components/user/duel/duel-help';
import { DuelHistoryModal, type HistoryEntry } from '@/components/user/duel/duel-history';
import { DuelRoundModal } from '@/components/user/duel/duel-round-modal';
import { DuelTable, type DuelSpeed, type Stage } from '@/components/user/duel/duel-table';
import type { CardArt } from '@/components/user/duel/duel-card';
import { scenarioMapSrc, scenarioThemeVars } from '@/lib/campaign-theme';
import { useBoardMusic } from '@/lib/sound/board-music';
import { playSfx } from '@/lib/sound/sfx';

export const BOT_NAMES: Record<BotSkill, string> = { APPRENTICE: 'Bot Aprendiz', STUDENT: 'Bot Estudante', MASTER: 'Bot Mestre' };

type GameProps = {
  /** Seu Time e o do rival (12 figurinhas cada). */
  team: TeamCard[];
  foeTeam: TeamCard[];
  skill: BotSkill;
  format: SeriesFormat;
  /** Tempo de cada turno em segundos (null = sem limite). Vencido, o jogo diz "Pronto" com o que já estava colocado. */
  turnSeconds: number | null;
  art: CardArt;
  onExit: () => void;
};

const SPEED_KEY = 'colecao-biblica:duel-speed';
const HELP_KEY = 'colecao-biblica:duel-help';

/** Treino contra bot: um aparelho, sem XP nem moedas. O motor decide tudo; aqui ficam os turnos, as animações, o bot e a série. */
export function DuelGame({ team, foeTeam, skill, format, turnSeconds, art, onExit }: GameProps) {
  const { campaign, current } = useCampaign();
  const dialogs = useDialogs();
  const toast = useToast();
  const newRound = useCallback(() => newDuel({ teams: [team, foeTeam], seed: Math.floor(Math.random() * 2 ** 31), stakesMatter: format !== 'single' }), [team, foeTeam, format]);

  const [state, setState] = useState<DuelState>(newRound);
  const [series, setSeries] = useState<Series>(() => newSeries(format));
  const [selected, setSelected] = useState<number | null>(null);
  const [playback, setPlayback] = useState<{ steps: DuelEvent[]; before: Snapshot; index: number } | null>(null);
  const [summary, setSummary] = useState(false);
  const [helpOpen, setHelpOpen] = useState(() => !localStorage.getItem(HELP_KEY));
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [speed, setSpeed] = useState<DuelSpeed>(() => (localStorage.getItem(SPEED_KEY) === 'rapido' ? 'rapido' : 'normal'));
  const counted = useRef(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const roundId = useRef(0);
  const clockTurn = useRef('');
  const stateRef = useRef(state);
  stateRef.current = state;
  const historyId = useRef(0);

  const view: DuelView = useMemo(() => viewFor(state, 0), [state]);

  /** Aplica uma mudança de estado e, se algo aconteceu, passa a repeti-la passo a passo. */
  const commit = useCallback((produce: (previous: DuelState) => DuelState) => {
    const previous = stateRef.current;
    const next = produce(previous);
    if (next === previous) return;
    stateRef.current = next;
    setState(next);
    const fresh = next.turn !== previous.turn || next.status !== previous.status ? next.events : next.events.slice(previous.events.length);
    const steps = stepsFrom(fresh, snapshotOf(previous));
    if (steps.length > 0) {
      setPlayback({ steps, before: snapshotOf(previous), index: 0 });
      const lines = recordLines(fresh, 0);
      if (lines.length > 0) {
        historyId.current += 1;
        setHistory((entries) => [...entries, { id: historyId.current, label: `Turno ${previous.turn}${next.status === 'finished' ? ' (fim)' : ''}`, lines }]);
      }
    }
  }, []);

  // O bot joga no começo de cada turno (sem ver as figurinhas do jogador); pode dobrar ou desistir. Espera a repetição terminar.
  useEffect(() => {
    if (state.status !== 'playing' || state.players[1].ready || playback) return;
    const timer = window.setTimeout(() => {
      commit((previous) => (previous.status === 'playing' && !previous.players[1].ready ? playBotTurn(previous, 1, skill) : previous));
    }, 900 + Math.random() * 900);
    return () => window.clearTimeout(timer);
  }, [state.turn, state.status, state.players, skill, commit, playback]);

  // Avança os passos sozinho, no ritmo escolhido; toque na mesa adianta.
  const step = playback ? playback.steps[playback.index] : null;
  useEffect(() => {
    if (!playback || !step) return;
    const timer = window.setTimeout(() => advance(), durationOf(step) * (speed === 'rapido' ? 0.45 : 1));
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

  function advance() {
    setPlayback((previous) => {
      if (!previous) return previous;
      return previous.index + 1 >= previous.steps.length ? null : { ...previous, index: previous.index + 1 };
    });
  }

  // Fim da rodada: conta na série e abre o resumo depois de a repetição acabar.
  useEffect(() => {
    if (state.status !== 'finished' || !state.result || counted.current) return;
    counted.current = true;
    const result = state.result;
    setSeries((previous) => applyRound(previous, result));
    playSfx(result.winner === 0 ? 'success' : result.winner === null ? 'soft' : 'error');
  }, [state.status, state.result]);

  useEffect(() => {
    if (state.status === 'finished' && !playback) {
      const timer = window.setTimeout(() => setSummary(true), 900);
      return () => window.clearTimeout(timer);
    }
  }, [state.status, playback]);

  function act(run: (previous: DuelState) => DuelState) {
    try {
      commit(run);
    } catch (reason) {
      toast.info(reason instanceof Error ? reason.message : 'Jogada inválida.');
    }
  }

  function handleStage(uid: number, lane: number) {
    const why = whyNotStage(stateRef.current, 0, uid, lane);
    if (why) {
      toast.info(why);
      return;
    }
    playSfx('soft');
    act((previous) => stageCard(previous, 0, uid, lane));
    setSelected(null);
  }

  async function handleRetreat() {
    const cost = retreatCost(stateRef.current, 0);
    const ok = await dialogs.confirm({ title: 'Desistir da rodada?', message: `Você perde o que está valendo (×${cost}) e o rival vence esta rodada.`, confirmLabel: 'Desistir', tone: 'danger' });
    if (ok) act((previous) => retreat(previous, 0));
  }

  async function handleExit() {
    if (!series.over) {
      const ok = await dialogs.confirm({ title: 'Sair do duelo?', message: 'A partida não fica guardada.', confirmLabel: 'Sair', tone: 'danger' });
      if (!ok) return;
    }
    onExit();
  }

  // O relógio do turno só começa quando a repetição do turno anterior acaba (a pessoa precisa ver o que houve).
  useEffect(() => {
    if (!turnSeconds || state.status !== 'playing' || playback || summary) return;
    const key = `${roundId.current}-${state.turn}`;
    if (clockTurn.current === key) return;
    clockTurn.current = key;
    setDeadline(Date.now() + turnSeconds * 1000);
  }, [turnSeconds, state.status, state.turn, playback, summary]);

  useEffect(() => {
    if (deadline === null) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= deadline) {
        window.clearInterval(timer);
        setDeadline(null);
        if (stateRef.current.status === 'playing' && !stateRef.current.players[0].ready) {
          toast.info('Tempo esgotado: o turno terminou com o que você já tinha colocado.');
          commit((previous) => (previous.status === 'playing' && !previous.players[0].ready ? setReady(previous, 0) : previous));
        }
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [deadline, commit, toast]);
  // Pronto antes da hora: o relógio para.
  useEffect(() => {
    if (state.players[0].ready) setDeadline(null);
  }, [state.players]);
  const remaining = deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));
  useEffect(() => {
    if (remaining !== null && remaining > 0 && remaining <= 5) {
      playSfx('reelTick');
      navigator.vibrate?.(30);
    }
  }, [remaining]);

  function nextRound() {
    roundId.current += 1;
    counted.current = false;
    setSummary(false);
    setSelected(null);
    setPlayback(null);
    setHistory([]);
    const next = newRound();
    stateRef.current = next;
    setState(next);
  }

  function restart() {
    setSeries(newSeries(format));
    nextRound();
  }

  const scenarioSlug = (id: string) => campaign?.scenarios.find((scenario) => scenario.slug === id);
  const laneImage = useCallback(
    (id: string) => {
      const scenario = campaign?.scenarios.find((entry) => entry.slug === id);
      return scenario ? (scenario.duelImageUrl ?? scenarioMapSrc(scenario)) : null;
    },
    [campaign],
  );

  // Música do primeiro cenário aberto (se liberada para o jogador).
  const firstScenario = view.lanes.find((lane) => lane.open)?.scenario;
  const music = firstScenario ? scenarioSlug(firstScenario.id) : undefined;
  useBoardMusic(music?.musicUnlocked ? music.musicUrl : null);

  const stage: Stage | null = playback && step ? { event: { ...step, text: narrate(step, 0) }, snap: step.snap!, prev: playback.index === 0 ? playback.before : (playback.steps[playback.index - 1].snap ?? playback.before), index: playback.index, total: playback.steps.length } : null;

  const result = state.result;

  return (
    <div className="contents" style={scenarioThemeVars(current?.color)}>
      <DuelTable
        view={view}
        art={art}
        opponentName={BOT_NAMES[skill]}
        laneImage={laneImage}
        selectedUid={selected}
        onSelect={setSelected}
        onStage={handleStage}
        onUnstage={(uid) => act((previous) => unstage(previous, 0, uid))}
        onRestage={(uid, lane) => act((previous) => stageCard(unstage(previous, 0, uid), 0, uid, lane))}
        stakesText={stakesText(series, view.stakes)}
        timer={turnSeconds ? { remaining: remaining ?? turnSeconds, total: turnSeconds, waiting: state.players[0].ready } : null}
        onReady={() => {
          setSelected(null);
          act((previous) => setReady(previous, 0));
        }}
        onDouble={() => act((previous) => doubleStakes(previous, 0))}
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
        busy={false}
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
        result={result}
        arenaName={(index) => scenarioSlug(state.lanes[index].scenario)?.name ?? state.lanes[index].scenario}
        you={0}
        series={series}
        footer={
          series.over ? (
            <>
              <Button variant="secondary" onClick={onExit}>
                Sair
              </Button>
              <Button onClick={restart}>Jogar de novo</Button>
            </>
          ) : (
            <Button onClick={nextRound}>Próxima rodada</Button>
          )
        }
      />
    </div>
  );
}
