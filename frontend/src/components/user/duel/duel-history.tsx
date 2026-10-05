import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Pagination, usePagination } from '@/components/ui/pagination';

export type HistoryEntry = { id: number; label: string; lines: string[] };

/** O que aconteceu nos turnos anteriores, em texto, para ninguém perder nada. */
export function DuelHistoryModal({ open, entries, onClose }: { open: boolean; entries: HistoryEntry[]; onClose: () => void }) {
  const reversed = [...entries].reverse();
  const paging = usePagination(reversed, 3);
  return (
    <Modal open={open} title="O que aconteceu" description="Do turno mais recente para o mais antigo." onClose={onClose} footer={<Button onClick={onClose}>Fechar</Button>}>
      {reversed.length === 0 ? (
        <p className="text-sm font-semibold text-muted">Ainda não aconteceu nada. Jogue o primeiro turno!</p>
      ) : (
        <div className="space-y-4">
          {paging.pageItems.map((entry) => (
            <section key={entry.id} className="space-y-1.5">
              <h3 className="font-display text-base font-bold text-ink">{entry.label}</h3>
              <ul className="space-y-1 text-sm font-semibold text-ink">
                {entry.lines.map((line, index) => (
                  <li key={index} className="rounded-xl bg-surface-2 px-3 py-1.5">
                    {line}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <Pagination page={paging.page} totalPages={paging.totalPages} totalElements={paging.totalElements} onPageChange={paging.setPage} itemLabel="turnos" pageSizeOptions={[3]} />
        </div>
      )}
    </Modal>
  );
}
