import { QUIZ_TYPE_LABELS } from '@/lib/labels';
import CollectionsBookmarkRoundedIcon from '@mui/icons-material/CollectionsBookmarkRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, ProgressBar, SectionHeading, StatTile } from '@/components/game/game-ui';
import { StickerCard } from '@/components/game/sticker-card';
import type { SectionId } from '@/components/user/game-shell';
import { DailyRewardCard } from '@/components/user/daily-reward-card';
import { MissionsCard } from '@/components/user/missions-card';
import { RARITY_ORDER, getRarityLabel } from '@/lib/rarity-theme';
import type { CharacterEntry, DailyClaimResult, QuizHistory, QuizSessionStatus, UserSticker } from '@/lib/user-api';
import type { UserProfile } from '@/types/auth';

type HomeSectionProps = {
  profile: UserProfile | null;
  characters: CharacterEntry[];
  collection: UserSticker[];
  history: QuizHistory | null;
  activeSession: QuizSessionStatus | null;
  commentsCount: number;
  onNavigate: (id: SectionId) => void;
  onResume: () => void;
  onOpenSticker: (id: number) => void;
  onDailyClaimed: (result: DailyClaimResult) => void;
  onWallet: (wallet: { userCoins: number; hintBoosts?: number }) => void;
};

export function HomeSection({ profile, characters, collection, history, activeSession, commentsCount, onNavigate, onResume, onOpenSticker, onDailyClaimed, onWallet }: HomeSectionProps) {
  const ownedIds = new Set(collection.map((item) => item.characterId));
  const firstName = profile?.name?.split(' ')[0] ?? 'jogador';
  const recentStickers = [...collection]
    .sort((a, b) => (b.acquiredAt ?? '').localeCompare(a.acquiredAt ?? ''))
    .slice(0, 4);
  const matches = history?.matches ?? [];

  return (
    <div className="space-y-6">
      <section className="panel relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-violet/25 blur-3xl" />
        <div className="relative grid items-center gap-6 md:grid-cols-[1fr_auto]">
          <div>
            <Badge tone="accent">Sua jornada</Badge>
            <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-ink sm:text-4xl">Olá, {firstName}! Pronto para mais uma rodada?</h1>
            <p className="mt-2 max-w-xl text-muted">Responda perguntas, ganhe XP e complete o seu álbum de personagens da Bíblia.</p>
            <div className="mt-5 flex flex-wrap gap-3">
              {activeSession ? (
                <Button size="xl" variant="accent" onClick={onResume}>
                  <PlayArrowRoundedIcon />
                  Continuar partida ({activeSession.currentQuestionIndex + 1}/{activeSession.totalQuestions})
                </Button>
              ) : (
                <Button size="xl" onClick={() => onNavigate('quiz')}>
                  <PlayArrowRoundedIcon />
                  Jogar agora
                </Button>
              )}
              <Button size="xl" variant="secondary" onClick={() => onNavigate('stickers')}>
                <CollectionsBookmarkRoundedIcon />
                Ver álbum
              </Button>
            </div>
          </div>
          <img src="/icons/icon-512.png" alt="" width={176} height={176} className="animate-float hidden h-44 w-44 rounded-[2rem] shadow-[0_20px_40px_-12px_var(--shadow)] md:block" />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <DailyRewardCard onClaimed={onDailyClaimed} />
        <MissionsCard onClaimed={onWallet} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={<StarRoundedIcon />} label="Nível" value={profile?.level ?? 1} tone="violet" />
        <StatTile icon={<CollectionsBookmarkRoundedIcon />} label="Figurinhas" value={`${ownedIds.size}/${characters.length}`} tone="accent" />
        <StatTile icon={<EmojiEventsRoundedIcon />} label="Pontos" value={(profile?.totalScore ?? 0).toLocaleString('pt-BR')} tone="primary" />
        <StatTile icon={<EditNoteRoundedIcon />} label="Anotações" value={commentsCount} tone="info" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="panel space-y-4 p-5 sm:p-6">
          <SectionHeading title="Progresso do álbum" subtitle="Figurinhas conquistadas por raridade" />
          <div className="space-y-4">
            {RARITY_ORDER.map((rarity) => {
              const total = characters.filter((character) => character.rarity === rarity).length;
              const owned = characters.filter((character) => character.rarity === rarity && ownedIds.has(character.id)).length;
              return (
                <div key={rarity} className="rarity" data-rarity={rarity}>
                  <div className="mb-1.5 flex items-center justify-between text-sm font-bold">
                    <span className="rarity-text font-display text-base">{getRarityLabel(rarity)}</span>
                    <span className="text-muted">
                      {owned}/{total}
                    </span>
                  </div>
                  <ProgressBar value={total ? (owned / total) * 100 : 0} color="var(--r)" />
                </div>
              );
            })}
          </div>
          {recentStickers.length > 0 ? (
            <>
              <h3 className="pt-2 font-display text-lg font-semibold text-ink">Conquistadas recentemente</h3>
              <div className="grid grid-cols-4 gap-2 sm:gap-3">
                {recentStickers.map((sticker) => (
                  <StickerCard
                    key={sticker.characterId}
                    name={sticker.characterName}
                    rarity={sticker.rarity}
                    imageUrl={sticker.imageUrl}
                    owned
                    size="sm"
                    onClick={() => onOpenSticker(sticker.characterId)}
                  />
                ))}
              </div>
            </>
          ) : null}
        </section>

        <section className="panel space-y-4 p-5 sm:p-6">
          <SectionHeading title="Últimas partidas" />
          {matches.length > 0 ? (
            <ul className="space-y-2">
              {matches.map((match) => (
                <li key={match.matchId} className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet/15 text-violet-strong dark:text-violet">
                    <HistoryRoundedIcon />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display font-semibold text-ink">{QUIZ_TYPE_LABELS[match.quizType] ?? 'Partida'}</p>
                    <p className="text-xs font-semibold text-muted">
                      {match.correctAnswers} acertos · +{match.xpGained} XP{match.coinsGained ? ` · +${match.coinsGained} moedas` : ''} · {match.scoreGained >= 0 ? '+' : ''}
                      {match.scoreGained} pts
                    </p>
                  </div>
                  {match.rewardGranted ? <Badge tone="primary">{match.rewardGrantedName ?? 'Prêmio'}</Badge> : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<HistoryRoundedIcon fontSize="large" />} title="Nenhuma partida ainda">
              Sua primeira partida aparece aqui.
            </EmptyState>
          )}
        </section>
      </div>
    </div>
  );
}
