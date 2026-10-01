import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import { useAuth } from '@/components/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { useDialogs } from '@/components/ui/dialogs';
import { Modal } from '@/components/ui/modal';
import { LoadingState } from '@/components/ui/spinner';
import { errorMessage, useToast } from '@/components/ui/toast';
import { Alert, CoinIcon } from '@/components/game/game-ui';
import { StickerCard } from '@/components/game/sticker-card';
import { BottomNav, PlayerHud, type SectionId } from '@/components/user/game-shell';
import { MatchResult, type MatchSummary } from '@/components/user/match-result';
import { QuizAnswerScreen, type AnswerReveal, type QuizAnswerPayload } from '@/components/user/quiz-answer-screen';
import { AlbumSection } from '@/components/user/sections/album-section';
import { HomeSection } from '@/components/user/sections/home-section';
import { PlaySection, type QuizFormState } from '@/components/user/sections/play-section';
import { ProfileSection } from '@/components/user/sections/profile-section';
import { FriendsSection } from '@/components/user/sections/friends-section';
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
  listShopItems,
  requestFiftyFifty,
  requestNextQuestion,
  requestQuizExtraTime,
  startQuizSession,
  updateCurrentUser,
  type AnswerQuizQuestionResult,
  type CharacterEntry,
  type CollectionProgress,
  type GameRules,
  type QuizHistory,
  type QuizSessionStatus,
  type ShopItem,
  type ShopPurchaseResult,
  type StartQuizSessionPayload,
  type UnlockedAchievement,
  type UserSticker,
} from '@/lib/user-api';
import { getSocialSummary, type SocialSummary, type TradeResponse } from '@/lib/social-api';
import type { UserProfile } from '@/types/auth';

/** Figurinha mostrada no modal depois de uma compra ou fusão. */
type StickerReveal = Pick<ShopPurchaseResult, 'characterId' | 'characterName' | 'characterRarity' | 'characterImageUrl' | 'characterUnlocked' | 'duplicate'> & { title?: string };

const emptyQuizForm: QuizFormState = {
  quizType: 'GENERAL',
  characterId: '',
  questionLimit: '10',
};

