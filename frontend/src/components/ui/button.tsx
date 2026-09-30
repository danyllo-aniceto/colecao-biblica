import * as React from 'react';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

// Cada variante "3D" define a cor da borda inferior (--btn-edge), que afunda ao pressionar.
const variantClasses: Record<ButtonVariant, string> = {
  primary: 'btn-3d bg-primary text-on-primary [--btn-edge:var(--primary-strong)]',
  accent: 'btn-3d bg-accent text-on-accent [--btn-edge:var(--accent-strong)]',
  danger: 'btn-3d bg-danger text-white [--btn-edge:var(--danger-strong)]',
  secondary: 'btn-3d border border-edge bg-surface-3 text-ink [--btn-edge:var(--edge-strong)]',
  ghost: 'bg-transparent text-muted hover:bg-surface-3 hover:text-ink',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-12 px-6 text-base',
  xl: 'h-14 px-8 text-lg',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          'inline-flex select-none items-center justify-center gap-2 rounded-2xl font-display font-semibold tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40 disabled:pointer-events-none disabled:opacity-50',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
