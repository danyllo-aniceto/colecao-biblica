import { useCallback, useEffect, useRef, useState } from 'react';
import { MOMENT_MS, STEP_MS, MAX_WALK_STEPS, type Callout, type CalloutTone, type PawnFx } from '@board/callouts';

/** Aviso com identificador: cada um toca uma vez só (a partida local e a sala online entregam a lista crescendo). */
export type FeedEntry = Callout & { id: string };

export type ActiveCallout = Callout & { key: string; ms: number };
export type TileBurst = { key: string; tile: number; emoji: string; tone: CalloutTone };
export type PawnEffects = Record<string, { fx: PawnFx; key: string }>;

const BURST_MS = 1700;
const PAWN_FX_MS = 1300;
/** Fila acumulada demais (aba escondida por um tempo) deixa de fazer sentido: ficam só os últimos. */
const MAX_QUEUE = 4;

type Queued = FeedEntry & { readyAt: number };

/**
 * Toca os avisos novos do tabuleiro um de cada vez: o cartaz com o que aconteceu (que dá para pular), o brilho na casa e o
 * movimento do peão. Enquanto há aviso na fila ou na tela, `hold` fica verdadeiro e a tela segura a próxima jogada.
 * Os avisos que já estavam na lista quando a tela abriu (retomar partida, entrar na sala) não tocam.
 */
export function useCalloutPlayer(feed: FeedEntry[]) {
  const [queue, setQueue] = useState<Queued[]>([]);
  const [active, setActive] = useState<ActiveCallout | null>(null);
  const [bursts, setBursts] = useState<TileBurst[]>([]);
  const [pawnFx, setPawnFx] = useState<PawnEffects>({});
  const seen = useRef<Set<string>>(new Set(feed.map((entry) => entry.id)));
  const timers = useRef<number[]>([]);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  // Avisos novos entram no fim da fila (o tempo do peão andar vale a partir de agora).
  useEffect(() => {
    const fresh = feed.filter((entry) => !seen.current.has(entry.id));
    if (fresh.length === 0) return;
    for (const entry of fresh) seen.current.add(entry.id);
    if (seen.current.size > 80) seen.current = new Set(feed.map((entry) => entry.id));
    const now = Date.now();
    setQueue((current) => [...current, ...fresh.map((entry) => ({ ...entry, readyAt: now + entry.delayMs }))].slice(-MAX_QUEUE));
  }, [feed]);

  // Mostra o próximo quando não há nenhum na tela.
  useEffect(() => {
    if (active || queue.length === 0) return;
    const entry = queue[0];
    const timer = window.setTimeout(() => {
      setQueue((current) => current.slice(1));
      setActive({ ...entry, key: entry.id, ms: MOMENT_MS });
      setBursts(entry.tiles.map((tile) => ({ key: `${entry.id}-${tile}`, tile, emoji: entry.emoji, tone: entry.tone })));
      if (entry.playerId && entry.fx) setPawnFx((current) => ({ ...current, [entry.playerId as string]: { fx: entry.fx as PawnFx, key: entry.id } }));
      later(() => setBursts((current) => current.filter((burst) => !burst.key.startsWith(`${entry.id}-`))), BURST_MS);
      later(() => {
        if (entry.playerId) setPawnFx((current) => (current[entry.playerId as string]?.key === entry.id ? Object.fromEntries(Object.entries(current).filter(([id]) => id !== entry.playerId)) : current));
      }, PAWN_FX_MS);
    }, Math.max(0, entry.readyAt - Date.now()));
    return () => window.clearTimeout(timer);
  }, [queue, active, later]);

  // Cada aviso fica um tempo na tela e sai sozinho (ou antes, com um toque).
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setActive(null), active.ms);
    return () => window.clearTimeout(timer);
  }, [active]);

  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  const skip = useCallback(() => setActive(null), []);

  return { active, bursts, pawnFx, hold: active !== null || queue.length > 0, skip };
}

/**
 * Segura a tela enquanto os peões andam (casa a casa) depois de uma jogada, para a próxima pergunta ou o dado
 * não aparecerem por cima do movimento.
 */
export function useWalkHold(positions: number[]): boolean {
  const [walking, setWalking] = useState(false);
  const previous = useRef(positions);
  const key = positions.join(',');

  useEffect(() => {
    const before = previous.current;
    previous.current = positions;
    if (before.length !== positions.length) return;
    const forward = Math.max(0, ...positions.map((position, index) => position - before[index]));
    const changed = positions.some((position, index) => position !== before[index]);
    if (!changed) return;
    const ms = forward > 0 ? Math.min(forward, MAX_WALK_STEPS) * STEP_MS + 500 : 700;
    setWalking(true);
    const timer = window.setTimeout(() => setWalking(false), ms);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return walking;
}
