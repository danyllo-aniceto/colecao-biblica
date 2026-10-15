import { useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { Alert } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialogs';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { LoadingState } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { errorMessage, useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { createRunnerScenario, deleteRunnerScenario, listAdminRunnerScenarios, updateRunnerScenario, type RunnerScenarioDto, type RunnerScenarioInput } from '@/lib/runner-api';
import { isHexColor } from '@runner/characters';
import { ART_KEYS, type ArtKey } from '@runner/types';
import { AdminPanel, IconAction, SearchInput, StatusBadge } from '../admin-ui';
import { AudioUploadField } from '../audio-upload-field';
import { ImageUploadField } from '../image-upload-field';
import { useDebouncedValue, usePagedList } from '../use-paged-list';

const ART_INFO: Record<ArtKey, { label: string; hint: string }> = {
  far: { label: 'Fundo: camada de longe', hint: 'Céu, montanhas ao longe. Anda bem devagar. A imagem se repete na horizontal: faça as pontas se encontrarem.' },
  mid: { label: 'Fundo: camada do meio', hint: 'Colinas, muros, árvores. Anda numa velocidade média. Fundo transparente na parte de cima.' },
  near: { label: 'Fundo: camada de perto', hint: 'Detalhes próximos (plantas, pedras). Anda mais rápido. Fundo transparente.' },
  spike: { label: 'Obstáculo: espeto', hint: 'Imagem quadrada com a ponta para cima (o jogo vira para o teto). Fundo transparente.' },
  block: { label: 'Obstáculo: bloco', hint: 'Imagem quadrada que se repete em cada casa do bloco (pedra, tijolo, plataforma).' },
};

type Draft = { name: string; story: string; skyTop: string; skyBottom: string; art: Record<ArtKey, string>; musicUrl: string; active: boolean; sortOrder: string };
type Errors = Record<string, string>;

const emptyDraft = (): Draft => ({ name: '', story: '', skyTop: '#0f172a', skyBottom: '#1e3a5f', art: { far: '', mid: '', near: '', spike: '', block: '' }, musicUrl: '', active: true, sortOrder: '100' });

function draftOf(scenario: RunnerScenarioDto): Draft {
  return {
    name: scenario.name,
    story: scenario.story ?? '',
    skyTop: scenario.skyTop,
    skyBottom: scenario.skyBottom,
    art: { far: scenario.art.far ?? '', mid: scenario.art.mid ?? '', near: scenario.art.near ?? '', spike: scenario.art.spike ?? '', block: scenario.art.block ?? '' },
    musicUrl: scenario.musicUrl ?? '',
    active: scenario.active,
    sortOrder: String(scenario.sortOrder),
  };
}

function validate(draft: Draft): Errors {
  const errors: Errors = {};
  if (!draft.name.trim()) errors.name = 'Informe o nome do cenário.';
  else if (draft.name.trim().length > 60) errors.name = 'Use no máximo 60 caracteres.';
  if (draft.story.trim().length > 300) errors.story = 'Use no máximo 300 caracteres.';
  if (!isHexColor(draft.skyTop.trim())) errors.skyTop = 'Use uma cor no formato #RRGGBB.';
  if (!isHexColor(draft.skyBottom.trim())) errors.skyBottom = 'Use uma cor no formato #RRGGBB.';
  const order = Number(draft.sortOrder);
  if (!Number.isInteger(order) || order < 0 || order > 999) errors.sortOrder = 'Use um número inteiro de 0 a 999.';
  return errors;
}

function toInput(draft: Draft): RunnerScenarioInput & { name: string } {
  return {
    name: draft.name.trim(),
    story: draft.story.trim() || null,
    skyTop: draft.skyTop.trim(),
    skyBottom: draft.skyBottom.trim(),
    // Imagem vazia vira null: remove do cenário.
    art: Object.fromEntries(ART_KEYS.map((key) => [key, draft.art[key].trim() || null])),
    musicUrl: draft.musicUrl.trim() || null,
    active: draft.active,
    sortOrder: Number(draft.sortOrder),
  };
}

/** Painel → Corrida → Cenários: lugar da Bíblia com céu, fundo em 3 camadas, obstáculos em imagem e trilha. As fases ficam em "Corrida: fases". */
export function RunnerScenariosScreen() {
  const toast = useToast();
  const { confirm } = useDialogs();
  const [search, setSearch] = useState('');
  const query = useDebouncedValue(search.trim());
  const list = usePagedList(listAdminRunnerScenarios, { q: query || undefined }, 10);
  const [editing, setEditing] = useState<{ id: number | null; draft: Draft } | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  function open(scenario?: RunnerScenarioDto) {
    setErrors({});
    setEditing({ id: scenario?.id ?? null, draft: scenario ? draftOf(scenario) : emptyDraft() });
  }

  function change(patch: Partial<Draft>) {
    setEditing((current) => (current ? { ...current, draft: { ...current.draft, ...patch } } : current));
  }

  async function save() {
    if (!editing) return;
    const found = validate(editing.draft);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      toast.error('Confira os campos destacados.');
      return;
    }
    setSaving(true);
    try {
      const input = toInput(editing.draft);
      if (editing.id === null) await createRunnerScenario(input);
      else await updateRunnerScenario(editing.id, input);
      toast.success('Cenário salvo.');
      setEditing(null);
      list.reload();
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function remove(scenario: RunnerScenarioDto) {
    const ok = await confirm({ title: `Excluir ${scenario.name}?`, message: 'O cenário some da campanha.', confirmLabel: 'Excluir', tone: 'danger' });
    if (!ok) return;
    try {
      await deleteRunnerScenario(scenario.id);
      toast.success('Cenário excluído.');
      list.reload();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  const draft = editing?.draft;
  return (
    <AdminPanel
      title="Cenários da Corrida"
      description="Cada cenário é um lugar da Bíblia com várias fases. A ordem aqui é a da campanha: o jogador abre o cenário seguinte ao concluir o anterior. Sem arte, o jogo desenha formas simples nas cores do céu."
      actions={
        <Button onClick={() => open()}>
          <AddRoundedIcon fontSize="small" /> Novo cenário
        </Button>
      }
    >
      <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome" label="Buscar cenário" />
      {list.error ? <Alert tone="danger">{list.error}</Alert> : null}
      {list.loading && list.items.length === 0 ? <LoadingState label="Carregando cenários..." /> : null}
      <ul className="space-y-3">
        {list.items.map((scenario) => {
          const arts = ART_KEYS.filter((key) => scenario.art[key]).length;
          return (
            <li key={scenario.id} className={cn('flex flex-wrap items-center gap-3 rounded-2xl border-2 border-edge bg-surface-2 p-3', !scenario.active && 'opacity-70')}>
              <span className="h-14 w-14 shrink-0 rounded-2xl border-2 border-edge" style={{ background: `linear-gradient(${scenario.skyTop}, ${scenario.skyBottom})` }} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-display text-base font-bold text-ink">
                  {scenario.name}
                  <StatusBadge active={scenario.active} />
                  {scenario.system ? <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs font-bold text-muted">Padrão</span> : null}
                </p>
                <p className="text-sm font-semibold text-muted">
                  {scenario.levelCount} fase{scenario.levelCount === 1 ? '' : 's'} · {arts} de {ART_KEYS.length} imagens · {scenario.musicUrl ? 'com trilha' : 'sem trilha'} · ordem {scenario.sortOrder}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <IconAction label="Editar" onClick={() => open(scenario)}>
                  <EditRoundedIcon fontSize="small" />
                </IconAction>
                <IconAction label={scenario.system ? 'Os padrão não podem ser excluídos (desative)' : 'Excluir'} tone="danger" disabled={scenario.system} onClick={() => void remove(scenario)}>
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconAction>
              </div>
            </li>
          );
        })}
      </ul>
      {!list.loading && list.items.length === 0 && !list.error ? <p className="text-sm font-semibold text-muted">Nenhum cenário encontrado.</p> : null}
      <Pagination page={list.page} totalPages={list.totalPages} totalElements={list.totalElements} pageSize={list.size} onPageChange={list.setPage} onPageSizeChange={list.setSize} itemLabel="cenários" />

      <Modal
        open={Boolean(editing)}
        onClose={saving ? undefined : () => setEditing(null)}
        size="xl"
        title={editing?.id === null ? 'Novo cenário' : 'Editar cenário'}
        description="Nome e cores bastam para começar; as imagens e a trilha podem ser enviadas aos poucos."
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
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome" required hint="Sempre um lugar: país, região, cidade, monte, templo..." error={errors.name} htmlFor="scenario-name">
                <Input id="scenario-name" value={draft.name} onChange={(event) => change({ name: event.target.value })} maxLength={60} />
              </Field>
              <Field label="Ordem na campanha" hint="Menor vem primeiro." error={errors.sortOrder} htmlFor="scenario-order">
                <Input id="scenario-order" type="number" min={0} max={999} value={draft.sortOrder} onChange={(event) => change({ sortOrder: event.target.value })} />
              </Field>
            </div>
            <Field label="História" hint="Frase curta que aparece no cartão do cenário." error={errors.story} htmlFor="scenario-story">
              <Textarea id="scenario-story" value={draft.story} onChange={(event) => change({ story: event.target.value })} maxLength={300} className="min-h-20" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Céu: cor de cima" error={errors.skyTop} htmlFor="scenario-sky-top">
                <Input id="scenario-sky-top" value={draft.skyTop} onChange={(event) => change({ skyTop: event.target.value })} maxLength={7} />
              </Field>
              <Field label="Céu: cor de baixo" error={errors.skyBottom} htmlFor="scenario-sky-bottom">
                <Input id="scenario-sky-bottom" value={draft.skyBottom} onChange={(event) => change({ skyBottom: event.target.value })} maxLength={7} />
              </Field>
              <div className="space-y-1">
                <span className="text-sm font-bold text-ink">Prévia</span>
                <div className="h-11 rounded-xl border-2 border-edge" style={{ background: `linear-gradient(${isHexColor(draft.skyTop.trim()) ? draft.skyTop.trim() : '#000'}, ${isHexColor(draft.skyBottom.trim()) ? draft.skyBottom.trim() : '#000'})` }} aria-hidden="true" />
              </div>
            </div>
            <Switch checked={draft.active} onChange={(active) => change({ active })} label="Ativo" description="Desativado, o cenário some da campanha (não é excluído). Só aparece com pelo menos uma fase ativa." />

            <section className="space-y-3">
              <h3 className="font-display text-lg font-bold text-ink">Imagens</h3>
              <ul className="grid gap-4 lg:grid-cols-2">
                {ART_KEYS.map((key) => (
                  <li key={key} className="space-y-2 rounded-2xl border-2 border-edge bg-surface-2 p-3">
                    <div>
                      <p className="font-display text-base font-bold text-ink">{ART_INFO[key].label}</p>
                      <p className="text-xs font-semibold text-muted">{ART_INFO[key].hint}</p>
                    </div>
                    <ImageUploadField value={draft.art[key]} onChange={(url) => change({ art: { ...draft.art, [key]: url } })} wide={key === 'far' || key === 'mid' || key === 'near'} />
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-bold text-ink">Trilha do cenário</h3>
              <p className="text-sm text-muted">Toca em repetição durante as fases deste cenário. Opcional.</p>
              <div className="rounded-2xl border-2 border-edge bg-surface-2 p-3">
                <AudioUploadField value={draft.musicUrl} onChange={(musicUrl) => change({ musicUrl })} />
              </div>
            </section>
          </div>
        ) : null}
      </Modal>
    </AdminPanel>
  );
}
