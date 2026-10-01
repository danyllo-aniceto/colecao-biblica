import { useEffect, useMemo, useState, type FormEvent } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialogs';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { errorMessage, useToast } from '@/components/ui/toast';
import { CoinIcon } from '@/components/game/game-ui';
import { COSMETIC_TYPE_LABELS } from '@/components/user/rewards/cosmetic-preview';
import { listCharacterOptions, type CharacterOption } from '@/lib/admin-api';
import { createCollection, deleteCollection, listCollectionsAdmin, listCosmeticsAdmin, updateCollection, type AdminCollection, type AdminCosmetic } from '@/lib/admin-rewards-api';
import { cn } from '@/lib/cn';
import { AdminPanel, Cell, DataTable, IconAction, RarityBadge, Row, SearchInput, StatusBadge } from '../admin-ui';
import { usePagedList } from '../use-paged-list';

/** Opções de prêmio visual (itens do tipo prêmio, para não dar de graça o que é vendido). */
export function useCosmeticOptions() {
  const [items, setItems] = useState<AdminCosmetic[]>([]);
  useEffect(() => {
    listCosmeticsAdmin({ page: 0, size: 100 })
      .then((page) => setItems(page.content))
      .catch(() => setItems([]));
  }, []);
  return [{ value: '', label: 'Nenhum' }, ...items.map((item) => ({ value: String(item.id), label: `${item.name} (${COSMETIC_TYPE_LABELS[item.type].one})` }))];
}

