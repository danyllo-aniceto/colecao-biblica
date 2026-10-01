import { useState, type KeyboardEvent } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { cn } from '@/lib/cn';

type ChipInputProps = {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  /** Sugestões clicáveis abaixo do campo. */
  suggestions?: string[];
  tone?: 'primary' | 'accent' | 'violet';
  id?: string;
};

const toneClass = {
  primary: 'bg-primary/20 text-primary-strong dark:text-primary',
  accent: 'bg-accent/15 text-accent-strong dark:text-accent',
  violet: 'bg-violet/15 text-violet-strong dark:text-violet',
};

/** Lista de etiquetas: Enter ou vírgula adiciona, X remove. */
export function ChipInput({ value, onChange, placeholder = 'Digite e tecle Enter', suggestions = [], tone = 'accent', id }: ChipInputProps) {
  const [draft, setDraft] = useState('');

  function add(raw: string) {
    const items = raw
      .split(/[,;\n]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (items.length === 0) return;
    const existing = new Set(value.map((item) => item.toLowerCase()));
    onChange([...value, ...items.filter((item) => !existing.has(item.toLowerCase()))]);
    setDraft('');
  }

  function handleKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      add(draft);
    } else if (event.key === 'Backspace' && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  const available = suggestions.filter((suggestion) => !value.some((item) => item.toLowerCase() === suggestion.toLowerCase()));

  return (
    <div className="space-y-2">
      <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-2xl border-2 border-edge bg-surface-2 p-2 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/25">
        {value.map((item) => (
          <span key={item} className={cn('inline-flex items-center gap-1 rounded-full py-1 pl-3 pr-1 text-sm font-semibold', toneClass[tone])}>
            {item}
            <button
              type="button"
              onClick={() => onChange(value.filter((entry) => entry !== item))}
              aria-label={`Remover ${item}`}
              className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-black/10"
            >
              <CloseRoundedIcon sx={{ fontSize: 14 }} />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKey}
          onBlur={() => add(draft)}
          placeholder={value.length === 0 ? placeholder : ''}
          className="h-8 min-w-32 flex-1 bg-transparent px-1 text-sm font-semibold text-ink outline-none placeholder:font-normal placeholder:text-muted/70"
        />
      </div>
      {available.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {available.slice(0, 12).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => add(suggestion)}
              className="rounded-full border border-dashed border-edge-strong px-2.5 py-0.5 text-xs font-semibold text-muted transition hover:border-primary hover:text-ink"
            >
              + {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** "a, b, c" ↔ ["a", "b", "c"] (formato salvo no banco). */
export const splitList = (value?: string | null) =>
  (value ?? '')
    .split(/[,;\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
export const joinList = (items: string[]) => items.join(', ');
