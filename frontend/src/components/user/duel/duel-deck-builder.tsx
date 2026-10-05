import { useMemo, useState } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { describeDom } from '@duel/cards';
import type { CardDef } from '@duel/types';
import { TEAM_SIZE } from '@duel/types';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Segmented } from '@/components/ui/segmented';
import { DuelCardFace, type CardArt } from '@/components/user/duel/duel-card';
import { cn } from '@/lib/cn';

type CostFilter = 'all' | 'cheap' | 'mid' | 'strong';

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

type BuilderProps = {
  /** Só as cartas que o jogador tem (figurinha conquistada e carta disponível). */
  cards: CardDef[];
  art: CardArt;
  initialName: string;
  initialIds: string[];
  saving: boolean;
  /** Quantas cartas do Duelo ainda não foram conquistadas. */
  missing: number;
  onSave: (name: string, ids: string[]) => void;
  onClose: () => void;
};

/** Montador de Time: escolha 12 das cartas das figurinhas que você já conquistou. */
export function DuelDeckBuilder({ cards, art, initialName, initialIds, saving, missing, onSave, onClose }: BuilderProps) {
  const [name, setName] = useState(initialName);
  const [picked, setPicked] = useState<string[]>(initialIds);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CostFilter>('all');
  const [nameError, setNameError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const chosen = picked.map((id) => byId.get(id)).filter((card): card is CardDef => Boolean(card));
  const visible = useMemo(
    () =>
      cards
        .filter((card) => (filter === 'cheap' ? card.cost <= 2 : filter === 'mid' ? card.cost >= 3 && card.cost <= 4 : filter === 'strong' ? card.cost >= 5 : true))
        .filter((card) => !search.trim() || normalize(card.name).includes(normalize(search)) || card.tags.some((tag) => normalize(tag).includes(normalize(search))))
        .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name, 'pt-BR')),
    [cards, filter, search],
  );
  const paging = usePagination(visible, 8);

  const curve = [0, 1, 2, 3, 4, 5, 6].map((cost) => chosen.filter((card) => (cost === 6 ? card.cost >= 6 : card.cost === cost)).length);
  const cheap = chosen.filter((card) => card.cost <= 2).length;
  const strong = chosen.filter((card) => card.cost >= 4).length;
  const full = chosen.length === TEAM_SIZE;

  function toggle(card: CardDef) {
    setPicked((current) => (current.includes(card.id) ? current.filter((id) => id !== card.id) : current.length >= TEAM_SIZE ? current : [...current, card.id]));
  }

  function submit() {
    if (!name.trim()) {
      setNameError('Dê um nome ao Time.');
      return;
    }
    setNameError(null);
    onSave(name.trim(), picked);
  }

  return (
    <Modal
      open
      size="xl"
      title="Montar Time"
      description={`Escolha ${TEAM_SIZE} cartas entre as das figurinhas que você já conquistou.`}
      onClose={saving ? undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={!full} loading={saving}>
            Salvar Time ({chosen.length}/{TEAM_SIZE})
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Nome do Time" error={nameError}>
          <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={30} placeholder="Ex.: Reis em fila" />
        </Field>

        <section className="space-y-2" aria-label="Cartas do Time">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-muted">Seu Time ({chosen.length}/{TEAM_SIZE})</p>
            <div className="flex items-end gap-1" aria-label="Curva de Vigor do Time">
              {curve.map((count, cost) => (
                <span key={cost} className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-muted">
                  <span className="w-3.5 rounded-t bg-info" style={{ height: `${Math.max(2, count * 6)}px` }} />
                  {cost}
                </span>
              ))}
            </div>
          </div>
          <ul className="grid grid-cols-6 gap-1.5 sm:grid-cols-12" aria-label="Cartas escolhidas">
            {Array.from({ length: TEAM_SIZE }, (_, index) => {
              const card = chosen[index];
              return (
                <li key={index} className="flex justify-center">
                  {card ? (
                    <div className="relative">
                      <DuelCardFace def={card} art={art} onClick={() => toggle(card)} />
                      <span className="pointer-events-none absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-white">
                        <CloseRoundedIcon sx={{ fontSize: 12 }} />
                      </span>
                    </div>
                  ) : (
                    <span className="flex h-[4.6rem] w-[3.4rem] items-center justify-center rounded-lg border-2 border-dashed border-edge-strong text-xs font-bold text-muted/60">{index + 1}</span>
                  )}
                </li>
              );
            })}
          </ul>
          {full && cheap < 3 ? <Alert tone="info">Poucas cartas baratas (Vigor 0 a 2): no começo você pode ficar sem o que jogar.</Alert> : null}
          {full && strong < 2 ? <Alert tone="info">Poucas cartas fortes (Vigor 4 ou mais): no fim do duelo falta força para virar.</Alert> : null}
        </section>

        <section className="space-y-3" aria-label="Suas cartas">
          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
            <Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar carta ou etiqueta" aria-label="Buscar carta" />
            <Segmented<CostFilter>
              aria-label="Filtrar por Vigor"
              value={filter}
              onChange={setFilter}
              className="sm:w-96"
              options={[
                { value: 'all', label: 'Todas' },
                { value: 'cheap', label: 'Vigor 0-2' },
                { value: 'mid', label: 'Vigor 3-4' },
                { value: 'strong', label: 'Vigor 5+' },
              ]}
            />
          </div>

          {cards.length === 0 ? <Alert tone="info">Você ainda não tem figurinhas com carta no Duelo. Conquiste mais figurinhas jogando!</Alert> : null}
          {missing > 0 && cards.length > 0 ? <p className="text-xs font-semibold text-muted">Há mais {missing} carta(s) do Duelo esperando você conquistar a figurinha.</p> : null}

          <ul className="grid gap-2 sm:grid-cols-2">
            {paging.pageItems.map((card) => {
              const on = picked.includes(card.id);
              return (
                <li key={card.id}>
                  <button
                    type="button"
                    onClick={() => toggle(card)}
                    aria-pressed={on}
                    disabled={!on && full}
                    className={cn('flex w-full items-center gap-3 rounded-2xl border-2 p-2 text-left transition disabled:opacity-50', on ? 'border-primary bg-primary/10' : 'border-edge bg-surface-2 hover:border-edge-strong')}
                  >
                    <DuelCardFace def={card} art={art} size="hand" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-base font-bold text-ink">{card.name}</span>
                      <span className="block text-xs font-semibold text-muted">
                        Vigor {card.cost} · Influência {card.power}
                        {card.tags.length ? ` · ${card.tags.join(', ')}` : ''}
                      </span>
                      <span className="mt-0.5 block text-sm font-semibold leading-snug text-ink">{card.dom ? `✨ ${describeDom(card.dom)}` : 'Sem Dom: só a Influência.'}</span>
                    </span>
                    <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold', on ? 'border-primary bg-primary text-on-primary' : 'border-edge-strong text-transparent')} aria-hidden="true">
                      ✓
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {visible.length === 0 && cards.length > 0 ? <p className="text-center text-sm font-semibold text-muted">Nenhuma carta com esse filtro.</p> : null}
          <Pagination page={paging.page} totalPages={paging.totalPages} totalElements={paging.totalElements} onPageChange={paging.setPage} itemLabel="cartas" pageSizeOptions={[8]} />
        </section>
      </div>
    </Modal>
  );
}
