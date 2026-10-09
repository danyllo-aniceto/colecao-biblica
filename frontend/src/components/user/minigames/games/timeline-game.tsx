import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialogs';
import { cn } from '@/lib/cn';
import type { MiniGameResult, TimelineCard, TimelineEnd, TimelineEvent, TimelinePlaced, TimelinePuzzle } from '@/lib/minigames-api';
import { playSfx } from '@/lib/sound/sfx';
import type { GameProps, SetupRender } from './play-frame';
import { CountField, LEVEL_SCALE, LevelField, SetupShell, TimerField, TimeBar, TurnHeader, readStored, useTurnAct, useTurnClock, writeStored, type Level } from './turn-kit';

// ---------- Tela de preparo ----------

const LEVEL_TEXT: Record<Level, string> = {
  facil: 'Datas bem espaçadas · 5 vidas · 3 dicas de época',
  medio: 'Datas mais próximas · 4 vidas · 2 dicas de época',
  dificil: 'Datas bem próximas · 3 vidas · 1 dica de época',
};
const COUNTS = ['8', '12', '16', '20'] as const;
const TIMES = ['10', '15', '20', '30'] as const;
const KEY = 'linha-do-tempo-escolhas';
type Choice = { level: Level; count: string; timed: boolean; time: string };
const FALLBACK: Choice = { level: 'medio', count: '12', timed: false, time: '20' };

/** Antes de começar: dificuldade (vidas e distância entre as datas), quantas cartas e tempo por carta. */
export const timelineSetup: SetupRender = ({ onStart }) => <TimelineSetup onStart={onStart} />;

function TimelineSetup({ onStart }: { onStart: (options: object) => void }) {
  const [choice, setChoice] = useState<Choice>(() =>
    readStored(KEY, FALLBACK, (saved) => ({
      level: saved.level && saved.level in LEVEL_SCALE ? saved.level : FALLBACK.level,
      count: COUNTS.includes(saved.count as never) ? (saved.count as string) : FALLBACK.count,
      timed: typeof saved.timed === 'boolean' ? saved.timed : FALLBACK.timed,
      time: TIMES.includes(saved.time as never) ? (saved.time as string) : FALLBACK.time,
    })),
  );
  const update = (patch: Partial<Choice>) => setChoice((current) => ({ ...current, ...patch }));
  return (
    <SetupShell
      intro="Uma carta aparece por vez: um personagem, um cenário ou um acontecimento. Coloque-a na linha do tempo, antes ou depois das que já estão lá. Errou a posição, perde uma vida."
      tips={[`🎯 Pontuação máxima nesta escolha: ${Math.round(1000 * LEVEL_SCALE[choice.level]).toLocaleString('pt-BR')} pontos.`, '🏆 Vence quem coloca todas as cartas sem perder as vidas.', '📅 As cartas já postas mostram a data aproximada: use-as como referência.', '👆 Arraste a carta até o lugar na linha, ou toque no lugar.']}
      onStart={() => {
        writeStored(KEY, choice);
        onStart({ difficulty: choice.level, rounds: Number(choice.count), time: choice.timed ? Number(choice.time) : null });
      }}
    >
      <LevelField value={choice.level} onChange={(level) => update({ level })} texts={LEVEL_TEXT} />
      <CountField label="Quantas cartas" value={choice.count} onChange={(count) => update({ count })} options={COUNTS} />
      <TimerField label="Contar o tempo por carta" timed={choice.timed} onTimed={(timed) => update({ timed })} time={choice.time} onTime={(time) => update({ time })} options={TIMES} offNote="Sem pressa, mas cada carta vale 15% menos." />
    </SetupShell>
  );
}

// ---------- A partida ----------

function Thumb({ card, size = 'h-12 w-12' }: { card: TimelineCard; size?: string }) {
  return card.imageUrl ? (
    <img src={card.imageUrl} alt="" loading="lazy" draggable={false} className={cn('shrink-0 rounded-xl bg-surface-3 object-cover', size)} />
  ) : (
    <span className={cn('flex shrink-0 items-center justify-center rounded-xl bg-surface-3 text-2xl', size)} aria-hidden>
      {card.emoji}
    </span>
  );
}

const KIND_NAME = { character: 'Personagem', place: 'Cenário', event: 'Acontecimento' } as const;
/** Tempo que o resultado fica na tela antes de a próxima carta entrar. */
const PAUSE_MS = 2000;

