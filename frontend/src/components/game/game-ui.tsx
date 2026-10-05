import type { ReactNode } from 'react';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import ContentCutRoundedIcon from '@mui/icons-material/ContentCutRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import { Tooltip } from '@/components/ui/tooltip';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/** Mesma curva do backend: sair do nível 1 custa 300 XP e cada nível seguinte pede 100 XP a mais. */
export function xpForLevel(level: number) {
  const steps = Math.max(0, level - 1);
  return 300 * steps + (100 * steps * (steps - 1)) / 2;
}

/** Progresso dentro do nível atual. */
export function levelProgress(xp: number) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;
  const current = xp - xpForLevel(level);
  const needed = xpForLevel(level + 1) - xpForLevel(level);
  return { level, current, needed, percent: (current / needed) * 100 };
}

export function CoinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn('h-5 w-5', className)} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#FFC83D" stroke="#C98A00" strokeWidth="2" />
      <circle cx="12" cy="12" r="6.5" fill="none" stroke="#E0A200" strokeWidth="1.5" />
      <path d="M12 8v8M9 11h6" stroke="#8A5A00" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Ficha arredondada com ícone e número (moedas, bônus, vidas...). */
export function Chip({ icon, value, label, className }: { icon: ReactNode; value: ReactNode; label?: string; className?: string }) {
  const chip = (
    <span
      tabIndex={label ? 0 : undefined}
      className={cn('inline-flex h-9 items-center gap-1.5 rounded-full border border-edge bg-surface-2 pl-1.5 pr-3 font-display text-sm font-semibold text-ink', className)}
      aria-label={label ? `${label}: ${value}` : undefined}
    >
      <span className="flex h-6 w-6 items-center justify-center">{icon}</span>
      {value}
    </span>
  );
  return label ? <Tooltip content={label}>{chip}</Tooltip> : chip;
}

export function CoinChip({ value, className }: { value: number; className?: string }) {
  return <Chip icon={<CoinIcon />} value={value.toLocaleString('pt-BR')} label="Moedas" className={className} />;
}

export function BoostChips({ life, time, xp, hint = 0, freeze }: { life: number; time: number; xp: number; hint?: number; freeze?: number }) {
  return (
    <>
      {freeze !== undefined ? <Chip icon={<ShieldRoundedIcon sx={{ fontSize: 18 }} className="text-info" />} value={freeze} label="Protetores de sequência" /> : null}
      <Chip icon={<ContentCutRoundedIcon sx={{ fontSize: 18 }} className="text-violet" />} value={hint} label="Dicas 50/50" />
      <Chip icon={<FavoriteRoundedIcon sx={{ fontSize: 20 }} className="text-danger" />} value={life} label="Vidas extras" />
      <Chip icon={<TimerRoundedIcon sx={{ fontSize: 20 }} className="text-info" />} value={time} label="Tempo extra" />
      <Chip icon={<BoltRoundedIcon sx={{ fontSize: 20 }} className="text-primary" />} value={xp} label="XP em dobro" />
    </>
  );
}

export function ProgressBar({ value, className, color }: { value: number; className?: string; color?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('h-3 w-full overflow-hidden rounded-full bg-surface-3', className)} role="progressbar" aria-valuenow={Math.round(clamped)} aria-valuemin={0} aria-valuemax={100}>
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${clamped}%`, background: color ?? 'linear-gradient(90deg, var(--accent), var(--primary))' }}
      />
    </div>
  );
}

/** Selo de nível em formato de escudo arredondado. */
export function LevelBadge({ level, size = 'md' }: { level: number; size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: 'h-9 w-9 text-sm', md: 'h-12 w-12 text-lg', lg: 'h-20 w-20 text-3xl' }[size];
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,var(--violet),var(--info))] font-display font-bold text-white shadow-[0_4px_0_var(--violet-strong)]',
        dims,
      )}
      aria-label={`Nível ${level}`}
    >
      {level}
    </span>
  );
}

export function SectionHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function StatTile({ icon, label, value, tone = 'primary' }: { icon: ReactNode; label: string; value: ReactNode; tone?: 'primary' | 'accent' | 'violet' | 'danger' | 'info' }) {
  const toneClass = {
    primary: 'bg-primary/15 text-primary-strong dark:text-primary',
    accent: 'bg-accent/15 text-accent-strong dark:text-accent',
    violet: 'bg-violet/15 text-violet-strong dark:text-violet',
    danger: 'bg-danger/15 text-danger-strong dark:text-danger',
    info: 'bg-info/15 text-info-strong dark:text-info',
  }[tone];

  return (
    <div className="panel flex items-center gap-3 p-4">
      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', toneClass)}>{icon}</span>
      <div className="min-w-0">
        <div className="text-xs font-bold uppercase tracking-wider text-muted">{label}</div>
        <div className="truncate font-display text-xl font-bold text-ink">{value}</div>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-edge p-8 text-center">
      <span className="text-muted">{icon}</span>
      <p className="font-display text-lg font-semibold text-ink">{title}</p>
      {children ? <div className="text-sm text-muted">{children}</div> : null}
    </div>
  );
}

export function Alert({ tone, children }: { tone: 'success' | 'danger' | 'info'; children: ReactNode }) {
  const toneClass = {
    success: 'border-success/40 bg-success/10 text-success-strong dark:text-success',
    danger: 'border-danger/40 bg-danger/10 text-danger-strong dark:text-danger',
    info: 'border-info/40 bg-info/10 text-info-strong dark:text-info',
  }[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('rounded-2xl border px-4 py-3 text-sm font-semibold', toneClass)}>
      {children}
    </div>
  );
}
