import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { errorMessage } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { actMiniGame, type AnagramDifficulty, type AnagramPuzzle, type AnagramRoundEnd, type MiniGameResult } from '@/lib/minigames-api';
import { playSfx } from '@/lib/sound/sfx';
import { clock, type GameProps, type SetupRender } from './play-frame';

// ---------- Tela de preparo: dificuldade, turnos e tempo ----------

const LEVELS: Record<AnagramDifficulty, { label: string; emoji: string; text: string; scale: number }> = {
  facil: { label: 'Fácil', emoji: '🌱', text: 'Nomes de 4 a 6 letras · com o retrato visível (borrado)', scale: 0.6 },
  medio: { label: 'Médio', emoji: '🔥', text: 'Nomes de 5 a 8 letras · retrato bem borrado', scale: 0.8 },
  dificil: { label: 'Difícil', emoji: '👑', text: 'Nomes de 7 a 11 letras · sem retrato, só a dica', scale: 1 },
};
const ROUNDS = ['3', '5', '8', '10'] as const;
const TIMES = ['20', '30', '45', '60', '90'] as const;
const STORAGE_KEY = 'anagrama-escolhas';

type Choice = { difficulty: AnagramDifficulty; rounds: string; timed: boolean; time: string };

function readChoice(): Choice {
  const fallback: Choice = { difficulty: 'medio', rounds: '5', timed: true, time: '45' };
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<Choice>;
    return {
      difficulty: saved.difficulty && saved.difficulty in LEVELS ? saved.difficulty : fallback.difficulty,
      rounds: ROUNDS.includes(saved.rounds as never) ? (saved.rounds as string) : fallback.rounds,
      timed: typeof saved.timed === 'boolean' ? saved.timed : fallback.timed,
      time: TIMES.includes(saved.time as never) ? (saved.time as string) : fallback.time,
    };
  } catch {
    return fallback;
  }
}

/** Antes de começar: dificuldade, quantos nomes (turnos) e se vale tempo por nome. Lembra a última escolha. */
export const anagramSetup: SetupRender = ({ onStart }) => <AnagramSetup onStart={onStart} />;

function AnagramSetup({ onStart }: { onStart: (options: object) => void }) {
  const [choice, setChoice] = useState(readChoice);
  const level = LEVELS[choice.difficulty];

  function start() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
    } catch {
      // Lembrar a escolha é só conforto.
    }
    onStart({ difficulty: choice.difficulty, rounds: Number(choice.rounds), time: choice.timed ? Number(choice.time) : null });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-muted">Cada turno traz um nome com as letras embaralhadas. Monte o nome certo em até 3 tentativas.</p>

      <div className="space-y-1.5">
        <span className="block font-display text-sm font-bold text-ink">Dificuldade</span>
        <Segmented<AnagramDifficulty>
          aria-label="Dificuldade"
          value={choice.difficulty}
          onChange={(difficulty) => setChoice((current) => ({ ...current, difficulty }))}
          options={(Object.keys(LEVELS) as AnagramDifficulty[]).map((id) => ({ value: id, label: `${LEVELS[id].emoji} ${LEVELS[id].label}` }))}
        />
        <p className="text-xs font-semibold text-muted">{level.text}</p>
      </div>

      <div className="space-y-1.5">
        <span className="block font-display text-sm font-bold text-ink">Quantos nomes (turnos)</span>
        <Segmented aria-label="Quantidade de turnos" value={choice.rounds} onChange={(rounds) => setChoice((current) => ({ ...current, rounds }))} options={ROUNDS.map((value) => ({ value, label: value }))} />
      </div>

      <div className="panel space-y-3 p-3">
        <Switch
          checked={choice.timed}
          onChange={(timed) => setChoice((current) => ({ ...current, timed }))}
          label="Contar o tempo por nome"
          description={choice.timed ? 'Acabou o tempo, o nome conta como perdido.' : 'Sem pressa, mas cada nome vale 15% menos.'}
        />
        {choice.timed ? (
          <div className="space-y-1.5">
            <span className="block text-xs font-bold uppercase tracking-wider text-muted">Segundos por nome</span>
            <Segmented aria-label="Segundos por nome" value={choice.time} onChange={(time) => setChoice((current) => ({ ...current, time }))} options={TIMES.map((value) => ({ value, label: `${value}s` }))} />
          </div>
        ) : null}
      </div>

      <ul className="space-y-1 rounded-2xl bg-surface-3 p-3 text-xs font-semibold text-muted">
        <li>🎯 Pontuação máxima nesta escolha: {Math.round(1000 * level.scale).toLocaleString('pt-BR')} pontos.</li>
        <li>✅ Acertar de primeira vale mais; errar gasta tentativa (são 3 por nome).</li>
        <li>⚡ Quanto mais rápido, maior o bônus de cada nome.</li>
        <li>⌨️ No computador dá para digitar as letras; Enter confere e Backspace apaga.</li>
      </ul>

      <Button size="lg" className="w-full" onClick={start}>
        Começar
      </Button>
    </div>
  );
}

