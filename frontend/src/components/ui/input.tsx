import * as React from 'react';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = 'text', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-12 w-full rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-primary)_86%,white)] px-4 text-sm text-[var(--text-primary)] shadow-sm transition-colors placeholder:text-[var(--text-secondary)]/70 focus-visible:border-[var(--gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--gold)_35%,transparent)] disabled:cursor-not-allowed disabled:opacity-60',
        className,
      )}
      {...props}
    />
  );
});
