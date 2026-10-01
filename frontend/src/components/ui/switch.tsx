import { useId, type ReactNode } from 'react';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { cn } from '@/lib/cn';

type ToggleProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
};

/** Interruptor liga/desliga (no lugar do checkbox nativo para opções de estado). */
export function Switch({ checked, onChange, label, description, disabled, className }: ToggleProps) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn('flex cursor-pointer items-center gap-3', disabled && 'cursor-not-allowed opacity-60', className)}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
          checked ? 'border-primary-strong bg-primary' : 'border-edge-strong bg-surface-3',
        )}
      >
        <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[1.35rem]' : 'translate-x-0.5')} />
      </button>
      {label || description ? (
        <span className="min-w-0">
          {label ? <span className="block text-sm font-bold text-ink">{label}</span> : null}
          {description ? <span className="block text-xs text-muted">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}

/** Caixa de seleção no visual do app. */
export function Checkbox({ checked, onChange, label, description, disabled, className }: ToggleProps) {
  const id = useId();
  return (
    <label htmlFor={id} className={cn('flex cursor-pointer items-start gap-2.5', disabled && 'cursor-not-allowed opacity-60', className)}>
      <button
        id={id}
        type="button"
        role="checkbox"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30',
          checked ? 'border-primary-strong bg-primary text-on-primary' : 'border-edge-strong bg-surface-2',
        )}
      >
        {checked ? <CheckRoundedIcon sx={{ fontSize: 16 }} /> : null}
      </button>
      {label || description ? (
        <span className="min-w-0">
          {label ? <span className="block text-sm font-semibold text-ink">{label}</span> : null}
          {description ? <span className="block text-xs text-muted">{description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}
