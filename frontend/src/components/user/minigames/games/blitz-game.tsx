import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { BlitzEnd, BlitzEvent, BlitzPuzzle, MiniGameResult } from '@/lib/minigames-api';
import { playSfx } from '@/lib/sound/sfx';
import type { GameProps, SetupRender } from './play-frame';
import { CountField, LEVEL_SCALE, LevelField, RoundDots, SetupShell, TimerField, TimeBar, TurnHeader, readStored, useTurnAct, useTurnClock, writeStored, type Level } from './turn-kit';

// ---------- Tela de preparo ----------

const LEVEL_TEXT: Record<Level, string> = {
  facil: 'Perguntas fáceis do quiz',
  medio: 'Perguntas de dificuldade média (e algumas fáceis)',
  dificil: 'Perguntas difíceis do quiz',
};
const COUNTS = ['10', '15', '20'] as const;
const TIMES = ['8', '12', '15', '20'] as const;
const KEY = 'relampago-escolhas';
type Setup = { level: Level; count: string; timed: boolean; time: string };
const FALLBACK: Setup = { level: 'medio', count: '10', timed: true, time: '12' };

/** Antes de começar: dificuldade das perguntas, quantas afirmações e tempo por afirmação. */
export const blitzSetup: SetupRender = ({ onStart }) => <BlitzSetup onStart={onStart} />;

function BlitzSetup({ onStart }: { onStart: (options: object) => void }) {
  const [choice, setChoice] = useState<Setup>(() =>
    readStored(KEY, FALLBACK, (saved) => ({
      level: saved.level && saved.level in LEVEL_SCALE ? saved.level : FALLBACK.level,
      count: COUNTS.includes(saved.count as never) ? (saved.count as string) : FALLBACK.count,
      timed: typeof saved.timed === 'boolean' ? saved.timed : FALLBACK.timed,
      time: TIMES.includes(saved.time as never) ? (saved.time as string) : FALLBACK.time,
    })),
  );
  const update = (patch: Partial<Setup>) => setChoice((current) => ({ ...current, ...patch }));
  return (
    <SetupShell
      intro="Mostramos uma pergunta do quiz com uma resposta. Ela está certa? Diga verdadeiro ou falso, depressa."
      tips={[`🎯 Pontuação máxima nesta escolha: ${Math.round(1000 * LEVEL_SCALE[choice.level]).toLocaleString('pt-BR')} pontos.`, '🏆 Vence quem acerta 80% ou mais.', '📖 Depois de cada resposta aparece a explicação, quando houver.', '⌨️ No computador: seta para a esquerda = Falso, seta para a direita = Verdadeiro.']}
      onStart={() => {
        writeStored(KEY, choice);
        onStart({ difficulty: choice.level, rounds: Number(choice.count), time: choice.timed ? Number(choice.time) : null });
      }}
    >
      <LevelField value={choice.level} onChange={(level) => update({ level })} texts={LEVEL_TEXT} />
      <CountField label="Quantas afirmações" value={choice.count} onChange={(count) => update({ count })} options={COUNTS} />
      <TimerField label="Contar o tempo por afirmação" timed={choice.timed} onTimed={(timed) => update({ timed })} time={choice.time} onTime={(time) => update({ time })} options={TIMES} offNote="Sem pressa, mas cada afirmação vale 15% menos." />
    </SetupShell>
  );
}

// ---------- A partida ----------

