import { useEffect, useMemo, useState } from 'react';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import { cn } from '@/lib/cn';
import { Select } from '@/components/ui/select';

type PaginationProps = {
  /** Página atual, começando em 0. */
  page: number;
  totalPages: number;
  totalElements?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  /** Ex.: "personagens" → "Total: 12 personagens". */
  itemLabel?: string;
  className?: string;
};

/** Números das páginas com reticências: 1 … 4 5 6 … 20. */
function pageWindow(page: number, totalPages: number): Array<number | 'gap'> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index);
  }
  const pages = new Set([0, totalPages - 1, page - 1, page, page + 1]);
  const sorted = [...pages].filter((value) => value >= 0 && value < totalPages).sort((a, b) => a - b);
  const result: Array<number | 'gap'> = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) result.push('gap');
    result.push(value);
  });
  return result;
}

/** Paginação padrão de todas as listas do app. */
export function Pagination({
  page,
  totalPages,
  totalElements,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
  itemLabel = 'itens',
  className,
}: PaginationProps) {
  const pages = Math.max(totalPages, 1);
  const buttonClass = 'flex h-9 min-w-9 items-center justify-center rounded-xl px-2 font-display text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-40';

  return (
    <nav aria-label="Paginação" className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}>
      <p className="text-sm font-semibold text-muted">
        {totalElements !== undefined ? `Total: ${totalElements.toLocaleString('pt-BR')} ${itemLabel}` : `Página ${page + 1} de ${pages}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {onPageSizeChange && pageSize ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="hidden sm:inline">Por página</span>
            <div className="w-[5.5rem]">
              <Select
                size="sm"
                aria-label="Itens por página"
                value={String(pageSize)}
                onChange={(value) => onPageSizeChange(Number(value))}
                options={pageSizeOptions.map((option) => ({ value: String(option), label: String(option) }))}
              />
            </div>
          </div>
        ) : null}
        <div className="flex items-center gap-1">
          <button type="button" className={cn(buttonClass, 'text-muted hover:bg-surface-3 hover:text-ink')} onClick={() => onPageChange(page - 1)} disabled={page <= 0} aria-label="Página anterior">
            <ChevronLeftRoundedIcon />
          </button>
          {pageWindow(page, pages).map((item, index) =>
            item === 'gap' ? (
              <span key={`gap-${index}`} className="px-1 text-muted">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                aria-current={item === page ? 'page' : undefined}
                className={cn(buttonClass, item === page ? 'bg-primary text-on-primary shadow-[0_2px_0_var(--primary-strong)]' : 'text-muted hover:bg-surface-3 hover:text-ink')}
              >
                {item + 1}
              </button>
            ),
          )}
          <button type="button" className={cn(buttonClass, 'text-muted hover:bg-surface-3 hover:text-ink')} onClick={() => onPageChange(page + 1)} disabled={page + 1 >= pages} aria-label="Próxima página">
            <ChevronRightRoundedIcon />
          </button>
        </div>
      </div>
    </nav>
  );
}

/** Paginação feita no navegador, para listas que já vêm inteiras. Volta à 1ª página quando a lista muda de tamanho. */
export function usePagination<T>(items: T[], initialSize = 10) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialSize);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    if (page >= totalPages) setPage(totalPages - 1);
  }, [page, totalPages]);

  const pageItems = useMemo(() => items.slice(page * pageSize, page * pageSize + pageSize), [items, page, pageSize]);

  return {
    pageItems,
    page,
    pageSize,
    totalPages,
    totalElements: items.length,
    setPage,
    setPageSize: (size: number) => {
      setPageSize(size);
      setPage(0);
    },
    reset: () => setPage(0),
  };
}
