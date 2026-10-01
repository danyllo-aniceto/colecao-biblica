import { createContext, useCallback, useContext, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

type ConfirmOptions = {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
};

type PromptOptions = {
  title: string;
  message?: ReactNode;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  inputType?: 'text' | 'url';
  /** Devolve a mensagem de erro, ou null quando o valor é válido. */
  validate?: (value: string) => string | null;
};

type DialogState =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (value: boolean) => void }
  | { kind: 'prompt'; options: PromptOptions; resolve: (value: string | null) => void };

type DialogApi = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
};

const DialogContext = createContext<DialogApi | undefined>(undefined);

/** Confirmação e pergunta no visual do app (no lugar de window.confirm/prompt). */
export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef(dialog);
  dialogRef.current = dialog;

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => setDialog({ kind: 'confirm', options, resolve }));
  }, []);

  const prompt = useCallback((options: PromptOptions) => {
    setValue(options.defaultValue ?? '');
    setError(null);
    return new Promise<string | null>((resolve) => setDialog({ kind: 'prompt', options, resolve }));
  }, []);

  function close(result: boolean | string | null) {
    const current = dialogRef.current;
    if (!current) return;
    if (current.kind === 'confirm') current.resolve(result === true);
    else current.resolve(typeof result === 'string' ? result : null);
    setDialog(null);
  }

  function submitPrompt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dialog?.kind !== 'prompt') return;
    const problem = dialog.options.validate?.(value) ?? null;
    if (problem) {
      setError(problem);
      return;
    }
    close(value);
  }

  const api = useMemo(() => ({ confirm, prompt }), [confirm, prompt]);

  return (
    <DialogContext.Provider value={api}>
      {children}
      {dialog?.kind === 'confirm' ? (
        <Modal
          open
          size="sm"
          title={dialog.options.title}
          onClose={() => close(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => close(false)}>
                {dialog.options.cancelLabel ?? 'Cancelar'}
              </Button>
              <Button variant={dialog.options.tone === 'danger' ? 'danger' : 'primary'} onClick={() => close(true)} data-autofocus>
                {dialog.options.confirmLabel ?? 'Confirmar'}
              </Button>
            </>
          }
        >
          {dialog.options.message ? <div className="text-muted">{dialog.options.message}</div> : null}
        </Modal>
      ) : null}
      {dialog?.kind === 'prompt' ? (
        <Modal open size="sm" title={dialog.options.title} onClose={() => close(null)}>
          <form className="space-y-4" onSubmit={submitPrompt}>
            {dialog.options.message ? <div className="text-sm text-muted">{dialog.options.message}</div> : null}
            <label className="block space-y-2">
              {dialog.options.label ? <span className="text-sm font-bold text-muted">{dialog.options.label}</span> : null}
              <Input
                type={dialog.options.inputType ?? 'text'}
                value={value}
                placeholder={dialog.options.placeholder}
                onChange={(event) => {
                  setValue(event.target.value);
                  setError(null);
                }}
                aria-invalid={Boolean(error)}
              />
              {error ? <span className="text-sm font-semibold text-danger">{error}</span> : null}
            </label>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => close(null)}>
                Cancelar
              </Button>
              <Button type="submit">{dialog.options.confirmLabel ?? 'OK'}</Button>
            </div>
          </form>
        </Modal>
      ) : null}
    </DialogContext.Provider>
  );
}

export function useDialogs() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialogs precisa estar dentro de DialogProvider');
  }
  return context;
}
