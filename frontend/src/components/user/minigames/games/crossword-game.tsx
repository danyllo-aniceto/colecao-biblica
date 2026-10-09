import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/spinner';
import { errorMessage, useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { actMiniGame, type CrosswordEvent, type CrosswordPuzzle, type CrosswordReveal } from '@/lib/minigames-api';
import { playSfx } from '@/lib/sound/sfx';
import { baseLetters, type GameProps, type SetupRender } from './play-frame';
import { LEVEL_EMOJI, LEVEL_LABEL, LEVEL_SCALE, LevelField, SetupShell, TimeBar, TimerField, readStored, useTurnClock, writeStored, type Level } from './turn-kit';

// ---------- Tela de preparo ----------

const LEVEL_TEXT: Record<Level, string> = {
  facil: '5 palavras numa grade pequena · nomes curtos · 3 conferências e 5 letras reveladas',
  medio: '7 palavras · nomes de 3 a 9 letras · 3 conferências e 4 letras reveladas',
  dificil: '10 palavras numa grade grande · nomes longos · 2 conferências e 3 letras reveladas',
};
const TIMES = ['180', '300', '480', '600'] as const;
const KEY = 'cruzadas-escolhas';
type Setup = { level: Level; timed: boolean; time: string };
const FALLBACK: Setup = { level: 'medio', timed: false, time: '480' };
const minutes = (value: string) => `${Number(value) / 60} min`;

/** Antes de começar: dificuldade e tempo para a cruzada toda. */
export const crosswordSetup: SetupRender = ({ onStart }) => <CrosswordSetup onStart={onStart} />;

function CrosswordSetup({ onStart }: { onStart: (options: object) => void }) {
  const [choice, setChoice] = useState<Setup>(() =>
    readStored(KEY, FALLBACK, (saved) => ({
      level: saved.level && saved.level in LEVEL_SCALE ? saved.level : FALLBACK.level,
      timed: typeof saved.timed === 'boolean' ? saved.timed : FALLBACK.timed,
      time: TIMES.includes(saved.time as never) ? (saved.time as string) : FALLBACK.time,
    })),
  );
  const update = (patch: Partial<Setup>) => setChoice((current) => ({ ...current, ...patch }));
  return (
    <SetupShell
      intro="Preencha a grade com nomes de personagens e lugares. Cada dica tem o nome escondido por traços."
      tips={[`🎯 Pontuação máxima nesta escolha: ${Math.round(1000 * LEVEL_SCALE[choice.level]).toLocaleString('pt-BR')} pontos.`, '🔎 "Conferir letras" marca as erradas (−50 pontos) e "Revelar letra" mostra uma letra (−30).', '⚡ Completar rápido soma o bônus de tempo.', '📸 No fim, os nomes aparecem com a foto.']}
      onStart={() => {
        writeStored(KEY, choice);
        onStart({ difficulty: choice.level, time: choice.timed ? Number(choice.time) : null });
      }}
    >
      <LevelField value={choice.level} onChange={(level) => update({ level })} texts={LEVEL_TEXT} />
      <TimerField label="Contar o tempo da cruzada" timed={choice.timed} onTimed={(timed) => update({ timed })} time={choice.time} onTime={(time) => update({ time })} options={TIMES} format={minutes} unitLabel="Minutos" offNote="Sem pressa, mas o bônus de rapidez continua valendo." />
    </SetupShell>
  );
}

// ---------- A partida ----------

const key = (r: number, c: number) => `${r},${c}`;

/** Palavras cruzadas: toque numa casa e digite (setas e Backspace funcionam); confira as letras ou revele uma, com custo em pontos. */
export function CrosswordGame({ puzzle, runId, submit, finished, result }: GameProps<CrosswordPuzzle>) {
  const toast = useToast();
  const [cells, setCells] = useState<string[][]>(() => puzzle.open.map((row) => row.map(() => '')));
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<Set<string>>(new Set());
  const [focus, setFocus] = useState<string | null>(null);
  const [checksLeft, setChecksLeft] = useState(puzzle.checksLeft);
  const [peeksLeft, setPeeksLeft] = useState(puzzle.peeksLeft);
  const [sending, setSending] = useState(false);
  const [asking, setAsking] = useState(false);
  const refs = useRef<Record<string, HTMLInputElement | null>>({});
  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  const sendingRef = useRef(false);

  const numbers = new Map<string, number>();
  for (const word of puzzle.words) numbers.set(key(word.row, word.col), word.number);
  const total = puzzle.open.flat().filter(Boolean).length;
  const filledCount = cells.flat().filter((letter) => letter !== '').length;
  const filled = filledCount === total;

  const rowsOf = (grid: string[][]) => grid.map((row, r) => row.map((letter, c) => (puzzle.open[r][c] === 0 ? '.' : letter || ' ')).join(''));

  const send = useCallback(async () => {
    // Um envio por vez; se falhar, o jogador pode tentar de novo.
    if (sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    await submit({ rows: rowsOf(cellsRef.current) });
    sendingRef.current = false;
    setSending(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submit]);

  // Tempo total da cruzada: ao zerar, envia o que está preenchido.
  const left = useTurnClock({ total: puzzle.timeLimit, active: !finished, resetKey: 0, onZero: () => void send() });

  useEffect(() => {
    if (!result) return;
    playSfx(result.solved ? 'wsWin' : 'wsLose');
  }, [result]);

  function type(r: number, c: number, value: string) {
    if (locked.has(key(r, c)) || finished) return;
    const letter = baseLetters(value).slice(-1);
    setCells((current) => current.map((row, rr) => row.map((old, cc) => (rr === r && cc === c ? letter : old))));
    setWrong((current) => {
      if (!current.has(key(r, c))) return current;
      const next = new Set(current);
      next.delete(key(r, c));
      return next;
    });
    if (!letter) return;
    playSfx('anPick');
    // Avança para a próxima casa livre (na horizontal, depois na vertical).
    const next = puzzle.open[r][c + 1] ? key(r, c + 1) : puzzle.open[r + 1]?.[c] ? key(r + 1, c) : null;
    if (next) refs.current[next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>, r: number, c: number) {
    const move: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const step = move[event.key];
    if (step) {
      event.preventDefault();
      refs.current[key(r + step[0], c + step[1])]?.focus();
    } else if (event.key === 'Backspace' && cells[r][c] === '') {
      event.preventDefault();
      refs.current[key(r, c - 1)]?.focus() ?? refs.current[key(r - 1, c)]?.focus();
    }
  }

  async function ask(body: object) {
    setAsking(true);
    try {
      const response = await actMiniGame(runId, body);
      return response.turn as CrosswordEvent | undefined;
    } catch (reason) {
      toast.error(errorMessage(reason));
      return undefined;
    } finally {
      setAsking(false);
    }
  }

  async function verify() {
    const event = await ask({ action: 'verify', rows: rowsOf(cells) });
    if (event?.kind !== 'verify') return;
    setChecksLeft(event.left);
    setWrong(new Set(event.wrong.map(([r, c]) => key(r, c))));
    if (event.wrong.length === 0) {
      playSfx('anRight');
      toast.success('Nenhuma letra errada até aqui.');
    } else {
      playSfx('anWrong');
      toast.error(`${event.wrong.length} ${event.wrong.length === 1 ? 'letra errada' : 'letras erradas'}, marcadas em vermelho.`);
    }
  }

  async function peek() {
    // Revela a casa em foco; sem foco, a primeira casa vazia.
    let target = focus;
    if (!target || locked.has(target)) {
      const emptyCell = puzzle.open.flatMap((row, r) => row.map((open, c) => (open === 1 && cells[r][c] === '' ? key(r, c) : null))).find(Boolean);
      target = emptyCell ?? null;
    }
    if (!target) {
      toast.error('Todas as casas já estão preenchidas.');
      return;
    }
    const [row, col] = target.split(',').map(Number);
    const event = await ask({ action: 'peek', row, col });
    if (event?.kind !== 'peek') return;
    setPeeksLeft(event.left);
    playSfx('wsHint');
    setCells((current) => current.map((line, r) => line.map((old, c) => (r === row && c === col ? event.letter : old))));
    setLocked((current) => new Set(current).add(key(row, col)));
    setWrong((current) => {
      const next = new Set(current);
      next.delete(key(row, col));
      return next;
    });
  }

  const reveal = (result?.reveal ?? []) as CrosswordReveal;
  const across = puzzle.words.filter((word) => word.across);
  const down = puzzle.words.filter((word) => !word.across);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 text-xs font-bold">
        <span className="rounded-full bg-surface-3 px-3 py-1 text-ink">
          {filledCount} de {total} letras
        </span>
        <span className="rounded-full bg-primary/15 px-3 py-1 text-primary-strong dark:text-primary">
          {LEVEL_EMOJI[puzzle.level]} {LEVEL_LABEL[puzzle.level]}
        </span>
        <span className="rounded-full bg-success/15 px-3 py-1 text-success-strong dark:text-success">até {puzzle.maxScore.toLocaleString('pt-BR')} pts</span>
      </div>
      {left !== null && puzzle.timeLimit !== null && !finished ? <TimeBar left={left} total={puzzle.timeLimit} unit="para a cruzada" /> : null}

      <div className="mx-auto grid w-fit gap-0.5 rounded-xl bg-edge-strong p-0.5" style={{ gridTemplateColumns: `repeat(${puzzle.cols}, 2.1rem)` }} role="grid" aria-label="Grade de palavras cruzadas" data-sound="off">
        {puzzle.open.flatMap((row, r) =>
          row.map((open, c) =>
            open === 0 ? (
              <div key={key(r, c)} className="h-[2.1rem] bg-ink/80" />
            ) : (
              <div key={key(r, c)} className={cn('relative h-[2.1rem]', locked.has(key(r, c)) ? 'bg-accent/30' : wrong.has(key(r, c)) ? 'bg-danger/30' : 'bg-surface')}>
                {numbers.has(key(r, c)) ? <span className="pointer-events-none absolute left-0.5 top-0 text-[9px] font-bold leading-3 text-muted">{numbers.get(key(r, c))}</span> : null}
                <input
                  ref={(element) => {
                    refs.current[key(r, c)] = element;
                  }}
                  value={cells[r][c]}
                  disabled={finished || locked.has(key(r, c))}
                  onChange={(event) => type(r, c, event.target.value)}
                  onKeyDown={(event) => onKeyDown(event, r, c)}
                  onFocus={(event) => {
                    setFocus(key(r, c));
                    event.currentTarget.select();
                  }}
                  maxLength={2}
                  autoComplete="off"
                  autoCapitalize="characters"
                  aria-label={`Linha ${r + 1}, coluna ${c + 1}`}
                  className="h-full w-full bg-transparent pt-1.5 text-center font-display text-lg font-bold uppercase text-ink outline-none focus:bg-primary/20"
                />
              </div>
            ),
          ),
        )}
      </div>

      {!finished ? (
        <div className="flex gap-2">
          <Button className="flex-1" variant="secondary" size="sm" loading={asking} disabled={checksLeft <= 0 || filledCount === 0 || sending} onClick={() => void verify()}>
            🔎 Conferir letras ({checksLeft})
          </Button>
          <Button className="flex-1" variant="secondary" size="sm" loading={asking} disabled={peeksLeft <= 0 || sending} onClick={() => void peek()}>
            💡 Revelar letra ({peeksLeft})
          </Button>
        </div>
      ) : null}

      {[
        { title: 'Horizontais', list: across },
        { title: 'Verticais', list: down },
      ].map((group) => (
        <section key={group.title} className="panel space-y-1.5 p-3">
          <h4 className="font-display font-bold text-ink">{group.title}</h4>
          <ul className="space-y-1 text-sm font-semibold text-ink">
            {group.list.map((word) => (
              <li key={`${word.number}-${word.across}`}>
                <b>{word.number}.</b> {word.clue} <span className="text-muted">({word.length})</span>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {finished && result && reveal.length === 0 ? <LoadingState label="Conferindo..." /> : null}
      {finished && reveal.length > 0 ? (
        <section className="panel space-y-2 p-3" aria-label="As respostas">
          <h4 className="font-display font-bold text-ink">As respostas</h4>
          <ul className="grid grid-cols-2 gap-2">
            {reveal.map((item) => (
              <li key={`${item.number}-${item.across}`} className="flex items-center gap-2 rounded-xl bg-surface-3 p-1.5">
                {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-lg object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface text-lg">📍</span>}
                <span className="min-w-0 text-xs font-bold text-ink">
                  <span className="block text-muted">
                    {item.number} {item.across ? '→' : '↓'}
                  </span>
                  <span className="block truncate">{item.label}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Button className="w-full" loading={sending} disabled={!filled || finished} onClick={() => void send()}>
        Conferir
      </Button>
    </div>
  );
}
