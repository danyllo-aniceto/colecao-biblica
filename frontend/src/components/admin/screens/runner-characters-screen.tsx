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
import { createRunnerCharacter, deleteRunnerCharacter, listAdminRunnerCharacters, updateRunnerCharacter, type RunnerCharacterDto, type RunnerCharacterInput } from '@/lib/runner-api';
import { MAX_FRAMES, POSES, POSE_INFO, SOUND_INFO, SOUND_KEYS, isHexColor, type Pose, type SoundKey } from '@runner/characters';
import { portraitOf } from '@/components/user/corrida/corrida-characters';
import { SpriteView } from '@/components/user/corrida/sprite-view';
import { AdminPanel, IconAction, SearchInput, StatusBadge } from '../admin-ui';
import { AudioUploadField } from '../audio-upload-field';
import { FrameStripBuilder } from '../frame-strip-builder';
import { ImageUploadField } from '../image-upload-field';
import { Segmented } from '@/components/ui/segmented';
import { useDebouncedValue, usePagedList } from '../use-paged-list';

type Draft = {
  name: string;
  description: string;
  color: string;
  active: boolean;
  sortOrder: string;
  sprites: Record<Pose, { url: string; frames: string }>;
  sounds: Record<SoundKey, string>;
};
type Errors = Record<string, string>;

const SWATCHES = ['#38bdf8', '#f472b6', '#fb923c', '#c084fc', '#2dd4bf', '#facc15', '#ef4444', '#22c55e', '#6366f1', '#a3a3a3'];

const emptyDraft = (): Draft => ({
  name: '',
  description: '',
  color: SWATCHES[0],
  active: true,
  sortOrder: '100',
  sprites: Object.fromEntries(POSES.map((pose) => [pose, { url: '', frames: String(POSE_INFO[pose].defaultFrames) }])) as Draft['sprites'],
  sounds: Object.fromEntries(SOUND_KEYS.map((key) => [key, ''])) as Draft['sounds'],
});

function draftOf(character: RunnerCharacterDto): Draft {
  const draft = emptyDraft();
  draft.name = character.name;
  draft.description = character.description ?? '';
  draft.color = character.color;
  draft.active = character.active;
  draft.sortOrder = String(character.sortOrder);
  for (const pose of POSES) {
    const sheet = character.sprites[pose];
    if (sheet) draft.sprites[pose] = { url: sheet.url, frames: String(sheet.frames) };
  }
  for (const key of SOUND_KEYS) draft.sounds[key] = character.sounds[key] ?? '';
  return draft;
}

/** Valida antes de enviar: o erro aparece no próprio campo. */
function validate(draft: Draft): Errors {
  const errors: Errors = {};
  if (!draft.name.trim()) errors.name = 'Informe o nome do personagem.';
  else if (draft.name.trim().length > 60) errors.name = 'Use no máximo 60 caracteres.';
  if (draft.description.trim().length > 200) errors.description = 'Use no máximo 200 caracteres.';
  if (!isHexColor(draft.color.trim())) errors.color = 'Use uma cor no formato #RRGGBB (ex.: #38bdf8).';
  const order = Number(draft.sortOrder);
  if (!Number.isInteger(order) || order < 0 || order > 999) errors.sortOrder = 'Use um número inteiro de 0 a 999.';
  for (const pose of POSES) {
    const sheet = draft.sprites[pose];
    if (!sheet.url.trim()) continue;
    const frames = Number(sheet.frames);
    if (!Number.isInteger(frames) || frames < 1 || frames > MAX_FRAMES) errors[`frames-${pose}`] = `Quadros: de 1 a ${MAX_FRAMES}.`;
  }
  return errors;
}

function toInput(draft: Draft): RunnerCharacterInput & { name: string } {
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    color: draft.color.trim(),
    active: draft.active,
    sortOrder: Number(draft.sortOrder),
    // Pose sem imagem vira null: remove do personagem (no cadastro novo não faz nada).
    sprites: Object.fromEntries(POSES.map((pose) => [pose, draft.sprites[pose].url.trim() ? { url: draft.sprites[pose].url.trim(), frames: Number(draft.sprites[pose].frames) } : null])),
    sounds: Object.fromEntries(SOUND_KEYS.map((key) => [key, draft.sounds[key].trim() || null])),
  };
}

type Sheet = { url: string; frames: string };

