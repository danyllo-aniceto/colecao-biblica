import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { BlitzPuzzle } from '@/lib/minigames-api';
import type { GameProps } from './play-frame';

/** Relâmpago: a afirmação é verdadeira ou falsa? */
export function BlitzGame({ puzzle, submit, finished }: GameProps<BlitzPuzzle>) {
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [sending, setSending] = useState(false);
  const total = puzzle.statements.length;
  const index = answers.length;
  const statement = puzzle.statements[Math.min(index, total - 1)];

  async function pick(value: boolean) {
    if (finished || sending || index >= total) return;
    const next = [...answers, value];
    setAnswers(next);
    if (next.length === total) {
      setSending(true);
      await submit({ answers: next });
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-muted">A resposta dada para a pergunta está certa? Responda depressa: o tempo vale pontos.</p>
      <div className="flex justify-center gap-1" aria-label={`Afirmação ${Math.min(index + 1, total)} de ${total}`}>
        {puzzle.statements.map((_, at) => (
          <span key={at} className={cn('h-2 flex-1 rounded-full', at < index ? 'bg-primary' : at === index ? 'bg-primary/40' : 'bg-surface-3')} />
        ))}
      </div>
      <div className="panel space-y-3 p-4">
        <p className="font-display text-lg font-bold text-ink">{statement.question}</p>
        <p className="rounded-xl bg-surface-3 p-3 text-center font-display text-xl font-bold text-primary-strong dark:text-primary">{statement.answer}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button size="lg" variant="secondary" disabled={finished || sending} onClick={() => void pick(false)}>
          Falso
        </Button>
        <Button size="lg" disabled={finished || sending} onClick={() => void pick(true)}>
          Verdadeiro
        </Button>
      </div>
    </div>
  );
}
