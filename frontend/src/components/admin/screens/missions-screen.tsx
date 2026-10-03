import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
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
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { errorMessage, useToast } from '@/components/ui/toast';
import { Tooltip } from '@/components/ui/tooltip';
import { CoinIcon } from '@/components/game/game-ui';
import {
  createMission,
  deleteMission,
  listMissionsAdmin,
  listRewards,
  updateMission,
  type AdminMission,
  type AdminReward,
  type MissionPeriod,
} from '@/lib/admin-api';
import { AdminPanel, Cell, DataTable, IconAction, Row, StatusBadge } from '../admin-ui';
import { rewardSummary } from './rewards-screen';

const PERIOD_LABELS: Record<MissionPeriod, string> = { DAILY: 'Diária', WEEKLY: 'Semanal' };

/** Baús abrem com nível próprio; missão entrega recompensas diretas (ajudas, figurinhas, itens visuais...). */
const usable = (reward: AdminReward) => !reward.rewardType.startsWith('CHEST_');

export function MissionsScreen() {
  const { confirm } = useDialogs();
  const toast = useToast();
  const [missions, setMissions] = useState<AdminMission[]>([]);
  const [metrics, setMetrics] = useState<Array<{ value: string; label: string }>>([]);
  const [rewards, setRewards] = useState<AdminReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<MissionPeriod>('DAILY');
  const [editing, setEditing] = useState<AdminMission | 'new' | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([listMissionsAdmin(), listRewards()])
      .then(([data, rewardList]) => {
        setMissions(data.missions);
        setMetrics(data.metrics);
        setRewards(rewardList);
        setError(null);
      })
      .catch((reason: unknown) => setError(errorMessage(reason)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const visible = useMemo(() => missions.filter((mission) => mission.period === period), [missions, period]);
  const paging = usePagination(visible, 10);
  const metricLabel = (value: string) => metrics.find((metric) => metric.value === value)?.label ?? value;
  const activeCount = visible.filter((mission) => mission.active).length;

  async function toggle(mission: AdminMission) {
    try {
      await updateMission(mission.id, { active: !mission.active });
      toast.success(mission.active ? 'Missão desativada.' : 'Missão ativada.');
      load();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  async function remove(mission: AdminMission) {
    const ok = await confirm({ title: `Excluir "${mission.title}"?`, message: 'A missão some para todos os jogadores.', confirmLabel: 'Excluir', tone: 'danger' });
    if (!ok) return;
    try {
      await deleteMission(mission.id);
      toast.success('Missão excluída.');
      load();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  return (
    <AdminPanel
      description="Metas que renovam. Cada jogador recebe 3 missões diárias sorteadas entre as ativas (mude todo dia) e todas as semanais ativas. O prêmio pode ser moedas, uma recompensa (ajuda, pacote, figurinha, item visual) ou os dois."
      actions={
        <Button onClick={() => setEditing('new')}>
          <AddRoundedIcon fontSize="small" />
          Nova missão
        </Button>
      }
    >
      <div className="max-w-xs">
        <Segmented
          aria-label="Período"
          value={period}
          onChange={setPeriod}
          options={[
            { value: 'DAILY', label: 'Diárias' },
            { value: 'WEEKLY', label: 'Semanais' },
          ]}
        />
      </div>
      {period === 'DAILY' && activeCount < 3 && !loading ? <p className="text-sm font-semibold text-danger">Deixe pelo menos 3 missões diárias ativas para o sorteio do dia.</p> : null}

      <DataTable
        columns={[{ label: 'Missão' }, { label: 'Meta' }, { label: 'Prêmio' }, { label: 'Status' }, { label: 'Ações', className: 'w-36 text-right' }]}
        loading={loading}
        error={error}
        isEmpty={visible.length === 0}
        empty="Nenhuma missão neste período."
      >
        {paging.pageItems.map((mission) => (
          <Row key={mission.id} onClick={() => setEditing(mission)}>
            <Cell className="max-w-sm">
              <div className="flex items-center gap-2">
                <span className="font-display font-semibold text-ink">{mission.title}</span>
                {mission.system ? (
                  <Tooltip content="Missão padrão: dá para ajustar meta e prêmio, ou desativar.">
                    <span tabIndex={0} className="text-muted">
                      <LockRoundedIcon sx={{ fontSize: 16 }} />
                    </span>
                  </Tooltip>
                ) : (
                  <Badge tone="violet">Criada no painel</Badge>
                )}
              </div>
              <p className="text-xs text-muted">{metricLabel(mission.metric)}</p>
            </Cell>
            <Cell>{mission.target.toLocaleString('pt-BR')}</Cell>
            <Cell>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {mission.rewardCoins > 0 ? (
                  <span className="inline-flex items-center gap-1 font-display font-bold text-ink">
                    <CoinIcon className="h-4 w-4" />
                    {mission.rewardCoins.toLocaleString('pt-BR')}
                  </span>
                ) : null}
                {mission.reward ? <span className="text-sm font-semibold text-ink">{mission.reward.name}</span> : null}
              </div>
            </Cell>
            <Cell>
              <StatusBadge active={mission.active} on="Ativa" off="Desativada" />
            </Cell>
            <Cell className="text-right">
              <div className="flex justify-end gap-1">
                <IconAction label="Editar" onClick={() => setEditing(mission)}>
                  <EditRoundedIcon fontSize="small" />
                </IconAction>
                <IconAction label={mission.active ? 'Desativar' : 'Ativar'} onClick={() => void toggle(mission)}>
                  {mission.active ? <ToggleOnRoundedIcon fontSize="small" /> : <ToggleOffRoundedIcon fontSize="small" />}
                </IconAction>
                {!mission.system ? (
                  <IconAction label="Excluir" tone="danger" onClick={() => void remove(mission)}>
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconAction>
                ) : null}
              </div>
            </Cell>
          </Row>
        ))}
      </DataTable>
      <Pagination page={paging.page} totalPages={paging.totalPages} totalElements={paging.totalElements} pageSize={paging.pageSize} onPageChange={paging.setPage} onPageSizeChange={paging.setPageSize} itemLabel="missões" />

      {editing ? (
        <MissionModal
          mission={editing === 'new' ? null : editing}
          defaultPeriod={period}
          metrics={metrics}
          rewards={rewards.filter(usable)}
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

function MissionModal({
  mission,
  defaultPeriod,
  metrics,
  rewards,
  onClose,
  onSaved,
}: {
  mission: AdminMission | null;
  defaultPeriod: MissionPeriod;
  metrics: Array<{ value: string; label: string }>;
  rewards: AdminReward[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isNew = mission === null;
  const editableIdentity = isNew || !mission.system;
  const [title, setTitle] = useState(mission?.title ?? '');
  const [period, setPeriod] = useState<MissionPeriod>(mission?.period ?? defaultPeriod);
  const [metric, setMetric] = useState(mission?.metric ?? metrics[0]?.value ?? '');
  const [target, setTarget] = useState(String(mission?.target ?? 1));
  const [coins, setCoins] = useState(String(mission?.rewardCoins ?? 20));
  const [rewardId, setRewardId] = useState(mission?.rewardDefinitionId ? String(mission.rewardDefinitionId) : '');
  const [active, setActive] = useState(mission?.active ?? true);
  const [errors, setErrors] = useState<{ title?: string; target?: string; reward?: string }>({});
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetNumber = Number(target);
    const coinsNumber = Number(coins || 0);
    const next: typeof errors = {};
    if (!title.trim()) next.title = 'Escreva o texto da missão.';
    if (!Number.isInteger(targetNumber) || targetNumber < 1) next.target = 'A meta precisa ser um número inteiro maior que zero.';
    if (!Number.isInteger(coinsNumber) || coinsNumber < 0 || (coinsNumber === 0 && !rewardId)) next.reward = 'Defina moedas e/ou uma recompensa.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      const payload = { title: title.trim(), target: targetNumber, rewardCoins: coinsNumber, rewardDefinitionId: rewardId ? Number(rewardId) : null, active };
      if (isNew) {
        await createMission({ ...payload, period, metric });
        toast.success('Missão criada.');
      } else {
        await updateMission(mission.id, editableIdentity ? { ...payload, period, metric } : payload);
        toast.success('Missão atualizada.');
      }
      onSaved();
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open size="md" title={isNew ? 'Nova missão' : 'Editar missão'} onClose={saving ? undefined : onClose}>
      <form className="space-y-5" onSubmit={submit} noValidate>
        <Field label="Texto da missão" required error={errors.title} hint="Aparece para o jogador, ex.: Acerte 15 perguntas.">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Ex.: Termine 3 partidas" />
        </Field>
        {editableIdentity ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Período" required>
              <Select<MissionPeriod> aria-label="Período" value={period} onChange={setPeriod} options={(Object.keys(PERIOD_LABELS) as MissionPeriod[]).map((value) => ({ value, label: PERIOD_LABELS[value] }))} />
            </Field>
            <Field label="O que conta" required>
              <Select aria-label="O que conta" value={metric} onChange={setMetric} options={metrics} />
            </Field>
          </div>
        ) : null}
        <Field label="Meta" required error={errors.target} hint="Quantas vezes o jogador precisa fazer.">
          <Input type="number" min={1} value={target} onChange={(event) => setTarget(event.target.value)} />
        </Field>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Moedas" error={errors.reward} hint="Pode ser 0 se houver recompensa.">
            <Input type="number" min={0} value={coins} onChange={(event) => setCoins(event.target.value)} />
          </Field>
          <Field label="Recompensa extra" hint="Ajuda, pacote, figurinha, item visual...">
            <Select
              aria-label="Recompensa extra"
              searchable
              value={rewardId}
              onChange={setRewardId}
              options={[{ value: '', label: 'Nenhuma' }, ...rewards.map((reward) => ({ value: String(reward.id), label: reward.name, description: rewardSummary(reward) }))]}
            />
          </Field>
        </div>
        <Switch checked={active} onChange={setActive} label="Ativa" description="Missões desativadas não entram no sorteio nem na semana." />
        <div className="flex justify-end gap-3 border-t border-edge pt-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            {saving ? 'Salvando...' : isNew ? 'Criar missão' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
