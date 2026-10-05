import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { playBotTurn, type BotSkill } from '@duel/bots';
import { doubleStakes, newDuel, retreat, setReady, stage, unstage, viewFor, whyNotStage, type DuelView } from '@duel/engine';
import { applyRound, damageFor, newSeries, type Series, type SeriesFormat } from '@duel/series';
import { readyTeam } from '@duel/starter';
import type { DuelEvent, DuelState } from '@duel/types';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialogs';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast';
import { useCampaign } from '@/components/user/campaign/campaign-provider';
import { DuelHelpModal } from '@/components/user/duel/duel-help';
import { DuelTable } from '@/components/user/duel/duel-table';
import type { CardArt } from '@/components/user/duel/duel-card';
import { scenarioMapSrc, scenarioThemeVars } from '@/lib/campaign-theme';
import { useBoardMusic } from '@/lib/sound/board-music';
import { playSfx } from '@/lib/sound/sfx';

export const BOT_NAMES: Record<BotSkill, string> = { APPRENTICE: 'Bot Aprendiz', STUDENT: 'Bot Estudante', MASTER: 'Bot Mestre' };

type GameProps = {
  deckId: string;
  skill: BotSkill;
  format: SeriesFormat;
  art: CardArt;
  onExit: () => void;
};

const BANNER_MS = 1000;
/** Acontecimentos que viram aviso na tela (as cartas que entram já aparecem na mesa). */
const BANNER_TYPES = new Set<DuelEvent['type']>(['power', 'destroy', 'move', 'create', 'draw', 'vanish', 'return', 'silence', 'double', 'scenario']);

function eventsAfter(prev: DuelState, next: DuelState): DuelEvent[] {
  return next.turn !== prev.turn || next.status !== prev.status ? next.events : next.events.slice(prev.events.length);
}

