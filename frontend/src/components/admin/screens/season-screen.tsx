import { useCallback, useEffect, useState, type FormEvent } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ToggleOffRoundedIcon from '@mui/icons-material/ToggleOffRounded';
import ToggleOnRoundedIcon from '@mui/icons-material/ToggleOnRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
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
  createPass,
  createPassTier,
  deletePass,
  getPassSchedule,
  importPassTiers,
  listPasses,
  updatePass,
  deleteEvent,
  deletePassTier,
  listEventsAdmin,
  listPassTiers,
  updateEvent,
  updatePassTier,
  type AdminEvent,
  type AdminPass,
  type AdminPassTier,
  type PassScheduleMonth,
} from '@/lib/admin-rewards-api';
import { AdminPanel, Cell, DataTable, IconAction, Row, StatusBadge } from '../admin-ui';
import { usePagedList } from '../use-paged-list';
import { ImageUploadField } from '../image-upload-field';
import { BulkImportModal } from '../bulk-import-modal';
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
  const [passes, setPasses] = useState<AdminPass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setLoading(true);
    listPasses()
      .then((data) => {
        setPasses(data);
        setError(null);
      })
      .catch((reason: unknown) => setError(errorMessage(reason)))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  return (
    <div className="space-y-6">
      <PassesPanel passes={passes} loading={loading} error={error} onChanged={load} />
      <TiersPanel passes={passes} onChanged={load} />
      <EventsPanel />
    </div>
  );
}

