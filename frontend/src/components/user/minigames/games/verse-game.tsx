import { useCallback, useRef, useState } from 'react';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { MiniGameResult, VerseEnd, VerseEvent, VersePuzzle } from '@/lib/minigames-api';
import { playSfx } from '@/lib/sound/sfx';
import type { GameProps, SetupRender } from './play-frame';
import { CountField, LEVEL_SCALE, LevelField, RoundDots, SetupShell, TimerField, TimeBar, TurnFeedback, TurnHeader, readStored, useTurnAct, useTurnClock, writeStored, type Level } from './turn-kit';

// ---------- Tela de preparo ----------

const LEVEL_TEXT: Record<Level, string> = {
  facil: 'Versículos curtos (6 a 11 palavras) · 3 dicas por versículo',
  medio: 'Versículos médios (9 a 16 palavras) · 2 dicas por versículo',
  dificil: 'Versículos longos (14 a 22 palavras) · 1 dica por versículo',
};
const ROUNDS = ['1', '3', '5'] as const;
const TIMES = ['30', '60', '90', '120', '180'] as const;
const KEY = 'versiculo-escolhas';
type Choice = { level: Level; rounds: string; timed: boolean; time: string };
const FALLBACK: Choice = { level: 'medio', rounds: '3', timed: false, time: '90' };

/** Antes de começar: dificuldade, quantos versículos e tempo por versículo. */
export const verseSetup: SetupRender = ({ onStart }) => <VerseSetup onStart={onStart} />;

function VerseSetup({ onStart }: { onStart: (options: object) => void }) {
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
      intro="As palavras de um versículo vêm embaralhadas. Toque nelas na ordem certa para montá-lo."
      tips={[`🎯 Pontuação máxima nesta escolha: ${Math.round(1000 * LEVEL_SCALE[choice.level]).toLocaleString('pt-BR')} pontos.`, '❌ Cada erro e cada dica descontam pontos.', '⚡ Montar depressa soma o bônus de rapidez.', '🏆 Vence quem monta metade dos versículos ou mais.']}
      onStart={() => {
        writeStored(KEY, choice);
        onStart({ difficulty: choice.level, rounds: Number(choice.rounds), time: choice.timed ? Number(choice.time) : null });
      }}
    >
      <LevelField value={choice.level} onChange={(level) => update({ level })} texts={LEVEL_TEXT} />
      <CountField label="Quantos versículos (turnos)" value={choice.rounds} onChange={(rounds) => update({ rounds })} options={ROUNDS} />
      <TimerField label="Contar o tempo por versículo" timed={choice.timed} onTimed={(timed) => update({ timed })} time={choice.time} onTime={(time) => update({ time })} options={TIMES} />
    </SetupShell>
  );
}

// ---------- A partida ----------

