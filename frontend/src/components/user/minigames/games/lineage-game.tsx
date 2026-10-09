import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { LineagePuzzle } from '@/lib/minigames-api';
import type { GameProps } from './play-frame';

const COLORS = ['bg-primary/30', 'bg-success/30', 'bg-accent/40', 'bg-violet/30', 'bg-info/30'];

/** Árvore genealógica: ligue cada pai ao seu filho. */
export function LineageGame({ puzzle, submit, finished }: GameProps<LineagePuzzle>) {
  const [links, setLinks] = useState<Record<string, string>>({});
  const [father, setFather] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const colorOf = (name: string, side: 'father' | 'son') => {
    const index = side === 'father' ? Object.keys(links).indexOf(name) : Object.values(links).indexOf(name);
    return index >= 0 ? COLORS[index % COLORS.length] : '';
  };
  const done = Object.keys(links).length === puzzle.fathers.length;

  function pickFather(name: string) {
    if (finished) return;
    if (links[name]) {
      setLinks(({ [name]: _removed, ...rest }) => rest);
      return;
    }
    setFather(father === name ? null : name);
  }

  function pickSon(name: string) {
    if (finished) return;
    const owner = Object.entries(links).find(([, son]) => son === name)?.[0];
    if (owner) {
      setLinks(({ [owner]: _removed, ...rest }) => rest);
      return;
    }
    if (!father) return;
    setLinks((current) => ({ ...current, [father]: name }));
    setFather(null);
  }

  async function send() {
    setSending(true);
    await submit({ fathers: puzzle.fathers, links: puzzle.fathers.map((name) => links[name]) });
    setSending(false);
  }

  const cell = 'min-h-12 w-full rounded-xl px-2 py-2 font-display text-base font-bold text-ink transition active:scale-95';
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-muted">Cada nome da esquerda gerou um dos nomes da direita. Toque num pai e depois no filho dele. Toque numa ligação para desfazê-la.</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        <p className="text-center text-xs font-bold uppercase tracking-wider text-muted">Pai</p>
        <p className="text-center text-xs font-bold uppercase tracking-wider text-muted">Filho</p>
        {puzzle.fathers.map((name, index) => (
          <div key={`row-${index}`} className="contents">
            <button type="button" disabled={finished} onClick={() => pickFather(name)} className={cn(cell, colorOf(name, 'father') || 'bg-surface-3', father === name && 'ring-4 ring-primary')}>
              {name}
            </button>
            <button type="button" disabled={finished} onClick={() => pickSon(puzzle.sons[index])} className={cn(cell, colorOf(puzzle.sons[index], 'son') || 'bg-surface-3')}>
              {puzzle.sons[index]}
            </button>
          </div>
        ))}
      </div>
      <Button className="w-full" loading={sending} disabled={!done || finished} onClick={() => void send()}>
        Conferir
      </Button>
    </div>
  );
}
