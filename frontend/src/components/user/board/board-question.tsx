import { useEffect, useMemo, useRef, useState } from 'react';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import type { OptionLetter, QuestionKind } from '@board/engine';
import { Button } from '@/components/ui/button';
import { Alert, ProgressBar } from '@/components/game/game-ui';
import { cn } from '@/lib/cn';
import type { BoardQuestion } from '@/lib/board-api';
import { PHASE_LABEL } from '@/components/user/board/board-meta';

export type Reveal = { selected: OptionLetter | null; correct: boolean; timedOut: boolean; bot: boolean };

const LETTERS: OptionLetter[] = ['A', 'B', 'C', 'D'];

/** Ordem das alternativas estável por pergunta (a mesma ao retomar a partida), sorteada pelo id. */
function orderFor(questionId: number): OptionLetter[] {
  let seed = (questionId * 2654435761) >>> 0;
  const next = () => {
    seed = (Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    return seed / 4294967296;
  };
  const order = [...LETTERS];
  for (let index = order.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(next() * (index + 1));
    [order[index], order[swap]] = [order[swap], order[index]];
  }
  return order;
}

type QuestionSheetProps = {
  question: BoardQuestion;
  kind: QuestionKind;
  /** Nome da provação (ou da vigília), quando for uma. */
  trialName?: string;
  /** Muro: acertos seguidos já feitos e quantos faltam. */
  wall?: { got: number; need: number };
  /** A Pomba mostrou o versículo da pergunta. */
  hint?: boolean;
  /** De quem é a vez e se é um bot jogando (então a tela só acompanha). */
  playerName: string;
  watching: boolean;
  removed: OptionLetter[];
  /** Segundos da pergunta (a regra da sala) e os somados pelo tempo extra. */
  seconds: number;
  extraSeconds: number;
  reveal: Reveal | null;
  onAnswer: (selected: OptionLetter | null) => void;
  onContinue: () => void;
};

/**
 * Folha com a pergunta da vez: tempo, alternativas, gabarito com explicação e o botão de seguir.
 * Quem usa deve passar uma `key` por pergunta e jogador: cada pergunta começa com cronômetro e escolha zerados.
 */
export function QuestionSheet({ question, kind, trialName, wall, hint, playerName, watching, removed, seconds, extraSeconds, reveal, onAnswer, onContinue }: QuestionSheetProps) {
  const order = useMemo(() => orderFor(question.id), [question.id]);
  const [selected, setSelected] = useState<OptionLetter | null>(null);
  const startedAt = useRef(Date.now());
  const [now, setNow] = useState(Date.now());
  const answeredRef = useRef(false);

  const total = seconds + extraSeconds;
  const left = Math.max(0, Math.ceil((startedAt.current + total * 1000 - now) / 1000));
  const timed = !watching && !reveal;

  useEffect(() => {
    if (!timed) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [timed, question.id]);

  // Acabou o tempo sem resposta: conta como erro (uma vez só).
  useEffect(() => {
    if (timed && left === 0 && !answeredRef.current) {
      answeredRef.current = true;
      onAnswer(null);
    }
  }, [timed, left, onAnswer]);

  const text: Record<OptionLetter, string> = { A: question.optionA, B: question.optionB, C: question.optionC, D: question.optionD };
  const progress = (left / Math.max(total, 1)) * 100;
  const timerColor = progress > 50 ? 'var(--accent)' : progress > 20 ? 'var(--primary)' : 'var(--danger)';

  function submit() {
    if (!selected || reveal || watching || answeredRef.current) return;
    answeredRef.current = true;
    onAnswer(selected);
  }

  return (
    <section className="panel animate-fade-up space-y-3 rounded-b-none p-4" aria-label={PHASE_LABEL[kind]}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-display text-sm font-bold uppercase tracking-wide text-primary-strong dark:text-primary">
          {kind === 'VIGIL' && trialName ? trialName : kind === 'TRIAL' && trialName ? `${PHASE_LABEL[kind]} · ${trialName}` : kind === 'WALL' && wall ? `Muro · ${wall.got + 1}ª de ${wall.need}` : PHASE_LABEL[kind]}
          <span className="ml-2 normal-case text-muted">{watching ? `${playerName} está respondendo` : `Vez de ${playerName}`}</span>
        </p>
        {!watching && !reveal ? (
          <span className="inline-flex items-center gap-1 font-display text-lg font-bold tabular-nums text-ink" aria-label={`${left} segundos`}>
            <TimerRoundedIcon fontSize="small" />
            {left}s
          </span>
        ) : null}
      </div>
      {!watching && !reveal ? <ProgressBar value={progress} color={timerColor} className="h-2" /> : null}

      <p className="font-display text-lg font-semibold leading-snug text-ink">{question.text}</p>
      {hint && question.bibleReference && !reveal ? (
        <p className="flex items-center gap-1.5 rounded-xl bg-info/10 px-3 py-1.5 text-sm font-bold text-info-strong dark:text-info">
          <MenuBookRoundedIcon sx={{ fontSize: 16 }} /> Dica da Pomba: {question.bibleReference}
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Alternativas">
        {order.map((letter, slot) => {
          const isRemoved = removed.includes(letter);
          const isSelected = (reveal?.selected ?? selected) === letter;
          const isCorrect = reveal ? letter === question.correctOption : false;
          const isWrongPick = Boolean(reveal) && isSelected && !isCorrect;
          return (
            <button
              key={letter}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={isRemoved || Boolean(reveal) || watching}
              onClick={() => setSelected(letter)}
              className={cn(
                'flex min-h-14 items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left text-sm font-semibold transition',
                isRemoved && 'pointer-events-none opacity-30 line-through',
                !reveal && !isSelected && 'border-edge bg-surface-2 text-ink hover:border-primary',
                !reveal && isSelected && 'border-primary bg-primary/15 text-ink',
                isCorrect && 'border-success bg-success/20 text-ink',
                isWrongPick && 'border-danger bg-danger/15 text-ink',
                reveal && !isCorrect && !isWrongPick && 'border-edge bg-surface-2 text-muted opacity-70',
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface-3 font-display font-bold text-ink">{LETTERS[slot]}</span>
              <span className="min-w-0 flex-1">{text[letter]}</span>
              {isCorrect ? <CheckCircleRoundedIcon className="text-success" /> : null}
              {isWrongPick ? <CancelRoundedIcon className="text-danger" /> : null}
            </button>
          );
        })}
      </div>

      {reveal ? (
        <div className="space-y-3">
          <Alert tone={reveal.correct ? 'success' : 'danger'}>
            {reveal.timedOut ? 'O tempo acabou!' : reveal.correct ? 'Resposta certa!' : 'Resposta errada.'}
            {question.explanation ? <span className="mt-1 block font-normal">{question.explanation}</span> : null}
            {question.bibleReference ? (
              <span className="mt-1 flex items-center gap-1 font-bold">
                <MenuBookRoundedIcon sx={{ fontSize: 16 }} /> {question.bibleReference}
              </span>
            ) : null}
          </Alert>
          {reveal.bot ? null : (
            <Button size="lg" className="w-full" onClick={onContinue} data-autofocus>
              Continuar
            </Button>
          )}
        </div>
      ) : watching ? null : (
        <Button size="lg" className="w-full" onClick={submit} disabled={!selected}>
          Responder
        </Button>
      )}
    </section>
  );
}
