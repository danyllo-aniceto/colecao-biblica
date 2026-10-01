import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { cn } from '@/lib/cn';

type ModalProps = {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Sem onClose o modal não fecha por Esc, clique fora nem botão X (ex.: enquanto salva). */
  onClose?: () => void;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
};

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let openModals = 0;

/**
 * Janela modal do app: sobe da borda no celular e aparece centralizada no
 * computador. Esc ou clique fora fecham; o foco fica preso dentro e volta
 * para onde estava ao fechar; a página de trás não rola.
 */
export function Modal({ open, title, description, children, onClose, footer, size = 'md', className }: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      return;
    }
    const previouslyFocused = document.activeElement as HTMLElement | null;
    openModals += 1;
    document.body.style.overflow = 'hidden';

    // Foca o primeiro campo (ou o painel) para leitores de tela e teclado.
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>('[data-autofocus]') ?? panel?.querySelector<HTMLElement>('input, textarea, select');
    (first ?? panel)?.focus({ preventScroll: true });

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape' && onCloseRef.current) {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key === 'Tab' && panelRef.current) {
        const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((item) => item.offsetParent !== null);
        if (items.length === 0) return;
        const firstItem = items[0];
        const lastItem = items[items.length - 1];
        if (event.shiftKey && document.activeElement === firstItem) {
          event.preventDefault();
          lastItem.focus();
        } else if (!event.shiftKey && document.activeElement === lastItem) {
          event.preventDefault();
          firstItem.focus();
        }
      }
    }
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('keydown', handleKey);
      openModals -= 1;
      if (openModals === 0) {
        document.body.style.overflow = '';
      }
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const width = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl', xl: 'sm:max-w-5xl', full: 'sm:max-w-[min(96vw,80rem)]' }[size];

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose?.();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'panel animate-pop-in flex max-h-[92dvh] w-full flex-col rounded-b-none pb-[env(safe-area-inset-bottom)] outline-none sm:rounded-3xl sm:pb-0',
          width,
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3 sm:p-6 sm:pb-3">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-2xl font-bold text-ink">
              {title}
            </h2>
            {description ? <div className="mt-1 text-sm leading-6 text-muted">{description}</div> : null}
          </div>
          {onClose ? (
            <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-muted transition hover:bg-surface-3 hover:text-ink">
              <CloseRoundedIcon />
            </button>
          ) : null}
        </div>
        {children ? <div className="overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6">{children}</div> : null}
        {footer ? <div className="flex flex-wrap justify-end gap-3 border-t border-edge p-5 sm:p-6">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
