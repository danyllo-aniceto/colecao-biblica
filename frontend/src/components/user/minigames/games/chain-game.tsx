import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import type { ChainEnd, ChainEvent, ChainPuzzle, MiniGameResult } from '@/lib/minigames-api';
import { playSfx } from '@/lib/sound/sfx';
import type { GameProps, SetupRender } from './play-frame';
import { CountField, LEVEL_SCALE, LevelField, RoundDots, SetupShell, TimerField, TimeBar, TurnFeedback, TurnHeader, readStored, useTurnAct, useTurnClock, writeStored, type Level } from './turn-kit';

// ---------- Tela de preparo ----------

const LEVEL_TEXT: Record<Level, string> = {
  facil: 'Pontas a 2 ou 3 elos de distância · 3 dicas',
  medio: 'Pontas a 3 ou 4 elos de distância · 2 dicas',
  dificil: 'Pontas a 5 ou 6 elos de distância · 1 dica',
};
const ROUNDS = ['1', '3', '5'] as const;
const TIMES = ['30', '45', '60', '90', '120'] as const;
const KEY = 'interconexao-escolhas';
type Choice = { level: Level; rounds: string; timed: boolean; time: string };
const FALLBACK: Choice = { level: 'medio', rounds: '3', timed: false, time: '60' };

/** Antes de começar: dificuldade (distância entre as pontas), quantas ligações e tempo por ligação. */
export const chainSetup: SetupRender = ({ onStart }) => <ChainSetup onStart={onStart} />;

function ChainSetup({ onStart }: { onStart: (options: object) => void }) {
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
      intro="Em cada rodada você recebe dois nomes (personagens ou lugares) e precisa ligá-los por uma corrente de relações da Bíblia, passo a passo."
      tips={[`🎯 Pontuação máxima nesta escolha: ${Math.round(1000 * LEVEL_SCALE[choice.level]).toLocaleString('pt-BR')} pontos.`, '🔗 Menos elos, mais pontos: o caminho mais curto vale o máximo.', '💡 A dica mostra o próximo passo certo (−20% da rodada).', '🏆 Vence quem faz metade das ligações ou mais.']}
      onStart={() => {
        writeStored(KEY, choice);
        onStart({ difficulty: choice.level, rounds: Number(choice.rounds), time: choice.timed ? Number(choice.time) : null });
      }}
    >
      <LevelField value={choice.level} onChange={(level) => update({ level })} texts={LEVEL_TEXT} />
      <CountField label="Quantas ligações (turnos)" value={choice.rounds} onChange={(rounds) => update({ rounds })} options={ROUNDS} />
      <TimerField label="Contar o tempo por ligação" timed={choice.timed} onTimed={(timed) => update({ timed })} time={choice.time} onTime={(time) => update({ time })} options={TIMES} />
    </SetupShell>
  );
}

// ---------- A partida ----------

function Face({ name, images, size = 'h-7 w-7' }: { name: string; images: Record<string, string>; size?: string }) {
  return images[name] ? <img src={images[name]} alt="" loading="lazy" draggable={false} className={cn('shrink-0 rounded-full bg-surface-3 object-cover', size)} /> : null;
}

