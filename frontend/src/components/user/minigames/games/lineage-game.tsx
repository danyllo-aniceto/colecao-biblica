import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { errorMessage, useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { actMiniGame, type LineageEvent, type LineagePuzzle, type LineageReveal } from '@/lib/minigames-api';
import { playSfx } from '@/lib/sound/sfx';
import type { GameProps, SetupRender } from './play-frame';
import { LEVEL_EMOJI, LEVEL_LABEL, LEVEL_SCALE, LevelField, SetupShell, TimeBar, TimerField, readStored, useTurnClock, writeStored, type Level } from './turn-kit';

// ---------- Tela de preparo ----------

const LEVEL_TEXT: Record<Level, string> = {
  facil: 'Já abre com 1 nome no lugar · só os nomes certos na lista · 3 dicas · mostra de qual livro é a linhagem',
  medio: '2 nomes de enfeite na lista · 2 dicas · mostra de qual livro é a linhagem',
  dificil: '4 nomes de enfeite (vizinhos da linhagem, os mais confusos) · 1 dica · não diz de qual livro é',
};
const SIZES = [
  { value: '2', label: 'Pai e filho (2 gerações)', description: 'Quem é o pai?' },
  { value: '3', label: 'Até o avô (3 gerações)', description: 'Pai e avô' },
  { value: '4', label: 'Até o bisavô (4 gerações)', description: 'Pai, avô e bisavô' },
  { value: '5', label: 'Até o tataravô (5 gerações)', description: 'Mais um degrau acima' },
  { value: '6', label: 'Até o tetravô (6 gerações)', description: 'Árvore grande' },
  { value: '7', label: 'Até o pentavô (7 gerações)', description: 'Árvore muito grande' },
  { value: '8', label: 'Até o hexavô (8 gerações)', description: 'A maior árvore' },
];
const TIMES = ['60', '120', '240', '360'] as const;
const KEY = 'arvore-escolhas';
type Choice = { level: Level; size: string; timed: boolean; time: string };
const FALLBACK: Choice = { level: 'medio', size: '4', timed: false, time: '120' };
const minutes = (value: string) => (Number(value) < 120 ? `${value}s` : `${Number(value) / 60} min`);

/** Antes de começar: dificuldade, tamanho da árvore (de pai e filho até o hexavô) e tempo. */
export const lineageSetup: SetupRender = ({ onStart }) => <LineageSetup onStart={onStart} />;

function LineageSetup({ onStart }: { onStart: (options: object) => void }) {
  const [choice, setChoice] = useState<Choice>(() =>
    readStored(KEY, FALLBACK, (saved) => ({
      level: saved.level && saved.level in LEVEL_SCALE ? saved.level : FALLBACK.level,
      size: SIZES.some((size) => size.value === saved.size) ? (saved.size as string) : FALLBACK.size,
      timed: typeof saved.timed === 'boolean' ? saved.timed : FALLBACK.timed,
      time: TIMES.includes(saved.time as never) ? (saved.time as string) : FALLBACK.time,
    })),
  );
  const update = (patch: Partial<Choice>) => setChoice((current) => ({ ...current, ...patch }));
  return (
    <SetupShell
      intro="Uma pessoa da Bíblia fica na base da árvore. Descubra quem são o pai, o avô, o bisavô e os antepassados dela, em ordem."
      tips={[`🎯 Pontuação máxima nesta escolha: ${Math.round(1000 * LEVEL_SCALE[choice.level]).toLocaleString('pt-BR')} pontos.`, '🌳 Quanto maior a árvore, mais nomes para acertar.', '💡 A dica revela um antepassado, mas desconta 50 pontos.', '📸 Quem tem foto cadastrada aparece com ela.']}
      onStart={() => {
        writeStored(KEY, choice);
        onStart({ difficulty: choice.level, rounds: Number(choice.size), time: choice.timed ? Number(choice.time) : null });
      }}
    >
      <LevelField value={choice.level} onChange={(level) => update({ level })} texts={LEVEL_TEXT} />
      <div className="space-y-1.5">
        <span className="block font-display text-sm font-bold text-ink">Tamanho da árvore</span>
        <Select<string> aria-label="Tamanho da árvore" value={choice.size} onChange={(size) => update({ size })} options={SIZES} />
      </div>
      <TimerField label="Contar o tempo" timed={choice.timed} onTimed={(timed) => update({ timed })} time={choice.time} onTime={(time) => update({ time })} options={TIMES} format={minutes} unitLabel="Tempo para montar a árvore" offNote="Sem pressa, mas o bônus de rapidez continua valendo." />
    </SetupShell>
  );
}

// ---------- A partida ----------

function Avatar({ name, images, size = 'h-9 w-9' }: { name: string; images: Record<string, string>; size?: string }) {
  const url = images[name];
  return url ? <img src={url} alt="" loading="lazy" draggable={false} className={cn('shrink-0 rounded-lg bg-surface-3 object-cover', size)} /> : null;
}

/** Árvore genealógica: preencha os antepassados, do mais antigo (em cima) até o pai, acima da pessoa da base. */
export function LineageGame({ puzzle, runId, submit, finished, result }: GameProps<LineagePuzzle>) {
  const toast = useToast();
  const [fills, setFills] = useState<Array<string | null>>(() => puzzle.slots.map((slot) => slot.name));
  const [locked, setLocked] = useState<Set<number>>(() => new Set(puzzle.slots.flatMap((slot, index) => (slot.name ? [index] : []))));
  const [active, setActive] = useState<number | null>(() => puzzle.slots.findIndex((slot) => slot.name === null));
  const [hintsLeft, setHintsLeft] = useState(puzzle.hintsLeft);
  const [asking, setAsking] = useState(false);
  const [sending, setSending] = useState(false);
  const fillsRef = useRef(fills);
  const sendingRef = useRef(false);
  fillsRef.current = fills;
  const used = new Set(fills.filter((fill): fill is string => fill !== null));
  const complete = fills.every((fill) => fill !== null);

  const send = useCallback(async () => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    await submit({ fills: fillsRef.current });
    sendingRef.current = false;
    setSending(false);
  }, [submit]);

  const left = useTurnClock({ total: puzzle.timeLimit, active: !finished, resetKey: 0, onZero: () => void send() });
  useEffect(() => {
    if (result) playSfx(result.solved ? 'wsWin' : 'wsLose');
  }, [result]);

  function place(name: string) {
    if (finished || sending || used.has(name)) return;
    const target = active !== null && fills[active] === null ? active : fills.findIndex((fill) => fill === null);
    if (target < 0) return;
    playSfx('anPick');
    const next = [...fills];
    next[target] = name;
    setFills(next);
    const empty = next.findIndex((fill) => fill === null);
    setActive(empty >= 0 ? empty : null);
  }

  function tapSlot(index: number) {
    if (finished || sending || locked.has(index)) return;
    if (fills[index]) {
      playSfx('anRemove');
      setFills((current) => current.map((fill, at) => (at === index ? null : fill)));
    }
    setActive(index);
  }

  async function hint() {
    setAsking(true);
    try {
      const response = await actMiniGame(runId, { action: 'hint', fills });
      const event = response.turn as LineageEvent | undefined;
      if (event?.kind !== 'hint') return;
      setHintsLeft(event.left);
      playSfx('wsHint');
      // O nome revelado ocupa o lugar dele (se estava em outro, sai de lá).
      setFills((current) => current.map((fill, at) => (at === event.slot ? event.name : fill === event.name ? null : fill)));
      setLocked((current) => new Set(current).add(event.slot));
      setActive(null);
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setAsking(false);
    }
  }

  const reveal = result?.reveal as LineageReveal | undefined;
  const images = puzzle.images;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
        <span className="rounded-full bg-surface-3 px-3 py-1 text-ink">
          {puzzle.generations} gerações{puzzle.source ? ` · ${puzzle.source}` : ''}
        </span>
        <span className="rounded-full bg-primary/15 px-3 py-1 text-primary-strong dark:text-primary">
          {LEVEL_EMOJI[puzzle.level]} {LEVEL_LABEL[puzzle.level]}
        </span>
        <span className="rounded-full bg-success/15 px-3 py-1 text-success-strong dark:text-success">até {puzzle.maxScore.toLocaleString('pt-BR')} pts</span>
      </div>
      {left !== null && puzzle.timeLimit !== null && !finished ? <TimeBar left={left} total={puzzle.timeLimit} unit="para montar a árvore" /> : null}

      {/* A árvore: o mais antigo em cima, descendo até a pessoa da base. */}
      <ol className="mx-auto max-w-sm space-y-0" aria-label="Árvore genealógica">
        {puzzle.slots.map((slot, index) => {
          const name = fills[index];
          const right = reveal ? reveal.answers[index] : null;
          const correct = reveal && name !== null && right !== null && name.toLowerCase() === right.toLowerCase();
          return (
            <li key={index} className="flex flex-col items-center">
              <button
                type="button"
                data-sound="off"
                disabled={finished || sending || locked.has(index)}
                onClick={() => tapSlot(index)}
                aria-label={name ? `${slot.label}: ${name}. Toque para tirar` : `${slot.label}: vazio`}
                className={cn(
                  'flex min-h-14 w-full items-center gap-3 rounded-2xl border-2 px-3 py-2 text-left transition',
                  reveal ? (correct ? 'border-success bg-success/15' : 'border-danger bg-danger/10') : locked.has(index) ? 'border-accent bg-accent/15' : name ? 'border-success bg-success/10' : active === index ? 'border-primary bg-primary/15' : 'border-dashed border-edge-strong bg-surface-3',
                )}
              >
                <span className="w-16 shrink-0 text-[11px] font-bold uppercase tracking-wider text-muted">{slot.label}</span>
                {name ? <Avatar name={name} images={images} /> : null}
                <span className="min-w-0 flex-1 truncate font-display text-base font-bold text-ink">{name ?? '— escolha um nome —'}</span>
                {locked.has(index) && !reveal ? <span aria-hidden>💡</span> : null}
              </button>
              {reveal && !correct ? <p className="w-full pl-3 text-xs font-bold text-danger">Era: {right}</p> : null}
              <span className="h-3 w-0.5 bg-edge-strong" aria-hidden />
            </li>
          );
        })}
        <li className="flex items-center gap-3 rounded-2xl border-2 border-primary bg-primary/20 px-3 py-2">
          <span className="w-16 shrink-0 text-[11px] font-bold uppercase tracking-wider text-primary-strong dark:text-primary">Pessoa</span>
          <Avatar name={puzzle.reference} images={images} size="h-12 w-12" />
          <span className="font-display text-lg font-bold text-ink">{puzzle.reference}</span>
        </li>
      </ol>

      {!finished ? (
        <>
          <div data-sound="off" className="flex flex-wrap justify-center gap-2" role="group" aria-label="Nomes">
            {puzzle.pool.map((name) => (
              <button key={name} type="button" disabled={used.has(name) || sending} onClick={() => place(name)} className={cn('flex items-center gap-2 rounded-xl bg-surface-3 px-3 py-2 font-display text-base font-bold text-ink transition active:scale-95', used.has(name) && 'opacity-30')}>
                <Avatar name={name} images={images} size="h-7 w-7" />
                {name}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" variant="secondary" size="sm" loading={asking} disabled={hintsLeft <= 0 || sending} onClick={() => void hint()}>
              💡 Revelar um antepassado ({hintsLeft})
            </Button>
            <Button className="flex-1" loading={sending} disabled={!complete} onClick={() => void send()}>
              Conferir
            </Button>
          </div>
        </>
      ) : reveal ? (
        <p className="text-center text-xs font-bold text-muted">Linhagem de {reveal.source}.</p>
      ) : null}
    </div>
  );
}