const monthLabel = (monthKey: string) => new Date(`${monthKey}-15T12:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
/** "12" = todo dezembro; "2026-12" = só dezembro de 2026. */
const pinnedLabel = (pinned: string) => (pinned.length === 2 ? `Todo ano em ${MONTH_NAMES[Number(pinned) - 1]}` : monthLabel(pinned));

/** Próximos 24 meses para fixar um passe. */
function monthOptions(current: string | null) {
  const now = new Date();
  const keys = Array.from({ length: 24 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() + index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
  if (current && !keys.includes(current)) keys.unshift(current);
  const yearly = MONTH_NAMES.map((name, index) => ({ value: String(index + 1).padStart(2, '0'), label: `Todo ano em ${name}` }));
  return [{ value: '', label: 'Nenhum: entra no rodízio' }, ...yearly, ...keys.map((key) => ({ value: key, label: `Só em ${monthLabel(key)}` }))];
}

function PassesPanel({ passes, loading, error, onChanged }: { passes: AdminPass[]; loading: boolean; error: string | null; onChanged: () => void }) {
  const { confirm } = useDialogs();
  const toast = useToast();
  const [editing, setEditing] = useState<AdminPass | 'new' | null>(null);
  const [schedule, setSchedule] = useState<PassScheduleMonth[]>([]);
  const paging = usePagination(passes, 10);

  useEffect(() => {
    getPassSchedule()
      .then(setSchedule)
      .catch(() => setSchedule([]));
  }, [passes]);

  async function remove(pass: AdminPass) {
    const ok = await confirm({ title: `Excluir "${pass.name}"?`, message: `Os ${pass.tiers} degrau(s) deste passe também somem. Quem já resgatou continua com os prêmios.`, confirmLabel: 'Excluir', tone: 'danger' });
    if (!ok) return;
    try {
      await deletePass(pass.id);
      toast.success('Passe excluído.');
      onChanged();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  async function toggle(pass: AdminPass) {
    try {
      await updatePass(pass.id, { active: !pass.active });
      toast.success(pass.active ? 'Passe tirado do rodízio.' : 'Passe de volta ao rodízio.');
      onChanged();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  return (
    <AdminPanel
      title="Passes temáticos"
      description="Cada mês vale um passe: o que estiver fixado naquele mês (ex.: Natal em dezembro) ou, senão, o do rodízio entre os passes ativos. Quanto mais passes, mais raro cada um volta. Se o jogador já tiver o item visual do degrau, ele recebe moedas no lugar."
      actions={
        <Button onClick={() => setEditing('new')}>
          <AddRoundedIcon fontSize="small" /> Novo passe
        </Button>
      }
    >
      <DataTable
        columns={[{ label: 'Passe' }, { label: 'Quando vale' }, { label: 'Degraus' }, { label: 'Status' }, { label: '', className: 'w-36' }]}
        loading={loading}
        error={error}
        isEmpty={passes.length === 0}
        empty="Nenhum passe. Crie o primeiro."
        minWidth={620}
      >
        {paging.pageItems.map((pass) => (
          <Row key={pass.id} onClick={() => setEditing(pass)}>
            <Cell>
              <div className="flex items-center gap-3">
                <span className="h-9 w-9 shrink-0 overflow-hidden rounded-xl border border-edge" style={{ background: pass.color ?? 'var(--surface-3)' }}>
                  {pass.imageUrl ? <img src={pass.imageUrl} alt="" className="h-full w-full object-cover" /> : null}
                </span>
                <div className="min-w-0">
                  <p className="font-display font-semibold text-ink">{pass.name}</p>
                  {pass.description ? <p className="line-clamp-1 text-xs text-muted">{pass.description}</p> : null}
                </div>
              </div>
            </Cell>
            <Cell>{pass.pinnedMonth ? <span className="font-semibold">{pinnedLabel(pass.pinnedMonth)}</span> : <span className="text-muted">Rodízio</span>}</Cell>
            <Cell>{pass.tiers}</Cell>
            <Cell>
              <StatusBadge active={pass.active} on="Ativo" off="Fora do rodízio" />
            </Cell>
            <Cell>
              <div className="flex justify-end gap-1">
                <IconAction label="Editar" onClick={() => setEditing(pass)}>
                  <EditRoundedIcon fontSize="small" />
                </IconAction>
                <IconAction label={pass.active ? 'Tirar do rodízio' : 'Pôr no rodízio'} onClick={() => void toggle(pass)}>
                  {pass.active ? <ToggleOnRoundedIcon fontSize="small" className="text-success" /> : <ToggleOffRoundedIcon fontSize="small" />}
                </IconAction>
                <IconAction label="Excluir" tone="danger" onClick={() => void remove(pass)}>
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconAction>
              </div>
            </Cell>
          </Row>
        ))}
      </DataTable>
      <Pagination page={paging.page} totalPages={paging.totalPages} totalElements={paging.totalElements} onPageChange={paging.setPage} itemLabel="passes" />

      {schedule.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-bold text-muted">Próximos meses</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {schedule.map((month) => (
              <div key={month.monthKey} className="flex items-center justify-between gap-2 rounded-2xl bg-surface-2 px-3 py-2">
                <span className="text-sm font-semibold capitalize text-muted">{monthLabel(month.monthKey)}</span>
                <span className="truncate text-sm font-bold text-ink">
                  {month.name ?? 'Sem passe'}
                  {month.pinned ? ' 📌' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {editing ? (
        <PassModal
          pass={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      ) : null}
    </AdminPanel>
  );
}

function PassModal({ pass, onClose, onSaved }: { pass: AdminPass | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(pass?.name ?? '');
  const [description, setDescription] = useState(pass?.description ?? '');
  const [color, setColor] = useState(pass?.color ?? '#8e6bd1');
  const [imageUrl, setImageUrl] = useState(pass?.imageUrl ?? '');
  const [pinnedMonth, setPinnedMonth] = useState(pass?.pinnedMonth ?? '');
  const [active, setActive] = useState(pass?.active ?? true);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return setNameError('Dê um nome ao passe.');
    setNameError(null);
    setSaving(true);
    const payload = { name: name.trim(), description: description.trim() || null, color, imageUrl: imageUrl || null, pinnedMonth: pinnedMonth || null, active };
    try {
      if (pass) await updatePass(pass.id, payload);
      else await createPass(payload);
      toast.success(pass ? 'Passe salvo.' : 'Passe criado.');
      onSaved();
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open size="md" title={pass ? `Editar: ${pass.name}` : 'Novo passe'} onClose={saving ? undefined : onClose}>
      <form className="space-y-4" onSubmit={submit} noValidate>
        <Field label="Nome" required error={nameError ?? undefined}>
          <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Ex.: Passe do Natal" />
        </Field>
        <Field label="Descrição (opcional)" hint="Aparece embaixo do nome para o jogador.">
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={300} rows={2} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Cor do tema">
            <ColorField value={color} onChange={setColor} />
          </Field>
          <Field label="Fixar num mês" hint="Todo ano num mês (ex.: Natal) ou só num mês específico. Vazio = entra no rodízio.">
            <Select aria-label="Mês" searchable value={pinnedMonth} onChange={setPinnedMonth} options={monthOptions(pass?.pinnedMonth ?? null)} />
          </Field>
        </div>
        <Field label="Imagem de fundo (opcional)" hint="Aparece suave atrás do cartão do passe.">
          <ImageUploadField value={imageUrl} onChange={setImageUrl} wide />
        </Field>
        <Switch checked={active} onChange={setActive} label="No rodízio" description="Passes fora do rodízio não valem em nenhum mês (a menos que você os reative)." />
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

function TiersPanel({ passes, onChanged }: { passes: AdminPass[]; onChanged: () => void }) {
  const { confirm } = useDialogs();
  const toast = useToast();
  const [passId, setPassId] = useState('');
  const selected = passId || (passes[0] ? String(passes[0].id) : '');
  const selectedPass = passes.find((pass) => String(pass.id) === selected) ?? null;
  const [tiers, setTiers] = useState<AdminPassTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminPassTier | 'new' | null>(null);
  const [importing, setImporting] = useState(false);
  const paging = usePagination(tiers, 10);

  const load = useCallback(() => {
    if (!selected) {
      setTiers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    listPassTiers(Number(selected))
      .then((data) => {
        setTiers(data);
        setError(null);
      })
      .catch((reason: unknown) => setError(errorMessage(reason)))
      .finally(() => setLoading(false));
  }, [selected]);
  useEffect(load, [load]);

  async function remove(tier: AdminPassTier) {
    const ok = await confirm({ title: `Excluir o degrau ${tier.level}?`, confirmLabel: 'Excluir', tone: 'danger' });
    if (!ok) return;
    try {
      await deletePassTier(tier.id);
      toast.success('Degrau excluído.');
      load();
      onChanged();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  return (
    <AdminPanel
      title="Degraus do passe"
      description="O progresso é o XP que o jogador ganha no mês e recomeça no dia 1º. Cada degrau pode dar moedas, uma recompensa (ajuda, figurinha, pacote) e/ou um item visual (ícone, moldura, fundo de perfil, capa do álbum, reação...)."
      actions={
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setImporting(true)} disabled={!selectedPass}>
            <UploadFileRoundedIcon fontSize="small" /> Importar planilha
          </Button>
          <Button onClick={() => setEditing('new')} disabled={!selectedPass}>
            <AddRoundedIcon fontSize="small" /> Novo degrau
          </Button>
        </div>
      }
    >
      {passes.length > 0 ? (
        <div className="max-w-sm">
          <Select aria-label="Passe" searchable value={selected} onChange={setPassId} options={passes.map((pass) => ({ value: String(pass.id), label: pass.name }))} />
        </div>
      ) : null}
      <DataTable
        columns={[{ label: 'Degrau' }, { label: 'XP no mês' }, { label: 'Prêmio' }, { label: 'Se já tiver o item' }, { label: 'Status' }, { label: '', className: 'w-28' }]}
        loading={loading}
        error={error}
        isEmpty={tiers.length === 0}
        empty="Nenhum degrau neste passe."
        minWidth={760}
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
              {tier.rewardCosmetic ? (
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="inline-flex items-center gap-1">
                    <CoinIcon className="h-4 w-4" />
                    {tier.duplicateCoins ?? `${DEFAULT_DUPLICATE_COINS[tier.rewardCosmetic.rarity] ?? 50} (padrão)`}
                  </span>
                  {tier.duplicateRewardDefinition ? <span>+ {tier.duplicateRewardDefinition.name}</span> : null}
                </span>
              ) : (
                <span className="text-muted">—</span>
              )}
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
      {editing && selectedPass ? (
        <TierModal
          passId={selectedPass.id}
          tier={editing === 'new' ? null : editing}
          nextLevel={(tiers.at(-1)?.level ?? 0) + 1}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
            onChanged();
          }}
        />
      ) : null}
      {importing && selectedPass ? (
        <BulkImportModal
          title={`Importar degraus: ${selectedPass.name}`}
          description="Use uma planilha CSV (Excel ou Google Planilhas: Arquivo → Baixar como CSV). Cada linha vira um degrau."
          noun="degrau(s)"
          templateFile="modelo-degraus-passe.csv"
          header={['Degrau', 'XP', 'Moedas', 'Recompensa', 'Item visual', 'Moedas se repetido', 'Recompensa se repetido']}
          templateRows={[
            ['1', '300', '40', '', '', '', ''],
            ['2', '900', '', 'Dica 50/50', 'Moldura de Natal', '150', 'Pacote surpresa'],
          ]}
          aliases={{
            passe: 'pass',
            degrau: 'level',
            nivel: 'level',
            xp: 'xp',
            'xp no mes': 'xp',
            moedas: 'coins',
            recompensa: 'reward',
            'item visual': 'cosmetic',
            item: 'cosmetic',
            'moedas se repetido': 'duplicateCoins',
            'recompensa se repetido': 'duplicateReward',
          }}
          required={{ level: 'Degrau', xp: 'XP' }}
          help={<>Colunas: Degrau, XP e, se quiser, Moedas, Recompensa (nome da tela Recompensas), Item visual (nome exato), Moedas se repetido e Recompensa se repetido. Uma coluna "Passe" opcional manda cada degrau para um passe; sem ela, todos entram em {selectedPass.name}.</>}
          maxRows={300}
          run={(rows, dryRun) => importPassTiers(rows, dryRun, selectedPass.id)}
          rowLabel={(row) => (row.level ? `Degrau ${row.level}` : undefined)}
          onClose={() => setImporting(false)}
          onImported={() => {
            setImporting(false);
            load();
            onChanged();
          }}
        />
      ) : null}
    </AdminPanel>
  );
}

/** Mesmos valores do servidor para o item visual repetido (quando o degrau não define). */
const DEFAULT_DUPLICATE_COINS: Record<string, number> = { COMMON: 50, RARE: 100, EPIC: 200, LEGENDARY: 400, SPECIAL: 400 };

function TierModal({ passId, tier, nextLevel, onClose, onSaved }: { passId: number; tier: AdminPassTier | null; nextLevel: number; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [level, setLevel] = useState(String(tier?.level ?? nextLevel));
  const [xp, setXp] = useState(String(tier?.requiredXp ?? nextLevel * 900));
  const [coins, setCoins] = useState(String(tier?.rewardCoins ?? 100));
  const [rewardId, setRewardId] = useState(tier?.rewardDefinitionId ? String(tier.rewardDefinitionId) : '');
  const [cosmeticId, setCosmeticId] = useState(tier?.rewardCosmeticId ? String(tier.rewardCosmeticId) : '');
  const [duplicateCoins, setDuplicateCoins] = useState(tier?.duplicateCoins != null ? String(tier.duplicateCoins) : '');
  const [duplicateRewardId, setDuplicateRewardId] = useState(tier?.duplicateRewardDefinitionId ? String(tier.duplicateRewardDefinitionId) : '');
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
    const payload = { passId, duplicateCoins: duplicateCoins.trim() === '' ? null : Number(duplicateCoins), duplicateRewardDefinitionId: duplicateRewardId ? Number(duplicateRewardId) : null, level: Number(level), requiredXp: Number(xp), rewardCoins: Number(coins) || 0, rewardDefinitionId: rewardId ? Number(rewardId) : null, rewardCosmeticId: cosmeticId ? Number(cosmeticId) : null, active };
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
        <Field label="Item visual (opcional)" hint="Ícone, moldura, título, cor do nome, reação, fundo de perfil ou capa do álbum.">
          <Select aria-label="Item visual" searchable value={cosmeticId} onChange={setCosmeticId} options={cosmeticOptions} />
        </Field>
        {cosmeticId ? (
          <div className="grid gap-4 rounded-2xl bg-surface-2 p-3 sm:grid-cols-2">
            <p className="text-xs font-semibold text-muted sm:col-span-2">Se o jogador já tiver este item (de quando o passe passou antes), ele recebe isto no lugar:</p>
            <Field label="Moedas" hint="Vazio = valor padrão pela raridade do item.">
              <Input type="number" min={0} value={duplicateCoins} onChange={(event) => setDuplicateCoins(event.target.value)} />
            </Field>
            <Field label="Recompensa extra (opcional)">
              <Select aria-label="Recompensa se repetido" searchable value={duplicateRewardId} onChange={setDuplicateRewardId} options={[{ value: '', label: 'Nenhuma' }, ...rewards.map((reward) => ({ value: String(reward.id), label: reward.name }))]} />
            </Field>
          </div>
        ) : null}
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
  const [imageUrl, setImageUrl] = useState(event?.imageUrl ?? '');
  const [active, setActive] = useState(event?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!startsAt || !endsAt) return setError('Escolha o início e o fim do evento.');
    if (new Date(endsAt) <= new Date(startsAt)) return setError('O fim precisa ser depois do início.');
    setError(null);
    setSaving(true);
    const payload = { name: name.trim(), description: description.trim() || null, startsAt, endsAt, xpMultiplier: Number(xp) || 1, coinMultiplier: Number(coins) || 1, color, imageUrl: imageUrl || null, active };
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
        <Field label="Imagem da faixa (opcional)" hint="Aparece no lugar do degradê, com um escurecido por cima para o texto continuar legível. Use uma imagem larga, tipo 1200×400.">
          <ImageUploadField value={imageUrl} onChange={setImageUrl} wide />
        </Field>
        <Field label={imageUrl ? 'Cor de apoio (sombra e selo)' : 'Cor da faixa'}>
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
