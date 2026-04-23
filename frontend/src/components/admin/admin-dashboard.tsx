'use client';

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import ExtensionRoundedIcon from '@mui/icons-material/ExtensionRounded';
import QuizRoundedIcon from '@mui/icons-material/QuizRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import StorefrontRoundedIcon from '@mui/icons-material/StorefrontRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MermaidDiagram, sanitizeMermaidCode, validateMermaidSyntax } from '@/components/ui/mermaid-diagram';
import { RichContent } from '@/components/ui/rich-content';
import { clearRichTextEditorDrafts, RichTextEditor } from '@/components/ui/rich-text-editor';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { BIBLE_BOOKS_PT } from '@/lib/bible-books';
import {
  createCharacter,
  createQuestion,
  createUser,
  deleteCharacter,
  deleteQuestion,
  deleteUser,
  getSettings,
  listCharacters,
  listQuestions,
  listRewards,
  listShopItems,
  listUsers,
  updateCharacter,
  updateQuestion,
  updateReward,
  updateSettings,
  updateShopItem,
  updateUser,
  type AdminCharacter,
  type AdminQuestion,
  type AdminReward,
  type AdminShopItem,
  type CreateCharacterPayload,
  type CreateQuestionPayload,
  type CreateRewardPayload,
  type CreateUserPayload,
  type GameSettings,
  type QuestionDifficulty,
  type RewardType,
  type Role,
  type ShopItemType,
  type StickerRarity,
} from '@/lib/admin-api';
import { getRarityLabel } from '@/lib/rarity-theme';
import type { UserProfile } from '@/types/auth';

type UserFormState = {
  name: string;
  email: string;
  password: string;
  role: Role;
};

type CharacterFormState = {
  name: string;
  imageUrl: string;
  rarity: StickerRarity;
  shortSummary: string;
  fullDescription: string;
  bibleBooks: string[];
  bibleReferences: string;
  historicalPeriod: string;
  narrativeRole: string;
  genealogy: string;
  curiosities: string;
  importantEvents: string;
  keyVerses: string;
  keywords: string;
};

type QuestionFormState = {
  text: string;
  difficulty: QuestionDifficulty;
  timeLimitSeconds: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: string;
  relatedCharacterId: string;
  active: boolean;
};

type RewardFormState = {
  name: string;
  rewardType: RewardType;
  stickerRarity: StickerRarity;
  stickerCharacterId: string;
  coinAmount: string;
  extraLives: string;
  extraTimeSeconds: string;
  xpMultiplier: string;
  ticketAmount: string;
  dropChance: string;
  active: boolean;
};

type ShopFormState = {
  name: string;
  description: string;
  itemType: ShopItemType;
  priceCoins: string;
  rewardDefinitionId: string;
  active: boolean;
};

type SettingsFormState = {
  maxQuestionsPerMatch: string;
  startingLives: string;
  rewardMatchLimitPerDay: string;
  characterStudyXpPercent: string;
  maxExtraLifeBoosts: string;
  maxExtraTimeBoosts: string;
  maxDoubleXpBoosts: string;
  doubleXpMultiplier: string;
};

type LoadState<T> = {
  data: T;
  loading: boolean;
  error: string | null;
};

type UsersPageData = {
  content: UserProfile[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
};

type AdminScreen = 'overview' | 'users' | 'characters' | 'questions' | 'rewards' | 'shop' | 'settings';

type ImageInputMode = 'url' | 'upload';

type DeleteTarget = {
  kind: 'user' | 'character' | 'question';
  id: number;
  label: string;
  message: string;
};

const emptyUserForm: UserFormState = {
  name: '',
  email: '',
  password: '',
  role: 'USER',
};

const emptyCharacterForm: CharacterFormState = {
  name: '',
  imageUrl: '',
  rarity: 'COMMON',
  shortSummary: '',
  fullDescription: '',
  bibleBooks: [],
  bibleReferences: '',
  historicalPeriod: '',
  narrativeRole: '',
  genealogy: '',
  curiosities: '',
  importantEvents: '',
  keyVerses: '',
  keywords: '',
};

const emptyQuestionForm: QuestionFormState = {
  text: '',
  difficulty: 'EASY',
  timeLimitSeconds: '30',
  optionA: '',
  optionB: '',
  optionC: '',
  optionD: '',
  correctOption: 'A',
  relatedCharacterId: '',
  active: true,
};

const emptyRewardForm: RewardFormState = {
  name: '',
  rewardType: 'COINS',
  stickerRarity: 'COMMON',
  stickerCharacterId: '',
  coinAmount: '',
  extraLives: '',
  extraTimeSeconds: '',
  xpMultiplier: '',
  ticketAmount: '',
  dropChance: '1',
  active: true,
};

const emptyShopForm: ShopFormState = {
  name: '',
  description: '',
  itemType: 'ECONOMY',
  priceCoins: '0',
  rewardDefinitionId: '',
  active: true,
};

const emptySettingsForm: SettingsFormState = {
  maxQuestionsPerMatch: '100',
  startingLives: '3',
  rewardMatchLimitPerDay: '4',
  characterStudyXpPercent: '35',
  maxExtraLifeBoosts: '5',
  maxExtraTimeBoosts: '5',
  maxDoubleXpBoosts: '5',
  doubleXpMultiplier: '2.0',
};

const controlClassName =
  'flex h-12 w-full rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-primary)_86%,white)] px-4 text-sm text-[var(--text-primary)] shadow-sm transition-colors placeholder:text-[var(--text-secondary)]/70 focus-visible:border-[var(--gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--gold)_35%,transparent)] disabled:cursor-not-allowed disabled:opacity-60';

const textareaClassName =
  'min-h-28 w-full rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-primary)_86%,white)] px-4 py-3 text-sm text-[var(--text-primary)] shadow-sm transition-colors placeholder:text-[var(--text-secondary)]/70 focus-visible:border-[var(--gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--gold)_35%,transparent)] disabled:cursor-not-allowed disabled:opacity-60';

const markdownPreviewClassName =
  'rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-primary)_90%,white)] p-4 text-sm leading-7 text-[var(--text-primary)]';

const selectClassName = `${controlClassName} pr-10`;

const emptyUsersPageData: UsersPageData = {
  content: [],
  totalElements: 0,
  totalPages: 0,
  number: 0,
  size: 10,
};

function formatRewardSummary(reward: AdminReward) {
  switch (reward.rewardType) {
    case 'STICKER':
      return reward.stickerRarity ? `Raridade ${reward.stickerRarity}` : 'Figurinha configurada';
    case 'EXTRA_LIFE':
      return `${reward.extraLives ?? 1} vida(s) extra`;
    case 'EXTRA_TIME':
      return `${reward.extraTimeSeconds ?? 1} segundo(s) extra`;
    case 'XP_MULTIPLIER':
      return `XP x${reward.xpMultiplier ?? 1}`;
    case 'COINS':
      return `${reward.coinAmount ?? 0} moeda(s)`;
    default:
      return 'Sem detalhes';
  }
}

const adminScreens: Array<{
  id: AdminScreen;
  label: string;
  icon: ReactNode;
}> = [
  { id: 'overview', label: 'Visão geral', icon: <DashboardRoundedIcon fontSize="inherit" /> },
  { id: 'users', label: 'Usuários', icon: <PeopleAltRoundedIcon fontSize="inherit" /> },
  { id: 'characters', label: 'Personagens', icon: <ExtensionRoundedIcon fontSize="inherit" /> },
  { id: 'questions', label: 'Perguntas', icon: <QuizRoundedIcon fontSize="inherit" /> },
  { id: 'rewards', label: 'Recompensas', icon: <EmojiEventsRoundedIcon fontSize="inherit" /> },
  { id: 'shop', label: 'Loja', icon: <StorefrontRoundedIcon fontSize="inherit" /> },
  { id: 'settings', label: 'Configurações', icon: <SettingsRoundedIcon fontSize="inherit" /> },
];

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-2 text-sm font-medium text-[var(--text-secondary)]">
      <span>{label}</span>
      {children}
      {hint ? <span className="text-xs font-normal text-[var(--text-secondary)]/80">{hint}</span> : null}
    </div>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-[var(--border)]/70 bg-[color-mix(in_srgb,var(--bg-primary)_78%,white)] pb-5">
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  );
}

function parseNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function OptionalNumberText(value: string) {
  const parsed = parseNumber(value);
  return parsed === null ? undefined : parsed;
}

function appendMermaidSnippet(currentValue: string, snippet: string) {
  const trimmed = currentValue.trimEnd();
  return trimmed ? `${trimmed}\n\n${snippet}` : snippet;
}

function extractMermaidNodeIds(source: string) {
  const ids = new Set<string>();

  for (const line of source.split(/\r?\n/)) {
    const matches = line.matchAll(/\b([A-Za-z0-9_]+)\s*(?=\[|\(|\{)/g);
    for (const match of matches) {
      ids.add(match[1]);
    }
  }

  return [...ids];
}

function appendMermaidColorTemplate(currentValue: string) {
  const trimmed = currentValue.trimEnd();
  if (trimmed.includes('classDef principal') && trimmed.includes('classDef secundario')) {
    return trimmed;
  }

  if (/^timeline\b/i.test(trimmed)) {
    return trimmed;
  }

  const nodeIds = extractMermaidNodeIds(trimmed);
  const classAssignments = nodeIds.length
    ? nodeIds.map((id, index) => `class ${id} ${index % 2 === 0 ? 'principal' : 'secundario'};`).join('\n')
    : '%% Exemplo: class Abraao principal;';

  const template = `classDef principal fill:#FDE68A,stroke:#B45309,color:#111827;
classDef secundario fill:#BFDBFE,stroke:#1D4ED8,color:#111827;

${classAssignments}`;

  return trimmed ? `${trimmed}\n\n${template}` : `graph TD
  Abraao[Abraão] --> Isaque[Isaque]
  Abraao --> Ismael[Ismael]

${template}`;
}

function appendTimelineHint(currentValue: string) {
  const trimmed = currentValue.trimEnd();
  const hint = `%% Mermaid timeline não suporta classDef.
%% Para destacar eventos, use títulos curtos por section/linha.`;

  return trimmed ? `${trimmed}\n\n${hint}` : `timeline
  title Eventos importantes
  1 Samuel 16 : Davi é ungido rei
  1 Samuel 17 : Davi enfrenta Golias
  2 Samuel 5 : Davi assume o trono`;
}

function buildTimelineTemplate(currentValue: string) {
  return `timeline
  title Eventos importantes
  1 Samuel 16 : Davi é ungido rei
  1 Samuel 17 : Davi enfrenta Golias
  2 Samuel 5 : Davi assume o trono`;
}

function buildGenealogyTemplate(currentValue: string) {
  return `graph TD
  Abraao[Abraão] --> Isaque[Isaque]
  Abraao --> Ismael[Ismael]
  Isaque --> Jacó[Jacó]

classDef principal fill:#FDE68A,stroke:#B45309,color:#111827;
classDef secundario fill:#BFDBFE,stroke:#1D4ED8,color:#111827;

class Abraao principal;
class Isaque principal;
class Ismael secundario;
class Jacó principal;`;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Não foi possível ler a imagem selecionada.'));
    };
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem selecionada.'));
    reader.readAsDataURL(file);
  });
}

