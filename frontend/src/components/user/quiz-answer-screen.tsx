'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { QuizSessionStatus } from '@/lib/user-api';

export type QuizAnswerPayload = {
  sessionId: number;
  questionId: number;
  selectedOption: 'A' | 'B' | 'C' | 'D';
  useExtraTime: boolean;
  useExtraLife: boolean;
  useXpMultiplier: boolean;
};

type QuizAnswerScreenProps = {
  session: QuizSessionStatus;
  onAnswer: (payload: QuizAnswerPayload) => Promise<void>;
  onClose: () => void;
  onAbandon: () => Promise<void>;
  isLoading: boolean;
  boosts: {
    extraLife: number;
    extraTime: number;
    doubleXp: number;
  };
};

type AnswerState = 'A' | 'B' | 'C' | 'D' | null;

export function QuizAnswerScreen({ session, onAnswer, onClose, onAbandon, isLoading, boosts }: QuizAnswerScreenProps) {
  const [selected, setSelected] = useState<AnswerState>(null);
  const [submitted, setSubmitted] = useState(false);
  const [useExtraLife, setUseExtraLife] = useState(false);
  const [useExtraTime, setUseExtraTime] = useState(false);
  const [useXpMultiplier, setUseXpMultiplier] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!session.currentQuestion) {
      return;
    }

    setTimeLeft(session.currentQuestion.timeLimitSeconds);
    setSelected(null);

    const intervalId = window.setInterval(() => {
      setTimeLeft((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [session.currentQuestion?.id, session.currentQuestion?.timeLimitSeconds]);

  const timeProgress = useMemo(() => {
    if (!session.currentQuestion || session.currentQuestion.timeLimitSeconds <= 0) {
      return 0;
    }

    return Math.max(0, Math.min(100, (timeLeft / session.currentQuestion.timeLimitSeconds) * 100));
  }, [session.currentQuestion, timeLeft]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selected) return;
    if (!question.id) return;

    setSubmitted(true);
    try {
      await onAnswer({
        sessionId: session.sessionId,
        questionId: question.id,
        selectedOption: selected,
        useExtraLife,
        useExtraTime,
        useXpMultiplier,
      });
    } finally {
      setSubmitted(false);
      setSelected(null);
      setUseExtraLife(false);
      setUseExtraTime(false);
      setUseXpMultiplier(false);
    }
  }

  if (!session.currentQuestion) {
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

  const question = session.currentQuestion;
  const options = [
    { id: 'A', label: 'A', text: question.optionA },
    { id: 'B', label: 'B', text: question.optionB },
    { id: 'C', label: 'C', text: question.optionC },
    { id: 'D', label: 'D', text: question.optionD },
  ] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border-[var(--border)] bg-[var(--bg-secondary)]">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Questão {session.currentQuestionIndex + 1} de {session.totalQuestions}</CardTitle>
            <div className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              {question.timeLimitSeconds}s | {question.difficulty ?? 'N/A'}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
            className="h-10 w-10 rounded-full"
          >
            <ArrowBackRoundedIcon />
          </Button>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
            <div className="mb-2 flex items-center justify-between text-sm text-[var(--text-secondary)]">
              <div className="flex items-center gap-2">
                <AccessTimeRoundedIcon fontSize="small" />
                <span>Tempo restante</span>
              </div>
              <span className="font-semibold text-[var(--text-primary)]">{timeLeft}s</span>
            </div>
            <div className="h-2 w-full rounded-full bg-[var(--border)]">
              <div className="h-full rounded-full bg-[var(--gold)] transition-all duration-1000" style={{ width: `${timeProgress}%` }} />
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-6">
            <p className="text-lg font-semibold leading-7 text-[var(--text-primary)]">{question.text}</p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
            <div className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Bônus da partida</div>
            <div className="grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setUseExtraLife((current) => !current)}
                disabled={boosts.extraLife <= 0}
                className={`rounded-xl border px-3 py-2 text-sm ${useExtraLife ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700' : 'border-[var(--border)] text-[var(--text-secondary)]'} ${boosts.extraLife <= 0 ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                Vida extra ({boosts.extraLife})
              </button>
              <button
                type="button"
                onClick={() => setUseExtraTime((current) => !current)}
                disabled={boosts.extraTime <= 0}
                className={`rounded-xl border px-3 py-2 text-sm ${useExtraTime ? 'border-sky-500 bg-sky-500/15 text-sky-700' : 'border-[var(--border)] text-[var(--text-secondary)]'} ${boosts.extraTime <= 0 ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                Tempo extra ({boosts.extraTime})
              </button>
              <button
                type="button"
                onClick={() => setUseXpMultiplier((current) => !current)}
                disabled={boosts.doubleXp <= 0}
                className={`rounded-xl border px-3 py-2 text-sm ${useXpMultiplier ? 'border-amber-500 bg-amber-500/15 text-amber-700' : 'border-[var(--border)] text-[var(--text-secondary)]'} ${boosts.doubleXp <= 0 ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                XP em dobro ({boosts.doubleXp})
              </button>
            </div>
          </div>

          <form className="space-y-3" onSubmit={handleSubmit}>
            {options.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelected(option.id as AnswerState)}
                className={`group w-full cursor-pointer rounded-2xl border-2 p-4 text-left transition-all ${
                  selected === option.id
                    ? 'border-[var(--gold)] bg-[color-mix(in_srgb,var(--gold)_12%,transparent)]'
                    : 'border-[var(--border)] bg-[var(--bg-primary)] hover:border-[var(--gold)]/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full border-2 font-semibold text-sm transition-all ${
                      selected === option.id
                        ? 'border-[var(--gold)] bg-[var(--gold)] text-[#2C1B10]'
                        : 'border-[var(--border)] text-[var(--text-secondary)]'
                    }`}
                  >
                    {option.label}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-[var(--text-primary)]">{option.text}</div>
                  </div>
                </div>
              </button>
            ))}

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="secondary" onClick={onAbandon} disabled={isLoading}>
                Abandonar sessão
              </Button>
              <Button type="submit" disabled={!selected || isLoading || submitted}>
                {submitted ? 'Enviando...' : 'Confirmar resposta'}
              </Button>
            </div>
          </form>

          <div className="grid gap-3 text-xs text-[var(--text-secondary)]">
            <StatBar label="Vidas restantes" value={session.livesRemaining} />
            <StatBar label="Correctas" value={session.correctAnswers} color="green" />
            <StatBar label="Erradas" value={session.wrongAnswers} color="red" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatBar({ label, value, color = 'default' }: { label: string; value: number; color?: 'default' | 'green' | 'red' }) {
  const colorClass = {
    default: 'bg-[var(--gold)]',
    green: 'bg-emerald-500',
    red: 'bg-red-500',
  }[color];

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <span className="font-semibold">{value}</span>
      </div>
      <div className="h-1 w-full rounded-full bg-[var(--border)]">
        <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${Math.min(value * 10, 100)}%` }} />
      </div>
    </div>
  );
}