// ---------- A partida ----------

type Past = { answer: string; right: boolean; timedOut: boolean; points: number };
type Ended = { end: AnagramRoundEnd; next: AnagramPuzzle | null };

const BLUR: Record<AnagramDifficulty, string> = { facil: 'blur-md', medio: 'blur-xl grayscale', dificil: 'blur-xl grayscale' };

/** Anagrama em turnos: toque nas letras (ou digite) para montar cada nome, com tentativas, tempo opcional e o retrato que se revela ao acertar. */
export function AnagramGame({ puzzle, runId, report, finished }: GameProps<AnagramPuzzle> & { report: (result: MiniGameResult) => void }) {
  const [round, setRound] = useState<AnagramPuzzle>(puzzle);
  const [picked, setPicked] = useState<number[]>([]);
  const [attemptsLeft, setAttemptsLeft] = useState(puzzle.attempts);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [ended, setEnded] = useState<Ended | null>(null);
  const [past, setPast] = useState<Past[]>([]);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(puzzle.timePerRound);
  const shownAt = useRef(Date.now());
  const timeoutSent = useRef(false);
  const busyRef = useRef(false);

  const word = picked.map((index) => round.letters[index]).join('');
  const full = picked.length === round.length;
  const locked = finished || busy || ended !== null;

  /** Manda uma jogada ao servidor e aplica o que voltou (palpite errado, fim do nome, fim da partida). */
  const play = useCallback(
    async (body: { action: 'check'; word: string } | { action: 'skip' } | { action: 'timeout' }) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setMessage(null);
      try {
        const response = await actMiniGame(runId, body);
        const event = response.anagram;
        if (event?.kind === 'wrong') {
          setAttemptsLeft(event.attemptsLeft);
          setMessage(event.attemptsLeft === 1 ? 'Ainda não é esse. Última tentativa!' : 'Ainda não é esse. Tente de novo!');
          setPicked([]);
          setShake((value) => value + 1);
          playSfx('anWrong');
        }
        if (event?.kind === 'end') {
          playSfx(event.end.right ? 'anRight' : event.end.timedOut ? 'anTimeout' : 'anWrong');
          setEnded({ end: event.end, next: event.next });
          setPast((current) => [...current, { answer: event.end.answer, right: event.end.right, timedOut: event.end.timedOut, points: event.end.points }]);
        }
        if (response.result) {
          const solved = response.result.solved;
          report(response.result);
          window.setTimeout(() => playSfx(solved ? 'wsWin' : 'wsLose'), 700);
        }
      } catch (reason) {
        setMessage(errorMessage(reason));
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [runId, report],
  );

  const check = useCallback(() => {
    if (full && !locked) void play({ action: 'check', word });
  }, [full, locked, play, word]);

  // Relógio do nome: conta aqui na tela; o servidor confere o tempo de verdade.
  useEffect(() => {
    if (round.timePerRound === null || ended || finished) return undefined;
    timeoutSent.current = false;
    let lastWhole = Infinity;
    const id = window.setInterval(() => {
      const left = Math.max(0, round.timePerRound! - (Date.now() - shownAt.current) / 1000);
      setSecondsLeft(left);
      const whole = Math.ceil(left);
      if (whole <= 5 && whole > 0 && whole < lastWhole) playSfx('anTick');
      lastWhole = whole;
      if (left <= 0 && !timeoutSent.current) {
        timeoutSent.current = true;
        void play({ action: 'timeout' });
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [round, ended, finished, play]);

  function pick(index: number) {
    if (locked || picked.includes(index) || picked.length >= round.length) return;
    playSfx('anPick');
    setPicked((current) => [...current, index]);
  }

  function removeAt(slot: number) {
    if (locked) return;
    playSfx('anRemove');
    setPicked((current) => current.filter((_, at) => at !== slot));
  }

  // Teclado (computador): letras montam, Backspace apaga, Enter confere.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (locked || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === 'Enter') {
        check();
      } else if (event.key === 'Backspace') {
        setPicked((current) => current.slice(0, -1));
      } else if (event.key.length === 1) {
        const letter = event.key.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
        if (!/^[A-Z]$/.test(letter)) return;
        setPicked((current) => {
          const index = round.letters.findIndex((candidate, at) => candidate === letter && !current.includes(at));
          if (index < 0 || current.length >= round.length) return current;
          playSfx('anPick');
          return [...current, index];
        });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [locked, check, round]);

  function next() {
    if (!ended?.next) return;
    const upcoming = ended.next;
    setRound(upcoming);
    setPicked([]);
    setAttemptsLeft(upcoming.attempts);
    setMessage(null);
    setEnded(null);
    setSecondsLeft(upcoming.timePerRound);
    shownAt.current = Date.now();
    // Avisa o servidor que o relógio do novo nome começou (enquanto olhava o resultado, o tempo ficou parado).
    void actMiniGame(runId, { action: 'begin' }).catch(() => undefined);
  }

  const total = round.rounds;
  const dots = useMemo(() => Array.from({ length: total }, (_, index) => past[index] ?? null), [total, past]);
  const timePercent = round.timePerRound && secondsLeft !== null ? (secondsLeft / round.timePerRound) * 100 : 100;
  const gained = past.reduce((sum, item) => sum + item.points, 0);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="rounded-full bg-surface-3 px-3 py-1 text-ink">
            Nome {Math.min(past.length + (ended ? 0 : 1), total)} de {total}
          </span>
          <span className="rounded-full bg-primary/15 px-3 py-1 text-primary-strong dark:text-primary">
            {LEVELS[round.difficulty].emoji} {LEVELS[round.difficulty].label}
          </span>
          <span className="rounded-full bg-success/15 px-3 py-1 text-success-strong dark:text-success">{gained.toLocaleString('pt-BR')} pts</span>
        </div>
        <ol className="flex justify-center gap-1.5" aria-label="Andamento dos turnos">
          {dots.map((item, index) => (
            <li
              key={index}
              aria-label={item ? (item.right ? 'Acertou' : 'Perdeu') : index === past.length ? 'Agora' : 'Falta'}
              className={cn('h-2.5 flex-1 rounded-full', item ? (item.right ? 'bg-success' : 'bg-danger') : index === past.length ? 'bg-primary' : 'bg-surface-3')}
            />
          ))}
        </ol>
        {round.timePerRound !== null && !finished && !ended ? (
          <div className="space-y-1">
            <div className="h-2 overflow-hidden rounded-full bg-surface-3">
              <div className={cn('h-full rounded-full transition-[width] duration-200', timePercent > 40 ? 'bg-success' : timePercent > 15 ? 'bg-accent' : 'bg-danger')} style={{ width: `${timePercent}%` }} />
            </div>
            <p className={cn('text-center text-[11px] font-bold', timePercent <= 15 ? 'text-danger' : 'text-muted')} aria-live="off">
              ⏳ {clock(Math.ceil(secondsLeft ?? 0))} para este nome
            </p>
          </div>
        ) : null}
      </div>

      {ended ? (
        <div key={ended.end.answer} className={cn('panel animate-pop-in space-y-3 border-2 p-4 text-center', ended.end.right ? 'border-success' : 'border-danger')}>
          {ended.end.imageUrl ? <img src={ended.end.imageUrl} alt="" className="mx-auto h-24 w-24 rounded-2xl object-cover" /> : null}
          <p className="font-display text-sm font-bold uppercase tracking-wide text-muted">{ended.end.right ? 'Acertou!' : ended.end.timedOut ? 'O tempo acabou' : 'Não foi dessa vez'}</p>
          <p className="font-display text-2xl font-bold text-ink">{ended.end.answer}</p>
          {ended.end.right ? <p className="font-display text-lg font-bold text-success-strong dark:text-success">+{ended.end.points} pontos</p> : null}
          {ended.next ? <Button onClick={next}>Próximo nome</Button> : null}
        </div>
      ) : (
        <>
          <div className="panel flex items-start gap-3 p-3">
            {round.imageUrl ? <img src={round.imageUrl} alt="" className={cn('h-16 w-16 shrink-0 rounded-xl bg-surface-3 object-cover', BLUR[round.difficulty])} /> : null}
            <div className="min-w-0 space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Dica · {round.length} letras</p>
              <p className="text-sm font-semibold text-ink">{round.hint}</p>
            </div>
          </div>
          <p className="text-center text-sm font-bold text-muted">
            {attemptsLeft} {attemptsLeft === 1 ? 'tentativa restante' : 'tentativas restantes'}
          </p>
          <div data-sound="off" className="space-y-4">
            <div key={shake} className={cn('flex flex-wrap justify-center gap-1.5', shake > 0 && 'animate-shake')} aria-label="Seu nome montado">
              {Array.from({ length: round.length }, (_, slot) => (
                <button
                  key={slot}
                  type="button"
                  disabled={locked || picked[slot] === undefined}
                  onClick={() => removeAt(slot)}
                  aria-label={picked[slot] === undefined ? `Espaço ${slot + 1} vazio` : `Tirar a letra ${round.letters[picked[slot]]}`}
                  className={cn('flex h-12 w-9 items-center justify-center rounded-lg border-b-4 bg-surface-3 font-display text-2xl font-bold text-ink', picked[slot] === undefined ? 'border-edge-strong' : 'border-primary')}
                >
                  {picked[slot] === undefined ? '' : round.letters[picked[slot]]}
                </button>
              ))}
            </div>
            {message ? <Alert tone="danger">{message}</Alert> : null}
            <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Letras">
              {round.letters.map((letter, index) => (
                <button
                  key={index}
                  type="button"
                  disabled={picked.includes(index) || locked}
                  onClick={() => pick(index)}
                  className={cn('h-12 w-10 rounded-xl bg-surface-3 font-display text-xl font-bold text-ink transition active:scale-95', picked.includes(index) && 'opacity-30')}
                >
                  {letter}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" disabled={picked.length === 0 || locked} onClick={() => setPicked([])}>
              Limpar
            </Button>
            <Button className="flex-1" loading={busy} disabled={!full || finished} onClick={check}>
              Conferir
            </Button>
          </div>
          {!finished ? (
            <Button variant="ghost" size="sm" className="w-full" disabled={busy} onClick={() => void play({ action: 'skip' })}>
              Pular este nome
            </Button>
          ) : null}
        </>
      )}

      {finished && past.length > 0 ? (
        <ul className="space-y-1.5" aria-label="Seus nomes">
          {past.map((item, index) => (
            <li key={index} className="flex items-center gap-2 rounded-xl bg-surface-3 px-3 py-2 text-sm font-bold">
              <span aria-hidden>{item.right ? '✅' : item.timedOut ? '⏰' : '❌'}</span>
              <span className="min-w-0 flex-1 truncate text-ink">{item.answer}</span>
              <span className="text-muted">{item.points > 0 ? `+${item.points}` : '—'}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
