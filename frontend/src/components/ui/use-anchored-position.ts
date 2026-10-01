import { useLayoutEffect, useState, type RefObject } from 'react';

type Side = 'top' | 'bottom';

type Position = { top: number; left: number; width: number; side: Side; maxHeight: number };

/**
 * Posição fixa (na tela) de um balão preso a um elemento: abaixo dele, ou acima
 * quando falta espaço. Acompanha rolagem e redimensionamento.
 */
export function useAnchoredPosition(
  anchorRef: RefObject<HTMLElement | null>,
  open: boolean,
  { preferred = 'bottom', gap = 6, estimatedHeight = 280 }: { preferred?: Side; gap?: number; estimatedHeight?: number } = {},
) {
  const [position, setPosition] = useState<Position | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    function update() {
      const anchor = anchorRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - gap - 8;
      const above = rect.top - gap - 8;
      // Abre do lado preferido se o balão cabe inteiro; senão, do lado com mais espaço.
      const side: Side = preferred === 'bottom' ? (below >= estimatedHeight || below >= above ? 'bottom' : 'top') : above >= estimatedHeight || above >= below ? 'top' : 'bottom';
      setPosition({
        top: side === 'bottom' ? rect.bottom + gap : rect.top - gap,
        left: rect.left,
        width: rect.width,
        side,
        maxHeight: Math.max(160, side === 'bottom' ? below : above),
      });
    }
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorRef, open, preferred, gap, estimatedHeight]);

  return position;
}
