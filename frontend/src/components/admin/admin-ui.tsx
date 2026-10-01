import type { ReactNode } from 'react';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip } from '@/components/ui/tooltip';
import { Alert } from '@/components/game/game-ui';
import { cn } from '@/lib/cn';
import type { StickerRarity } from '@/lib/admin-api';
import { getRarityLabel } from '@/lib/rarity-theme';

/** Bloco padrão das telas do painel: título, descrição, ações e conteúdo. */
export function AdminPanel({ title, description, actions, children, className }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('panel space-y-5 p-5 sm:p-6', className)}>
      {title || actions ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title ? <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">{title}</h2> : null}
            {description ? <p className="mt-1 max-w-3xl text-sm text-muted">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Campo de busca com lupa. */
export function SearchInput({ value, onChange, placeholder, label }: { value: string; onChange: (value: string) => void; placeholder?: string; label: string }) {
  return (
    <div className="relative">
      <SearchRoundedIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" fontSize="small" />
      <Input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={label} className="pl-10" />
    </div>
  );
}

type Column = { label: ReactNode; className?: string };

/**
 * Tabela do painel: cabeçalho, ícone de carregamento sobre a lista enquanto
 * busca, mensagem de vazio e de erro. No celular rola na horizontal.
 */
export function DataTable({
  columns,
  loading,
  error,
  empty,
  isEmpty,
  children,
  minWidth = 720,
}: {
  columns: Column[];
  loading: boolean;
  error?: string | null;
  empty: ReactNode;
  isEmpty: boolean;
  children: ReactNode;
  minWidth?: number;
}) {
  if (error) {
    return <Alert tone="danger">{error}</Alert>;
  }
  return (
    <div className="relative overflow-hidden rounded-3xl border border-edge">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-sm" style={{ minWidth }}>
          <thead className="bg-surface-3 text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              {columns.map((column, index) => (
                <th key={index} className={cn('border-b border-edge px-4 py-3 font-bold', column.className)}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-surface">
            {isEmpty && !loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-muted">
                  {empty}
                </td>
              </tr>
            ) : (
              children
            )}
            {isEmpty && loading ? (
              <tr>
                <td colSpan={columns.length} className="h-32" />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {loading ? (
        <div role="status" aria-label="Carregando" className="absolute inset-0 flex items-center justify-center bg-surface/60 backdrop-blur-[1px]">
          <Spinner size="lg" />
        </div>
      ) : null}
    </div>
  );
}

export function Row({ children, onClick, className }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <tr onClick={onClick} className={cn('transition-colors hover:bg-surface-2', onClick && 'cursor-pointer', className)}>
      {children}
    </tr>
  );
}

export function Cell({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn('border-b border-edge/70 px-4 py-3 align-middle text-ink', className)}>{children}</td>;
}

/** Botão de ícone com dica (editar, excluir, duplicar...). */
export function IconAction({ label, onClick, children, tone = 'neutral', disabled }: { label: string; onClick: () => void; children: ReactNode; tone?: 'neutral' | 'danger'; disabled?: boolean }) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-xl transition disabled:pointer-events-none disabled:opacity-40',
          tone === 'danger' ? 'text-danger hover:bg-danger/15' : 'text-muted hover:bg-surface-3 hover:text-ink',
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

export function StatusBadge({ active, on = 'Ativo', off = 'Inativo' }: { active: boolean; on?: string; off?: string }) {
  return <Badge tone={active ? 'success' : 'neutral'}>{active ? on : off}</Badge>;
}

export function RarityBadge({ rarity }: { rarity: StickerRarity }) {
  return (
    <span data-rarity={rarity} className="rarity rarity-chip inline-flex rounded-full px-2.5 py-0.5 font-display text-[11px] font-bold uppercase tracking-wider">
      {getRarityLabel(rarity)}
    </span>
  );
}

/** Miniatura da figurinha na lista. */
export function Thumb({ src, rarity, alt = '' }: { src?: string | null; rarity: StickerRarity; alt?: string }) {
  return (
    <span data-rarity={rarity} className="rarity rarity-bg flex h-12 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-[var(--r)]">
      {src ? <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" /> : <span className="rarity-text font-display text-xs font-bold">?</span>}
    </span>
  );
}

/** Número grande com rótulo (visão geral). */
export function Metric({ label, value, hint, icon, tone = 'primary', onClick }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: 'primary' | 'accent' | 'violet' | 'danger' | 'info'; onClick?: () => void }) {
  const toneClass = {
    primary: 'bg-primary/15 text-primary-strong dark:text-primary',
    accent: 'bg-accent/15 text-accent-strong dark:text-accent',
    violet: 'bg-violet/15 text-violet-strong dark:text-violet',
    danger: 'bg-danger/15 text-danger-strong dark:text-danger',
    info: 'bg-info/15 text-info-strong dark:text-info',
  }[tone];
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={cn('panel flex items-center gap-3 p-4 text-left', onClick && 'transition hover:-translate-y-0.5')}>
      {icon ? <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl', toneClass)}>{icon}</span> : null}
      <span className="min-w-0">
        <span className="block text-xs font-bold uppercase tracking-wider text-muted">{label}</span>
        <span className="block font-display text-2xl font-bold text-ink">{value}</span>
        {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
      </span>
    </Tag>
  );
}
