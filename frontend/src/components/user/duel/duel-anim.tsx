import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Número que sobe ou desce contando de um em um, com um "pulo" verde quando aumenta e vermelho quando diminui.
 * Assim dá para ver o que mudou, em vez de o valor simplesmente trocar.
 */
export function AnimatedNumber({ value, className, step = 110 }: { value: number; className?: string; step?: number }) {
  const [shown, setShown] = useState(value);
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const target = useRef(value);

  useEffect(() => {
    if (value === target.current) return;
    const goingUp = value > target.current;
    target.current = value;
    setDirection(goingUp ? 'up' : 'down');
    setFlashKey((key) => key + 1);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setShown(value);
      return;
    }
    // Conta um por vez, no máximo ~1,2 s no total.
    const distance = Math.abs(value - shown);
    const interval = Math.max(35, Math.min(step, 1200 / Math.max(distance, 1)));
    const timer = window.setInterval(() => {
      setShown((current) => {
        if (current === target.current) {
          window.clearInterval(timer);
          return current;
        }
        return current + (target.current > current ? 1 : -1);
      });
    }, interval);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span key={flashKey} className={cn(direction === 'up' && 'animate-duel-num-up', direction === 'down' && 'animate-duel-num-down', className)}>
      {shown}
    </span>
  );
}

const HEX = 'polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0% 50%)';

/** Placar hexagonal do cenário (como no Snap): vermelho/verde para quem está na frente. */
export function PowerHex({ value, tone, children }: { value: number; tone: 'foe' | 'me'; children?: ReactNode }) {
  return (
    <span
      className={cn('flex h-9 w-10 items-center justify-center font-display text-lg font-bold text-white drop-shadow', tone === 'foe' ? 'bg-danger' : 'bg-success')}
      style={{ clipPath: HEX }}
    >
      <AnimatedNumber value={value} />
      {children}
    </span>
  );
}

/** Placar neutro (empate ou ninguém na frente). */
export function NeutralHex({ value }: { value: number }) {
  return (
    <span className="flex h-9 w-10 items-center justify-center bg-surface-3 font-display text-lg font-bold text-ink" style={{ clipPath: HEX }}>
      <AnimatedNumber value={value} />
    </span>
  );
}
