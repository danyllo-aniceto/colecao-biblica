import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialogs';
import { Select } from '@/components/ui/select';
import { errorMessage, useToast } from '@/components/ui/toast';
import { Pawn } from '@/components/user/board/board-track';
import { BASE_PAWNS, usePawnOptions } from '@/components/user/board/use-pawn-options';
import { cn } from '@/lib/cn';
import { actMiniGame, type MazeEvent, type MazePuzzle, type MazeReveal } from '@/lib/minigames-api';
import { playSfx } from '@/lib/sound/sfx';
import type { GameProps, SetupRender } from './play-frame';
import { SIZE_EMOJI, SIZE_LABEL, SIZE_SCALE, SetupShell, SizeLevelField, TimeBar, TimerField, readStored, useTurnClock, writeStored, type SizeLevel } from './turn-kit';

// ---------- Tela de preparo ----------

const LEVEL_TEXT: Record<SizeLevel, string> = {
  facil: 'Labirinto pequeno (8 × 10) · mapa todo à vista · 3 dicas de caminho',
  medio: 'Labirinto médio (11 × 14) · mapa todo à vista · 3 dicas',
  dificil: 'Labirinto grande (14 × 18) · névoa: você só enxerga por perto · 2 dicas',
  mestre: 'Labirinto enorme (18 × 24) · névoa fechada · 2 dicas',
};
const TIMES = ['60', '120', '240', '420', '600'] as const;
const KEY = 'labirinto-escolhas';
type Choice = { level: SizeLevel; timed: boolean; time: string; pawn: string };
const FALLBACK: Choice = { level: 'facil', timed: false, time: '240', pawn: BASE_PAWNS[0]?.value ?? '🐑' };
const minutes = (value: string) => (Number(value) < 120 ? `${value}s` : `${Number(value) / 60} min`);

/** Antes de começar: tamanho do labirinto (nível), o seu peão (os mesmos do Tabuleiro) e o tempo. */
export const mazeSetup: SetupRender = ({ onStart }) => <MazeSetup onStart={onStart} />;

function MazeSetup({ onStart }: { onStart: (options: object) => void }) {
  const pawns = usePawnOptions(true);
  const [choice, setChoice] = useState<Choice>(() =>
    readStored(KEY, FALLBACK, (saved) => ({
      level: saved.level && saved.level in SIZE_SCALE ? saved.level : FALLBACK.level,
      timed: typeof saved.timed === 'boolean' ? saved.timed : FALLBACK.timed,
      time: TIMES.includes(saved.time as never) ? (saved.time as string) : FALLBACK.time,
      pawn: typeof saved.pawn === 'string' && saved.pawn ? saved.pawn : FALLBACK.pawn,
    })),
  );
  const update = (patch: Partial<Choice>) => setChoice((current) => ({ ...current, ...patch }));
  // Se o peão guardado não está mais no armário, usa o primeiro disponível.
  const pawn = pawns.some((option) => option.value === choice.pawn) ? choice.pawn : (pawns[0]?.value ?? choice.pawn);
  return (
    <SetupShell
      intro="Leve o seu peão da entrada até a bandeira pelo caminho mais curto. Cada mapa é diferente: entrada, saída e jeito do labirinto mudam a cada partida."
      tips={[`🎯 Pontuação máxima nesta escolha: ${Math.round(1000 * SIZE_SCALE[choice.level]).toLocaleString('pt-BR')} pontos.`, '⭐ Há 3 estrelas escondidas em becos: cada uma soma pontos, mas exige um desvio.', '👆 Arraste o peão com o dedo, use as setas na tela ou o teclado.', '💡 A dica mostra os próximos passos certos (−40 pontos).']}
      onStart={() => {
        writeStored(KEY, { ...choice, pawn });
        onStart({ difficulty: choice.level, time: choice.timed ? Number(choice.time) : null });
      }}
    >
      <SizeLevelField label="Dificuldade (tamanho do labirinto)" value={choice.level} onChange={(level) => update({ level })} texts={LEVEL_TEXT} />
      <div className="space-y-1.5">
        <span className="block font-display text-sm font-bold text-ink">Seu peão</span>
        <Select<string>
          aria-label="Seu peão"
          value={pawn}
          onChange={(value) => update({ pawn: value })}
          options={pawns.map((option) => ({ value: option.value, label: option.name, icon: <Pawn emoji={option.value} className="text-xl" /> }))}
        />
      </div>
      <TimerField label="Contar o tempo" timed={choice.timed} onTimed={(timed) => update({ timed })} time={choice.time} onTime={(time) => update({ time })} options={TIMES} format={minutes} unitLabel="Tempo para chegar à saída" offNote="Sem pressa, mas o bônus de rapidez continua valendo." />
    </SetupShell>
  );
}

