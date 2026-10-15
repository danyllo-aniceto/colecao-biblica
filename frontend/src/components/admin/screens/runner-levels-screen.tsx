import { useEffect, useMemo, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ScienceRoundedIcon from '@mui/icons-material/ScienceRounded';
import ShuffleRoundedIcon from '@mui/icons-material/ShuffleRounded';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialogs';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { LoadingState } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { errorMessage, useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import {
  createRunnerLevel,
  deleteRunnerLevel,
  listAdminRunnerLevels,
  runnerScenarioOptions,
  updateRunnerLevel,
  type RunnerLevelDto,
} from '@/lib/runner-api';
import { MAX_FORM_ORDER, SECONDS_RANGE, SEED_RANGE, validateLevelDef, verseWords, type CampaignLevelDef } from '@runner/campaign';
import type { Form } from '@runner/types';
import { AdminPanel, IconAction, SearchInput, StatusBadge } from '../admin-ui';
import { useLevelTest, type LevelTestOutcome } from '../runner-level-test';
import { useDebouncedValue, usePagedList } from '../use-paged-list';

const FORM_LABEL: Record<Form, string> = { RUN: 'Corrida', FLY: 'Voo', GRAVITY: 'Gravidade' };
const STEP_LABEL = { build: 'Montando a fase...', exact: 'Jogando com o bot perfeito...', late: 'Jogando com o toque atrasado...' } as const;

type Draft = {
  scenarioId: string;
  name: string;
  seed: string;
  seconds: string;
  order: Form[];
  verseRef: string;
  verseText: string;
  forks: boolean;
  powers: boolean;
  active: boolean;
  sortOrder: string;
};
type Errors = Record<string, string>;

const randomSeed = () => 1 + Math.floor(Math.random() * (SEED_RANGE.max - 1));

const emptyDraft = (scenarioId: string): Draft => ({
  scenarioId,
  name: '',
  seed: String(randomSeed()),
  seconds: '60',
  order: ['RUN', 'FLY', 'RUN', 'GRAVITY'],
  verseRef: '',
  verseText: '',
  forks: true,
  powers: true,
  active: false,
  sortOrder: '100',
});

const draftOf = (level: RunnerLevelDto): Draft => ({
  scenarioId: String(level.scenarioId),
  name: level.name,
  seed: String(level.seed),
  seconds: String(level.seconds),
  order: level.order,
  verseRef: level.verseRef,
  verseText: level.verseText,
  forks: level.forks,
  powers: level.powers,
  active: level.active,
  sortOrder: String(level.sortOrder),
});

/** Só o que muda a fase gerada: se igual ao que já foi testado, o teste continua valendo. */
const generationKey = (draft: Draft) => JSON.stringify([draft.seed, draft.seconds, draft.order, draft.verseText.trim().split(/\s+/), draft.forks, draft.powers]);

function defOf(draft: Draft, slug = 'teste'): CampaignLevelDef {
  return { id: slug, name: draft.name.trim() || 'Fase', seed: Number(draft.seed), seconds: Number(draft.seconds), order: draft.order, ref: draft.verseRef.trim(), verse: draft.verseText, forks: draft.forks, powers: draft.powers };
}

function validate(draft: Draft): Errors {
  const errors: Errors = {};
  if (!draft.scenarioId) errors.scenarioId = 'Escolha o cenário.';
  const found = validateLevelDef(defOf(draft));
  if (!draft.name.trim()) errors.name = 'Informe o nome da fase.';
  else if (draft.name.trim().length > 80) errors.name = 'Use no máximo 80 caracteres.';
  for (const key of ['seed', 'seconds', 'order'] as const) if (found[key]) errors[key] = found[key];
  if (found.ref) errors.verseRef = found.ref;
  if (found.verse) errors.verseText = found.verse;
  const sortOrder = Number(draft.sortOrder);
  if (!Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 999) errors.sortOrder = 'Use um número inteiro de 0 a 999.';
  return errors;
}

