'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/game/game-ui';
import { Modal } from '@/components/game/modal';
import { BottomNav, PlayerHud, type SectionId } from '@/components/user/game-shell';
import { MatchResult, type MatchSummary } from '@/components/user/match-result';
import { QuizAnswerScreen, type QuizAnswerFeedback, type QuizAnswerPayload } from '@/components/user/quiz-answer-screen';
import { AlbumSection } from '@/components/user/sections/album-section';
import { HomeSection } from '@/components/user/sections/home-section';
import { PlaySection, type QuizFormState } from '@/components/user/sections/play-section';
import { ProfileSection } from '@/components/user/sections/profile-section';
import { RankingSection } from '@/components/user/sections/ranking-section';
import { ShopSection } from '@/components/user/sections/shop-section';
import { getRarityLabel } from '@/lib/rarity-theme';
import {
  answerQuizQuestion,
  abandonQuizSession,
  buyShopItem,
  deleteCurrentUser,
  getGameRules,
  getActiveQuizSession,
  getCollection,
  getCollectionProgress,
  getCurrentUser,
  getMyComments,
  getQuizHistory,
  listCharacters,
  listRanking,
  listShopItems,
  requestQuizExtraTime,
  startQuizSession,
  updateCurrentUser,
  type CharacterEntry,
  type CollectionProgress,
  type GameRules,
  type ShopItem,
  type CommentEntry,
  type QuizHistory,
  type QuizSessionStatus,
  type RankingEntry,
  type StartQuizSessionPayload,
  type UserSticker,
} from '@/lib/user-api';
import type { UserProfile } from '@/types/auth';

type DeleteAccountState = {
  open: boolean;
  password: string;
};

type FeedbackMessage = {
  type: 'success' | 'error';
  text: string;
};

const emptyQuizForm: QuizFormState = {
  quizType: 'GENERAL',
  characterId: '',
  questionLimit: '10',
};

