import { useCallback, useEffect, useState, type FormEvent } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { Button } from '@/components/ui/button';
import { ColorField } from '@/components/ui/color-field';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { useDialogs } from '@/components/ui/dialogs';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { errorMessage, useToast } from '@/components/ui/toast';
import { Alert, CoinIcon } from '@/components/game/game-ui';
import { listRewards, type AdminReward } from '@/lib/admin-api';
import {
  createEvent,
  createPassTier,
  deleteEvent,
  deletePassTier,
  listEventsAdmin,
  listPassTiers,
  updateEvent,
  updatePassTier,
  type AdminEvent,
  type AdminPassTier,
} from '@/lib/admin-rewards-api';
import { AdminPanel, Cell, DataTable, IconAction, Row, StatusBadge } from '../admin-ui';
import { usePagedList } from '../use-paged-list';
import { useCosmeticOptions } from './collections-screen';

const formatDate = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

function eventStatus(event: AdminEvent) {
  const now = Date.now();
  if (!event.active) return { label: 'Desligado', tone: 'text-muted' };
  if (new Date(event.startsAt).getTime() > now) return { label: 'Agendado', tone: 'text-info' };
  if (new Date(event.endsAt).getTime() <= now) return { label: 'Encerrado', tone: 'text-muted' };
  return { label: 'Acontecendo', tone: 'text-success' };
}

export function SeasonScreen() {
  return (
    <div className="space-y-6">
      <PassPanel />
      <EventsPanel />
    </div>
  );
}

