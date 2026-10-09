import { useState } from 'react';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { actMiniGame, type AnagramPuzzle, type MiniGameResult } from '@/lib/minigames-api';
import type { GameProps } from './play-frame';

/** Anagrama: toque nas letras para montar o nome (3 tentativas). */
export function AnagramGame({ puzzle, runId, report, finished }: GameProps<AnagramPuzzle> & { report: (result: MiniGameResult) => void }) {
  const [picked, setPicked] = useState<number[]>([]);
  const [attemptsLeft, setAttemptsLeft] = useState(puzzle.attempts);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);

  const word = picked.map((index) => puzzle.letters[index]).join('');
  const full = picked.length === puzzle.length;

  async function check() {
    if (!full || busy || finished) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await actMiniGame(runId, { action: 'check', word });
      if (response.result) report(response.result);
      if (response.status === 'lost') setAnswer(response.answer ?? null);
      if (response.status === 'playing') {
        setAttemptsLeft(response.attemptsLeft ?? 0);
        setMessage('Ainda não é esse. Tente de novo!');
        setPicked([]);
      }
    } catch (reason) {
      setMessage(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="panel space-y-1 p-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Dica</p>
        <p className="text-sm font-semibold text-ink">{puzzle.hint}</p>
      </div>
      <p className="text-center text-sm font-bold text-muted">
        {attemptsLeft} {attemptsLeft === 1 ? 'tentativa' : 'tentativas'} restantes
      </p>
      <div className="flex flex-wrap justify-center gap-1.5" aria-label="Seu nome montado">
        {Array.from({ length: puzzle.length }, (_, slot) => (
          <button
            key={slot}
            type="button"
            disabled={finished || picked[slot] === undefined}
            onClick={() => setPicked((current) => current.filter((_, at) => at !== slot))}
            aria-label={picked[slot] === undefined ? `Espaço ${slot + 1} vazio` : `Tirar a letra ${puzzle.letters[picked[slot]]}`}
            className={cn('flex h-12 w-9 items-center justify-center rounded-lg border-b-4 bg-surface-3 font-display text-2xl font-bold text-ink', picked[slot] === undefined ? 'border-edge-strong' : 'border-primary')}
          >
            {picked[slot] === undefined ? '' : puzzle.letters[picked[slot]]}
          </button>
        ))}
      </div>
      {message ? <Alert tone="danger">{message}</Alert> : null}
      {answer ? <p className="text-center font-display font-bold text-ink">Era <span className="text-danger">{answer}</span></p> : null}
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Letras">
        {puzzle.letters.map((letter, index) => (
          <button
            key={index}
            type="button"
            disabled={picked.includes(index) || finished}
            onClick={() => setPicked((current) => [...current, index])}
            className={cn('h-12 w-10 rounded-xl bg-surface-3 font-display text-xl font-bold text-ink transition active:scale-95', picked.includes(index) && 'opacity-30')}
          >
            {letter}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" disabled={picked.length === 0 || finished} onClick={() => setPicked([])}>
          Limpar
        </Button>
        <Button className="flex-1" loading={busy} disabled={!full || finished} onClick={() => void check()}>
          Conferir
        </Button>
      </div>
    </div>
  );
}
