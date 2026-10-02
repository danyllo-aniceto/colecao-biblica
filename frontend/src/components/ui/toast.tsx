import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import { cn } from '@/lib/cn';
import { playSfx } from '@/lib/sound/sfx';

type ToastTone = 'success' | 'error' | 'info';

type ToastOptions = {
  /** Texto menor abaixo da mensagem. */
  description?: ReactNode;
  /** Ícone próprio no lugar do padrão do tom (ex.: moeda, figurinha). */
  icon?: ReactNode;
  /** Botão de ação (ex.: "Ver"). */
  action?: { label: string; onClick: () => void };
  /** Tempo na tela em ms (padrão 4,5 s; erros ficam 7 s). */
  duration?: number;
};

type ToastItem = ToastOptions & { id: number; tone: ToastTone; message: ReactNode };

type ToastApi = {
  success: (message: ReactNode, options?: ToastOptions) => void;
  error: (message: ReactNode, options?: ToastOptions) => void;
  info: (message: ReactNode, options?: ToastOptions) => void;
};

const ToastContext = createContext<ToastApi | undefined>(undefined);

const toneStyle: Record<ToastTone, { icon: ReactNode; className: string }> = {
  success: { icon: <CheckCircleRoundedIcon />, className: 'text-success-strong dark:text-success' },
  error: { icon: <ErrorRoundedIcon />, className: 'text-danger-strong dark:text-danger' },
  info: { icon: <InfoRoundedIcon />, className: 'text-info-strong dark:text-info' },
};

/** Avisos rápidos no canto da tela (no celular, acima da barra de navegação). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, message: ReactNode, options: ToastOptions = {}) => {
      const id = nextId.current++;
      if (tone !== 'info') playSfx(tone === 'success' ? 'success' : 'error');
      // No máximo 4 avisos ao mesmo tempo: os mais antigos saem.
      setToasts((current) => [...current.slice(-3), { id, tone, message, ...options }]);
      window.setTimeout(() => dismiss(id), options.duration ?? (tone === 'error' ? 7000 : 4500));
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, options) => push('success', message, options),
      error: (message, options) => push('error', message, options),
      info: (message, options) => push('info', message, options),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-auto sm:top-[max(1.5rem,env(safe-area-inset-top))] sm:items-end sm:px-6"
        >
          {toasts.map((toast) => {
            const style = toneStyle[toast.tone];
            return (
              <div
                key={toast.id}
                role={toast.tone === 'error' ? 'alert' : 'status'}
                className="panel animate-pop-in pointer-events-auto flex w-full max-w-sm items-start gap-3 p-3.5 pr-2"
              >
                <span className={cn('mt-0.5 flex shrink-0', style.className)}>{toast.icon ?? style.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-display text-sm font-semibold text-ink">{toast.message}</p>
                  {toast.description ? <div className="mt-0.5 text-xs text-muted">{toast.description}</div> : null}
                  {toast.action ? (
                    <button
                      type="button"
                      onClick={() => {
                        toast.action?.onClick();
                        dismiss(toast.id);
                      }}
                      className="mt-1.5 font-display text-sm font-bold text-primary-strong hover:underline dark:text-primary"
                    >
                      {toast.action.label}
                    </button>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Fechar aviso"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-surface-3 hover:text-ink"
                >
                  <CloseRoundedIcon fontSize="small" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast precisa estar dentro de ToastProvider');
  }
  return context;
}

/** Mensagem de um erro desconhecido (Error, texto ou nada). */
export function errorMessage(error: unknown, fallback = 'Algo deu errado. Tente de novo.') {
  return error instanceof Error && error.message ? error.message : fallback;
}
