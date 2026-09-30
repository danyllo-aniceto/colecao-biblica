import * as React from 'react';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/** Aparência comum de campos (input, select, textarea). */
export const fieldClassName =
  'rounded-2xl border-2 border-edge bg-surface-2 px-4 text-sm font-semibold text-ink transition-colors placeholder:font-normal placeholder:text-muted/70 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type = 'text', ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      type={type}
      className={cn(
        'flex h-12 w-full',
        fieldClassName,
        className,
      )}
      {...props}
    />
  );
});