/** Imagem de uma pose: montar a partir de quadros soltos (um arquivo por quadro) ou enviar uma tira já pronta. */
function PoseImageField({ pose, sheet, onChange }: { pose: Pose; sheet: Sheet; onChange: (sheet: Sheet) => void }) {
  const [mode, setMode] = useState<'frames' | 'strip'>(sheet.url ? 'strip' : 'frames');
  return (
    <div className="space-y-3">
      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'frames', label: 'Quadro por quadro' },
          { value: 'strip', label: 'Tira pronta' },
        ]}
        aria-label={`Como enviar a pose ${POSE_INFO[pose].label}`}
      />
      {mode === 'frames' ? (
        <FrameStripBuilder
          poseName={POSE_INFO[pose].label}
          fps={pose === 'idle' ? 5 : 8}
          onBuilt={(url, frames) => {
            onChange({ url, frames: String(frames) });
            setMode('strip');
          }}
        />
      ) : (
        <ImageUploadField value={sheet.url} onChange={(url) => onChange({ ...sheet, url })} />
      )}
    </div>
  );
}

/** Painel → Corrida → Personagens: nome, cor de reserva, sprites por pose (tira de quadros) e sons. Sem sprite, o app desenha a forma colorida. */
export function RunnerCharactersScreen() {
  const toast = useToast();
  const { confirm } = useDialogs();
  const [search, setSearch] = useState('');
  const query = useDebouncedValue(search.trim());
  const list = usePagedList(listAdminRunnerCharacters, { q: query || undefined }, 10);
  const [editing, setEditing] = useState<{ id: number | null; draft: Draft } | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  function open(character?: RunnerCharacterDto) {
    setErrors({});
    setEditing({ id: character?.id ?? null, draft: character ? draftOf(character) : emptyDraft() });
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
      if (editing.id === null) await createRunnerCharacter(input);
      else await updateRunnerCharacter(editing.id, input);
      toast.success('Personagem salvo.');
      setEditing(null);
      list.reload();
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setSaving(false);
    }
  }

  async function remove(character: RunnerCharacterDto) {
    const ok = await confirm({ title: `Excluir ${character.name}?`, message: 'O personagem some do jogo. Quem o tinha escolhido volta ao primeiro da lista.', confirmLabel: 'Excluir', tone: 'danger' });
    if (!ok) return;
    try {
      await deleteRunnerCharacter(character.id);
      toast.success('Personagem excluído.');
      list.reload();
    } catch (reason) {
      toast.error(errorMessage(reason));
    }
  }

  const draft = editing?.draft;
  return (
    <AdminPanel
      title="Personagens da Corrida"
      description="Envie cada pose quadro por quadro (uma imagem por quadro): o painel monta a animação, deixa todos na mesma escala com os pés na base e, se quiser, tira o fundo verde. Também aceita uma tira já pronta (quadros quadrados lado a lado). Sem sprite, o jogo desenha a forma na cor de reserva. Todos os personagens correm com a mesma física: o que muda é só a aparência e os sons."
      actions={
        <Button onClick={() => open()}>
          <AddRoundedIcon fontSize="small" /> Novo personagem
        </Button>
      }
    >
      <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome" label="Buscar personagem" />
      {list.error ? <Alert tone="danger">{list.error}</Alert> : null}
      {list.loading && list.items.length === 0 ? <LoadingState label="Carregando personagens..." /> : null}
      <ul className="space-y-3">
        {list.items.map((character) => {
          const sheet = portraitOf(character.sprites);
          const poses = POSES.filter((pose) => character.sprites[pose]).length;
          const sounds = SOUND_KEYS.filter((key) => character.sounds[key]).length;
          return (
            <li key={character.id} className={cn('flex flex-wrap items-center gap-3 rounded-2xl border-2 border-edge bg-surface-2 p-3', !character.active && 'opacity-70')}>
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${character.color}33` }}>
                <SpriteView url={sheet?.url} frames={sheet?.frames} fps={sheet?.fps} color={character.color} size={56} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-display text-base font-bold text-ink">
                  {character.name}
                  <StatusBadge active={character.active} />
                  {character.system ? <span className="rounded-full bg-surface-3 px-2 py-0.5 text-xs font-bold text-muted">Padrão</span> : null}
                </p>
                <p className="text-sm font-semibold text-muted">
                  {poses} de {POSES.length} poses · {sounds} de {SOUND_KEYS.length} sons · ordem {character.sortOrder}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <IconAction label="Editar" onClick={() => open(character)}>
                  <EditRoundedIcon fontSize="small" />
                </IconAction>
                <IconAction label={character.system ? 'Os padrão não podem ser excluídos (desative)' : 'Excluir'} tone="danger" disabled={character.system} onClick={() => void remove(character)}>
                  <DeleteOutlineRoundedIcon fontSize="small" />
                </IconAction>
              </div>
            </li>
          );
        })}
      </ul>
      {!list.loading && list.items.length === 0 && !list.error ? <p className="text-sm font-semibold text-muted">Nenhum personagem encontrado.</p> : null}
      <Pagination page={list.page} totalPages={list.totalPages} totalElements={list.totalElements} pageSize={list.size} onPageChange={list.setPage} onPageSizeChange={list.setSize} itemLabel="personagens" />

      <Modal
        open={Boolean(editing)}
        onClose={saving ? undefined : () => setEditing(null)}
        size="xl"
        title={editing?.id === null ? 'Novo personagem' : 'Editar personagem'}
        description="Preencha o nome e a cor; os sprites e os sons são opcionais e podem ser enviados aos poucos."
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
              <Field label="Nome" required error={errors.name} htmlFor="runner-name">
                <Input id="runner-name" value={draft.name} onChange={(event) => change({ name: event.target.value })} maxLength={60} />
              </Field>
              <Field label="Ordem na lista" hint="Menor aparece primeiro." error={errors.sortOrder} htmlFor="runner-order">
                <Input id="runner-order" type="number" min={0} max={999} value={draft.sortOrder} onChange={(event) => change({ sortOrder: event.target.value })} />
              </Field>
            </div>
            <Field label="Descrição" hint="Frase curta que aparece no cartão do personagem." error={errors.description} htmlFor="runner-description">
              <Textarea id="runner-description" value={draft.description} onChange={(event) => change({ description: event.target.value })} maxLength={200} className="min-h-20" />
            </Field>
            <Field label="Cor de reserva" required hint="Usada no quadrado do corredor enquanto falta o sprite." error={errors.color} htmlFor="runner-color">
              <div className="flex flex-wrap items-center gap-2">
                {SWATCHES.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    aria-label={`Cor ${swatch}`}
                    aria-pressed={draft.color.toLowerCase() === swatch}
                    onClick={() => change({ color: swatch })}
                    className={cn('h-9 w-9 rounded-xl border-2 transition', draft.color.toLowerCase() === swatch ? 'border-ink ring-2 ring-primary/40' : 'border-edge hover:border-ink/60')}
                    style={{ background: swatch }}
                  />
                ))}
                <Input id="runner-color" value={draft.color} onChange={(event) => change({ color: event.target.value })} className="w-32" maxLength={7} />
              </div>
            </Field>
            <Switch checked={draft.active} onChange={(active) => change({ active })} label="Ativo" description="Desativado, o personagem some do jogo (não é excluído)." />

            <section className="space-y-3">
              <h3 className="font-display text-lg font-bold text-ink">Sprites</h3>
              <ul className="grid gap-4 lg:grid-cols-2">
                {POSES.map((pose) => {
                  const sheet = draft.sprites[pose];
                  return (
                    <li key={pose} className="space-y-3 rounded-2xl border-2 border-edge bg-surface-2 p-3">
                      <div>
                        <p className="font-display text-base font-bold text-ink">{POSE_INFO[pose].label}</p>
                        <p className="text-xs font-semibold text-muted">{POSE_INFO[pose].hint}</p>
                      </div>
                      <PoseImageField pose={pose} sheet={sheet} onChange={(next) => change({ sprites: { ...draft.sprites, [pose]: next } })} />
                      {sheet.url ? (
                        <div className="flex flex-wrap items-end gap-4">
                          <Field label="Quadros" error={errors[`frames-${pose}`]} htmlFor={`runner-frames-${pose}`} className="w-28">
                            <Input id={`runner-frames-${pose}`} type="number" min={1} max={MAX_FRAMES} value={sheet.frames} onChange={(event) => change({ sprites: { ...draft.sprites, [pose]: { ...sheet, frames: event.target.value } } })} />
                          </Field>
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs font-bold text-muted">Prévia</span>
                            <span className="rounded-xl bg-surface-3 p-1">
                              <SpriteView url={sheet.url} frames={Number(sheet.frames) || 1} fps={pose === 'idle' ? 5 : 8} size={72} />
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg font-bold text-ink">Sons do personagem</h3>
              <p className="text-sm text-muted">Opcionais. Sem arquivo, toca o som padrão do modo. Sons curtos (menos de 2 segundos) funcionam melhor.</p>
              <ul className="grid gap-4 lg:grid-cols-2">
                {SOUND_KEYS.map((key) => (
                  <li key={key} className="space-y-2 rounded-2xl border-2 border-edge bg-surface-2 p-3">
                    <div>
                      <p className="font-display text-base font-bold text-ink">{SOUND_INFO[key].label}</p>
                      <p className="text-xs font-semibold text-muted">{SOUND_INFO[key].hint}</p>
                    </div>
                    <AudioUploadField value={draft.sounds[key]} onChange={(url) => change({ sounds: { ...draft.sounds, [key]: url } })} />
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}
      </Modal>
    </AdminPanel>
  );
}
