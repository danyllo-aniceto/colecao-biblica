import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { MiniGameResult, TestamentEnd, TestamentEvent, TestamentPuzzle } from '@/lib/minigames-api';
import { playSfx } from '@/lib/sound/sfx';
import type { GameProps, SetupRender } from './play-frame';
import { CountField, LEVEL_SCALE, LevelField, RoundDots, SetupShell, TimerField, TimeBar, TurnHeader, readStored, useTurnAct, useTurnClock, writeStored, type Level } from './turn-kit';

type Choice = 'OLD' | 'NEW';

// ---------- Tela de preparo ----------

const LEVEL_TEXT: Record<Level, string> = {
  facil: 'Só livros bem conhecidos (Gênesis, Salmos, Mateus...) e personagens',
  medio: 'Todos os 66 livros e personagens',
  dificil: 'Só os livros menos conhecidos (Naum, Filemom, Ageu...) e personagens',
};
const COUNTS = ['10', '15', '20'] as const;
const TIMES = ['5', '8', '12', '15'] as const;
const KEY = 'testamento-escolhas';
type Setup = { level: Level; count: string; timed: boolean; time: string };
const FALLBACK: Setup = { level: 'medio', count: '10', timed: true, time: '12' };

/** Antes de começar: dificuldade, quantos itens e tempo por item. */
export const testamentSetup: SetupRender = ({ onStart }) => <TestamentSetup onStart={onStart} />;

function TestamentSetup({ onStart }: { onStart: (options: object) => void }) {
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
      intro="Livros e personagens da Bíblia: de que Testamento é cada um? O servidor confere cada resposta na hora."
      tips={[`🎯 Pontuação máxima nesta escolha: ${Math.round(1000 * LEVEL_SCALE[choice.level]).toLocaleString('pt-BR')} pontos.`, '🏆 Vence quem acerta 80% ou mais.', '⚡ Quanto mais rápido, mais pontos por item.', '⌨️ No computador: seta para a esquerda = Antigo, seta para a direita = Novo.']}
      onStart={() => {
        writeStored(KEY, choice);
        onStart({ difficulty: choice.level, rounds: Number(choice.count), time: choice.timed ? Number(choice.time) : null });
      }}
    >
      <LevelField value={choice.level} onChange={(level) => update({ level })} texts={LEVEL_TEXT} />
      <CountField label="Quantos itens" value={choice.count} onChange={(count) => update({ count })} options={COUNTS} />
      <TimerField label="Contar o tempo por item" timed={choice.timed} onTimed={(timed) => update({ timed })} time={choice.time} onTime={(time) => update({ time })} options={TIMES} offNote="Sem pressa, mas cada item vale 15% menos." />
    </SetupShell>
  );
}

// ---------- A partida ----------

const NAME: Record<Choice, string> = { OLD: 'Antigo Testamento', NEW: 'Novo Testamento' };
/** Tempo que o resultado do item fica na tela antes de seguir sozinho. */
const PAUSE_MS = 1400;

