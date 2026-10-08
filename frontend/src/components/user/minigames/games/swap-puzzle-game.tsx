import { useState } from 'react';
import { cn } from '@/lib/cn';
import type { SwapPuzzle } from '@/lib/minigames-api';
import type { GameProps } from './play-frame';

/** Quebra-cabeça: toque em duas peças para trocá-las de lugar até a imagem ficar certa. */
export function SwapPuzzleGame({ puzzle, submit, finished }: GameProps<SwapPuzzle>) {
  const [order, setOrder] = useState(puzzle.order);
  const [picked, setPicked] = useState<number | null>(null);
  const [swaps, setSwaps] = useState<Array<[number, number]>>([]);
  const side = puzzle.side;

  function tap(position: number) {
    if (finished) return;
    if (picked === null) {
      setPicked(position);
      return;
    }
    if (picked === position) {
      setPicked(null);
      return;
    }
    const next = [...order];
    [next[picked], next[position]] = [next[position], next[picked]];
    const log: Array<[number, number]> = [...swaps, [picked, position]];
    setOrder(next);
    setSwaps(log);
    setPicked(null);
    if (next.every((piece, index) => piece === index)) void submit({ swaps: log });
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-muted">Toque em uma peça e depois em outra para trocar. Monte a imagem{puzzle.imageUrl ? ` de ${puzzle.title}` : ' na ordem dos números'}. Menos trocas, mais pontos.</p>
      <div className="mx-auto grid max-w-sm gap-1 rounded-2xl bg-surface-3 p-1.5" style={{ gridTemplateColumns: `repeat(${side}, minmax(0, 1fr))` }}>
        {order.map((piece, position) => {
          const row = Math.floor(piece / side);
          const col = piece % side;
          return (
            <button
              key={position}
              type="button"
              disabled={finished}
              onClick={() => tap(position)}
              aria-label={`Peça ${piece + 1} na posição ${position + 1}`}
              className={cn('relative aspect-square overflow-hidden rounded-lg bg-gradient-to-br from-primary to-accent transition active:scale-95', picked === position && 'ring-4 ring-primary')}
              style={
                puzzle.imageUrl
                  ? { backgroundImage: `url(${puzzle.imageUrl})`, backgroundSize: `${side * 100}% ${side * 100}%`, backgroundPosition: `${(col / (side - 1)) * 100}% ${(row / (side - 1)) * 100}%` }
                  : undefined
              }
            >
              {puzzle.imageUrl ? null : <span className="font-display text-3xl font-bold text-on-primary">{piece + 1}</span>}
              {order[position] === position ? <span className="absolute inset-0 rounded-lg ring-2 ring-success/70" /> : null}
            </button>
          );
        })}
      </div>
      <p className="text-center text-sm font-bold text-muted">{swaps.length} {swaps.length === 1 ? 'troca' : 'trocas'}</p>
    </div>
  );
}
