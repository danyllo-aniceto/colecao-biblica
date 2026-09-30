'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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

export type QuizAnswerFeedback = 'correct' | 'wrong' | 'timeout';

type QuizAnswerScreenProps = {
  session: QuizSessionStatus;
  onAnswer: (payload: QuizAnswerPayload) => Promise<void>;
  /** Usa o bônus de tempo extra e devolve a sessão atualizada (ou null em caso de erro). */
  onUseExtraTime: () => Promise<QuizSessionStatus | null>;
  onClose: () => void;
  onAbandon: () => Promise<void>;
  isLoading: boolean;
  lastFeedback: QuizAnswerFeedback | null;
  errorMessage: string | null;
  extraTimeSeconds: number;
  boosts: {
    extraLife: number;
    extraTime: number;
    doubleXp: number;
  };
};

const feedbackConfig: Record<QuizAnswerFeedback, { text: string; className: string }> = {
  correct: { text: 'Resposta anterior: correta!', className: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
  wrong: { text: 'Resposta anterior: incorreta.', className: 'border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300' },
  timeout: { text: 'O tempo da pergunta anterior acabou.', className: 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300' },
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
  onClose,
  onAbandon,
  isLoading,
  lastFeedback,
  errorMessage,
  extraTimeSeconds,
  boosts,
}: QuizAnswerScreenProps) {
  const question = session.currentQuestion ?? null;

  const [selected, setSelected] = useState<AnswerOption | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [usingExtraTime, setUsingExtraTime] = useState(false);
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

  async function submit(option: AnswerOption | null) {
    if (!question?.id || submittingRef.current) {
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
  }, [deadline]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected) {
      await submit(selected);
    }
  }

  async function handleExtraTime() {
    setUsingExtraTime(true);
    try {
      const updated = await onUseExtraTime();
      const updatedQuestion = updated?.currentQuestion;
      if (updatedQuestion) {
        setTotalSeconds(updatedQuestion.timeLimitSeconds);
        setDeadline(Date.now() + updatedQuestion.remainingSeconds * 1000);
        autoSubmittedRef.current = false;
      }
    } finally {
      setUsingExtraTime(false);
    }
  }

  if (!question) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
        <Card className="w-full max-w-lg border-[var(--border)] bg-[var(--bg-secondary)]">
          <CardContent className="p-6 text-center">
            <p className="text-sm text-[var(--text-secondary)]">Carregando próxima questão...</p>
          </CardContent>
        </Card>
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

  const extraTimeDisabled = session.extraTimeUsed || boosts.extraTime <= 0 || timeLeft === 0 || busy || usingExtraTime;
  const extraLifeDisabled = session.extraLifeUsed || boosts.extraLife <= 0 || busy;
  const xpDisabled = session.xpMultiplierUsed || boosts.doubleXp <= 0 || busy;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border-[var(--border)] bg-[var(--bg-secondary)]">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Questão {session.currentQuestionIndex + 1} de {session.totalQuestions}</CardTitle>
            <div className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              {totalSeconds}s | {question.difficulty ?? 'N/A'}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={busy}
            className="h-10 w-10 rounded-full"
            aria-label="Voltar ao painel (o tempo continua correndo)"
          >
            <ArrowBackRoundedIcon />
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          {lastFeedback ? (
            <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${feedbackConfig[lastFeedback].className}`} role="status">
              {feedbackConfig[lastFeedback].text}
            </div>
          ) : null}

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
            <div className="mb-2 flex items-center justify-between text-sm text-[var(--text-secondary)]">
              <div className="flex items-center gap-2">
                <AccessTimeRoundedIcon fontSize="small" />
                <span>Tempo restante</span>
              </div>
              <span className={`font-semibold ${timeLeft <= 5 ? 'text-red-600' : 'text-[var(--text-primary)]'}`}>{timeLeft}s</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[var(--border)]">
              <div className="h-full rounded-full bg-[var(--gold)] transition-all duration-300" style={{ width: `${timeProgress}%` }} />
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-6">
            <p className="text-lg font-semibold leading-7 text-[var(--text-primary)]">{question.text}</p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
            <div className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Bônus da partida (1 uso de cada por partida)</div>
            <div className="grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={handleExtraTime}
                disabled={extraTimeDisabled}
                className={`rounded-xl border px-3 py-2 text-sm ${session.extraTimeUsed ? 'border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300' : 'border-[var(--border)] text-[var(--text-secondary)]'} ${extraTimeDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                {session.extraTimeUsed ? 'Tempo extra usado' : usingExtraTime ? 'Aplicando...' : `+${extraTimeSeconds}s de tempo (${boosts.extraTime})`}
              </button>
              <button
                type="button"
                onClick={() => setUseExtraLife((current) => !current)}
                disabled={extraLifeDisabled}
                aria-pressed={useExtraLife}
                title="Se errar esta pergunta, você não perde vida"
                className={`rounded-xl border px-3 py-2 text-sm ${useExtraLife ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' : 'border-[var(--border)] text-[var(--text-secondary)]'} ${extraLifeDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                {session.extraLifeUsed ? 'Vida extra usada' : `Proteger com vida extra (${boosts.extraLife})`}
              </button>
              <button
                type="button"
                onClick={() => setUseXpMultiplier((current) => !current)}
                disabled={xpDisabled}
                aria-pressed={useXpMultiplier}
                title="Multiplica o XP de toda a partida"
                className={`rounded-xl border px-3 py-2 text-sm ${useXpMultiplier || session.xpMultiplierUsed ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'border-[var(--border)] text-[var(--text-secondary)]'} ${xpDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                {session.xpMultiplierUsed ? 'XP em dobro ativo' : `XP em dobro (${boosts.doubleXp})`}
              </button>
            </div>
          </div>

          <form className="space-y-3" onSubmit={handleSubmit}>
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelected(option.id)}
                disabled={busy}
                aria-pressed={selected === option.id}
                className={`group w-full cursor-pointer rounded-2xl border-2 p-4 text-left transition-all ${
                  selected === option.id
                    ? 'border-[var(--gold)] bg-[color-mix(in_srgb,var(--gold)_12%,transparent)]'
                    : 'border-[var(--border)] bg-[var(--bg-primary)] hover:border-[var(--gold)]/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full border-2 text-sm font-semibold transition-all ${
                      selected === option.id
                        ? 'border-[var(--gold)] bg-[var(--gold)] text-[#2C1B10]'
                        : 'border-[var(--border)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {option.id}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-[var(--text-primary)]">{option.text}</div>
                  </div>
                </div>
              </button>
            ))}

            {errorMessage ? <p className="text-sm text-red-700 dark:text-red-400">{errorMessage}</p> : null}

            <div className="flex flex-wrap gap-3 pt-4">
              <Button type="button" variant="secondary" onClick={onAbandon} disabled={busy}>
                Abandonar sessão
              </Button>
              <Button type="submit" disabled={!selected || busy}>
                {submitting ? 'Enviando...' : 'Confirmar resposta'}
              </Button>
            </div>
          </form>

          <div className="grid grid-cols-3 gap-3 text-center text-xs text-[var(--text-secondary)]">
            <Counter label="Vidas" value={session.livesRemaining} />
            <Counter label="Acertos" value={session.correctAnswers} className="text-emerald-600" />
            <Counter label="Erros" value={session.wrongAnswers} className="text-red-600" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Counter({ label, value, className = 'text-[var(--text-primary)]' }: { label: string; value: number; className?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2">
      <div className={`text-lg font-semibold ${className}`}>{value}</div>
      <div>{label}</div>
    </div>
  );
}
