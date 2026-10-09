import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { CrosswordPuzzle } from '@/lib/minigames-api';
import { baseLetters, type GameProps } from './play-frame';

/** Palavras cruzadas: toque numa casa e digite; as dicas estão embaixo da grade. */
export function CrosswordGame({ puzzle, submit, finished }: GameProps<CrosswordPuzzle>) {
  const [cells, setCells] = useState<string[][]>(() => puzzle.open.map((row) => row.map(() => '')));
  const [sending, setSending] = useState(false);
  const refs = useRef<Record<string, HTMLInputElement | null>>({});
  const numbers = new Map<string, number>();
  for (const word of puzzle.words) numbers.set(`${word.row},${word.col}`, word.number);
  const filled = cells.every((row, r) => row.every((letter, c) => puzzle.open[r][c] === 0 || letter !== ''));

  function type(r: number, c: number, value: string) {
    const letter = baseLetters(value).slice(-1);
    setCells((current) => current.map((row, rr) => row.map((old, cc) => (rr === r && cc === c ? letter : old))));
    if (!letter) return;
    // Avança para a próxima casa livre (na horizontal, depois na vertical).
    const next = puzzle.open[r][c + 1] ? `${r},${c + 1}` : puzzle.open[r + 1]?.[c] ? `${r + 1},${c}` : null;
    if (next) refs.current[next]?.focus();
  }

  async function send() {
    setSending(true);
    await submit({ rows: cells.map((row, r) => row.map((letter, c) => (puzzle.open[r][c] === 0 ? '.' : letter || ' ')).join('')) });
    setSending(false);
  }

  const across = puzzle.words.filter((word) => word.across);
  const down = puzzle.words.filter((word) => !word.across);
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-muted">Preencha a grade com os nomes de personagens e lugares. Cada dica tem o nome escondido por traços.</p>
      <div className="mx-auto grid w-fit gap-0.5 rounded-xl bg-edge-strong p-0.5" style={{ gridTemplateColumns: `repeat(${puzzle.cols}, 2.1rem)` }} role="grid" aria-label="Grade de palavras cruzadas">
        {puzzle.open.flatMap((row, r) =>
          row.map((open, c) =>
            open === 0 ? (
              <div key={`${r}-${c}`} className="h-[2.1rem] bg-ink/80" />
            ) : (
              <div key={`${r}-${c}`} className="relative h-[2.1rem] bg-surface">
                {numbers.has(`${r},${c}`) ? <span className="pointer-events-none absolute left-0.5 top-0 text-[9px] font-bold leading-3 text-muted">{numbers.get(`${r},${c}`)}</span> : null}
                <input
                  ref={(element) => {
                    refs.current[`${r},${c}`] = element;
                  }}
                  value={cells[r][c]}
                  disabled={finished}
                  onChange={(event) => type(r, c, event.target.value)}
                  onFocus={(event) => event.currentTarget.select()}
                  maxLength={2}
                  autoComplete="off"
                  autoCapitalize="characters"
                  aria-label={`Linha ${r + 1}, coluna ${c + 1}`}
                  className={cn('h-full w-full bg-transparent pt-1.5 text-center font-display text-lg font-bold uppercase text-ink outline-none focus:bg-primary/20')}
                />
              </div>
            ),
          ),
        )}
      </div>
      {[
        { title: 'Horizontais', list: across },
        { title: 'Verticais', list: down },
      ].map((group) => (
        <section key={group.title} className="panel space-y-1.5 p-3">
          <h4 className="font-display font-bold text-ink">{group.title}</h4>
          <ul className="space-y-1 text-sm font-semibold text-ink">
            {group.list.map((word) => (
              <li key={`${word.number}-${word.across}`}>
                <b>{word.number}.</b> {word.clue} <span className="text-muted">({word.length})</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <Button className="w-full" loading={sending} disabled={!filled || finished} onClick={() => void send()}>
        Conferir
      </Button>
    </div>
  );
}
