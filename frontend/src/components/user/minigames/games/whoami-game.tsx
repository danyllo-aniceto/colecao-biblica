import { useState } from 'react';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { errorMessage } from '@/components/ui/toast';
import { actMiniGame, type MiniGameResult, type WhoAmIPuzzle } from '@/lib/minigames-api';
import type { GameProps } from './play-frame';

/** Quem sou eu?: peça mais dicas (cada uma custa pontos) e escolha o nome. */
export function WhoAmIGame({ puzzle, runId, report, finished }: GameProps<WhoAmIPuzzle> & { report: (result: MiniGameResult) => void }) {
  const [clues, setClues] = useState([puzzle.clue]);
  const [total, setTotal] = useState(puzzle.total);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);

  async function hint() {
    setBusy(true);
    setError(null);
    try {
      const response = await actMiniGame(runId, { action: 'hint' });
      if (response.clue) setClues((current) => [...current, response.clue!]);
      if (response.total) setTotal(response.total);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  async function choose(choice: number) {
    if (busy || finished) return;
    setBusy(true);
    setError(null);
    try {
      const response = await actMiniGame(runId, { action: 'answer', choice });
      if (response.status === 'lost') setAnswer(response.answer ?? null);
      if (response.result) report(response.result);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-muted">Descubra quem eu sou. Cada dica a mais custa pontos, e só há uma chance de responder.</p>
      <ol className="space-y-2" aria-label="Dicas">
        {clues.map((clue, index) => (
          <li key={index} className="panel animate-pop-in flex gap-3 p-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-on-primary">{index + 1}</span>
            <span className="text-sm font-semibold text-ink">{clue}</span>
          </li>
        ))}
      </ol>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {answer ? <p className="text-center font-display font-bold text-ink">Era <span className="text-danger">{answer}</span></p> : null}
      {clues.length < total && !finished ? (
        <Button variant="secondary" className="w-full" loading={busy} onClick={() => void hint()}>
          Mais uma dica ({clues.length}/{total})
        </Button>
      ) : null}
      <div className="grid gap-2" role="group" aria-label="Quem sou eu?">
        {puzzle.options.map((name, index) => (
          <Button key={name} size="lg" disabled={busy || finished} onClick={() => void choose(index)}>
            {name}
          </Button>
        ))}
      </div>
    </div>
  );
}
