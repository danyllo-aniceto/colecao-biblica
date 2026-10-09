import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialogs';
import { Select } from '@/components/ui/select';
import { errorMessage, useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { actMiniGame, type SwapEvent, type SwapPuzzle, type SwapReveal } from '@/lib/minigames-api';
import { playSfx } from '@/lib/sound/sfx';
import type { GameProps, SetupRender } from './play-frame';
import { SIZE_EMOJI, SIZE_LABEL, SIZE_SCALE, SetupShell, SizeLevelField, TimeBar, TimerField, readStored, useTurnClock, writeStored, type SizeLevel } from './turn-kit';

// ---------- Tela de preparo ----------

const LEVEL_TEXT: Record<SizeLevel, string> = {
  facil: '9 peças (3×3) · números nas peças e a imagem sempre à mostra · 3 dicas',
  medio: '16 peças (4×4) · 3 espiadas na imagem · 4 dicas',
  dificil: '25 peças (5×5) · 1 espiada na imagem · 5 dicas',
  mestre: '36 peças (6×6) · 2 espiadas na imagem · 6 dicas',
};
type Kind = 'mix' | 'personagens' | 'cenarios';
const KINDS: Array<{ value: Kind; label: string; description: string }> = [
  { value: 'mix', label: 'Personagens e cenários', description: 'A imagem pode ser um retrato ou um mapa' },
  { value: 'personagens', label: 'Só personagens', description: 'O retrato de um personagem do álbum' },
  { value: 'cenarios', label: 'Só cenários', description: 'O mapa de um cenário da campanha' },
];
const TIMES = ['120', '240', '420', '600', '900'] as const;
const KEY = 'quebra-cabeca-escolhas';
type Choice = { level: SizeLevel; kind: Kind; timed: boolean; time: string };
const FALLBACK: Choice = { level: 'facil', kind: 'mix', timed: false, time: '420' };
const minutes = (value: string) => `${Number(value) / 60} min`;

/** Antes de começar: número de peças (nível), de onde vem a imagem e tempo. */
export const swapPuzzleSetup: SetupRender = ({ onStart }) => <SwapPuzzleSetup onStart={onStart} />;

function SwapPuzzleSetup({ onStart }: { onStart: (options: object) => void }) {
  const [choice, setChoice] = useState<Choice>(() =>
    readStored(KEY, FALLBACK, (saved) => ({
      level: saved.level && saved.level in SIZE_SCALE ? saved.level : FALLBACK.level,
      kind: KINDS.some((kind) => kind.value === saved.kind) ? (saved.kind as Kind) : FALLBACK.kind,
      timed: typeof saved.timed === 'boolean' ? saved.timed : FALLBACK.timed,
      time: TIMES.includes(saved.time as never) ? (saved.time as string) : FALLBACK.time,
    })),
  );
  const update = (patch: Partial<Choice>) => setChoice((current) => ({ ...current, ...patch }));
  return (
    <SetupShell
      intro="Monte a imagem de um personagem ou de um cenário. Toque numa peça e depois em outra para trocá-las, ou arraste uma sobre a outra."
      tips={[`🎯 Pontuação máxima nesta escolha: ${Math.round(1000 * SIZE_SCALE[choice.level]).toLocaleString('pt-BR')} pontos.`, '🔁 Menos trocas, mais pontos.', '💡 A dica coloca uma peça no lugar (−40 pontos).', '👁 Espiar a imagem inteira tem custo nos níveis mais altos.']}
      onStart={() => {
        writeStored(KEY, choice);
        onStart({ difficulty: choice.level, kind: choice.kind, time: choice.timed ? Number(choice.time) : null });
      }}
    >
      <SizeLevelField label="Dificuldade (quantidade de peças)" value={choice.level} onChange={(level) => update({ level })} texts={LEVEL_TEXT} />
      <div className="space-y-1.5">
        <span className="block font-display text-sm font-bold text-ink">De onde vem a imagem</span>
        <Select<Kind> aria-label="De onde vem a imagem" value={choice.kind} onChange={(kind) => update({ kind })} options={KINDS} />
      </div>
      <TimerField label="Contar o tempo" timed={choice.timed} onTimed={(timed) => update({ timed })} time={choice.time} onTime={(time) => update({ time })} options={TIMES} format={minutes} unitLabel="Minutos" offNote="Sem pressa, mas o bônus de rapidez continua valendo." />
    </SetupShell>
  );
}

// ---------- A partida ----------

type Swap = [number, number];

/** Uma peça: o pedaço (linha, coluna) da imagem, recortada no centro em quadrado. */
function Piece({ puzzle, piece }: { puzzle: SwapPuzzle; piece: number }) {
  const side = puzzle.side;
  const row = Math.floor(piece / side);
  const col = piece % side;
  if (!puzzle.imageUrl) {
    return (
      <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary to-accent font-display text-xl font-bold text-on-primary">{piece + 1}</span>
    );
  }
  return (
    <img
      src={puzzle.imageUrl}
      alt=""
      draggable={false}
      className="pointer-events-none absolute max-w-none select-none object-cover"
      style={{ width: `${side * 100}%`, height: `${side * 100}%`, left: `${-col * 100}%`, top: `${-row * 100}%` }}
    />
  );
}

/** Quebra-cabeça: toque ou arraste peças para trocá-las. Dica coloca uma peça no lugar; a imagem inteira aparece no fim. */
export function SwapPuzzleGame({ puzzle, runId, submit, finished, result }: GameProps<SwapPuzzle>) {
  const toast = useToast();
  const dialogs = useDialogs();
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [order, setOrder] = useState(puzzle.order);
  const [swaps, setSwaps] = useState<Swap[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [drag, setDrag] = useState<{ from: number; over: number; moved: boolean } | null>(null);
  const [glow, setGlow] = useState<Swap | null>(null);
  const [hintsLeft, setHintsLeft] = useState(puzzle.hintsLeft);
  const [peeksLeft, setPeeksLeft] = useState(puzzle.peeksLeft);
  const [reference, setReference] = useState(false);
  const [asking, setAsking] = useState(false);
  const [sending, setSending] = useState(false);
  const orderRef = useRef(order);
  const swapsRef = useRef(swaps);
  const sendingRef = useRef(false);
  orderRef.current = order;
  swapsRef.current = swaps;
  const pieces = puzzle.side * puzzle.side;
  const placed = order.filter((piece, position) => piece === position).length;
  const locked = finished || sending || glow !== null;

  const send = useCallback(async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    await submit({ swaps: swapsRef.current });
    sendingRef.current = false;
    setSending(false);
  }, [submit]);

  const left = useTurnClock({ total: puzzle.timeLimit, active: !finished, resetKey: 0, onZero: () => void send() });

  useEffect(() => {
    if (result) playSfx(result.solved ? 'wsWin' : 'wsLose');
  }, [result]);

  const doSwap = useCallback(
    (a: number, b: number) => {
      const next = [...orderRef.current];
      [next[a], next[b]] = [next[b], next[a]];
      const log: Swap[] = [...swapsRef.current, [a, b]];
      setOrder(next);
      setSwaps(log);
      setPicked(null);
      const landed = next[a] === a || next[b] === b;
      playSfx(landed ? 'wsFound' : 'anPick');
      if (next.every((piece, position) => piece === position)) {
        swapsRef.current = log;
        window.setTimeout(() => void send(), 500);
      }
    },
    [send],
  );

  function tap(position: number) {
    if (locked) return;
    if (picked === null) {
      setPicked(position);
      playSfx('anPick');
      return;
    }
    if (picked === position) {
      setPicked(null);
      return;
    }
    doSwap(picked, position);
  }

  /** Posição da grade sob o dedo. */
  function positionAt(event: PointerEvent): number | null {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const col = Math.floor(((event.clientX - rect.left) / rect.width) * puzzle.side);
    const row = Math.floor(((event.clientY - rect.top) / rect.height) * puzzle.side);
    if (col < 0 || row < 0 || col >= puzzle.side || row >= puzzle.side) return null;
    return row * puzzle.side + col;
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (locked || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const position = positionAt(event);
    if (position === null) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ from: position, over: position, moved: false });
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const position = positionAt(event);
    if (position === null || position === drag.over) return;
    setDrag({ ...drag, over: position, moved: true });
  }

  function onPointerUp() {
    const current = drag;
    setDrag(null);
    if (!current || locked) return;
    if (current.moved && current.over !== current.from) {
      doSwap(current.from, current.over);
      return;
    }
    tap(current.from);
  }

  async function ask(body: object): Promise<SwapEvent | undefined> {
    setAsking(true);
    try {
      return (await actMiniGame(runId, body)).turn as SwapEvent | undefined;
    } catch (reason) {
      toast.error(errorMessage(reason));
      return undefined;
    } finally {
      setAsking(false);
    }
  }

  async function hint() {
    const event = await ask({ action: 'hint', swaps: swapsRef.current });
    if (event?.kind !== 'hint') return;
    setHintsLeft(event.left);
    setPicked(null);
    playSfx('wsHint');
    // Mostra as duas peças um instante e faz a troca.
    setGlow(event.swap);
    window.setTimeout(() => {
      setGlow(null);
      doSwap(event.swap[0], event.swap[1]);
    }, 900);
  }

  async function peekReference() {
    if (puzzle.peeksLeft !== null) {
      const event = await ask({ action: 'reference' });
      if (event?.kind !== 'reference') return;
      setPeeksLeft(event.left);
    }
    setReference(true);
    playSfx('open');
    window.setTimeout(() => setReference(false), 3000);
  }

  async function giveUp() {
    const confirmed = await dialogs.confirm({ title: 'Desistir do quebra-cabeça?', message: `Você pôs ${placed} de ${pieces} peças no lugar. Vale só o que já está certo.`, confirmLabel: 'Desistir', tone: 'danger' });
    if (confirmed) void send();
  }

  const reveal = result?.reveal as SwapReveal | undefined;
  const free = puzzle.peeksLeft === null;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-xs font-bold">
        <span className="rounded-full bg-surface-3 px-3 py-1 text-ink">
          {placed} de {pieces} no lugar
        </span>
        <span className="rounded-full bg-primary/15 px-3 py-1 text-primary-strong dark:text-primary">
          {SIZE_EMOJI[puzzle.level]} {SIZE_LABEL[puzzle.level]}
        </span>
        <span className="rounded-full bg-success/15 px-3 py-1 text-success-strong dark:text-success">
          {swaps.length} {swaps.length === 1 ? 'troca' : 'trocas'}
        </span>
      </div>
      {left !== null && puzzle.timeLimit !== null && !finished ? <TimeBar left={left} total={puzzle.timeLimit} unit="para montar" /> : null}

      <div className="relative mx-auto max-w-sm">
        <div
          ref={gridRef}
          data-sound="off"
          role="grid"
          aria-label="Peças do quebra-cabeça"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => setDrag(null)}
          className="grid touch-none select-none gap-0.5 rounded-2xl bg-surface-3 p-1"
          style={{ gridTemplateColumns: `repeat(${puzzle.side}, minmax(0, 1fr))` }}
        >
          {order.map((piece, position) => {
            const right = piece === position;
            const active = picked === position || drag?.from === position;
            const target = drag?.moved && drag.over === position && drag.from !== position;
            const lit = glow !== null && (glow[0] === position || glow[1] === position);
            return (
              <div
                key={position}
                role="gridcell"
                aria-label={`Peça ${piece + 1} na posição ${position + 1}`}
                className={cn(
                  'relative aspect-square overflow-hidden rounded-md transition',
                  active && 'z-10 scale-95 ring-4 ring-primary',
                  target && 'ring-4 ring-accent',
                  lit && 'animate-pulse ring-4 ring-accent',
                  right && !active && !target && !lit && 'ring-2 ring-success/70',
                )}
              >
                <Piece puzzle={puzzle} piece={piece} />
                {puzzle.numbers && puzzle.imageUrl ? <span className="absolute left-0.5 top-0.5 rounded bg-black/55 px-1 text-[10px] font-bold leading-4 text-white">{piece + 1}</span> : null}
              </div>
            );
          })}
        </div>
        {reference && puzzle.imageUrl ? <img src={puzzle.imageUrl} alt={`Imagem completa de ${puzzle.title}`} className="absolute inset-0 h-full w-full animate-pop-in rounded-2xl object-cover shadow-xl" /> : null}
      </div>

      {!finished ? (
        <>
          <div className="flex gap-2">
            <Button className="flex-1" variant="secondary" size="sm" loading={asking} disabled={hintsLeft <= 0 || locked} onClick={() => void hint()}>
              💡 Colocar uma peça ({hintsLeft})
            </Button>
            {puzzle.imageUrl ? (
              <Button className="flex-1" variant="secondary" size="sm" loading={asking} disabled={reference || locked || (!free && (peeksLeft ?? 0) <= 0)} onClick={() => void peekReference()}>
                👁 Ver a imagem{free ? '' : ` (${peeksLeft})`}
              </Button>
            ) : null}
          </div>
          <Button variant="ghost" size="sm" className="w-full" loading={sending} onClick={() => void giveUp()}>
            Desistir
          </Button>
        </>
      ) : reveal ? (
        <div className="panel animate-pop-in space-y-2 p-3 text-center">
          {reveal.imageUrl ? <img src={reveal.imageUrl} alt={reveal.title} className="mx-auto max-h-60 w-full max-w-60 rounded-2xl object-cover" /> : null}
          <p className="font-display text-xl font-bold text-ink">{reveal.title}</p>
          {reveal.summary ? <p className="text-sm font-semibold text-muted">{reveal.summary}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