/** Versículo em pedaços: toque nas palavras na ordem certa; o servidor confere cada toque. */
export function VerseGame({ puzzle, runId, report, finished }: GameProps<VersePuzzle> & { report: (result: MiniGameResult) => void }) {
  const [round, setRound] = useState(puzzle);
  const [placed, setPlaced] = useState<number[]>([]);
  const [errors, setErrors] = useState(0);
  const [shake, setShake] = useState<number | null>(null);
  const [hinted, setHinted] = useState<number | null>(null);
  const [hintsLeft, setHintsLeft] = useState(puzzle.hintsLeft);
  const [ended, setEnded] = useState<{ end: VerseEnd; next: VersePuzzle | null } | null>(null);
  const [past, setPast] = useState<boolean[]>([]);
  const [gained, setGained] = useState(0);
  const lastTapRef = useRef<number | null>(null);

  const onEvent = useCallback((event: VerseEvent) => {
    if (event.kind === 'tap') {
      setErrors(event.errors);
      if (event.right) {
        setPlaced((current) => [...current, event.index]);
        setHinted(null);
        playSfx('anPick');
      } else {
        setShake(event.index);
        playSfx('anWrong');
        window.setTimeout(() => setShake(null), 400);
      }
    } else if (event.kind === 'hint') {
      setHinted(event.index);
      setHintsLeft(event.hintsLeft);
      playSfx('wsHint');
    } else if (event.kind === 'end') {
      // A última palavra também entra na frase.
      setPlaced((current) => (lastTapRef.current !== null && !current.includes(lastTapRef.current) ? [...current, lastTapRef.current] : current));
      playSfx(event.end.right ? 'anRight' : event.end.timedOut ? 'anTimeout' : 'anWrong');
      setEnded({ end: event.end, next: event.next });
      setPast((current) => [...current, event.end.right]);
      setGained((current) => current + event.end.points);
    }
  }, []);
  const { act, busy, message } = useTurnAct<VerseEvent>(runId, report, onEvent);
  const locked = finished || busy || ended !== null;
  const left = useTurnClock({ total: round.timePerRound, active: !ended && !finished, resetKey: round.round, onZero: () => void act({ action: 'timeout' }) });

  function tap(index: number) {
    if (locked || placed.includes(index)) return;
    lastTapRef.current = index;
    void act({ action: 'tap', index });
  }

  function next() {
    if (!ended?.next) return;
    const upcoming = ended.next;
    setRound(upcoming);
    setPlaced([]);
    setErrors(0);
    setHinted(null);
    lastTapRef.current = null;
    setHintsLeft(upcoming.hintsLeft);
    setEnded(null);
    void act({ action: 'begin' });
  }

  return (
    <div className="space-y-3">
      <TurnHeader label={`Versículo ${Math.min(past.length + (ended ? 0 : 1), round.rounds)} de ${round.rounds}`} level={round.level} points={gained} />
      <RoundDots total={round.rounds} past={past} current={past.length} />
      {left !== null && round.timePerRound !== null && !ended && !finished ? <TimeBar left={left} total={round.timePerRound} unit="para este versículo" /> : null}

      {ended ? (
        <TurnFeedback
          tone={ended.end.right ? 'success' : 'danger'}
          title={ended.end.right ? `Montado! ${ended.end.reference}` : ended.end.timedOut ? `O tempo acabou · ${ended.end.reference}` : `Era ${ended.end.reference}`}
          answer={ended.end.title}
          points={ended.end.points}
          imageUrl={ended.end.imageUrl}
          onNext={ended.next ? next : undefined}
          extra={<p className="font-display text-base font-semibold leading-7 text-ink">“{ended.end.text}”</p>}
        />
      ) : (
        <>
          <p className="text-sm font-semibold text-muted">
            Monte o versículo de <b className="text-ink">{round.reference}</b> tocando nas palavras na ordem certa.
          </p>
          <div className="panel min-h-24 p-3 text-ink" aria-live="polite">
            {placed.length === 0 ? <span className="text-sm font-semibold text-muted">Toque na primeira palavra...</span> : <span className="font-display text-lg font-bold">{placed.map((index) => round.chips[index]).join(' ')}</span>}
          </div>
          {message ? <Alert tone="danger">{message}</Alert> : null}
          <div data-sound="off" className="flex flex-wrap justify-center gap-2" role="group" aria-label="Palavras">
            {round.chips.map((chip, index) => {
              const used = placed.includes(index);
              return (
                <button
                  key={index}
                  type="button"
                  disabled={used || locked}
                  onClick={() => tap(index)}
                  className={cn(
                    'rounded-xl px-3 py-2 font-display text-base font-bold transition active:scale-95',
                    shake === index ? 'animate-shake bg-danger/30 text-ink' : used ? 'bg-success/15 text-success opacity-40' : 'bg-surface-3 text-ink hover:bg-primary/20',
                    hinted === index && 'animate-pulse ring-2 ring-accent',
                  )}
                >
                  {chip}
                </button>
              );
            })}
          </div>
          <p className="text-center text-sm font-bold text-muted">
            {placed.length} de {round.length} palavras · {errors} {errors === 1 ? 'erro' : 'erros'}
          </p>
          {!finished ? (
            <div className="flex gap-2">
              <Button className="flex-1" variant="secondary" size="sm" disabled={hintsLeft <= 0 || locked} onClick={() => void act({ action: 'hint' })}>
                💡 Dica ({hintsLeft})
              </Button>
              <Button className="flex-1" variant="ghost" size="sm" disabled={locked} onClick={() => void act({ action: 'skip' })}>
                Pular versículo
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
