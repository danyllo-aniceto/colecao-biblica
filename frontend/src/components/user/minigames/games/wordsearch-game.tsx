import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialogs';
import { Select } from '@/components/ui/select';
import { Tooltip } from '@/components/ui/tooltip';
import { errorMessage, useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { actMiniGame, type WordSearchClue, type WordSearchDifficulty, type WordSearchPuzzle, type WordSearchTheme } from '@/lib/minigames-api';
import { playSfx } from '@/lib/sound/sfx';
import { clock, type GameProps, type SetupRender } from './play-frame';

type Cell = [number, number];
type Found = { word: string; from: Cell; to: Cell };

/** Cada palavra achada ganha o seu marca-texto (só tokens do tema, claro e escuro). As que faltaram aparecem em vermelho. */
const COLORS = [
  { stroke: 'stroke-primary', chip: 'bg-primary/25' },
  { stroke: 'stroke-success', chip: 'bg-success/25' },
  { stroke: 'stroke-accent', chip: 'bg-accent/30' },
  { stroke: 'stroke-violet', chip: 'bg-violet/25' },
  { stroke: 'stroke-info', chip: 'bg-info/25' },
  { stroke: 'stroke-r-rare', chip: 'bg-r-rare/25' },
  { stroke: 'stroke-r-epic', chip: 'bg-r-epic/25' },
  { stroke: 'stroke-r-legendary', chip: 'bg-r-legendary/25' },
];

const KIND_EMOJI = { character: '🧑', place: '📍', book: '📖' } as const;
const KIND_NAME = { character: 'Personagem', place: 'Lugar', book: 'Livro da Bíblia' } as const;

/** As oito direções, na ordem do ângulo (0° = direita, depois sentido horário na tela). */
const DIRECTIONS: Cell[] = [
  [0, 1],
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
  [-1, 0],
  [-1, 1],
];

function lineCells(from: Cell, to: Cell): Cell[] | null {
  const dr = to[0] - from[0];
  const dc = to[1] - from[1];
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return null;
  const length = Math.max(Math.abs(dr), Math.abs(dc)) + 1;
  return Array.from({ length }, (_, index) => [from[0] + Math.sign(dr) * index, from[1] + Math.sign(dc) * index] as Cell);
}

/** Onde o dedo está, "encaixado" na reta mais próxima das 8 direções a partir da primeira letra, sem sair da grade. */
function snapEnd(start: Cell, row: number, col: number, size: number): Cell {
  const dy = row - start[0];
  const dx = col - start[1];
  if (Math.hypot(dx, dy) < 0.6) return start;
  const direction = DIRECTIONS[(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
  const [dr, dc] = direction;
  const along = (dx * dc + dy * dr) / (dr * dr + dc * dc);
  let steps = Math.max(0, Math.round(along));
  while (steps > 0 && (start[0] + dr * steps < 0 || start[0] + dr * steps >= size || start[1] + dc * steps < 0 || start[1] + dc * steps >= size)) steps -= 1;
  return [start[0] + dr * steps, start[1] + dc * steps];
}

const same = (a: Cell | null, b: Cell | null) => Boolean(a && b && a[0] === b[0] && a[1] === b[1]);
const textOf = (puzzle: WordSearchPuzzle, cells: Cell[]) => cells.map(([r, c]) => puzzle.grid[r][c]).join('');

// ---------- Tela de preparo: dificuldade e tema ----------

const LEVELS: Record<WordSearchDifficulty, { label: string; words: number; grid: string; directions: string; par: number; max: number; emoji: string }> = {
  facil: { label: 'Fácil', words: 5, grid: '8 × 8', directions: 'Para a direita e para baixo', par: 70, max: 600, emoji: '🌱' },
  medio: { label: 'Médio', words: 7, grid: '10 × 10', directions: 'Mais as diagonais', par: 120, max: 800, emoji: '🔥' },
  dificil: { label: 'Difícil', words: 10, grid: '12 × 12 ou mais', directions: 'Todas, até de trás para frente', par: 210, max: 1000, emoji: '👑' },
};

const THEMES: Array<{ value: WordSearchTheme; label: string; description: string }> = [
  { value: 'mix', label: 'Mistura bíblica', description: 'Personagens, lugares e livros juntos' },
  { value: 'antigo', label: 'Antigo Testamento', description: 'Personagens e livros do AT' },
  { value: 'novo', label: 'Novo Testamento', description: 'Personagens e livros do NT' },
  { value: 'lugares', label: 'Lugares da campanha', description: 'Os cenários do caminho' },
  { value: 'livros', label: 'Livros da Bíblia', description: 'Nomes dos livros' },
];

const STORAGE_KEY = 'caca-palavras-escolhas';

function readChoice(): { difficulty: WordSearchDifficulty; theme: WordSearchTheme } {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as { difficulty?: string; theme?: string };
    return {
      difficulty: saved.difficulty && saved.difficulty in LEVELS ? (saved.difficulty as WordSearchDifficulty) : 'medio',
      theme: THEMES.some((theme) => theme.value === saved.theme) ? (saved.theme as WordSearchTheme) : 'mix',
    };
  } catch {
    return { difficulty: 'medio', theme: 'mix' };
  }
}

/** Antes de começar: escolher a dificuldade (tamanho da grade, palavras, direções, tempo e pontos) e o tema. Lembra a última escolha. */
export const wordSearchSetup: SetupRender = ({ onStart }) => <WordSearchSetup onStart={onStart} />;

function WordSearchSetup({ onStart }: { onStart: (options: object) => void }) {
  const [choice, setChoice] = useState(readChoice);

  function start() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
    } catch {
      // Lembrar a escolha é só conforto.
    }
    onStart(choice);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-muted">Escolha o desafio. Quanto mais difícil, maior a grade, mais palavras e mais pontos no ranking.</p>
      <div role="radiogroup" aria-label="Dificuldade" className="space-y-2">
        {(Object.keys(LEVELS) as WordSearchDifficulty[]).map((id) => {
          const level = LEVELS[id];
          const active = choice.difficulty === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setChoice((current) => ({ ...current, difficulty: id }))}
              className={cn('panel flex w-full items-center gap-3 border-2 p-3 text-left transition active:scale-[0.99]', active ? 'border-primary bg-primary/10' : 'border-edge')}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-surface-3 text-2xl" aria-hidden>
                {level.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-lg font-bold text-ink">{level.label}</span>
                <span className="block text-xs font-semibold text-muted">
                  {level.words} palavras · grade {level.grid}
                </span>
                <span className="block text-xs font-semibold text-muted">
                  {level.directions} · bônus de tempo até {clock(level.par)}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-display text-xl font-bold text-primary-strong dark:text-primary">{level.max.toLocaleString('pt-BR')}</span>
                <span className="block text-[11px] font-bold uppercase text-muted">pontos</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <span className="block font-display text-sm font-bold text-ink">Tema das palavras</span>
        <Select<WordSearchTheme> aria-label="Tema das palavras" value={choice.theme} onChange={(theme) => setChoice((current) => ({ ...current, theme }))} options={THEMES} />
      </div>

      <ul className="space-y-1 rounded-2xl bg-surface-3 p-3 text-xs font-semibold text-muted">
        <li>👆 Arraste o dedo sobre as letras (ou toque na primeira e na última).</li>
        <li>💡 Até 3 dicas por partida; cada uma desconta 40 pontos.</li>
        <li>⏱ Ache todas dentro do tempo de bônus para ganhar até 300 pontos a mais.</li>
      </ul>
      <Button size="lg" className="w-full" onClick={start}>
        Começar
      </Button>
    </div>
  );
}

// ---------- A partida ----------

/** Caça-palavras: arraste sobre as letras (ou toque na primeira e na última). Cada achado vira cor, som e a imagem do personagem ou do lugar. */
export function WordSearchGame({ puzzle, runId, submit, finished, seconds, result }: GameProps<WordSearchPuzzle>) {
  const toast = useToast();
  const dialogs = useDialogs();
  const gridRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ start: Cell; end: Cell; moved: boolean } | null>(null);
  const [drag, setDrag] = useState<{ start: Cell; end: Cell } | null>(null);
  const [anchor, setAnchor] = useState<Cell | null>(null);
  const [found, setFound] = useState<Found[]>([]);
  const [hints, setHints] = useState<Record<string, Cell>>({});
  const [hintsLeft, setHintsLeft] = useState(puzzle.hints);
  const [picked, setPicked] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [miss, setMiss] = useState<Cell[] | null>(null);
  const [lastFound, setLastFound] = useState<WordSearchClue | null>(null);
  const [revealed, setRevealed] = useState<Found[]>([]);
  const [sending, setSending] = useState(false);
  const missTimer = useRef<number | undefined>(undefined);
  const lockedRef = useRef(false);
  lockedRef.current = finished || sending;

  const clueOf = useMemo(() => new Map(puzzle.clues.map((clue) => [clue.word, clue])), [puzzle.clues]);
  const foundWords = useMemo(() => new Set(found.map((entry) => entry.word)), [found]);

  const missedWords = useMemo(() => new Set(revealed.map((entry) => entry.word)), [revealed]);

  // Traço do marca-texto que o dedo está desenhando (ou a primeira letra marcada num toque).
  const previewLine = drag ?? (anchor ? { start: anchor, end: anchor } : null);
  const previewCells = useMemo(() => new Set((previewLine ? (lineCells(previewLine.start, previewLine.end) ?? []) : []).map(([r, c]) => `${r}-${c}`)), [previewLine]);
  const hintCells = useMemo(() => new Set(Object.entries(hints).filter(([word]) => !foundWords.has(word)).map(([, [r, c]]) => `${r}-${c}`)), [hints, foundWords]);

  const send = useCallback(
    async (list: Found[]) => {
      setSending(true);
      await submit({ found: list });
      setSending(false);
    },
    [submit],
  );

  // Fim da partida: som de vitória ou de fim e, se faltaram palavras, mostra onde estavam, uma a uma, em outra cor.
  useEffect(() => {
    if (!result) return undefined;
    playSfx(result.solved ? 'wsWin' : 'wsLose');
    const timers = ((result.reveal as Found[] | undefined) ?? []).map((entry, index) =>
      window.setTimeout(() => {
        setRevealed((current) => [...current, entry]);
        playSfx('wsReveal', 1 + index * 0.07);
      }, 800 + index * 380),
    );
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [result]);

  useEffect(() => () => window.clearTimeout(missTimer.current), []);

  /** Confere no aparelho (para dar o retorno na hora); o servidor confere tudo de novo no fim. */
  const attempt = useCallback(
    (from: Cell, to: Cell) => {
      const cells = lineCells(from, to);
      if (!cells || cells.length < 2) return;
      const text = textOf(puzzle, cells);
      const word = [text, [...text].reverse().join('')].find((candidate) => puzzle.words.includes(candidate));
      if (word && foundWords.has(word)) {
        playSfx('soft');
        return;
      }
      if (!word) {
        playSfx('wsMiss');
        setMiss(cells);
        window.clearTimeout(missTimer.current);
        missTimer.current = window.setTimeout(() => setMiss(null), 450);
        return;
      }
      playSfx('wsFound');
      const next = [...found, { word, from, to }];
      setFound(next);
      setLastFound(clueOf.get(word) ?? null);
      setPicked((current) => (current === word ? null : current));
      if (next.length === puzzle.words.length) window.setTimeout(() => void send(next), 650);
    },
    [puzzle, found, foundWords, clueOf, send],
  );

  /** Célula sob o dedo, em linha e coluna fracionárias (para encaixar a reta). */
  function pointerCell(event: PointerEvent): { row: number; col: number } | null {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const row = ((event.clientY - rect.top) / rect.height) * puzzle.size - 0.5;
    const col = ((event.clientX - rect.left) / rect.width) * puzzle.size - 0.5;
    return { row: Math.min(puzzle.size - 0.5, Math.max(-0.5, row)), col: Math.min(puzzle.size - 0.5, Math.max(-0.5, col)) };
  }

  const clampCell = (value: number) => Math.min(puzzle.size - 1, Math.max(0, Math.round(value)));

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (lockedRef.current || (event.pointerType === 'mouse' && event.button !== 0)) return;
    const at = pointerCell(event);
    if (!at) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const start: Cell = [clampCell(at.row), clampCell(at.col)];
    dragRef.current = { start, end: start, moved: false };
    setDrag({ start, end: start });
    playSfx('wsPick');
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = dragRef.current;
    if (!current) return;
    const at = pointerCell(event);
    if (!at) return;
    const end = snapEnd(current.start, at.row, at.col, puzzle.size);
    if (same(end, current.end)) return;
    const length = Math.max(Math.abs(end[0] - current.start[0]), Math.abs(end[1] - current.start[1]));
    // Cada letra nova sobe um semitom: dá a sensação de "carregar" a palavra.
    playSfx('wsTick', 2 ** (Math.min(length, 12) / 12));
    dragRef.current = { ...current, end, moved: true };
    setDrag({ start: current.start, end });
  }

  function onPointerUp() {
    const current = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!current || lockedRef.current) return;
    if (current.moved && !same(current.start, current.end)) {
      setAnchor(null);
      attempt(current.start, current.end);
      return;
    }
    // Toque simples: a primeira letra fica marcada e o toque seguinte fecha a palavra.
    tap(current.start);
  }

  function onPointerCancel() {
    dragRef.current = null;
    setDrag(null);
  }

  function tap(cell: Cell) {
    if (lockedRef.current) return;
    if (!anchor || same(anchor, cell)) {
      setAnchor(same(anchor, cell) ? null : cell);
      return;
    }
    const from = anchor;
    setAnchor(null);
    attempt(from, cell);
  }

  /** Teclado: setas movem o foco entre as letras; Enter/Espaço marca a primeira e a última. */
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, r: number, c: number) {
    const move = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[event.key];
    if (!move) return;
    event.preventDefault();
    const nr = Math.min(puzzle.size - 1, Math.max(0, r + move[0]));
    const nc = Math.min(puzzle.size - 1, Math.max(0, c + move[1]));
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-cell="${nr}-${nc}"]`)?.focus();
  }

  async function askHint() {
    const word = picked && !foundWords.has(picked) ? picked : puzzle.words.find((candidate) => !foundWords.has(candidate));
    if (!word || asking || finished || sending) return;
    setAsking(true);
    try {
      const answer = await actMiniGame(runId, { action: 'hint', word });
      if (answer.cell) {
        setHints((current) => ({ ...current, [word]: answer.cell! }));
        playSfx('wsHint');
      }
      if (answer.hintsLeft !== undefined) setHintsLeft(answer.hintsLeft);
      setPicked(word);
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setAsking(false);
    }
  }

  async function giveUp() {
    const confirmed = await dialogs.confirm({
      title: 'Desistir da partida?',
      message: `Você achou ${found.length} de ${puzzle.words.length} palavras. As que faltam serão mostradas na grade e sua pontuação será calculada agora.`,
      confirmLabel: 'Desistir',
      tone: 'danger',
    });
    if (confirmed) void send(found);
  }

  const goldLeft = Math.max(0, puzzle.par - seconds);
  const goldPercent = (goldLeft / puzzle.par) * 100;
  const letterSize = puzzle.size <= 8 ? 'text-xl' : puzzle.size <= 10 ? 'text-lg' : puzzle.size <= 12 ? 'text-base' : 'text-sm';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
        <span className="rounded-full bg-surface-3 px-3 py-1 text-ink">{puzzle.theme}</span>
        <span className="rounded-full bg-primary/15 px-3 py-1 text-primary-strong dark:text-primary">
          {LEVELS[puzzle.difficulty].emoji} {LEVELS[puzzle.difficulty].label}
        </span>
        <span className="rounded-full bg-success/15 px-3 py-1 text-success-strong dark:text-success" aria-live="polite">
          {found.length}/{puzzle.words.length} achadas
        </span>
      </div>

      {!finished ? (
        <div className="space-y-1" aria-label="Bônus de tempo">
          <div className="h-2 overflow-hidden rounded-full bg-surface-3">
            <div className={cn('h-full rounded-full transition-all duration-500', goldPercent > 40 ? 'bg-success' : goldPercent > 15 ? 'bg-accent' : 'bg-danger')} style={{ width: `${goldPercent}%` }} />
          </div>
          <p className="text-center text-[11px] font-bold text-muted">{goldLeft > 0 ? `⚡ Bônus de tempo cheio por mais ${clock(goldLeft)}` : '⏳ O bônus de tempo está caindo 1 ponto por segundo'}</p>
        </div>
      ) : null}

      <div className="panel p-1.5">
        <div
          ref={gridRef}
          data-sound="off"
          role="grid"
          aria-label="Grade de letras"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          className="relative grid touch-none select-none gap-0.5"
          style={{ gridTemplateColumns: `repeat(${puzzle.size}, minmax(0, 1fr))` }}
        >
          {puzzle.grid.flatMap((row, r) =>
            [...row].map((letter, c) => {
              const key = `${r}-${c}`;
              const previewing = previewCells.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  data-cell={key}
                  disabled={finished}
                  // Mouse e dedo são tratados pelo arrastar; este clique só vale para o teclado (detail 0).
                  onClick={(event) => {
                    if (event.detail === 0) tap([r, c]);
                  }}
                  onKeyDown={(event) => onKeyDown(event, r, c)}
                  aria-label={`Letra ${letter}, linha ${r + 1}, coluna ${c + 1}`}
                  className={cn(
                    'flex aspect-square items-center justify-center rounded-md bg-surface font-display font-bold text-ink transition-colors duration-150',
                    letterSize,
                    previewing && 'scale-110',
                    hintCells.has(key) && !previewing && 'animate-pulse ring-2 ring-inset ring-accent',
                  )}
                >
                  {letter}
                </button>
              );
            }),
          )}
          <Marker size={puzzle.size} found={found} preview={previewLine} revealed={revealed} miss={miss} />
        </div>
      </div>

      {lastFound && !finished ? (
        <div key={lastFound.word} className="panel animate-pop-in flex items-center gap-3 border-2 border-success p-2.5">
          <ClueAvatar clue={lastFound} found />
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase text-success-strong dark:text-success">Achou! {KIND_NAME[lastFound.kind]}</span>
            <span className="block truncate font-display text-lg font-bold text-ink">{lastFound.label}</span>
          </span>
        </div>
      ) : (
        <p className="text-center text-xs font-semibold text-muted">{anchor ? 'Agora toque na última letra da palavra.' : 'Arraste o dedo sobre as letras de uma palavra. Vale em qualquer direção.'}</p>
      )}

      <ul className="grid grid-cols-2 gap-2" aria-label="Palavras para achar">
        {puzzle.clues.map((clue) => {
          const index = found.findIndex((entry) => entry.word === clue.word);
          const done = index >= 0;
          const missed = missedWords.has(clue.word);
          return (
            <li key={clue.word}>
              <button
                type="button"
                disabled={done || finished}
                onClick={() => setPicked((current) => (current === clue.word ? null : clue.word))}
                className={cn(
                  'flex w-full items-center gap-2 rounded-2xl border-2 p-1.5 pr-2 text-left transition',
                  done ? cn('border-transparent', COLORS[index % COLORS.length].chip) : missed ? 'border-danger/60 bg-danger/15' : picked === clue.word ? 'border-accent bg-accent/15' : 'border-edge bg-surface',
                )}
              >
                <ClueAvatar clue={clue} found={done || missed} small />
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate font-display text-sm font-bold', done ? 'text-ink line-through decoration-2' : missed ? 'text-danger-strong dark:text-danger' : 'text-ink')}>{clue.word}</span>
                  <span className="block truncate text-[11px] font-semibold text-muted">{done || missed ? clue.label : `${KIND_NAME[clue.kind]} · ${clue.word.length} letras`}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {!finished ? (
        <div className="flex gap-2">
          <Tooltip content={`Mostra a primeira letra da palavra escolhida (ou da próxima). Desconta ${puzzle.hintPenalty} pontos.`}>
            <Button className="flex-1" variant="secondary" size="sm" loading={asking} disabled={hintsLeft <= 0 || sending} onClick={() => void askHint()}>
              💡 Dica ({hintsLeft})
            </Button>
          </Tooltip>
          <Button className="flex-1" variant="ghost" size="sm" loading={sending} onClick={() => void giveUp()}>
            Desistir
          </Button>
        </div>
      ) : (
        <p className="text-center text-xs font-bold text-muted">{missedWords.size > 0 || (((result?.reveal as Found[] | undefined) ?? []).length > 0) ? 'Em vermelho: as palavras que faltaram.' : 'Todas as palavras achadas!'}</p>
      )}
    </div>
  );
}

/** Retrato do personagem (ou mapa do lugar). Fica em preto e branco até a palavra ser achada. */
function ClueAvatar({ clue, found, small = false }: { clue: WordSearchClue; found: boolean; small?: boolean }) {
  const size = small ? 'h-10 w-10 rounded-xl' : 'h-14 w-14 rounded-2xl';
  return clue.imageUrl ? (
    <img src={clue.imageUrl} alt="" loading="lazy" className={cn('shrink-0 bg-surface-3 object-cover transition duration-500', size, !found && 'opacity-60 blur-[1px] grayscale')} />
  ) : (
    <span className={cn('flex shrink-0 items-center justify-center bg-surface-3', size, small ? 'text-lg' : 'text-2xl', !found && 'opacity-60 grayscale')} aria-hidden>
      {KIND_EMOJI[clue.kind]}
    </span>
  );
}

/** Os traços de marca-texto por cima da grade: um por palavra achada, um vermelho por palavra que faltou e o que o dedo está riscando. */
function Marker({ size, found, preview, revealed, miss }: { size: number; found: Found[]; preview: { start: Cell; end: Cell } | null; revealed: Found[]; miss: Cell[] | null }) {
  const line = (from: Cell, to: Cell, className: string, key: string, animate = false) => (
    <line key={key} x1={from[1] + 0.5} y1={from[0] + 0.5} x2={to[1] + 0.5} y2={to[0] + 0.5} strokeWidth={0.8} strokeLinecap="round" pathLength={1} className={cn(className, animate && 'animate-marker')} />
  );
  return (
    <svg aria-hidden viewBox={`0 0 ${size} ${size}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
      <g className="opacity-55">
        {found.map((entry, index) => line(entry.from, entry.to, COLORS[index % COLORS.length].stroke, `f-${entry.word}`, true))}
        {revealed.map((entry) => line(entry.from, entry.to, 'stroke-danger', `m-${entry.word}`, true))}
      </g>
      {miss ? <g className="opacity-60">{line(miss[0], miss[miss.length - 1], 'stroke-danger', 'miss')}</g> : null}
      {preview ? <g className="opacity-60">{line(preview.start, preview.end, 'stroke-accent', 'preview')}</g> : null}
    </svg>
  );
}
