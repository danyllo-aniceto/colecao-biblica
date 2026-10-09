import { useCallback, useState } from 'react';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { BlanksEnd, BlanksEvent, BlanksPuzzle, MiniGameResult } from '@/lib/minigames-api';
import { playSfx } from '@/lib/sound/sfx';
import type { GameProps, SetupRender } from './play-frame';
import { CountField, LEVEL_SCALE, LevelField, RoundDots, SetupShell, TimerField, TimeBar, TurnFeedback, TurnHeader, readStored, useTurnAct, useTurnClock, writeStored, type Level } from './turn-kit';

// ---------- Tela de preparo ----------

const LEVEL_TEXT: Record<Level, string> = {
  facil: '2 lacunas e 2 palavras de enfeite · versículos curtos',
  medio: '3 lacunas e 3 palavras de enfeite',
  dificil: '4 lacunas e 5 palavras de enfeite de tamanho parecido · versículos longos',
};
const ROUNDS = ['1', '3', '5'] as const;
const TIMES = ['30', '45', '60', '90', '120'] as const;
const KEY = 'lacunas-escolhas';
type Choice = { level: Level; rounds: string; timed: boolean; time: string };
const FALLBACK: Choice = { level: 'medio', rounds: '3', timed: false, time: '60' };

/** Antes de começar: dificuldade, quantos versículos e tempo por versículo. */
export const blanksSetup: SetupRender = ({ onStart }) => <BlanksSetup onStart={onStart} />;

