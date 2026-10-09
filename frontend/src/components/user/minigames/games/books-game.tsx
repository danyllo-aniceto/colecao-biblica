import { useCallback, useState } from 'react';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { BooksEnd, BooksEvent, BooksPuzzle, MiniGameResult } from '@/lib/minigames-api';
import { playSfx } from '@/lib/sound/sfx';
import type { GameProps, SetupRender } from './play-frame';
import { CountField, LEVEL_SCALE, LevelField, RoundDots, SetupShell, TimerField, TimeBar, TurnFeedback, TurnHeader, readStored, useTurnAct, useTurnClock, writeStored, type Level } from './turn-kit';

// ---------- Tela de preparo ----------

const LEVEL_TEXT: Record<Level, string> = {
  facil: '4 livros bem espalhados pela Bíblia · com a dica de Antigo ou Novo Testamento',
  medio: '6 livros sorteados de toda a Bíblia',
  dificil: '8 livros próximos uns dos outros (é preciso conhecer bem a ordem)',
};
const ROUNDS = ['1', '3', '5'] as const;
const TIMES = ['30', '60', '90', '120', '180'] as const;
const KEY = 'livros-escolhas';
type Choice = { level: Level; rounds: string; timed: boolean; time: string };
const FALLBACK: Choice = { level: 'medio', rounds: '3', timed: false, time: '90' };

/** Antes de começar: dificuldade, quantos conjuntos (turnos) e tempo por conjunto. */
export const booksSetup: SetupRender = ({ onStart }) => <BooksSetup onStart={onStart} />;

function BooksSetup({ onStart }: { onStart: (options: object) => void }) {
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
      intro="Ponha os livros da Bíblia na ordem em que aparecem, do primeiro ao último."
      tips={[`🎯 Pontuação máxima nesta escolha: ${Math.round(1000 * LEVEL_SCALE[choice.level]).toLocaleString('pt-BR')} pontos.`, '✅ Cada livro no lugar certo vale pontos; acertar a ordem toda soma o bônus de rapidez.', '🏆 Vence quem põe na ordem metade dos conjuntos ou mais.']}
      onStart={() => {
        writeStored(KEY, choice);
        onStart({ difficulty: choice.level, rounds: Number(choice.rounds), time: choice.timed ? Number(choice.time) : null });
      }}
    >
      <LevelField value={choice.level} onChange={(level) => update({ level })} texts={LEVEL_TEXT} />
      <CountField label="Quantos conjuntos (turnos)" value={choice.rounds} onChange={(rounds) => update({ rounds })} options={ROUNDS} />
      <TimerField label="Contar o tempo por conjunto" timed={choice.timed} onTimed={(timed) => update({ timed })} time={choice.time} onTime={(time) => update({ time })} options={TIMES} />
    </SetupShell>
  );
}

// ---------- A partida ----------

const TESTAMENT_TAG = { OLD: 'AT', NEW: 'NT' } as const;

