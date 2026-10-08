import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { WordSearchPuzzle } from '@/lib/minigames-api';
import type { GameProps } from './play-frame';

type Found = { word: string; from: [number, number]; to: [number, number] };

/** Cada palavra achada ganha uma cor. */
const COLORS = ['bg-primary/40', 'bg-success/40', 'bg-accent/50', 'bg-violet/40', 'bg-info/40', 'bg-danger/30'];

function lineCells(from: [number, number], to: [number, number]): Array<[number, number]> | null {
  const dr = to[0] - from[0];
  const dc = to[1] - from[1];
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;
  const length = Math.max(Math.abs(dr), Math.abs(dc)) + 1;
  return Array.from({ length }, (_, index) => [from[0] + Math.sign(dr) * index, from[1] + Math.sign(dc) * index] as [number, number]);
}

/** Caça-palavras: toque na primeira e na última letra da palavra. */
export function WordSearchGame({ puzzle, submit, finished }: GameProps<WordSearchPuzzle>) {
  const [start, setStart] = useState<[number, number] | null>(null);
  const [found, setFound] = useState<Found[]>([]);
  const [miss, setMiss] = useState(false);
  const [sending, setSending] = useState(false);

  const colorAt = (r: number, c: number) => {
    const index = found.findIndex((entry) => lineCells(entry.from, entry.to)?.some(([fr, fc]) => fr === r && fc === c));
    return index >= 0 ? COLORS[index % COLORS.length] : '';
  };

  async function send(list: Found[]) {
    setSending(true);
    await submit({ found: list });
    setSending(false);
  }

  function tap(r: number, c: number) {
    if (finished || sending) return;
    if (!start) {
      setStart([r, c]);
      setMiss(false);
      return;
    }
    const cells = lineCells(start, [r, c]);
    setStart(null);
    const text = cells ? cells.map(([cr, cc]) => puzzle.grid[cr][cc]).join('') : '';
    const word = [text, [...text].reverse().join('')].find((candidate) => puzzle.words.includes(candidate) && !found.some((entry) => entry.word === candidate));
    if (!cells || !word) {
      setMiss(true);
      return;
    }
    setMiss(false);
    const next = [...found, { word, from: start, to: [r, c] as [number, number] }];
    setFound(next);
    if (next.length === puzzle.words.length) void send(next);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-muted">Toque na primeira e na última letra de cada nome. Vale em qualquer direção, inclusive de trás para frente.</p>
      <div className="grid gap-0.5 rounded-2xl bg-surface-3 p-1.5" style={{ gridTemplateColumns: `repeat(${puzzle.size}, minmax(0, 1fr))` }} role="grid" aria-label="Grade de letras">
        {puzzle.grid.flatMap((row, r) =>
          [...row].map((letter, c) => (
            <button
              key={`${r}-${c}`}
              type="button"
              disabled={finished}
              onClick={() => tap(r, c)}
              aria-label={`Letra ${letter}, linha ${r + 1}, coluna ${c + 1}`}
              className={cn(
                'flex aspect-square items-center justify-center rounded-md bg-surface font-display text-base font-bold text-ink transition active:scale-95',
                colorAt(r, c),
                start && start[0] === r && start[1] === c && 'ring-2 ring-primary',
              )}
            >
              {letter}
            </button>
          )),
        )}
      </div>
      {miss ? <p className="text-center text-sm font-bold text-danger">Essa seleção não forma nenhum dos nomes.</p> : null}
      <ul className="flex flex-wrap justify-center gap-2" aria-label="Nomes para achar">
        {puzzle.words.map((word) => {
          const done = found.some((entry) => entry.word === word);
          return (
            <li key={word} className={cn('rounded-full px-3 py-1 font-display text-sm font-bold', done ? 'bg-success/20 text-success line-through' : 'bg-surface-3 text-ink')}>
              {word}
            </li>
          );
        })}
      </ul>
      {!finished ? (
        <Button variant="ghost" size="sm" loading={sending} onClick={() => void send(found)}>
          Desistir e ver minha pontuação
        </Button>
      ) : null}
    </div>
  );
}
