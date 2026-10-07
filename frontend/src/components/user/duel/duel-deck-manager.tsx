import { useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import type { CardDef } from '@duel/types';
import { TEAM_SIZE } from '@duel/types';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialogs';
import { Modal } from '@/components/ui/modal';
import { Tooltip } from '@/components/ui/tooltip';
import { errorMessage, useToast } from '@/components/ui/toast';
import { DuelDeckBuilder } from '@/components/user/duel/duel-deck-builder';
import type { CardArt } from '@/components/user/duel/duel-card';
import { cn } from '@/lib/cn';
import { deleteDuelDeck, MAX_DUEL_DECKS, saveDuelDeck, type DuelDeck } from '@/lib/duel-api';

type Props = {
  open: boolean;
  onClose: () => void;
  decks: DuelDeck[];
  /** Só as figurinhas que o jogador tem (conquistadas e disponíveis no Duelo). */
  cards: CardDef[];
  art: CardArt;
  missing: number;
  /** Time que está valendo agora (o escolhido na sala). */
  currentSlot: number | null;
  /** Escolhe um Time para jogar. */
  onUse: (slot: number) => void;
  /** Depois de criar, editar ou excluir um Time (para recarregar a lista). Recebe o espaço do Time salvo. */
  onChanged: (slot?: number) => void;
};

/** Criar, editar, excluir e escolher Times sem sair da sala de espera. */
export function DuelDeckManager({ open, onClose, decks, cards, art, missing, currentSlot, onUse, onChanged }: Props) {
  const toast = useToast();
  const { confirm } = useDialogs();
  const [editing, setEditing] = useState<{ slot: number; deck: DuelDeck | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const freeSlot = Array.from({ length: MAX_DUEL_DECKS }, (_, index) => index + 1).find((candidate) => !decks.some((deck) => deck.slot === candidate));

  async function save(name: string, ids: string[]) {
    if (!editing) return;
    setSaving(true);
    try {
      await saveDuelDeck(editing.slot, name, ids.map(Number));
      toast.success('Time salvo.');
      const slot = editing.slot;
      setEditing(null);
      onChanged(slot);
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function remove(deck: DuelDeck) {
    const ok = await confirm({ title: `Excluir o Time "${deck.name}"?`, message: 'As figurinhas continuam com você; só o Time é apagado.', confirmLabel: 'Excluir', tone: 'danger' });
    if (!ok) return;
    try {
      await deleteDuelDeck(deck.slot);
      toast.success('Time excluído.');
      onChanged();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  return (
    <>
      <Modal open={open && !editing} onClose={onClose} title="Meus Times" description={`Monte ou mude seus Times sem sair da sala (até ${MAX_DUEL_DECKS}). Cada Time tem ${TEAM_SIZE} figurinhas.`} footer={<Button onClick={onClose}>Pronto</Button>}>
        <div className="space-y-3">
          {cards.length < TEAM_SIZE ? <Alert tone="info">Você tem {cards.length} de {TEAM_SIZE} figurinhas do Duelo. Conquiste mais jogando, na loja ou trocando com amigos para montar um Time.</Alert> : null}
          {decks.length === 0 ? <p className="text-sm font-semibold text-muted">Você ainda não montou nenhum Time.</p> : null}
          <ul className="space-y-2">
            {decks.map((deck) => {
              const on = deck.slot === currentSlot;
              return (
                <li key={deck.slot} className={cn('flex items-center gap-2 rounded-2xl border-2 p-2', on ? 'border-primary bg-primary/10' : 'border-edge bg-surface-2')}>
                  <div className="min-w-0 flex-1 px-1">
                    <p className="truncate font-display text-base font-bold text-ink">{deck.name}</p>
                    <p className="text-xs font-semibold text-muted">{deck.cards.length} figurinhas{on ? ' · em uso na sala' : ''}</p>
                  </div>
                  {on ? null : (
                    <Button size="sm" variant="secondary" onClick={() => onUse(deck.slot)}>
                      Usar
                    </Button>
                  )}
                  <Tooltip content="Editar Time">
                    <button type="button" aria-label={`Editar ${deck.name}`} onClick={() => setEditing({ slot: deck.slot, deck })} className="flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-surface-3 hover:text-ink">
                      <EditRoundedIcon fontSize="small" />
                    </button>
                  </Tooltip>
                  <Tooltip content="Excluir Time">
                    <button type="button" aria-label={`Excluir ${deck.name}`} onClick={() => void remove(deck)} className="flex h-9 w-9 items-center justify-center rounded-xl text-danger hover:bg-danger/15">
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </button>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
          <Button variant="secondary" size="sm" disabled={freeSlot === undefined || cards.length < TEAM_SIZE} onClick={() => freeSlot !== undefined && setEditing({ slot: freeSlot, deck: null })}>
            <AddRoundedIcon fontSize="small" /> {freeSlot === undefined ? `Limite de ${MAX_DUEL_DECKS} Times` : 'Montar novo Time'}
          </Button>
        </div>
      </Modal>
      {editing ? (
        <DuelDeckBuilder
          cards={cards}
          art={art}
          initialName={editing.deck?.name ?? `Time ${editing.slot}`}
          initialIds={(editing.deck?.cards ?? []).map(String).filter((id) => cards.some((card) => card.id === id))}
          saving={saving}
          missing={missing}
          onSave={(name, ids) => void save(name, ids)}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}