// ---------- A partida ----------

const OPEN = { U: 1, R: 2, D: 4, L: 8 } as const;
type Move = keyof typeof OPEN;
const STEP: Record<Move, [number, number]> = { U: [-1, 0], R: [0, 1], D: [1, 0], L: [0, -1] };

/** Labirinto: arraste o peão (ou use as setas) da entrada até a bandeira. Névoa nos níveis altos, estrelas nos becos e dica de caminho. */
export function MazeGame({ puzzle, runId, submit, finished, result }: GameProps<MazePuzzle>) {
  const toast = useToast();
  const dialogs = useDialogs();
  const { width, height, cells, goal } = puzzle;
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [at, setAt] = useState(puzzle.start);
  const [moves, setMoves] = useState('');
  const [trail, setTrail] = useState<Set<number>>(() => new Set([puzzle.start]));
  const [seen, setSeen] = useState<Set<number>>(() => new Set());
  const [taken, setTaken] = useState<Set<number>>(new Set());
  const [hintCells, setHintCells] = useState<number[]>([]);
  const [hintsLeft, setHintsLeft] = useState(puzzle.hintsLeft);
  const [asking, setAsking] = useState(false);
  const [sending, setSending] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pawn] = useState(() => readStored(KEY, FALLBACK, (saved) => ({ ...FALLBACK, pawn: typeof saved.pawn === 'string' && saved.pawn ? saved.pawn : FALLBACK.pawn })).pawn);
  const stateRef = useRef({ at: puzzle.start, moves: '' });
  const sendingRef = useRef(false);
  const hintTimer = useRef<number | undefined>(undefined);
  const locked = finished || sending;

  const send = useCallback(async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    await submit({ moves: stateRef.current.moves });
    sendingRef.current = false;
    setSending(false);
  }, [submit]);

  const left = useTurnClock({ total: puzzle.timeLimit, active: !finished, resetKey: 0, onZero: () => void send() });

  useEffect(() => {
    if (result) playSfx(result.solved ? 'wsWin' : 'wsLose');
  }, [result]);
  useEffect(() => () => window.clearTimeout(hintTimer.current), []);

  /** O que o peão enxerga: células dentro do raio da névoa (sem névoa, tudo). */
  const reveal = useCallback(
    (cell: number) => {
      if (puzzle.fog === null) return;
      const row = Math.floor(cell / width);
      const col = cell % width;
      setSeen((current) => {
        const next = new Set(current);
        for (let r = Math.max(0, row - puzzle.fog!); r <= Math.min(height - 1, row + puzzle.fog!); r += 1) {
          for (let c = Math.max(0, col - puzzle.fog!); c <= Math.min(width - 1, col + puzzle.fog!); c += 1) {
            if (Math.hypot(r - row, c - col) <= puzzle.fog! + 0.3) next.add(r * width + c);
          }
        }
        return next;
      });
    },
    [height, puzzle.fog, width],
  );

  useEffect(() => reveal(puzzle.start), [reveal, puzzle.start]);

  /** Anda uma casa na direção, se não houver parede. Devolve se andou. */
  const move = useCallback(
    (direction: Move, quiet = false) => {
      const { at: current, moves: log } = stateRef.current;
      if (finished || sendingRef.current || current === goal) return false;
      if (!(cells[current] & OPEN[direction])) {
        if (!quiet) playSfx('soft');
        return false;
      }
      const [dr, dc] = STEP[direction];
      const next = (Math.floor(current / width) + dr) * width + ((current % width) + dc);
      stateRef.current = { at: next, moves: log + direction };
      setAt(next);
      setMoves(log + direction);
      setTrail((previous) => new Set(previous).add(next));
      reveal(next);
      if (puzzle.stars.includes(next)) {
        setTaken((previous) => {
          if (previous.has(next)) return previous;
          playSfx('wsFound');
          return new Set(previous).add(next);
        });
      } else {
        playSfx('wsTick', 1 + ((log.length + 1) % 8) * 0.05);
      }
      if (next === goal) window.setTimeout(() => void send(), 500);
      return true;
    },
    [cells, finished, goal, puzzle.stars, reveal, send, width],
  );

  useEffect(() => {
    const keys: Record<string, Move> = { ArrowUp: 'U', ArrowRight: 'R', ArrowDown: 'D', ArrowLeft: 'L' };
    const onKey = (event: KeyboardEvent) => {
      const direction = keys[event.key];
      if (!direction) return;
      event.preventDefault();
      move(direction);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move]);

  /** A célula sob o dedo. */
  function cellAt(event: PointerEvent): number | null {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const col = Math.min(width - 1, Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * width)));
    const row = Math.min(height - 1, Math.max(0, Math.floor(((event.clientY - rect.top) / rect.height) * height)));
    return row * width + col;
  }

  /** Puxa o peão para a célula do dedo, uma casa por vez, parando na primeira parede. */
  function pull(target: number) {
    for (let guard = 0; guard < 12; guard += 1) {
      const current = stateRef.current.at;
      if (current === target) return;
      const dr = Math.floor(target / width) - Math.floor(current / width);
      const dc = (target % width) - (current % width);
      const horizontal: Move = dc > 0 ? 'R' : 'L';
      const vertical: Move = dr > 0 ? 'D' : 'U';
      const order: Move[] = Math.abs(dc) >= Math.abs(dr) ? [horizontal, vertical] : [vertical, horizontal];
      const choices = order.filter((direction) => (direction === horizontal ? dc !== 0 : dr !== 0));
      if (!choices.some((direction) => move(direction, true))) return;
    }
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (locked) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    const target = cellAt(event);
    if (target !== null) pull(target);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragging || locked) return;
    const target = cellAt(event);
    if (target !== null) pull(target);
  }

  async function askHint() {
    setAsking(true);
    try {
      const response = await actMiniGame(runId, { action: 'hint', moves: stateRef.current.moves });
      const event = response.turn as MazeEvent | undefined;
      if (event?.kind !== 'hint') return;
      setHintsLeft(event.left);
      playSfx('wsHint');
      // Marca as casas dos próximos passos por alguns segundos.
      let cell = stateRef.current.at;
      const path: number[] = [];
      for (const step of event.steps as unknown as Move[]) {
        cell += STEP[step][0] * width + STEP[step][1];
        path.push(cell);
        reveal(cell);
      }
      setHintCells(path);
      window.clearTimeout(hintTimer.current);
      hintTimer.current = window.setTimeout(() => setHintCells([]), 5000);
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setAsking(false);
    }
  }

  async function giveUp() {
    const confirmed = await dialogs.confirm({ title: 'Desistir do labirinto?', message: 'Vale só o pedaço do caminho que você já andou.', confirmLabel: 'Desistir', tone: 'danger' });
    if (confirmed) void send();
  }

  const best = useMemo(() => {
    const info = result?.reveal as MazeReveal | undefined;
    if (!info) return new Set<number>();
    let cell = puzzle.start;
    const path = new Set<number>([cell]);
    for (const step of info.best as unknown as Move[]) {
      cell += STEP[step][0] * width + STEP[step][1];
      path.add(cell);
    }
    return path;
  }, [result, puzzle.start, width]);

  const fogged = (cell: number) => puzzle.fog !== null && !finished && !seen.has(cell);
  const wall = width > 14 ? '1.5px' : '2px';
  const starsTaken = taken.size;
  const pad = 'flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-3 text-ink transition active:scale-95 disabled:opacity-40';
  const info = result?.reveal as MazeReveal | undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
        <span className="rounded-full bg-surface-3 px-3 py-1 text-ink">{puzzle.styleLabel}</span>
        <span className="rounded-full bg-primary/15 px-3 py-1 text-primary-strong dark:text-primary">
          {SIZE_EMOJI[puzzle.level]} {SIZE_LABEL[puzzle.level]}
        </span>
        <span className="rounded-full bg-accent/25 px-3 py-1 text-ink">
          ⭐ {starsTaken}/{puzzle.stars.length}
        </span>
        <span className="rounded-full bg-success/15 px-3 py-1 text-success-strong dark:text-success">
          {moves.length} {moves.length === 1 ? 'passo' : 'passos'}
        </span>
      </div>
      {left !== null && puzzle.timeLimit !== null && !finished ? <TimeBar left={left} total={puzzle.timeLimit} unit="para chegar à saída" /> : null}

      <div
        ref={boardRef}
        data-sound="off"
        role="application"
        aria-label={`Labirinto de ${puzzle.title}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        className="relative mx-auto w-full max-w-md touch-none select-none overflow-hidden rounded-xl border-2 border-edge-strong bg-surface-3"
        style={{ aspectRatio: `${width} / ${height}`, containerType: 'inline-size' }}
      >
        {puzzle.imageUrl ? <img src={puzzle.imageUrl} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30" /> : null}
        <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${height}, minmax(0, 1fr))`, fontSize: `${80 / width}cqw` }}>
          {cells.map((bits, index) => {
            const hidden = fogged(index);
            return (
              <div
                key={index}
                className={cn('relative flex items-center justify-center leading-none', trail.has(index) && 'bg-primary/15', hintCells.includes(index) && 'bg-accent/50', best.has(index) && 'bg-success/35')}
                style={{
                  borderTop: `${wall} solid ${bits & OPEN.U ? 'transparent' : 'var(--edge-strong)'}`,
                  borderRight: `${wall} solid ${bits & OPEN.R ? 'transparent' : 'var(--edge-strong)'}`,
                  borderBottom: `${wall} solid ${bits & OPEN.D ? 'transparent' : 'var(--edge-strong)'}`,
                  borderLeft: `${wall} solid ${bits & OPEN.L ? 'transparent' : 'var(--edge-strong)'}`,
                }}
              >
                {index === goal ? <span className={cn('text-[1em]', hidden && 'opacity-0')}>🏁</span> : puzzle.stars.includes(index) && !taken.has(index) ? <span className={cn('text-[0.9em]', hidden && 'opacity-0')}>⭐</span> : null}
                {hidden ? <span className="absolute -inset-px bg-ink/90" /> : puzzle.fog !== null && !finished && Math.hypot(Math.floor(index / width) - Math.floor(at / width), (index % width) - (at % width)) > puzzle.fog + 0.3 ? <span className="absolute -inset-px bg-ink/35" /> : null}
              </div>
            );
          })}
        </div>
        <span
          className={cn('pointer-events-none absolute flex items-center justify-center transition-[left,top] duration-100 ease-out', dragging && 'scale-110')}
          style={{ left: `${((at % width) / width) * 100}%`, top: `${(Math.floor(at / width) / height) * 100}%`, width: `${100 / width}%`, height: `${100 / height}%`, fontSize: `${70 / width}cqw` }}
        >
          <Pawn emoji={pawn} active={!finished && at === puzzle.start && moves.length === 0} className="text-[1em]" />
        </span>
      </div>

      {!finished ? (
        <>
          <div className="mx-auto grid w-fit grid-cols-3 gap-1.5" role="group" aria-label="Direções" data-sound="off">
            <span />
            <button type="button" className={pad} disabled={locked} onClick={() => move('U')} aria-label="Subir">
              <ArrowUpwardRoundedIcon />
            </button>
            <span />
            <button type="button" className={pad} disabled={locked} onClick={() => move('L')} aria-label="Ir para a esquerda">
              <ArrowBackRoundedIcon />
            </button>
            <button type="button" className={pad} disabled={locked} onClick={() => move('D')} aria-label="Descer">
              <ArrowDownwardRoundedIcon />
            </button>
            <button type="button" className={pad} disabled={locked} onClick={() => move('R')} aria-label="Ir para a direita">
              <ArrowForwardRoundedIcon />
            </button>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" variant="secondary" size="sm" loading={asking} disabled={hintsLeft <= 0 || locked} onClick={() => void askHint()}>
              💡 Mostrar o caminho ({hintsLeft})
            </Button>
            <Button className="flex-1" variant="ghost" size="sm" loading={sending} onClick={() => void giveUp()}>
              Desistir
            </Button>
          </div>
        </>
      ) : info ? (
        <p className="text-center text-xs font-bold text-muted">Em verde: o caminho mais curto ({info.best.length} passos). Mapa: {info.title}.</p>
      ) : null}
    </div>
  );
}