/** Livros em ordem: toque nos livros na ordem em que aparecem na Bíblia. Ao conferir, mostra a ordem certa e onde você errou. */
export function BooksGame({ puzzle, runId, report, finished }: GameProps<BooksPuzzle> & { report: (result: MiniGameResult) => void }) {
  const [round, setRound] = useState(puzzle);
  const [order, setOrder] = useState<string[]>([]);
  const [ended, setEnded] = useState<{ end: BooksEnd; next: BooksPuzzle | null } | null>(null);
  const [past, setPast] = useState<boolean[]>([]);
  const [gained, setGained] = useState(0);
  const [mine, setMine] = useState<string[]>([]);

  const onEvent = useCallback((event: BooksEvent) => {
    if (event.kind !== 'end') return;
    setEnded({ end: event.end, next: event.next });
    setPast((current) => [...current, event.end.solved]);
    setGained((current) => current + event.end.points);
    playSfx(event.end.solved ? 'anRight' : event.end.timedOut ? 'anTimeout' : 'anWrong');
  }, []);
  const { act, busy, message } = useTurnAct<BooksEvent>(runId, report, onEvent);
  const locked = finished || busy || ended !== null;
  const left = useTurnClock({ total: round.timePerRound, active: !ended && !finished, resetKey: round.round, onZero: () => void act({ action: 'timeout' }) });

  function choose(name: string) {
    if (locked || order.includes(name)) return;
    playSfx('anPick');
    setOrder((current) => [...current, name]);
  }

  function remove(name: string) {
    if (locked) return;
    playSfx('anRemove');
    setOrder((current) => current.filter((item) => item !== name));
  }

  function check() {
    if (order.length !== round.books.length || locked) return;
    setMine(order);
    void act({ action: 'order', order });
  }

  function next() {
    if (!ended?.next) return;
    setRound(ended.next);
    setOrder([]);
    setMine([]);
    setEnded(null);
    void act({ action: 'begin' });
  }

  return (
    <div className="space-y-4">
      <TurnHeader label={`Conjunto ${Math.min(past.length + (ended ? 0 : 1), round.rounds)} de ${round.rounds}`} level={round.level} points={gained} />
      <RoundDots total={round.rounds} past={past} current={past.length} />
      {left !== null && round.timePerRound !== null && !ended && !finished ? <TimeBar left={left} total={round.timePerRound} unit="para este conjunto" /> : null}

      {ended ? (
        <TurnFeedback
          tone={ended.end.solved ? 'success' : 'danger'}
          title={ended.end.solved ? 'Ordem perfeita!' : ended.end.timedOut ? 'O tempo acabou' : `${ended.end.right} de ${ended.end.total} no lugar certo`}
          answer="A ordem na Bíblia"
          points={ended.end.points}
          onNext={ended.next ? next : undefined}
          extra={
            <ol className="space-y-1.5 text-left">
              {ended.end.correct.map((book, index) => {
                const right = mine[index] === book;
                return (
                  <li key={book} className={cn('flex items-center gap-3 rounded-xl px-3 py-2 font-display font-bold', right ? 'bg-success/15 text-ink' : 'bg-danger/10 text-ink')}>
                    <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-sm', right ? 'bg-success text-white' : 'bg-danger text-white')}>{index + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{book}</span>
                    {!right && mine[index] ? <span className="truncate text-xs font-semibold text-muted">você: {mine[index]}</span> : null}
                  </li>
                );
              })}
            </ol>
          }
        />
      ) : (
        <>
          <p className="text-sm font-semibold text-muted">Toque nos livros na ordem em que aparecem na Bíblia, do primeiro ao último. Toque num livro já escolhido para tirá-lo.</p>
          <ol data-sound="off" className="panel min-h-20 space-y-1.5 p-3" aria-label="Sua ordem">
            {order.length === 0 ? <li className="text-sm font-semibold text-muted">Escolha o primeiro livro...</li> : null}
            {order.map((book, index) => (
              <li key={book}>
                <button type="button" disabled={locked} onClick={() => remove(book)} className="flex w-full items-center gap-3 rounded-xl bg-surface-3 px-3 py-2 text-left font-display font-bold text-ink">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-on-primary">{index + 1}</span>
                  {book}
                </button>
              </li>
            ))}
          </ol>
          {message ? <Alert tone="danger">{message}</Alert> : null}
          <div data-sound="off" className="flex flex-wrap justify-center gap-2" role="group" aria-label="Livros">
            {round.books.map((book) => (
              <button
                key={book.name}
                type="button"
                disabled={order.includes(book.name) || locked}
                onClick={() => choose(book.name)}
                className={cn('flex items-center gap-2 rounded-xl bg-surface-3 px-4 py-2.5 font-display text-base font-bold text-ink transition active:scale-95', order.includes(book.name) && 'opacity-30')}
              >
                {book.name}
                {book.testament ? <span className="rounded-md bg-primary/20 px-1.5 text-[11px] font-bold text-primary-strong dark:text-primary">{TESTAMENT_TAG[book.testament]}</span> : null}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" disabled={order.length === 0 || locked} onClick={() => setOrder([])}>
              Limpar
            </Button>
            <Button className="flex-1" loading={busy} disabled={order.length !== round.books.length || finished} onClick={check}>
              Conferir
            </Button>
          </div>
          {!finished ? (
            <Button variant="ghost" size="sm" className="w-full" disabled={busy} onClick={() => void act({ action: 'skip' })}>
              Pular este conjunto
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
