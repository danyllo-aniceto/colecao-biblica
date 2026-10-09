import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { BooksPuzzle } from '@/lib/minigames-api';
import type { GameProps } from './play-frame';

/** Livros em ordem: toque nos livros na ordem em que aparecem na Bíblia (do primeiro ao último). */
export function BooksGame({ puzzle, submit, finished }: GameProps<BooksPuzzle>) {
  const [order, setOrder] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    await submit({ order });
    setSending(false);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-muted">Toque nos livros na ordem em que aparecem na Bíblia, do primeiro ao último. Toque num livro já escolhido para tirá-lo.</p>
      <ol className="panel min-h-20 space-y-1.5 p-3" aria-label="Sua ordem">
        {order.length === 0 ? <li className="text-sm font-semibold text-muted">Escolha o primeiro livro...</li> : null}
        {order.map((book, index) => (
          <li key={book}>
            <button type="button" disabled={finished} onClick={() => setOrder((current) => current.filter((item) => item !== book))} className="flex w-full items-center gap-3 rounded-xl bg-surface-3 px-3 py-2 text-left font-display font-bold text-ink">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-on-primary">{index + 1}</span>
              {book}
            </button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Livros">
        {puzzle.books.map((book) => (
          <button
            key={book}
            type="button"
            disabled={order.includes(book) || finished}
            onClick={() => setOrder((current) => [...current, book])}
            className={cn('rounded-xl bg-surface-3 px-4 py-2.5 font-display text-base font-bold text-ink transition active:scale-95', order.includes(book) && 'opacity-30')}
          >
            {book}
          </button>
        ))}
      </div>
      <Button className="w-full" loading={sending} disabled={order.length !== puzzle.books.length || finished} onClick={() => void send()}>
        Conferir
      </Button>
    </div>
  );
}
