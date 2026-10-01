import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialogs';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { errorMessage, useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { Alert } from '@/components/game/game-ui';
import {
  createReward,
  deleteReward,
  listCharacterOptions,
  listRewards,
  updateReward,
  type AdminReward,
  type CharacterOption,
  type RewardType,
  type StickerRarity,
} from '@/lib/admin-api';
import { REWARD_TYPE_LABELS } from '@/lib/labels';
import { RARITY_ORDER, getRarityLabel } from '@/lib/rarity-theme';
import { AdminPanel, Cell, DataTable, IconAction, Row, StatusBadge } from '../admin-ui';

/** Campo de quantidade de cada tipo (os outros tipos não têm quantidade). */
const AMOUNT_FIELD: Partial<Record<RewardType, { key: 'coinAmount' | 'extraLives' | 'extraTimeSeconds' | 'hintAmount'; label: string; max: number }>> = {
  COINS: { key: 'coinAmount', label: 'Moedas entregues', max: 10_000 },
  EXTRA_LIFE: { key: 'extraLives', label: 'Vidas extras entregues', max: 20 },
  EXTRA_TIME: { key: 'extraTimeSeconds', label: 'Bônus de tempo extra entregues', max: 20 },
  FIFTY_FIFTY: { key: 'hintAmount', label: 'Dicas 50/50 entregues', max: 20 },
};

const TYPE_HELP: Record<RewardType, string> = {
  STICKER: 'Figurinha de uma raridade (sorteia uma que o jogador ainda não tem) ou de um personagem específico.',
  STICKER_PACK: 'Sorteia a raridade pelas chances do pacote (em Configurações) e depois a figurinha.',
  EXTRA_LIFE: 'Bônus guardado no inventário: protege de perder vida em um erro.',
  EXTRA_TIME: 'Bônus guardado no inventário: soma segundos a uma pergunta.',
  XP_MULTIPLIER: 'Bônus guardado no inventário: multiplica o XP da partida (o valor do multiplicador fica em Configurações).',
  FIFTY_FIFTY: 'Bônus guardado no inventário: elimina duas alternativas erradas.',
  COINS: 'Moedas entregues na hora. Não pode ser vendida na loja.',
};

export function rewardSummary(reward: AdminReward) {
  switch (reward.rewardType) {
    case 'STICKER':
      return reward.stickerCharacterName ? `Figurinha de ${reward.stickerCharacterName}` : reward.stickerRarity ? `Figurinha ${getRarityLabel(reward.stickerRarity).toLowerCase()} aleatória` : 'Figurinha';
    case 'STICKER_PACK':
      return 'Raridade sorteada';
    case 'EXTRA_LIFE':
      return `${reward.extraLives ?? 1} vida(s) extra`;
    case 'EXTRA_TIME':
      return `${reward.extraTimeSeconds ?? 1} bônus de tempo`;
    case 'FIFTY_FIFTY':
      return `${reward.hintAmount ?? 1} dica(s) 50/50`;
    case 'XP_MULTIPLIER':
      return '1 bônus de XP em dobro';
    case 'COINS':
      return `${reward.coinAmount ?? 0} moedas`;
  }
}

