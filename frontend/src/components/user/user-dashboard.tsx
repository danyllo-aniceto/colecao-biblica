'use client';

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import QuizRoundedIcon from '@mui/icons-material/QuizRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import ClearRoundedIcon from '@mui/icons-material/ClearRounded';
import { useAuth } from '@/components/providers/auth-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { QuizAnswerScreen, type QuizAnswerPayload } from '@/components/user/quiz-answer-screen';
import { getRarityLabel, rarityConfig } from '@/lib/rarity-theme';
import {
  answerQuizQuestion,
  abandonQuizSession,
  deleteCurrentUser,
  getActiveQuizSession,
  getCollection,
  getCollectionProgress,
  getCurrentUser,
  getMyComments,
  getQuizHistory,
  listCharacters,
  listRanking,
  startQuizSession,
  updateCurrentUser,
  type QuizMatchResult,
  type CharacterEntry,
  type CollectionProgress,
  type CommentEntry,
  type QuizHistory,
  type QuizSessionStatus,
  type RankingEntry,
  type StartQuizSessionPayload,
  type UserSticker,
} from '@/lib/user-api';
import type { UserProfile } from '@/types/auth';

type SectionId = 'home' | 'stickers' | 'quiz' | 'ranking' | 'settings';

type DeleteAccountState = {
  open: boolean;
  password: string;
};

type QuizFormState = {
  quizType: 'GENERAL' | 'CHARACTER_STUDY';
  characterId: string;
  questionLimit: string;
};

type FeedbackMessage = {
  type: 'success' | 'error';
  text: string;
};

type StickerFilters = {
  rarity: string[];
  book: string[];
};

type StickerSortOption = 'alphabetical' | 'rarityAsc' | 'rarityDesc';

const sections: Array<{ id: SectionId; label: string; icon: ReactNode }> = [
  { id: 'home', label: 'Home', icon: <HomeRoundedIcon fontSize="inherit" /> },
  { id: 'stickers', label: 'Figurinhas', icon: <CollectionsBookmarkRoundedIcon fontSize="inherit" /> },
  { id: 'quiz', label: 'Quiz', icon: <QuizRoundedIcon fontSize="inherit" /> },
  { id: 'ranking', label: 'Ranking', icon: <EmojiEventsRoundedIcon fontSize="inherit" /> },
  { id: 'settings', label: 'Configurações', icon: <SettingsRoundedIcon fontSize="inherit" /> },
];

const emptyQuizForm: QuizFormState = {
  quizType: 'GENERAL',
  characterId: '',
  questionLimit: '10',
};

const controlClassName =
  'flex h-11 w-full rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-primary)_88%,white)] px-4 text-sm text-[var(--text-primary)] shadow-sm transition-colors placeholder:text-[var(--text-secondary)]/70 focus-visible:border-[var(--gold)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--gold)_35%,transparent)]';

