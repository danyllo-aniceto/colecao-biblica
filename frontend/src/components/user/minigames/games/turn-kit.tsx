import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/components/ui/toast';
import { actMiniGame, type MiniGameResult } from '@/lib/minigames-api';
import { playSfx } from '@/lib/sound/sfx';
import { clock } from './play-frame';

/** Peças comuns das telas de preparo e dos jogos em turnos (dificuldade, tempo, andamento, relógio de cada turno). */
export type Level = 'facil' | 'medio' | 'dificil';
export const LEVEL_EMOJI: Record<Level, string> = { facil: '🌱', medio: '🔥', dificil: '👑' };
export const LEVEL_LABEL: Record<Level, string> = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };
export const LEVEL_SCALE: Record<Level, number> = { facil: 0.6, medio: 0.8, dificil: 1 };

/** Escolha lembrada entre partidas (só conforto: se o navegador não deixar guardar, usa o padrão). */
export function readStored<T extends object>(key: string, fallback: T, accept: (saved: Partial<T>) => T): T {
  try {
    return accept(JSON.parse(window.localStorage.getItem(key) ?? '{}') as Partial<T>);
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: object) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Lembrar a escolha é só conforto.
  }
}

/** Moldura da tela de preparo: texto de abertura, campos, dicas e o botão Começar. */
export function SetupShell({ intro, tips, onStart, children }: { intro: string; tips: ReactNode[]; onStart: () => void; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-muted">{intro}</p>
      {children}
      <ul className="space-y-1 rounded-2xl bg-surface-3 p-3 text-xs font-semibold text-muted">
        {tips.map((tip, index) => (
          <li key={index}>{tip}</li>
        ))}
      </ul>
      <Button size="lg" className="w-full" onClick={onStart}>
        Começar
      </Button>
    </div>
  );
}

/** Quebra-cabeça e Memória têm um nível a mais: o Mestre. */
export type SizeLevel = Level | 'mestre';
export const SIZE_EMOJI: Record<SizeLevel, string> = { ...LEVEL_EMOJI, mestre: '🏆' };
export const SIZE_LABEL: Record<SizeLevel, string> = { ...LEVEL_LABEL, mestre: 'Mestre' };
export const SIZE_SCALE: Record<SizeLevel, number> = { ...LEVEL_SCALE, mestre: 1 };
export const SIZE_IDS: SizeLevel[] = ['facil', 'medio', 'dificil', 'mestre'];

export function SizeLevelField({ value, onChange, texts, label = 'Dificuldade' }: { value: SizeLevel; onChange: (level: SizeLevel) => void; texts: Record<SizeLevel, string>; label?: string }) {
  return (
    <div className="space-y-1.5">
      <span className="block font-display text-sm font-bold text-ink">{label}</span>
      <Segmented<SizeLevel> aria-label={label} value={value} onChange={onChange} options={SIZE_IDS.map((id) => ({ value: id, label: `${SIZE_EMOJI[id]} ${SIZE_LABEL[id]}` }))} className="[&_button]:px-1.5" />
      <p className="text-xs font-semibold text-muted">{texts[value]}</p>
    </div>
  );
}

export function LevelField({ value, onChange, texts }: { value: Level; onChange: (level: Level) => void; texts: Record<Level, string> }) {
  return (
    <div className="space-y-1.5">
      <span className="block font-display text-sm font-bold text-ink">Dificuldade</span>
      <Segmented<Level> aria-label="Dificuldade" value={value} onChange={onChange} options={(Object.keys(LEVEL_LABEL) as Level[]).map((id) => ({ value: id, label: `${LEVEL_EMOJI[id]} ${LEVEL_LABEL[id]}` }))} />
      <p className="text-xs font-semibold text-muted">{texts[value]}</p>
    </div>
  );
}

/** Escolha de quantidade (turnos, itens...) em botões lado a lado. */
export function CountField({ label, value, onChange, options, suffix = '' }: { label: string; value: string; onChange: (value: string) => void; options: readonly string[]; suffix?: string }) {
  return (
    <div className="space-y-1.5">
      <span className="block font-display text-sm font-bold text-ink">{label}</span>
      <Segmented aria-label={label} value={value} onChange={onChange} options={options.map((option) => ({ value: option, label: `${option}${suffix}` }))} />
    </div>
  );
}

/** "Contar o tempo?" e, se sim, quantos segundos. */
export function TimerField({ label, timed, onTimed, time, onTime, options, offNote, format = (value) => `${value}s`, unitLabel = 'Segundos' }: { label: string; timed: boolean; onTimed: (timed: boolean) => void; time: string; onTime: (time: string) => void; options: readonly string[]; offNote?: string; format?: (value: string) => string; unitLabel?: string }) {
  return (
    <div className="panel space-y-3 p-3">
      <Switch checked={timed} onChange={onTimed} label={label} description={timed ? 'Acabou o tempo, conta como perdido.' : (offNote ?? 'Sem pressa, mas cada turno vale 15% menos.')} />
      {timed ? (
        <div className="space-y-1.5">
          <span className="block text-xs font-bold uppercase tracking-wider text-muted">{unitLabel}</span>
          <Segmented aria-label={unitLabel} value={time} onChange={onTime} options={options.map((value) => ({ value, label: format(value) }))} />
        </div>
      ) : null}
    </div>
  );
}

