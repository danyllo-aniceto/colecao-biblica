import { useEffect, useState } from 'react';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/cn';

const SWATCHES = ['#ff4d6a', '#e0324f', '#ff6a3d', '#ffae00', '#d98f00', '#22c77a', '#12b39a', '#2ee6c5', '#2f8cff', '#5b8def', '#7c4dff', '#a64dff', '#f2a7c3', '#a0693a', '#8a94ad', '#1a1e46'];
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Escolha de cor no visual do app: paleta pronta e campo #rrggbb (sem o seletor nativo). */
export function ColorField({ value, onChange, id }: { value: string; onChange: (value: string) => void; id?: string }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Cores prontas">
        {SWATCHES.map((swatch) => {
          const active = swatch.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={swatch}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={swatch}
              onClick={() => onChange(swatch)}
              className={cn('flex h-8 w-8 items-center justify-center rounded-full border-2 text-white transition hover:scale-110', active ? 'border-ink' : 'border-transparent')}
              style={{ backgroundColor: swatch }}
            >
              {active ? <CheckRoundedIcon sx={{ fontSize: 18 }} /> : null}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <span className="h-10 w-10 shrink-0 rounded-xl border border-edge" style={{ backgroundColor: HEX.test(text) ? text : 'transparent' }} />
        <Input
          id={id}
          value={text}
          maxLength={7}
          placeholder="#rrggbb"
          onChange={(event) => {
            const next = event.target.value.startsWith('#') ? event.target.value : `#${event.target.value}`;
            setText(next);
            if (HEX.test(next)) onChange(next.toLowerCase());
          }}
          className="font-mono uppercase"
        />
      </div>
    </div>
  );
}
