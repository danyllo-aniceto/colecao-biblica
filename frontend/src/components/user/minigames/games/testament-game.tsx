import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { TestamentPuzzle } from '@/lib/minigames-api';
import type { GameProps } from './play-frame';

type Choice = 'OLD' | 'NEW';

/** Antigo ou Novo?: um item por vez, de que Testamento é? */
export function TestamentGame({ puzzle, submit, finished }: GameProps<TestamentPuzzle>) {
  const [choices, setChoices] = useState<Choice[]>([]);
  const [sending, setSending] = useState(false);
  const index = choices.length;

  async function pick(choice: Choice) {
    if (finished || sending || index >= puzzle.items.length) return;
    const next = [...choices, choice];
    setChoices(next);
    if (next.length === puzzle.items.length) {
      setSending(true);
      await submit({ choices: next });
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-muted">De que Testamento é cada livro ou personagem? Errar só 1 ainda vale a vitória.</p>
      <div className="flex justify-center gap-1" aria-label={`Item ${Math.min(index + 1, puzzle.items.length)} de ${puzzle.items.length}`}>
        {puzzle.items.map((_, at) => (
          <span key={at} className={cn('h-2 flex-1 rounded-full', at < index ? 'bg-primary' : at === index ? 'bg-primary/40' : 'bg-surface-3')} />
        ))}
      </div>
      <div className="panel flex min-h-36 items-center justify-center p-4 text-center">
        <p className="font-display text-3xl font-bold text-ink">{puzzle.items[Math.min(index, puzzle.items.length - 1)]}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button size="lg" variant="secondary" disabled={finished || sending} onClick={() => void pick('OLD')}>
          Antigo
        </Button>
        <Button size="lg" disabled={finished || sending} onClick={() => void pick('NEW')}>
          Novo
        </Button>
      </div>
    </div>
  );
}
