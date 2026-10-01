import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ContentCutRoundedIcon from '@mui/icons-material/ContentCutRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/spinner';
import { Tooltip } from '@/components/ui/tooltip';
import { Hearts } from '@/components/user/sections/play-section';
import { cn } from '@/lib/cn';
import type { QuizSessionStatus } from '@/lib/user-api';

type AnswerOption = 'A' | 'B' | 'C' | 'D';

export type QuizAnswerPayload = {
  sessionId: number;
  questionId: number;
  /** null quando o tempo acabou sem resposta. */
  selectedOption: AnswerOption | null;
  useExtraLife: boolean;
  useXpMultiplier: boolean;
};

/** Gabarito mostrado depois de responder, antes da próxima pergunta. */
export type AnswerReveal = {
  selected: AnswerOption | null;
  correctOption: string;
  correct: boolean;
  timedOut: boolean;
  explanation?: string | null;
  bibleReference?: string | null;
  finished: boolean;
  extraLifeSaved: boolean;
};

type QuizAnswerScreenProps = {
  session: QuizSessionStatus;
  onAnswer: (payload: QuizAnswerPayload) => Promise<void>;
  /** Usa o bônus de tempo extra e devolve a sessão atualizada (ou null em caso de erro). */
  onUseExtraTime: () => Promise<QuizSessionStatus | null>;
  onUseFiftyFifty: () => Promise<QuizSessionStatus | null>;
  onNext: () => void;
  onClose: () => void;
  onAbandon: () => void;
  reveal: AnswerReveal | null;
  isLoading: boolean;
  errorMessage: string | null;
  extraTimeSeconds: number;
  maxLives?: number;
  boosts: {
    extraLife: number;
    extraTime: number;
    doubleXp: number;
    hint: number;
  };
};

/** Cor de cada alternativa, no estilo de jogo de perguntas (A vermelho, B azul, C amarelo, D verde). */
const optionStyles: Record<AnswerOption, { tile: string; letter: string }> = {
  A: { tile: 'bg-danger text-white [--btn-edge:var(--danger-strong)]', letter: 'bg-white/25' },
  B: { tile: 'bg-info text-white [--btn-edge:var(--info-strong)]', letter: 'bg-white/25' },
  C: { tile: 'bg-primary text-on-primary [--btn-edge:var(--primary-strong)]', letter: 'bg-black/10' },
  D: { tile: 'bg-success text-white [--btn-edge:var(--success-strong)]', letter: 'bg-white/25' },
};

