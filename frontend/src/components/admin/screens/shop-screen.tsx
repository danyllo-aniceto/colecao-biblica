import { useCallback, useEffect, useState, type FormEvent } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import ToggleOffRoundedIcon from '@mui/icons-material/ToggleOffRounded';
import ToggleOnRoundedIcon from '@mui/icons-material/ToggleOnRounded';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialogs';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { errorMessage, useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { CoinIcon } from '@/components/game/game-ui';
import { createShopItem, deleteShopItem, listRewards, listShopItemsAdmin, updateShopItem, type AdminReward, type AdminShopItem, type ShopItemType } from '@/lib/admin-api';
import { SHOP_TYPE_LABELS } from '@/lib/labels';
import { AdminPanel, Cell, DataTable, IconAction, Row, StatusBadge } from '../admin-ui';
import { rewardSummary } from './rewards-screen';

/** A loja não vende moedas nem figurinha lendária direta (essas só no sorteio/pacote). */
const sellable = (reward: AdminReward) => reward.rewardType !== 'COINS' && !(reward.rewardType === 'STICKER' && reward.stickerRarity === 'LEGENDARY');

export function ShopScreen() {
  const { confirm } = useDialogs();
  const toast = useToast();
  const [items, setItems] = useState<AdminShopItem[]>([]);
  const [rewards, setRewards] = useState<AdminReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminShopItem | 'new' | null>(null);
  const paging = usePagination(items, 10);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([listShopItemsAdmin(), listRewards()])
      .then(([shop, rewardList]) => {
        setItems(shop);
        setRewards(rewardList);
        setError(null);
      })
      .catch((reason: unknown) => setError(errorMessage(reason)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function toggle(item: AdminShopItem) {
    try {
      await updateShopItem(item.id, { active: !item.active });
      toast.success(item.active ? `${item.name} saiu da loja.` : `${item.name} voltou para a loja.`);
      load();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  async function remove(item: AdminShopItem) {
    const ok = await confirm({ title: `Excluir "${item.name}"?`, message: 'O item some da loja. Quem já comprou continua com o que ganhou.', confirmLabel: 'Excluir', tone: 'danger' });
    if (!ok) return;
    try {
      await deleteShopItem(item.id);
      toast.success('Item excluído.');
      load();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  return (
    <AdminPanel
      description="Itens fixos (cadeado) podem ter preço, descrição e status ajustados. Crie itens novos para promoções e combos usando qualquer recompensa vendável."
      actions={
        <Button onClick={() => setEditing('new')}>
          <AddRoundedIcon fontSize="small" />
          Novo item
        </Button>
      }
    >
      <DataTable
        columns={[{ label: 'Item' }, { label: 'Entrega' }, { label: 'Preço' }, { label: 'Status' }, { label: 'Ações', className: 'w-36 text-right' }]}
        loading={loading}
        error={error}
        isEmpty={items.length === 0}
        empty="Nenhum item na loja."
      >
        {paging.pageItems.map((item) => {
          const reward = rewards.find((entry) => entry.id === item.rewardDefinitionId);
          return (
            <Row key={item.id} onClick={() => setEditing(item)}>
              <Cell className="max-w-sm">
                <div className="flex items-center gap-2">
                  <span className="font-display font-semibold text-ink">{item.name}</span>
                  {item.system ? (
                    <Tooltip content="Item fixo: ajuste preço e descrição, ou desative.">
                      <span tabIndex={0} className="text-muted">
                        <LockRoundedIcon sx={{ fontSize: 16 }} />
                      </span>
                    </Tooltip>
                  ) : (
                    <Badge tone="violet">Criado no painel</Badge>
                  )}
                </div>
                <p className="line-clamp-1 text-xs text-muted">{item.description}</p>
              </Cell>
              <Cell>{reward ? rewardSummary(reward) : <span className="text-danger">Sem recompensa</span>}</Cell>
              <Cell>
                <span className="inline-flex items-center gap-1 font-display font-bold text-ink">
                  <CoinIcon className="h-4 w-4" />
                  {item.priceCoins.toLocaleString('pt-BR')}
                </span>
              </Cell>
              <Cell>
                <StatusBadge active={item.active} on="À venda" off="Fora da loja" />
              </Cell>
              <Cell className="text-right">
                <div className="flex justify-end gap-1">
                  <IconAction label="Editar" onClick={() => setEditing(item)}>
                    <EditRoundedIcon fontSize="small" />
                  </IconAction>
                  <IconAction label={item.active ? 'Tirar da loja' : 'Pôr à venda'} onClick={() => void toggle(item)}>
                    {item.active ? <ToggleOnRoundedIcon fontSize="small" /> : <ToggleOffRoundedIcon fontSize="small" />}
                  </IconAction>
                  {!item.system ? (
                    <IconAction label="Excluir" tone="danger" onClick={() => void remove(item)}>
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconAction>
                  ) : null}
                </div>
              </Cell>
            </Row>
          );
        })}
      </DataTable>
      <Pagination page={paging.page} totalPages={paging.totalPages} totalElements={paging.totalElements} pageSize={paging.pageSize} onPageChange={paging.setPage} onPageSizeChange={paging.setPageSize} itemLabel="itens" />

      {editing ? (
        <ShopItemModal
          item={editing === 'new' ? null : editing}
          rewards={rewards.filter(sellable)}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      ) : null}
    </AdminPanel>
  );
}

function ShopItemModal({ item, rewards, onClose, onSaved }: { item: AdminShopItem | null; rewards: AdminReward[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const isNew = item === null;
  const editableIdentity = isNew || !item.system;
  const [name, setName] = useState(item?.name ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [type, setType] = useState<ShopItemType>(item?.itemType ?? 'GAME_BONUS');
  const [price, setPrice] = useState(String(item?.priceCoins ?? 100));
  const [rewardId, setRewardId] = useState(item?.rewardDefinitionId ? String(item.rewardDefinitionId) : '');
  const [active, setActive] = useState(item?.active ?? true);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const priceNumber = Number(price);
    if (!Number.isInteger(priceNumber) || priceNumber < 1) {
      toast.error('O preço precisa ser um número inteiro maior que zero.');
      return;
    }
    if (editableIdentity && !rewardId) {
      toast.error('Escolha o que o item entrega.');
      return;
    }
    setSaving(true);
    try {
      const payload = { name: name.trim(), description: description.trim(), itemType: type, priceCoins: priceNumber, rewardDefinitionId: rewardId ? Number(rewardId) : null, active };
      if (isNew) {
        await createShopItem(payload);
        toast.success('Item criado.');
      } else {
        await updateShopItem(item.id, editableIdentity ? payload : { description: payload.description, priceCoins: priceNumber, active });
        toast.success('Item atualizado.');
      }
      onSaved();
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open size="md" title={isNew ? 'Novo item da loja' : `Editar: ${item.name}`} onClose={saving ? undefined : onClose}>
      <form className="space-y-5" onSubmit={submit}>
        {editableIdentity ? (
          <Field label="Nome" required>
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={150} required placeholder="Ex.: Combo de dicas" />
          </Field>
        ) : null}
        <Field label="Descrição" required hint="Explique em uma frase o que o jogador recebe.">
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={300} required className="min-h-20" />
        </Field>
        {editableIdentity ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="O que entrega" required>
              <Select
                aria-label="Recompensa"
                value={rewardId}
                onChange={setRewardId}
                placeholder="Escolha uma recompensa"
                options={rewards.map((reward) => ({ value: String(reward.id), label: reward.name, description: rewardSummary(reward) }))}
              />
            </Field>
            <Field label="Categoria" hint="Define onde aparece na loja.">
              <Select aria-label="Categoria" value={type} onChange={setType} options={(Object.keys(SHOP_TYPE_LABELS) as ShopItemType[]).map((value) => ({ value, label: SHOP_TYPE_LABELS[value] }))} />
            </Field>
          </div>
        ) : null}
        <Field label="Preço em moedas" required hint="Referência: uma partida boa rende de 15 a 35 moedas.">
          <Input type="number" min={1} value={price} onChange={(event) => setPrice(event.target.value)} required />
        </Field>
        <Switch checked={active} onChange={setActive} label="À venda" description="Itens fora da loja não aparecem para os jogadores." />
        <div className="flex justify-end gap-3 border-t border-edge pt-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            {saving ? 'Salvando...' : isNew ? 'Criar item' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
