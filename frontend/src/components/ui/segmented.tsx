import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type SegmentedProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: ReactNode; icon?: ReactNode }>;
  className?: string;
  'aria-label'?: string;
};

/** Botões lado a lado para escolher uma entre poucas opções. */
export function Segmented<T extends string>({ value, onChange, options, className, 'aria-label': ariaLabel }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('inline-flex w-full gap-1 rounded-2xl bg-surface-3 p-1', className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-3 font-display text-sm font-semibold transition',
              active ? 'bg-surface text-ink shadow-[0_2px_0_var(--edge-strong)]' : 'text-muted hover:text-ink',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