export function UserDashboard() {
  const { accessToken, user, signOut } = useAuth();
  const router = useRouter();

  const [section, setSection] = useState<SectionId>('home');

  function navigate(next: SectionId) {
    setSection(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  const [profile, setProfile] = useState<UserProfile | null>(user);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState<CharacterEntry[]>([]);
  const [collection, setCollection] = useState<UserSticker[]>([]);
  const [collectionProgress, setCollectionProgress] = useState<CollectionProgress | null>(null);
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [comments, setComments] = useState<CommentEntry[]>([]);
  const [history, setHistory] = useState<QuizHistory | null>(null);
  const [, setActiveSession] = useState<QuizSessionStatus | null>(null);
  const [quizForm, setQuizForm] = useState<QuizFormState>(emptyQuizForm);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizSession, setQuizSession] = useState<QuizSessionStatus | null>(null);
  const [showQuizAnswer, setShowQuizAnswer] = useState(false);
  const [matchSummary, setMatchSummary] = useState<MatchSummary | null>(null);
  const [lastAnswerFeedback, setLastAnswerFeedback] = useState<QuizAnswerFeedback | null>(null);
  const [quizAnswerError, setQuizAnswerError] = useState<string | null>(null);
  const [gameRules, setGameRules] = useState<GameRules | null>(null);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [shopError, setShopError] = useState<string | null>(null);
  const [shopFeedback, setShopFeedback] = useState<string | null>(null);
  const [buyingItemId, setBuyingItemId] = useState<number | null>(null);
  const [accountForm, setAccountForm] = useState({ name: user?.name ?? '', email: user?.email ?? '', password: '' });
  const [, setAccountError] = useState<string | null>(null);
  const [accountFeedback, setAccountFeedback] = useState<FeedbackMessage | null>(null);
  const [accountSubmitting, setAccountSubmitting] = useState(false);
  const [deleteAccount, setDeleteAccount] = useState<DeleteAccountState>({ open: false, password: '' });
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

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
      const results = await Promise.allSettled([
        getCurrentUser(),
        listCharacters(),
        getCollection(),
        getCollectionProgress(),
        listRanking(),
        getMyComments(),
        getQuizHistory(5),
        getActiveQuizSession(),
        getGameRules(),
        listShopItems(),
      ]);

      if (ignore) {
        return;
      }

      const [profileResult, charactersResult, collectionResult, progressResult, rankingResult, commentsResult, historyResult, activeResult, rulesResult, shopResult] = results;

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

      if (rulesResult.status === 'fulfilled') {
        setGameRules(rulesResult.value);
      }

      if (shopResult.status === 'fulfilled') {
        setShopItems(shopResult.value);
      } else {
        setShopError('Não foi possível carregar a loja.');
      }

      setLoading(false);
    }

    void loadDashboard();

    return () => {
      ignore = true;
    };
  }, [accessToken]);

  const ownedIds = useMemo(() => new Set(collection.map((item) => item.characterId)), [collection]);

  async function handleStartQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      return;
    }

    setQuizSubmitting(true);
    setQuizError(null);
    setQuizFeedback(null);

    try {
      const payload: StartQuizSessionPayload = {
        quizType: quizForm.quizType,
        characterId: quizForm.quizType === 'CHARACTER_STUDY' ? Number(quizForm.characterId) : null,
        questionLimit: Number(quizForm.questionLimit),
      };

      const session = await startQuizSession(payload);
      setLastAnswerFeedback(null);
      setQuizAnswerError(null);
      setQuizSession(session);
      setActiveSession(session);
      setShowQuizAnswer(true);
    } catch (error) {
      setQuizError(error instanceof Error ? error.message : 'Não foi possível iniciar o quiz.');
    } finally {
      setQuizSubmitting(false);
    }
  }

  function consumeBoosts(previous: QuizSessionStatus, next: { extraTimeUsed: boolean; extraLifeUsed: boolean; xpMultiplierUsed: boolean }) {
    setProfile((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        extraTimeBoosts: (current.extraTimeBoosts ?? 0) - (next.extraTimeUsed && !previous.extraTimeUsed ? 1 : 0),
        extraLifeBoosts: (current.extraLifeBoosts ?? 0) - (next.extraLifeUsed && !previous.extraLifeUsed ? 1 : 0),
        doubleXpBoosts: (current.doubleXpBoosts ?? 0) - (next.xpMultiplierUsed && !previous.xpMultiplierUsed ? 1 : 0),
      };
    });
  }

  async function handleAnswerQuiz(payload: QuizAnswerPayload) {
    if (!accessToken || !quizSession) return;

    setQuizAnswerError(null);

    try {
      const result = await answerQuizQuestion(payload.sessionId, {
        questionId: payload.questionId,
        selectedOption: payload.selectedOption,
        useExtraLife: payload.useExtraLife,
        useXpMultiplier: payload.useXpMultiplier,
      });

      consumeBoosts(quizSession, result);
      setLastAnswerFeedback(result.timedOut ? 'timeout' : result.correct ? 'correct' : 'wrong');

      if (result.finished) {
        setQuizSession(null);
        setActiveSession(null);
        setShowQuizAnswer(false);
        setLastAnswerFeedback(null);

        const [historyResult, profileResult, collectionResult, progressResult] = await Promise.allSettled([
          getQuizHistory(5),
          getCurrentUser(),
          getCollection(),
          getCollectionProgress(),
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

        setMatchSummary({
          result: result.matchResult ?? {
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
          correct: result.correctAnswers,
          answered: result.correctAnswers + result.wrongAnswers,
          previousLevel: profile?.level ?? 1,
        });

        return;
      }

      const nextSession: QuizSessionStatus = {
        ...quizSession,
        livesRemaining: result.livesRemaining,
        correctAnswers: result.correctAnswers,
        wrongAnswers: result.wrongAnswers,
        extraTimeUsed: result.extraTimeUsed,
        extraLifeUsed: result.extraLifeUsed,
        xpMultiplierUsed: result.xpMultiplierUsed,
        currentQuestionIndex: quizSession.currentQuestionIndex + 1,
        currentQuestion: result.nextQuestion ?? null,
      };
      setQuizSession(nextSession);
      setActiveSession(nextSession);
    } catch (error) {
      setQuizAnswerError(error instanceof Error ? error.message : 'Não foi possível responder a questão.');
    }
  }

  // Recarrega a sessão ao voltar para o quiz: o cronômetro continuou correndo no servidor.
  async function handleResumeQuiz() {
    setQuizSubmitting(true);
    setQuizError(null);

    try {
      const current = await getActiveQuizSession();
      setQuizSession(current);
      setActiveSession(current);
      setShowQuizAnswer(true);
    } catch (error) {
      setQuizSession(null);
      setActiveSession(null);
      setQuizError(error instanceof Error ? error.message : 'Não foi possível retomar a sessão.');
    } finally {
      setQuizSubmitting(false);
    }
  }

  async function handleUseExtraTime(): Promise<QuizSessionStatus | null> {
    if (!quizSession) {
      return null;
    }

    setQuizAnswerError(null);

    try {
      const updated = await requestQuizExtraTime(quizSession.sessionId);
      consumeBoosts(quizSession, updated);
      setQuizSession(updated);
      setActiveSession(updated);
      return updated;
    } catch (error) {
      setQuizAnswerError(error instanceof Error ? error.message : 'Não foi possível usar o tempo extra.');
      return null;
    }
  }

  async function handleBuyItem(item: ShopItem) {
    setBuyingItemId(item.id);
    setShopError(null);
    setShopFeedback(null);

    try {
      const purchase = await buyShopItem(item.id);
      setProfile((current) =>
        current
          ? {
              ...current,
              coins: purchase.userCoins,
              extraLifeBoosts: purchase.extraLifeBoosts,
              extraTimeBoosts: purchase.extraTimeBoosts,
              doubleXpBoosts: purchase.doubleXpBoosts,
            }
          : current,
      );

      if (purchase.rewardType === 'STICKER' && purchase.characterName) {
        setShopFeedback(`Você ganhou a figurinha ${purchase.characterRarity ? getRarityLabel(purchase.characterRarity) + ' ' : ''}${purchase.characterName}!`);
        const [collectionResult, progressResult] = await Promise.allSettled([getCollection(), getCollectionProgress()]);
        if (collectionResult.status === 'fulfilled') {
          setCollection(collectionResult.value);
        }
        if (progressResult.status === 'fulfilled') {
          setCollectionProgress(progressResult.value);
        }
      } else {
        setShopFeedback(`${item.name} adicionado à sua conta.`);
      }
    } catch (error) {
      setShopError(error instanceof Error ? error.message : 'Não foi possível concluir a compra.');
    } finally {
      setBuyingItemId(null);
    }
  }

  async function handleAbandonQuiz() {
    if (!accessToken || !quizSession) {
      return;
    }

    try {
      setQuizSubmitting(true);
      await abandonQuizSession(quizSession.sessionId);
      setLastAnswerFeedback(null);
      setQuizAnswerError(null);
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
      const updated = await updateCurrentUser(profile.id, {
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
      await deleteCurrentUser(profile.id);
      signOut();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível excluir a conta.';
      setAccountError(message);
      setAccountFeedback({ type: 'error', text: message });
      setDeleteSubmitting(false);
    }
  }

  const openSticker = (id: number) => router.push(`/dashboard/figurinhas/${id}`);

  return (
    <div className="min-h-dvh pb-28 sm:pb-10">
      <PlayerHud profile={profile} section={section} onNavigate={navigate} />

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        {profileError ? (
          <div className="mb-4">
            <Alert tone="danger">{profileError}</Alert>
          </div>
        ) : null}

        {loading ? (
          <div className="grid gap-4" aria-busy="true" aria-label="Carregando">
            <div className="panel h-56 animate-pulse" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="panel h-20 animate-pulse" />
              ))}
            </div>
          </div>
        ) : (
          <div key={section} className="animate-fade-up">
            {section === 'home' ? (
              <HomeSection
                profile={profile}
                characters={characters}
                collection={collection}
                history={history}
                activeSession={quizSession}
                commentsCount={comments.length}
                onNavigate={navigate}
                onResume={handleResumeQuiz}
                onOpenSticker={openSticker}
              />
            ) : null}

            {section === 'stickers' ? <AlbumSection characters={characters} ownedIds={ownedIds} onOpenSticker={openSticker} /> : null}

            {section === 'quiz' ? (
              <PlaySection
                profile={profile}
                characters={characters}
                gameRules={gameRules}
                quizForm={quizForm}
                onChangeForm={setQuizForm}
                quizSession={quizSession}
                submitting={quizSubmitting}
                error={quizError}
                feedback={quizFeedback}
                onStart={handleStartQuiz}
                onResume={handleResumeQuiz}
                onAbandon={handleAbandonQuiz}
              />
            ) : null}

            {section === 'shop' ? (
              <ShopSection items={shopItems} coins={profile?.coins ?? 0} buyingItemId={buyingItemId} feedback={shopFeedback} error={shopError} onBuy={handleBuyItem} />
            ) : null}

            {section === 'ranking' ? <RankingSection ranking={ranking} currentUserId={profile?.id} /> : null}

            {section === 'settings' ? (
              <ProfileSection
                profile={profile}
                ownedCount={collectionProgress?.owned ?? ownedIds.size}
                totalCount={collectionProgress?.total ?? characters.length}
                form={accountForm}
                onChangeForm={setAccountForm}
                submitting={accountSubmitting}
                feedback={accountFeedback}
                onSave={handleSaveAccount}
                onAskDelete={() => setDeleteAccount({ open: true, password: '' })}
                onSignOut={signOut}
              />
            ) : null}
          </div>
        )}
      </main>

      <BottomNav section={section} onNavigate={navigate} />

      <Modal
        open={deleteAccount.open}
        title="Excluir conta?"
        size="sm"
        onClose={deleteSubmitting ? undefined : () => setDeleteAccount({ open: false, password: '' })}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteAccount({ open: false, password: '' })} disabled={deleteSubmitting}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDeleteAccount} disabled={deleteSubmitting}>
              {deleteSubmitting ? 'Excluindo...' : 'Excluir conta'}
            </Button>
          </>
        }
      >
        <p className="text-muted">Você perde o acesso, a coleção e o lugar no ranking. Essa ação não pode ser desfeita pelo app.</p>
      </Modal>

      {quizSession && showQuizAnswer ? (
        <QuizAnswerScreen
          key={`${quizSession.sessionId}-${quizSession.currentQuestion?.id ?? 'none'}-${quizSession.currentQuestionIndex}`}
          session={quizSession}
          onAnswer={handleAnswerQuiz}
          onUseExtraTime={handleUseExtraTime}
          onClose={() => setShowQuizAnswer(false)}
          onAbandon={handleAbandonQuiz}
          isLoading={quizSubmitting}
          lastFeedback={lastAnswerFeedback}
          errorMessage={quizAnswerError}
          extraTimeSeconds={gameRules?.extraTimeSeconds ?? 15}
          maxLives={gameRules?.startingLives ?? 3}
          boosts={{
            extraLife: profile?.extraLifeBoosts ?? 0,
            extraTime: profile?.extraTimeBoosts ?? 0,
            doubleXp: profile?.doubleXpBoosts ?? 0,
          }}
        />
      ) : null}

      <MatchResult
        summary={matchSummary}
        minCorrectForReward={gameRules?.rewardMinCorrectAnswers ?? null}
        onContinue={() => {
          setMatchSummary(null);
          setQuizFeedback(null);
          navigate('home');
        }}
      />
    </div>
  );
}
