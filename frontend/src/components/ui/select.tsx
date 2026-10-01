import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { cn } from '@/lib/cn';
import { fieldClassName } from '@/components/ui/input';
import { useAnchoredPosition } from '@/components/ui/use-anchored-position';

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
};

type SelectProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: Array<SelectOption<T>>;
  placeholder?: string;
  /** Mostra um campo de busca na lista (bom para listas longas, como personagens). */
  searchable?: boolean;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md';
  id?: string;
  'aria-label'?: string;
};

function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Lista de opções no visual do app (no lugar do <select> nativo). */
export function Select<T extends string>({
  value,
  onChange,
  options,
  placeholder = 'Selecione',
  searchable = false,
  disabled,
  className,
  size = 'md',
  id,
  'aria-label': ariaLabel,
}: SelectProps<T>) {
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const position = useAnchoredPosition(triggerRef, open, { estimatedHeight: 320 });

  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const term = normalize(query.trim());
    return term ? options.filter((option) => normalize(`${option.label} ${option.description ?? ''}`).includes(term)) : options;
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    const index = Math.max(0, options.findIndex((option) => option.value === value));
    setActive(index);
    window.setTimeout(() => (searchable ? searchRef.current?.focus() : listRef.current?.focus()), 0);

    function handleOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !listRef.current?.parentElement?.contains(target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  function choose(option: SelectOption<T> | undefined) {
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleKey(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((current) => Math.min(current + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      choose(filtered[active]);
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      event.stopPropagation();
      setOpen(false);
      if (event.key === 'Escape') triggerRef.current?.focus();
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          fieldClassName,
          'flex w-full items-center gap-2 text-left',
          size === 'sm' ? 'h-9 rounded-xl px-3 text-sm' : 'h-12',
          open && 'border-primary ring-4 ring-primary/25',
          className,
        )}
      >
        {selected?.icon ? <span className="flex shrink-0">{selected.icon}</span> : null}
        <span className={cn('min-w-0 flex-1 truncate', !selected && 'font-normal text-muted/80')}>{selected?.label ?? placeholder}</span>
        <ExpandMoreRoundedIcon className={cn('shrink-0 text-muted transition-transform', open && 'rotate-180')} fontSize="small" />
      </button>

      {open && position
        ? createPortal(
            <div
              className="panel animate-pop-in fixed z-[110] flex flex-col overflow-hidden p-1.5"
              style={{
                left: Math.min(position.left, window.innerWidth - Math.max(position.width, 220) - 8),
                width: Math.max(position.width, 220),
                ...(position.side === 'bottom' ? { top: position.top } : { bottom: window.innerHeight - position.top }),
                maxHeight: Math.min(position.maxHeight, 360),
              }}
            >
              {searchable ? (
                <div className="relative mb-1.5 shrink-0">
                  <SearchRoundedIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" fontSize="small" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setActive(0);
                    }}
                    onKeyDown={handleKey}
                    placeholder="Buscar..."
                    aria-label="Buscar opção"
                    className={cn(fieldClassName, 'h-10 w-full rounded-xl pl-9')}
                  />
                </div>
              ) : null}
              <div ref={listRef} id={listId} role="listbox" tabIndex={-1} onKeyDown={handleKey} className="min-h-0 flex-1 overflow-y-auto outline-none">
                {filtered.length === 0 ? <p className="px-3 py-4 text-center text-sm text-muted">Nada encontrado.</p> : null}
                {filtered.map((option, index) => {
                  const isSelected = option.value === value;
                  return (
                    <div
                      key={option.value}
                      data-index={index}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={option.disabled}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => choose(option)}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm',
                        index === active && 'bg-surface-3',
                        option.disabled && 'cursor-not-allowed opacity-50',
                      )}
                    >
                      {option.icon ? <span className="flex shrink-0">{option.icon}</span> : null}
                      <span className="min-w-0 flex-1">
                        <span className={cn('block truncate font-semibold', isSelected ? 'text-ink' : 'text-ink/90')}>{option.label}</span>
                        {option.description ? <span className="block truncate text-xs text-muted">{option.description}</span> : null}
                      </span>
                      {isSelected ? <CheckRoundedIcon className="shrink-0 text-primary-strong dark:text-primary" fontSize="small" /> : null}
                    </div>
                  );
                })}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