/** Interconexão: ligue o nome de partida ao de chegada por uma corrente de relações; ao fim de cada ligação aparece o caminho mais curto. */
export function ChainGame({ puzzle, runId, report, finished }: GameProps<ChainPuzzle> & { report: (result: MiniGameResult) => void }) {
  const [round, setRound] = useState(puzzle);
  const [path, setPath] = useState([puzzle.from]);
  const [hintNode, setHintNode] = useState<{ node: string; phrase: string } | null>(null);
  const [hintsLeft, setHintsLeft] = useState(puzzle.hintsLeft);
  const [ended, setEnded] = useState<{ end: ChainEnd; next: ChainPuzzle | null } | null>(null);
  const [past, setPast] = useState<boolean[]>([]);
  const [gained, setGained] = useState(0);
  // As fotos vêm só na primeira rodada.
  const images = useRef(puzzle.images ?? {}).current;

  const onEvent = useCallback((event: ChainEvent) => {
    if (event.kind === 'hint') {
      setHintNode({ node: event.node, phrase: event.phrase });
      setHintsLeft(event.left);
      playSfx('wsHint');
    } else if (event.kind === 'end') {
      setEnded({ end: event.end, next: event.next });
      setPast((current) => [...current, event.end.reached]);
      setGained((current) => current + event.end.points);
      playSfx(event.end.reached ? 'anRight' : event.end.timedOut ? 'anTimeout' : 'anWrong');
    }
  }, []);
  const { act, busy, message } = useTurnAct<ChainEvent>(runId, report, onEvent);
  const locked = finished || busy || ended !== null;
  const left = useTurnClock({ total: round.timePerRound, active: !ended && !finished, resetKey: round.round, onZero: () => void act({ action: 'timeout' }) });

  const here = path[path.length - 1];
  const options = useMemo(() => round.edges.flatMap(([from, to, forward, backward]) => (from === here ? [{ to, phrase: `${here} ${forward}` }] : to === here ? [{ to: from, phrase: `${here} ${backward}` }] : [])), [round.edges, here]);

  // Chegou ao nome final: manda o caminho para o servidor conferir.
  useEffect(() => {
    if (here === round.to && path.length > 1 && !ended) void act({ action: 'path', path });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here]);

  function go(next: string) {
    if (locked) return;
    playSfx('anPick');
    setHintNode(null);
    setPath((list) => [...list, next]);
  }

  function back() {
    if (locked || path.length < 2) return;
    playSfx('anRemove');
    setHintNode(null);
    setPath((list) => list.slice(0, -1));
  }

  function next() {
    if (!ended?.next) return;
    setRound(ended.next);
    setPath([ended.next.from]);
    setHintNode(null);
    setHintsLeft(ended.next.hintsLeft);
    setEnded(null);
    void act({ action: 'begin' });
  }

  return (
    <div className="space-y-4">
      <TurnHeader label={`Ligação ${Math.min(past.length + (ended ? 0 : 1), round.rounds)} de ${round.rounds}`} level={round.level} points={gained} />
      <RoundDots total={round.rounds} past={past} current={past.length} />
      {left !== null && round.timePerRound !== null && !ended && !finished ? <TimeBar left={left} total={round.timePerRound} unit="para esta ligação" /> : null}

      {ended ? (
        <TurnFeedback
          tone={ended.end.reached ? 'success' : 'danger'}
          title={ended.end.reached ? `${ended.end.steps} ${ended.end.steps === 1 ? 'elo' : 'elos'} (o menor tem ${ended.end.shortest})` : ended.end.timedOut ? 'O tempo acabou' : 'Não foi dessa vez'}
          answer={`${round.from} → ${round.to}`}
          points={ended.end.points}
          onNext={ended.next ? next : undefined}
          extra={
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">O caminho mais curto</p>
              <ol className="flex flex-wrap items-center justify-center gap-1 text-sm">
                {ended.end.best.map((node, index) => (
                  <li key={index} className="flex items-center gap-1">
                    {index > 0 ? <span className="text-muted">→</span> : null}
                    <span className="flex items-center gap-1 rounded-full bg-surface-3 px-2.5 py-1 font-display font-bold text-ink">
                      <Face name={node} images={images} size="h-5 w-5" />
                      {node}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          }
        />
      ) : (
        <>
          <p className="text-sm font-semibold text-muted">
            Ligue <b className="text-ink">{round.from}</b> a <b className="text-ink">{round.to}</b> escolhendo, a cada passo, uma relação. Menos elos, mais pontos.
          </p>
          <ol className="flex flex-wrap items-center gap-1.5 text-sm" aria-label="Seu caminho">
            {path.map((node, index) => (
              <li key={index} className="flex items-center gap-1.5">
                {index > 0 ? <span className="text-muted">→</span> : null}
                <span className={cn('flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 font-display font-bold', index === path.length - 1 ? 'bg-primary text-on-primary' : 'bg-surface-3 text-ink', !images[node] && 'pl-3')}>
                  <Face name={node} images={images} />
                  {node}
                </span>
              </li>
            ))}
            <li className="flex items-center gap-1.5 text-muted">
              → 🏁 <Face name={round.to} images={images} /> {round.to}
            </li>
          </ol>
          {message ? <Alert tone="danger">{message}</Alert> : null}
          <ul className="grid gap-2" aria-label={`Relações de ${here}`}>
            {options.map((option) => (
              <li key={`${option.to}-${option.phrase}`}>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => go(option.to)}
                  className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition active:scale-[0.98]', hintNode?.node === option.to ? 'animate-pulse bg-accent/30 ring-2 ring-accent' : 'bg-surface-3')}
                >
                  <Face name={option.to} images={images} size="h-9 w-9" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-muted">{option.phrase}</span>
                    <span className="block font-display text-base font-bold text-ink">{option.to}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" size="sm" disabled={path.length < 2 || locked} onClick={back}>
              Voltar um passo
            </Button>
            <Button variant="secondary" className="flex-1" size="sm" disabled={hintsLeft <= 0 || locked} onClick={() => void act({ action: 'hint', path })}>
              💡 Dica ({hintsLeft})
            </Button>
          </div>
          {!finished ? (
            <Button variant="ghost" size="sm" className="w-full" disabled={locked} onClick={() => void act({ action: 'skip' })}>
              Pular esta ligação
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