function BlanksSetup({ onStart }: { onStart: (options: object) => void }) {
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
      intro="O versículo vem com palavras faltando. Escolha, entre as palavras da lista, a que cabe em cada lacuna. Há palavras de enfeite."
      tips={[`🎯 Pontuação máxima nesta escolha: ${Math.round(1000 * LEVEL_SCALE[choice.level]).toLocaleString('pt-BR')} pontos.`, '✅ Cada lacuna certa vale pontos; acertar todas soma o bônus de rapidez.', '📖 Ao conferir, o versículo completo aparece.', '🏆 Vence quem completa metade dos versículos ou mais.']}
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

/** Complete o versículo: escolha uma lacuna e depois a palavra que cabe nela. Ao conferir, mostra o que acertou e o versículo inteiro. */
export function BlanksGame({ puzzle, runId, report, finished }: GameProps<BlanksPuzzle> & { report: (result: MiniGameResult) => void }) {
  const [round, setRound] = useState(puzzle);
  const slots = round.parts.filter((part) => part.blank !== null).length;
  const [fills, setFills] = useState<Array<string | null>>(() => Array.from({ length: puzzle.parts.filter((part) => part.blank !== null).length }, () => null));
  const [active, setActive] = useState<number | null>(0);
  const [ended, setEnded] = useState<{ end: BlanksEnd; next: BlanksPuzzle | null } | null>(null);
  const [past, setPast] = useState<boolean[]>([]);
  const [gained, setGained] = useState(0);

  const onEvent = useCallback((event: BlanksEvent) => {
    if (event.kind !== 'end') return;
    setEnded({ end: event.end, next: event.next });
    setPast((current) => [...current, event.end.solved]);
    setGained((current) => current + event.end.points);
    playSfx(event.end.solved ? 'anRight' : event.end.timedOut ? 'anTimeout' : 'anWrong');
  }, []);
  const { act, busy, message } = useTurnAct<BlanksEvent>(runId, report, onEvent);
  const locked = finished || busy || ended !== null;
  const left = useTurnClock({ total: round.timePerRound, active: !ended && !finished, resetKey: round.round, onZero: () => void act({ action: 'timeout' }) });

  const used = new Set(fills.filter((fill): fill is string => fill !== null));
  const complete = fills.every((fill) => fill !== null);

  function place(word: string) {
    if (locked || used.has(word)) return;
    const target = active ?? fills.findIndex((fill) => fill === null);
    if (target < 0) return;
    playSfx('anPick');
    const nextFills = [...fills];
    nextFills[target] = word;
    setFills(nextFills);
    const empty = nextFills.findIndex((fill) => fill === null);
    setActive(empty >= 0 ? empty : null);
  }

  function clear(slot: number) {
    if (locked) return;
    playSfx('anRemove');
    setFills((current) => current.map((fill, at) => (at === slot ? null : fill)));
    setActive(slot);
  }

  function next() {
    if (!ended?.next) return;
    const upcoming = ended.next;
    setRound(upcoming);
    setFills(Array.from({ length: upcoming.parts.filter((part) => part.blank !== null).length }, () => null));
    setActive(0);
    setEnded(null);
    void act({ action: 'begin' });
  }

  return (
    <div className="space-y-4">
      <TurnHeader label={`Versículo ${Math.min(past.length + (ended ? 0 : 1), round.rounds)} de ${round.rounds}`} level={round.level} points={gained} />
      <RoundDots total={round.rounds} past={past} current={past.length} />
      {left !== null && round.timePerRound !== null && !ended && !finished ? <TimeBar left={left} total={round.timePerRound} unit="para este versículo" /> : null}

      {ended ? (
        <TurnFeedback
          tone={ended.end.solved ? 'success' : 'danger'}
          title={ended.end.solved ? `Completo! ${ended.end.reference}` : ended.end.timedOut ? `O tempo acabou · ${ended.end.reference}` : `${ended.end.right} de ${ended.end.total} lacunas certas · ${ended.end.reference}`}
          answer={ended.end.title}
          points={ended.end.points}
          imageUrl={ended.end.imageUrl}
          onNext={ended.next ? next : undefined}
          extra={
            <div className="space-y-2">
              <p className="font-display text-base font-semibold leading-7 text-ink">“{ended.end.text}”</p>
              <ul className="flex flex-wrap justify-center gap-1.5" aria-label="Suas respostas">
                {ended.end.answers.map((answer, index) => {
                  const right = (ended.end.fills[index] ?? '').toLowerCase() === answer.toLowerCase();
                  return (
                    <li key={index} className={cn('rounded-full px-3 py-1 text-xs font-bold', right ? 'bg-success/20 text-success-strong dark:text-success' : 'bg-danger/15 text-danger')}>
                      {right ? '✅' : '❌'} {answer}
                      {!right && ended.end.fills[index] ? ` (você: ${ended.end.fills[index]})` : ''}
                    </li>
                  );
                })}
              </ul>
            </div>
          }
        />
      ) : (
        <>
          <p className="text-sm font-semibold text-muted">
            Complete o versículo de <b className="text-ink">{round.reference}</b>. Há palavras a mais, de enfeite.
          </p>
          <p className="panel p-4 text-lg font-semibold leading-9 text-ink">
            {round.parts.map((part, index) =>
              part.blank === null ? (
                <span key={index}>{part.text} </span>
              ) : (
                <span key={index}>
                  {part.prefix}
                  <button
                    type="button"
                    data-sound="off"
                    disabled={locked}
                    onClick={() => (fills[part.blank!] ? clear(part.blank!) : setActive(part.blank))}
                    aria-label={fills[part.blank] ? `Lacuna ${part.blank + 1}: ${fills[part.blank]}. Toque para tirar` : `Lacuna ${part.blank + 1} vazia`}
                    className={cn(
                      'mx-0.5 inline-flex min-w-20 items-center justify-center rounded-lg border-b-4 px-2 align-middle font-display font-bold',
                      fills[part.blank] ? 'border-success bg-success/15 text-ink' : active === part.blank ? 'border-primary bg-primary/15 text-primary' : 'border-edge-strong bg-surface-3 text-muted',
                    )}
                  >
                    {fills[part.blank] ?? '____'}
                  </button>
                  {part.suffix}{' '}
                </span>
              ),
            )}
          </p>
          {message ? <Alert tone="danger">{message}</Alert> : null}
          <div data-sound="off" className="flex flex-wrap justify-center gap-2" role="group" aria-label="Palavras">
            {round.options.map((word) => (
              <button key={word} type="button" disabled={used.has(word) || locked} onClick={() => place(word)} className={cn('rounded-xl bg-surface-3 px-3 py-2 font-display text-base font-bold text-ink transition active:scale-95', used.has(word) && 'opacity-30')}>
                {word}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" disabled={fills.every((fill) => fill === null) || locked} onClick={() => { setFills(Array.from({ length: slots }, () => null)); setActive(0); }}>
              Limpar
            </Button>
            <Button className="flex-1" loading={busy} disabled={!complete || finished} onClick={() => void act({ action: 'fill', fills })}>
              Conferir
            </Button>
          </div>
          {!finished ? (
            <Button variant="ghost" size="sm" className="w-full" disabled={busy} onClick={() => void act({ action: 'skip' })}>
              Pular versículo
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