function SectionFrame({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-secondary)_74%,white)]">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function MetricCard({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint?: string }) {
  return (
    <Card className="border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-secondary)_70%,white)]">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--gold)_15%,transparent)] text-[var(--accent)]">
          {icon}
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">{label}</div>
          <div className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{value}</div>
          {hint ? <div className="text-sm text-[var(--text-secondary)]">{hint}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  isLoading,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  isLoading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--bg-secondary)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <h3 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[var(--text-primary)]">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="button" variant="ghost" onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Processando...' : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function UserDashboard() {
  const { accessToken, user, signOut } = useAuth();
  const router = useRouter();

  const [section, setSection] = useState<SectionId>('home');
  const [profile, setProfile] = useState<UserProfile | null>(user);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState<CharacterEntry[]>([]);
  const [collection, setCollection] = useState<UserSticker[]>([]);
  const [collectionProgress, setCollectionProgress] = useState<CollectionProgress | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [comments, setComments] = useState<CommentEntry[]>([]);
  const [history, setHistory] = useState<QuizHistory | null>(null);
  const [activeSession, setActiveSession] = useState<QuizSessionStatus | null>(null);
  const [quizForm, setQuizForm] = useState<QuizFormState>(emptyQuizForm);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizSession, setQuizSession] = useState<QuizSessionStatus | null>(null);
  const [showQuizAnswer, setShowQuizAnswer] = useState(false);
  const [rewardModalData, setRewardModalData] = useState<QuizMatchResult | null>(null);
  const [accountForm, setAccountForm] = useState({ name: user?.name ?? '', email: user?.email ?? '', password: '' });
  const [accountError, setAccountError] = useState<string | null>(null);
  const [accountFeedback, setAccountFeedback] = useState<FeedbackMessage | null>(null);
  const [accountSubmitting, setAccountSubmitting] = useState(false);
  const [deleteAccount, setDeleteAccount] = useState<DeleteAccountState>({ open: false, password: '' });
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [stickerFilters, setStickerFilters] = useState<StickerFilters>({ rarity: [], book: [] });
  const [isStickerFilterModalOpen, setIsStickerFilterModalOpen] = useState(false);
  const [stickerSortBy, setStickerSortBy] = useState<StickerSortOption>('alphabetical');
  const [stickerPage, setStickerPage] = useState(1);
  const [stickersPerPage, setStickersPerPage] = useState<12 | 24 | 36>(12);

  useEffect(() => {
    setAccountForm({ name: user?.name ?? '', email: user?.email ?? '', password: '' });
    setProfile(user);
  }, [user]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    let ignore = false;

    async function loadDashboard() {
      setLoading(true);
      setProfileError(null);

      const token = accessToken as string;
      const results = await Promise.allSettled([
        getCurrentUser(token),
        listCharacters(token),
        getCollection(token),
        getCollectionProgress(token),
        listRanking(token),
        getMyComments(token),
        getQuizHistory(token, 5),
        getActiveQuizSession(token),
      ]);

      if (ignore) {
        return;
      }

      const [profileResult, charactersResult, collectionResult, progressResult, rankingResult, commentsResult, historyResult, activeResult] = results;

      if (profileResult.status === 'fulfilled') {
        setProfile(profileResult.value);
        setAccountForm((state) => ({ ...state, name: profileResult.value.name, email: profileResult.value.email }));
      } else {
        setProfileError('Não foi possível carregar seu perfil.');
      }

      if (charactersResult.status === 'fulfilled') {
        setCharacters(charactersResult.value);
      }

      if (collectionResult.status === 'fulfilled') {
        setCollection(collectionResult.value);
      }

      if (progressResult.status === 'fulfilled') {
        setCollectionProgress(progressResult.value);
      }

      if (rankingResult.status === 'fulfilled') {
        setRanking(rankingResult.value);
      }

      if (commentsResult.status === 'fulfilled') {
        setComments(commentsResult.value);
      }

      if (historyResult.status === 'fulfilled') {
        setHistory(historyResult.value);
      }

      if (activeResult.status === 'fulfilled') {
        setActiveSession(activeResult.value);
        setQuizSession(activeResult.value);
      }

      setLoading(false);
    }

    void loadDashboard();

    return () => {
      ignore = true;
    };
  }, [accessToken]);

  const ownedIds = useMemo(() => new Set(collection.map((item) => item.characterId)), [collection]);

  const uniqueBooks = useMemo(() => {
    const books = new Set<string>();
    characters.forEach((char) => {
      if (char.bibleBooks) {
        char.bibleBooks.split(',').forEach((book) => books.add(book.trim()));
      }
    });
    return Array.from(books).sort();
  }, [characters]);

  const uniqueRarities = useMemo(() => {
    const rarities = new Set(characters.map((c) => c.rarity));
    return Array.from(rarities);
  }, [characters]);

  const sortedAndFilteredCharacters = useMemo(() => {
    const rarityOrder: Record<string, number> = {
      COMMON: 1,
      RARE: 2,
      EPIC: 3,
      LEGENDARY: 4,
    };

    const filtered = characters.filter((char) => {
      const matchesRarity = stickerFilters.rarity.length === 0 || stickerFilters.rarity.includes(char.rarity);
      const matchesBook = stickerFilters.book.length === 0 || (char.bibleBooks && stickerFilters.book.some((book) => char.bibleBooks?.includes(book)));
      return matchesRarity && matchesBook;
    });

    return [...filtered].sort((left, right) => {
      if (stickerSortBy === 'alphabetical') {
        return left.name.localeCompare(right.name, 'pt-BR', { sensitivity: 'base' });
      }

      const rarityDiff = (rarityOrder[left.rarity] ?? 999) - (rarityOrder[right.rarity] ?? 999);
      if (rarityDiff !== 0) {
        return stickerSortBy === 'rarityAsc' ? rarityDiff : -rarityDiff;
      }

      return left.name.localeCompare(right.name, 'pt-BR', { sensitivity: 'base' });
    });
  }, [characters, stickerFilters, stickerSortBy]);

  const totalStickerPages = Math.max(1, Math.ceil(sortedAndFilteredCharacters.length / stickersPerPage));

  useEffect(() => {
    setStickerPage(1);
  }, [stickerFilters, stickerSortBy, stickersPerPage]);

  useEffect(() => {
    if (stickerPage > totalStickerPages) {
      setStickerPage(totalStickerPages);
    }
  }, [stickerPage, totalStickerPages]);

  const paginatedCharacters = useMemo(() => {
    const start = (stickerPage - 1) * stickersPerPage;
    return sortedAndFilteredCharacters.slice(start, start + stickersPerPage);
  }, [sortedAndFilteredCharacters, stickerPage, stickersPerPage]);

  const showingFrom = sortedAndFilteredCharacters.length === 0 ? 0 : (stickerPage - 1) * stickersPerPage + 1;
  const showingTo = Math.min(stickerPage * stickersPerPage, sortedAndFilteredCharacters.length);

  async function handleStartQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    setQuizSubmitting(true);
    setQuizError(null);
    setQuizFeedback(null);

    try {
      const token = accessToken as string;
      const payload: StartQuizSessionPayload = {
        quizType: quizForm.quizType,
        characterId: quizForm.quizType === 'CHARACTER_STUDY' ? Number(quizForm.characterId) : null,
        questionLimit: Number(quizForm.questionLimit),
      };

      const session = await startQuizSession(token, payload);
      setQuizSession(session);
      setActiveSession(session);
      setShowQuizAnswer(true);
    } catch (error) {
      setQuizError(error instanceof Error ? error.message : 'Não foi possível iniciar o quiz.');
    } finally {
      setQuizSubmitting(false);
    }
  }

  async function handleAnswerQuiz(payload: QuizAnswerPayload) {
    if (!accessToken) return;

    try {
      const token = accessToken as string;
      const result = await answerQuizQuestion(token, payload.sessionId, {
        questionId: payload.questionId,
        selectedOption: payload.selectedOption,
        useExtraLife: payload.useExtraLife,
        useExtraTime: payload.useExtraTime,
        useXpMultiplier: payload.useXpMultiplier,
      });

      if (result.finished) {
        setQuizSession(null);
        setActiveSession(null);
        setShowQuizAnswer(false);

        const [historyResult, profileResult, collectionResult, progressResult] = await Promise.allSettled([
          getQuizHistory(token, 5),
          getCurrentUser(token),
          getCollection(token),
          getCollectionProgress(token),
        ]);
        if (historyResult.status === 'fulfilled') {
          setHistory(historyResult.value);
        }
        if (profileResult.status === 'fulfilled') {
          setProfile(profileResult.value);
        }
        if (collectionResult.status === 'fulfilled') {
          setCollection(collectionResult.value);
        }
        if (progressResult.status === 'fulfilled') {
          setCollectionProgress(progressResult.value);
        }

        setRewardModalData(
          result.matchResult ?? {
            matchId: 0,
            xpGained: 0,
            scoreGained: 0,
            rewardGranted: false,
            rewardName: null,
            userXp: profile?.xp ?? 0,
            userLevel: profile?.level ?? 1,
            userCoins: profile?.coins ?? 0,
            rewardMatchesUsedToday: 0,
            rewardMatchesLimitPerDay: 0,
          },
        );

        return;
      }

      setQuizSession((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          livesRemaining: result.livesRemaining,
          correctAnswers: result.correctAnswers,
          wrongAnswers: result.wrongAnswers,
          currentQuestionIndex: current.currentQuestionIndex + 1,
          currentQuestion: result.nextQuestion ?? null,
        };
      });

      setQuizFeedback(result.correct ? 'Resposta correta!' : 'Resposta incorreta.');
    } catch (error) {
      setQuizError(error instanceof Error ? error.message : 'Não foi possível responder a questão.');
    }
  }

  async function handleAbandonQuiz() {
    if (!accessToken || !quizSession) {
      return;
    }

    try {
      setQuizSubmitting(true);
      const token = accessToken as string;
      await abandonQuizSession(token, quizSession.sessionId);
      setQuizSession(null);
      setActiveSession(null);
      setShowQuizAnswer(false);
      setQuizFeedback('Sessão abandonada.');
    } catch (error) {
      setQuizError(error instanceof Error ? error.message : 'Não foi possível abandonar a sessão.');
    } finally {
      setQuizSubmitting(false);
    }
  }

  async function handleSaveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken || !profile) {
      return;
    }

    setAccountSubmitting(true);
    setAccountError(null);
    setAccountFeedback(null);

    try {
      const token = accessToken as string;
      const updated = await updateCurrentUser(token, profile.id, {
        name: accountForm.name.trim(),
        email: accountForm.email.trim(),
        password: accountForm.password.trim() || undefined,
      });

      setProfile(updated);
      setAccountForm((state) => ({ ...state, password: '' }));
      setAccountFeedback({ type: 'success', text: 'Alterações salvas com sucesso!' });
      setTimeout(() => setAccountFeedback(null), 3000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível salvar as alterações.';
      setAccountError(message);
      setAccountFeedback({ type: 'error', text: message });
    } finally {
      setAccountSubmitting(false);
    }
  }

  async function handleDeleteAccount() {
    if (!accessToken || !profile) {
      return;
    }

    setDeleteSubmitting(true);

    try {
      const token = accessToken as string;
      await deleteCurrentUser(token, profile.id);
      signOut();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível excluir a conta.';
      setAccountError(message);
      setAccountFeedback({ type: 'error', text: message });
      setDeleteSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_color-mix(in_srgb,var(--gold)_18%,transparent),transparent_30%),linear-gradient(180deg,color-mix(in_srgb,var(--bg-primary)_92%,white),var(--bg-primary))] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="rounded-[2rem] border border-[var(--border)] bg-[linear-gradient(165deg,color-mix(in_srgb,var(--bg-secondary)_76%,white),color-mix(in_srgb,var(--bg-primary)_92%,white))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.12)] sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Badge>Área do usuário</Badge>
              <h1 className="mt-4 font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-5xl">
                {profile ? `Bem-vindo, ${profile.name}` : 'Bem-vindo à sua jornada'}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-secondary)] sm:text-base">
                Acompanhe sua coleção, jogue quizzes, veja o ranking e ajuste sua conta em um só lugar.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={signOut}>
                Sair
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={<AccountBalanceWalletRoundedIcon />} label="Moedas" value={String(profile?.coins ?? 0)} hint="Usadas na loja" />
            <MetricCard icon={<StarRoundedIcon />} label="Nível" value={String(profile?.level ?? 1)} hint={`XP atual: ${profile?.xp ?? 0}`} />
            <MetricCard icon={<CollectionsBookmarkRoundedIcon />} label="Figurinhas" value={`${collectionProgress?.owned ?? 0}/${collectionProgress?.total ?? characters.length}`} hint="Desbloqueadas" />
            <MetricCard icon={<EmojiEventsRoundedIcon />} label="Pontuação" value={String(profile?.totalScore ?? 0)} hint="Score acumulado" />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {sections.map((item) => (
              <Button key={item.id} type="button" variant={section === item.id ? 'primary' : 'secondary'} onClick={() => setSection(item.id)}>
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Button>
            ))}
          </div>
        </section>

        {loading ? <Card className="border-[var(--border)]"><CardContent className="p-6 text-sm text-[var(--text-secondary)]">Carregando dashboard...</CardContent></Card> : null}
        {profileError ? <p className="text-sm text-red-700">{profileError}</p> : null}

        {section === 'home' ? (
          <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
            <SectionFrame title="Atalhos rápidos" description="Acesso direto às áreas principais do usuário comum.">
              <div className="grid gap-4 md:grid-cols-2">
                <QuickActionCard icon={<CollectionsBookmarkRoundedIcon />} title="Figurinhas" description="Veja o que já desbloqueou e o que falta conquistar." onClick={() => setSection('stickers')} />
                <QuickActionCard icon={<QuizRoundedIcon />} title="Quiz" description="Inicie uma partida aleatória ou de estudo por personagem." onClick={() => setSection('quiz')} />
                <QuickActionCard icon={<EmojiEventsRoundedIcon />} title="Ranking" description="Compare sua posição com os outros usuários." onClick={() => setSection('ranking')} />
                <QuickActionCard icon={<SettingsRoundedIcon />} title="Configurações" description="Atualize seus dados e gerencie sua conta." onClick={() => setSection('settings')} />
              </div>
            </SectionFrame>

            <SectionFrame title="Últimas ações" description="Resumo do seu progresso e do que está disponível agora.">
              <div className="space-y-4 text-sm text-[var(--text-secondary)]">
                <StatLine label="Sessão ativa" value={activeSession ? `Questão ${activeSession.currentQuestionIndex + 1}/${activeSession.totalQuestions}` : 'Nenhuma'} />
                <StatLine label="Comentários" value={`${comments.length} anotação(ões)`} />
                <StatLine label="Histórico" value={`${history?.matches.length ?? 0} partida(s)`} />
                <StatLine label="Boosts" value={`Vida ${profile?.extraLifeBoosts ?? 0} | Tempo ${profile?.extraTimeBoosts ?? 0} | XP ${profile?.doubleXpBoosts ?? 0}`} />
              </div>
            </SectionFrame>
          </div>
        ) : null}

        {section === 'stickers' ? (
          <SectionFrame title="Sua coleção" description="Clique em uma figurinha desbloqueada para abrir os detalhes em uma página dedicada.">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="secondary" onClick={() => setIsStickerFilterModalOpen(true)}>
                  Filtros e ordenação
                </Button>
                <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <span>Por página</span>
                  <select
                    className="h-10 rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-primary)_88%,white)] px-3 text-sm text-[var(--text-primary)] outline-none"
                    value={stickersPerPage}
                    onChange={(event) => setStickersPerPage(Number(event.target.value) as 12 | 24 | 36)}
                  >
                    <option value={12}>12</option>
                    <option value={24}>24</option>
                    <option value={36}>36</option>
                  </select>
                </label>
                <Badge>
                  {sortedAndFilteredCharacters.length} figurinha(s) encontrada(s)
                </Badge>
                <Badge>
                  Página {stickerPage} de {totalStickerPages}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {paginatedCharacters.map((character) => {
                  const owned = ownedIds.has(character.id);
                  const rarity = rarityConfig[character.rarity];

                  return (
                    <button
                      key={character.id}
                      type="button"
                      onClick={() => {
                        if (!owned) {
                          return;
                        }
                        router.push(`/dashboard/figurinhas/${character.id}`);
                      }}
                      className={`group relative overflow-hidden rounded-3xl border-2 text-left transition-transform duration-200 hover:-translate-y-0.5 ${rarity.background} ${rarity.border} ${owned ? '' : 'cursor-not-allowed opacity-75'}`}
                    >
                      <div className={`relative aspect-[3/4] ${owned ? '' : 'blur-[2px] grayscale'}`}>
                        {character.imageUrl ? (
                          <img src={character.imageUrl} alt={character.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,color-mix(in_srgb,var(--gold)_18%,transparent),color-mix(in_srgb,var(--bg-secondary)_84%,white))] text-[var(--accent)]">
                            <MenuBookRoundedIcon fontSize="large" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 p-3">
                        <div>
                          <div className="text-sm font-semibold text-[var(--text-primary)]">{character.name}</div>
                          <div className={`text-xs font-medium uppercase tracking-[0.18em] ${rarity.text}`}>{rarity.label}</div>
                        </div>
                        {!owned ? <LockRoundedIcon className="text-[var(--text-secondary)]" fontSize="small" /> : null}
                      </div>
                    </button>
                  );
                })}
              </div>

              {paginatedCharacters.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">Nenhuma figurinha encontrada com os filtros atuais.</p>
              ) : null}

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2 sm:justify-between">
                <Button type="button" variant="secondary" onClick={() => setStickerPage((current) => Math.max(1, current - 1))} disabled={stickerPage === 1}>
                  Anterior
                </Button>
                <span className="text-sm text-[var(--text-secondary)]">Mostrando {showingFrom} - {showingTo} de {sortedAndFilteredCharacters.length}</span>
                <Button type="button" variant="secondary" onClick={() => setStickerPage((current) => Math.min(totalStickerPages, current + 1))} disabled={stickerPage === totalStickerPages}>
                  Próxima
                </Button>
              </div>
            </div>
          </SectionFrame>
        ) : null}

        {section === 'quiz' ? (
          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <SectionFrame title="Iniciar quiz" description="Escolha o tipo de partida e aproveite seus boosts consumíveis.">
              {!quizSession ? (
                <form className="space-y-4" onSubmit={handleStartQuiz}>
                  <div className="grid gap-4">
                    <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                      <span>Tipo de quiz</span>
                      <select className={controlClassName} value={quizForm.quizType} onChange={(event) => setQuizForm((current) => ({ ...current, quizType: event.target.value as QuizFormState['quizType'] }))}>
                        <option value="GENERAL">Geral</option>
                        <option value="CHARACTER_STUDY">Estudo por personagem</option>
                      </select>
                    </label>

                    {quizForm.quizType === 'CHARACTER_STUDY' ? (
                      <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                        <span>Personagem</span>
                        <select className={controlClassName} value={quizForm.characterId} onChange={(event) => setQuizForm((current) => ({ ...current, characterId: event.target.value }))}>
                          <option value="">Selecione um personagem</option>
                          {characters.map((character) => (
                            <option key={character.id} value={character.id}>
                              {character.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}

                    <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                      <span>Quantidade de perguntas</span>
                      <Input type="number" min={1} max={100} value={quizForm.questionLimit} onChange={(event) => setQuizForm((current) => ({ ...current, questionLimit: event.target.value }))} required />
                    </label>
                  </div>

                  {quizError ? <p className="text-sm text-red-700">{quizError}</p> : null}
                  {quizFeedback ? <p className="text-sm text-emerald-700">{quizFeedback}</p> : null}
                  <Button type="submit" disabled={quizSubmitting}>
                    {quizSubmitting ? 'Iniciando...' : 'Iniciar quiz'}
                  </Button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Sessão em progresso</p>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">Você já iniciou uma sessão. Continue respondendo ou clique em "Abandonar" na tela de resposta.</p>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => setShowQuizAnswer(true)}>
                    Continuar respondendo...
                  </Button>
                </div>
              )}

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <MetricCard icon={<FavoriteRoundedIcon />} label="Vida" value={String(profile?.extraLifeBoosts ?? 0)} />
                <MetricCard icon={<BoltRoundedIcon />} label="Tempo" value={String(profile?.extraTimeBoosts ?? 0)} />
                <MetricCard icon={<StarRoundedIcon />} label="XP duplo" value={String(profile?.doubleXpBoosts ?? 0)} />
              </div>
            </SectionFrame>

            <div className="space-y-6">
              <SectionFrame title="Sessão atual" description="Acompanhe a partida iniciada e o status da próxima questão.">
                {quizSession ? (
                  <div className="space-y-3 text-sm text-[var(--text-secondary)]">
                    <DetailLine label="Status" value={quizSession.status} />
                    <DetailLine label="Questões" value={`${quizSession.currentQuestionIndex + 1}/${quizSession.totalQuestions}`} />
                    <DetailLine label="Vidas restantes" value={String(quizSession.livesRemaining)} />
                    <DetailLine label="XP multiplicador" value={`x${quizSession.xpMultiplier}`} />
                    {quizSession.currentQuestion ? (
                      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
                        <p className="font-semibold text-[var(--text-primary)]">{quizSession.currentQuestion.text}</p>
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Tempo limite: {quizSession.currentQuestion.timeLimitSeconds}s</p>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--text-secondary)]">Nenhuma sessão iniciada.</p>
                )}
              </SectionFrame>

              <SectionFrame title="Histórico recente" description="Últimas partidas e sessões concluídas.">
                <div className="space-y-3 text-sm text-[var(--text-secondary)]">
                  {(history?.matches ?? []).length > 0 ? (
                    history!.matches.map((item) => (
                      <div key={item.matchId} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-[var(--text-primary)]">{item.quizType.replace('_', ' ')}</p>
                          <Badge>{item.rewardGranted ? item.rewardGrantedName ?? 'Recompensa' : 'Sem recompensa'}</Badge>
                        </div>
                        <p className="mt-2">XP +{item.xpGained} | Score +{item.scoreGained}</p>
                      </div>
                    ))
                  ) : (
                    <p>Sem histórico recente.</p>
                  )}
                </div>
              </SectionFrame>
            </div>
          </div>
        ) : null}

        {section === 'ranking' ? (
          <SectionFrame title="Ranking dos usuários" description="Acompanhe a disputa por pontuação e nível.">
            <div className="overflow-x-auto rounded-3xl border border-[var(--border)]">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Nível</TableHead>
                    <TableHead>XP</TableHead>
                    <TableHead>Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranking.map((entry) => (
                    <TableRow key={entry.userId}>
                      <TableCell>{entry.position}</TableCell>
                      <TableCell>{entry.userName}</TableCell>
                      <TableCell>{entry.level}</TableCell>
                      <TableCell>{entry.xp}</TableCell>
                      <TableCell>{entry.totalScore}</TableCell>
                    </TableRow>
                  ))}
                  {ranking.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5}>Sem dados no ranking.</TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>
          </SectionFrame>
        ) : null}

        {section === 'settings' ? (
          <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
            <SectionFrame title="Configuração da conta" description="Edite seus dados e mantenha seu acesso organizado.">
              <form className="grid gap-4" onSubmit={handleSaveAccount}>
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Nome</span>
                  <Input value={accountForm.name} onChange={(event) => setAccountForm((current) => ({ ...current, name: event.target.value }))} required />
                </label>
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>E-mail</span>
                  <Input type="email" value={accountForm.email} onChange={(event) => setAccountForm((current) => ({ ...current, email: event.target.value }))} required />
                </label>
                <label className="space-y-2 text-sm text-[var(--text-secondary)]">
                  <span>Nova senha</span>
                  <Input type="password" value={accountForm.password} onChange={(event) => setAccountForm((current) => ({ ...current, password: event.target.value }))} placeholder="Deixe em branco para manter a atual" />
                </label>

                {accountFeedback && (
                  <div className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-medium ${accountFeedback.type === 'success' ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/20 text-red-700 dark:text-red-300'}`}>
                    {accountFeedback.type === 'success' ? <CheckCircleRoundedIcon /> : <ErrorRoundedIcon />}
                    {accountFeedback.text}
                  </div>
                )}

                {accountError && !accountFeedback?.text.includes(accountError) ? <p className="text-sm text-red-700">{accountError}</p> : null}

                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={accountSubmitting}>
                    {accountSubmitting ? 'Salvando...' : 'Salvar alterações'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setDeleteAccount({ open: true, password: '' })}>
                    Excluir conta
                  </Button>
                </div>
              </form>
            </SectionFrame>

            <SectionFrame title="Resumo da conta" description="Informações úteis para acompanhar sua jornada.">
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricCard icon={<AccountBalanceWalletRoundedIcon />} label="Moedas" value={String(profile?.coins ?? 0)} />
                <MetricCard icon={<FavoriteRoundedIcon />} label="Vida" value={String(profile?.extraLifeBoosts ?? 0)} />
                <MetricCard icon={<BoltRoundedIcon />} label="Tempo" value={String(profile?.extraTimeBoosts ?? 0)} />
                <MetricCard icon={<StarRoundedIcon />} label="XP duplo" value={String(profile?.doubleXpBoosts ?? 0)} />
              </div>
              <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4 text-sm text-[var(--text-secondary)]">
                <div className="font-semibold text-[var(--text-primary)]">Identificação</div>
                <p className="mt-2">ID: {profile?.id ?? '-'}</p>
                <p>E-mail: {profile?.email ?? '-'}</p>
                <p>Perfil: {profile?.role ?? '-'}</p>
              </div>
            </SectionFrame>
          </div>
        ) : null}
      </div>

      <ConfirmModal
        open={deleteAccount.open}
        title="Excluir conta"
        description="Esta ação remove sua conta de forma lógica. Se quiser seguir, confirme abaixo."
        confirmLabel="Excluir conta"
        isLoading={deleteSubmitting}
        onCancel={() => setDeleteAccount({ open: false, password: '' })}
        onConfirm={handleDeleteAccount}
      />

      {quizSession && showQuizAnswer && (
        <QuizAnswerScreen
          session={quizSession}
          onAnswer={handleAnswerQuiz}
          onClose={() => setShowQuizAnswer(false)}
          onAbandon={handleAbandonQuiz}
          isLoading={quizSubmitting}
          boosts={{
            extraLife: profile?.extraLifeBoosts ?? 0,
            extraTime: profile?.extraTimeBoosts ?? 0,
            doubleXp: profile?.doubleXpBoosts ?? 0,
          }}
        />
      )}

      <QuizRewardModal
        data={rewardModalData}
        onContinue={() => {
          setRewardModalData(null);
          setQuizFeedback('Partida concluída!');
        }}
      />

      <StickerFiltersModal
        open={isStickerFilterModalOpen}
        filters={stickerFilters}
        sortBy={stickerSortBy}
        uniqueBooks={uniqueBooks}
        uniqueRarities={uniqueRarities}
        onClose={() => setIsStickerFilterModalOpen(false)}
        onSetFilters={setStickerFilters}
        onSetSortBy={setStickerSortBy}
      />
    </main>
  );
}

function QuickActionCard({ icon, title, description, onClick }: { icon: ReactNode; title: string; description: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-3xl border border-[var(--border)] bg-[var(--bg-primary)] p-5 text-left transition-transform hover:-translate-y-0.5">
      <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--gold)_15%,transparent)] text-[var(--accent)]">
        {icon}
      </div>
      <h3 className="mt-4 font-[family-name:var(--font-heading)] text-xl font-semibold text-[var(--text-primary)]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
    </button>
  );
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3">
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      <span className="text-sm font-semibold text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] px-4 py-3">
      <div className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">{label}</div>
      <div className="mt-1 text-sm text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function FilterCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="rounded border-[var(--border)]" />
      <span className="text-sm text-[var(--text-secondary)]">{label}</span>
    </label>
  );
}

