import * as React from 'react';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type BadgeTone = 'neutral' | 'primary' | 'accent' | 'violet' | 'danger' | 'success';

const toneClasses: Record<BadgeTone, string> = {
  neutral: 'border-edge bg-surface-3 text-muted',
  primary: 'border-transparent bg-primary/20 text-primary-strong dark:text-primary',
  accent: 'border-transparent bg-accent/15 text-accent-strong dark:text-accent',
  violet: 'border-transparent bg-violet/15 text-violet-strong dark:text-violet',
  danger: 'border-transparent bg-danger/15 text-danger-strong dark:text-danger',
  success: 'border-transparent bg-success/15 text-success-strong dark:text-success',
};

export function Badge({ className, tone = 'neutral', ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider',
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
