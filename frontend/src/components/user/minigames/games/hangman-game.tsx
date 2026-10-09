import { useCallback, useEffect, useMemo, useState } from 'react';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { HangmanEnd, HangmanEvent, HangmanPuzzle, MiniGameResult } from '@/lib/minigames-api';
import { playSfx } from '@/lib/sound/sfx';
import { baseLetters, type GameProps, type SetupRender } from './play-frame';
import { CountField, LEVEL_SCALE, LevelField, RoundDots, SetupShell, TimerField, TimeBar, TurnFeedback, TurnHeader, readStored, useTurnAct, useTurnClock, writeStored, type Level } from './turn-kit';

const KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

// ---------- Tela de preparo ----------

const LEVEL_TEXT: Record<Level, string> = {
  facil: 'Palavras de 3 a 6 letras · 8 vidas · 2 dicas de letra · retrato borrado que clareia a cada acerto',
  medio: 'Palavras de 5 a 9 letras · 6 vidas · 2 dicas de letra · retrato borrado que clareia a cada acerto',
  dificil: 'Palavras de 7 a 14 letras · 5 vidas · 1 dica de letra · sem retrato',
};
const ROUNDS = ['1', '3', '5'] as const;
const TIMES = ['30', '45', '60', '90', '120'] as const;
const KEY = 'forca-escolhas';
type Choice = { level: Level; rounds: string; timed: boolean; time: string };
const FALLBACK: Choice = { level: 'medio', rounds: '3', timed: false, time: '60' };

/** Antes de começar: dificuldade, quantas palavras (turnos) e tempo por palavra opcional. */
export const hangmanSetup: SetupRender = ({ onStart }) => <HangmanSetup onStart={onStart} />;

function HangmanSetup({ onStart }: { onStart: (options: object) => void }) {
  const [choice, setChoice] = useState<Choice>(() =>
    readStored(KEY, FALLBACK, (saved) => ({
      level: saved.level && saved.level in LEVEL_SCALE ? saved.level : FALLBACK.level,
      rounds: ROUNDS.includes(saved.rounds as never) ? (saved.rounds as string) : FALLBACK.rounds,
      timed: typeof saved.timed === 'boolean' ? saved.timed : FALLBACK.timed,
      time: TIMES.includes(saved.time as never) ? (saved.time as string) : FALLBACK.time,
    })),
  );
  const update = (patch: Partial<Choice>) => setChoice((current) => ({ ...current, ...patch }));
  return (
    <SetupShell
      intro="Descubra o personagem ou o lugar letra por letra. Cada letra errada custa uma vida."
      tips={[`🎯 Pontuação máxima nesta escolha: ${Math.round(1000 * LEVEL_SCALE[choice.level]).toLocaleString('pt-BR')} pontos.`, '❤️ Quanto mais vidas sobrarem e mais rápido, mais pontos.', '💡 A dica de letra revela uma letra, mas desconta pontos.', '⌨️ No computador dá para digitar as letras.']}
      onStart={() => {
        writeStored(KEY, choice);
        onStart({ difficulty: choice.level, rounds: Number(choice.rounds), time: choice.timed ? Number(choice.time) : null });
      }}
    >
      <LevelField value={choice.level} onChange={(level) => update({ level })} texts={LEVEL_TEXT} />
      <CountField label="Quantas palavras (turnos)" value={choice.rounds} onChange={(rounds) => update({ rounds })} options={ROUNDS} />
      <TimerField label="Contar o tempo por palavra" timed={choice.timed} onTimed={(timed) => update({ timed })} time={choice.time} onTime={(time) => update({ time })} options={TIMES} />
    </SetupShell>
  );
}

// ---------- A partida ----------

type Past = { right: boolean; answer: string };