/** Linha do tempo: a carta da vez vai para a linha, do mais antigo (em cima) ao mais recente (embaixo). */
export function TimelineGame({ puzzle, runId, report, finished }: GameProps<TimelinePuzzle> & { report: (result: MiniGameResult) => void }) {
  const dialogs = useDialogs();
  const [state, setState] = useState(puzzle);
  const [placed, setPlaced] = useState<TimelinePlaced[]>(puzzle.placed);
  const [lives, setLives] = useState(puzzle.lives);
  const [ended, setEnded] = useState<{ end: TimelineEnd; next: TimelinePuzzle | null; gameOver: boolean } | null>(null);
  const [hints, setHints] = useState(puzzle.hints);
  const [hintsLeft, setHintsLeft] = useState(puzzle.hintsLeft);
  const [gained, setGained] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const [lostBeat, setLostBeat] = useState(0);
  const endedRef = useRef<typeof ended>(null);
  const pause = useRef<number | undefined>(undefined);
  const pointer = useRef({ x: 0, y: 0 });
  const scrollTimer = useRef<number | undefined>(undefined);

  const onEvent = useCallback((event: TimelineEvent) => {
    if (event.kind === 'hint') {
      setHints(event.hints);
      setHintsLeft(event.hintsLeft);
      playSfx('wsHint');
    } else if (event.kind === 'end') {
      setPlaced(event.placed);
      setLives(event.lives);
      setGained((current) => current + event.end.points);
      setEnded({ end: event.end, next: event.next, gameOver: event.gameOver });
      if (event.end.right) playSfx('anRight');
      else {
        playSfx(event.end.timedOut ? 'anTimeout' : 'anWrong');
        setLostBeat((value) => value + 1);
      }
    }
  }, []);
  endedRef.current = ended;
  const { act, busy, message } = useTurnAct<TimelineEvent>(runId, report, onEvent);
  const locked = finished || busy || ended !== null;
  const left = useTurnClock({ total: state.timePerItem, active: !ended && !finished, resetKey: state.index, onZero: () => void act({ action: 'timeout' }) });

  const place = useCallback(
    (slot: number) => {
      if (locked) return;
      void act({ action: 'place', slot });
    },
    [locked, act],
  );

  const next = useCallback(() => {
    window.clearTimeout(pause.current);
    const current = endedRef.current;
    if (!current?.next) return;
    setState(current.next);
    setHints(current.next.hints);
    setHintsLeft(current.next.hintsLeft);
    setEnded(null);
    void act({ action: 'begin' });
  }, [act]);

  useEffect(() => {
    if (!ended?.next) return undefined;
    pause.current = window.setTimeout(next, PAUSE_MS);
    return () => window.clearTimeout(pause.current);
  }, [ended, next]);
  useEffect(
    () => () => {
      window.clearTimeout(pause.current);
      window.clearInterval(scrollTimer.current);
    },
    [],
  );

  /** O lugar da linha sob o dedo (cada espaço entre as cartas é um alvo). */
  function slotAt(x: number, y: number): number | null {
    const element = document.elementsFromPoint(x, y).find((candidate) => candidate instanceof HTMLElement && candidate.dataset.slot !== undefined) as HTMLElement | undefined;
    return element ? Number(element.dataset.slot) : null;
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (locked) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = { x: event.clientX, y: event.clientY };
    setGhost({ x: event.clientX, y: event.clientY });
    playSfx('anPick');
    // Rola a tela sozinho quando o dedo chega perto da borda.
    const parent = event.currentTarget.closest<HTMLElement>('[role="dialog"]');
    window.clearInterval(scrollTimer.current);
    scrollTimer.current = window.setInterval(() => {
      const { y } = pointer.current;
      if (y < 110) parent?.scrollBy(0, -14);
      else if (y > window.innerHeight - 110) parent?.scrollBy(0, 14);
      setHover(slotAt(pointer.current.x, pointer.current.y));
    }, 40);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!ghost) return;
    pointer.current = { x: event.clientX, y: event.clientY };
    setGhost({ x: event.clientX, y: event.clientY });
    setHover(slotAt(event.clientX, event.clientY));
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    window.clearInterval(scrollTimer.current);
    const target = ghost ? slotAt(event.clientX, event.clientY) : null;
    setGhost(null);
    setHover(null);
    if (target !== null) place(target);
  }

  async function giveUp() {
    const confirmed = await dialogs.confirm({ title: 'Desistir da linha do tempo?', message: `Você colocou ${placed.length - 1} cartas. Vale só o que já está certo.`, confirmLabel: 'Desistir', tone: 'danger' });
    if (confirmed) void act({ action: 'giveup' });
  }

  const card = state.card;
  const zone = (slot: number) => (
    <li key={`slot-${slot}`} className="list-none">
      <button
        type="button"
        data-slot={slot}
        data-sound="off"
        disabled={locked}
        onClick={() => place(slot)}
        aria-label={`Colocar ${card.label} na posição ${slot + 1}`}
        className={cn('flex w-full items-center justify-center rounded-xl border-2 border-dashed text-xs font-bold transition-all', hover === slot ? 'h-12 border-primary bg-primary/20 text-primary-strong dark:text-primary' : ghost ? 'h-8 border-edge-strong text-muted' : 'h-7 border-edge/60 text-muted/70 hover:border-primary hover:text-primary focus-visible:border-primary')}
      >
        {hover === slot || ghost ? 'solte aqui' : 'colocar aqui'}
      </button>
    </li>
  );

  return (
    <div className="space-y-3">
      <TurnHeader label={`Carta ${Math.min(state.index + (ended ? 0 : 1), state.total)} de ${state.total}`} level={state.level} points={gained} />
      <div key={lostBeat} className={cn('flex justify-center gap-1', lostBeat > 0 && 'animate-shake')} aria-label={`${lives} vidas restantes`}>
        {Array.from({ length: state.maxLives }, (_, index) => (
          <FavoriteRoundedIcon key={index} sx={{ fontSize: 28 }} className={cn('transition-colors', index < lives ? 'text-danger' : 'text-edge-strong')} />
        ))}
      </div>
      {left !== null && state.timePerItem !== null && !ended && !finished ? <TimeBar left={left} total={state.timePerItem} unit="para esta carta" /> : null}

      {/* A carta da vez fica sempre à vista no topo, mesmo rolando a linha. */}
      <div className="sticky top-0 z-20 -mx-1 rounded-2xl bg-bg/90 p-1 backdrop-blur">
        {ended ? (
          <div className={cn('panel animate-pop-in space-y-1 border-2 p-3', ended.end.right ? 'border-success' : 'border-danger')} role="status">
            <div className="flex items-center gap-3">
              <Thumb card={ended.end.card} />
              <div className="min-w-0 flex-1">
                <p className={cn('font-display text-sm font-bold', ended.end.right ? 'text-success-strong dark:text-success' : 'text-danger')}>
                  {ended.end.right ? `Certo! +${ended.end.points} pontos` : ended.end.timedOut ? 'O tempo acabou! Perdeu uma vida' : 'Posição errada! Perdeu uma vida'}
                </p>
                <p className="truncate font-display font-bold text-ink">{ended.end.card.label}</p>
                <p className="text-xs font-bold text-muted">{ended.end.card.yearLabel}</p>
              </div>
              {ended.next ? (
                <Button size="sm" onClick={next}>
                  Próxima
                </Button>
              ) : null}
            </div>
            {ended.gameOver ? <p className="text-center text-sm font-bold text-danger">As vidas acabaram.</p> : null}
          </div>
        ) : (
          <div
            data-sound="off"
            role="group"
            aria-label={`Carta da vez: ${card.label}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => {
              window.clearInterval(scrollTimer.current);
              setGhost(null);
              setHover(null);
            }}
            className={cn('panel flex touch-none select-none items-center gap-3 border-2 p-2.5', ghost ? 'border-primary opacity-60' : 'cursor-grab border-primary/60')}
          >
            <Thumb card={card} size="h-16 w-16" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{KIND_NAME[card.kind]} · arraste para a linha</p>
              <p className="font-display text-lg font-bold leading-tight text-ink">{card.label}</p>
              {hints.length > 0 ? (
                <ul className="mt-1 space-y-0.5 text-xs font-semibold text-accent-strong dark:text-accent">
                  {hints.map((hint) => (
                    <li key={hint}>💡 {hint}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        )}
      </div>
      {message ? <Alert tone="danger">{message}</Alert> : null}

      <ol className="panel space-y-1 p-3" aria-label="Linha do tempo">
        <li className="list-none text-xs font-bold uppercase tracking-wider text-muted">⬆ Mais antigo</li>
        {ended || finished ? null : zone(0)}
        {placed.map((item, index) => (
          <li key={item.id} className="list-none space-y-1">
            <div className={cn('flex items-center gap-3 rounded-xl p-1.5', ended?.end.card.id === item.id ? (ended.end.right ? 'animate-pop-in bg-success/20' : 'animate-pop-in bg-danger/20') : 'bg-surface-3')}>
              <Thumb card={item} size="h-10 w-10" />
              <span className="min-w-0 flex-1 truncate font-display text-sm font-bold text-ink">{item.label}</span>
              <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold text-muted">{item.yearLabel}</span>
            </div>
            {ended || finished ? null : zone(index + 1)}
          </li>
        ))}
        <li className="list-none text-xs font-bold uppercase tracking-wider text-muted">⬇ Mais recente</li>
      </ol>

      {!finished && !ended ? (
        <div className="flex gap-2">
          <Button className="flex-1" variant="secondary" size="sm" disabled={hintsLeft <= 0 || locked} onClick={() => void act({ action: 'hint' })}>
            💡 Dica de época ({hintsLeft})
          </Button>
          <Button className="flex-1" variant="ghost" size="sm" disabled={locked} onClick={() => void giveUp()}>
            Desistir
          </Button>
        </div>
      ) : null}

      {ghost ? (
        <div aria-hidden className="pointer-events-none fixed z-[80] flex w-56 -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-2xl border-2 border-primary bg-surface p-2 shadow-xl" style={{ left: ghost.x, top: ghost.y }}>
          <Thumb card={card} size="h-10 w-10" />
          <span className="truncate font-display text-sm font-bold text-ink">{card.label}</span>
        </div>
      ) : null}
    </div>
  );
}
