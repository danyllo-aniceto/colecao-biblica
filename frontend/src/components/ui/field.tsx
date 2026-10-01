import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type FieldProps = {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  /** Conteúdo à direita do rótulo (contador, botão...). */
  aside?: ReactNode;
};

/** Rótulo + campo + dica/erro, no mesmo padrão em todos os formulários. */
export function Field({ label, children, hint, error, required, htmlFor, className, aside }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-end justify-between gap-2">
        <label htmlFor={htmlFor} className="text-sm font-bold text-muted">
          {label}
          {required ? <span className="ml-0.5 text-danger">*</span> : null}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <span role="alert" className="text-xs font-semibold text-danger">
          {error}
        </span>
      ) : hint ? (
        <span className="text-xs text-muted">{hint}</span>
      ) : null}
    </div>
  );
}