/** Relâmpago: verdadeiro ou falso, com resposta, explicação e sequência de acertos na hora. */
export function BlitzGame({ puzzle, runId, report, finished }: GameProps<BlitzPuzzle> & { report: (result: MiniGameResult) => void }) {
  const [item, setItem] = useState(puzzle);
  const [ended, setEnded] = useState<{ end: BlitzEnd; next: BlitzPuzzle | null } | null>(null);
  const [past, setPast] = useState<boolean[]>([]);
  const [streak, setStreak] = useState(0);
  const [gained, setGained] = useState(0);
  const streakRef = useRef(0);
  const endedRef = useRef<typeof ended>(null);
  const pause = useRef<number | undefined>(undefined);

  const onEvent = useCallback((event: BlitzEvent) => {
    if (event.kind !== 'end') return;
    setEnded({ end: event.end, next: event.next });
    setPast((current) => [...current, event.end.right]);
    setGained((current) => current + event.end.points);
    streakRef.current = event.end.right ? streakRef.current + 1 : 0;
    setStreak(streakRef.current);
    playSfx(event.end.right ? 'anRight' : event.end.timedOut ? 'anTimeout' : 'anWrong', 1 + Math.min(streakRef.current, 6) * 0.05);
  }, []);
  endedRef.current = ended;
  const { act, busy, message } = useTurnAct<BlitzEvent>(runId, report, onEvent);
  const locked = finished || busy || ended !== null;
  const left = useTurnClock({ total: item.timePerItem, active: !ended && !finished, resetKey: item.index, onZero: () => void act({ action: 'timeout' }) });

  const judge = useCallback(
    (value: boolean) => {
      if (!locked) void act({ action: 'judge', value });
    },
    [locked, act],
  );

  const next = useCallback(() => {
    window.clearTimeout(pause.current);
    const current = endedRef.current;
    if (!current?.next) return;
    setItem(current.next);
    setEnded(null);
    void act({ action: 'begin' });
  }, [act]);

  // Com explicação o jogador precisa de mais tempo para ler; tocar no cartão adianta.
  useEffect(() => {
    if (!ended?.next) return undefined;
    pause.current = window.setTimeout(next, ended.end.explanation ? 3200 : 1500);
    return () => window.clearTimeout(pause.current);
  }, [ended, next]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft') judge(false);
      if (event.key === 'ArrowRight') judge(true);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [judge]);

  return (
    <div className="space-y-4">
      <TurnHeader label={`Afirmação ${Math.min(past.length + (ended ? 0 : 1), item.total)} de ${item.total}`} level={item.level} points={gained} />
      <RoundDots total={item.total} past={past} current={past.length} />
      {left !== null && item.timePerItem !== null && !ended && !finished ? <TimeBar left={left} total={item.timePerItem} unit="para esta afirmação" /> : null}
      {streak >= 2 ? <p className="text-center text-sm font-bold text-accent-strong dark:text-accent">🔥 {streak} acertos seguidos!</p> : null}

      <button type="button" data-sound="off" onClick={ended ? next : undefined} className={cn('panel block w-full space-y-3 border-2 p-4 text-left transition', ended ? (ended.end.right ? 'border-success' : 'border-danger') : 'border-transparent')}>
        <span className="block font-display text-lg font-bold text-ink">{ended ? ended.end.question : item.question}</span>
        <span className="block rounded-xl bg-surface-3 p-3 text-center font-display text-xl font-bold text-primary-strong dark:text-primary">{item.answer}</span>
        {ended ? (
          <span className="block space-y-1">
            <span className={cn('block font-display text-base font-bold', ended.end.right ? 'text-success-strong dark:text-success' : 'text-danger')}>
              {ended.end.timedOut ? 'Tempo esgotado. ' : ended.end.right ? `Certo! +${ended.end.points} pontos. ` : 'Não era assim. '}
              {ended.end.truth ? 'A afirmação era verdadeira.' : `A afirmação era falsa. O certo: ${ended.end.correct}.`}
            </span>
            {ended.end.explanation ? <span className="block text-sm font-semibold text-muted">{ended.end.explanation}</span> : null}
            {ended.end.reference ? <span className="block text-xs font-bold text-muted">📖 {ended.end.reference}</span> : null}
          </span>
        ) : null}
      </button>
      {message ? <Alert tone="danger">{message}</Alert> : null}

      <div data-sound="off" className="grid grid-cols-2 gap-3">
        <Button size="lg" variant="secondary" disabled={locked} onClick={() => judge(false)} className={cn(ended && !ended.end.truth && 'ring-4 ring-success/60')}>
          Falso
        </Button>
        <Button size="lg" disabled={locked} onClick={() => judge(true)} className={cn(ended?.end.truth && 'ring-4 ring-success/60')}>
          Verdadeiro
        </Button>
      </div>
    </div>
  );
}
