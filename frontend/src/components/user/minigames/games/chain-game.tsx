import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ChainPuzzle } from '@/lib/minigames-api';
import type { GameProps } from './play-frame';

/** Interconexão: ligue o personagem ou lugar de partida ao de chegada por uma corrente de relações. */
export function ChainGame({ puzzle, submit, finished }: GameProps<ChainPuzzle>) {
  const [path, setPath] = useState([puzzle.from]);
  const here = path[path.length - 1];
  const arrived = here === puzzle.to;

  const options = puzzle.edges.flatMap(([from, to, forward, backward]) => (from === here ? [{ to, phrase: `${here} ${forward}` }] : to === here ? [{ to: from, phrase: `${here} ${backward}` }] : []));

  function go(next: string) {
    if (finished || arrived) return;
    const list = [...path, next];
    setPath(list);
    if (next === puzzle.to) void submit({ path: list });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-muted">
        Ligue <b className="text-ink">{puzzle.from}</b> a <b className="text-ink">{puzzle.to}</b> escolhendo, a cada passo, uma relação. Menos elos, mais pontos.
      </p>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm" aria-label="Seu caminho">
        {path.map((node, index) => (
          <li key={index} className="flex items-center gap-1.5">
            {index > 0 ? <span className="text-muted">→</span> : null}
            <span className={`rounded-full px-3 py-1 font-display font-bold ${index === path.length - 1 ? 'bg-primary text-on-primary' : 'bg-surface-3 text-ink'}`}>{node}</span>
          </li>
        ))}
        {!arrived ? <li className="text-muted">→ 🏁 {puzzle.to}</li> : null}
      </ol>
      {!arrived ? (
        <ul className="grid gap-2" aria-label={`Relações de ${here}`}>
          {options.map((option) => (
            <li key={`${option.to}-${option.phrase}`}>
              <button type="button" disabled={finished} onClick={() => go(option.to)} className="flex w-full flex-col rounded-xl bg-surface-3 px-3 py-2.5 text-left transition active:scale-[0.98]">
                <span className="text-xs font-semibold text-muted">{option.phrase}</span>
                <span className="font-display text-base font-bold text-ink">{option.to}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Button variant="secondary" className="w-full" disabled={path.length < 2 || finished || arrived} onClick={() => setPath((list) => list.slice(0, -1))}>
        Voltar um passo
      </Button>
    </div>
  );
}