/** Forca em turnos: a palavra fica no servidor; cada letra é conferida lá. O retrato do personagem clareia a cada letra certa. */
export function HangmanGame({ puzzle, runId, report, finished }: GameProps<HangmanPuzzle> & { report: (result: MiniGameResult) => void }) {
  const [round, setRound] = useState(puzzle);
  const [pattern, setPattern] = useState(puzzle.pattern);
  const [errors, setErrors] = useState(puzzle.errors);
  const [hintsLeft, setHintsLeft] = useState(puzzle.hintsLeft);
  const [tried, setTried] = useState<string[]>([]);
  const [ended, setEnded] = useState<{ end: HangmanEnd; next: HangmanPuzzle | null } | null>(null);
  const [past, setPast] = useState<Past[]>([]);
  const [gained, setGained] = useState(0);

  const onEvent = useCallback((event: HangmanEvent) => {
    if (event.kind === 'guess') {
      setPattern(event.pattern);
      setErrors(event.errors);
      playSfx(event.hit ? 'anPick' : 'anWrong');
    } else if (event.kind === 'reveal') {
      setPattern(event.pattern);
      setHintsLeft(event.hintsLeft);
      playSfx('wsHint');
    } else if (event.kind === 'end') {
      setPattern(event.pattern);
      setErrors(event.errors);
      playSfx(event.end.right ? 'anRight' : event.end.timedOut ? 'anTimeout' : 'anWrong');
      setEnded({ end: event.end, next: event.next });
      setPast((current) => [...current, { right: event.end.right, answer: event.end.answer }]);
      setGained((current) => current + event.end.points);
    }
  }, []);
  const { act, busy, message } = useTurnAct<HangmanEvent>(runId, report, onEvent);

  const locked = finished || busy || ended !== null;
  const left = useTurnClock({ total: round.timePerRound, active: !ended && !finished, resetKey: round.round, onZero: () => void act({ action: 'timeout' }) });

  const hits = useMemo(() => new Set(pattern.flatMap((char) => (char ? [baseLetters(char)] : []))), [pattern]);
  const hidden = pattern.filter((char) => char === null).length;
  const letters = pattern.filter((char) => char !== ' ' && char !== '-').length;
  // Quanto do nome já apareceu (0 a 1): o retrato clareia junto.
  const progress = letters === 0 ? 0 : 1 - hidden / letters;

  const guess = useCallback(
    (letter: string) => {
      if (locked || tried.includes(letter)) return;
      setTried((current) => [...current, letter]);
      void act({ action: 'guess', letter });
    },
    [locked, tried, act],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
      const letter = baseLetters(event.key);
      if (letter.length === 1) guess(letter);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [guess]);

  function next() {
    if (!ended?.next) return;
    const upcoming = ended.next;
    setRound(upcoming);
    setPattern(upcoming.pattern);
    setErrors(0);
    setHintsLeft(upcoming.hintsLeft);
    setTried([]);
    setEnded(null);
    void act({ action: 'begin' });
  }

  return (
    <div className="space-y-4">
      <TurnHeader label={`Palavra ${Math.min(past.length + (ended ? 0 : 1), round.rounds)} de ${round.rounds}`} level={round.level} points={gained} />
      <RoundDots total={round.rounds} past={past.map((item) => item.right)} current={past.length} />
      {left !== null && round.timePerRound !== null && !ended && !finished ? <TimeBar left={left} total={round.timePerRound} unit="para esta palavra" /> : null}

      {ended ? (
        <TurnFeedback tone={ended.end.right ? 'success' : 'danger'} title={ended.end.right ? 'Acertou!' : ended.end.timedOut ? 'O tempo acabou' : 'Não foi dessa vez'} answer={ended.end.answer} points={ended.end.points} imageUrl={ended.end.imageUrl} onNext={ended.next ? next : undefined} />
      ) : (
        <div className="panel flex items-start gap-3 p-3">
          {round.imageUrl ? <img src={round.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-xl bg-surface-3 object-cover transition-[filter] duration-500" style={{ filter: `blur(${Math.round((1 - progress) * 14)}px) grayscale(${1 - progress})` }} /> : null}
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Dica{round.testament ? ` · ${round.testament}` : ''}</p>
            <p className="text-sm font-semibold text-ink">{round.hint}</p>
          </div>
        </div>
      )}

      <div className="flex justify-center gap-1" aria-label={`${round.maxErrors - errors} vidas restantes`}>
        {Array.from({ length: round.maxErrors }, (_, index) => (
          <FavoriteRoundedIcon key={index} sx={{ fontSize: 26 }} className={cn('transition-colors', index < round.maxErrors - errors ? 'text-danger' : 'text-edge-strong')} />
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-1.5" aria-label="Palavra secreta">
        {pattern.map((char, index) =>
          char === ' ' || char === '-' ? (
            <span key={index} className="w-3" />
          ) : (
            <span key={index} className={cn('flex h-11 w-8 items-center justify-center rounded-lg border-b-4 bg-surface-3 font-display text-xl font-bold uppercase text-ink', char ? 'border-success' : 'border-edge-strong')}>
              {char ?? ''}
            </span>
          ),
        )}
      </div>
      {message ? <Alert tone="danger">{message}</Alert> : null}
      <div data-sound="off" className="grid grid-cols-7 gap-1.5" role="group" aria-label="Letras">
        {KEYS.map((letter) => {
          const used = tried.includes(letter);
          return (
            <button
              key={letter}
              type="button"
              disabled={used || locked}
              onClick={() => guess(letter)}
              className={cn('h-10 rounded-lg font-display text-base font-bold transition active:scale-95', used ? (hits.has(letter) ? 'bg-success/25 text-success' : 'bg-danger/20 text-danger') : 'bg-surface-3 text-ink hover:bg-primary/20')}
            >
              {letter}
            </button>
          );
        })}
      </div>
      {!finished && !ended ? (
        <div className="flex gap-2">
          <Button className="flex-1" variant="secondary" size="sm" disabled={hintsLeft <= 0 || locked} onClick={() => void act({ action: 'reveal' })}>
            💡 Revelar uma letra ({hintsLeft})
          </Button>
          <Button className="flex-1" variant="ghost" size="sm" disabled={locked} onClick={() => void act({ action: 'skip' })}>
            Pular palavra
          </Button>
        </div>
      ) : null}
      {finished && past.length > 0 ? (
        <ul className="space-y-1.5" aria-label="Suas palavras">
          {past.map((item, index) => (
            <li key={index} className="flex items-center gap-2 rounded-xl bg-surface-3 px-3 py-2 text-sm font-bold">
              <span aria-hidden>{item.right ? '✅' : '❌'}</span>
              <span className="min-w-0 flex-1 truncate text-ink">{item.answer}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
