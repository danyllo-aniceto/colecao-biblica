import { useState } from 'react';
import { cn } from '@/lib/cn';
import type { VersePuzzle } from '@/lib/minigames-api';
import { baseLetters, type GameProps } from './play-frame';

/** Versículo em pedaços: toque nas palavras na ordem certa. */
export function VerseGame({ puzzle, submit, finished }: GameProps<VersePuzzle>) {
  const [used, setUsed] = useState<number[]>([]);
  const [taps, setTaps] = useState<number[]>([]);
  const [errors, setErrors] = useState(0);
  const [shake, setShake] = useState<number | null>(null);

  function tap(index: number) {
    if (finished || used.includes(index)) return;
    const log = [...taps, index];
    setTaps(log);
    const expected = puzzle.words[used.length];
    if (baseLetters(puzzle.chips[index]) === baseLetters(expected)) {
      const next = [...used, index];
      setUsed(next);
      if (next.length === puzzle.words.length) void submit({ taps: log });
      return;
    }
    setErrors((count) => count + 1);
    setShake(index);
    window.setTimeout(() => setShake(null), 400);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-muted">
        Monte o versículo de <b className="text-ink">{puzzle.reference}</b> tocando nas palavras na ordem certa. Cada erro custa pontos.
      </p>
      <div className="panel min-h-24 p-3 text-ink" aria-live="polite">
        {used.length === 0 ? <span className="text-sm font-semibold text-muted">Toque na primeira palavra...</span> : <span className="font-display text-lg font-bold">{used.map((index) => puzzle.chips[index]).join(' ')}</span>}
      </div>
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Palavras">
        {puzzle.chips.map((chip, index) => (
          <button
            key={index}
            type="button"
            disabled={used.includes(index) || finished}
            onClick={() => tap(index)}
            className={cn(
              'rounded-xl px-3 py-2 font-display text-base font-bold transition active:scale-95',
              used.includes(index) ? 'bg-success/15 text-success opacity-40' : 'bg-surface-3 text-ink hover:bg-primary/20',
              shake === index && 'animate-shake bg-danger/20',
            )}
          >
            {chip}
          </button>
        ))}
      </div>
      <p className="text-center text-sm font-bold text-muted">{errors} {errors === 1 ? 'erro' : 'erros'}</p>
    </div>
  );
}
