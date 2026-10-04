import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import {
  POWER_UPS,
  answerQuestion,
  answerTrialOffer,
  catchUpBonus,
  currentPlayer,
  rollDice,
  usePowerUp,
  usablePowerUps,
  type BoardState,
  type EngineResult,
  type OptionLetter,
  type PowerUpKind,
  type QuestionBank,
} from '@board/engine';
import { botAction } from '@board/bots';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip } from '@/components/ui/tooltip';
import { useDialogs } from '@/components/ui/dialogs';
import { Alert } from '@/components/game/game-ui';
import { cn } from '@/lib/cn';
import { playSfx } from '@/lib/sound/sfx';
import { quizBackgroundStyle } from '@/lib/quiz-background';
import { scenarioThemeVars } from '@/lib/campaign-theme';
import { clearLocalBoard, saveLocalBoard, type LocalBoardGame } from '@/lib/board-local';
import { BoardHelp } from '@/components/user/board/board-help';
import { BoardResult } from '@/components/user/board/board-result';
import { Dice } from '@/components/user/board/dice';
import { BoardTrack, Pawn } from '@/components/user/board/board-track';
import { eventMessage } from '@/components/user/board/board-meta';
import { QuestionSheet, type Reveal } from '@/components/user/board/board-question';

type GameProps = {
  game: LocalBoardGame;
  onExit: () => void;
  /** Recomeça com os mesmos jogadores e cenário (sorteia perguntas e tabuleiro novos). */
  onRematch: () => Promise<void>;
};

const BOT_ROLL_MS = 1100;
const BOT_ACT_MS = 1000;

