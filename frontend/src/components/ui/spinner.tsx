import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import { cn } from '@/lib/cn';

const sizes = { sm: 18, md: 22, lg: 32, xl: 48 } as const;

/** Ícone de carregamento padrão do app (use sempre este, nunca só texto). */
export function Spinner({ size = 'md', className, label }: { size?: keyof typeof sizes; className?: string; label?: string }) {
  return (
    <AutorenewRoundedIcon
      className={cn('animate-spin text-primary-strong dark:text-primary', className)}
      sx={{ fontSize: sizes[size] }}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

/** Bloco de carregamento: ícone + texto, centralizado. */
export function LoadingState({ label = 'Carregando...', className, fullScreen = false }: { label?: string; className?: string; fullScreen?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex flex-col items-center justify-center gap-3 text-center font-display font-semibold text-muted',
        fullScreen ? 'min-h-dvh' : 'py-12',
        className,
      )}
    >
      <Spinner size={fullScreen ? 'xl' : 'lg'} />
      <span>{label}</span>
    </div>
  );
}
