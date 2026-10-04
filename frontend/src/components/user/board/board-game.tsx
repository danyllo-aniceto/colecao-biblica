import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  answerQuestion,
  answerTrialOffer,
  currentPlayer,
  rollDice,
  usePowerUp,
  type BoardState,
  type EngineResult,
  type OptionLetter,
  type PowerUpKind,
  type QuestionBank,
} from '@board/engine';
import { botAction } from '@board/bots';
import { calloutsFor, pickCallouts } from '@board/callouts';
import { useDialogs } from '@/components/ui/dialogs';
import { playSfx } from '@/lib/sound/sfx';
import { clearLocalBoard, saveLocalBoard, type LocalBoardGame } from '@/lib/board-local';
import { eventMessage } from '@/components/user/board/board-meta';
import { BoardScreen } from '@/components/user/board/board-screen';
import type { Reveal } from '@/components/user/board/board-question';
import type { FeedEntry } from '@/components/user/board/use-callouts';

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
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const feedCount = useRef(0);

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
    const callouts = pickCallouts(calloutsFor(result.events, result.state));
    if (callouts.length > 0) setFeed((current) => [...current, ...callouts.map((callout) => ({ ...callout, id: `local-${feedCount.current++}` }))].slice(-20));
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
    (kind: PowerUpKind, targetId?: string) => {
      try {
        apply(usePowerUp(stateRef.current, bank, kind, targetId));
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
      else if (action.type === 'POWER') spendPower(action.kind, action.targetId);
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

  return (
    <BoardScreen
      theme={{ name: saved.scenario.name, color: saved.scenario.color, background: saved.scenario.background, boardImage: saved.scenario.boardImage, pathStyle: saved.scenario.pathStyle, landmarks: saved.scenario.landmarks }}
      state={state}
      log={log}
      feed={feed}
      flash={flash}
      question={question ?? null}
      reveal={reveal}
      controlledBy="local"
      rolling={rolling}
      face={face}
      sharedDevice={humans > 1}
      onRoll={roll}
      onAnswer={(selected) => answer(selected)}
      onContinue={goOn}
      onPower={spendPower}
      onTrial={(accept) => apply(answerTrialOffer(stateRef.current, bank, accept))}
      onLeave={() => void leave()}
      onExit={onExit}
      onRematch={onRematch}
    />
  );
}
