import { cn } from '@/lib/cn';

/** Posições dos pontos (grade 3x3, 0 a 8) de cada face. */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const CENTERS = [27, 50, 73];

/** Dado de seis faces. Valores acima de 6 (dado + ajuda) aparecem como número. */
export function Dice({ value, rolling = false, size = 72, className }: { value: number | null; rolling?: boolean; size?: number; className?: string }) {
  const face = value && value >= 1 && value <= 6 ? PIPS[value] : null;
  return (
    <div
      role="img"
      aria-label={value ? `Dado: ${value}` : 'Dado'}
      style={{ width: size, height: size }}
      className={cn(
        'relative shrink-0 rounded-2xl border-2 border-edge-strong bg-surface shadow-[0_4px_0_var(--edge-strong)] transition-transform',
        rolling && 'animate-bounce',
        className,
      )}
    >
      {face ? (
        face.map((cell) => (
          <span
            key={cell}
            className="absolute h-[19%] w-[19%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink"
            style={{ left: `${CENTERS[cell % 3]}%`, top: `${CENTERS[Math.floor(cell / 3)]}%` }}
          />
        ))
      ) : (
        <span className="absolute inset-0 flex items-center justify-center font-display text-3xl font-bold text-muted">{value ?? '?'}</span>
      )}
    </div>
  );
}