/** Treino contra bot: um aparelho, sem XP nem moedas. O motor decide tudo; aqui ficam os turnos, o bot e a série. */
export function DuelGame({ deckId, skill, format, art, onExit }: GameProps) {
  const { campaign, current } = useCampaign();
  const dialogs = useDialogs();
  const toast = useToast();
  const team = useMemo(() => readyTeam(deckId), [deckId]);
  const newRound = useCallback(() => newDuel({ teams: [team, team], seed: Math.floor(Math.random() * 2 ** 31) }), [team]);

  const [state, setState] = useState<DuelState>(newRound);
  const [series, setSeries] = useState<Series>(() => newSeries(format));
  const [selected, setSelected] = useState<number | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [summary, setSummary] = useState(false);
  const [helpOpen, setHelpOpen] = useState(() => !localStorage.getItem('colecao-biblica:duel-help'));
  const counted = useRef(false);
  const stateRef = useRef(state);
  stateRef.current = state;

  const view: DuelView = useMemo(() => viewFor(state, 0), [state]);

  /** Aplica uma mudança de estado e enfileira os avisos do que aconteceu. */
  const commit = useCallback((produce: (previous: DuelState) => DuelState) => {
    const previous = stateRef.current;
    const next = produce(previous);
    if (next === previous) return;
    stateRef.current = next;
    setState(next);
    const events = eventsAfter(previous, next);
    if (events.some((event) => event.type === 'reveal')) playSfx('flip');
    if (events.some((event) => event.type === 'destroy')) playSfx('wrong');
    if (events.some((event) => event.type === 'double')) playSfx('coin');
    const texts = events.filter((event) => BANNER_TYPES.has(event.type)).map((event) => event.text);
    if (texts.length > 0) setQueue((current) => [...current, ...texts.slice(0, 5)]);
  }, []);

  // O bot joga no começo de cada turno (sem ver as cartas do jogador); pode dobrar ou desistir.
  useEffect(() => {
    if (state.status !== 'playing' || state.players[1].ready) return;
    const timer = window.setTimeout(() => {
      commit((previous) => (previous.status === 'playing' && !previous.players[1].ready ? playBotTurn(previous, 1, skill) : previous));
    }, 800 + Math.random() * 900);
    return () => window.clearTimeout(timer);
  }, [state.turn, state.status, state.players, skill, commit]);

  // Passa os avisos um a um.
  useEffect(() => {
    if (queue.length === 0) return;
    const timer = window.setTimeout(() => setQueue((current) => current.slice(1)), BANNER_MS);
    return () => window.clearTimeout(timer);
  }, [queue]);

  // Fim da rodada: conta na série e abre o resumo depois dos avisos.
  useEffect(() => {
    if (state.status !== 'finished' || !state.result || counted.current) return;
    counted.current = true;
    const result = state.result;
    setSeries((previous) => applyRound(previous, result));
    playSfx(result.winner === 0 ? 'success' : result.winner === null ? 'soft' : 'error');
  }, [state.status, state.result]);

  useEffect(() => {
    if (state.status === 'finished' && queue.length === 0) {
      const timer = window.setTimeout(() => setSummary(true), 500);
      return () => window.clearTimeout(timer);
    }
  }, [state.status, queue.length]);

  const busy = queue.length > 0;

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
    act((previous) => stage(previous, 0, uid, lane));
    setSelected(null);
  }

  function handleReady() {
    setSelected(null);
    act((previous) => setReady(previous, 0));
  }

  async function handleRetreat() {
    const ok = await dialogs.confirm({ title: 'Desistir da rodada?', message: `Você perde o que está valendo (${state.stakes}) e o rival vence esta rodada.`, confirmLabel: 'Desistir', tone: 'danger' });
    if (ok) act((previous) => retreat(previous, 0));
  }

  async function handleExit() {
    if (!series.over) {
      const ok = await dialogs.confirm({ title: 'Sair do duelo?', message: 'A partida não fica guardada.', confirmLabel: 'Sair', tone: 'danger' });
      if (!ok) return;
    }
    onExit();
  }

  function nextRound() {
    counted.current = false;
    setSummary(false);
    setSelected(null);
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

  const result = state.result;
  const youWon = result?.winner === 0;
  const lost = result?.winner === 1;

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
        onReady={handleReady}
        onDouble={() => act((previous) => doubleStakes(previous, 0))}
        onRetreat={() => void handleRetreat()}
        onExit={() => void handleExit()}
        onHelp={() => setHelpOpen(true)}
        busy={busy}
        banner={queue[0] ?? null}
      />

      <DuelHelpModal
        open={helpOpen}
        onClose={() => {
          setHelpOpen(false);
          localStorage.setItem('colecao-biblica:duel-help', '1');
        }}
      />

      <Modal
        open={summary && result !== null}
        size="sm"
        title={youWon ? 'Você venceu a rodada!' : lost ? (result?.retreated === 0 ? 'Você desistiu' : 'O rival venceu a rodada') : 'Empate'}
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
      >
        {result ? (
          <div className="space-y-4">
            <ul className="space-y-2">
              {result.lanes.map((lane, index) => {
                const scenario = scenarioSlug(state.lanes[index].scenario);
                return (
                  <li key={index} className="flex items-center justify-between gap-2 rounded-2xl bg-surface-2 px-3 py-2 text-sm font-semibold text-ink">
                    <span className="truncate">{scenario?.name ?? state.lanes[index].scenario}</span>
                    <span className={lane.winner === 0 ? 'font-bold text-success' : lane.winner === 1 ? 'font-bold text-danger' : 'text-muted'}>
                      {lane.power[0]} × {lane.power[1]}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="text-center text-sm font-semibold text-muted">
              {series.format === 'lives'
                ? `Vidas: você ${Math.max(series.lives[0], 0)} · rival ${Math.max(series.lives[1], 0)}${result.winner !== null ? ` (dano ${damageFor(series.round - 1, result.stakes)})` : ''}`
                : series.format === 'bo3'
                  ? `Rodadas vencidas: você ${series.wins[0]} · rival ${series.wins[1]}`
                  : null}
            </p>
            {series.over ? (
              <p className="text-center font-display text-lg font-bold text-ink">
                {series.winner === 0 ? '🏆 Você venceu o duelo!' : series.winner === 1 ? 'O rival venceu o duelo.' : 'Duelo empatado.'}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
