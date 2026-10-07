import { useState } from 'react';
import { SCENARIOS } from '@duel/scenarios';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Segmented } from '@/components/ui/segmented';

type Tab = 'powers' | 'arenas';

/** Quando um Dom age. Os nomes são os mesmos que aparecem escritos nas figurinhas. */
const TRIGGERS: Array<{ label: string; icon: string; text: string; example: string }> = [
  {
    label: 'Ao revelar',
    icon: '🎬',
    text: 'Age uma vez, na hora em que a figurinha vira na mesa. As figurinhas do turno viram todas juntas e os Dons agem na ordem de revelação: quem está ganhando revela primeiro.',
    example: 'Moisés: ao revelar, move as figurinhas do rival daquela arena para as outras.',
  },
  {
    label: 'Contínuo',
    icon: '♾️',
    text: 'Vale o tempo todo, enquanto a figurinha estiver na mesa. Se ela for calada (perde o Dom) ou sair da arena, o efeito acaba.',
    example: 'Daniel: suas figurinhas na arena não podem ser destruídas nem reduzidas pelo rival.',
  },
  {
    label: 'Fim do turno',
    icon: '🔔',
    text: 'Age no fim de cada turno, depois de todas as figurinhas virarem, enquanto a figurinha estiver na mesa.',
    example: 'Um Dom assim pode, por exemplo, somar Influência a cada turno que passa.',
  },
  {
    label: 'Fim do duelo',
    icon: '🏁',
    text: 'Age uma vez, depois do último turno e antes de contar as arenas, arena por arena. É o último lance antes do resultado.',
    example: 'Sansão: se a arena dele estiver perdendo, derruba as colunas e destrói todas as figurinhas dali.',
  },
  {
    label: 'Ao ser destruída',
    icon: '💥',
    text: 'Age quando a figurinha é destruída (ela vai para o cemitério, as "afastadas"). Mesmo saindo da mesa, ela ainda reage.',
    example: 'Serve para devolver força, comprar figurinhas ou deixar algo para trás.',
  },
  {
    label: 'Quando uma figurinha sua é jogada aqui',
    icon: '🤝',
    text: 'Age cada vez que outra figurinha sua é revelada na mesma arena dela.',
    example: 'Rute: ganha +1 de Influência toda vez que outra figurinha sua entra na arena dela.',
  },
];

/** Palavras do jogo, em linguagem simples. */
const WORDS: Array<{ term: string; text: string }> = [
  { term: 'Influência', text: 'A força da figurinha. Em cada arena vence quem somar mais.' },
  { term: 'Vigor', text: 'A energia do turno. Igual ao número do turno, e o que sobra soma ao turno seguinte. É o número azul da figurinha.' },
  { term: 'Dom', text: 'A habilidade da figurinha, ligada à história dela.' },
  { term: 'Arena', text: 'Cada uma das 3 colunas da mesa. Tem uma regra própria, escrita nela.' },
  { term: 'Calar', text: 'A figurinha perde o Dom (os contínuos deixam de valer).' },
  { term: 'Afastada / destruída', text: 'Sai da mesa e vai para o cemitério. Alguns Dons contam ou trazem de volta as afastadas.' },
  { term: 'Ficha', text: 'Figurinha criada por um Dom durante o duelo (não vem do seu Time).' },
  { term: 'Condição ("se...")', text: 'Alguns Dons só agem se algo for verdade: se você está perdendo ou ganhando a arena, se está sozinha, se o rival tem Influência alta, e assim por diante.' },
];

/** O que um Dom pode fazer. */
const EFFECTS: Array<{ name: string; text: string }> = [
  { name: 'Ganhar ou perder Influência', text: 'Soma ou tira Influência da própria figurinha, das aliadas da arena, de uma etiqueta, da mão ou do rival.' },
  { name: 'Influência por cada...', text: 'Soma Influência para cada figurinha de um tipo: aliadas, uma etiqueta, afastadas, as da mão.' },
  { name: 'Aura', text: 'Contínuo: dá Influência às aliadas da arena, às das arenas vizinhas ou a todas.' },
  { name: 'Comprar', text: 'Puxa figurinhas do seu Time para a mão.' },
  { name: 'Buscar', text: 'Procura no Time a figurinha mais cara (ou a mais barata) de uma etiqueta e leva para a mão.' },
  { name: 'Destruir', text: 'Destrói a figurinha mais fraca ou mais forte do rival na arena, a sua mais fraca, ou todas dali.' },
  { name: 'Calar', text: 'Faz as figurinhas do rival na arena perderem o Dom.' },
  { name: 'Mover', text: 'Move as figurinhas do rival daquela arena para outras, ou leva a própria figurinha para a sua arena mais fraca.' },
  { name: 'Devolver', text: 'A figurinha do rival volta para a mão dele, sem os bônus.' },
  { name: 'Descartar', text: 'O rival descarta as figurinhas de maior Vigor da mão dele.' },
  { name: 'Esgotar', text: 'O rival fica com menos Vigor no turno seguinte (sempre sobra ao menos 1).' },
  { name: 'Vigor extra', text: 'Você ganha Vigor no próximo turno.' },
  { name: 'Custo menor', text: 'As figurinhas da sua mão custam menos Vigor.' },
  { name: 'Converter', text: 'A figurinha mais fraca do rival na arena passa para o seu lado, se houver espaço.' },
  { name: 'Sacrificar', text: 'Destrói a sua figurinha mais fraca da arena para esta ganhar Influência.' },
  { name: 'Multiplicar', text: 'Multiplica a Influência atual da figurinha.' },
  { name: 'Ressuscitar', text: 'Uma figurinha sua destruída volta para a mão.' },
  { name: 'Sumir', text: 'A figurinha some da mesa e volta à mão alguns turnos depois, mais forte.' },
  { name: 'Criar ficha', text: 'Cria figurinhas extras em uma arena, em cada uma ou nas vizinhas.' },
  { name: 'Repetir', text: 'Repete o "Ao revelar" da sua figurinha mais forte da arena.' },
  { name: 'Igualar', text: 'A figurinha sobe até a Influência da mais forte da arena, ganhando no máximo um limite.' },
  { name: 'Purificar', text: 'Tira as penalidades (Influência perdida) da figurinha e das suas outras da arena.' },
  { name: 'Proteger', text: 'Contínuo: suas figurinhas da arena não podem ser destruídas nem reduzidas pelo rival.' },
  { name: 'Blindar', text: 'Contínuo: esta figurinha não pode ser destruída, devolvida, movida nem reduzida pelo rival.' },
];

