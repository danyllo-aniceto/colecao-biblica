import { useCallback, useState } from 'react';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import type { MiniGameResult, WhoAmIEnd, WhoAmIEvent, WhoAmIPuzzle } from '@/lib/minigames-api';
import { playSfx } from '@/lib/sound/sfx';
import type { GameProps, SetupRender } from './play-frame';
import { CountField, LEVEL_SCALE, LevelField, RoundDots, SetupShell, TimerField, TimeBar, TurnFeedback, TurnHeader, readStored, useTurnAct, useTurnClock, writeStored, type Level } from './turn-kit';

// ---------- Tela de preparo ----------

const LEVEL_TEXT: Record<Level, string> = {
  facil: '3 nomes para escolher · já abre com 2 dicas',
  medio: '4 nomes para escolher · abre com 1 dica',
  dificil: '6 nomes parecidos (do mesmo Testamento) · abre com 1 dica',
};
const ROUNDS = ['1', '3', '5'] as const;
const TIMES = ['30', '45', '60', '90', '120'] as const;
const KEY = 'quem-sou-eu-escolhas';
type Choice = { level: Level; rounds: string; timed: boolean; time: string };
const FALLBACK: Choice = { level: 'medio', rounds: '3', timed: false, time: '60' };

/** Antes de começar: dificuldade, quantos personagens (turnos) e tempo por personagem. */
export const whoAmISetup: SetupRender = ({ onStart }) => <WhoAmISetup onStart={onStart} />;

function WhoAmISetup({ onStart }: { onStart: (options: object) => void }) {
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
      intro="Descubra qual personagem eu sou. As dicas vão da mais vaga à mais clara e só há uma chance de responder em cada turno."
      tips={[`🎯 Pontuação máxima nesta escolha: ${Math.round(1000 * LEVEL_SCALE[choice.level]).toLocaleString('pt-BR')} pontos.`, '💡 Cada dica a mais tira 15% dos pontos do turno.', '📸 No fim de cada turno aparece a foto do personagem.', '🏆 Vence quem acerta metade dos personagens ou mais.']}
      onStart={() => {
        writeStored(KEY, choice);
        onStart({ difficulty: choice.level, rounds: Number(choice.rounds), time: choice.timed ? Number(choice.time) : null });
      }}
    >
      <LevelField value={choice.level} onChange={(level) => update({ level })} texts={LEVEL_TEXT} />
      <CountField label="Quantos personagens (turnos)" value={choice.rounds} onChange={(rounds) => update({ rounds })} options={ROUNDS} />
      <TimerField label="Contar o tempo por personagem" timed={choice.timed} onTimed={(timed) => update({ timed })} time={choice.time} onTime={(time) => update({ time })} options={TIMES} />
    </SetupShell>
  );
}

// ---------- A partida ----------

/** Quem sou eu?: peça mais dicas (cada uma custa pontos) e escolha o nome. No fim do turno aparece a foto do personagem. */
export function WhoAmIGame({ puzzle, runId, report, finished }: GameProps<WhoAmIPuzzle> & { report: (result: MiniGameResult) => void }) {
  const [round, setRound] = useState(puzzle);
  const [clues, setClues] = useState(puzzle.clues);
  const [ended, setEnded] = useState<{ end: WhoAmIEnd; next: WhoAmIPuzzle | null; picked: number | null } | null>(null);
  const [past, setPast] = useState<boolean[]>([]);
  const [gained, setGained] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  const onEvent = useCallback((event: WhoAmIEvent) => {
    if (event.kind === 'hint') {
      setClues((current) => [...current, event.clue]);
      playSfx('wsHint');
    } else if (event.kind === 'end') {
      playSfx(event.end.right ? 'anRight' : event.end.timedOut ? 'anTimeout' : 'anWrong');
      setEnded({ end: event.end, next: event.next, picked: null });
      setPast((current) => [...current, event.end.right]);
      setGained((current) => current + event.end.points);
    }
  }, []);
  const { act, busy, message } = useTurnAct<WhoAmIEvent>(runId, report, onEvent);
  const locked = finished || busy || ended !== null;
  const left = useTurnClock({ total: round.timePerRound, active: !ended && !finished, resetKey: round.round, onZero: () => void act({ action: 'timeout' }) });

  function choose(choice: number) {
    if (locked) return;
    setPicked(choice);
    void act({ action: 'answer', choice });
  }

  function next() {
    if (!ended?.next) return;
    const upcoming = ended.next;
    setRound(upcoming);
    setClues(upcoming.clues);
    setPicked(null);
    setEnded(null);
    void act({ action: 'begin' });
  }

  return (
    <div className="space-y-4">
      <TurnHeader label={`Personagem ${Math.min(past.length + (ended ? 0 : 1), round.rounds)} de ${round.rounds}`} level={round.level} points={gained} />
      <RoundDots total={round.rounds} past={past} current={past.length} />
      {left !== null && round.timePerRound !== null && !ended && !finished ? <TimeBar left={left} total={round.timePerRound} unit="para este personagem" /> : null}

      {ended ? (
        <TurnFeedback
          tone={ended.end.right ? 'success' : 'danger'}
          title={ended.end.right ? 'Acertou! Era' : ended.end.timedOut ? 'O tempo acabou. Era' : 'Não foi dessa vez. Era'}
          answer={ended.end.answer}
          points={ended.end.points}
          onNext={ended.next ? next : undefined}
          extra={
            <div className="space-y-3">
              {ended.end.imageUrl ? <img src={ended.end.imageUrl} alt={ended.end.answer} className="mx-auto max-h-64 w-44 animate-pop-in rounded-2xl object-cover shadow-lg" /> : null}
              {ended.end.summary ? <p className="text-sm font-semibold text-muted">{ended.end.summary}</p> : null}
              <p className="text-xs font-bold text-muted">
                Você usou {ended.end.shown} {ended.end.shown === 1 ? 'dica' : 'dicas'}.
              </p>
            </div>
          }
        />
      ) : (
        <>
          <p className="text-sm font-semibold text-muted">Descubra quem eu sou. Cada dica a mais custa 15% dos pontos, e só há uma chance de responder.</p>
          <ol className="space-y-2" aria-label="Dicas">
            {clues.map((clue, index) => (
              <li key={index} className="panel animate-pop-in flex gap-3 p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-bold text-on-primary">{index + 1}</span>
                <span className="text-sm font-semibold text-ink">{clue}</span>
              </li>
            ))}
          </ol>
          {message ? <Alert tone="danger">{message}</Alert> : null}
          {clues.length < round.total && !finished ? (
            <Button variant="secondary" className="w-full" loading={busy} disabled={locked} onClick={() => void act({ action: 'hint' })}>
              💡 Mais uma dica ({clues.length}/{round.total})
            </Button>
          ) : null}
          <div className="grid gap-2" role="group" aria-label="Quem sou eu?">
            {round.options.map((name, index) => (
              <Button key={name} size="lg" variant={picked === index ? 'accent' : 'primary'} disabled={locked} onClick={() => choose(index)}>
                {name}
              </Button>
            ))}
          </div>
          {!finished ? (
            <Button variant="ghost" size="sm" className="w-full" disabled={locked} onClick={() => void act({ action: 'skip' })}>
              Pular personagem
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