function appendMarkdownSnippet(currentValue: string, snippet: string) {
  const value = currentValue.trimEnd();
  return value.length > 0 ? `${value}\n\n${snippet}` : snippet;
}

function stripHtmlToPlainText(value: string) {
  if (!value) {
    return '';
  }

  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function renderInlineMarkdown(text: string, keyPrefix: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);

  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={key}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={key} className="rounded bg-black/10 px-1 py-0.5 text-[0.9em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={key}>{part}</span>;
  });
}

function MarkdownPreview({ value }: { value: string }) {
  const lines = value.split(/\r?\n/);
  const elements: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line) {
      index += 1;
      continue;
    }

    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith('- ')) {
        items.push(lines[index].trim().slice(2).trim());
        index += 1;
      }

      elements.push(
        <ul key={`ul-${index}`} className="list-disc space-y-1 pl-5">
          {items.map((item, itemIndex) => (
            <li key={`ul-item-${index}-${itemIndex}`}>{renderInlineMarkdown(item, `ul-${index}-${itemIndex}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    const orderedMatch = line.match(/^\d+\.\s+/);
    if (orderedMatch) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, '').trim());
        index += 1;
      }

      elements.push(
        <ol key={`ol-${index}`} className="list-decimal space-y-1 pl-5">
          {items.map((item, itemIndex) => (
            <li key={`ol-item-${index}-${itemIndex}`}>{renderInlineMarkdown(item, `ol-${index}-${itemIndex}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    if (line.startsWith('### ')) {
      elements.push(
        <h4 key={`h3-${index}`} className="text-base font-semibold text-[var(--text-primary)]">
          {renderInlineMarkdown(line.slice(4), `h3-${index}`)}
        </h4>,
      );
      index += 1;
      continue;
    }

    if (line.startsWith('## ')) {
      elements.push(
        <h3 key={`h2-${index}`} className="text-lg font-semibold text-[var(--text-primary)]">
          {renderInlineMarkdown(line.slice(3), `h2-${index}`)}
        </h3>,
      );
      index += 1;
      continue;
    }

    if (line.startsWith('# ')) {
      elements.push(
        <h2 key={`h1-${index}`} className="text-xl font-semibold text-[var(--text-primary)]">
          {renderInlineMarkdown(line.slice(2), `h1-${index}`)}
        </h2>,
      );
      index += 1;
      continue;
    }

    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={`quote-${index}`} className="border-l-4 border-[var(--gold)]/70 pl-3 italic text-[var(--text-secondary)]">
          {renderInlineMarkdown(line.slice(2), `quote-${index}`)}
        </blockquote>,
      );
      index += 1;
      continue;
    }

    elements.push(
      <p key={`p-${index}`} className="whitespace-pre-wrap">
        {renderInlineMarkdown(line, `p-${index}`)}
      </p>,
    );
    index += 1;
  }

  if (elements.length === 0) {
    return <p className="text-[var(--text-secondary)]">Pré-visualização aparecerá aqui.</p>;
  }

  return <div className="space-y-3">{elements}</div>;
}

type TimelineEvent = {
  marker: string;
  description: string;
};

function parseTimelineEvents(value: string): TimelineEvent[] {
  const lines = value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const events: TimelineEvent[] = [];

  for (const rawLine of lines) {
    const line = rawLine.replace(/^[-*]\s+/, '');
    if (!line || /^mermaid$/i.test(line) || /^timeline$/i.test(line) || /^title\s+/i.test(line)) {
      continue;
    }

    if (/^exibir diagrama$/i.test(line) || /^copiar$/i.test(line)) {
      continue;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex <= 0) {
      continue;
    }

    const marker = line.slice(0, separatorIndex).trim();
    const description = line.slice(separatorIndex + 1).trim();

    if (!marker || !description) {
      continue;
    }

    events.push({ marker, description });
  }

  return events;
}

function ImportantEventsPreview({ value }: { value: string }) {
  const events = parseTimelineEvents(value);
  if (events.length === 0) {
    return <MarkdownPreview value={value} />;
  }

  return (
    <div className="space-y-4">
      {events.map((event, index) => (
        <div key={`${event.marker}-${index}`} className="grid grid-cols-[110px_1fr] gap-3">
          <div className="rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--gold)_12%,white)] px-3 py-2 text-center text-xs font-semibold uppercase tracking-[0.08em] text-[var(--accent)]">
            {event.marker}
          </div>
          <div className="relative rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3 text-sm text-[var(--text-primary)]">
            {event.description}
            {index < events.length - 1 ? <span className="pointer-events-none absolute -bottom-4 left-4 h-4 w-px bg-[var(--border)]" /> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

function MarkdownToolbar({ onInsert }: { onInsert: (snippet: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="secondary" onClick={() => onInsert('**texto em destaque**')}>
        Negrito
      </Button>
      <Button type="button" size="sm" variant="secondary" onClick={() => onInsert('*texto em ênfase*')}>
        Itálico
      </Button>
      <Button type="button" size="sm" variant="secondary" onClick={() => onInsert('### Subtítulo')}>
        Subtítulo
      </Button>
      <Button type="button" size="sm" variant="secondary" onClick={() => onInsert('- Item 1\n- Item 2\n- Item 3')}>
        Lista
      </Button>
      <Button type="button" size="sm" variant="secondary" onClick={() => onInsert('> Citação importante')}>
        Citação
      </Button>
    </div>
  );
}

export function AdminDashboard() {
  const { user, signOut, accessToken } = useAuth();
  const [screen, setScreen] = useState<AdminScreen>('overview');

  const [usersState, setUsersState] = useState<LoadState<UsersPageData>>({ data: emptyUsersPageData, loading: false, error: null });
  const [usersPage, setUsersPage] = useState(0);
  const [usersPageSize, setUsersPageSize] = useState(10);
  const [userNameFilter, setUserNameFilter] = useState('');
  const [userEmailFilter, setUserEmailFilter] = useState('');
  const [userNameDraft, setUserNameDraft] = useState('');
  const [userEmailDraft, setUserEmailDraft] = useState('');
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [usersReloadKey, setUsersReloadKey] = useState(0);
  const [charactersState, setCharactersState] = useState<LoadState<AdminCharacter[]>>({ data: [], loading: false, error: null });
  const [questionsState, setQuestionsState] = useState<LoadState<AdminQuestion[]>>({ data: [], loading: false, error: null });
  const [rewardsState, setRewardsState] = useState<LoadState<AdminReward[]>>({ data: [], loading: false, error: null });
  const [shopState, setShopState] = useState<LoadState<AdminShopItem[]>>({ data: [], loading: false, error: null });
  const [settingsState, setSettingsState] = useState<LoadState<GameSettings | null>>({ data: null, loading: false, error: null });

  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [userForm, setUserForm] = useState<UserFormState>(emptyUserForm);
  const [userSubmitError, setUserSubmitError] = useState<string | null>(null);
  const [userSubmitting, setUserSubmitting] = useState(false);

  const [editingCharacterId, setEditingCharacterId] = useState<number | null>(null);
  const [characterForm, setCharacterForm] = useState<CharacterFormState>(emptyCharacterForm);
  const [characterSubmitError, setCharacterSubmitError] = useState<string | null>(null);
  const [characterSubmitting, setCharacterSubmitting] = useState(false);
  const [isCharacterEditorOpen, setIsCharacterEditorOpen] = useState(false);
  const [characterImageMode, setCharacterImageMode] = useState<ImageInputMode>('url');
  const [characterNameFilter, setCharacterNameFilter] = useState('');
  const [characterNameDraft, setCharacterNameDraft] = useState('');
  const [charactersPage, setCharactersPage] = useState(0);
  const [charactersPageSize, setCharactersPageSize] = useState(10);

  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [questionForm, setQuestionForm] = useState<QuestionFormState>(emptyQuestionForm);
  const [questionSubmitError, setQuestionSubmitError] = useState<string | null>(null);
  const [questionSubmitting, setQuestionSubmitting] = useState(false);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [questionTextFilter, setQuestionTextFilter] = useState('');
  const [questionTextDraft, setQuestionTextDraft] = useState('');
  const [questionsPage, setQuestionsPage] = useState(0);
  const [questionsPageSize, setQuestionsPageSize] = useState(10);

  const [editingRewardId, setEditingRewardId] = useState<number | null>(null);
  const [rewardForm, setRewardForm] = useState<RewardFormState>(emptyRewardForm);
  const [rewardSubmitError, setRewardSubmitError] = useState<string | null>(null);
  const [rewardSubmitting, setRewardSubmitting] = useState(false);

  const [editingShopId, setEditingShopId] = useState<number | null>(null);
  const [shopForm, setShopForm] = useState<ShopFormState>(emptyShopForm);
  const [shopSubmitError, setShopSubmitError] = useState<string | null>(null);
  const [shopSubmitting, setShopSubmitting] = useState(false);

  const [settingsForm, setSettingsForm] = useState<SettingsFormState>(emptySettingsForm);
  const [settingsSubmitError, setSettingsSubmitError] = useState<string | null>(null);
  const [settingsSubmitting, setSettingsSubmitting] = useState(false);

  const currentToken = accessToken ?? '';

  const characterOptions = useMemo(
    () => charactersState.data.map((character) => ({ id: character.id, name: character.name })),
    [charactersState.data],
  );

  const shopRewardOptions = useMemo(
    () =>
      rewardsState.data
        .filter((reward) => {
          if (reward.rewardType === 'STICKER') {
            return reward.stickerRarity !== 'LEGENDARY';
          }

          return reward.rewardType === 'EXTRA_LIFE' || reward.rewardType === 'EXTRA_TIME' || reward.rewardType === 'XP_MULTIPLIER';
        })
        .map((reward) => ({ id: reward.id, name: reward.name })),
    [rewardsState.data],
  );

  const filteredCharacters = useMemo(() => {
    if (!characterNameFilter.trim()) {
      return charactersState.data;
    }

    const query = characterNameFilter.toLowerCase();
    return charactersState.data.filter((character) => character.name.toLowerCase().includes(query));
  }, [charactersState.data, characterNameFilter]);

  const totalCharacterPages = Math.max(Math.ceil(filteredCharacters.length / charactersPageSize), 1);

  const pagedCharacters = useMemo(() => {
    const startIndex = charactersPage * charactersPageSize;
    return filteredCharacters.slice(startIndex, startIndex + charactersPageSize);
  }, [filteredCharacters, charactersPage, charactersPageSize]);

  const filteredQuestions = useMemo(() => {
    if (!questionTextFilter.trim()) {
      return questionsState.data;
    }

    const query = questionTextFilter.toLowerCase();
    return questionsState.data.filter(
      (question) =>
        question.text.toLowerCase().includes(query) ||
        (question.relatedCharacterName ?? '').toLowerCase().includes(query),
    );
  }, [questionsState.data, questionTextFilter]);

  const totalQuestionPages = Math.max(Math.ceil(filteredQuestions.length / questionsPageSize), 1);

  const pagedQuestions = useMemo(() => {
    const startIndex = questionsPage * questionsPageSize;
    return filteredQuestions.slice(startIndex, startIndex + questionsPageSize);
  }, [filteredQuestions, questionsPage, questionsPageSize]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const nextFilter = characterNameDraft.trim();
      if (nextFilter === characterNameFilter) {
        return;
      }

      setCharactersPage(0);
      setCharacterNameFilter(nextFilter);
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [characterNameDraft, characterNameFilter]);

  useEffect(() => {
    if (charactersPage >= totalCharacterPages) {
      setCharactersPage(Math.max(totalCharacterPages - 1, 0));
    }
  }, [charactersPage, totalCharacterPages]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const nextFilter = questionTextDraft.trim();
      if (nextFilter === questionTextFilter) {
        return;
      }

      setQuestionsPage(0);
      setQuestionTextFilter(nextFilter);
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [questionTextDraft, questionTextFilter]);

  useEffect(() => {
    if (questionsPage >= totalQuestionPages) {
      setQuestionsPage(Math.max(totalQuestionPages - 1, 0));
    }
  }, [questionsPage, totalQuestionPages]);

  useEffect(() => {
    if (!currentToken) {
      return;
    }

    void loadCharacters();
    void loadQuestions();
    void loadRewards();
    void loadShopItems();
    void loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentToken]);

  useEffect(() => {
    if (!currentToken) {
      return;
    }

    void loadUsers(usersPage, userNameFilter, userEmailFilter, usersPageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentToken, usersPage, userNameFilter, userEmailFilter, usersPageSize, usersReloadKey]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const nextName = userNameDraft.trim();
      const nextEmail = userEmailDraft.trim();

      if (nextName === userNameFilter && nextEmail === userEmailFilter) {
        return;
      }

      setUsersPage(0);
      setUserNameFilter(nextName);
      setUserEmailFilter(nextEmail);
    }, 450);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [userNameDraft, userEmailDraft, userNameFilter, userEmailFilter]);

  async function loadUsers(page = usersPage, name = userNameFilter, email = userEmailFilter, size = usersPageSize) {
    if (!currentToken) {
      return;
    }

    setUsersState((state) => ({ ...state, loading: true, error: null }));

    try {
      const response = await listUsers(currentToken, {
        page,
        size,
        name,
        email,
      });

      setUsersPage(response.number ?? page);
      setUsersState({
        data: {
          content: response.content ?? [],
          totalElements: response.totalElements ?? 0,
          totalPages: response.totalPages ?? 0,
          number: response.number ?? page,
          size: response.size ?? size,
        },
        loading: false,
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível carregar os usuários.';
      setUsersState((state) => ({ ...state, loading: false, error: message }));
    }
  }

  async function loadCharacters() {
    if (!currentToken) {
      return;
    }

    setCharactersState((state) => ({ ...state, loading: true, error: null }));

    try {
      const response = await listCharacters(currentToken);
      setCharactersState({ data: response, loading: false, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível carregar os personagens.';
      setCharactersState((state) => ({ ...state, loading: false, error: message }));
    }
  }

  async function loadQuestions() {
    if (!currentToken) {
      return;
    }

    setQuestionsState((state) => ({ ...state, loading: true, error: null }));

    try {
      const response = await listQuestions(currentToken);
      setQuestionsState({ data: response, loading: false, error: null });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível carregar as perguntas.';
      setQuestionsState((state) => ({ ...state, loading: false, error: message }));
    }
  }

  async function loadRewards() {
    if (!currentToken) {
      return;
    }

    setRewardsState((state) => ({ ...state, loading: true, error: null }));

    try {
      const response = await listRewards(currentToken);
      setRewardsState({ data: response, loading: false, error: null });
      if (response.length > 0 && editingRewardId === null) {
        startEditingReward(response[0]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível carregar as recompensas.';
      setRewardsState((state) => ({ ...state, loading: false, error: message }));
    }
  }

  async function loadShopItems() {
    if (!currentToken) {
      return;
    }

    setShopState((state) => ({ ...state, loading: true, error: null }));

    try {
      const response = await listShopItems(currentToken);
      setShopState({ data: response, loading: false, error: null });
      if (response.length > 0 && editingShopId === null) {
        startEditingShopItem(response[0]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível carregar a loja.';
      setShopState((state) => ({ ...state, loading: false, error: message }));
    }
  }

  async function loadSettings() {
    if (!currentToken) {
      return;
    }

    setSettingsState((state) => ({ ...state, loading: true, error: null }));

    try {
      const response = await getSettings(currentToken);
      setSettingsState({ data: response, loading: false, error: null });
      setSettingsForm({
        maxQuestionsPerMatch: String(response.maxQuestionsPerMatch),
        startingLives: String(response.startingLives),
        rewardMatchLimitPerDay: String(response.rewardMatchLimitPerDay),
        characterStudyXpPercent: String(response.characterStudyXpPercent),
        maxExtraLifeBoosts: String(response.maxExtraLifeBoosts),
        maxExtraTimeBoosts: String(response.maxExtraTimeBoosts),
        maxDoubleXpBoosts: String(response.maxDoubleXpBoosts),
        doubleXpMultiplier: String(response.doubleXpMultiplier),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível carregar as configurações.';
      setSettingsState((state) => ({ ...state, loading: false, error: message }));
    }
  }

  async function handleUserSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentToken) {
      return;
    }

    setUserSubmitting(true);
    setUserSubmitError(null);

    try {
      const payload: CreateUserPayload = {
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        password: userForm.password,
        role: userForm.role,
      };

      if (editingUserId === null) {
        await createUser(currentToken, payload);
      } else {
        await updateUser(currentToken, editingUserId, payload);
      }

      setUserForm(emptyUserForm);
      setEditingUserId(null);
      setIsUserModalOpen(false);
      setUsersReloadKey((value) => value + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar o usuário.';
      setUserSubmitError(message);
    } finally {
      setUserSubmitting(false);
    }
  }

  function startEditingUser(userRecord: UserProfile) {
    setEditingUserId(userRecord.id);
    setUserForm({
      name: userRecord.name,
      email: userRecord.email,
      password: '',
      role: userRecord.role,
    });
    setUserSubmitError(null);
      setIsUserModalOpen(true);
  }

  async function handleDeleteUser(userId: number) {
    setDeleteTarget({
      kind: 'user',
      id: userId,
      label: 'Excluir usuário',
      message: 'A exclusão é lógica. Confirme para remover o usuário das listagens.',
    });
  }

  function openCreateUserModal() {
    setEditingUserId(null);
    setUserForm(emptyUserForm);
    setUserSubmitError(null);
    setIsUserModalOpen(true);
  }

  function closeUserModal() {
    if (userSubmitting) {
      return;
    }

    setIsUserModalOpen(false);
    setEditingUserId(null);
    setUserForm(emptyUserForm);
    setUserSubmitError(null);
  }

  async function applyUserFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = userNameDraft.trim();
    const nextEmail = userEmailDraft.trim();

    setUserNameFilter(nextName);
    setUserEmailFilter(nextEmail);
    setUsersPage(0);
  }

  function resetUserFilters() {
    setUserNameDraft('');
    setUserEmailDraft('');
    setUserNameFilter('');
    setUserEmailFilter('');
    setUsersPage(0);
  }

  function goToUsersPage(nextPage: number) {
    const totalPages = usersState.data.totalPages;
    if (nextPage < 0 || (totalPages > 0 && nextPage >= totalPages)) {
      return;
    }

    setUsersPage(nextPage);
  }

  function changeUsersPageSize(nextSize: number) {
    setUsersPageSize(nextSize);
    setUsersPage(0);
  }

  async function handleCharacterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentToken) {
      return;
    }

    setCharacterSubmitting(true);
    setCharacterSubmitError(null);

    try {
      const sanitizedGenealogy = sanitizeMermaidCode(characterForm.genealogy);
      const sanitizedImportantEvents = sanitizeMermaidCode(characterForm.importantEvents);

      const [genealogyValidation, eventsValidation] = await Promise.all([
        validateMermaidSyntax(sanitizedGenealogy),
        validateMermaidSyntax(sanitizedImportantEvents),
      ]);

      if (!genealogyValidation.valid) {
        throw new Error(`Genealogia inválida no Mermaid: ${genealogyValidation.error}`);
      }

      if (!eventsValidation.valid) {
        throw new Error(`Eventos importantes inválidos no Mermaid: ${eventsValidation.error}`);
      }

      const payload: CreateCharacterPayload = {
        name: characterForm.name.trim(),
        imageUrl: optionalText(characterForm.imageUrl),
        rarity: characterForm.rarity,
        shortSummary: characterForm.shortSummary.trim(),
        fullDescription: characterForm.fullDescription.trim(),
        bibleBooks: optionalText(characterForm.bibleBooks.join(', ')),
        bibleReferences: optionalText(characterForm.bibleReferences),
        historicalPeriod: optionalText(characterForm.historicalPeriod),
        narrativeRole: optionalText(characterForm.narrativeRole),
        genealogy: optionalText(characterForm.genealogy),
        curiosities: optionalText(characterForm.curiosities),
        importantEvents: optionalText(characterForm.importantEvents),
        keyVerses: optionalText(characterForm.keyVerses),
        keywords: optionalText(characterForm.keywords),
      };

      payload.genealogy = optionalText(sanitizedGenealogy);
      payload.importantEvents = optionalText(sanitizedImportantEvents);

      if (editingCharacterId === null) {
        await createCharacter(currentToken, payload);
      } else {
        await updateCharacter(currentToken, editingCharacterId, payload);
      }

      setCharacterForm(emptyCharacterForm);
      setEditingCharacterId(null);
  setIsCharacterEditorOpen(false);
      setCharacterImageMode('url');
      await loadCharacters();
      await loadQuestions();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar o personagem.';
      setCharacterSubmitError(message);
    } finally {
      setCharacterSubmitting(false);
    }
  }

  function startEditingCharacter(character: AdminCharacter) {
    setEditingCharacterId(character.id);
    setCharacterForm({
      name: character.name,
      imageUrl: character.imageUrl ?? '',
      rarity: character.rarity,
      shortSummary: character.shortSummary,
      fullDescription: character.fullDescription,
      bibleBooks: (character.bibleBooks ?? '').split(',').map((book) => book.trim()).filter(Boolean),
      bibleReferences: character.bibleReferences ?? '',
      historicalPeriod: character.historicalPeriod ?? '',
      narrativeRole: character.narrativeRole ?? '',
      genealogy: character.genealogy ?? '',
      curiosities: character.curiosities ?? '',
      importantEvents: character.importantEvents ?? '',
      keyVerses: character.keyVerses ?? '',
      keywords: character.keywords ?? '',
    });
    setCharacterSubmitError(null);
    setCharacterImageMode((character.imageUrl ?? '').startsWith('data:image/') ? 'upload' : 'url');
    setIsCharacterEditorOpen(true);
  }

  async function handleDeleteCharacter(characterId: number) {
    setDeleteTarget({
      kind: 'character',
      id: characterId,
      label: 'Excluir personagem',
      message: 'As perguntas relacionadas podem ser afetadas. Confirme apenas se tiver certeza.',
    });
  }

  function openCreateCharacterEditor() {
    clearRichTextEditorDrafts('new:');
    setEditingCharacterId(null);
    setCharacterForm(emptyCharacterForm);
    setCharacterSubmitError(null);
    setCharacterImageMode('url');
    setIsCharacterEditorOpen(true);
  }

  function closeCharacterEditor() {
    if (characterSubmitting) {
      return;
    }

    clearRichTextEditorDrafts('new:');
    setIsCharacterEditorOpen(false);
    setEditingCharacterId(null);
    setCharacterForm(emptyCharacterForm);
    setCharacterSubmitError(null);
    setCharacterImageMode('url');
  }

  async function handleCharacterFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const dataUrl = await fileToDataUrl(file);
    setCharacterForm((current) => ({ ...current, imageUrl: dataUrl }));
    setCharacterImageMode('upload');
  }

  function applyCharacterFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCharactersPage(0);
    setCharacterNameFilter(characterNameDraft.trim());
  }

  function resetCharacterFilter() {
    setCharacterNameDraft('');
    setCharacterNameFilter('');
    setCharactersPage(0);
  }

  function changeCharactersPageSize(nextSize: number) {
    setCharactersPageSize(nextSize);
    setCharactersPage(0);
  }

  function goToCharactersPage(nextPage: number) {
    if (nextPage < 0 || nextPage >= totalCharacterPages) {
      return;
    }

    setCharactersPage(nextPage);
  }

  async function handleQuestionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentToken) {
      return;
    }

    setQuestionSubmitting(true);
    setQuestionSubmitError(null);

    try {
      const payload: CreateQuestionPayload = {
        text: questionForm.text.trim(),
        difficulty: questionForm.difficulty,
        timeLimitSeconds: Number(questionForm.timeLimitSeconds),
        optionA: questionForm.optionA.trim(),
        optionB: questionForm.optionB.trim(),
        optionC: questionForm.optionC.trim(),
        optionD: questionForm.optionD.trim(),
        correctOption: questionForm.correctOption.trim().toUpperCase(),
        relatedCharacterId: parseNumber(questionForm.relatedCharacterId),
        active: questionForm.active,
      };

      if (editingQuestionId === null) {
        await createQuestion(currentToken, payload);
      } else {
        await updateQuestion(currentToken, editingQuestionId, payload);
      }

      setQuestionForm(emptyQuestionForm);
      setEditingQuestionId(null);
      setIsQuestionModalOpen(false);
      await loadQuestions();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar a pergunta.';
      setQuestionSubmitError(message);
    } finally {
      setQuestionSubmitting(false);
    }
  }

  function startEditingQuestion(question: AdminQuestion) {
    setEditingQuestionId(question.id);
    setQuestionForm({
      text: question.text,
      difficulty: question.difficulty,
      timeLimitSeconds: String(question.timeLimitSeconds),
      optionA: question.optionA,
      optionB: question.optionB,
      optionC: question.optionC,
      optionD: question.optionD,
      correctOption: question.correctOption,
      relatedCharacterId: question.relatedCharacterId ? String(question.relatedCharacterId) : '',
      active: question.active,
    });
    setQuestionSubmitError(null);
    setIsQuestionModalOpen(true);
  }

  async function handleDeleteQuestion(questionId: number) {
    setDeleteTarget({
      kind: 'question',
      id: questionId,
      label: 'Excluir pergunta',
      message: 'A pergunta será removida permanentemente. Confirme para continuar.',
    });
  }

  async function confirmDeleteTarget() {
    if (!currentToken || !deleteTarget) {
      return;
    }

    setDeleteSubmitting(true);

    try {
      if (deleteTarget.kind === 'user') {
        await deleteUser(currentToken, deleteTarget.id);
        setUsersReloadKey((value) => value + 1);
      } else if (deleteTarget.kind === 'character') {
        await deleteCharacter(currentToken, deleteTarget.id);
        await loadCharacters();
        await loadQuestions();
      } else {
        await deleteQuestion(currentToken, deleteTarget.id);
        await loadQuestions();
      }

      setDeleteTarget(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível excluir o item.';
      if (deleteTarget.kind === 'user') {
        setUserSubmitError(message);
      } else if (deleteTarget.kind === 'character') {
        setCharacterSubmitError(message);
      } else {
        setQuestionSubmitError(message);
      }
    } finally {
      setDeleteSubmitting(false);
    }
  }

  function closeDeleteTarget() {
    if (deleteSubmitting) {
      return;
    }

    setDeleteTarget(null);
  }

  function openCreateQuestionModal() {
    setEditingQuestionId(null);
    setQuestionForm(emptyQuestionForm);
    setQuestionSubmitError(null);
    setIsQuestionModalOpen(true);
  }

  function closeQuestionModal() {
    if (questionSubmitting) {
      return;
    }

    setIsQuestionModalOpen(false);
    setEditingQuestionId(null);
    setQuestionForm(emptyQuestionForm);
    setQuestionSubmitError(null);
  }

  function applyQuestionFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuestionsPage(0);
    setQuestionTextFilter(questionTextDraft.trim());
  }

  function resetQuestionFilter() {
    setQuestionTextDraft('');
    setQuestionTextFilter('');
    setQuestionsPage(0);
  }

  function changeQuestionsPageSize(nextSize: number) {
    setQuestionsPageSize(nextSize);
    setQuestionsPage(0);
  }

  function goToQuestionsPage(nextPage: number) {
    if (nextPage < 0 || nextPage >= totalQuestionPages) {
      return;
    }

    setQuestionsPage(nextPage);
  }

  async function handleRewardSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentToken) {
      return;
    }

    setRewardSubmitting(true);
    setRewardSubmitError(null);

    try {
      if (editingRewardId === null) {
        throw new Error('Selecione uma recompensa para configurar.');
      }

      const payload: CreateRewardPayload = {
        name: rewardForm.name.trim(),
        rewardType: rewardForm.rewardType,
        stickerRarity: rewardForm.stickerRarity,
        stickerCharacterId: parseNumber(rewardForm.stickerCharacterId),
        coinAmount: OptionalNumberText(rewardForm.coinAmount),
        extraLives: OptionalNumberText(rewardForm.extraLives),
        extraTimeSeconds: OptionalNumberText(rewardForm.extraTimeSeconds),
        xpMultiplier: OptionalNumberText(rewardForm.xpMultiplier),
        ticketAmount: OptionalNumberText(rewardForm.ticketAmount),
        dropChance: Number(rewardForm.dropChance),
        active: rewardForm.active,
      };

      await updateReward(currentToken, editingRewardId, payload);
      await loadRewards();
      await loadShopItems();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar a recompensa.';
      setRewardSubmitError(message);
    } finally {
      setRewardSubmitting(false);
    }
  }

  function startEditingReward(reward: AdminReward) {
    setEditingRewardId(reward.id);
    setRewardForm({
      name: reward.name,
      rewardType: reward.rewardType,
      stickerRarity: reward.stickerRarity ?? 'COMMON',
      stickerCharacterId: reward.stickerCharacterId ? String(reward.stickerCharacterId) : '',
      coinAmount: reward.coinAmount !== null && reward.coinAmount !== undefined ? String(reward.coinAmount) : '',
      extraLives: reward.extraLives !== null && reward.extraLives !== undefined ? String(reward.extraLives) : '',
      extraTimeSeconds: reward.extraTimeSeconds !== null && reward.extraTimeSeconds !== undefined ? String(reward.extraTimeSeconds) : '',
      xpMultiplier: reward.xpMultiplier !== null && reward.xpMultiplier !== undefined ? String(reward.xpMultiplier) : '',
      ticketAmount: reward.ticketAmount !== null && reward.ticketAmount !== undefined ? String(reward.ticketAmount) : '',
      dropChance: String(reward.dropChance),
      active: reward.active,
    });
    setRewardSubmitError(null);
  }

  async function handleShopSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentToken) {
      return;
    }

    setShopSubmitting(true);
    setShopSubmitError(null);

    try {
      if (editingShopId === null) {
        throw new Error('Selecione um item da lista para configurar.');
      }

      const payload = {
        name: shopForm.name.trim(),
        description: shopForm.description.trim(),
        itemType: shopForm.itemType,
        priceCoins: Number(shopForm.priceCoins),
        rewardDefinitionId: parseNumber(shopForm.rewardDefinitionId),
        active: shopForm.active,
      };

      await updateShopItem(currentToken, editingShopId, payload);
      await loadShopItems();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar o item da loja.';
      setShopSubmitError(message);
    } finally {
      setShopSubmitting(false);
    }
  }

  function startEditingShopItem(item: AdminShopItem) {
    setEditingShopId(item.id);
    setShopForm({
      name: item.name,
      description: item.description,
      itemType: item.itemType,
      priceCoins: String(item.priceCoins),
      rewardDefinitionId: item.rewardDefinitionId ? String(item.rewardDefinitionId) : '',
      active: item.active,
    });
    setShopSubmitError(null);
  }

  async function handleSettingsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!currentToken) {
      return;
    }

    setSettingsSubmitting(true);
    setSettingsSubmitError(null);

    try {
      await updateSettings(currentToken, {
        maxQuestionsPerMatch: Number(settingsForm.maxQuestionsPerMatch),
        startingLives: Number(settingsForm.startingLives),
        rewardMatchLimitPerDay: Number(settingsForm.rewardMatchLimitPerDay),
        characterStudyXpPercent: Number(settingsForm.characterStudyXpPercent),
        maxExtraLifeBoosts: Number(settingsForm.maxExtraLifeBoosts),
        maxExtraTimeBoosts: Number(settingsForm.maxExtraTimeBoosts),
        maxDoubleXpBoosts: Number(settingsForm.maxDoubleXpBoosts),
        doubleXpMultiplier: Number(settingsForm.doubleXpMultiplier),
      });
      await loadSettings();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar as configurações.';
      setSettingsSubmitError(message);
    } finally {
      setSettingsSubmitting(false);
    }
  }

  const stats = {
    users: usersState.data.totalElements,
    characters: charactersState.data.length,
    questions: questionsState.data.length,
    rewards: rewardsState.data.length,
    shopItems: shopState.data.length,
  };

  const activeScreen = adminScreens.find((item) => item.id === screen) ?? adminScreens[0];

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <Card className="overflow-hidden">
          <CardHeader className="relative p-7 pb-0 sm:p-9 sm:pb-0">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Painel administrativo</p>
                <CardTitle className="mt-3 text-3xl sm:text-4xl">Gestão central da Coleção Bíblica</CardTitle>
                <CardDescription className="mt-3 max-w-3xl text-base">
                  {user ? `Olá, ${user.name}. Aqui você administra usuários, personagens, perguntas, recompensas, loja e configurações do jogo.` : 'Aqui você administra usuários, personagens, perguntas, recompensas, loja e configurações do jogo.'}
                </CardDescription>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <ThemeToggle />
                <Button variant="secondary" onClick={signOut} className="inline-flex items-center gap-2">
                  <LogoutRoundedIcon fontSize="small" />
                  Sair
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 p-7 pt-6 sm:p-9 sm:pt-7">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <StatPill label="Usuários" value={stats.users} />
              <StatPill label="Personagens" value={stats.characters} />
              <StatPill label="Perguntas" value={stats.questions} />
              <StatPill label="Recompensas" value={stats.rewards} />
              <StatPill label="Loja" value={stats.shopItems} />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--accent)]">Telas administrativas</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Tela atual: {activeScreen.label}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {adminScreens.map((item) => (
                <Button
                  key={item.id}
                  type="button"
                  variant={screen === item.id ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setScreen(item.id)}
                  className="inline-flex items-center gap-2"
                >
                  <span className="inline-flex items-center justify-center text-[0.95em]">{item.icon}</span>
                  {item.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {screen === 'overview' ? (
          <SectionCard title="Visão geral" description="Resumo rápido do estado do sistema e atalhos para os módulos principais.">
            <p className="text-sm leading-6 text-[var(--text-secondary)]">
              Use as telas acima para administrar usuários, criar personagens completos, manter o banco de perguntas, ajustar recompensas, gerir a loja e alterar as regras globais do jogo.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <Button type="button" variant="secondary" onClick={() => setScreen('users')}>
                Ir para usuários
              </Button>
              <Button type="button" variant="secondary" onClick={() => setScreen('characters')}>
                Ir para personagens
              </Button>
              <Button type="button" variant="secondary" onClick={() => setScreen('questions')}>
                Ir para perguntas
              </Button>
              <Button type="button" variant="secondary" onClick={() => setScreen('rewards')}>
                Ir para recompensas
              </Button>
              <Button type="button" variant="secondary" onClick={() => setScreen('shop')}>
                Ir para loja
              </Button>
              <Button type="button" variant="secondary" onClick={() => setScreen('settings')}>
                Ir para configurações
              </Button>
            </div>
          </SectionCard>
        ) : null}

        {screen === 'users' ? (
          <SectionCard
            title="Usuários"
            description="Listagem, exclusão e manutenção das contas do sistema."
          >
          <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end" onSubmit={applyUserFilters}>
            <Field label="Pesquisar por nome">
              <Input
                value={userNameDraft}
                onChange={(event) => setUserNameDraft(event.target.value)}
                placeholder="Ex.: João"
              />
            </Field>
            <Field label="Pesquisar por e-mail">
              <Input
                type="email"
                value={userEmailDraft}
                onChange={(event) => setUserEmailDraft(event.target.value)}
                placeholder="Ex.: email@dominio.com"
              />
            </Field>
            <Button type="submit" variant="secondary" className="inline-flex items-center gap-2" disabled={usersState.loading}>
              {usersState.loading ? <AutorenewRoundedIcon className="animate-spin" fontSize="small" /> : null}
              Buscar
            </Button>
            <Button type="button" onClick={openCreateUserModal}>Novo usuário</Button>
          </form>

          {usersState.loading ? <LoadingInline label="Carregando usuários..." /> : null}
          {usersState.error ? <p className="text-sm text-red-700">{usersState.error}</p> : null}
          {userSubmitError ? <p className="text-sm text-red-700">{userSubmitError}</p> : null}

          {(userNameFilter || userEmailFilter) && !usersState.loading ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
              <span>Filtro ativo:</span>
              {userNameFilter ? <span className="rounded-full border border-[var(--border)] px-3 py-1">Nome: {userNameFilter}</span> : null}
              {userEmailFilter ? <span className="rounded-full border border-[var(--border)] px-3 py-1">E-mail: {userEmailFilter}</span> : null}
              <Button type="button" size="sm" variant="ghost" onClick={resetUserFilters}>
                Limpar filtros
              </Button>
            </div>
          ) : null}

          {!usersState.loading ? (
            <div className="overflow-x-auto rounded-3xl border border-[var(--border)]">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[180px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersState.data.content.map((currentUser) => (
                    <TableRow key={currentUser.id}>
                      <TableCell>{currentUser.name}</TableCell>
                      <TableCell>{currentUser.email}</TableCell>
                      <TableCell>{currentUser.role}</TableCell>
                      <TableCell>{currentUser.deleted ? 'Excluído' : 'Ativo'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="secondary" onClick={() => startEditingUser(currentUser)}>
                            Editar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteUser(currentUser.id)}>
                            Excluir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {usersState.data.content.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>Nenhum usuário encontrado.</TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {!usersState.loading ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[var(--text-secondary)]">
                Total: {usersState.data.totalElements} usuário(s)
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  Itens por página
                  <select
                    className="h-9 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-primary)_86%,white)] px-2 text-sm text-[var(--text-primary)]"
                    value={usersPageSize}
                    onChange={(event) => changeUsersPageSize(Number(event.target.value))}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => goToUsersPage(usersPage - 1)}
                  disabled={usersPage <= 0}
                >
                  Anterior
                </Button>
                <span className="text-sm text-[var(--text-secondary)]">
                  Página {usersPage + 1} de {Math.max(usersState.data.totalPages, 1)}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => goToUsersPage(usersPage + 1)}
                  disabled={usersPage + 1 >= Math.max(usersState.data.totalPages, 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          ) : null}

          <ModalShell
            isOpen={isUserModalOpen}
            title={editingUserId === null ? 'Novo usuário' : 'Editar usuário'}
            description="Preencha os dados para criar ou atualizar o usuário."
            onClose={closeUserModal}
          >
            <form className="grid gap-4" onSubmit={handleUserSubmit}>
              <Field label="Nome">
                <Input
                  value={userForm.name}
                  onChange={(event) => setUserForm((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </Field>
              <Field label="E-mail">
                <Input
                  type="email"
                  value={userForm.email}
                  onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))}
                  required
                />
              </Field>
              <Field label="Senha" hint={editingUserId !== null ? 'Deixe em branco para manter a senha atual.' : undefined}>
                <Input
                  type="password"
                  value={userForm.password}
                  onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
                  required={editingUserId === null}
                />
              </Field>
              <Field label="Perfil">
                <select
                  className={selectClassName}
                  value={userForm.role}
                  onChange={(event) => setUserForm((current) => ({ ...current, role: event.target.value as Role }))}
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </Field>

              {userSubmitError ? <p className="text-sm text-red-700">{userSubmitError}</p> : null}

              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="secondary" onClick={closeUserModal} disabled={userSubmitting}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={userSubmitting} className="inline-flex items-center gap-2">
                  {userSubmitting ? <AutorenewRoundedIcon className="animate-spin" fontSize="small" /> : null}
                  {userSubmitting ? 'Salvando...' : editingUserId === null ? 'Criar usuário' : 'Atualizar usuário'}
                </Button>
              </div>
            </form>
          </ModalShell>
          </SectionCard>
        ) : null}

        {screen === 'characters' ? (
          <SectionCard
            title="Personagens"
            description="Cadastro completo das figurinhas e seus detalhes bíblicos."
          >
          <form className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end" onSubmit={applyCharacterFilter}>
            <Field label="Pesquisar por nome">
              <Input
                value={characterNameDraft}
                onChange={(event) => setCharacterNameDraft(event.target.value)}
                placeholder="Ex.: Davi"
              />
            </Field>
            <Button type="submit" variant="secondary" className="inline-flex items-center gap-2" disabled={charactersState.loading}>
              {charactersState.loading ? <AutorenewRoundedIcon className="animate-spin" fontSize="small" /> : null}
              Buscar
            </Button>
            <Button type="button" onClick={openCreateCharacterEditor}>Novo personagem</Button>
          </form>

          {charactersState.loading ? <LoadingInline label="Carregando personagens..." /> : null}
          {charactersState.error ? <p className="text-sm text-red-700">{charactersState.error}</p> : null}
          {characterSubmitError ? <p className="text-sm text-red-700">{characterSubmitError}</p> : null}

          {characterNameFilter && !charactersState.loading ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
              <span>Filtro ativo:</span>
              <span className="rounded-full border border-[var(--border)] px-3 py-1">Nome: {characterNameFilter}</span>
              <Button type="button" size="sm" variant="ghost" onClick={resetCharacterFilter}>
                Limpar filtro
              </Button>
            </div>
          ) : null}

          {!charactersState.loading ? (
            <div className="overflow-x-auto rounded-3xl border border-[var(--border)]">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Raridade</TableHead>
                    <TableHead>Resumo</TableHead>
                    <TableHead className="w-[180px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedCharacters.map((character) => (
                    <TableRow key={character.id}>
                      <TableCell>{character.name}</TableCell>
                      <TableCell>{getRarityLabel(character.rarity)}</TableCell>
                      <TableCell className="max-w-xl truncate">{stripHtmlToPlainText(character.shortSummary)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="secondary" onClick={() => startEditingCharacter(character)}>
                            Editar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteCharacter(character.id)}>
                            Excluir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {pagedCharacters.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4}>Nenhum personagem encontrado.</TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {!charactersState.loading ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[var(--text-secondary)]">
                Total: {filteredCharacters.length} personagem(ns)
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  Itens por página
                  <select
                    className="h-9 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-primary)_86%,white)] px-2 text-sm text-[var(--text-primary)]"
                    value={charactersPageSize}
                    onChange={(event) => changeCharactersPageSize(Number(event.target.value))}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => goToCharactersPage(charactersPage - 1)}
                  disabled={charactersPage <= 0}
                >
                  Anterior
                </Button>
                <span className="text-sm text-[var(--text-secondary)]">
                  Página {charactersPage + 1} de {totalCharacterPages}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => goToCharactersPage(charactersPage + 1)}
                  disabled={charactersPage + 1 >= totalCharacterPages}
                >
                  Próxima
                </Button>
              </div>
            </div>
          ) : null}

          {isCharacterEditorOpen ? (
            <Card className="border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-secondary)_74%,white)]">
              <CardHeader>
                <CardTitle>{editingCharacterId === null ? 'Nova figurinha' : 'Editar figurinha'}</CardTitle>
                <CardDescription>Editor completo para cadastro de conteúdo visual e textual.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid gap-5 lg:grid-cols-2" onSubmit={handleCharacterSubmit}>
                  <Field label="Nome">
                    <Input value={characterForm.name} onChange={(event) => setCharacterForm((current) => ({ ...current, name: event.target.value }))} required />
                  </Field>
                  <Field label="Raridade">
                    <select className={selectClassName} value={characterForm.rarity} onChange={(event) => setCharacterForm((current) => ({ ...current, rarity: event.target.value as StickerRarity }))}>
                      <option value="COMMON">Comum</option>
                      <option value="RARE">Rara</option>
                      <option value="EPIC">Épica</option>
                      <option value="LEGENDARY">Lendária</option>
                    </select>
                  </Field>

                  <div className="space-y-3 lg:col-span-2">
                    <div className="inline-flex w-full rounded-full border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-primary)_75%,white)] p-1">
                      <button
                        type="button"
                        onClick={() => setCharacterImageMode('url')}
                        className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                          characterImageMode === 'url'
                            ? 'bg-[linear-gradient(135deg,var(--gold),var(--gold-light))] text-[#2c1b10] shadow-sm'
                            : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        Link da imagem
                      </button>
                      <button
                        type="button"
                        onClick={() => setCharacterImageMode('upload')}
                        className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                          characterImageMode === 'upload'
                            ? 'bg-[linear-gradient(135deg,var(--gold),var(--gold-light))] text-[#2c1b10] shadow-sm'
                            : 'text-[var(--text-secondary)]'
                        }`}
                      >
                        Upload
                      </button>
                    </div>

                    {characterImageMode === 'url' ? (
                      <Field label="Imagem URL">
                        <Input
                          value={characterForm.imageUrl}
                          onChange={(event) => setCharacterForm((current) => ({ ...current, imageUrl: event.target.value }))}
                          placeholder="https://..."
                        />
                      </Field>
                    ) : (
                      <Field label="Upload da imagem" hint="A imagem é convertida para URL base64.">
                        <input className={controlClassName} type="file" accept="image/*" onChange={handleCharacterFileUpload} />
                      </Field>
                    )}

                    {characterForm.imageUrl ? (
                      <div className="relative rounded-2xl border border-[var(--border)] p-3">
                        <button
                          type="button"
                          aria-label="Remover imagem"
                          className="absolute right-5 top-5 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/70 bg-black/70 text-sm font-bold text-white shadow transition-colors hover:bg-black/80"
                          onClick={() => setCharacterForm((current) => ({ ...current, imageUrl: '' }))}
                        >
                          X
                        </button>
                        <img src={characterForm.imageUrl} alt="Pré-visualização" className="h-56 w-full rounded-xl object-cover" />
                      </div>
                    ) : null}
                  </div>

                  <Field label="Resumo curto" hint="Editor de texto com formatação.">
                    <RichTextEditor
                      syncKey={`${editingCharacterId ?? 'new'}:shortSummary`}
                      value={characterForm.shortSummary}
                      onChange={(nextValue) => setCharacterForm((current) => ({ ...current, shortSummary: nextValue }))}
                    />
                  </Field>

                  <Field label="Descrição completa" hint="Pode incluir imagens e texto formatado.">
                    <RichTextEditor
                      syncKey={`${editingCharacterId ?? 'new'}:fullDescription`}
                      value={characterForm.fullDescription}
                      onChange={(nextValue) => setCharacterForm((current) => ({ ...current, fullDescription: nextValue }))}
                      allowImages
                    />
                  </Field>

                  <Field label="Papel narrativo" hint="Pode incluir imagens e texto formatado.">
                    <RichTextEditor
                      syncKey={`${editingCharacterId ?? 'new'}:narrativeRole`}
                      value={characterForm.narrativeRole}
                      onChange={(nextValue) => setCharacterForm((current) => ({ ...current, narrativeRole: nextValue }))}
                      allowImages
                    />
                  </Field>

                  <Field label="Período histórico" hint="Pode incluir imagens e texto formatado.">
                    <RichTextEditor
                      syncKey={`${editingCharacterId ?? 'new'}:historicalPeriod`}
                      value={characterForm.historicalPeriod}
                      onChange={(nextValue) => setCharacterForm((current) => ({ ...current, historicalPeriod: nextValue }))}
                      allowImages
                    />
                  </Field>

                  <Field label="Curiosidades" hint="Pode incluir imagens e texto formatado.">
                    <RichTextEditor
                      syncKey={`${editingCharacterId ?? 'new'}:curiosities`}
                      value={characterForm.curiosities}
                      onChange={(nextValue) => setCharacterForm((current) => ({ ...current, curiosities: nextValue }))}
                      allowImages
                    />
                  </Field>

                  <Field label="Referências bíblicas" hint="Pode incluir imagens e texto formatado.">
                    <RichTextEditor
                      syncKey={`${editingCharacterId ?? 'new'}:bibleReferences`}
                      value={characterForm.bibleReferences}
                      onChange={(nextValue) => setCharacterForm((current) => ({ ...current, bibleReferences: nextValue }))}
                      allowImages
                    />
                  </Field>

                  <Field label="Livros bíblicos" hint="Selecione todos os livros onde o personagem aparece.">
                    <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-primary)_86%,white)] p-3">
                      {BIBLE_BOOKS_PT.map((book) => {
                        const checked = characterForm.bibleBooks.includes(book);
                        return (
                          <label key={book} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-[color-mix(in_srgb,var(--gold)_10%,transparent)]">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(event) => {
                                const isChecked = event.currentTarget.checked;
                                setCharacterForm((current) => ({
                                  ...current,
                                  bibleBooks: isChecked
                                    ? [...current.bibleBooks, book]
                                    : current.bibleBooks.filter((entry) => entry !== book),
                                }));
                              }}
                            />
                            <span className="text-sm text-[var(--text-primary)]">{book}</span>
                          </label>
                        );
                      })}
                    </div>
                  </Field>

                  <Field label="Genealogia" hint="Use Mermaid (graph TD). Dá para aplicar bloco de cores para melhorar visualização.">
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setCharacterForm((current) => ({ ...current, genealogy: appendMermaidColorTemplate(current.genealogy) }))}
                        >
                          Aplicar cores no gráfico
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setCharacterForm((current) => ({ ...current, genealogy: buildGenealogyTemplate(current.genealogy) }))}
                        >
                          Modelo pronto
                        </Button>
                      </div>
                      <textarea
                        className={textareaClassName}
                        value={characterForm.genealogy}
                        onChange={(event) => setCharacterForm((current) => ({ ...current, genealogy: event.target.value }))}
                        placeholder="graph TD\nAbraao[Abraão] --> Isaque[Isaque]"
                      />
                      <p className="text-xs text-[var(--text-secondary)]">
                        Dica: use ids estáveis como <span className="font-mono">Abraao[Abraão]</span> e aplique classes com <span className="font-mono">class Abraao principal;</span>.
                      </p>
                      <div className={markdownPreviewClassName}>
                        <MermaidDiagram code={characterForm.genealogy} className="[&_svg]:h-auto [&_svg]:w-full" />
                      </div>
                    </div>
                  </Field>

                  <Field label="Eventos importantes" hint="Use Mermaid timeline. O preview atualiza em tempo real e ajuda a detectar erros antes de salvar.">
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setCharacterForm((current) => ({ ...current, importantEvents: buildTimelineTemplate(current.importantEvents) }))}
                        >
                          Inserir modelo de timeline
                        </Button>
                      </div>
                      <textarea
                        className={textareaClassName}
                        value={characterForm.importantEvents}
                        onChange={(event) => setCharacterForm((current) => ({ ...current, importantEvents: event.target.value }))}
                        placeholder="timeline\n  title Eventos importantes\n  1 Samuel 16 : Ungido rei"
                      />
                      <p className="text-xs text-[var(--text-secondary)]">
                        A timeline aceita melhor eventos em linhas curtas. O preview abaixo atualiza em tempo real e mostra erros de sintaxe.
                      </p>
                      <div className={markdownPreviewClassName}>
                        <MermaidDiagram code={characterForm.importantEvents} className="[&_svg]:h-auto [&_svg]:w-full" />
                      </div>
                    </div>
                  </Field>

                  <Field label="Versículos-chave" hint="Separe por vírgula para gerar chips visuais no front do usuário.">
                    <Input
                      value={characterForm.keyVerses}
                      onChange={(event) => setCharacterForm((current) => ({ ...current, keyVerses: event.target.value }))}
                      placeholder="João 3:16, Salmos 23:1"
                    />
                  </Field>

                  <Field label="Palavras-chave" hint="Separe por vírgula para gerar chips visuais no front do usuário.">
                    <Input
                      value={characterForm.keywords}
                      onChange={(event) => setCharacterForm((current) => ({ ...current, keywords: event.target.value }))}
                      placeholder="rei, pastor, aliança"
                    />
                  </Field>

                  <div className="space-y-2 lg:col-span-2">
                    <p className="text-sm font-medium text-[var(--text-secondary)]">Prévia rápida do resumo</p>
                    <div className={markdownPreviewClassName}>
                      <RichContent value={characterForm.shortSummary} />
                    </div>
                  </div>

                  {characterSubmitError ? <p className="lg:col-span-2 text-sm text-red-700">{characterSubmitError}</p> : null}

                  <div className="flex flex-wrap justify-end gap-2 lg:col-span-2">
                    <Button type="button" variant="secondary" onClick={closeCharacterEditor} disabled={characterSubmitting}>
                      <ArrowBackRoundedIcon fontSize="small" />
                      Voltar para listagem
                    </Button>
                    <Button type="submit" disabled={characterSubmitting} className="inline-flex items-center gap-2">
                      {characterSubmitting ? <AutorenewRoundedIcon className="animate-spin" fontSize="small" /> : null}
                      {characterSubmitting ? 'Salvando...' : editingCharacterId === null ? 'Criar personagem' : 'Atualizar personagem'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : null}
          </SectionCard>
        ) : null}

        {screen === 'questions' ? (
          <SectionCard
            title="Perguntas"
            description="Criação e manutenção do banco de quiz usado nas partidas."
          >
          <form className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end" onSubmit={applyQuestionFilter}>
            <Field label="Pesquisar pergunta ou personagem">
              <Input
                value={questionTextDraft}
                onChange={(event) => setQuestionTextDraft(event.target.value)}
                placeholder="Ex.: Golias"
              />
            </Field>
            <Button type="submit" variant="secondary" className="inline-flex items-center gap-2" disabled={questionsState.loading}>
              {questionsState.loading ? <AutorenewRoundedIcon className="animate-spin" fontSize="small" /> : null}
              Buscar
            </Button>
            <Button type="button" onClick={openCreateQuestionModal}>Nova pergunta</Button>
          </form>

          {questionsState.loading ? <LoadingInline label="Carregando perguntas..." /> : null}
          {questionsState.error ? <p className="text-sm text-red-700">{questionsState.error}</p> : null}
          {questionSubmitError ? <p className="text-sm text-red-700">{questionSubmitError}</p> : null}

          {questionTextFilter && !questionsState.loading ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
              <span>Filtro ativo:</span>
              <span className="rounded-full border border-[var(--border)] px-3 py-1">{questionTextFilter}</span>
              <Button type="button" size="sm" variant="ghost" onClick={resetQuestionFilter}>
                Limpar filtro
              </Button>
            </div>
          ) : null}

          {!questionsState.loading ? (
            <div className="overflow-x-auto rounded-3xl border border-[var(--border)]">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Pergunta</TableHead>
                    <TableHead>Dificuldade</TableHead>
                    <TableHead>Corretta</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[180px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedQuestions.map((question) => (
                    <TableRow key={question.id}>
                      <TableCell className="max-w-xl truncate">{question.text}</TableCell>
                      <TableCell>{question.difficulty}</TableCell>
                      <TableCell>{question.correctOption}</TableCell>
                      <TableCell>{question.active ? 'Ativa' : 'Inativa'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="secondary" onClick={() => startEditingQuestion(question)}>
                            Editar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteQuestion(question.id)}>
                            Excluir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {pagedQuestions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>Nenhuma pergunta encontrada.</TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          ) : null}

          {!questionsState.loading ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[var(--text-secondary)]">
                Total: {filteredQuestions.length} pergunta(s)
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  Itens por página
                  <select
                    className="h-9 rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-primary)_86%,white)] px-2 text-sm text-[var(--text-primary)]"
                    value={questionsPageSize}
                    onChange={(event) => changeQuestionsPageSize(Number(event.target.value))}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => goToQuestionsPage(questionsPage - 1)}
                  disabled={questionsPage <= 0}
                >
                  Anterior
                </Button>
                <span className="text-sm text-[var(--text-secondary)]">
                  Página {questionsPage + 1} de {totalQuestionPages}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => goToQuestionsPage(questionsPage + 1)}
                  disabled={questionsPage + 1 >= totalQuestionPages}
                >
                  Próxima
                </Button>
              </div>
            </div>
          ) : null}

          <ModalShell
            isOpen={isQuestionModalOpen}
            title={editingQuestionId === null ? 'Nova pergunta' : 'Editar pergunta'}
            description="Defina enunciado, alternativas e configuração da pergunta."
            onClose={closeQuestionModal}
          >
            <form className="grid gap-4 lg:grid-cols-2" onSubmit={handleQuestionSubmit}>
              <Field label="Pergunta" hint="Texto da questão exibida ao jogador.">
                <textarea className={textareaClassName} value={questionForm.text} onChange={(event) => setQuestionForm((current) => ({ ...current, text: event.target.value }))} required />
              </Field>
              <Field label="Dificuldade">
                <select className={selectClassName} value={questionForm.difficulty} onChange={(event) => setQuestionForm((current) => ({ ...current, difficulty: event.target.value as QuestionDifficulty }))}>
                  <option value="EASY">EASY</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HARD">HARD</option>
                  <option value="VERY_HARD">VERY_HARD</option>
                </select>
              </Field>
              <Field label="Tempo em segundos">
                <Input type="number" min={5} max={120} value={questionForm.timeLimitSeconds} onChange={(event) => setQuestionForm((current) => ({ ...current, timeLimitSeconds: event.target.value }))} required />
              </Field>
              <Field label="Opção A">
                <Input value={questionForm.optionA} onChange={(event) => setQuestionForm((current) => ({ ...current, optionA: event.target.value }))} required />
              </Field>
              <Field label="Opção B">
                <Input value={questionForm.optionB} onChange={(event) => setQuestionForm((current) => ({ ...current, optionB: event.target.value }))} required />
              </Field>
              <Field label="Opção C">
                <Input value={questionForm.optionC} onChange={(event) => setQuestionForm((current) => ({ ...current, optionC: event.target.value }))} required />
              </Field>
              <Field label="Opção D">
                <Input value={questionForm.optionD} onChange={(event) => setQuestionForm((current) => ({ ...current, optionD: event.target.value }))} required />
              </Field>
              <Field label="Resposta correta">
                <select className={selectClassName} value={questionForm.correctOption} onChange={(event) => setQuestionForm((current) => ({ ...current, correctOption: event.target.value }))}>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </select>
              </Field>
              <Field label="Personagem relacionado">
                <select className={selectClassName} value={questionForm.relatedCharacterId} onChange={(event) => setQuestionForm((current) => ({ ...current, relatedCharacterId: event.target.value }))}>
                  <option value="">Nenhum</option>
                  {characterOptions.map((character) => (
                    <option key={character.id} value={character.id}>
                      {character.name}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-primary)_86%,white)] px-4 py-3 text-sm text-[var(--text-secondary)] lg:col-span-2">
                <input type="checkbox" checked={questionForm.active} onChange={(event) => setQuestionForm((current) => ({ ...current, active: event.target.checked }))} />
                Pergunta ativa
              </label>
              {questionSubmitError ? <p className="lg:col-span-2 text-sm text-red-700">{questionSubmitError}</p> : null}
              <div className="flex flex-wrap justify-end gap-2 lg:col-span-2">
                <Button type="button" variant="secondary" onClick={closeQuestionModal} disabled={questionSubmitting}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={questionSubmitting} className="inline-flex items-center gap-2">
                  {questionSubmitting ? <AutorenewRoundedIcon className="animate-spin" fontSize="small" /> : null}
                  {questionSubmitting ? 'Salvando...' : editingQuestionId === null ? 'Criar pergunta' : 'Atualizar pergunta'}
                </Button>
              </div>
            </form>
          </ModalShell>
          </SectionCard>
        ) : null}

        {screen === 'rewards' ? (
          <SectionCard
            title={editingRewardId === null ? 'Recompensas fixas' : `Configurar: ${rewardForm.name}`}
            description="As recompensas são fixas do sistema. Aqui você ajusta probabilidades e configurações."
          >
            <form className="grid gap-4 lg:grid-cols-2" onSubmit={handleRewardSubmit}>
              <Field label="Nome interno" hint="Esse nome identifica a recompensa no sistema.">
                <Input value={rewardForm.name} onChange={(event) => setRewardForm((current) => ({ ...current, name: event.target.value }))} required disabled />
              </Field>
              <Field label="Tipo fixo" hint="O tipo é definido pelo sistema e não pode ser trocado aqui.">
                <select className={selectClassName} value={rewardForm.rewardType} onChange={(event) => setRewardForm((current) => ({ ...current, rewardType: event.target.value as RewardType }))} disabled>
                  <option value="STICKER">Figurinha</option>
                  <option value="EXTRA_LIFE">Vida extra</option>
                  <option value="EXTRA_TIME">Tempo extra</option>
                  <option value="XP_MULTIPLIER">XP em dobro</option>
                  <option value="COINS">Moedas</option>
                </select>
              </Field>

              {rewardForm.rewardType === 'STICKER' ? (
                <>
                  <Field label="Raridade da figurinha" hint="Usada para sortear uma figurinha aleatória desta raridade.">
                    <select className={selectClassName} value={rewardForm.stickerRarity} onChange={(event) => setRewardForm((current) => ({ ...current, stickerRarity: event.target.value as StickerRarity }))}>
                      <option value="COMMON">COMMON</option>
                      <option value="RARE">RARE</option>
                      <option value="EPIC">EPIC</option>
                      <option value="LEGENDARY">LEGENDARY</option>
                    </select>
                  </Field>
                  <Field label="Personagem vinculado" hint="Opcional. Use apenas se quiser forçar uma figurinha específica.">
                    <select className={selectClassName} value={rewardForm.stickerCharacterId} onChange={(event) => setRewardForm((current) => ({ ...current, stickerCharacterId: event.target.value }))}>
                      <option value="">Nenhum</option>
                      {characterOptions.map((character) => (
                        <option key={character.id} value={character.id}>
                          {character.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </>
              ) : null}

              {rewardForm.rewardType === 'COINS' ? (
                <Field label="Moedas concedidas" hint="Quantidade entregue quando a recompensa for sorteada.">
                  <Input type="number" min={0} value={rewardForm.coinAmount} onChange={(event) => setRewardForm((current) => ({ ...current, coinAmount: event.target.value }))} />
                </Field>
              ) : null}

              {rewardForm.rewardType === 'EXTRA_LIFE' ? (
                <Field label="Vidas concedidas" hint="Quantidade de bônus acumulada no inventário do usuário.">
                  <Input type="number" min={0} value={rewardForm.extraLives} onChange={(event) => setRewardForm((current) => ({ ...current, extraLives: event.target.value }))} />
                </Field>
              ) : null}

              {rewardForm.rewardType === 'EXTRA_TIME' ? (
                <Field label="Tempo concedido" hint="Quantidade de segundos extras acumulada no inventário do usuário.">
                  <Input type="number" min={0} value={rewardForm.extraTimeSeconds} onChange={(event) => setRewardForm((current) => ({ ...current, extraTimeSeconds: event.target.value }))} />
                </Field>
              ) : null}

              {rewardForm.rewardType === 'XP_MULTIPLIER' ? (
                <Field label="Multiplicador de XP" hint="Valor aplicado quando o bônus for usado na partida.">
                  <Input type="number" min={0} step="0.1" value={rewardForm.xpMultiplier} onChange={(event) => setRewardForm((current) => ({ ...current, xpMultiplier: event.target.value }))} />
                </Field>
              ) : null}

              <Field label="Chance de drop" hint="Probabilidade relativa usada no sorteio.">
                <Input type="number" min={0.0001} step="0.0001" value={rewardForm.dropChance} onChange={(event) => setRewardForm((current) => ({ ...current, dropChance: event.target.value }))} required />
              </Field>

              <label className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-primary)_86%,white)] px-4 py-3 text-sm text-[var(--text-secondary)] lg:col-span-2">
                <input type="checkbox" checked={rewardForm.active} onChange={(event) => setRewardForm((current) => ({ ...current, active: event.target.checked }))} />
                Recompensa ativa
              </label>

              {rewardSubmitError ? <p className="lg:col-span-2 text-sm text-red-700">{rewardSubmitError}</p> : null}
              <div className="flex flex-wrap gap-3 lg:col-span-2">
                <Button type="submit" disabled={rewardSubmitting || editingRewardId === null} className="inline-flex items-center gap-2">
                  {rewardSubmitting ? <AutorenewRoundedIcon className="animate-spin" fontSize="small" /> : null}
                  {rewardSubmitting ? 'Salvando...' : 'Salvar configuração'}
                </Button>
                {editingRewardId !== null ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      const currentReward = rewardsState.data.find((reward) => reward.id === editingRewardId);
                      if (currentReward) {
                        startEditingReward(currentReward);
                      }
                      setRewardSubmitError(null);
                    }}
                  >
                    Desfazer alterações
                  </Button>
                ) : null}
              </div>
            </form>

          {rewardsState.loading ? <p className="text-sm text-[var(--text-secondary)]">Carregando recompensas...</p> : null}
          {rewardsState.error ? <p className="text-sm text-red-700">{rewardsState.error}</p> : null}

          {!rewardsState.loading ? (
            <div className="overflow-x-auto rounded-3xl border border-[var(--border)]">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Configuração</TableHead>
                    <TableHead>Chance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[180px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rewardsState.data.map((reward) => (
                    <TableRow key={reward.id}>
                      <TableCell>{reward.name}</TableCell>
                      <TableCell>{reward.rewardType.replace('_', ' ')}</TableCell>
                      <TableCell>{formatRewardSummary(reward)}</TableCell>
                      <TableCell>{reward.dropChance}</TableCell>
                      <TableCell>{reward.active ? 'Ativa' : 'Inativa'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="secondary" onClick={() => startEditingReward(reward)}>
                            Configurar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rewardsState.data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>Nenhuma recompensa encontrada.</TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          ) : null}
          </SectionCard>
        ) : null}

        {screen === 'shop' ? (
          <SectionCard
            title="Loja"
            description="Catálogo fixo da loja. Apenas configuração de preço, descrição e status."
          >
          <form className="grid gap-4 lg:grid-cols-2" onSubmit={handleShopSubmit}>
            <Field label="Nome">
              <Input value={shopForm.name} onChange={(event) => setShopForm((current) => ({ ...current, name: event.target.value }))} required disabled />
            </Field>
            <Field label="Descrição">
              <textarea className={textareaClassName} value={shopForm.description} onChange={(event) => setShopForm((current) => ({ ...current, description: event.target.value }))} required />
            </Field>
            <Field label="Tipo do item">
              <select className={selectClassName} value={shopForm.itemType} onChange={(event) => setShopForm((current) => ({ ...current, itemType: event.target.value as ShopItemType }))} disabled>
                <option value="STICKER">STICKER</option>
                <option value="GAME_BONUS">GAME_BONUS</option>
                <option value="ECONOMY">ECONOMY</option>
              </select>
            </Field>
            <Field label="Preço em moedas">
              <Input type="number" min={0} value={shopForm.priceCoins} onChange={(event) => setShopForm((current) => ({ ...current, priceCoins: event.target.value }))} required />
            </Field>
            <Field label="Recompensa vinculada">
              <select className={selectClassName} value={shopForm.rewardDefinitionId} onChange={(event) => setShopForm((current) => ({ ...current, rewardDefinitionId: event.target.value }))} disabled>
                <option value="">Nenhuma</option>
                {shopRewardOptions.map((reward) => (
                  <option key={reward.id} value={reward.id}>
                    {reward.name}
                  </option>
                ))}
              </select>
            </Field>
            <label className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-primary)_86%,white)] px-4 py-3 text-sm text-[var(--text-secondary)] lg:col-span-2">
              <input type="checkbox" checked={shopForm.active} onChange={(event) => setShopForm((current) => ({ ...current, active: event.target.checked }))} />
              Item ativo
            </label>
            {shopSubmitError ? <p className="lg:col-span-2 text-sm text-red-700">{shopSubmitError}</p> : null}
            <div className="flex flex-wrap gap-3 lg:col-span-2">
              <Button type="submit" disabled={shopSubmitting}>
                {shopSubmitting ? 'Salvando...' : 'Salvar configuração'}
              </Button>
            </div>
          </form>

          {shopState.loading ? <p className="text-sm text-[var(--text-secondary)]">Carregando loja...</p> : null}
          {shopState.error ? <p className="text-sm text-red-700">{shopState.error}</p> : null}

          {!shopState.loading ? (
            <div className="overflow-x-auto rounded-3xl border border-[var(--border)]">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Recompensa</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[110px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shopState.data.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.itemType}</TableCell>
                      <TableCell>{item.rewardName ?? '-'}</TableCell>
                      <TableCell>{item.priceCoins}</TableCell>
                      <TableCell>{item.active ? 'Ativo' : 'Inativo'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="secondary" onClick={() => startEditingShopItem(item)}>
                            Editar
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {shopState.data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>Nenhum item encontrado.</TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          ) : null}
          </SectionCard>
        ) : null}

        {screen === 'settings' ? (
          <SectionCard title="Configurações do jogo" description="Parâmetros globais usados no quiz e na progressão.">
          <form className="grid gap-4 lg:grid-cols-2" onSubmit={handleSettingsSubmit}>
            <Field label="Máximo de perguntas por partida">
              <Input type="number" min={1} max={1000} value={settingsForm.maxQuestionsPerMatch} onChange={(event) => setSettingsForm((current) => ({ ...current, maxQuestionsPerMatch: event.target.value }))} required />
            </Field>
            <Field label="Vidas iniciais">
              <Input type="number" min={1} max={20} value={settingsForm.startingLives} onChange={(event) => setSettingsForm((current) => ({ ...current, startingLives: event.target.value }))} required />
            </Field>
            <Field label="Limite diário de recompensas">
              <Input type="number" min={0} max={20} value={settingsForm.rewardMatchLimitPerDay} onChange={(event) => setSettingsForm((current) => ({ ...current, rewardMatchLimitPerDay: event.target.value }))} required />
            </Field>
            <Field label="XP do estudo de personagem (%)">
              <Input type="number" min={0} max={100} value={settingsForm.characterStudyXpPercent} onChange={(event) => setSettingsForm((current) => ({ ...current, characterStudyXpPercent: event.target.value }))} required />
            </Field>
            <Field label="Limite de acúmulo: vida extra">
              <Input type="number" min={1} max={20} value={settingsForm.maxExtraLifeBoosts} onChange={(event) => setSettingsForm((current) => ({ ...current, maxExtraLifeBoosts: event.target.value }))} required />
            </Field>
            <Field label="Limite de acúmulo: tempo extra">
              <Input type="number" min={1} max={20} value={settingsForm.maxExtraTimeBoosts} onChange={(event) => setSettingsForm((current) => ({ ...current, maxExtraTimeBoosts: event.target.value }))} required />
            </Field>
            <Field label="Limite de acúmulo: XP em dobro">
              <Input type="number" min={1} max={20} value={settingsForm.maxDoubleXpBoosts} onChange={(event) => setSettingsForm((current) => ({ ...current, maxDoubleXpBoosts: event.target.value }))} required />
            </Field>
            <Field label="Multiplicador de XP em dobro">
              <Input type="number" min={1} max={10} step="0.1" value={settingsForm.doubleXpMultiplier} onChange={(event) => setSettingsForm((current) => ({ ...current, doubleXpMultiplier: event.target.value }))} required />
            </Field>
            {settingsSubmitError ? <p className="lg:col-span-2 text-sm text-red-700">{settingsSubmitError}</p> : null}
            {settingsState.error ? <p className="lg:col-span-2 text-sm text-red-700">{settingsState.error}</p> : null}
            <div className="flex flex-wrap gap-3 lg:col-span-2">
              <Button type="submit" disabled={settingsSubmitting}>
                {settingsSubmitting ? 'Salvando...' : 'Salvar configurações'}
              </Button>
              <Button type="button" variant="secondary" onClick={loadSettings}>
                Recarregar
              </Button>
            </div>
          </form>
          </SectionCard>
        ) : null}
      </div>

      <ModalShell
        isOpen={deleteTarget !== null}
        title={deleteTarget?.label ?? 'Confirmar exclusão'}
        description={deleteTarget?.message ?? 'Confirme esta ação.'}
        onClose={closeDeleteTarget}
      >
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={closeDeleteTarget} disabled={deleteSubmitting}>
            Cancelar
          </Button>
          <Button type="button" variant="ghost" onClick={confirmDeleteTarget} disabled={deleteSubmitting}>
            {deleteSubmitting ? 'Excluindo...' : 'Excluir'}
          </Button>
        </div>
      </ModalShell>
    </main>
  );
}

function ModalShell({
  isOpen,
  title,
  description,
  onClose,
  children,
}: {
  isOpen: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-0 sm:p-4" role="dialog" aria-modal="true">
      <div className="h-[100dvh] w-full max-w-none overflow-auto border border-[var(--border)] bg-[var(--bg-secondary)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] sm:h-auto sm:max-h-[90vh] sm:max-w-2xl sm:rounded-3xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="font-[family-name:var(--font-heading)] text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
              {title}
            </h3>
            {description ? <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{description}</p> : null}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Fechar modal" title="Fechar">
            <CloseRoundedIcon fontSize="small" />
          </Button>
        </div>

        {children}
      </div>
    </div>
  );
}

function LoadingInline({ label }: { label: string }) {
  return (
    <p className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)]">
      <AutorenewRoundedIcon className="animate-spin" fontSize="small" />
      {label}
    </p>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-primary)_80%,white)] px-4 py-3 text-center">
      <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{value}</div>
    </div>
  );
}
