import { useEffect, useState, type FormEvent } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ToggleOffRoundedIcon from '@mui/icons-material/ToggleOffRounded';
import ToggleOnRoundedIcon from '@mui/icons-material/ToggleOnRounded';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialogs';
import { Field } from '@/components/ui/field';
import { Input, Textarea } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { errorMessage, useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import {
  createQuestion,
  deleteQuestion,
  listCharacterOptions,
  listQuestions,
  updateQuestion,
  type AdminQuestion,
  type CharacterOption,
  type QuestionDifficulty,
  type QuestionPayload,
} from '@/lib/admin-api';
import { DIFFICULTY_LABELS, DIFFICULTY_TIME } from '@/lib/labels';
import { AdminPanel, Cell, DataTable, IconAction, Row, SearchInput, StatusBadge } from '../admin-ui';
import { useDebouncedValue, usePagedList } from '../use-paged-list';

const LETTERS = ['A', 'B', 'C', 'D'] as const;
type Letter = (typeof LETTERS)[number];

const difficultyTone: Record<QuestionDifficulty, 'success' | 'accent' | 'primary' | 'danger'> = {
  EASY: 'success',
  MEDIUM: 'accent',
  HARD: 'primary',
  VERY_HARD: 'danger',
};

let characterOptionsCache: Promise<CharacterOption[]> | null = null;

/** Personagens para os seletores (uma busca por visita ao painel). */
function useCharacterOptions() {
  const [options, setOptions] = useState<CharacterOption[]>([]);
  useEffect(() => {
    characterOptionsCache ??= listCharacterOptions().catch((error) => {
      characterOptionsCache = null;
      throw error;
    });
    characterOptionsCache.then(setOptions).catch(() => setOptions([]));
  }, []);
  return options;
}

/** Depois de criar/editar personagens a lista de opções precisa ser buscada de novo. */
export function invalidateCharacterOptions() {
  characterOptionsCache = null;
}

export function QuestionsScreen({ params }: { params: URLSearchParams }) {
  const { confirm } = useDialogs();
  const toast = useToast();
  const characters = useCharacterOptions();
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState(params.get('dificuldade') ?? '');
  const [characterId, setCharacterId] = useState(params.get('personagem') ?? '');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [editing, setEditing] = useState<{ question: AdminQuestion | null; duplicate?: boolean } | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  const list = usePagedList(listQuestions, { search: debouncedSearch, difficulty, characterId, status });
  const hasFilters = Boolean(search || difficulty || characterId || status);

  async function toggleActive(question: AdminQuestion) {
    try {
      await updateQuestion(question.id, { active: !question.active });
      toast.success(question.active ? 'Pergunta desativada (não entra mais nas partidas).' : 'Pergunta ativada.');
      list.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function remove(question: AdminQuestion) {
    const ok = await confirm({
      title: 'Excluir pergunta?',
      message: 'Ela será apagada de vez. Se quiser só tirar das partidas, desative em vez de excluir.',
      confirmLabel: 'Excluir',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteQuestion(question.id);
      toast.success('Pergunta excluída.');
      list.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <AdminPanel
      actions={
        <Button onClick={() => setEditing({ question: null })}>
          <AddRoundedIcon fontSize="small" />
          Nova pergunta
        </Button>
      }
    >
      <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1.2fr_1fr]">
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar no enunciado ou alternativas" label="Buscar pergunta" />
        <Select
          aria-label="Dificuldade"
          value={difficulty}
          onChange={setDifficulty}
          options={[{ value: '', label: 'Todas as dificuldades' }, ...(Object.keys(DIFFICULTY_LABELS) as QuestionDifficulty[]).map((item) => ({ value: item, label: DIFFICULTY_LABELS[item] }))]}
        />
        <Select
          aria-label="Personagem"
          searchable
          value={characterId}
          onChange={setCharacterId}
          options={[
            { value: '', label: 'Todos os personagens' },
            { value: 'none', label: 'Só perguntas gerais' },
            ...characters.map((character) => ({ value: String(character.id), label: character.name })),
          ]}
        />
        <Select
          aria-label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: '', label: 'Ativas e inativas' },
            { value: 'active', label: 'Só ativas' },
            { value: 'inactive', label: 'Só inativas' },
          ]}
        />
      </div>
      {hasFilters ? (
        <button
          type="button"
          className="text-sm font-bold text-primary-strong hover:underline dark:text-primary"
          onClick={() => {
            setSearch('');
            setDifficulty('');
            setCharacterId('');
            setStatus('');
          }}
        >
          Limpar filtros
        </button>
      ) : null}

      <DataTable
        columns={[{ label: 'Pergunta' }, { label: 'Personagem' }, { label: 'Dificuldade' }, { label: 'Status' }, { label: 'Ações', className: 'w-44 text-right' }]}
        loading={list.loading}
        error={list.error}
        isEmpty={list.items.length === 0}
        empty={hasFilters ? 'Nenhuma pergunta com esses filtros.' : 'Nenhuma pergunta ainda.'}
      >
        {list.items.map((question) => {
          const correct = question[`option${question.correctOption as Letter}` as const];
          return (
            <Row key={question.id} onClick={() => setEditing({ question })}>
              <Cell className="max-w-md">
                <p className="line-clamp-2 font-semibold text-ink">{question.text}</p>
                <p className="mt-0.5 truncate text-xs text-success-strong dark:text-success">
                  <CheckRoundedIcon sx={{ fontSize: 14 }} /> {question.correctOption}) {correct}
                </p>
              </Cell>
              <Cell>{question.relatedCharacterName ?? <span className="text-muted">Geral</span>}</Cell>
              <Cell>
                <Badge tone={difficultyTone[question.difficulty]}>{DIFFICULTY_LABELS[question.difficulty]}</Badge>
                <span className="ml-1 text-xs text-muted">{question.timeLimitSeconds}s</span>
              </Cell>
              <Cell>
                <StatusBadge active={question.active} on="Ativa" off="Inativa" />
              </Cell>
              <Cell className="text-right">
                <div className="flex justify-end gap-1">
                  <IconAction label="Editar" onClick={() => setEditing({ question })}>
                    <EditRoundedIcon fontSize="small" />
                  </IconAction>
                  <IconAction label="Duplicar" onClick={() => setEditing({ question, duplicate: true })}>
                    <ContentCopyRoundedIcon fontSize="small" />
                  </IconAction>
                  <IconAction label={question.active ? 'Desativar' : 'Ativar'} onClick={() => void toggleActive(question)}>
                    {question.active ? <ToggleOnRoundedIcon fontSize="small" /> : <ToggleOffRoundedIcon fontSize="small" />}
                  </IconAction>
                  <IconAction label="Excluir" tone="danger" onClick={() => void remove(question)}>
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconAction>
                </div>
              </Cell>
            </Row>
          );
        })}
      </DataTable>

      <Pagination
        page={list.page}
        totalPages={list.totalPages}
        totalElements={list.totalElements}
        pageSize={list.size}
        onPageChange={list.setPage}
        onPageSizeChange={list.setSize}
        itemLabel="perguntas"
      />

      {editing ? (
        <QuestionEditorModal
          question={editing.question}
          duplicate={editing.duplicate}
          defaultCharacterId={characterId && characterId !== 'none' ? Number(characterId) : null}
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

type QuestionForm = {
  text: string;
  difficulty: QuestionDifficulty;
  timeLimitSeconds: string;
  options: Record<Letter, string>;
  correctOption: Letter;
  relatedCharacterId: string;
  explanation: string;
  bibleReference: string;
  active: boolean;
};

function initialForm(question: AdminQuestion | null, defaultCharacterId?: number | null): QuestionForm {
  if (!question) {
    return {
      text: '',
      difficulty: 'EASY',
      timeLimitSeconds: String(DIFFICULTY_TIME.EASY),
      options: { A: '', B: '', C: '', D: '' },
      correctOption: 'A',
      relatedCharacterId: defaultCharacterId ? String(defaultCharacterId) : '',
      explanation: '',
      bibleReference: '',
      active: true,
    };
  }
  return {
    text: question.text,
    difficulty: question.difficulty,
    timeLimitSeconds: String(question.timeLimitSeconds),
    options: { A: question.optionA, B: question.optionB, C: question.optionC, D: question.optionD },
    correctOption: (question.correctOption as Letter) ?? 'A',
    relatedCharacterId: question.relatedCharacterId ? String(question.relatedCharacterId) : '',
    explanation: question.explanation ?? '',
    bibleReference: question.bibleReference ?? '',
    active: question.active,
  };
}

/** Criar, editar ou duplicar uma pergunta. Usado na tela de perguntas e no editor de personagem. */
export function QuestionEditorModal({
  question,
  duplicate = false,
  defaultCharacterId,
  onClose,
  onSaved,
}: {
  question: AdminQuestion | null;
  duplicate?: boolean;
  defaultCharacterId?: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const characters = useCharacterOptions();
  const [form, setForm] = useState<QuestionForm>(() => initialForm(question, defaultCharacterId));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  // Enquanto o admin não mexer no tempo, ele acompanha a dificuldade.
  const [timeTouched, setTimeTouched] = useState(Boolean(question));
  const isEdit = question !== null && !duplicate;

  function update<K extends keyof QuestionForm>(key: K, value: QuestionForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!form.text.trim()) found.text = 'Escreva o enunciado.';
    LETTERS.forEach((letter) => {
      if (!form.options[letter].trim()) found[`option${letter}`] = 'Preencha a alternativa.';
    });
    const filled = LETTERS.map((letter) => form.options[letter].trim().toLowerCase()).filter(Boolean);
    if (new Set(filled).size !== filled.length) found.options = 'As alternativas precisam ser diferentes entre si.';
    const time = Number(form.timeLimitSeconds);
    if (!Number.isInteger(time) || time < 5 || time > 120) found.timeLimitSeconds = 'Entre 5 e 120 segundos.';
    if (Object.values(found).some(Boolean)) {
      setErrors(found);
      return;
    }

    const payload: QuestionPayload = {
      text: form.text.trim(),
      difficulty: form.difficulty,
      timeLimitSeconds: time,
      optionA: form.options.A.trim(),
      optionB: form.options.B.trim(),
      optionC: form.options.C.trim(),
      optionD: form.options.D.trim(),
      correctOption: form.correctOption,
      relatedCharacterId: form.relatedCharacterId ? Number(form.relatedCharacterId) : null,
      explanation: form.explanation.trim() || null,
      bibleReference: form.bibleReference.trim() || null,
      active: form.active,
    };

    setSaving(true);
    try {
      if (isEdit && question) {
        await updateQuestion(question.id, payload);
        toast.success('Pergunta atualizada.');
      } else {
        await createQuestion(payload);
        toast.success(duplicate ? 'Cópia da pergunta criada.' : 'Pergunta criada.');
      }
      onSaved();
    } catch (error) {
      toast.error(errorMessage(error, 'Não foi possível salvar a pergunta.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      size="lg"
      title={isEdit ? 'Editar pergunta' : duplicate ? 'Duplicar pergunta' : 'Nova pergunta'}
      description="Toque na letra para marcar a alternativa correta."
      onClose={saving ? undefined : onClose}
    >
      <form className="space-y-5" onSubmit={submit}>
        <Field label="Enunciado" required error={errors.text} aside={<span className="text-xs font-bold text-muted">{form.text.length}/300</span>}>
          <Textarea value={form.text} onChange={(event) => update('text', event.target.value)} maxLength={300} placeholder="Ex.: Quem derrotou o gigante Golias?" className="min-h-24" />
        </Field>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-bold text-muted">
            Alternativas<span className="ml-0.5 text-danger">*</span>
          </legend>
          {LETTERS.map((letter) => {
            const correct = form.correctOption === letter;
            return (
              <div key={letter} className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => update('correctOption', letter)}
                  aria-pressed={correct}
                  aria-label={`Marcar ${letter} como correta`}
                  className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 font-display text-lg font-bold transition',
                    correct ? 'border-success-strong bg-success text-white' : 'border-edge bg-surface-2 text-muted hover:border-success',
                  )}
                >
                  {correct ? <CheckRoundedIcon /> : letter}
                </button>
                <div className="flex-1">
                  <Input
                    value={form.options[letter]}
                    onChange={(event) => {
                      setForm((current) => ({ ...current, options: { ...current.options, [letter]: event.target.value } }));
                      setErrors((current) => ({ ...current, [`option${letter}`]: '', options: '' }));
                    }}
                    placeholder={`Alternativa ${letter}${correct ? ' (correta)' : ''}`}
                    aria-label={`Alternativa ${letter}`}
                    maxLength={200}
                    className={correct ? 'border-success/60' : undefined}
                  />
                  {errors[`option${letter}`] ? <span className="text-xs font-semibold text-danger">{errors[`option${letter}`]}</span> : null}
                </div>
              </div>
            );
          })}
          {errors.options ? <p className="text-sm font-semibold text-danger">{errors.options}</p> : null}
        </fieldset>

        <div className="grid gap-5 md:grid-cols-[1fr_auto]">
          <Field label="Dificuldade">
            <Segmented<QuestionDifficulty>
              aria-label="Dificuldade"
              value={form.difficulty}
              onChange={(value) => {
                update('difficulty', value);
                if (!timeTouched) update('timeLimitSeconds', String(DIFFICULTY_TIME[value]));
              }}
              options={(Object.keys(DIFFICULTY_LABELS) as QuestionDifficulty[]).map((item) => ({ value: item, label: DIFFICULTY_LABELS[item] }))}
            />
          </Field>
          <Field label="Tempo (s)" error={errors.timeLimitSeconds}>
            <Input
              type="number"
              min={5}
              max={120}
              value={form.timeLimitSeconds}
              onChange={(event) => {
                setTimeTouched(true);
                update('timeLimitSeconds', event.target.value);
              }}
              className="md:w-28"
            />
          </Field>
        </div>

        <Field label="Personagem" hint="Perguntas de um personagem aparecem no estudo dele e também no quiz geral.">
          <Select
            aria-label="Personagem relacionado"
            searchable
            value={form.relatedCharacterId}
            onChange={(value) => update('relatedCharacterId', value)}
            options={[{ value: '', label: 'Pergunta geral (sem personagem)' }, ...characters.map((character) => ({ value: String(character.id), label: character.name, description: character.published ? undefined : 'Rascunho' }))]}
          />
        </Field>

        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Explicação" hint="Mostrada depois da resposta, para o jogador aprender.">
            <Textarea value={form.explanation} onChange={(event) => update('explanation', event.target.value)} maxLength={2000} placeholder="Ex.: Davi venceu Golias com uma funda e uma pedra." className="min-h-24" />
          </Field>
          <Field label="Referência bíblica" hint="Onde ler a resposta.">
            <Input value={form.bibleReference} onChange={(event) => update('bibleReference', event.target.value)} maxLength={200} placeholder="Ex.: 1 Samuel 17:49" />
          </Field>
        </div>

        <Switch checked={form.active} onChange={(value) => update('active', value)} label="Pergunta ativa" description="Só perguntas ativas entram nas partidas." />

        <div className="flex flex-wrap justify-end gap-3 border-t border-edge pt-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            {saving ? 'Salvando...' : isEdit ? 'Salvar pergunta' : 'Criar pergunta'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