export function RewardsScreen() {
  const { confirm } = useDialogs();
  const toast = useToast();
  const [rewards, setRewards] = useState<AdminReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminReward | 'new' | null>(null);
  const paging = usePagination(rewards, 10);

  const load = useCallback(() => {
    setLoading(true);
    listRewards()
      .then((data) => {
        setRewards(data);
        setError(null);
      })
      .catch((reason: unknown) => setError(errorMessage(reason)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const totalWeight = useMemo(() => rewards.filter((reward) => reward.active).reduce((sum, reward) => sum + reward.dropChance, 0), [rewards]);
  const percent = (reward: AdminReward) => (reward.active && totalWeight > 0 ? (reward.dropChance / totalWeight) * 100 : 0);

  async function toggle(reward: AdminReward) {
    try {
      await updateReward(reward.id, { active: !reward.active });
      toast.success(reward.active ? `${reward.name} saiu do sorteio.` : `${reward.name} voltou ao sorteio.`);
      load();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  async function remove(reward: AdminReward) {
    const ok = await confirm({ title: `Excluir "${reward.name}"?`, message: 'A recompensa deixa de ser sorteada. Itens da loja que a usam precisam ser removidos antes.', confirmLabel: 'Excluir', tone: 'danger' });
    if (!ok) return;
    try {
      await deleteReward(reward.id);
      toast.success('Recompensa excluída.');
      load();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  return (
    <div className="space-y-6">
      <Alert tone="info">
        No fim do <strong>quiz geral</strong>, quem acerta o mínimo configurado concorre a <strong>uma</strong> recompensa ativa, sorteada pelo peso (a coluna “Chance” já mostra o
        resultado em %). Figurinha de raridade sem personagens publicados fica fora do sorteio automaticamente. Figurinha repetida vira moedas.
      </Alert>
      <AdminPanel
        actions={
          <Button onClick={() => setEditing('new')}>
            <AddRoundedIcon fontSize="small" />
            Nova recompensa
          </Button>
        }
      >
        <DataTable
          columns={[{ label: 'Recompensa' }, { label: 'Entrega' }, { label: 'Peso' }, { label: 'Chance' }, { label: 'Status' }, { label: 'Ações', className: 'w-36 text-right' }]}
          loading={loading}
          error={error}
          isEmpty={rewards.length === 0}
          empty="Nenhuma recompensa."
        >
          {paging.pageItems.map((reward) => (
            <Row key={reward.id} onClick={() => setEditing(reward)}>
              <Cell>
                <div className="flex items-center gap-2">
                  <span className="font-display font-semibold text-ink">{reward.name}</span>
                  {reward.system ? (
                    <Tooltip content="Recompensa do sistema: pode ajustar e desativar, mas não excluir.">
                      <span tabIndex={0} className="text-muted">
                        <LockRoundedIcon sx={{ fontSize: 16 }} />
                      </span>
                    </Tooltip>
                  ) : (
                    <Badge tone="violet">Criada no painel</Badge>
                  )}
                </div>
                <span className="text-xs text-muted">{REWARD_TYPE_LABELS[reward.rewardType]}</span>
              </Cell>
              <Cell>{rewardSummary(reward)}</Cell>
              <Cell>{reward.dropChance}</Cell>
              <Cell>
                <span className="font-display font-bold text-ink">{percent(reward).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>
              </Cell>
              <Cell>
                <StatusBadge active={reward.active} on="No sorteio" off="Fora" />
              </Cell>
              <Cell className="text-right">
                <div className="flex justify-end gap-1">
                  <IconAction label="Editar" onClick={() => setEditing(reward)}>
                    <EditRoundedIcon fontSize="small" />
                  </IconAction>
                  <IconAction label={reward.active ? 'Tirar do sorteio' : 'Pôr no sorteio'} onClick={() => void toggle(reward)}>
                    <Switchlet on={reward.active} />
                  </IconAction>
                  {!reward.system ? (
                    <IconAction label="Excluir" tone="danger" onClick={() => void remove(reward)}>
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconAction>
                  ) : null}
                </div>
              </Cell>
            </Row>
          ))}
        </DataTable>
        <Pagination page={paging.page} totalPages={paging.totalPages} totalElements={paging.totalElements} pageSize={paging.pageSize} onPageChange={paging.setPage} onPageSizeChange={paging.setPageSize} itemLabel="recompensas" />
      </AdminPanel>

      {editing ? (
        <RewardModal
          reward={editing === 'new' ? null : editing}
          totalWeight={totalWeight}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function Switchlet({ on }: { on: boolean }) {
  return (
    <span className={`relative inline-flex h-4 w-7 items-center rounded-full ${on ? 'bg-success' : 'bg-edge-strong'}`}>
      <span className={`h-3 w-3 rounded-full bg-white transition-transform ${on ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
    </span>
  );
}

function RewardModal({ reward, totalWeight, onClose, onSaved }: { reward: AdminReward | null; totalWeight: number; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const isNew = reward === null;
  const editableIdentity = isNew || !reward.system;
  const [type, setType] = useState<RewardType>(reward?.rewardType ?? 'COINS');
  const [name, setName] = useState(reward?.name ?? '');
  const [rarity, setRarity] = useState<StickerRarity | ''>(reward?.stickerRarity ?? (isNew ? 'COMMON' : ''));
  const [characterId, setCharacterId] = useState(reward?.stickerCharacterId ? String(reward.stickerCharacterId) : '');
  const amountField = AMOUNT_FIELD[type];
  const [amount, setAmount] = useState(String((amountField && reward ? reward[amountField.key] : null) ?? (type === 'COINS' ? 50 : 1)));
  const [weight, setWeight] = useState(String(reward?.dropChance ?? 5));
  const [active, setActive] = useState(reward?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [characters, setCharacters] = useState<CharacterOption[]>([]);

  useEffect(() => {
    if (type === 'STICKER' && editableIdentity) listCharacterOptions().then(setCharacters).catch(() => setCharacters([]));
  }, [type, editableIdentity]);

  const weightNumber = Number(weight);
  const otherWeight = totalWeight - (reward?.active ? reward.dropChance : 0);
  const preview = active && weightNumber > 0 ? (weightNumber / (otherWeight + weightNumber)) * 100 : 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!(weightNumber > 0)) {
      toast.error('O peso no sorteio precisa ser maior que zero.');
      return;
    }
    if (type === 'STICKER' && editableIdentity && !rarity && !characterId) {
      toast.error('Escolha uma raridade ou um personagem para a figurinha.');
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        await createReward({
          name: name.trim(),
          rewardType: type,
          stickerRarity: type === 'STICKER' ? rarity || null : null,
          stickerCharacterId: type === 'STICKER' && characterId ? Number(characterId) : null,
          amount: amountField ? Number(amount) : null,
          dropChance: weightNumber,
          active,
        });
        toast.success('Recompensa criada.');
      } else {
        await updateReward(reward.id, {
          ...(editableIdentity ? { name: name.trim() } : {}),
          ...(editableIdentity && type === 'STICKER' ? { stickerRarity: rarity || null, stickerCharacterId: characterId ? Number(characterId) : null } : {}),
          ...(amountField ? { [amountField.key]: Number(amount) } : {}),
          dropChance: weightNumber,
          active,
        });
        toast.success('Recompensa atualizada.');
      }
      onSaved();
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  let typeFields: ReactNode = null;
  if (type === 'STICKER') {
    typeFields = editableIdentity ? (
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Raridade" hint="Sorteia uma figurinha desta raridade.">
          <Select
            aria-label="Raridade"
            value={rarity}
            onChange={setRarity}
            options={[{ value: '', label: 'Nenhuma (usar personagem)' }, ...RARITY_ORDER.map((item) => ({ value: item, label: getRarityLabel(item) }))]}
          />
        </Field>
        <Field label="Ou um personagem específico" hint="Tem prioridade sobre a raridade.">
          <Select
            aria-label="Personagem"
            searchable
            value={characterId}
            onChange={setCharacterId}
            options={[{ value: '', label: 'Nenhum' }, ...characters.map((character) => ({ value: String(character.id), label: character.name }))]}
          />
        </Field>
      </div>
    ) : (
      <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-muted">Figurinha {reward?.stickerRarity ? getRarityLabel(reward.stickerRarity).toLowerCase() : ''} aleatória (fixa do sistema).</p>
    );
  }

  return (
    <Modal open size="md" title={isNew ? 'Nova recompensa' : `Editar: ${reward.name}`} description={TYPE_HELP[type]} onClose={saving ? undefined : onClose}>
      <form className="space-y-5" onSubmit={submit}>
        {editableIdentity ? (
          <Field label="Nome" required hint="Aparece para o jogador quando ele ganha.">
            <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={150} required placeholder="Ex.: Baú de moedas" />
          </Field>
        ) : null}
        {isNew ? (
          <Field label="Tipo">
            <Select
              aria-label="Tipo de recompensa"
              value={type}
              onChange={(value) => {
                setType(value);
                setAmount(value === 'COINS' ? '50' : '1');
              }}
              options={(Object.keys(REWARD_TYPE_LABELS) as RewardType[]).map((item) => ({ value: item, label: REWARD_TYPE_LABELS[item], description: TYPE_HELP[item] }))}
            />
          </Field>
        ) : null}
        {typeFields}
        {amountField ? (
          <Field label={amountField.label}>
            <Input type="number" min={1} max={amountField.max} value={amount} onChange={(event) => setAmount(event.target.value)} required />
          </Field>
        ) : null}
        <Field label="Peso no sorteio" hint={`Com este peso, a chance fica em ${preview.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% entre as recompensas ativas.`}>
          <Input type="number" min={0.01} step="0.01" value={weight} onChange={(event) => setWeight(event.target.value)} required />
        </Field>
        <Switch checked={active} onChange={setActive} label="Participa do sorteio" description="Fora do sorteio ela não sai no fim das partidas (itens da loja ligados a ela continuam à venda)." />
        <div className="flex justify-end gap-3 border-t border-edge pt-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            {saving ? 'Salvando...' : isNew ? 'Criar recompensa' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
