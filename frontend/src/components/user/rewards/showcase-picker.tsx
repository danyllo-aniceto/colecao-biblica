import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { errorMessage, useToast } from '@/components/ui/toast';
import { StickerCard } from '@/components/game/sticker-card';
import { cn } from '@/lib/cn';
import { setShowcase, type PlayerProfile } from '@/lib/rewards-api';
import type { UserSticker } from '@/lib/user-api';

/** Escolhe até 3 figurinhas para mostrar no perfil. */
export function ShowcasePicker({ collection, initial, onClose, onSaved }: { collection: UserSticker[]; initial: number[]; onClose: () => void; onSaved: (profile: PlayerProfile) => void }) {
  const toast = useToast();
  const [selected, setSelected] = useState<number[]>(initial);
  const [saving, setSaving] = useState(false);
  const paging = usePagination(collection, 12);

  function toggle(id: number) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : current.length >= 3 ? current : [...current, id]));
  }

  async function save() {
    setSaving(true);
    try {
      onSaved(await setShowcase(selected));
      toast.success('Vitrine atualizada!');
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      size="lg"
      title="Vitrine do perfil"
      description={`Escolha até 3 figurinhas para os amigos verem (${selected.length}/3).`}
      onClose={saving ? undefined : onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} loading={saving}>
            Salvar vitrine
          </Button>
        </>
      }
    >
      {collection.length === 0 ? <p className="text-sm text-muted">Conquiste figurinhas para montar sua vitrine.</p> : null}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {paging.pageItems.map((sticker) => {
          const index = selected.indexOf(sticker.characterId);
          return (
            <button
              key={sticker.characterId}
              type="button"
              aria-pressed={index >= 0}
              onClick={() => toggle(sticker.characterId)}
              className={cn('relative rounded-3xl transition', index >= 0 ? 'ring-4 ring-primary ring-offset-2 ring-offset-surface' : selected.length >= 3 ? 'opacity-40' : 'opacity-80 hover:opacity-100')}
            >
              <StickerCard name={sticker.characterName} rarity={sticker.rarity} imageUrl={sticker.imageUrl} owned size="sm" />
              {index >= 0 ? <span className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary font-display text-xs font-bold text-on-primary">{index + 1}</span> : null}
            </button>
          );
        })}
      </div>
      {paging.totalPages > 1 ? <Pagination className="mt-3" page={paging.page} totalPages={paging.totalPages} totalElements={paging.totalElements} onPageChange={paging.setPage} itemLabel="figurinhas" /> : null}
    </Modal>
  );
}