/** Painel → Corrida → Fases: cada fase é uma semente, uma duração, a ordem das formas e um versículo; "Testar fase" joga com o bot antes de publicar. */
export function RunnerLevelsScreen() {
  const toast = useToast();
  const { confirm } = useDialogs();
  const [search, setSearch] = useState('');
  const query = useDebouncedValue(search.trim());
  const [scenarioFilter, setScenarioFilter] = useState('');
  const [scenarios, setScenarios] = useState<Array<{ id: number; name: string }>>([]);
  const list = usePagedList(listAdminRunnerLevels, { q: query || undefined, scenarioId: scenarioFilter || undefined }, 10);
  const [editing, setEditing] = useState<{ id: number | null; slug: string | null; draft: Draft; startKey: string } | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const test = useLevelTest();
  // Resultado do teste e a fase (parâmetros) a que ele se refere.
  const [tested, setTested] = useState<{ key: string; outcome: LevelTestOutcome } | null>(null);

  useEffect(() => {
    runnerScenarioOptions()
      .then(setScenarios)
      .catch((reason) => toast.error(errorMessage(reason)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scenarioOptions = useMemo(() => scenarios.map((item) => ({ value: String(item.id), label: item.name })), [scenarios]);

  function open(level?: RunnerLevelDto) {
    setErrors({});
    setTested(null);
    const draft = level ? draftOf(level) : emptyDraft(scenarioFilter || (scenarios[0] ? String(scenarios[0].id) : ''));
    setEditing({ id: level?.id ?? null, slug: level?.slug ?? null, draft, startKey: level ? generationKey(draft) : '' });
  }

  function change(patch: Partial<Draft>) {
    setEditing((current) => (current ? { ...current, draft: { ...current.draft, ...patch } } : current));
  }

  async function runTest() {
    if (!editing) return;
    const found = validate(editing.draft);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error('Confira os campos destacados.');
      return;
    }
    try {
      const outcome = await test.run(defOf(editing.draft, editing.slug ?? 'teste'));
      setTested({ key: generationKey(editing.draft), outcome });
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  async function save() {
    if (!editing) return;
    const { draft } = editing;
    const found = validate(draft);
    // Fase ativa só vale se for possível: testada com o bot (ou igual à que já estava publicada e testada).
    const key = generationKey(draft);
    if (draft.active && key !== editing.startKey && !(tested?.key === key && tested.outcome.ok)) found.active = 'Teste a fase (e ela precisa passar) antes de ativá-la.';
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error('Confira os campos destacados.');
      return;
    }
    setSaving(true);
    try {
      const input = {
        scenarioId: Number(draft.scenarioId),
        name: draft.name.trim(),
        seed: Number(draft.seed),
        seconds: Number(draft.seconds),
        order: draft.order,
        verseRef: draft.verseRef.trim(),
        verseText: verseWords(draft.verseText).join(' '),
        forks: draft.forks,
        powers: draft.powers,
        active: draft.active,
        sortOrder: Number(draft.sortOrder),
      };
      if (editing.id === null) await createRunnerLevel(input);
      else await updateRunnerLevel(editing.id, input);
      toast.success('Fase salva.');
      setEditing(null);
      list.reload();
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function remove(level: RunnerLevelDto) {
    const ok = await confirm({ title: `Excluir a fase ${level.name}?`, message: 'A fase some da campanha. O progresso dos jogadores nela deixa de contar.', confirmLabel: 'Excluir', tone: 'danger' });
    if (!ok) return;
    try {
      await deleteRunnerLevel(level.id);
      toast.success('Fase excluída.');
      list.reload();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  const draft = editing?.draft;
  const words = draft ? verseWords(draft.verseText).length : 0;
  const currentKey = draft ? generationKey(draft) : '';
  const result = tested && tested.key === currentKey ? tested.outcome : null;

  return (
    <AdminPanel
      title="Fases da Corrida"
      description="Cada fase é montada pela semente: a mesma semente dá sempre a mesma fase. Escolha a duração, a ordem das formas (Corrida, Voo, Gravidade) e o versículo escondido. Antes de ativar, use “Testar fase”: o bot joga a fase inteira para provar que ela é possível."
      actions={
        <Button onClick={() => open()} disabled={scenarios.length === 0}>
          <AddRoundedIcon fontSize="small" /> Nova fase
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome da fase" label="Buscar fase" />
        <Select
          value={scenarioFilter}
          onChange={setScenarioFilter}
          options={[{ value: '', label: 'Todos os cenários' }, ...scenarioOptions]}
          aria-label="Filtrar por cenário"
        />
      </div>
      {list.error ? <Alert tone="danger">{list.error}</Alert> : null}
      {list.loading && list.items.length === 0 ? <LoadingState label="Carregando fases..." /> : null}
      <ul className="space-y-3">
        {list.items.map((level) => (
          <li key={level.id} className={cn('flex flex-wrap items-center gap-3 rounded-2xl border-2 border-edge bg-surface-2 p-3', !level.active && 'opacity-70')}>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-display text-base font-bold text-ink">
                {level.name}
                <StatusBadge active={level.active} />
                {level.system ? <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs font-bold text-muted">Padrão</span> : null}
              </p>
              <p className="text-sm font-semibold text-muted">
                {level.scenarioName} · {level.seconds} s · {level.order.map((form) => FORM_LABEL[form]).join(' → ')} · {level.verseRef}
              </p>
              <p className="text-xs font-semibold text-muted">
                Identificador: <code>{level.slug}</code> (use no personagem que esta fase abre)
              </p>
            </div>
            <div className="flex items-center gap-1">
              <IconAction label="Editar" onClick={() => open(level)}>
                <EditRoundedIcon fontSize="small" />
              </IconAction>
              <IconAction label={level.system ? 'As padrão não podem ser excluídas (desative)' : 'Excluir'} tone="danger" disabled={level.system} onClick={() => void remove(level)}>
                <DeleteOutlineRoundedIcon fontSize="small" />
              </IconAction>
            </div>
          </li>
        ))}
      </ul>
      {!list.loading && list.items.length === 0 && !list.error ? <p className="text-sm font-semibold text-muted">Nenhuma fase encontrada.</p> : null}
      <Pagination page={list.page} totalPages={list.totalPages} totalElements={list.totalElements} pageSize={list.size} onPageChange={list.setPage} onPageSizeChange={list.setSize} itemLabel="fases" />

      <Modal
        open={Boolean(editing)}
        onClose={saving ? undefined : () => setEditing(null)}
        size="xl"
        title={editing?.id === null ? 'Nova fase' : 'Editar fase'}
        description="Fase nova começa inativa: teste, e quando passar, ative."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => void save()} loading={saving}>
              Salvar
            </Button>
          </>
        }
      >
        {draft ? (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cenário" required error={errors.scenarioId} htmlFor="level-scenario">
                <Select id="level-scenario" value={draft.scenarioId} onChange={(scenarioId) => change({ scenarioId })} options={scenarioOptions} placeholder="Escolha o cenário" searchable aria-label="Cenário da fase" />
              </Field>
              <Field label="Nome da fase" required error={errors.name} htmlFor="level-name">
                <Input id="level-name" value={draft.name} onChange={(event) => change({ name: event.target.value })} maxLength={80} />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Semente" hint="Mesma semente, mesma fase." error={errors.seed} htmlFor="level-seed">
                <div className="flex gap-2">
                  <Input id="level-seed" type="number" min={SEED_RANGE.min} max={SEED_RANGE.max} value={draft.seed} onChange={(event) => change({ seed: event.target.value })} />
                  <Button variant="ghost" aria-label="Sortear outra semente" onClick={() => change({ seed: String(randomSeed()) })}>
                    <ShuffleRoundedIcon fontSize="small" />
                  </Button>
                </div>
              </Field>
              <Field label="Duração (segundos)" hint={`De ${SECONDS_RANGE.min} a ${SECONDS_RANGE.max}.`} error={errors.seconds} htmlFor="level-seconds">
                <Input id="level-seconds" type="number" min={SECONDS_RANGE.min} max={SECONDS_RANGE.max} value={draft.seconds} onChange={(event) => change({ seconds: event.target.value })} />
              </Field>
              <Field label="Ordem na lista" hint="Dentro do cenário; menor vem primeiro." error={errors.sortOrder} htmlFor="level-order-number">
                <Input id="level-order-number" type="number" min={0} max={999} value={draft.sortOrder} onChange={(event) => change({ sortOrder: event.target.value })} />
              </Field>
            </div>

            <Field label="Formas, na ordem" hint={`A sequência se repete até completar a duração (até ${MAX_FORM_ORDER} trechos).`} error={errors.order}>
              <div className="space-y-2">
                <ol className="flex flex-wrap gap-2">
                  {draft.order.map((form, index) => (
                    <li key={`${form}-${index}`} className="inline-flex items-center gap-1 rounded-full bg-surface-3 py-1 pl-3 pr-1 text-sm font-bold text-ink">
                      {index + 1}. {FORM_LABEL[form]}
                      <button type="button" aria-label={`Remover ${FORM_LABEL[form]} da posição ${index + 1}`} onClick={() => change({ order: draft.order.filter((_, at) => at !== index) })} className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:text-ink">
                        <CloseRoundedIcon sx={{ fontSize: 16 }} />
                      </button>
                    </li>
                  ))}
                </ol>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(FORM_LABEL) as Form[]).map((form) => (
                    <Button key={form} size="sm" variant="ghost" disabled={draft.order.length >= MAX_FORM_ORDER} onClick={() => change({ order: [...draft.order, form] })}>
                      <AddRoundedIcon fontSize="small" /> {FORM_LABEL[form]}
                    </Button>
                  ))}
                </div>
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Referência do versículo" required error={errors.verseRef} htmlFor="level-ref" className="sm:col-span-1">
                <Input id="level-ref" value={draft.verseRef} onChange={(event) => change({ verseRef: event.target.value })} maxLength={60} placeholder="Salmos 23:1" />
              </Field>
              <Field label="Versículo" required hint={`${words} palavra${words === 1 ? '' : 's'}: cada uma é escondida pela fase e o jogador as pega correndo.`} error={errors.verseText} htmlFor="level-verse" className="sm:col-span-2">
                <Textarea id="level-verse" value={draft.verseText} onChange={(event) => change({ verseText: event.target.value })} maxLength={400} className="min-h-20" />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Switch checked={draft.forks} onChange={(forks) => change({ forks })} label="Caminhos diferentes" description="Bifurcações na corrida e pistas na gravidade." />
              <Switch checked={draft.powers} onChange={(powers) => change({ powers })} label="Poderes no caminho" description="Turbo, Escudo, Pulo triplo e Ímã." />
            </div>

            <div className="space-y-3 rounded-2xl border-2 border-edge bg-surface-2 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display text-base font-bold text-ink">Testar fase</p>
                  <p className="text-sm text-muted">O bot joga a fase inteira (perfeito e com o toque atrasado, como um dedo de verdade). Leva alguns segundos.</p>
                </div>
                <Button onClick={() => void runTest()} loading={test.running} variant="secondary">
                  <ScienceRoundedIcon fontSize="small" /> {test.step ? STEP_LABEL[test.step] : 'Testar fase'}
                </Button>
              </div>
              {result ? (
                <Alert tone={result.ok ? 'success' : 'danger'}>
                  {result.message}
                  {result.details.seconds > 0 ? ` Duração real: ${result.details.seconds} s · ${result.details.words} palavras (${result.details.wordsCollected} pegas pelo bot) · ${result.details.powers} poderes · ${result.details.forks} bifurcações.` : ''}
                </Alert>
              ) : null}
            </div>

            <Field label="Publicação" error={errors.active}>
              <Switch checked={draft.active} onChange={(active) => change({ active })} label="Ativa" description="Desativada, a fase some da campanha (não é excluída)." />
            </Field>
          </div>
        ) : null}
      </Modal>
    </AdminPanel>
  );
}
