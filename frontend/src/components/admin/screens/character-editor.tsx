import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AutoStoriesRoundedIcon from '@mui/icons-material/AutoStoriesRounded';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChipInput, joinList, splitList } from '@/components/ui/chip-input';
import { useDialogs } from '@/components/ui/dialogs';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { RichContent } from '@/components/ui/rich-content';
import { clearRichTextEditorDrafts, RichTextEditor } from '@/components/ui/rich-text-editor';
import { Segmented } from '@/components/ui/segmented';
import { LoadingState } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { errorMessage, useToast } from '@/components/ui/toast';
import { sanitizeMermaidCode, validateMermaidSyntax } from '@/components/ui/mermaid-diagram';
import { Alert, ProgressBar } from '@/components/game/game-ui';
import { StickerCard } from '@/components/game/sticker-card';
import { sortBooks } from '@/lib/bible-books';
import { cn } from '@/lib/cn';
import {
  createCharacter,
  getCharacter,
  listQuestions,
  updateCharacter,
  type AdminCharacter,
  type AdminQuestion,
  type CharacterPayload,
  type StickerRarity,
  type Testament,
} from '@/lib/admin-api';
import { DIFFICULTY_LABELS, stripHtml } from '@/lib/labels';
import type { AdminNavigate } from '../admin-dashboard';
import { BibleBooksPicker, GENEALOGY_TEMPLATES, MermaidField, PeriodField, RarityPicker, TIMELINE_TEMPLATES } from './character-fields';
import { CharacterImageField } from './character-image-field';
import { invalidateCharacterOptions, QuestionEditorModal } from './questions-screen';

type Tab = 'identidade' | 'historia' | 'biblia' | 'diagramas';

type FormState = {
  name: string;
  rarity: StickerRarity;
  published: boolean;
  publishAt: string | null;
  testament: Testament | '';
  narrativeRole: string;
  historicalPeriod: string;
  imageUrl: string;
  shortSummary: string;
  fullDescription: string;
  curiosities: string;
  bibleReferences: string;
  bibleBooks: string[];
  keyVerses: string[];
  keywords: string[];
  genealogy: string;
  importantEvents: string;
};

type Errors = Partial<Record<keyof FormState, string>>;

const EMPTY: FormState = {
  name: '',
  rarity: 'COMMON',
  published: false,
  publishAt: null,
  testament: '',
  narrativeRole: '',
  historicalPeriod: '',
  imageUrl: '',
  shortSummary: '',
  fullDescription: '',
  curiosities: '',
  bibleReferences: '',
  bibleBooks: [],
  keyVerses: [],
  keywords: [],
  genealogy: '',
  importantEvents: '',
};

/** Em que aba cada campo fica (para levar o admin até o erro). */
const FIELD_TAB: Partial<Record<keyof FormState, Tab>> = {
  name: 'identidade',
  narrativeRole: 'identidade',
  shortSummary: 'historia',
  fullDescription: 'historia',
  genealogy: 'diagramas',
  importantEvents: 'diagramas',
};

const SUMMARY_LIMIT = 280;

function fromCharacter(character: AdminCharacter): FormState {
  return {
    name: character.name,
    rarity: character.rarity,
    published: character.published,
    publishAt: character.publishAt ?? null,
    testament: character.testament ?? '',
    // Antes eram campos de texto rico; agora são curtos (texto puro).
    narrativeRole: stripHtml(character.narrativeRole),
    historicalPeriod: stripHtml(character.historicalPeriod),
    imageUrl: character.imageUrl ?? '',
    shortSummary: character.shortSummary ?? '',
    fullDescription: character.fullDescription ?? '',
    curiosities: character.curiosities ?? '',
    bibleReferences: character.bibleReferences ?? '',
    bibleBooks: sortBooks(splitList(character.bibleBooks)),
    keyVerses: splitList(character.keyVerses),
    keywords: splitList(character.keywords),
    genealogy: character.genealogy ?? '',
    importantEvents: character.importantEvents ?? '',
  };
}

const orNull = (value: string) => (value.trim() && stripHtml(value) ? value.trim() : null);

