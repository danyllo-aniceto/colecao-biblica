import { useState } from 'react';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { TimelinePuzzle } from '@/lib/minigames-api';
import type { GameProps } from './play-frame';

/** Linha do tempo: leve os acontecimentos da mão para a linha, do mais antigo (em cima) ao mais recente (embaixo). */
export function TimelineGame({ puzzle, submit, finished }: GameProps<TimelinePuzzle>) {
  const [placed, setPlaced] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const byId = new Map(puzzle.items.map((item) => [item.id, item]));
  const hand = puzzle.items.filter((item) => !placed.includes(item.id));

  const move = (index: number, delta: number) =>
    setPlaced((current) => {
      const next = [...current];
      [next[index], next[index + delta]] = [next[index + delta], next[index]];
      return next;
    });

  async function send() {
    setSending(true);
    await submit({ order: placed });
    setSending(false);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-muted">Toque nos acontecimentos para levá-los à linha. Do mais antigo (em cima) ao mais recente (embaixo). Use as setas para ajustar.</p>
      <ol className="panel space-y-1.5 p-3" aria-label="Linha do tempo">
        <li className="text-xs font-bold uppercase tracking-wider text-muted">⬆ Mais antigo</li>
        {placed.length === 0 ? <li className="py-2 text-sm font-semibold text-muted">A linha está vazia.</li> : null}
        {placed.map((id, index) => {
          const item = byId.get(id)!;
          return (
            <li key={id} className="flex items-center gap-2 rounded-xl bg-surface-3 p-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-on-primary">{index + 1}</span>
              <span className="min-w-0 flex-1 font-display text-sm font-bold text-ink">
                {item.emoji} {item.label}
              </span>
              <button type="button" disabled={finished || index === 0} onClick={() => move(index, -1)} aria-label={`Subir ${item.label}`} className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-ink disabled:opacity-30">
                <ArrowUpwardRoundedIcon sx={{ fontSize: 18 }} />
              </button>
              <button type="button" disabled={finished || index === placed.length - 1} onClick={() => move(index, 1)} aria-label={`Descer ${item.label}`} className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-ink disabled:opacity-30">
                <ArrowDownwardRoundedIcon sx={{ fontSize: 18 }} />
              </button>
              <button type="button" disabled={finished} onClick={() => setPlaced((current) => current.filter((value) => value !== id))} aria-label={`Tirar ${item.label}`} className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-muted">
                <CloseRoundedIcon sx={{ fontSize: 18 }} />
              </button>
            </li>
          );
        })}
        <li className="text-xs font-bold uppercase tracking-wider text-muted">⬇ Mais recente</li>
      </ol>
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Sua mão">
        {hand.map((item) => (
          <button key={item.id} type="button" disabled={finished} onClick={() => setPlaced((current) => [...current, item.id])} className={cn('rounded-xl bg-surface-3 px-3 py-2 text-left font-display text-sm font-bold text-ink transition active:scale-95')}>
            {item.emoji} {item.label}
          </button>
        ))}
      </div>
      <Button className="w-full" loading={sending} disabled={placed.length !== puzzle.items.length || finished} onClick={() => void send()}>
        Conferir
      </Button>
    </div>
  );
}