function PassPanel() {
  const { confirm } = useDialogs();
  const toast = useToast();
  const [tiers, setTiers] = useState<AdminPassTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminPassTier | 'new' | null>(null);
  const paging = usePagination(tiers, 10);

  const load = useCallback(() => {
    setLoading(true);
    listPassTiers()
      .then((data) => {
        setTiers(data);
        setError(null);
      })
      .catch((reason: unknown) => setError(errorMessage(reason)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  async function remove(tier: AdminPassTier) {
    const ok = await confirm({ title: `Excluir o degrau ${tier.level}?`, confirmLabel: 'Excluir', tone: 'danger' });
    if (!ok) return;
    try {
      await deletePassTier(tier.id);
      toast.success('Degrau excluído.');
      load();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  return (
    <AdminPanel
      title="Passe da temporada"
      description="Trilha mensal: o progresso é o XP que o jogador ganha no mês e recomeça no dia 1º. Cada degrau pode dar moedas, uma recompensa (ajuda, figurinha, pacote) e/ou um item visual."
      actions={
        <Button onClick={() => setEditing('new')}>
          <AddRoundedIcon fontSize="small" /> Novo degrau
        </Button>
      }
    >
      <DataTable
        columns={[{ label: 'Degrau' }, { label: 'XP no mês' }, { label: 'Prêmio' }, { label: 'Status' }, { label: '', className: 'w-28' }]}
        loading={loading}
        error={error}
        isEmpty={tiers.length === 0}
        empty="Nenhum degrau. Crie a trilha do passe."
        minWidth={620}
      >
        {paging.pageItems.map((tier) => (
          <Row key={tier.id}>
            <Cell className="font-display font-bold">{tier.level}</Cell>
            <Cell>{tier.requiredXp.toLocaleString('pt-BR')}</Cell>
            <Cell>
              <span className="flex flex-wrap items-center gap-2 text-sm">
                {tier.rewardCoins ? (
                  <span className="inline-flex items-center gap-1">
                    <CoinIcon className="h-4 w-4" />
                    {tier.rewardCoins}
                  </span>
                ) : null}
                {tier.rewardDefinition ? <span>{tier.rewardDefinition.name}</span> : null}
                {tier.rewardCosmetic ? <span className="font-semibold text-violet-strong dark:text-violet">{tier.rewardCosmetic.name}</span> : null}
              </span>
            </Cell>
            <Cell>
              <StatusBadge active={tier.active} />
            </Cell>
            <Cell>
              <div className="flex justify-end gap-1">
                <IconAction label="Editar" onClick={() => setEditing(tier)}>
                  <EditRoundedIcon fontSize="small" />
                </IconAction>
                <IconAction label="Excluir" tone="danger" onClick={() => void remove(tier)}>
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconAction>
              </div>
            </Cell>
          </Row>
        ))}
      </DataTable>
      <Pagination page={paging.page} totalPages={paging.totalPages} totalElements={paging.totalElements} onPageChange={paging.setPage} itemLabel="degraus" />
      {editing ? (
        <TierModal
          tier={editing === 'new' ? null : editing}
          nextLevel={(tiers.at(-1)?.level ?? 0) + 1}
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

function TierModal({ tier, nextLevel, onClose, onSaved }: { tier: AdminPassTier | null; nextLevel: number; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [level, setLevel] = useState(String(tier?.level ?? nextLevel));
  const [xp, setXp] = useState(String(tier?.requiredXp ?? nextLevel * 900));
  const [coins, setCoins] = useState(String(tier?.rewardCoins ?? 100));
  const [rewardId, setRewardId] = useState(tier?.rewardDefinitionId ? String(tier.rewardDefinitionId) : '');
  const [cosmeticId, setCosmeticId] = useState(tier?.rewardCosmeticId ? String(tier.rewardCosmeticId) : '');
  const [active, setActive] = useState(tier?.active ?? true);
  const [rewards, setRewards] = useState<AdminReward[]>([]);
  const [saving, setSaving] = useState(false);
  const cosmeticOptions = useCosmeticOptions();

  useEffect(() => {
    listRewards()
      .then((list) => setRewards(list.filter((reward) => reward.rewardType !== 'COINS' && reward.rewardType !== 'COSMETIC')))
      .catch(() => setRewards([]));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const payload = { level: Number(level), requiredXp: Number(xp), rewardCoins: Number(coins) || 0, rewardDefinitionId: rewardId ? Number(rewardId) : null, rewardCosmeticId: cosmeticId ? Number(cosmeticId) : null, active };
    try {
      if (tier) await updatePassTier(tier.id, payload);
      else await createPassTier(payload);
      toast.success('Degrau salvo.');
      onSaved();
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open size="md" title={tier ? `Degrau ${tier.level}` : 'Novo degrau'} onClose={saving ? undefined : onClose}>
      <form className="space-y-4" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Número do degrau">
            <Input type="number" min={1} max={100} value={level} onChange={(event) => setLevel(event.target.value)} required />
          </Field>
          <Field label="XP no mês para liberar" hint="Uma boa partida rende uns 150 a 250 XP.">
            <Input type="number" min={1} value={xp} onChange={(event) => setXp(event.target.value)} required />
          </Field>
        </div>
        <Field label="Moedas">
          <Input type="number" min={0} value={coins} onChange={(event) => setCoins(event.target.value)} />
        </Field>
        <Field label="Recompensa (opcional)">
          <Select aria-label="Recompensa" searchable value={rewardId} onChange={setRewardId} options={[{ value: '', label: 'Nenhuma' }, ...rewards.map((reward) => ({ value: String(reward.id), label: reward.name }))]} />
        </Field>
        <Field label="Item visual (opcional)">
          <Select aria-label="Item visual" searchable value={cosmeticId} onChange={setCosmeticId} options={cosmeticOptions} />
        </Field>
        <Switch checked={active} onChange={setActive} label="Ativo" />
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

function EventsPanel() {
  const { confirm } = useDialogs();
  const toast = useToast();
  const list = usePagedList(listEventsAdmin, {}, 10);
  const [editing, setEditing] = useState<AdminEvent | 'new' | null>(null);

  async function remove(event: AdminEvent) {
    const ok = await confirm({ title: `Excluir o evento "${event.name}"?`, message: 'Itens ligados a ele voltam a ficar sempre à venda.', confirmLabel: 'Excluir', tone: 'danger' });
    if (!ok) return;
    try {
      await deleteEvent(event.id);
      toast.success('Evento excluído.');
      list.reload();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  return (
    <AdminPanel
      title="Eventos"
      description="Datas especiais (Páscoa, Natal...): durante o evento as partidas rendem XP e/ou moedas multiplicados, a tela inicial mostra uma faixa e os itens visuais ligados ao evento ficam à venda."
      actions={
        <Button onClick={() => setEditing('new')}>
          <AddRoundedIcon fontSize="small" /> Novo evento
        </Button>
      }
    >
      <DataTable
        columns={[{ label: 'Evento' }, { label: 'Período' }, { label: 'Bônus' }, { label: 'Itens' }, { label: 'Situação' }, { label: '', className: 'w-28' }]}
        loading={list.loading}
        error={list.error}
        isEmpty={list.items.length === 0}
        empty="Nenhum evento cadastrado."
      >
        {list.items.map((event) => {
          const status = eventStatus(event);
          return (
            <Row key={event.id}>
              <Cell>
                <span className="flex items-center gap-2 font-semibold">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: event.color ?? 'var(--violet)' }} />
                  {event.name}
                </span>
              </Cell>
              <Cell className="text-xs">
                {formatDate(event.startsAt)} → {formatDate(event.endsAt)}
              </Cell>
              <Cell className="text-sm">
                {event.xpMultiplier > 1 ? `XP x${event.xpMultiplier} ` : ''}
                {event.coinMultiplier > 1 ? `Moedas x${event.coinMultiplier}` : ''}
                {event.xpMultiplier <= 1 && event.coinMultiplier <= 1 ? '—' : ''}
              </Cell>
              <Cell>{event.cosmetics}</Cell>
              <Cell className={`font-semibold ${status.tone}`}>{status.label}</Cell>
              <Cell>
                <div className="flex justify-end gap-1">
                  <IconAction label="Editar" onClick={() => setEditing(event)}>
                    <EditRoundedIcon fontSize="small" />
                  </IconAction>
                  <IconAction label="Excluir" tone="danger" onClick={() => void remove(event)}>
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconAction>
                </div>
              </Cell>
            </Row>
          );
        })}
      </DataTable>
      <Pagination page={list.page} totalPages={list.totalPages} totalElements={list.totalElements} pageSize={list.size} onPageChange={list.setPage} onPageSizeChange={list.setSize} itemLabel="eventos" />
      {editing ? (
        <EventModal
          event={editing === 'new' ? null : editing}
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

function EventModal({ event, onClose, onSaved }: { event: AdminEvent | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(event?.name ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [startsAt, setStartsAt] = useState<string | null>(event?.startsAt ?? null);
  const [endsAt, setEndsAt] = useState<string | null>(event?.endsAt ?? null);
  const [xp, setXp] = useState(String(event?.xpMultiplier ?? 1.5));
  const [coins, setCoins] = useState(String(event?.coinMultiplier ?? 1));
  const [color, setColor] = useState(event?.color ?? '#7c4dff');
  const [active, setActive] = useState(event?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!startsAt || !endsAt) return setError('Escolha o início e o fim do evento.');
    if (new Date(endsAt) <= new Date(startsAt)) return setError('O fim precisa ser depois do início.');
    setError(null);
    setSaving(true);
    const payload = { name: name.trim(), description: description.trim() || null, startsAt, endsAt, xpMultiplier: Number(xp) || 1, coinMultiplier: Number(coins) || 1, color, active };
    try {
      if (event) await updateEvent(event.id, payload);
      else await createEvent(payload);
      toast.success('Evento salvo.');
      onSaved();
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open size="lg" title={event ? `Editar: ${event.name}` : 'Novo evento'} onClose={saving ? undefined : onClose}>
      <form className="space-y-4" onSubmit={submit}>
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Field label="Nome" required>
          <Input value={name} onChange={(changeEvent) => setName(changeEvent.target.value)} maxLength={80} required placeholder="Ex.: Semana da Páscoa" />
        </Field>
        <Field label="Descrição (aparece na faixa da tela inicial)">
          <Textarea value={description} onChange={(changeEvent) => setDescription(changeEvent.target.value)} rows={2} maxLength={300} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Começa em">
            <DateTimePicker value={startsAt} onChange={setStartsAt} aria-label="Início do evento" />
          </Field>
          <Field label="Termina em">
            <DateTimePicker value={endsAt} onChange={setEndsAt} aria-label="Fim do evento" />
          </Field>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Multiplicador de XP" hint="1 = sem bônus. Máximo 2 para não desequilibrar o mês.">
            <Input type="number" min={1} max={2} step={0.1} value={xp} onChange={(changeEvent) => setXp(changeEvent.target.value)} />
          </Field>
          <Field label="Multiplicador de moedas" hint="1 = sem bônus. Máximo 2 para não desequilibrar o mês.">
            <Input type="number" min={1} max={2} step={0.1} value={coins} onChange={(changeEvent) => setCoins(changeEvent.target.value)} />
          </Field>
        </div>
        <Field label="Cor da faixa">
          <ColorField value={color} onChange={setColor} />
        </Field>
        <Switch checked={active} onChange={setActive} label="Ligado" />
        <p className="text-xs text-muted">Para vender itens só durante o evento, edite o item em Visual e escolha este evento.</p>
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
