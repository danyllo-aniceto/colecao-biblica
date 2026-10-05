import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { errorMessage, useToast } from '@/components/ui/toast';

const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{5}$/;

/** Janela para entrar numa sala digitando o código de 5 letras que o anfitrião passou. */
export function JoinRoomModal({ open, onClose, onJoin }: { open: boolean; onClose: () => void; onJoin: (code: string) => Promise<void> }) {
  const toast = useToast();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!CODE_PATTERN.test(clean)) {
      setError('O código tem 5 letras ou números (sem I, O, 0 ou 1). Confira com quem criou a sala.');
      return;
    }
    setError(null);
    setJoining(true);
    try {
      await onJoin(clean);
    } catch (reason) {
      const message = errorMessage(reason, 'Não foi possível entrar na sala.');
      setError(message);
      toast.error(message);
    } finally {
      setJoining(false);
    }
  }

  return (
    <Modal open={open} onClose={joining ? undefined : onClose} title="Entrar com código" description="Peça o código da sala a quem a criou." size="sm">
      <form className="space-y-4" onSubmit={submit}>
        <Field label="Código da sala" error={error} htmlFor="codigo-sala">
          <Input
            id="codigo-sala"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))}
            placeholder="ABCDE"
            autoComplete="off"
            autoCapitalize="characters"
            inputMode="text"
            maxLength={5}
            className="text-center font-display text-2xl font-bold tracking-[0.4em]"
            aria-invalid={Boolean(error)}
            data-autofocus
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={joining}>
            Cancelar
          </Button>
          <Button type="submit" loading={joining}>
            Entrar na sala
          </Button>
        </div>
      </form>
    </Modal>
  );
}
