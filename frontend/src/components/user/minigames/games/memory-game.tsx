import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import type { MemoryPuzzle } from '@/lib/minigames-api';
import type { GameProps } from './play-frame';

/** Memória: ache os pares (cenário e referência bíblica). */
export function MemoryGame({ puzzle, submit, finished }: GameProps<MemoryPuzzle>) {
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [flips, setFlips] = useState<number[]>([]);
  const [locked, setLocked] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function tap(index: number) {
    if (finished || locked || matched.has(index) || open.includes(index)) return;
    const next = [...open, index];
    setOpen(next);
    if (next.length < 2) return;
    const log = [...flips, next[0], next[1]];
    setFlips(log);
    if (puzzle.cards[next[0]].pair === puzzle.cards[next[1]].pair) {
      const all = new Set([...matched, next[0], next[1]]);
      setMatched(all);
      setOpen([]);
      if (all.size === puzzle.cards.length) void submit({ flips: log });
      return;
    }
    setLocked(true);
    timer.current = window.setTimeout(() => {
      setOpen([]);
      setLocked(false);
    }, 900);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-muted">Una cada cenário à sua referência bíblica. Menos tentativas, mais pontos.</p>
      <div className="grid grid-cols-3 gap-2">
        {puzzle.cards.map((card, index) => {
          const faceUp = open.includes(index) || matched.has(index);
          return (
            <button
              key={index}
              type="button"
              disabled={finished}
              onClick={() => tap(index)}
              aria-label={faceUp ? card.text : `Carta ${index + 1}, virada para baixo`}
              className={cn(
                'flex min-h-20 items-center justify-center rounded-xl border-2 p-1.5 text-center font-display text-sm font-bold leading-tight transition active:scale-95',
                matched.has(index) ? 'border-success bg-success/15 text-success' : faceUp ? 'border-primary bg-surface text-ink' : 'border-transparent bg-gradient-to-br from-primary to-accent text-on-primary',
              )}
            >
              {faceUp ? card.text : '?'}
            </button>
          );
        })}
      </div>
      <p className="text-center text-sm font-bold text-muted">{flips.length / 2} {flips.length / 2 === 1 ? 'tentativa' : 'tentativas'}</p>
    </div>
  );
}