export function CollectionsScreen() {
  const { confirm } = useDialogs();
  const toast = useToast();
  const list = usePagedList(listCollectionsAdmin, {}, 10);
  const [editing, setEditing] = useState<AdminCollection | 'new' | null>(null);

  async function remove(collection: AdminCollection) {
    const ok = await confirm({ title: `Excluir "${collection.name}"?`, message: 'Quem já resgatou o prêmio continua com ele.', confirmLabel: 'Excluir', tone: 'danger' });
    if (!ok) return;
    try {
      await deleteCollection(collection.id);
      toast.success('Coleção excluída.');
      list.reload();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  return (
    <AdminPanel
      description="Grupos de figurinhas (ex.: os 12 apóstolos, os juízes, os reis de Israel). Quem completa resgata o prêmio uma vez. Os jogadores veem as que faltam só pela raridade."
      actions={
        <Button onClick={() => setEditing('new')}>
          <AddRoundedIcon fontSize="small" /> Nova coleção
        </Button>
      }
    >
      <DataTable
        columns={[{ label: 'Coleção' }, { label: 'Figurinhas' }, { label: 'Prêmio' }, { label: 'Status' }, { label: '', className: 'w-28' }]}
        loading={list.loading}
        error={list.error}
        isEmpty={list.items.length === 0}
        empty="Nenhuma coleção ainda. Crie a primeira!"
      >
        {list.items.map((collection) => (
          <Row key={collection.id}>
            <Cell>
              <p className="font-semibold">{collection.name}</p>
              {collection.description ? <p className="max-w-xs truncate text-xs text-muted">{collection.description}</p> : null}
            </Cell>
            <Cell>{collection.characters.length}</Cell>
            <Cell>
              <span className="flex flex-wrap items-center gap-2">
                {collection.rewardCoins ? (
                  <span className="inline-flex items-center gap-1">
                    <CoinIcon className="h-4 w-4" /> {collection.rewardCoins}
                  </span>
                ) : null}
                {collection.rewardCosmetic ? <span className="text-xs font-semibold text-muted">{collection.rewardCosmetic.name}</span> : null}
              </span>
            </Cell>
            <Cell>
              <StatusBadge active={collection.active} />
            </Cell>
            <Cell>
              <div className="flex justify-end gap-1">
                <IconAction label="Editar" onClick={() => setEditing(collection)}>
                  <EditRoundedIcon fontSize="small" />
                </IconAction>
                <IconAction label="Excluir" tone="danger" onClick={() => void remove(collection)}>
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconAction>
              </div>
            </Cell>
          </Row>
        ))}
      </DataTable>
      <Pagination page={list.page} totalPages={list.totalPages} totalElements={list.totalElements} pageSize={list.size} onPageChange={list.setPage} onPageSizeChange={list.setSize} itemLabel="coleções" />
      {editing ? (
        <CollectionModal
          collection={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            list.reload();
          }}
        />
      ) : null}
    </AdminPanel>
  );
}

function CollectionModal({ collection, onClose, onSaved }: { collection: AdminCollection | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(collection?.name ?? '');
  const [description, setDescription] = useState(collection?.description ?? '');
  const [coins, setCoins] = useState(String(collection?.rewardCoins ?? 300));
  const [cosmeticId, setCosmeticId] = useState(collection?.rewardCosmeticId ? String(collection.rewardCosmeticId) : '');
  const [active, setActive] = useState(collection?.active ?? true);
  const [selected, setSelected] = useState<number[]>(collection?.characters.map((character) => character.id) ?? []);
  const [characters, setCharacters] = useState<CharacterOption[] | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const cosmeticOptions = useCosmeticOptions();

  useEffect(() => {
    listCharacterOptions()
      .then(setCharacters)
      .catch(() => setCharacters([]));
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return (characters ?? []).filter((character) => !term || character.name.toLocaleLowerCase('pt-BR').includes(term));
  }, [characters, search]);
  const paging = usePagination(filtered, 12);

  function toggle(id: number) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selected.length < 2) {
      toast.error('Escolha pelo menos 2 personagens.');
      return;
    }
    setSaving(true);
    const payload = { name: name.trim(), description: description.trim() || null, rewardCoins: Number(coins) || 0, rewardCosmeticId: cosmeticId ? Number(cosmeticId) : null, characterIds: selected, active };
    try {
      if (collection) await updateCollection(collection.id, payload);
      else await createCollection(payload);
      toast.success('Coleção salva.');
      onSaved();
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open size="lg" title={collection ? `Editar: ${collection.name}` : 'Nova coleção'} onClose={saving ? undefined : onClose}>
      <form className="space-y-5" onSubmit={submit}>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nome" required>
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required placeholder="Ex.: Os 12 apóstolos" />
          </Field>
          <Field label="Moedas do prêmio">
            <Input type="number" min={0} value={coins} onChange={(event) => setCoins(event.target.value)} />
          </Field>
        </div>
        <Field label="Descrição (opcional)">
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} maxLength={300} />
        </Field>
        <Field label="Item visual de prêmio (opcional)" hint="Um título ou ícone exclusivo deixa a coleção mais desejada.">
          <Select aria-label="Item visual" searchable value={cosmeticId} onChange={setCosmeticId} options={cosmeticOptions} />
        </Field>
        <Field label={`Personagens (${selected.length} escolhidos)`}>
          <div className="space-y-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Buscar personagem" label="Buscar personagem" />
            {!characters ? <Spinner /> : null}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {paging.pageItems.map((character) => {
                const on = selected.includes(character.id);
                return (
                  <button
                    key={character.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(character.id)}
                    className={cn('flex items-center gap-2 rounded-2xl border-2 p-2 text-left text-sm font-semibold transition', on ? 'border-primary bg-primary/10 text-ink' : 'border-edge text-muted hover:text-ink')}
                  >
                    <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2', on ? 'border-primary bg-primary text-on-primary' : 'border-edge-strong')}>
                      {on ? <CheckRoundedIcon sx={{ fontSize: 14 }} /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{character.name}</span>
                    <RarityBadge rarity={character.rarity} />
                  </button>
                );
              })}
            </div>
            {paging.totalPages > 1 ? <Pagination page={paging.page} totalPages={paging.totalPages} totalElements={paging.totalElements} onPageChange={paging.setPage} itemLabel="personagens" /> : null}
          </div>
        </Field>
        <Switch checked={active} onChange={setActive} label="Ativa (aparece para os jogadores)" />
        <div className="flex justify-end gap-2 border-t border-edge pt-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
