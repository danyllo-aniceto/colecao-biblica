import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialogs';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/cn';
import type { MemoryPuzzle } from '@/lib/minigames-api';
import { playSfx } from '@/lib/sound/sfx';
import type { GameProps, SetupRender } from './play-frame';
import { SIZE_EMOJI, SIZE_LABEL, SIZE_SCALE, SetupShell, SizeLevelField, TimeBar, TimerField, readStored, useTurnClock, writeStored, type SizeLevel } from './turn-kit';

// ---------- Tela de preparo ----------

const LEVEL_TEXT: Record<SizeLevel, string> = {
  facil: '6 pares (12 cartas) · as cartas aparecem 4 segundos no começo',
  medio: '8 pares (16 cartas) · prévia de 3 segundos',
  dificil: '12 pares (24 cartas) · prévia de 2 segundos',
  mestre: '18 pares (36 cartas) · prévia de 2 segundos',
};
type Kind = 'mix' | 'personagens' | 'cenarios' | 'versiculos';
const KINDS: Array<{ value: Kind; label: string; description: string }> = [
  { value: 'mix', label: 'Mistura', description: 'Fotos, mapas e versículos juntos' },
  { value: 'personagens', label: 'Personagens', description: 'A foto do personagem e o nome dele' },
  { value: 'cenarios', label: 'Cenários', description: 'O mapa do cenário e o nome dele' },
  { value: 'versiculos', label: 'Versículos', description: 'O cenário e a referência bíblica' },
];
const TIMES = ['90', '150', '240', '360'] as const;
const KEY = 'memoria-escolhas';
type Choice = { level: SizeLevel; kind: Kind; timed: boolean; time: string };
const FALLBACK: Choice = { level: 'facil', kind: 'mix', timed: false, time: '240' };
const minutes = (value: string) => (Number(value) % 60 === 0 ? `${Number(value) / 60} min` : `${(Number(value) / 60).toLocaleString('pt-BR')} min`);

/** Antes de começar: quantos pares (nível), que tipo de pares e tempo. */
export const memorySetup: SetupRender = ({ onStart }) => <MemorySetup onStart={onStart} />;

function MemorySetup({ onStart }: { onStart: (options: object) => void }) {
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
      intro="Vire duas cartas por vez e ache os pares. No começo todas aparecem por alguns segundos: memorize!"
      tips={[`🎯 Pontuação máxima nesta escolha: ${Math.round(1000 * SIZE_SCALE[choice.level]).toLocaleString('pt-BR')} pontos.`, '🃏 Menos tentativas e mais rapidez, mais pontos.', '📸 Os pares usam as fotos dos personagens e os mapas dos cenários.']}
      onStart={() => {
        writeStored(KEY, choice);
        onStart({ difficulty: choice.level, kind: choice.kind, time: choice.timed ? Number(choice.time) : null });
      }}
    >
      <SizeLevelField label="Dificuldade (quantidade de cartas)" value={choice.level} onChange={(level) => update({ level })} texts={LEVEL_TEXT} />
      <div className="space-y-1.5">
        <span className="block font-display text-sm font-bold text-ink">Tipo de pares</span>
        <Select<Kind> aria-label="Tipo de pares" value={choice.kind} onChange={(kind) => update({ kind })} options={KINDS} />
      </div>
      <TimerField label="Contar o tempo" timed={choice.timed} onTimed={(timed) => update({ timed })} time={choice.time} onTime={(time) => update({ time })} options={TIMES} format={minutes} unitLabel="Minutos" offNote="Sem pressa, mas o bônus de rapidez continua valendo." />
    </SetupShell>
  );
}

// ---------- A partida ----------