/** Uma bolinha por turno: verde acertou, vermelho perdeu, azul é o de agora. */
export function RoundDots({ total, past, current }: { total: number; past: Array<boolean | null>; current: number }) {
  return (
    <ol className="flex justify-center gap-1.5" aria-label="Andamento dos turnos">
      {Array.from({ length: total }, (_, index) => {
        const item = past[index];
        return <li key={index} aria-label={item === undefined ? (index === current ? 'Agora' : 'Falta') : item ? 'Acertou' : 'Perdeu'} className={cn('h-2.5 flex-1 rounded-full', item === undefined ? (index === current ? 'bg-primary' : 'bg-surface-3') : item ? 'bg-success' : 'bg-danger')} />;
      })}
    </ol>
  );
}

/** Barra do tempo do turno: verde, depois amarela, depois vermelha. */
export function TimeBar({ left, total, unit = 'para este turno' }: { left: number; total: number; unit?: string }) {
  const percent = (left / total) * 100;
  return (
    <div className="space-y-1">
      <div className="h-2 overflow-hidden rounded-full bg-surface-3">
        <div className={cn('h-full rounded-full transition-[width] duration-200', percent > 40 ? 'bg-success' : percent > 15 ? 'bg-accent' : 'bg-danger')} style={{ width: `${percent}%` }} />
      </div>
      <p className={cn('text-center text-[11px] font-bold', percent <= 15 ? 'text-danger' : 'text-muted')}>
        ⏳ {clock(Math.ceil(left))} {unit}
      </p>
    </div>
  );
}

/**
 * Relógio de um turno que conta na tela (o servidor confere o tempo de verdade). Recomeça quando `resetKey` muda,
 * faz tique nos últimos 5 segundos e chama `onZero` uma vez ao zerar.
 */
export function useTurnClock({ total, active, resetKey, onZero }: { total: number | null; active: boolean; resetKey: unknown; onZero: () => void }): number | null {
  const [left, setLeft] = useState<number | null>(total);
  const startedAt = useRef(Date.now());
  const zeroRef = useRef(onZero);
  zeroRef.current = onZero;

  useEffect(() => {
    startedAt.current = Date.now();
    setLeft(total);
  }, [resetKey, total]);

  useEffect(() => {
    if (total === null || !active) return undefined;
    let sentZero = false;
    let lastWhole = Infinity;
    const id = window.setInterval(() => {
      const remaining = Math.max(0, total - (Date.now() - startedAt.current) / 1000);
      setLeft(remaining);
      const whole = Math.ceil(remaining);
      if (whole <= 5 && whole > 0 && whole < lastWhole) playSfx('anTick');
      lastWhole = whole;
      if (remaining <= 0 && !sentZero) {
        sentZero = true;
        zeroRef.current();
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [total, active, resetKey]);

  return left;
}

/** Cartão que aparece entre um turno e outro: o que era, os pontos e o botão para seguir. */
export function TurnFeedback({ tone, title, answer, points, imageUrl, onNext, extra }: { tone: 'success' | 'danger'; title: string; answer: string; points?: number; imageUrl?: string | null; onNext?: () => void; extra?: ReactNode }) {
  return (
    <div key={answer + title} className={cn('panel animate-pop-in space-y-3 border-2 p-4 text-center', tone === 'success' ? 'border-success' : 'border-danger')}>
      {imageUrl ? <img src={imageUrl} alt="" className="mx-auto h-24 w-24 rounded-2xl object-cover" /> : null}
      <p className="font-display text-sm font-bold uppercase tracking-wide text-muted">{title}</p>
      <p className="font-display text-2xl font-bold text-ink">{answer}</p>
      {points ? <p className="font-display text-lg font-bold text-success-strong dark:text-success">+{points} pontos</p> : null}
      {extra}
      {onNext ? <Button onClick={onNext}>Próximo</Button> : null}
    </div>
  );
}

/** Cabeçalho dos jogos em turnos: contador, dificuldade e pontos ganhos. */
export function TurnHeader({ label, level, points }: { label: string; level: Level; points: number }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs font-bold">
      <span className="rounded-full bg-surface-3 px-3 py-1 text-ink">{label}</span>
      <span className="rounded-full bg-primary/15 px-3 py-1 text-primary-strong dark:text-primary">
        {LEVEL_EMOJI[level]} {LEVEL_LABEL[level]}
      </span>
      <span className="rounded-full bg-success/15 px-3 py-1 text-success-strong dark:text-success">{points.toLocaleString('pt-BR')} pts</span>
    </div>
  );
}

/**
 * Jogada ao servidor nos jogos em turnos: uma de cada vez, devolve o evento do jogo, entrega o resultado final (com o som de vitória ou de fim)
 * e mostra o erro como mensagem.
 */
export function useTurnAct<E>(runId: string, report: (result: MiniGameResult) => void, onEvent: (event: E) => void) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const busyRef = useRef(false);
  const handler = useRef(onEvent);
  handler.current = onEvent;

  const act = useCallback(
    async (body: object) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setMessage(null);
      try {
        const response = await actMiniGame(runId, body);
        if (response.turn) handler.current(response.turn as E);
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

  return { act, busy, message, setMessage };
}
