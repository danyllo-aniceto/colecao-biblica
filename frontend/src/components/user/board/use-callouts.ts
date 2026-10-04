import { useEffect, useRef, useState } from 'react';
import type { Callout, CalloutTone, PawnFx } from '@board/callouts';

/** Aviso com identificador: cada um toca uma vez só (a partida local e a sala online entregam a lista crescendo). */
export type FeedEntry = Callout & { id: string };

export type ActiveCallout = Callout & { key: string; ms: number };
export type TileBurst = { key: string; tile: number; emoji: string; tone: CalloutTone };
export type PawnEffects = Record<string, { fx: PawnFx; key: string }>;

/** Quanto cada aviso fica na tela (menos quando há vários na fila). */
const LONG_MS = 3200;
const SHORT_MS = 2200;
const BURST_MS = 1700;
const PAWN_FX_MS = 1300;
/** Fila longa demais deixa de fazer sentido: passa de tantos ms de espera, os informativos são pulados. */
const MAX_BACKLOG_MS = 7000;

/**
 * Toca em fila os avisos novos do tabuleiro: o cartaz com o que aconteceu, o brilho nas casas e o movimento do peão.
 * Os avisos que já estavam na lista quando a tela abriu (retomar partida, entrar na sala) não tocam.
 */
export function useCalloutPlayer(feed: FeedEntry[]) {
  const [active, setActive] = useState<ActiveCallout | null>(null);
  const [bursts, setBursts] = useState<TileBurst[]>([]);
  const [pawnFx, setPawnFx] = useState<PawnEffects>({});
  const seen = useRef<Set<string>>(new Set(feed.map((entry) => entry.id)));
  const freeAt = useRef(0);
  const timers = useRef<number[]>([]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  useEffect(() => {
    const fresh = feed.filter((entry) => !seen.current.has(entry.id));
    if (fresh.length === 0) return;
    for (const entry of fresh) seen.current.add(entry.id);
    // Lista que encolheu (revanche): só esquece o que sumiu, para os ids não crescerem para sempre.
    if (seen.current.size > 80) seen.current = new Set(feed.map((entry) => entry.id));

    const now = Date.now();
    const duration = fresh.length > 1 ? SHORT_MS : LONG_MS;
    for (const entry of fresh) {
      if (freeAt.current - now > MAX_BACKLOG_MS && entry.tone === 'info') continue;
      const start = Math.max(freeAt.current, now + entry.delayMs);
      freeAt.current = start + duration;
      later(() => {
        setActive({ ...entry, key: entry.id, ms: duration });
        setBursts(entry.tiles.map((tile) => ({ key: `${entry.id}-${tile}`, tile, emoji: entry.emoji, tone: entry.tone })));
        if (entry.playerId && entry.fx) setPawnFx((current) => ({ ...current, [entry.playerId as string]: { fx: entry.fx as PawnFx, key: entry.id } }));
        later(() => setBursts((current) => current.filter((burst) => !burst.key.startsWith(`${entry.id}-`))), BURST_MS);
        later(() => {
          if (entry.playerId) setPawnFx((current) => (current[entry.playerId as string]?.key === entry.id ? Object.fromEntries(Object.entries(current).filter(([id]) => id !== entry.playerId)) : current));
        }, PAWN_FX_MS);
        later(() => setActive((current) => (current?.key === entry.id ? null : current)), duration - 150);
      }, start - now);
    }
  }, [feed]);

  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
    },
    [],
  );

  return { active, bursts, pawnFx };
}
