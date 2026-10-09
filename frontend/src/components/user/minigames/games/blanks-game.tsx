import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { BlanksPuzzle } from '@/lib/minigames-api';
import type { GameProps } from './play-frame';

/** Complete o versículo: escolha uma lacuna e depois a palavra que cabe nela. */
export function BlanksGame({ puzzle, submit, finished }: GameProps<BlanksPuzzle>) {
  const slots = puzzle.parts.filter((part) => part.blank !== null).length;
  const [fills, setFills] = useState<Array<string | null>>(() => Array.from({ length: slots }, () => null));
  const [active, setActive] = useState<number | null>(0);
  const [sending, setSending] = useState(false);

  const used = new Set(fills.filter((fill): fill is string => fill !== null));
  const complete = fills.every((fill) => fill !== null);

  function place(word: string) {
    if (finished || used.has(word)) return;
    const target = active ?? fills.findIndex((fill) => fill === null);
    if (target < 0) return;
    const next = [...fills];
    next[target] = word;
    setFills(next);
    const empty = next.findIndex((fill) => fill === null);
    setActive(empty >= 0 ? empty : null);
  }

  function clear(slot: number) {
    if (finished) return;
    setFills((current) => current.map((fill, at) => (at === slot ? null : fill)));
    setActive(slot);
  }

  async function send() {
    setSending(true);
    await submit({ fills });
    setSending(false);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-muted">
        Complete o versículo de <b className="text-ink">{puzzle.reference}</b>. Há palavras a mais, de enfeite.
      </p>
      <p className="panel p-4 text-lg font-semibold leading-9 text-ink">
        {puzzle.parts.map((part, index) =>
          part.blank === null ? (
            <span key={index}>{part.text} </span>
          ) : (
            <span key={index}>
              {part.prefix}
              <button
                type="button"
                disabled={finished}
                onClick={() => (fills[part.blank!] ? clear(part.blank!) : setActive(part.blank))}
                aria-label={fills[part.blank] ? `Lacuna ${part.blank + 1}: ${fills[part.blank]}. Toque para tirar` : `Lacuna ${part.blank + 1} vazia`}
                className={cn(
                  'mx-0.5 inline-flex min-w-20 items-center justify-center rounded-lg border-b-4 px-2 align-middle font-display font-bold',
                  fills[part.blank] ? 'border-success bg-success/15 text-ink' : active === part.blank ? 'border-primary bg-primary/15 text-primary' : 'border-edge-strong bg-surface-3 text-muted',
                )}
              >
                {fills[part.blank] ?? '____'}
              </button>
              {part.suffix}{' '}
            </span>
          ),
        )}
      </p>
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Palavras">
        {puzzle.options.map((word) => (
          <button
            key={word}
            type="button"
            disabled={used.has(word) || finished}
            onClick={() => place(word)}
            className={cn('rounded-xl bg-surface-3 px-3 py-2 font-display text-base font-bold text-ink transition active:scale-95', used.has(word) && 'opacity-30')}
          >
            {word}
          </button>
        ))}
      </div>
      <Button className="w-full" loading={sending} disabled={!complete || finished} onClick={() => void send()}>
        Conferir
      </Button>
    </div>
  );
}