function PowersTab() {
  const effects = usePagination(EFFECTS, 6);
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="font-display text-base font-bold text-ink">Quando o Dom age</h3>
        <p className="text-sm font-semibold text-muted">Todo Dom começa com uma etiqueta que diz o momento em que ele acontece:</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {TRIGGERS.map((trigger) => (
            <article key={trigger.label} className="space-y-1 rounded-2xl bg-surface-2 p-3">
              <h4 className="flex items-center gap-2 font-display text-sm font-bold text-ink">
                <span aria-hidden="true">{trigger.icon}</span> {trigger.label}
              </h4>
              <p className="text-xs font-semibold text-ink">{trigger.text}</p>
              <p className="text-xs font-semibold text-muted">Ex.: {trigger.example}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-display text-base font-bold text-ink">Palavras do jogo</h3>
        <dl className="grid gap-2 sm:grid-cols-2">
          {WORDS.map((word) => (
            <div key={word.term} className="rounded-2xl bg-surface-2 p-3">
              <dt className="font-display text-sm font-bold text-ink">{word.term}</dt>
              <dd className="text-xs font-semibold text-muted">{word.text}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-2">
        <h3 className="font-display text-base font-bold text-ink">O que um Dom pode fazer</h3>
        <ul className="space-y-2">
          {effects.pageItems.map((effect) => (
            <li key={effect.name} className="rounded-2xl bg-surface-2 p-3">
              <p className="font-display text-sm font-bold text-ink">{effect.name}</p>
              <p className="text-xs font-semibold text-muted">{effect.text}</p>
            </li>
          ))}
        </ul>
        <Pagination page={effects.page} totalPages={effects.totalPages} totalElements={effects.totalElements} pageSize={effects.pageSize} onPageChange={effects.setPage} onPageSizeChange={effects.setPageSize} pageSizeOptions={[6, 12, 24]} itemLabel="efeitos" />
      </section>
    </div>
  );
}

function ArenasTab() {
  const arenas = usePagination(SCENARIOS, 6);
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-muted">
        Cada arena tem uma regra que vale só para ela. <b className="text-ink">Nenhuma usa sorte</b>: o resultado depende só das suas escolhas. A 1ª arena aparece no turno 1, a 2ª no turno 2 e a 3ª no turno 3.
      </p>
      <ul className="space-y-2">
        {arenas.pageItems.map((arena) => (
          <li key={arena.id} className="flex items-start gap-3 rounded-2xl bg-surface-2 p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-3 text-2xl" aria-hidden="true">
              {arena.emoji}
            </span>
            <div className="min-w-0">
              <p className="font-display text-sm font-bold text-ink">{arena.name}</p>
              <p className="text-xs font-semibold text-muted">{arena.text}</p>
            </div>
          </li>
        ))}
      </ul>
      <Pagination page={arenas.page} totalPages={arenas.totalPages} totalElements={arenas.totalElements} pageSize={arenas.pageSize} onPageChange={arenas.setPage} onPageSizeChange={arenas.setPageSize} pageSizeOptions={[6, 12, 24]} itemLabel="arenas" />
    </div>
  );
}

/** Guia do Duelo: o que cada tipo de Dom significa e o que cada arena faz. */
export function DuelGuideModal({ open, onClose, initialTab = 'powers' }: { open: boolean; onClose: () => void; initialTab?: Tab }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  return (
    <Modal
      open={open}
      size="lg"
      title="Poderes e arenas"
      description="Entenda os Dons das figurinhas e as regras de cada arena."
      onClose={onClose}
      footer={<Button onClick={onClose}>Entendi</Button>}
    >
      <div className="space-y-4">
        <Segmented
          aria-label="Assunto"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'powers', label: 'Poderes (Dons)' },
            { value: 'arenas', label: 'Arenas' },
          ]}
        />
        {tab === 'powers' ? <PowersTab /> : <ArenasTab />}
      </div>
    </Modal>
  );
}