function StickerFiltersModal({
  open,
  filters,
  sortBy,
  uniqueBooks,
  uniqueRarities,
  onClose,
  onSetFilters,
  onSetSortBy,
}: {
  open: boolean;
  filters: StickerFilters;
  sortBy: StickerSortOption;
  uniqueBooks: string[];
  uniqueRarities: string[];
  onClose: () => void;
  onSetFilters: React.Dispatch<React.SetStateAction<StickerFilters>>;
  onSetSortBy: React.Dispatch<React.SetStateAction<StickerSortOption>>;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="Filtros de figurinhas">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--bg-secondary)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <h3 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[var(--text-primary)]">Filtros e ordenação</h3>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Ordenar por</label>
            <select className={controlClassName} value={sortBy} onChange={(event) => onSetSortBy(event.target.value as StickerSortOption)}>
              <option value="alphabetical">Ordem alfabética (A-Z)</option>
              <option value="rarityAsc">Raridade crescente</option>
              <option value="rarityDesc">Raridade decrescente</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Raridade</label>
            <div className="space-y-2">
              <FilterCheckbox label="Todas" checked={filters.rarity.length === 0} onChange={() => onSetFilters((current) => ({ ...current, rarity: [] }))} />
              {uniqueRarities.map((rarity) => (
                <FilterCheckbox
                  key={rarity}
                  label={getRarityLabel(rarity as never)}
                  checked={filters.rarity.includes(rarity)}
                  onChange={(checked) => {
                    onSetFilters((current) => ({
                      ...current,
                      rarity: checked ? [...current.rarity, rarity] : current.rarity.filter((item) => item !== rarity),
                    }));
                  }}
                />
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Livro(s)</label>
            <div className="grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2">
              <FilterCheckbox label="Todos" checked={filters.book.length === 0} onChange={() => onSetFilters((current) => ({ ...current, book: [] }))} />
              {uniqueBooks.map((book) => (
                <FilterCheckbox
                  key={book}
                  label={book}
                  checked={filters.book.includes(book)}
                  onChange={(checked) => {
                    onSetFilters((current) => ({
                      ...current,
                      book: checked ? [...current.book, book] : current.book.filter((item) => item !== book),
                    }));
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" variant="secondary" onClick={() => onSetFilters({ rarity: [], book: [] })}>
            Limpar filtros
          </Button>
          <Button type="button" onClick={onClose}>
            Aplicar
          </Button>
        </div>
      </div>
    </div>
  );
}

function QuizRewardModal({ data, onContinue }: { data: QuizMatchResult | null; onContinue: () => void }) {
  if (!data) {
    return null;
  }

  const wonSticker = data.rewardType === 'STICKER' && data.rewardCharacterName;
  const unlockedText = data.rewardCharacterUnlocked ? 'Desbloqueada agora na sua coleção.' : 'Você já tinha essa figurinha desbloqueada.';
  const dailyLimitReached =
    !data.rewardGranted &&
    data.rewardMatchesLimitPerDay > 0 &&
    data.rewardMatchesUsedToday >= data.rewardMatchesLimitPerDay;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-label="Resultado da partida">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-[var(--border)] bg-[var(--bg-secondary)] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <h3 className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[var(--text-primary)]">
          {dailyLimitReached ? 'Partida concluída sem recompensa' : 'Resultado da partida'}
        </h3>

        <div className="mt-4 grid gap-3 text-sm text-[var(--text-secondary)] sm:grid-cols-2">
          <DetailLine label="XP ganho" value={String(data.xpGained)} />
          <DetailLine label="Score ganho" value={String(data.scoreGained)} />
        </div>

        {data.rewardMatchesLimitPerDay > 0 ? (
          <div className="mt-3 text-xs text-[var(--text-secondary)]">
            Recompensas hoje: {data.rewardMatchesUsedToday}/{data.rewardMatchesLimitPerDay}
          </div>
        ) : null}

        <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-primary)] p-4">
          {data.rewardGranted ? (
            <>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Recompensa recebida: {data.rewardName ?? 'Sim'}</p>
              {wonSticker ? (
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Figurinha {data.rewardCharacterRarity ? getRarityLabel(data.rewardCharacterRarity) : ''}: {data.rewardCharacterName}. {unlockedText}
                </p>
              ) : (
                <p className="mt-2 text-sm text-[var(--text-secondary)]">Recompensa aplicada com sucesso à sua conta.</p>
              )}
            </>
          ) : dailyLimitReached ? (
            <>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Você atingiu o limite diário de recompensas.</p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Pode continuar jogando normalmente, ganhando XP e score, mas novas recompensas ficam disponíveis no próximo dia.
              </p>
            </>
          ) : (
            <p className="text-sm text-[var(--text-secondary)]">Nesta partida você não recebeu recompensa, mas o XP e score já foram contabilizados.</p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button type="button" onClick={onContinue}>
            Prosseguir
          </Button>
        </div>
      </div>
    </div>
  );
}
