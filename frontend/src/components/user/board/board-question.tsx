import { useEffect, useMemo, useRef, useState } from 'react';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import type { OptionLetter, QuestionKind } from '@board/engine';
import { Button } from '@/components/ui/button';
import { Alert, ProgressBar } from '@/components/game/game-ui';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/cn';
import { PHASE_LABEL } from '@/components/user/board/board-meta';

/** Pergunta como a folha mostra: no online a alternativa certa e a explicação só chegam junto do gabarito. */
export type SheetQuestion = {
  id: number;
  text: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  bibleReference?: string | null;
  explanation?: string | null;
  correctOption?: OptionLetter;
};

export type Reveal = {
  selected: OptionLetter | null;
  correct: boolean;
  timedOut: boolean;
  bot: boolean;
  /** Online: o gabarito vem do servidor. */
  correctOption?: OptionLetter;
  explanation?: string | null;
  bibleReference?: string | null;
  /** Quem pode fechar o gabarito (no online, só quem respondeu; os outros esperam). */
  canContinue?: boolean;
};

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
  question: SheetQuestion;
  kind: QuestionKind;
  /** Nome da provação (ou da vigília), quando for uma. */
  trialName?: string;
  /** Muro: acertos seguidos já feitos e quantos faltam. */
  wall?: { got: number; need: number };
  /** A Pomba mostrou o versículo da pergunta. */
  hint?: boolean;
  /** De quem é a vez e se esta tela só acompanha (bot ou outro jogador online). */
  playerName: string;
  watching: boolean;
  removed: OptionLetter[];
  /** Segundos da pergunta (a regra da sala) e os somados pelo tempo extra. */
  seconds: number;
  extraSeconds: number;
  /** Online: fim do tempo marcado pelo servidor e a diferença entre o relógio dele e o deste aparelho. */
  deadlineAt?: number | null;
  clockOffset?: number;
  reveal: Reveal | null;
  onAnswer: (selected: OptionLetter | null) => void;
  onContinue: () => void;
};

/**
 * Folha com a pergunta da vez: tempo, alternativas, gabarito com explicação e o botão de seguir.
 * Quem usa deve passar uma `key` por pergunta e jogador: cada um começa com cronômetro e escolha zerados.
 */
export function QuestionSheet({
  question,
  kind,
  trialName,
  wall,
  hint,
  playerName,
  watching,
  removed,
  seconds,
  extraSeconds,
  deadlineAt,
  clockOffset = 0,
  reveal,
  onAnswer,
  onContinue,
}: QuestionSheetProps) {
  const order = useMemo(() => orderFor(question.id), [question.id]);
  const [selected, setSelected] = useState<OptionLetter | null>(null);
  const startedAt = useRef(Date.now());
  const [now, setNow] = useState(Date.now());
  const answeredRef = useRef(false);

  const total = seconds + extraSeconds;
  const endsAt = deadlineAt ?? startedAt.current + total * 1000;
  const left = Math.max(0, Math.ceil((endsAt - (now + clockOffset)) / 1000));
  // Quem joga vê o tempo correr; no online quem acompanha também vê (o servidor é quem manda).
  const ticking = !reveal && (!watching || deadlineAt != null);

  useEffect(() => {
    if (!ticking) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [ticking, question.id]);

  // Acabou o tempo sem resposta: conta como erro (uma vez só, e só para quem joga).
  useEffect(() => {
    if (!watching && !reveal && left === 0 && !answeredRef.current) {
      answeredRef.current = true;
      onAnswer(null);
    }
  }, [watching, reveal, left, onAnswer]);

  const text: Record<OptionLetter, string> = { A: question.optionA, B: question.optionB, C: question.optionC, D: question.optionD };
  const correctOption = reveal?.correctOption ?? question.correctOption;
  const explanation = reveal?.explanation ?? question.explanation;
  const reference = reveal?.bibleReference ?? question.bibleReference;
  const progress = (left / Math.max(deadlineAt != null ? Math.max(total, left) : total, 1)) * 100;
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
        {ticking ? (
          <span className="inline-flex items-center gap-1 font-display text-lg font-bold tabular-nums text-ink" aria-label={`${left} segundos`}>
            <TimerRoundedIcon fontSize="small" />
            {left}s
          </span>
        ) : null}
      </div>
      {ticking ? <ProgressBar value={progress} color={timerColor} className="h-2" /> : null}

      <p className="font-display text-lg font-semibold leading-snug text-ink">{question.text}</p>
      {hint && reference && !reveal ? (
        <p className="flex items-center gap-1.5 rounded-xl bg-info/10 px-3 py-1.5 text-sm font-bold text-info-strong dark:text-info">
          <MenuBookRoundedIcon sx={{ fontSize: 16 }} /> Dica da Pomba: {reference}
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Alternativas">
        {order.map((letter, slot) => {
          const isRemoved = removed.includes(letter);
          const isSelected = (reveal ? reveal.selected : selected) === letter;
          const isCorrect = reveal ? letter === correctOption : false;
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
            {explanation ? <span className="mt-1 block font-normal">{explanation}</span> : null}
            {reference ? (
              <span className="mt-1 flex items-center gap-1 font-bold">
                <MenuBookRoundedIcon sx={{ fontSize: 16 }} /> {reference}
              </span>
            ) : null}
          </Alert>
          {(reveal.canContinue ?? !reveal.bot) ? (
            <Button size="lg" className="w-full" onClick={onContinue} data-autofocus>
              Continuar
            </Button>
          ) : (
            <p className="flex items-center justify-center gap-2 text-sm font-semibold text-muted">
              <Spinner size="sm" /> A jogada segue em instantes...
            </p>
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