/** Memória: ache os pares (foto ↔ nome, mapa ↔ nome, cenário ↔ referência). Prévia das cartas no começo e tempo opcional. */
export function MemoryGame({ puzzle, submit, finished, result }: GameProps<MemoryPuzzle>) {
  const dialogs = useDialogs();
  const [previewing, setPreviewing] = useState(puzzle.peek > 0);
  const [previewLeft, setPreviewLeft] = useState(puzzle.peek);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<number>>(new Set());
  const [flips, setFlips] = useState<number[]>([]);
  const [locked, setLocked] = useState(false);
  const [streak, setStreak] = useState(0);
  const [found, setFound] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const flipsRef = useRef(flips);
  const sendingRef = useRef(false);
  flipsRef.current = flips;
  const total = puzzle.cards.length;
  const textSize = puzzle.cols >= 6 ? 'text-[10px]' : puzzle.cols === 4 ? 'text-xs' : 'text-sm';

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // Prévia: todas as cartas viradas para cima por alguns segundos, contando de um em um.
  useEffect(() => {
    if (!previewing) return undefined;
    const id = window.setTimeout(() => {
      if (previewLeft <= 1) {
        setPreviewLeft(0);
        setPreviewing(false);
        playSfx('swipe');
      } else {
        setPreviewLeft(previewLeft - 1);
      }
    }, 1000);
    return () => window.clearTimeout(id);
  }, [previewing, previewLeft]);

  const send = useCallback(async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    await submit({ flips: flipsRef.current });
    sendingRef.current = false;
    setSending(false);
  }, [submit]);

  const left = useTurnClock({ total: puzzle.timeLimit, active: !finished, resetKey: 0, onZero: () => void send() });

  useEffect(() => {
    if (result) playSfx(result.solved ? 'wsWin' : 'wsLose');
  }, [result]);

  function tap(index: number) {
    if (finished || locked || previewing || sending || matched.has(index) || open.includes(index)) return;
    playSfx('soft');
    const next = [...open, index];
    setOpen(next);
    if (next.length < 2) return;
    const log = [...flips, next[0], next[1]];
    setFlips(log);
    flipsRef.current = log;
    if (puzzle.cards[next[0]].pair === puzzle.cards[next[1]].pair) {
      const all = new Set([...matched, next[0], next[1]]);
      setMatched(all);
      setOpen([]);
      setStreak((value) => value + 1);
      setFound(puzzle.labels[puzzle.cards[next[0]].pair] ?? null);
      playSfx('anRight', 1 + Math.min(streak, 5) * 0.06);
      if (all.size === total) window.setTimeout(() => void send(), 600);
      return;
    }
    setStreak(0);
    setLocked(true);
    window.setTimeout(() => playSfx('anWrong'), 250);
    timer.current = window.setTimeout(() => {
      setOpen([]);
      setLocked(false);
    }, 1000);
  }

  async function giveUp() {
    const confirmed = await dialogs.confirm({ title: 'Desistir da partida?', message: `Você achou ${matched.size / 2} de ${total / 2} pares. Vale só o que já foi achado.`, confirmLabel: 'Desistir', tone: 'danger' });
    if (confirmed) void send();
  }

  const attempts = flips.length / 2;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-xs font-bold">
        <span className="rounded-full bg-surface-3 px-3 py-1 text-ink">
          {matched.size / 2} de {total / 2} pares
        </span>
        <span className="rounded-full bg-primary/15 px-3 py-1 text-primary-strong dark:text-primary">
          {SIZE_EMOJI[puzzle.level]} {SIZE_LABEL[puzzle.level]}
        </span>
        <span className="rounded-full bg-success/15 px-3 py-1 text-success-strong dark:text-success">
          {attempts} {attempts === 1 ? 'tentativa' : 'tentativas'}
        </span>
      </div>
      {left !== null && puzzle.timeLimit !== null && !finished ? <TimeBar left={left} total={puzzle.timeLimit} unit="para achar os pares" /> : null}
      {previewing ? <p className="animate-pulse text-center font-display text-lg font-bold text-primary-strong dark:text-primary">Memorize! {previewLeft}</p> : streak >= 2 ? <p className="text-center text-sm font-bold text-accent-strong dark:text-accent">🔥 {streak} pares seguidos!</p> : found ? <p className="text-center text-sm font-bold text-success-strong dark:text-success">Par: {found}</p> : <p className="text-center text-sm font-semibold text-muted">Vire duas cartas por vez.</p>}

      <div data-sound="off" className="mx-auto grid max-w-md gap-1.5" style={{ gridTemplateColumns: `repeat(${puzzle.cols}, minmax(0, 1fr))` }}>
        {puzzle.cards.map((card, index) => {
          const done = matched.has(index);
          const faceUp = previewing || open.includes(index) || done || finished;
          return (
            <button
              key={index}
              type="button"
              disabled={finished}
              onClick={() => tap(index)}
              aria-label={faceUp ? card.text : `Carta ${index + 1}, virada para baixo`}
              className={cn(
                'relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl border-2 p-1 text-center font-display font-bold leading-tight transition duration-300 active:scale-95',
                textSize,
                done ? 'border-success bg-success/15 text-ink' : faceUp ? 'border-primary bg-surface text-ink' : 'border-transparent bg-gradient-to-br from-primary to-accent text-on-primary',
                faceUp && !done && open.includes(index) && 'scale-105',
              )}
            >
              {faceUp ? (
                card.imageUrl ? (
                  <>
                    <img src={card.imageUrl} alt="" loading="lazy" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
                    {done ? <span className="absolute inset-x-0 bottom-0 bg-black/60 px-0.5 py-0.5 text-[10px] leading-3 text-white">{card.text}</span> : null}
                  </>
                ) : (
                  card.text
                )
              ) : (
                <span className="text-2xl opacity-80" aria-hidden>
                  ✦
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!finished ? (
        <Button variant="ghost" size="sm" className="w-full" loading={sending} disabled={previewing} onClick={() => void giveUp()}>
          Desistir
        </Button>
      ) : null}
    </div>
  );
}
