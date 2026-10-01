import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { Button } from '@/components/ui/button';
import { fieldClassName } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useAnchoredPosition } from '@/components/ui/use-anchored-position';
import { cn } from '@/lib/cn';

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

type DateTimePickerProps = {
  /** ISO 8601 ou null. */
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  /** Não deixa escolher dias antes de hoje. */
  futureOnly?: boolean;
  'aria-label'?: string;
};

const sameDay = (left: Date, right: Date) => left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();

/** Data e hora no visual do app (no lugar do calendário nativo do navegador). */
export function DateTimePicker({ value, onChange, placeholder = 'Escolher data e hora', futureOnly = false, 'aria-label': ariaLabel }: DateTimePickerProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(value) : null;
  const [month, setMonth] = useState(() => {
    const base = selected ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const [draft, setDraft] = useState<Date | null>(selected);
  const position = useAnchoredPosition(triggerRef, open, { estimatedHeight: 420 });

  useEffect(() => {
    if (!open) return;
    const base = value ? new Date(value) : null;
    setDraft(base);
    setMonth(new Date((base ?? new Date()).getFullYear(), (base ?? new Date()).getMonth(), 1));
    function outside(event: MouseEvent) {
      const target = event.target as Node;
      // Os seletores de hora abrem em outro balão (portal): cliques lá não fecham.
      const insideSelect = (target as Element).closest?.('[role="listbox"], [role="option"]');
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target) && !insideSelect) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open, value]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const firstWeekday = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [...Array.from({ length: firstWeekday }, () => null), ...Array.from({ length: daysInMonth }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1))];

  function pickDay(day: Date) {
    const next = new Date(day);
    next.setHours(draft?.getHours() ?? 9, draft?.getMinutes() ?? 0, 0, 0);
    setDraft(next);
  }

  function setTime(hours: number, minutes: number) {
    const base = draft ? new Date(draft) : new Date(today);
    base.setHours(hours, minutes, 0, 0);
    setDraft(base);
  }

  const label = selected ? selected.toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' }) : placeholder;

  return (
    <div className="flex min-w-0 gap-2">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
        className={cn(fieldClassName, 'flex h-12 min-w-0 flex-1 items-center gap-2 text-left', open && 'border-primary ring-4 ring-primary/25')}
      >
        <CalendarMonthRoundedIcon fontSize="small" className="text-muted" />
        <span className={cn('flex-1 truncate', !selected && 'font-normal text-muted/80')}>{label}</span>
      </button>
      {selected ? (
        <button type="button" onClick={() => onChange(null)} aria-label="Limpar data" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-edge text-muted transition hover:text-ink">
          <CloseRoundedIcon fontSize="small" />
        </button>
      ) : null}

      {open && position
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label="Escolher data e hora"
              className="panel animate-pop-in fixed z-[110] w-[19rem] space-y-3 overflow-y-auto p-3"
              style={{
                left: Math.min(position.left, window.innerWidth - 312),
                maxHeight: position.maxHeight,
                ...(position.side === 'bottom' ? { top: position.top } : { bottom: window.innerHeight - position.top }),
              }}
            >
              <div className="flex items-center justify-between">
                <button type="button" aria-label="Mês anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-surface-3 hover:text-ink">
                  <ChevronLeftRoundedIcon />
                </button>
                <span className="font-display font-bold capitalize text-ink">
                  {MONTHS[month.getMonth()]} {month.getFullYear()}
                </span>
                <button type="button" aria-label="Próximo mês" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-surface-3 hover:text-ink">
                  <ChevronRightRoundedIcon />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {WEEKDAYS.map((weekday) => (
                  <span key={weekday} className="text-[11px] font-bold uppercase text-muted">
                    {weekday}
                  </span>
                ))}
                {cells.map((day, index) => {
                  if (!day) return <span key={`empty-${index}`} />;
                  const disabled = futureOnly && day < today;
                  const isSelected = draft ? sameDay(day, draft) : false;
                  return (
                    <button
                      key={day.toISOString()}
                      type="button"
                      disabled={disabled}
                      onClick={() => pickDay(day)}
                      aria-pressed={isSelected}
                      className={cn(
                        'h-9 rounded-xl text-sm font-semibold transition disabled:opacity-30',
                        isSelected ? 'bg-primary text-on-primary' : sameDay(day, new Date()) ? 'border-2 border-primary text-ink' : 'text-ink hover:bg-surface-3',
                      )}
                    >
                      {day.getDate()}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-muted">Hora</span>
                <div className="w-[5.5rem]">
                  <Select size="sm" aria-label="Hora" value={String(draft?.getHours() ?? 9).padStart(2, '0')} onChange={(hour) => setTime(Number(hour), draft?.getMinutes() ?? 0)} options={HOURS.map((hour) => ({ value: hour, label: hour }))} />
                </div>
                <span className="font-bold text-muted">:</span>
                <div className="w-[5.5rem]">
                  <Select
                    size="sm"
                    aria-label="Minutos"
                    value={MINUTES.includes(String(draft?.getMinutes() ?? 0).padStart(2, '0')) ? String(draft?.getMinutes() ?? 0).padStart(2, '0') : '00'}
                    onChange={(minute) => setTime(draft?.getHours() ?? 9, Number(minute))}
                    options={MINUTES.map((minute) => ({ value: minute, label: minute }))}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 border-t border-edge pt-3">
                <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  disabled={!draft}
                  onClick={() => {
                    if (draft) onChange(draft.toISOString());
                    setOpen(false);
                  }}
                >
                  Confirmar
                </Button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
