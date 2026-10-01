import { cloneElement, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type TooltipProps = {
  content: ReactNode;
  /** Um único elemento focável (botão, link...). */
  children: ReactElement<Record<string, unknown>>;
  side?: 'top' | 'bottom';
  delay?: number;
};

/**
 * Dica no visual do app (no lugar do `title` nativo). Aparece ao passar o mouse,
 * ao focar pelo teclado e ao segurar o dedo no celular.
 */
export function Tooltip({ content, children, side = 'top', delay = 250 }: TooltipProps) {
  const id = useId();
  const triggerRef = useRef<HTMLElement | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ x: number; y: number; side: 'top' | 'bottom' } | null>(null);

  function show(immediate = false) {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), immediate ? 0 : delay);
  }

  function hide() {
    window.clearTimeout(timer.current);
    setOpen(false);
  }

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setCoords(null);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    const actualSide = side === 'top' && rect.top < 56 ? 'bottom' : side;
    setCoords({ x: rect.left + rect.width / 2, y: actualSide === 'top' ? rect.top - 8 : rect.bottom + 8, side: actualSide });
  }, [open, side]);

  if (!content) {
    return children;
  }

  const childProps = children.props;
  const trigger = cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
    },
    'aria-describedby': open ? id : undefined,
    onMouseEnter: (event: unknown) => {
      show();
      (childProps.onMouseEnter as ((event: unknown) => void) | undefined)?.(event);
    },
    onMouseLeave: (event: unknown) => {
      hide();
      (childProps.onMouseLeave as ((event: unknown) => void) | undefined)?.(event);
    },
    onFocus: (event: unknown) => {
      // Só no foco por teclado: o foco devolvido ao botão depois de fechar um modal não reabre a dica.
      const target = (event as { target?: Element }).target;
      if (!target?.matches || target.matches(':focus-visible')) show(true);
      (childProps.onFocus as ((event: unknown) => void) | undefined)?.(event);
    },
    onBlur: (event: unknown) => {
      hide();
      (childProps.onBlur as ((event: unknown) => void) | undefined)?.(event);
    },
    onTouchStart: (event: unknown) => {
      show();
      (childProps.onTouchStart as ((event: unknown) => void) | undefined)?.(event);
    },
    onTouchEnd: (event: unknown) => {
      window.setTimeout(hide, 1500);
      (childProps.onTouchEnd as ((event: unknown) => void) | undefined)?.(event);
    },
  });

  return (
    <>
      {trigger}
      {open && coords
        ? createPortal(
            <div
              id={id}
              role="tooltip"
              className="animate-pop-in pointer-events-none fixed z-[120] max-w-64 rounded-xl bg-ink px-3 py-1.5 text-center text-xs font-semibold leading-snug text-bg shadow-lg"
              style={{
                left: Math.min(Math.max(coords.x, 136), window.innerWidth - 136),
                top: coords.y,
                transform: `translate(-50%, ${coords.side === 'top' ? '-100%' : '0'})`,
              }}
            >
              {content}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