function toPayload(form: FormState): CharacterPayload {
  return {
    name: form.name.trim(),
    rarity: form.rarity,
    published: form.published,
    publishAt: form.published ? form.publishAt : null,
    testament: form.testament || null,
    narrativeRole: orNull(form.narrativeRole),
    historicalPeriod: orNull(form.historicalPeriod),
    imageUrl: form.imageUrl.trim() || null,
    shortSummary: form.shortSummary,
    fullDescription: form.fullDescription,
    curiosities: orNull(form.curiosities),
    bibleReferences: orNull(form.bibleReferences),
    bibleBooks: form.bibleBooks.length ? joinList(sortBooks(form.bibleBooks)) : null,
    keyVerses: form.keyVerses.length ? joinList(form.keyVerses) : null,
    keywords: form.keywords.length ? joinList(form.keywords) : null,
    genealogy: sanitizeMermaidCode(form.genealogy) || null,
    importantEvents: sanitizeMermaidCode(form.importantEvents) || null,
  };
}

export function CharacterEditor({ characterId, onClose, onNavigate }: { characterId: number | null; onClose: () => void; onNavigate: AdminNavigate }) {
  const { confirm } = useDialogs();
  const toast = useToast();
  const draftKey = `${characterId ?? 'new'}:`;
  // Sem rascunhos antigos do editor de texto: abre sempre com o que está salvo.
  useState(() => clearRichTextEditorDrafts(draftKey));

  const [form, setForm] = useState<FormState>(EMPTY);
  const [saved, setSaved] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(characterId !== null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [tab, setTab] = useState<Tab>('identidade');
  const [questions, setQuestions] = useState<{ items: AdminQuestion[]; total: number } | null>(null);
  const [questionModal, setQuestionModal] = useState(false);
  const topRef = useRef<HTMLDivElement | null>(null);

  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);

  useEffect(() => {
    if (characterId === null) return;
    getCharacter(characterId)
      .then((character) => {
        const state = fromCharacter(character);
        setForm(state);
        setSaved(state);
      })
      .catch((error: unknown) => setLoadError(errorMessage(error, 'Não foi possível carregar o personagem.')))
      .finally(() => setLoading(false));
  }, [characterId]);

  useEffect(() => {
    if (characterId === null) return;
    listQuestions({ page: 0, size: 5, characterId: String(characterId) })
      .then((page) => setQuestions({ items: page.content, total: page.totalElements }))
      .catch(() => setQuestions({ items: [], total: 0 }));
  }, [characterId, questionModal]);

  // Avisa antes de fechar a aba do navegador com alterações não salvas.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  useEffect(() => () => clearRichTextEditorDrafts(draftKey), [draftKey]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function leave() {
    if (dirty) {
      const ok = await confirm({ title: 'Sair sem salvar?', message: 'As alterações feitas neste personagem serão perdidas.', confirmLabel: 'Sair sem salvar', tone: 'danger' });
      if (!ok) return;
    }
    onClose();
  }

  async function validate(): Promise<Errors> {
    const found: Errors = {};
    if (!form.name.trim()) found.name = 'Informe o nome do personagem.';
    if (!stripHtml(form.shortSummary)) found.shortSummary = 'Escreva um resumo curto.';
    else if (stripHtml(form.shortSummary).length > SUMMARY_LIMIT) found.shortSummary = `O resumo deve ter até ${SUMMARY_LIMIT} caracteres (aparece no topo da figurinha).`;
    if (!stripHtml(form.fullDescription) && !form.fullDescription.includes('<img')) found.fullDescription = 'Escreva a história completa.';
    const [genealogy, events] = await Promise.all([validateMermaidSyntax(form.genealogy), validateMermaidSyntax(form.importantEvents)]);
    if (!genealogy.valid) found.genealogy = `Diagrama com erro: ${genealogy.error}`;
    if (!events.valid) found.importantEvents = `Diagrama com erro: ${events.error}`;
    return found;
  }

  async function save() {
    setSaving(true);
    try {
      const found = await validate();
      const firstError = (Object.keys(found) as Array<keyof FormState>).find((key) => found[key]);
      if (firstError) {
        setErrors(found);
        setTab(FIELD_TAB[firstError] ?? 'identidade');
        toast.error('Revise os campos destacados antes de salvar.');
        topRef.current?.scrollIntoView({ behavior: 'smooth' });
        return;
      }
      const payload = toPayload(form);
      invalidateCharacterOptions();
      if (characterId === null) {
        const created = await createCharacter(payload);
        clearRichTextEditorDrafts(draftKey);
        setSaved(form);
        toast.success(`${created.name} foi criado${created.published ? ' e já está no álbum' : ' como rascunho'}.`, {
          description: 'Agora cadastre perguntas para o estudo de personagem.',
        });
        onNavigate('personagens', { editar: String(created.id) });
        return;
      }
      const updated = await updateCharacter(characterId, payload);
      const state = fromCharacter(updated);
      setForm(state);
      setSaved(state);
      toast.success('Alterações salvas.');
    } catch (error) {
      toast.error(errorMessage(error, 'Não foi possível salvar o personagem.'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState label="Carregando personagem..." />;
  if (loadError) {
    return (
      <div className="space-y-4">
        <Alert tone="danger">{loadError}</Alert>
        <Button variant="secondary" onClick={onClose}>
          <ArrowBackRoundedIcon fontSize="small" />
          Voltar para a lista
        </Button>
      </div>
    );
  }

  const summaryLength = stripHtml(form.shortSummary).length;
  const scheduledFor = form.publishAt && new Date(form.publishAt) > new Date() ? new Date(form.publishAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : null;
  const questionCount = questions?.total ?? 0;
  const checklist: Array<{ done: boolean; label: string; tab?: Tab }> = [
    { done: Boolean(form.imageUrl), label: 'Imagem da figurinha', tab: 'identidade' },
    { done: Boolean(form.narrativeRole.trim()), label: 'Papel na história', tab: 'identidade' },
    { done: Boolean(form.historicalPeriod.trim() && form.testament), label: 'Testamento e período', tab: 'identidade' },
    { done: summaryLength > 0 && summaryLength <= SUMMARY_LIMIT, label: 'Resumo curto', tab: 'historia' },
    { done: stripHtml(form.fullDescription).length >= 200, label: 'História com 200+ caracteres', tab: 'historia' },
    { done: form.bibleBooks.length > 0, label: 'Livros onde aparece', tab: 'biblia' },
    { done: form.keyVerses.length > 0, label: 'Versículos-chave', tab: 'biblia' },
    { done: characterId !== null && questionCount >= 3, label: '3 ou mais perguntas' },
  ];
  const score = Math.round((checklist.filter((item) => item.done).length / checklist.length) * 100);

  const tabs: Array<{ value: Tab; label: ReactNode; icon: ReactNode; error: boolean }> = [
    { value: 'identidade', label: 'Identidade', icon: <BadgeRoundedIcon fontSize="small" />, error: Boolean(errors.name) },
    { value: 'historia', label: 'História', icon: <AutoStoriesRoundedIcon fontSize="small" />, error: Boolean(errors.shortSummary || errors.fullDescription) },
    { value: 'biblia', label: 'Bíblia', icon: <MenuBookRoundedIcon fontSize="small" />, error: false },
    { value: 'diagramas', label: 'Diagramas', icon: <AccountTreeRoundedIcon fontSize="small" />, error: Boolean(errors.genealogy || errors.importantEvents) },
  ];

  return (
    <div ref={topRef} className="space-y-5 pb-28">
      <header className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" onClick={() => void leave()} className="-ml-2">
          <ArrowBackRoundedIcon />
          Personagens
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-3xl font-bold text-ink">{characterId === null ? 'Novo personagem' : form.name || 'Personagem'}</h1>
          <p className="text-sm text-muted">{dirty ? 'Alterações não salvas' : characterId === null ? 'Preencha e salve para criar.' : 'Tudo salvo.'}</p>
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-5">
          <div className="no-scrollbar -mx-1 overflow-x-auto px-1">
            <div role="tablist" aria-label="Seções do personagem" className="inline-flex min-w-full gap-1 rounded-2xl bg-surface-3 p-1">
              {tabs.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.value}
                  onClick={() => setTab(item.value)}
                  className={cn(
                    'relative inline-flex h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-4 font-display text-sm font-semibold transition',
                    tab === item.value ? 'bg-surface text-ink shadow-[0_2px_0_var(--edge-strong)]' : 'text-muted hover:text-ink',
                  )}
                >
                  {item.icon}
                  {item.label}
                  {item.error ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger" aria-label="com erro" /> : null}
                </button>
              ))}
            </div>
          </div>

          {tab === 'identidade' ? (
            <section className="panel space-y-5 p-5 sm:p-6">
              <Field label="Nome" required error={errors.name} htmlFor="character-name">
                <Input id="character-name" value={form.name} onChange={(event) => set('name', event.target.value)} maxLength={150} placeholder="Ex.: Davi" aria-invalid={Boolean(errors.name)} />
              </Field>
              <Field label="Raridade" hint="Define a moldura, a chance no sorteio e o preço na loja.">
                <RarityPicker value={form.rarity} onChange={(value) => set('rarity', value)} />
              </Field>
              <Field label="Imagem da figurinha">
                <CharacterImageField value={form.imageUrl} onChange={(value) => set('imageUrl', value)} />
              </Field>
              <div className="grid gap-5 md:grid-cols-2">
                <Field label="Papel na história" hint="Curto: aparece abaixo do nome. Ex.: Rei e salmista." htmlFor="character-role">
                  <Input id="character-role" value={form.narrativeRole} onChange={(event) => set('narrativeRole', event.target.value)} maxLength={200} placeholder="Ex.: Profeta, Juiz, Apóstolo" />
                </Field>
                <Field label="Período histórico" hint="Usado para organizar e filtrar o álbum.">
                  <PeriodField value={form.historicalPeriod} onChange={(value) => set('historicalPeriod', value)} />
                </Field>
              </div>
              <Field label="Testamento">
                <Segmented<Testament | ''>
                  aria-label="Testamento"
                  value={form.testament}
                  onChange={(value) => set('testament', value)}
                  options={[
                    { value: 'OLD', label: 'Antigo' },
                    { value: 'NEW', label: 'Novo' },
                    { value: '', label: 'Não definido' },
                  ]}
                />
              </Field>
            </section>
          ) : null}

          {tab === 'historia' ? (
            <section className="panel space-y-5 p-5 sm:p-6">
              <Field
                label="Resumo curto"
                required
                error={errors.shortSummary}
                hint="Uma ou duas frases. Aparece no topo da figurinha e para quem ainda não a conquistou."
                aside={<span className={cn('text-xs font-bold', summaryLength > SUMMARY_LIMIT ? 'text-danger' : 'text-muted')}>{summaryLength}/{SUMMARY_LIMIT}</span>}
              >
                <RichTextEditor syncKey={`${draftKey}shortSummary`} value={form.shortSummary} onChange={(value) => set('shortSummary', value)} />
              </Field>
              <Field label="História completa" required error={errors.fullDescription} hint="Liberada quando o jogador conquista a figurinha. Pode ter imagens.">
                <RichTextEditor syncKey={`${draftKey}fullDescription`} value={form.fullDescription} onChange={(value) => set('fullDescription', value)} allowImages />
              </Field>
              <Field label="Curiosidades" hint="Fatos que surpreendem. Pode ter imagens.">
                <RichTextEditor syncKey={`${draftKey}curiosities`} value={form.curiosities} onChange={(value) => set('curiosities', value)} allowImages />
              </Field>
            </section>
          ) : null}

          {tab === 'biblia' ? (
            <section className="panel space-y-5 p-5 sm:p-6">
              <Field label="Livros onde aparece" hint="Usado no filtro por livro do álbum.">
                <BibleBooksPicker
                  value={form.bibleBooks}
                  onChange={(books) => {
                    set('bibleBooks', books);
                  }}
                />
              </Field>
              <Field label="Versículos-chave" hint="Enter ou vírgula para adicionar. Ex.: Salmos 23:1">
                <ChipInput value={form.keyVerses} onChange={(value) => set('keyVerses', value)} placeholder="Ex.: 1 Samuel 17:45" tone="primary" />
              </Field>
              <Field label="Palavras-chave" hint="Temas do personagem (viram etiquetas na figurinha).">
                <ChipInput value={form.keywords} onChange={(value) => set('keywords', value)} placeholder="Ex.: coragem" suggestions={['fé', 'coragem', 'obediência', 'liderança', 'arrependimento', 'oração', 'sabedoria', 'perdão', 'missão']} />
              </Field>
              <Field label="Onde ler (referências)" hint="Capítulos e trechos para o jogador ler a história completa.">
                <RichTextEditor syncKey={`${draftKey}bibleReferences`} value={form.bibleReferences} onChange={(value) => set('bibleReferences', value)} />
              </Field>
            </section>
          ) : null}

          {tab === 'diagramas' ? (
            <section className="panel space-y-6 p-5 sm:p-6">
              <Field label="Árvore genealógica" error={errors.genealogy} hint="Diagrama Mermaid (graph TD). Use um modelo e troque os nomes.">
                <MermaidField value={form.genealogy} onChange={(value) => set('genealogy', value)} templates={GENEALOGY_TEMPLATES} placeholder={'graph TD\n  Abraao[Abraão] --> Isaque[Isaque]'} />
              </Field>
              <Field label="Linha do tempo" error={errors.importantEvents} hint="Diagrama Mermaid (timeline): cada linha é 'referência : acontecimento'.">
                <MermaidField value={form.importantEvents} onChange={(value) => set('importantEvents', value)} templates={TIMELINE_TEMPLATES} placeholder={'timeline\n  title Eventos importantes\n  Gênesis 12 : Chamado de Abraão'} />
              </Field>
            </section>
          ) : null}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <div className="panel space-y-4 p-4">
            <div className="mx-auto w-40">
              <StickerCard name={form.name || 'Nome'} rarity={form.rarity} imageUrl={form.imageUrl || null} owned />
            </div>
            {form.narrativeRole ? <p className="text-center text-sm font-semibold text-muted">{form.narrativeRole}</p> : null}
            {summaryLength > 0 ? (
              <div className="line-clamp-4 text-sm text-ink">
                <RichContent value={form.shortSummary} />
              </div>
            ) : null}
            <Switch
              checked={form.published}
              onChange={(value) => set('published', value)}
              label={!form.published ? 'Rascunho' : scheduledFor ? 'Agendado' : 'Publicado no álbum'}
              description={
                !form.published
                  ? 'Só aparece no painel.'
                  : scheduledFor
                    ? `Entra no álbum em ${scheduledFor}. Até lá aparece como "em breve".`
                    : 'Jogadores já podem ver e conquistar.'
              }
            />
            {form.published ? (
              <div className="space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">Agendar lançamento</span>
                <DateTimePicker aria-label="Data de lançamento" value={form.publishAt} onChange={(value) => set('publishAt', value)} futureOnly placeholder="Publicar agora" />
              </div>
            ) : null}
          </div>

          <div className="panel space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-ink">Qualidade</h3>
              <span className="font-display text-lg font-bold text-ink">{score}%</span>
            </div>
            <ProgressBar value={score} className="h-2.5" />
            <ul className="space-y-1.5">
              {checklist.map((item) => (
                <li key={item.label}>
                  <button
                    type="button"
                    disabled={!item.tab}
                    onClick={() => item.tab && setTab(item.tab)}
                    className="flex w-full items-center gap-2 text-left text-sm disabled:cursor-default"
                  >
                    {item.done ? <CheckCircleRoundedIcon className="text-success" fontSize="small" /> : <RadioButtonUncheckedRoundedIcon className="text-muted" fontSize="small" />}
                    <span className={item.done ? 'text-ink' : 'text-muted'}>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {characterId !== null ? (
            <div className="panel space-y-3 p-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-display font-bold text-ink">Perguntas</h3>
                <Badge tone={questionCount > 0 ? 'accent' : 'danger'}>{questionCount}</Badge>
              </div>
              {questions === null ? null : questions.items.length === 0 ? (
                <p className="text-sm text-muted">Sem perguntas, o estudo deste personagem fica indisponível para os jogadores.</p>
              ) : (
                <ul className="space-y-1.5">
                  {questions.items.map((question) => (
                    <li key={question.id} className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
                      <p className="line-clamp-2 text-ink">{question.text}</p>
                      <p className="text-xs text-muted">
                        {DIFFICULTY_LABELS[question.difficulty]}
                        {question.active ? '' : ' · inativa'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setQuestionModal(true)}>
                  <AddRoundedIcon fontSize="small" />
                  Nova pergunta
                </Button>
                {questionCount > 0 ? (
                  <Button size="sm" variant="secondary" onClick={() => onNavigate('perguntas', { personagem: String(characterId) })}>
                    Ver todas
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <Alert tone="info">Depois de salvar, você poderá cadastrar as perguntas deste personagem aqui.</Alert>
          )}
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:left-[264px]">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-3 px-4 py-3 sm:px-6 lg:px-8">
          <span className="mr-auto hidden text-sm font-semibold text-muted sm:inline">{dirty ? 'Você tem alterações não salvas.' : 'Nenhuma alteração pendente.'}</span>
          <Button variant="secondary" onClick={() => void leave()} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} loading={saving} disabled={!dirty && characterId !== null}>
            {saving ? null : <SaveRoundedIcon fontSize="small" />}
            {saving ? 'Salvando...' : characterId === null ? 'Criar personagem' : 'Salvar alterações'}
          </Button>
        </div>
      </div>

      {questionModal && characterId !== null ? (
        <QuestionEditorModal
          question={null}
          defaultCharacterId={characterId}
          onClose={() => setQuestionModal(false)}
          onSaved={() => setQuestionModal(false)}
        />
      ) : null}
    </div>
  );
}
