'use client';

import { useEffect, useId, type ReactNode } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type ModalProps = {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  onClose?: () => void;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

/** Janela modal: sobe da borda no celular e aparece centralizada no computador. Esc fecha. */
export function Modal({ open, title, children, onClose, footer, size = 'md', className }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open || !onClose) {
      return;
    }
    const close = onClose;
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  const width = { sm: 'sm:max-w-md', md: 'sm:max-w-xl', lg: 'sm:max-w-3xl' }[size];

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div
        className={cn(
          'panel animate-pop-in flex max-h-[92dvh] w-full flex-col rounded-b-none pb-[env(safe-area-inset-bottom)] sm:rounded-3xl sm:pb-0',
          width,
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 p-5 pb-3 sm:p-6 sm:pb-3">
          <h2 id={titleId} className="font-display text-2xl font-bold text-ink">
            {title}
          </h2>
          {onClose ? (
            <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-muted transition hover:bg-surface-3 hover:text-ink">
              <CloseRoundedIcon />
            </button>
          ) : null}
        </div>
        <div className="overflow-y-auto px-5 pb-5 sm:px-6 sm:pb-6">{children}</div>
        {footer ? <div className="flex flex-wrap justify-end gap-3 border-t border-edge p-5 sm:p-6">{footer}</div> : null}
      </div>
    </div>
  );
}
