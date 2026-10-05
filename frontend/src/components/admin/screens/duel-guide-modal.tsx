import { CONDITION_GUIDE, EFFECT_GUIDE, TRIGGER_GUIDE } from '@duel/dsl';
import { TOKENS } from '@duel/engine';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Pagination, usePagination } from '@/components/ui/pagination';

/** Guia dos poderes: o que cada gatilho, efeito e condição faz, com exemplo para copiar. */
export function DuelGuideModal({ onClose }: { onClose: () => void }) {
  const effects = usePagination(EFFECT_GUIDE, 6);
  return (
    <Modal open size="xl" title="Guia de poderes do Duelo" description="Um Dom é um gatilho mais até 3 efeitos separados por ' | '. Cada efeito é o nome seguido de chave=valor, sem espaços (use _ no lugar de espaço em nomes)." onClose={onClose} footer={<Button onClick={onClose}>Fechar</Button>}>
      <div className="space-y-6">
        <section className="space-y-2">
          <h3 className="font-display text-lg font-bold text-ink">Gatilhos (quando acontece)</h3>
          <ul className="divide-y divide-edge overflow-hidden rounded-2xl border border-edge text-sm">
            {TRIGGER_GUIDE.map((item) => (
              <li key={item.name} className="flex gap-3 px-4 py-2">
                <code className="w-32 shrink-0 font-bold text-primary-strong dark:text-primary">{item.name}</code>
                <span className="text-muted">{item.summary}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="font-display text-lg font-bold text-ink">Efeitos (o que faz)</h3>
          <ul className="space-y-2">
            {effects.pageItems.map((item) => (
              <li key={item.name} className="space-y-1 rounded-2xl border border-edge p-3 text-sm">
                <p>
                  <code className="font-bold text-primary-strong dark:text-primary">{item.name}</code> <span className="text-ink">{item.summary}</span>
                </p>
                <p className="text-xs text-muted">{item.params}</p>
                <code className="block overflow-x-auto rounded-xl bg-surface-3 px-3 py-1.5 text-xs text-ink">{item.example}</code>
              </li>
            ))}
          </ul>
          <Pagination page={effects.page} totalPages={effects.totalPages} totalElements={effects.totalElements} onPageChange={effects.setPage} itemLabel="efeitos" pageSizeOptions={[6]} />
        </section>

        <section className="space-y-2">
          <h3 className="font-display text-lg font-bold text-ink">Condições (se=...)</h3>
          <ul className="divide-y divide-edge overflow-hidden rounded-2xl border border-edge text-sm">
            {CONDITION_GUIDE.map((item) => (
              <li key={item.name} className="flex gap-3 px-4 py-2">
                <code className="w-44 shrink-0 font-bold text-primary-strong dark:text-primary">{item.name}</code>
                <span className="text-muted">{item.summary}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2 text-sm text-muted">
          <h3 className="font-display text-lg font-bold text-ink">Fichas e preço</h3>
          <p>
            Fichas que o efeito <code>criar</code> aceita: {Object.values(TOKENS).map((token) => `${token.name} (Influência ${token.power})`).join(', ')}.
          </p>
          <p>
            Preço justo: carta <b>sem Dom</b> tem Influência ≈ 2 × Vigor (Vigor 1 = 2, Vigor 3 = 6, Vigor 5 = 10). Um Dom bom tira 1 a 3 de Influência; um Dom fraco, 0 a 1. Cartas de Vigor 5 e 6 devem ser fortes: são as finalizadoras.
          </p>
        </section>
      </div>
    </Modal>
  );
}
