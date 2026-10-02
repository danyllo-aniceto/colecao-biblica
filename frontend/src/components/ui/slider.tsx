import { cn } from '@/lib/cn';

type SliderProps = {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  'aria-label': string;
  className?: string;
};

/** Barra de ajuste (volume etc.) no visual do app; o estilo está em globals.css (.slider). */
export function Slider({ value, onChange, min = 0, max = 100, step = 1, disabled, className, 'aria-label': ariaLabel }: SliderProps) {
  const percent = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      className={cn('slider', className)}
      style={{ '--fill': `${percent}%` } as React.CSSProperties}
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      data-sound="off"
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}