/** Antigo ou Novo?: um item por vez, com resposta e pontos na hora, sequência de acertos e tempo opcional por item. */
export function TestamentGame({ puzzle, runId, report, finished }: GameProps<TestamentPuzzle> & { report: (result: MiniGameResult) => void }) {
  const [item, setItem] = useState(puzzle);
  const [ended, setEnded] = useState<{ end: TestamentEnd; picked: Choice | null; next: TestamentPuzzle | null } | null>(null);
  const [past, setPast] = useState<boolean[]>([]);
  const [streak, setStreak] = useState(0);
  const [gained, setGained] = useState(0);
  const pickedRef = useRef<Choice | null>(null);
  const streakRef = useRef(0);
  const endedRef = useRef<typeof ended>(null);
  const pause = useRef<number | undefined>(undefined);

  const onEvent = useCallback((event: TestamentEvent) => {
    if (event.kind !== 'end') return;
    setEnded({ end: event.end, picked: pickedRef.current, next: event.next });
    setPast((current) => [...current, event.end.right]);
    setGained((current) => current + event.end.points);
    streakRef.current = event.end.right ? streakRef.current + 1 : 0;
    setStreak(streakRef.current);
    playSfx(event.end.right ? 'anRight' : event.end.timedOut ? 'anTimeout' : 'anWrong', 1 + Math.min(streakRef.current, 6) * 0.05);
  }, []);
  endedRef.current = ended;
  const { act, busy, message } = useTurnAct<TestamentEvent>(runId, report, onEvent);
  const locked = finished || busy || ended !== null;
  const left = useTurnClock({ total: item.timePerItem, active: !ended && !finished, resetKey: item.index, onZero: () => void act({ action: 'timeout' }) });

  const pick = useCallback(
    (choice: Choice) => {
      if (locked) return;
      pickedRef.current = choice;
      void act({ action: 'classify', choice });
    },
    [locked, act],
  );

  const next = useCallback(() => {
    window.clearTimeout(pause.current);
    const current = endedRef.current;
    if (!current?.next) return;
    setItem(current.next);
    pickedRef.current = null;
    setEnded(null);
    void act({ action: 'begin' });
  }, [act]);

  // O resultado fica um instante na tela e o próximo item entra sozinho (tocar no cartão adianta).
  useEffect(() => {
    if (!ended?.next) return undefined;
    pause.current = window.setTimeout(next, PAUSE_MS);
    return () => window.clearTimeout(pause.current);
  }, [ended, next]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'ArrowLeft') pick('OLD');
      if (event.key === 'ArrowRight') pick('NEW');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pick]);

  return (
    <div className="space-y-4">
      <TurnHeader label={`Item ${Math.min(past.length + (ended ? 0 : 1), item.total)} de ${item.total}`} level={item.level} points={gained} />
      <RoundDots total={item.total} past={past} current={past.length} />
      {left !== null && item.timePerItem !== null && !ended && !finished ? <TimeBar left={left} total={item.timePerItem} unit="para este item" /> : null}
      {streak >= 2 ? <p className="text-center text-sm font-bold text-accent-strong dark:text-accent">🔥 {streak} acertos seguidos!</p> : null}

      <button
        type="button"
        data-sound="off"
        onClick={ended ? next : undefined}
        className={cn('panel flex min-h-44 w-full flex-col items-center justify-center gap-2 border-2 p-4 text-center transition', ended ? (ended.end.right ? 'border-success' : 'border-danger') : 'border-transparent')}
      >
        {ended?.end.imageUrl ? <img src={ended.end.imageUrl} alt="" className="h-20 w-20 rounded-2xl object-cover" /> : null}
        <span className="text-xs font-bold uppercase tracking-wider text-muted">{item.kind === 'book' ? 'Livro da Bíblia' : 'Personagem'}</span>
        <span className="font-display text-3xl font-bold text-ink">{ended ? ended.end.text : item.text}</span>
        {ended ? (
          <span className={cn('font-display text-base font-bold', ended.end.right ? 'text-success-strong dark:text-success' : 'text-danger')}>
            {ended.end.right ? `Certo! +${ended.end.points} pontos` : ended.end.timedOut ? `Tempo esgotado · é do ${NAME[ended.end.correct]}` : `Era do ${NAME[ended.end.correct]}`}
          </span>
        ) : null}
      </button>
      {message ? <Alert tone="danger">{message}</Alert> : null}

      <div data-sound="off" className="grid grid-cols-2 gap-3">
        {(['OLD', 'NEW'] as const).map((choice) => (
          <Button key={choice} size="lg" variant={choice === 'OLD' ? 'secondary' : 'primary'} disabled={locked} onClick={() => pick(choice)} className={cn(ended?.end.correct === choice && 'ring-4 ring-success/60')}>
            {choice === 'OLD' ? 'Antigo' : 'Novo'}
          </Button>
        ))}
      </div>
    </div>
  );
}
