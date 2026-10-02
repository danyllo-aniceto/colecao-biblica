import { useEffect, useState, type FormEvent } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import ToggleOffRoundedIcon from '@mui/icons-material/ToggleOffRounded';
import ToggleOnRoundedIcon from '@mui/icons-material/ToggleOnRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
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
import { Tooltip } from '@/components/ui/tooltip';
import {
  applySuggestedDifficulty,
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
import { DIFFICULTY_LABELS, DIFFICULTY_TIME, accuracy } from '@/lib/labels';
import { ImportQuestionsModal } from './import-questions-modal';
import { AdminPanel, Cell, DataTable, IconAction, Row, SearchInput, StatusBadge } from '../admin-ui';
import { useScenarioOptions } from '../use-scenario-options';
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
  const scenarios = useScenarioOptions();
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState(params.get('dificuldade') ?? '');
  const [characterId, setCharacterId] = useState(params.get('personagem') ?? '');
  const [scenarioId, setScenarioId] = useState('');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [review, setReview] = useState(params.get('revisar') ?? '');
  const [importing, setImporting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [editing, setEditing] = useState<{ question: AdminQuestion | null; duplicate?: boolean } | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  const list = usePagedList(listQuestions, {
    search: debouncedSearch,
    difficulty,
    characterId,
    scenarioId,
    status,
    calibration: review === 'calibration' ? 'mismatch' : '',
    reported: review === 'reported' ? 'open' : '',
  });
  const hasFilters = Boolean(search || difficulty || characterId || scenarioId || status || review);

  async function applySuggestions() {
    const ids = list.items.filter((question) => question.suggestedDifficulty && question.suggestedDifficulty !== question.difficulty).map((question) => question.id);
    if (ids.length === 0) return;
    const ok = await confirm({
      title: `Ajustar ${ids.length} pergunta(s)?`,
      message: 'A dificuldade (e o tempo padrão dela) passa a ser a sugerida pela taxa de acerto dos jogadores.',
      confirmLabel: 'Aplicar sugestões',
    });
    if (!ok) return;
    setApplying(true);
    try {
      const result = await applySuggestedDifficulty(ids);
      toast.success(`${result.updated} pergunta(s) recalibrada(s).`);
      list.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setApplying(false);
    }
  }

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
        <>
          <Button variant="secondary" onClick={() => setImporting(true)}>
            <UploadFileRoundedIcon fontSize="small" />
            Importar planilha
          </Button>
          <Button onClick={() => setEditing({ question: null })}>
            <AddRoundedIcon fontSize="small" />
            Nova pergunta
          </Button>
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1.2fr_1fr_1.1fr]">
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
          aria-label="Cenário"
          searchable
          value={scenarioId}
          onChange={setScenarioId}
          options={[{ value: '', label: 'Todos os cenários' }, { value: 'none', label: 'Sem cenário' }, ...scenarios]}
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
        <Select
          aria-label="Revisão"
          value={review}
          onChange={setReview}
          options={[
            { value: '', label: 'Sem filtro de revisão' },
            { value: 'calibration', label: 'Dificuldade a revisar', description: 'A taxa de acerto não bate com a dificuldade' },
            { value: 'reported', label: 'Reportadas pelos jogadores' },
          ]}
        />
      </div>
      {review === 'calibration' && list.items.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-info/10 p-3 text-sm text-info-strong dark:text-info">
          <span>Perguntas com 20+ respostas cuja taxa de acerto sugere outra dificuldade.</span>
          <Button size="sm" onClick={() => void applySuggestions()} loading={applying}>
            <TuneRoundedIcon fontSize="small" />
            Aplicar sugestões desta página
          </Button>
        </div>
      ) : null}
      {hasFilters ? (
        <button
          type="button"
          className="text-sm font-bold text-primary-strong hover:underline dark:text-primary"
          onClick={() => {
            setSearch('');
            setDifficulty('');
            setCharacterId('');
            setStatus('');
            setReview('');
          }}
        >
          Limpar filtros
        </button>
      ) : null}

      <DataTable
        columns={[{ label: 'Pergunta' }, { label: 'Personagem' }, { label: 'Dificuldade' }, { label: 'Acerto' }, { label: 'Status' }, { label: 'Ações', className: 'w-44 text-right' }]}
        minWidth={860}
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
              <Cell>
                {question.relatedCharacterName ?? <span className="text-muted">Geral</span>}
                {question.scenarioName ? <span className="block text-xs font-semibold text-violet-strong dark:text-violet">{question.scenarioName}</span> : null}
              </Cell>
              <Cell>
                <Badge tone={difficultyTone[question.difficulty]}>{DIFFICULTY_LABELS[question.difficulty]}</Badge>
                <span className="ml-1 text-xs text-muted">{question.timeLimitSeconds}s</span>
              </Cell>
              <Cell>
                <AccuracyCell question={question} />
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

      {importing ? (
        <ImportQuestionsModal
          onClose={() => setImporting(false)}
          onImported={() => {
            setImporting(false);
            list.reload();
          }}
        />
      ) : null}

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

/** Taxa de acerto da pergunta e, quando houver, a dificuldade sugerida. */
function AccuracyCell({ question }: { question: AdminQuestion }) {
  const rate = accuracy(question.timesAnswered, question.timesCorrect);
  if (rate === null) return <span className="text-xs text-muted">Sem respostas</span>;
  const suggestion = question.suggestedDifficulty && question.suggestedDifficulty !== question.difficulty ? question.suggestedDifficulty : null;
  return (
    <div className="space-y-1">
      <span className="font-display font-bold text-ink">{rate}%</span>
      <span className="ml-1 text-xs text-muted">de {question.timesAnswered}</span>
      {suggestion ? (
        <Tooltip content="Sugestão pela taxa de acerto (20+ respostas)">
          <span tabIndex={0} className="block">
            <Badge tone="violet">Sugerida: {DIFFICULTY_LABELS[suggestion]}</Badge>
          </span>
        </Tooltip>
      ) : null}
    </div>
  );
}

type QuestionForm = {
  text: string;
  difficulty: QuestionDifficulty;
  timeLimitSeconds: string;
  options: Record<Letter, string>;
  correctOption: Letter;
  relatedCharacterId: string;
  scenarioId: string;
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
      scenarioId: '',
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
    scenarioId: question.scenarioId ? String(question.scenarioId) : '',
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
  const scenarios = useScenarioOptions();
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
      scenarioId: form.scenarioId ? Number(form.scenarioId) : null,
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

        <Field label="Cenário da campanha" hint="Quem está neste cenário recebe parte das perguntas dele no quiz geral.">
          <Select aria-label="Cenário" searchable value={form.scenarioId} onChange={(value) => update('scenarioId', value)} options={[{ value: '', label: 'Sem cenário' }, ...scenarios]} />
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