/** Partida local: um aparelho, vários jogadores (e bots). O motor decide as regras; aqui ficam os turnos e a tela. */
export function BoardGame({ game: saved, onExit, onRematch }: GameProps) {
  const dialogs = useDialogs();
  const [state, setState] = useState<BoardState>(saved.state);
  const [log, setLog] = useState<string[]>(saved.log);
  const [reveal, setRevealState] = useState<Reveal | null>(null);
  const revealRef = useRef<Reveal | null>(null);
  const [rolling, setRolling] = useState(false);
  const [face, setFace] = useState<number | null>(null);
  const [flash, setFlash] = useState<number[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);

  const stateRef = useRef(state);
  const setReveal = useCallback((value: Reveal | null) => {
    revealRef.current = value;
    setRevealState(value);
  }, []);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const questionsById = useMemo(() => new Map(saved.questions.map((question) => [question.id, question])), [saved.questions]);
  const bank = useMemo<QuestionBank>(
    () => ({
      pool: saved.questions.map((question) => ({ id: question.id, difficulty: question.difficulty })),
      correctOption: (id) => questionsById.get(id)?.correctOption ?? 'A',
    }),
    [saved.questions, questionsById],
  );

  const finished = state.phase === 'FINISHED';
  const player = currentPlayer(state);
  const isBot = Boolean(player.bot);
  const pending = state.pending;
  const question = pending ? questionsById.get(pending.questionId) : undefined;
  const humans = state.players.filter((item) => !item.bot).length;

  // Guarda a cada jogada; partida terminada não volta mais.
  useEffect(() => {
    if (finished) clearLocalBoard();
    else saveLocalBoard({ ...saved, state, log, savedAt: Date.now() });
  }, [saved, state, log, finished]);

  const apply = useCallback((result: EngineResult) => {
    stateRef.current = result.state;
    setState(result.state);
    const lines = result.events.map((event) => eventMessage(event, result.state)).filter((line): line is string => Boolean(line));
    if (lines.length > 0) setLog((current) => [...current, ...lines].slice(-40));
    const arrivals = result.events.flatMap((event) => (event.type === 'MOVED' ? [event.to] : event.type === 'PUSHED' ? [event.to] : []));
    if (arrivals.length > 0) {
      setFlash(arrivals);
      window.setTimeout(() => mounted.current && setFlash([]), 1800);
    }
    for (const event of result.events) {
      if (event.type === 'WON') playSfx('reward');
      else if (event.type === 'ANSWERED') playSfx(event.correct ? 'correct' : 'wrong');
      else if (event.type === 'POWER_GAINED') playSfx('coin');
      else if (event.type === 'PUSHED') playSfx('error');
      else if (event.type === 'MOVED') playSfx('soft');
    }
  }, []);

  const roll = useCallback(() => {
    if (stateRef.current.phase !== 'ROLL') return;
    setRolling(true);
    playSfx('click');
    const shuffle = window.setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 90);
    window.setTimeout(() => {
      window.clearInterval(shuffle);
      if (!mounted.current) return;
      setRolling(false);
      const result = rollDice(stateRef.current, bank);
      setFace(result.state.die);
      apply(result);
    }, 750);
  }, [apply, bank]);

  const answer = useCallback(
    (selected: OptionLetter | null, bot = false) => {
      const current = stateRef.current;
      if (!current.pending) return;
      const correct = selected !== null && selected === bank.correctOption(current.pending.questionId);
      setReveal({ selected, correct, timedOut: selected === null, bot });
      playSfx(correct ? 'correct' : 'wrong');
    },
    [bank, setReveal],
  );

  /** Fecha o gabarito e entrega o resultado ao motor (a jogada só vale depois de ver a resposta). */
  const goOn = useCallback(() => {
    const current = revealRef.current;
    if (!current) return;
    setReveal(null);
    apply(answerQuestion(stateRef.current, bank, current.correct));
  }, [apply, bank, setReveal]);

  const spendPower = useCallback(
    (kind: PowerUpKind) => {
      try {
        apply(usePowerUp(stateRef.current, bank, kind));
        playSfx('toggleOn');
      } catch {
        playSfx('error');
      }
    },
    [apply, bank],
  );

  // Bots: rolam, usam ajudas e respondem sozinhos, com um tempinho de "pensar".
  useEffect(() => {
    if (!isBot || finished || rolling || reveal) return;
    const delay = state.phase === 'ROLL' ? BOT_ROLL_MS : state.phase === 'TRIAL_OFFER' ? BOT_ACT_MS : 1600 + Math.random() * 2200;
    const timer = window.setTimeout(() => {
      const current = stateRef.current;
      const action = botAction(current, bank);
      if (action.type === 'ROLL') roll();
      else if (action.type === 'POWER') spendPower(action.kind);
      else if (action.type === 'TRIAL') apply(answerTrialOffer(current, bank, action.accept));
      else if (current.pending) {
        const right = bank.correctOption(current.pending.questionId);
        const wrong = (['A', 'B', 'C', 'D'] as OptionLetter[]).filter((letter) => letter !== right && !current.pending?.removed.includes(letter));
        answer(action.correct ? right : wrong[Math.floor(Math.random() * wrong.length)] ?? null, true);
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [state, isBot, finished, rolling, reveal, bank, roll, spendPower, apply, answer]);

  // Depois do gabarito de um bot, segue sozinho.
  useEffect(() => {
    if (!reveal?.bot) return;
    const timer = window.setTimeout(goOn, 2200);
    return () => window.clearTimeout(timer);
  }, [reveal, goOn]);

  async function leave() {
    const ok = await dialogs.confirm({
      title: 'Sair da partida?',
      message: 'A partida fica guardada neste aparelho e você pode continuar depois.',
      confirmLabel: 'Sair',
      tone: 'primary',
    });
    if (ok) onExit();
  }

  const usable = isBot ? [] : usablePowerUps(state);
  const bonus = state.phase === 'ROLL' && !isBot ? catchUpBonus(state, player) : 0;
  const steps = state.die !== null ? (state.die + state.bonus) * (state.doubled ? 2 : 1) : null;
  const asking = Boolean(question) && (state.phase === 'QUESTION' || state.phase === 'TRIAL_QUESTION' || state.phase === 'FINAL_QUESTION');

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-bg"
      style={{ ...scenarioThemeVars(saved.scenario.color), ...quizBackgroundStyle(saved.scenario.background) }}
      role="dialog"
      aria-modal="true"
      aria-label={`Tabuleiro: ${saved.scenario.name}`}
    >
      <header className="mx-auto flex w-full max-w-2xl shrink-0 items-center gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={() => void leave()} aria-label="Sair da partida" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-3 text-muted transition hover:text-ink">
          <CloseRoundedIcon />
        </button>
        <div className="min-w-0 flex-1 rounded-2xl bg-surface/90 px-3 py-1.5">
          <p className="truncate font-display text-base font-bold leading-tight text-ink">{saved.scenario.name}</p>
          <p className="text-xs font-semibold text-muted">Rodada {state.round}</p>
        </div>
        <button type="button" onClick={() => setHelpOpen(true)} aria-label="Como jogar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-3 text-muted transition hover:text-ink">
          <HelpOutlineRoundedIcon />
        </button>
      </header>

      <ul className="mx-auto flex w-full max-w-2xl shrink-0 gap-2 overflow-x-auto px-3 pb-2" aria-label="Jogadores">
        {state.players.map((item) => (
          <li
            key={item.id}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-2xl border-2 bg-surface/90 px-2.5 py-1.5',
              !finished && item.id === player.id ? 'border-primary shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_30%,transparent)]' : 'border-edge',
            )}
          >
            <Pawn emoji={item.pawn} className="text-2xl" />
            <div className="min-w-0 leading-tight">
              <p className="max-w-[7rem] truncate font-display text-sm font-bold text-ink">
                {item.name}
                {item.bot ? ' 🤖' : ''}
              </p>
              <p className="text-[11px] font-semibold text-muted">
                Casa {item.position}/{state.config.size}
                {item.powerUps.length > 0 ? ` · ${item.powerUps.map((kind) => POWER_UPS[kind].emoji).join('')}` : ''}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <BoardTrack state={state} flash={flash} />
        {log.length > 0 ? (
          <ul className="mx-auto mb-3 max-w-xl space-y-0.5 px-4 text-xs font-semibold text-muted" aria-label="Últimas jogadas" aria-live="polite">
            {log.slice(-4).map((line, index, all) => (
              <li key={`${log.length}-${index}`} className={index === all.length - 1 ? 'text-ink' : undefined}>
                {line}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mx-auto w-full max-w-2xl max-h-[78dvh] shrink-0 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
        {finished ? null : asking && question && pending ? (
          <div className="space-y-2 px-2">
            {steps !== null && pending.kind === 'MOVE' ? (
              <div className="flex items-center gap-3 rounded-2xl bg-surface/95 px-3 py-2">
                <Dice value={state.die} size={40} />
                <p className="text-sm font-semibold text-ink">
                  Acertando, {player.name} anda <b>{steps}</b> {steps === 1 ? 'casa' : 'casas'}
                  {state.bonus ? ' (com ajuda)' : ''}
                  {state.doubled ? ' (dobrado)' : ''}.
                </p>
              </div>
            ) : null}
            <QuestionSheet
              key={question.id}
              question={question}
              kind={pending.kind}
              trialName={state.rules.trial.name}
              playerName={player.name}
              watching={isBot}
              removed={pending.removed}
              seconds={state.config.timeSeconds}
              extraSeconds={pending.extraSeconds}
              reveal={reveal}
              onAnswer={(selected) => answer(selected)}
              onContinue={goOn}
            />
            {isBot ? null : <PowerBar state={state} usable={usable} locked={Boolean(reveal)} onUse={spendPower} />}
          </div>
        ) : asking ? (
          <div className="p-3">
            <Alert tone="danger">Esta pergunta não está mais disponível. Saia e comece uma nova partida.</Alert>
          </div>
        ) : state.phase === 'TRIAL_OFFER' ? (
          <section className="panel mx-2 animate-fade-up space-y-3 rounded-b-none p-4">
            <p className="font-display text-lg font-bold text-ink">⚔️ {state.rules.trial.name}</p>
            <p className="text-sm font-semibold text-muted">{state.rules.trial.description}</p>
            {isBot ? (
              <p className="flex items-center gap-2 text-sm font-semibold text-muted">
                <Spinner size="sm" /> {player.name} está decidindo...
              </p>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button size="lg" className="flex-1" onClick={() => apply(answerTrialOffer(state, bank, true))}>
                  Aceitar o desafio
                </Button>
                <Button size="lg" variant="secondary" className="flex-1" onClick={() => apply(answerTrialOffer(state, bank, false))}>
                  Seguir o caminho
                </Button>
              </div>
            )}
          </section>
        ) : (
          <section className="panel mx-2 animate-fade-up space-y-3 rounded-b-none p-4">
            <div className="flex items-center gap-4">
              <Dice value={rolling ? face : state.die} rolling={rolling} size={76} />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-display text-lg font-bold text-ink">
                  <Pawn emoji={player.pawn} className="mr-1 text-2xl" />
                  Vez de {player.name}
                </p>
                <p className="text-sm font-semibold text-muted">
                  {isBot ? 'Aguarde a vez dele.' : humans > 1 ? 'Passe o aparelho para quem joga agora e role o dado.' : 'Role o dado e responda para avançar.'}
                </p>
                {bonus > 0 ? <p className="text-xs font-bold text-info">Ajuda ao último colocado: +{bonus} no dado</p> : null}
                {state.doubled ? <p className="text-xs font-bold text-primary-strong dark:text-primary">✨ Dado dobrado ativo</p> : null}
              </div>
            </div>
            {isBot ? (
              <p className="flex items-center gap-2 text-sm font-semibold text-muted">
                <Spinner size="sm" /> {player.name} está jogando...
              </p>
            ) : (
              <Button size="xl" className="w-full" onClick={roll} loading={rolling} data-autofocus>
                {rolling ? 'Rolando...' : 'Rolar o dado'}
              </Button>
            )}
            {isBot ? null : <PowerBar state={state} usable={usable} locked={rolling} onUse={spendPower} />}
          </section>
        )}
      </div>

      {finished ? <BoardResult state={state} scenarioName={saved.scenario.name} onExit={onExit} onRematch={onRematch} /> : null}
      <BoardHelp open={helpOpen} rules={state.rules} onClose={() => setHelpOpen(false)} />
    </div>
  );
}

/** Mochila do jogador da vez: os ativos acendem quando servem; os escudos se gastam sozinhos. */
function PowerBar({ state, usable, locked, onUse }: { state: BoardState; usable: PowerUpKind[]; locked: boolean; onUse: (kind: PowerUpKind) => void }) {
  const player = currentPlayer(state);
  if (!state.config.powerUps) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Mochila de power-ups">
      <span className="text-xs font-bold text-muted">Mochila:</span>
      {player.powerUps.length === 0 ? <span className="text-xs font-semibold text-muted">vazia (pegue nas casas 🎁)</span> : null}
      {player.powerUps.map((kind, index) => {
        const info = POWER_UPS[kind];
        const enabled = !locked && usable.includes(kind);
        return (
          <Tooltip key={`${kind}-${index}`} content={`${info.name}: ${info.description}${info.passive ? ' (se usa sozinho)' : ''}`}>
            <button
              type="button"
              disabled={!enabled}
              onClick={() => onUse(kind)}
              className={cn(
                'inline-flex h-10 items-center gap-1.5 rounded-2xl border-2 px-3 font-display text-sm font-bold transition',
                enabled ? 'border-primary bg-primary/20 text-ink hover:bg-primary/30' : 'border-edge bg-surface-2 text-muted',
                !enabled && !info.passive && 'opacity-60',
              )}
            >
              <span aria-hidden="true">{info.emoji}</span>
              {info.name}
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
