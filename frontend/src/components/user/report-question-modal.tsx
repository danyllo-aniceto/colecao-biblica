import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { errorMessage, useToast } from '@/components/ui/toast';
import { REPORT_REASON_LABELS } from '@/lib/labels';
import { reportQuestion, type ReportReason } from '@/lib/user-api';

/** O jogador avisa o admin sobre uma pergunta errada, com erro de digitação ou confusa. */
export function ReportQuestionModal({ questionId, onClose, onSent }: { questionId: number; onClose: () => void; onSent: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState<ReportReason>('WRONG_ANSWER');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    try {
      await reportQuestion({ questionId, reason, message: message.trim() || undefined });
      toast.success('Obrigado! O time vai revisar esta pergunta.');
      onSent();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal open size="sm" title="Reportar pergunta" description="Achou algo errado? Conte para a gente." onClose={sending ? undefined : onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <Field label="Qual o problema?">
          <Select<ReportReason>
            aria-label="Motivo"
            value={reason}
            onChange={setReason}
            options={(Object.keys(REPORT_REASON_LABELS) as ReportReason[]).map((value) => ({ value, label: REPORT_REASON_LABELS[value] }))}
          />
        </Field>
        <Field label="Detalhes (opcional)" hint="Ex.: a resposta certa é Josué, segundo Êxodo 17.">
          <Textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={500} className="min-h-24" />
        </Field>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={sending}>
            Cancelar
          </Button>
          <Button type="submit" loading={sending}>
            {sending ? 'Enviando...' : 'Enviar reporte'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
