import { useState } from 'react';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import { Alert } from '@/components/game/game-ui';
import { errorMessage } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { guessHangman, type HangmanGuess, type HangmanPuzzle, type MiniGameResult } from '@/lib/minigames-api';
import { baseLetters, type GameProps } from './play-frame';

const KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/** Forca: a palavra fica no servidor; cada letra é conferida lá. */
export function HangmanGame({ puzzle, runId, report, finished }: GameProps<HangmanPuzzle> & { report: (result: MiniGameResult) => void }) {
  const [state, setState] = useState<Pick<HangmanGuess, 'pattern' | 'errors' | 'maxErrors'> & { word?: string; status: HangmanGuess['status'] }>({ ...puzzle, status: 'playing' });
  const [tried, setTried] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hits = new Set(state.pattern.flatMap((char) => (char ? [baseLetters(char)] : [])));

  async function guess(letter: string) {
    if (busy || finished || tried.includes(letter)) return;
    setBusy(true);
    setError(null);
    setTried((current) => [...current, letter]);
    try {
      const response = await guessHangman(runId, letter);
      setState({ pattern: response.pattern, errors: response.errors, maxErrors: response.maxErrors, word: response.word, status: response.status });
      if (response.result) report(response.result);
    } catch (reason) {
      setError(errorMessage(reason));
      setTried((current) => current.filter((item) => item !== letter));
    } finally {
      setBusy(false);
    }
  }

  const over = state.status !== 'playing';
  return (
    <div className="space-y-4">
      <div className="panel space-y-1 p-3">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Dica{puzzle.testament ? ` · ${puzzle.testament}` : ''}</p>
        <p className="text-sm font-semibold text-ink">{puzzle.hint}</p>
      </div>
      <div className="flex justify-center gap-1" aria-label={`${state.maxErrors - state.errors} vidas restantes`}>
        {Array.from({ length: state.maxErrors }, (_, index) => (
          <FavoriteRoundedIcon key={index} sx={{ fontSize: 26 }} className={index < state.maxErrors - state.errors ? 'text-danger' : 'text-edge-strong'} />
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-1.5" aria-label="Palavra secreta">
        {state.pattern.map((char, index) =>
          char === ' ' || char === '-' ? (
            <span key={index} className="w-3" />
          ) : (
            <span key={index} className={cn('flex h-11 w-8 items-center justify-center rounded-lg border-b-4 bg-surface-3 font-display text-xl font-bold uppercase text-ink', char ? 'border-success' : 'border-edge-strong')}>
              {char ?? ''}
            </span>
          ),
        )}
      </div>
      {state.status === 'lost' && state.word ? (
        <p className="text-center font-display font-bold text-ink">
          Era <span className="text-danger">{state.word}</span>
        </p>
      ) : null}
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="Letras">
        {KEYS.map((letter) => {
          const used = tried.includes(letter);
          return (
            <button
              key={letter}
              type="button"
              disabled={used || over || finished}
              onClick={() => void guess(letter)}
              className={cn(
                'h-10 rounded-lg font-display text-base font-bold transition active:scale-95',
                used ? (hits.has(letter) ? 'bg-success/25 text-success' : 'bg-danger/20 text-danger') : 'bg-surface-3 text-ink hover:bg-primary/20',
              )}
            >
              {letter}
            </button>
          );
        })}
      </div>
    </div>
  );
}