function secondsUntil(deadline: number, now: number) {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/**
 * Tela de resposta de uma pergunta. Deve ser montada com `key` igual ao id da pergunta,
 * para que o cronômetro e as seleções reiniciem a cada nova pergunta.
 */
export function QuizAnswerScreen({
  session,
  onAnswer,
  onUseExtraTime,
  onUseFiftyFifty,
  onNext,
  onClose,
  onAbandon,
  reveal,
  isLoading,
  errorMessage,
  extraTimeSeconds,
  maxLives = 3,
  boosts,
}: QuizAnswerScreenProps) {
  const question = session.currentQuestion ?? null;

  const [selected, setSelected] = useState<AnswerOption | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [usingBoost, setUsingBoost] = useState<'time' | 'hint' | null>(null);
  const [useExtraLife, setUseExtraLife] = useState(false);
  const [useXpMultiplier, setUseXpMultiplier] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(() => question?.timeLimitSeconds ?? 0);
  const [deadline, setDeadline] = useState(() => Date.now() + (question?.remainingSeconds ?? question?.timeLimitSeconds ?? 0) * 1000);
  const [now, setNow] = useState(() => Date.now());

  const submittingRef = useRef(false);
  const autoSubmittedRef = useRef(false);
  const latest = useRef({ selected, useExtraLife, useXpMultiplier });
  latest.current = { selected, useExtraLife, useXpMultiplier };

  const timeLeft = secondsUntil(deadline, now);
  const timeProgress = totalSeconds > 0 ? Math.min(100, (timeLeft / totalSeconds) * 100) : 0;
  const removed = new Set(question?.removedOptions ?? []);

  async function submit(option: AnswerOption | null) {
    if (!question?.id || submittingRef.current || reveal) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onAnswer({
        sessionId: session.sessionId,
        questionId: question.id,
        selectedOption: option,
        useExtraLife: latest.current.useExtraLife,
        useXpMultiplier: latest.current.useXpMultiplier,
      });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const submitRef = useRef(submit);
  submitRef.current = submit;

  useEffect(() => {
    if (reveal) {
      return;
    }
    const intervalId = window.setInterval(() => {
      const current = Date.now();
      setNow(current);

      // Tempo esgotado: envia o que estiver selecionado (ou nada) uma única vez.
      if (secondsUntil(deadline, current) === 0 && !autoSubmittedRef.current) {
        autoSubmittedRef.current = true;
        void submitRef.current(latest.current.selected);
      }
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [deadline, reveal]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reveal) {
      onNext();
      return;
    }
    if (selected) {
      await submit(selected);
    }
  }

  async function handleExtraTime() {
    setUsingBoost('time');
    try {
      const updatedQuestion = (await onUseExtraTime())?.currentQuestion;
      if (updatedQuestion) {
        setTotalSeconds(updatedQuestion.timeLimitSeconds);
        setDeadline(Date.now() + updatedQuestion.remainingSeconds * 1000);
        autoSubmittedRef.current = false;
      }
    } finally {
      setUsingBoost(null);
    }
  }

  async function handleFiftyFifty() {
    setUsingBoost('hint');
    try {
      const updated = await onUseFiftyFifty();
      // Se a escolhida foi eliminada, limpa a seleção.
      if (selected && updated?.currentQuestion?.removedOptions?.includes(selected)) {
        setSelected(null);
      }
    } finally {
      setUsingBoost(null);
    }
  }

  if (!question) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg p-4">
        <LoadingState label="Carregando a pergunta..." />
      </div>
    );
  }

  const busy = isLoading || submitting;
  const options = [
    { id: 'A', text: question.optionA },
    { id: 'B', text: question.optionB },
    { id: 'C', text: question.optionC },
    { id: 'D', text: question.optionD },
  ] as const;

  const locked = busy || Boolean(reveal);
  const extraTimeDisabled = session.extraTimeUsed || boosts.extraTime <= 0 || timeLeft === 0 || locked || usingBoost !== null;
  const hintDisabled = Boolean(session.fiftyFiftyUsed) || boosts.hint <= 0 || timeLeft === 0 || locked || usingBoost !== null;
  const extraLifeDisabled = session.extraLifeUsed || boosts.extraLife <= 0 || locked;
  const xpDisabled = session.xpMultiplierUsed || boosts.doubleXp <= 0 || locked;
  const timerColor = timeProgress > 50 ? 'var(--accent)' : timeProgress > 20 ? 'var(--primary)' : 'var(--danger)';
  const answeredCount = session.currentQuestionIndex + (reveal ? 1 : 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg" role="dialog" aria-modal="true" aria-label="Pergunta do quiz">
      <form className="mx-auto flex min-h-full max-w-3xl flex-col gap-4 px-4 pb-36 pt-[max(1rem,env(safe-area-inset-top))] sm:pb-10" onSubmit={handleSubmit}>
        <div className="flex items-center gap-3">
          <Tooltip content="Voltar ao painel (o tempo continua correndo)" side="bottom">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-3 text-muted transition hover:text-ink"
              aria-label="Voltar ao painel (o tempo continua correndo)"
            >
              <CloseRoundedIcon />
            </button>
          </Tooltip>
          <div className="flex flex-1 gap-1" aria-label={`Questão ${session.currentQuestionIndex + 1} de ${session.totalQuestions}`}>
            {Array.from({ length: session.totalQuestions }, (_, index) => (
              <span
                key={index}
                className={cn(
                  'h-2.5 flex-1 rounded-full transition-colors',
                  index < answeredCount ? 'bg-accent' : index === session.currentQuestionIndex ? 'bg-primary' : 'bg-surface-3',
                )}
              />
            ))}
          </div>
          <Hearts lives={session.livesRemaining} max={maxLives} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="font-display text-lg font-bold text-ink">
            Questão {session.currentQuestionIndex + 1}
            <span className="text-muted">/{session.totalQuestions}</span>
          </span>
          <span className="text-sm font-bold text-muted">
            <span className="text-success">{session.correctAnswers} ✓</span> · <span className="text-danger">{session.wrongAnswers} ✗</span>
          </span>
        </div>

        {reveal ? null : (
          <div className="flex items-center gap-3">
            <TimerRoundedIcon className={timeLeft <= 5 ? 'animate-shake text-danger' : 'text-muted'} />
            <div className="h-4 flex-1 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full transition-[width,background-color] duration-300 ease-linear" style={{ width: `${timeProgress}%`, backgroundColor: timerColor }} />
            </div>
            <span className={cn('w-12 text-right font-display text-xl font-bold tabular-nums', timeLeft <= 5 ? 'text-danger' : 'text-ink')}>{timeLeft}s</span>
          </div>
        )}

        <div className="panel animate-pop-in p-5 text-center sm:p-8">
          {question.difficulty ? <span className="text-xs font-bold uppercase tracking-widest text-muted">{difficultyLabel(question.difficulty)}</span> : null}
          <p className="mt-2 font-display text-xl font-semibold leading-snug text-ink sm:text-3xl">{question.text}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((option, index) => {
            const isSelected = (reveal ? reveal.selected : selected) === option.id;
            const isRemoved = removed.has(option.id);
            const isCorrect = reveal?.correctOption === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelected(option.id)}
                disabled={locked || isRemoved}
                aria-pressed={isSelected}
                aria-label={isRemoved ? `${option.id}: eliminada pela dica` : undefined}
                className={cn(
                  'btn-3d animate-fade-up relative flex min-h-16 items-center gap-3 rounded-3xl p-3 text-left font-display text-lg font-semibold transition sm:min-h-20 sm:p-4',
                  optionStyles[option.id].tile,
                  isRemoved && 'opacity-25 line-through grayscale',
                  !reveal && isSelected && 'ring-4 ring-ink/80 ring-offset-2 ring-offset-bg',
                  !reveal && selected && !isSelected && !isRemoved && 'opacity-60',
                  reveal && isCorrect && 'ring-4 ring-success ring-offset-2 ring-offset-bg',
                  reveal && !isCorrect && isSelected && 'animate-shake ring-4 ring-danger ring-offset-2 ring-offset-bg',
                  reveal && !isCorrect && !isSelected && 'opacity-35',
                )}
                style={{ animationDelay: reveal ? undefined : `${index * 60}ms` }}
              >
                <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xl font-bold', optionStyles[option.id].letter)}>{option.id}</span>
                <span className="flex-1 leading-snug">{option.text}</span>
                {reveal && isCorrect ? <CheckCircleRoundedIcon /> : null}
                {reveal && isSelected && !isCorrect ? <CancelRoundedIcon /> : null}
              </button>
            );
          })}
        </div>

        {reveal ? (
          <RevealPanel reveal={reveal} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <PowerUp
              icon={<TimerRoundedIcon />}
              label={session.extraTimeUsed ? 'Usado' : usingBoost === 'time' ? 'Aplicando' : `+${extraTimeSeconds}s`}
              count={boosts.extraTime}
              active={session.extraTimeUsed}
              disabled={extraTimeDisabled}
              onClick={handleExtraTime}
              tone="info"
              hint="Tempo extra: soma segundos a esta pergunta"
            />
            <PowerUp
              icon={<ContentCutRoundedIcon />}
              label={session.fiftyFiftyUsed ? 'Usada' : usingBoost === 'hint' ? 'Aplicando' : '50/50'}
              count={boosts.hint}
              active={Boolean(session.fiftyFiftyUsed)}
              disabled={hintDisabled}
              onClick={handleFiftyFifty}
              tone="violet"
              hint="Dica 50/50: elimina duas alternativas erradas"
            />
            <PowerUp
              icon={<FavoriteRoundedIcon />}
              label={session.extraLifeUsed ? 'Usada' : 'Proteger'}
              count={boosts.extraLife}
              active={useExtraLife}
              disabled={extraLifeDisabled}
              onClick={() => setUseExtraLife((current) => !current)}
              tone="danger"
              hint="Vida extra: se errar esta pergunta, você não perde vida"
            />
            <PowerUp
              icon={<BoltRoundedIcon />}
              label={session.xpMultiplierUsed ? 'Ativo' : 'XP x2'}
              count={boosts.doubleXp}
              active={useXpMultiplier || session.xpMultiplierUsed}
              disabled={xpDisabled}
              onClick={() => setUseXpMultiplier((current) => !current)}
              tone="primary"
              hint="XP em dobro: multiplica o XP de toda a partida"
            />
          </div>
        )}

        {errorMessage ? (
          <p className="rounded-2xl bg-danger/15 px-4 py-3 text-sm font-semibold text-danger" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-edge bg-surface/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <Button type="button" variant="ghost" onClick={onAbandon} disabled={busy}>
              Abandonar
            </Button>
            {reveal ? (
              <Button type="submit" size="xl" className="flex-1" loading={busy} data-autofocus>
                {reveal.finished ? 'Ver resultado' : 'Próxima'}
                {busy ? null : <ArrowForwardRoundedIcon />}
              </Button>
            ) : (
              <Button type="submit" size="xl" className="flex-1" disabled={!selected} loading={submitting}>
                {submitting ? 'Enviando...' : 'Confirmar'}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

function RevealPanel({ reveal }: { reveal: AnswerReveal }) {
  const headline = reveal.correct ? 'Resposta certa!' : reveal.timedOut ? 'O tempo acabou' : 'Não foi dessa vez';
  return (
    <div
      role="status"
      className={cn(
        'animate-pop-in space-y-2 rounded-3xl border-2 p-4 sm:p-5',
        reveal.correct ? 'border-success/50 bg-success/10' : 'border-danger/40 bg-danger/10',
      )}
    >
      <p className={cn('flex items-center gap-2 font-display text-xl font-bold', reveal.correct ? 'text-success-strong dark:text-success' : 'text-danger-strong dark:text-danger')}>
        {reveal.correct ? <CheckCircleRoundedIcon /> : reveal.timedOut ? <TimerRoundedIcon /> : <CancelRoundedIcon />}
        {headline}
      </p>
      {!reveal.correct ? (
        <p className="text-sm font-semibold text-ink">
          A resposta certa é a letra <strong>{reveal.correctOption}</strong>.{reveal.extraLifeSaved ? ' Sua vida extra te protegeu.' : ''}
        </p>
      ) : null}
      {reveal.explanation ? <p className="text-sm leading-6 text-ink">{reveal.explanation}</p> : null}
      {reveal.bibleReference ? (
        <p className="flex items-center gap-1.5 text-sm font-bold text-muted">
          <MenuBookRoundedIcon fontSize="small" /> {reveal.bibleReference}
        </p>
      ) : null}
    </div>
  );
}

function difficultyLabel(difficulty: string) {
  return { EASY: 'Fácil', MEDIUM: 'Média', HARD: 'Difícil', VERY_HARD: 'Muito difícil' }[difficulty] ?? difficulty;
}

function PowerUp({
  icon,
  label,
  count,
  active,
  disabled,
  onClick,
  tone,
  hint,
}: {
  icon: ReactNode;
  label: string;
  count: number;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  tone: 'info' | 'danger' | 'primary' | 'violet';
  hint: string;
}) {
  const toneClass = {
    info: active ? 'bg-info text-white' : 'bg-info/15 text-info',
    danger: active ? 'bg-danger text-white' : 'bg-danger/15 text-danger',
    primary: active ? 'bg-primary text-on-primary' : 'bg-primary/20 text-primary-strong dark:text-primary',
    violet: active ? 'bg-violet text-white' : 'bg-violet/15 text-violet-strong dark:text-violet',
  }[tone];

  return (
    <Tooltip content={hint}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-pressed={active}
        aria-label={`${hint}. Você tem ${count}.`}
        className={cn('relative flex w-full flex-col items-center gap-1 rounded-3xl p-3 font-display text-sm font-semibold transition', toneClass, disabled && !active && 'opacity-40')}
      >
        <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-surface px-1 text-[11px] font-bold text-ink">{count}</span>
        {icon}
        {label}
      </button>
    </Tooltip>
  );
}