export function UserDashboard() {
  const { accessToken, user, signOut } = useAuth();
  const navigateTo = useNavigate();
  const toast = useToast();
  const { confirm } = useDialogs();

  const [section, setSection] = useState<SectionId>('home');
  const [profile, setProfile] = useState<UserProfile | null>(user);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [characters, setCharacters] = useState<CharacterEntry[]>([]);
  const [collection, setCollection] = useState<UserSticker[]>([]);
  const [collectionProgress, setCollectionProgress] = useState<CollectionProgress | null>(null);
  const [commentsCount, setCommentsCount] = useState(0);
  const [history, setHistory] = useState<QuizHistory | null>(null);
  const [quizForm, setQuizForm] = useState<QuizFormState>(emptyQuizForm);
  const [quizError, setQuizError] = useState<string | null>(null);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizSession, setQuizSession] = useState<QuizSessionStatus | null>(null);
  const [showQuizAnswer, setShowQuizAnswer] = useState(false);
  const [reveal, setReveal] = useState<AnswerReveal | null>(null);
  const [pendingResult, setPendingResult] = useState<AnswerQuizQuestionResult | null>(null);
  const [matchSummary, setMatchSummary] = useState<MatchSummary | null>(null);
  const [quizAnswerError, setQuizAnswerError] = useState<string | null>(null);
  const [gameRules, setGameRules] = useState<GameRules | null>(null);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [shopError, setShopError] = useState<string | null>(null);
  const [buyingItemId, setBuyingItemId] = useState<number | null>(null);
  const [purchase, setPurchase] = useState<StickerReveal | null>(null);
  const [accountForm, setAccountForm] = useState({ name: user?.name ?? '', email: user?.email ?? '', password: '' });
  const [accountSubmitting, setAccountSubmitting] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [socialSummary, setSocialSummary] = useState<SocialSummary | null>(null);

  const refreshSocial = useCallback(() => {
    getSocialSummary()
      .then(setSocialSummary)
      .catch(() => undefined);
  }, []);

  // Avisos de amigos (pedidos, propostas e mensagens): consulta leve a cada 30 s com o app visível.
  useEffect(() => {
    if (!accessToken) return;
    refreshSocial();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshSocial();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [accessToken, refreshSocial]);

  function handleTradeDone(result: TradeResponse) {
    if (result.trade.status === 'ACCEPTED') void refreshCollection();
    celebrate(result.unlockedAchievements);
  }

  function navigate(next: SectionId) {
    setSection(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

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
      const [profileResult, charactersResult, collectionResult, progressResult, commentsResult, historyResult, activeResult, rulesResult, shopResult] = await Promise.allSettled([
        getCurrentUser(),
        listCharacters(),
        getCollection(),
        getCollectionProgress(),
        getMyComments(),
        getQuizHistory(5),
        getActiveQuizSession(),
        getGameRules(),
        listShopItems(),
      ]);

      if (ignore) {
        return;
      }

      if (profileResult.status === 'fulfilled') {
        setProfile(profileResult.value);
        setAccountForm((state) => ({ ...state, name: profileResult.value.name, email: profileResult.value.email }));
      } else {
        setProfileError('Não foi possível carregar seu perfil.');
      }
      if (charactersResult.status === 'fulfilled') setCharacters(charactersResult.value);
      if (collectionResult.status === 'fulfilled') setCollection(collectionResult.value);
      if (progressResult.status === 'fulfilled') setCollectionProgress(progressResult.value);
      if (commentsResult.status === 'fulfilled') setCommentsCount(new Set(commentsResult.value.map((comment) => comment.characterId)).size);
      if (historyResult.status === 'fulfilled') setHistory(historyResult.value);
      if (activeResult.status === 'fulfilled') setQuizSession(activeResult.value);
      if (rulesResult.status === 'fulfilled') setGameRules(rulesResult.value);
      if (shopResult.status === 'fulfilled') setShopItems(shopResult.value);
      else setShopError('Não foi possível carregar a loja.');

      setLoading(false);
    }

    void loadDashboard();

    return () => {
      ignore = true;
    };
  }, [accessToken]);

  /** Atualiza moedas e bônus no topo depois de um resgate. */
  function updateWallet(wallet: { userCoins: number; hintBoosts?: number }) {
    setProfile((current) => (current ? { ...current, coins: wallet.userCoins, ...(wallet.hintBoosts !== undefined ? { hintBoosts: wallet.hintBoosts } : {}) } : current));
  }

  const ownedIds = useMemo(() => new Set(collection.map((item) => item.characterId)), [collection]);

  function celebrate(achievements?: UnlockedAchievement[]) {
    achievements?.forEach((achievement) =>
      toast.success(`Conquista desbloqueada: ${achievement.title}!`, {
        description: `+${achievement.coins} moedas`,
        icon: <EmojiEventsRoundedIcon className="text-primary-strong dark:text-primary" />,
      }),
    );
  }

  async function refreshCollection() {
    const [collectionResult, progressResult] = await Promise.allSettled([getCollection(), getCollectionProgress()]);
    if (collectionResult.status === 'fulfilled') setCollection(collectionResult.value);
    if (progressResult.status === 'fulfilled') setCollectionProgress(progressResult.value);
  }

  async function handleStartQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) return;

    setQuizSubmitting(true);
    setQuizError(null);

    try {
      const payload: StartQuizSessionPayload = {
        quizType: quizForm.quizType,
        characterId: quizForm.quizType === 'CHARACTER_STUDY' ? Number(quizForm.characterId) : null,
        questionLimit: Number(quizForm.questionLimit),
      };

      const session = await startQuizSession(payload);
      setReveal(null);
      setQuizAnswerError(null);
      setQuizSession(session);
      setShowQuizAnswer(true);
    } catch (error) {
      setQuizError(errorMessage(error, 'Não foi possível iniciar o quiz.'));
    } finally {
      setQuizSubmitting(false);
    }
  }

  async function handleStartChallenge() {
    setQuizSubmitting(true);
    setQuizError(null);
    try {
      const session = await startQuizSession({ quizType: 'DAILY_CHALLENGE' });
      setReveal(null);
      setQuizAnswerError(null);
      setQuizSession(session);
      setShowQuizAnswer(true);
    } catch (error) {
      toast.error(errorMessage(error, 'Não foi possível iniciar o desafio.'));
    } finally {
      setQuizSubmitting(false);
    }
  }

  function consumeBoosts(previous: QuizSessionStatus, next: { extraTimeUsed: boolean; extraLifeUsed: boolean; xpMultiplierUsed: boolean; fiftyFiftyUsed?: boolean }) {
    setProfile((current) => {
      if (!current) return current;
      return {
        ...current,
        extraTimeBoosts: (current.extraTimeBoosts ?? 0) - (next.extraTimeUsed && !previous.extraTimeUsed ? 1 : 0),
        extraLifeBoosts: (current.extraLifeBoosts ?? 0) - (next.extraLifeUsed && !previous.extraLifeUsed ? 1 : 0),
        doubleXpBoosts: (current.doubleXpBoosts ?? 0) - (next.xpMultiplierUsed && !previous.xpMultiplierUsed ? 1 : 0),
        hintBoosts: (current.hintBoosts ?? 0) - (next.fiftyFiftyUsed && !previous.fiftyFiftyUsed ? 1 : 0),
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
      // Placar e vidas atualizam já; a próxima pergunta abre quando o jogador pedir.
      setQuizSession({
        ...quizSession,
        livesRemaining: result.livesRemaining,
        correctAnswers: result.correctAnswers,
        wrongAnswers: result.wrongAnswers,
        extraTimeUsed: result.extraTimeUsed,
        extraLifeUsed: result.extraLifeUsed,
        xpMultiplierUsed: result.xpMultiplierUsed,
        fiftyFiftyUsed: result.fiftyFiftyUsed ?? quizSession.fiftyFiftyUsed,
      });
      setReveal({
        selected: payload.selectedOption,
        correctOption: result.correctOption ?? '',
        correct: result.correct,
        timedOut: result.timedOut,
        explanation: result.explanation,
        bibleReference: result.bibleReference,
        finished: result.finished,
        extraLifeSaved: !result.correct && result.extraLifeUsed && !quizSession.extraLifeUsed,
      });
      setPendingResult(result);
    } catch (error) {
      setQuizAnswerError(errorMessage(error, 'Não foi possível responder a questão.'));
    }
  }

  async function finishMatch(result: AnswerQuizQuestionResult) {
    const previousLevel = profile?.level ?? 1;
    setQuizSession(null);
    setShowQuizAnswer(false);
    setReveal(null);
    setPendingResult(null);

    const [historyResult, profileResult] = await Promise.allSettled([getQuizHistory(5), getCurrentUser()]);
    if (historyResult.status === 'fulfilled') setHistory(historyResult.value);
    if (profileResult.status === 'fulfilled') setProfile(profileResult.value);
    void refreshCollection();

    setMatchSummary({
      result: result.matchResult ?? {
        matchId: 0,
        xpGained: 0,
        scoreGained: 0,
        rewardGranted: false,
        rewardName: null,
        userXp: profile?.xp ?? 0,
        userLevel: previousLevel,
        userCoins: profile?.coins ?? 0,
        rewardMatchesUsedToday: 0,
        rewardMatchesLimitPerDay: 0,
      },
      correct: result.correctAnswers,
      answered: result.correctAnswers + result.wrongAnswers,
      previousLevel,
    });
    celebrate(result.matchResult?.unlockedAchievements);
  }

  async function handleNextQuestion() {
    if (!quizSession || !pendingResult) return;
    if (pendingResult.finished) {
      await finishMatch(pendingResult);
      return;
    }
    setQuizSubmitting(true);
    try {
      const next = await requestNextQuestion(quizSession.sessionId);
      setQuizSession(next);
      setReveal(null);
      setPendingResult(null);
    } catch (error) {
      setQuizAnswerError(errorMessage(error, 'Não foi possível abrir a próxima pergunta.'));
    } finally {
      setQuizSubmitting(false);
    }
  }

  // Recarrega a sessão ao voltar para o quiz: o cronômetro continuou correndo no servidor.
  async function handleResumeQuiz() {
    setQuizSubmitting(true);
    setQuizError(null);
    try {
      const current = await getActiveQuizSession();
      setQuizSession(current);
      setReveal(null);
      setPendingResult(null);
      setShowQuizAnswer(true);
    } catch (error) {
      setQuizSession(null);
      setQuizError(errorMessage(error, 'Não foi possível retomar a sessão.'));
    } finally {
      setQuizSubmitting(false);
    }
  }

  async function applyBoost(request: (sessionId: number) => Promise<QuizSessionStatus>, fallback: string): Promise<QuizSessionStatus | null> {
    if (!quizSession) return null;
    setQuizAnswerError(null);
    try {
      const updated = await request(quizSession.sessionId);
      consumeBoosts(quizSession, updated);
      setQuizSession(updated);
      return updated;
    } catch (error) {
      setQuizAnswerError(errorMessage(error, fallback));
      return null;
    }
  }

  async function handleBuyItem(item: ShopItem) {
    setBuyingItemId(item.id);
    try {
      const result = await buyShopItem(item.id);
      setProfile((current) =>
        current
          ? {
              ...current,
              coins: result.userCoins,
              extraLifeBoosts: result.extraLifeBoosts,
              extraTimeBoosts: result.extraTimeBoosts,
              doubleXpBoosts: result.doubleXpBoosts,
              hintBoosts: result.hintBoosts,
              streakFreezes: result.streakFreezes,
            }
          : current,
      );

      if (result.characterName) {
        setPurchase(result);
        void refreshCollection();
      } else {
        toast.success(`${item.name} adicionado aos seus bônus.`);
      }
      celebrate(result.unlockedAchievements);
    } catch (error) {
      toast.error(errorMessage(error, 'Não foi possível concluir a compra.'));
    } finally {
      setBuyingItemId(null);
    }
  }

  async function handleAbandonQuiz() {
    if (!accessToken || !quizSession) return;
    const ok = await confirm({
      title: 'Abandonar a partida?',
      message: 'Você não ganha XP, pontos nem prêmios por esta partida. Bônus já usados não voltam.',
      confirmLabel: 'Abandonar',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      setQuizSubmitting(true);
      await abandonQuizSession(quizSession.sessionId);
      setReveal(null);
      setPendingResult(null);
      setQuizAnswerError(null);
      setQuizSession(null);
      setShowQuizAnswer(false);
      toast.info('Partida abandonada.');
    } catch (error) {
      toast.error(errorMessage(error, 'Não foi possível abandonar a sessão.'));
    } finally {
      setQuizSubmitting(false);
    }
  }

  async function handleSaveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !profile) return;

    setAccountSubmitting(true);
    try {
      const updated = await updateCurrentUser(profile.id, {
        name: accountForm.name.trim(),
        email: accountForm.email.trim(),
        password: accountForm.password.trim() || undefined,
      });
      setProfile(updated);
      setAccountForm((state) => ({ ...state, password: '' }));
      toast.success('Alterações salvas!');
    } catch (error) {
      toast.error(errorMessage(error, 'Não foi possível salvar as alterações.'));
    } finally {
      setAccountSubmitting(false);
    }
  }

  async function handleDeleteAccount() {
    if (!accessToken || !profile) return;
    const ok = await confirm({
      title: 'Excluir sua conta?',
      message: 'Você perde o acesso, a coleção e o lugar no ranking. Essa ação não pode ser desfeita pelo app.',
      confirmLabel: 'Excluir minha conta',
      tone: 'danger',
    });
    if (!ok) return;

    setDeleteSubmitting(true);
    try {
      await deleteCurrentUser(profile.id);
      signOut();
    } catch (error) {
      toast.error(errorMessage(error, 'Não foi possível excluir a conta.'));
      setDeleteSubmitting(false);
    }
  }

  const openSticker = (id: number) => navigateTo(`/dashboard/figurinhas/${id}`);

  return (
    <div className="min-h-dvh pb-28 sm:pb-10">
      <PlayerHud profile={profile} section={section} onNavigate={navigate} socialNotices={socialSummary ? socialSummary.pendingRequests + socialSummary.pendingTrades + socialSummary.unreadMessages : 0} />

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        {profileError ? (
          <div className="mb-4">
            <Alert tone="danger">{profileError}</Alert>
          </div>
        ) : null}

        {loading ? (
          <LoadingState label="Carregando sua jornada..." />
        ) : (
          <div key={section} className="animate-fade-up">
            {section === 'home' ? (
              <HomeSection
                profile={profile}
                characters={characters}
                collection={collection}
                history={history}
                activeSession={quizSession}
                commentsCount={commentsCount}
                onNavigate={navigate}
                onResume={handleResumeQuiz}
                onOpenSticker={openSticker}
                onWallet={updateWallet}
                onDailyClaimed={(result) => {
                  setProfile((current) => (current ? { ...current, coins: result.userCoins, hintBoosts: result.hintBoosts, dailyStreak: result.streak } : current));
                  toast.success(`Prêmio do dia ${result.day} resgatado!`, {
                    description: `+${result.coins} moedas${result.hints ? ` e +${result.hints} dica 50/50` : ''}`,
                    icon: <CoinIcon />,
                  });
                  celebrate(result.unlockedAchievements);
                }}
              />
            ) : null}

            {section === 'stickers' ? (
              <AlbumSection
                characters={characters}
                ownedIds={ownedIds}
                collection={collection}
                gameRules={gameRules}
                onOpenSticker={openSticker}
                onWallet={(wallet) => {
                  updateWallet(wallet);
                  void refreshCollection();
                }}
                onFused={(result) => {
                  void refreshCollection();
                  setPurchase({ ...result, title: 'Fusão concluída!' });
                  celebrate(result.unlockedAchievements);
                }}
              />
            ) : null}

            {section === 'quiz' ? (
              <PlaySection
                profile={profile}
                characters={characters}
                ownedIds={ownedIds}
                gameRules={gameRules}
                quizForm={quizForm}
                onChangeForm={setQuizForm}
                quizSession={quizSession}
                submitting={quizSubmitting}
                error={quizError}
                onStart={handleStartQuiz}
                onResume={handleResumeQuiz}
                onAbandon={handleAbandonQuiz}
                onStartChallenge={() => void handleStartChallenge()}
              />
            ) : null}

            {section === 'shop' ? (
              <ShopSection items={shopItems} coins={profile?.coins ?? 0} gameRules={gameRules} buyingItemId={buyingItemId} error={shopError} onBuy={handleBuyItem} />
            ) : null}

            {section === 'ranking' ? <RankingSection currentUserId={profile?.id} onWallet={updateWallet} /> : null}

            {section === 'friends' && profile ? (
              <FriendsSection meId={profile.id} summary={socialSummary} onSummaryChange={refreshSocial} onTradeDone={handleTradeDone} onAchievements={celebrate} />
            ) : null}

            {section === 'settings' ? (
              <ProfileSection
                profile={profile}
                ownedCount={collectionProgress?.owned ?? ownedIds.size}
                totalCount={collectionProgress?.total ?? characters.length}
                form={accountForm}
                onChangeForm={setAccountForm}
                submitting={accountSubmitting}
                deleting={deleteSubmitting}
                onSave={handleSaveAccount}
                onAskDelete={handleDeleteAccount}
                onSignOut={signOut}
              />
            ) : null}
          </div>
        )}
      </main>

      <BottomNav section={section} onNavigate={navigate} />

      {quizSession && showQuizAnswer ? (
        <QuizAnswerScreen
          key={`${quizSession.sessionId}-${quizSession.currentQuestion?.id ?? 'none'}-${quizSession.currentQuestionIndex}`}
          session={quizSession}
          reveal={reveal}
          onAnswer={handleAnswerQuiz}
          onNext={() => void handleNextQuestion()}
          onUseExtraTime={() => applyBoost(requestQuizExtraTime, 'Não foi possível usar o tempo extra.')}
          onUseFiftyFifty={() => applyBoost(requestFiftyFifty, 'Não foi possível usar a dica 50/50.')}
          onClose={() => setShowQuizAnswer(false)}
          onAbandon={() => void handleAbandonQuiz()}
          isLoading={quizSubmitting}
          errorMessage={quizAnswerError}
          extraTimeSeconds={gameRules?.extraTimeSeconds ?? 15}
          maxLives={gameRules?.startingLives ?? 3}
          boosts={{
            extraLife: profile?.extraLifeBoosts ?? 0,
            extraTime: profile?.extraTimeBoosts ?? 0,
            doubleXp: profile?.doubleXpBoosts ?? 0,
            hint: profile?.hintBoosts ?? 0,
          }}
        />
      ) : null}

      <MatchResult
        summary={matchSummary}
        minCorrectForReward={gameRules?.rewardMinCorrectAnswers ?? null}
        onContinue={() => {
          setMatchSummary(null);
          navigate('home');
        }}
        onOpenSticker={openSticker}
      />

      <Modal
        open={purchase !== null}
        size="sm"
        title={purchase?.title ?? (purchase?.characterUnlocked ? 'Nova figurinha!' : 'Figurinha repetida')}
        onClose={() => setPurchase(null)}
        footer={
          <>
            {purchase?.characterId ? (
              <Button variant="secondary" onClick={() => openSticker(purchase.characterId!)}>
                Ver figurinha
              </Button>
            ) : null}
            <Button onClick={() => setPurchase(null)}>Continuar</Button>
          </>
        }
      >
        {purchase ? (
          <div className="space-y-4 text-center">
            <div className="animate-pop-in mx-auto w-44">
              <StickerCard name={purchase.characterName ?? ''} rarity={purchase.characterRarity ?? 'COMMON'} imageUrl={purchase.characterImageUrl} owned size="lg" />
            </div>
            <p className="font-display text-lg font-semibold text-ink">
              {purchase.characterName} · {getRarityLabel(purchase.characterRarity ?? 'COMMON')}
            </p>
            {purchase.duplicate ? (
              <p className="text-sm text-muted">Você já tinha esta figurinha: a cópia foi guardada nas repetidas do álbum para vender ou fundir.</p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
