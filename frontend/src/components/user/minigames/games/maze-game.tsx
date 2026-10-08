import { useCallback, useEffect, useState } from 'react';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import { cn } from '@/lib/cn';
import type { MazePuzzle } from '@/lib/minigames-api';
import type { GameProps } from './play-frame';

const OPEN = { U: 1, R: 2, D: 4, L: 8 } as const;
type Move = keyof typeof OPEN;
const STEP: Record<Move, [number, number]> = { U: [-1, 0], R: [0, 1], D: [1, 0], L: [0, -1] };

/** Labirinto: leve o peão da entrada (em cima, à esquerda) até a bandeira. Setas na tela ou do teclado. */
export function MazeGame({ puzzle, submit, finished }: GameProps<MazePuzzle>) {
  const { width, height, cells } = puzzle;
  const [at, setAt] = useState(0);
  const [moves, setMoves] = useState('');
  const goal = width * height - 1;

  const move = useCallback(
    (direction: Move) => {
      if (finished || at === goal) return;
      if (!(cells[at] & OPEN[direction])) return;
      const [dr, dc] = STEP[direction];
      const next = (Math.floor(at / width) + dr) * width + ((at % width) + dc);
      const log = moves + direction;
      setAt(next);
      setMoves(log);
      if (next === goal) void submit({ moves: log });
    },
    [at, cells, finished, goal, moves, submit, width],
  );

  useEffect(() => {
    const keys: Record<string, Move> = { ArrowUp: 'U', ArrowRight: 'R', ArrowDown: 'D', ArrowLeft: 'L' };
    const onKey = (event: KeyboardEvent) => {
      const direction = keys[event.key];
      if (!direction) return;
      event.preventDefault();
      move(direction);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move]);

  const pad = 'flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-3 text-ink transition active:scale-95 disabled:opacity-40';
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-muted">Leve o 🧭 até a 🏁 pelo caminho mais curto que achar. Cada passo a mais custa pontos.</p>
      <div className="mx-auto grid max-w-[15rem] gap-0 rounded-xl border-2 border-edge-strong bg-surface-3 p-1" style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }} role="img" aria-label="Labirinto">
        {cells.map((bits, index) => (
          <div
            key={index}
            className={cn('relative flex aspect-square items-center justify-center text-base leading-none', index === at && 'bg-primary/25')}
            style={{
              borderTop: bits & OPEN.U ? '2px solid transparent' : '2px solid var(--edge-strong)',
              borderRight: bits & OPEN.R ? '2px solid transparent' : '2px solid var(--edge-strong)',
              borderBottom: bits & OPEN.D ? '2px solid transparent' : '2px solid var(--edge-strong)',
              borderLeft: bits & OPEN.L ? '2px solid transparent' : '2px solid var(--edge-strong)',
            }}
          >
            {index === at ? '🧭' : index === goal ? '🏁' : ''}
          </div>
        ))}
      </div>
      <div className="mx-auto grid w-fit grid-cols-3 gap-1.5" role="group" aria-label="Direções">
        <span />
        <button type="button" className={pad} disabled={finished} onClick={() => move('U')} aria-label="Subir">
          <ArrowUpwardRoundedIcon />
        </button>
        <span />
        <button type="button" className={pad} disabled={finished} onClick={() => move('L')} aria-label="Ir para a esquerda">
          <ArrowBackRoundedIcon />
        </button>
        <button type="button" className={pad} disabled={finished} onClick={() => move('D')} aria-label="Descer">
          <ArrowDownwardRoundedIcon />
        </button>
        <button type="button" className={pad} disabled={finished} onClick={() => move('R')} aria-label="Ir para a direita">
          <ArrowForwardRoundedIcon />
        </button>
      </div>
      <p className="text-center text-sm font-bold text-muted">{moves.length} {moves.length === 1 ? 'passo' : 'passos'}</p>
    </div>
  );
}
