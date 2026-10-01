import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import ContentCutRoundedIcon from '@mui/icons-material/ContentCutRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import TimerRoundedIcon from '@mui/icons-material/TimerRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import { Button } from '@/components/ui/button';
import { CoinIcon } from '@/components/game/game-ui';
import { StickerCard } from '@/components/game/sticker-card';
import type { StickerRarity } from '@/lib/admin-api';
import type { QuizMatchResult } from '@/lib/user-api';

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export type MatchSummary = {
  result: QuizMatchResult;
  correct: number;
  answered: number;
  previousLevel: number;
};

function starsFor(correct: number, answered: number) {
  if (answered <= 0) {
    return 0;
  }
  const accuracy = correct / answered;
  if (accuracy >= 0.9) return 3;
  if (accuracy >= 0.7) return 2;
  if (accuracy >= 0.4) return 1;
  return 0;
}

const HEADLINES = ['Continue tentando!', 'Boa!', 'Muito bem!', 'Incrível!'];

export function MatchResult({
  summary,
  minCorrectForReward,
  onContinue,
  onOpenSticker,
}: {
  summary: MatchSummary | null;
  minCorrectForReward: number | null;
  onContinue: () => void;
  onOpenSticker?: (id: number) => void;
}) {
  if (!summary) {
    return null;
  }

  const { result, correct, answered, previousLevel } = summary;
  const stars = starsFor(correct, answered);
  const leveledUp = result.userLevel > previousLevel;
  const wonSticker = (result.rewardType === 'STICKER' || result.rewardType === 'STICKER_PACK') && result.rewardCharacterName;
  const dailyLimitReached = !result.rewardGranted && result.rewardMatchesLimitPerDay > 0 && result.rewardMatchesUsedToday >= result.rewardMatchesLimitPerDay;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Resultado da partida">
      <div className="panel animate-pop-in relative w-full max-w-md overflow-hidden p-6 text-center">
        <div className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-48 rounded-full bg-primary/40 blur-3xl" />

        <div className="relative flex justify-center gap-1" aria-label={`${stars} de 3 estrelas`}>
          {[0, 1, 2].map((index) => (
            <StarRoundedIcon
              key={index}
              className={cn('animate-pop-in', index < stars ? 'text-primary drop-shadow-[0_4px_0_var(--primary-strong)]' : 'text-surface-3')}
              sx={{ fontSize: index === 1 ? 72 : 56 }}
              style={{ animationDelay: `${200 + index * 180}ms` }}
            />
          ))}
        </div>

        <h2 className="relative mt-2 font-display text-3xl font-bold text-ink">{HEADLINES.at(stars)}</h2>
        <p className="relative text-sm font-semibold text-muted">
          {correct} de {answered} {answered === 1 ? 'acerto' : 'acertos'}
        </p>

        <div className="relative mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-violet/15 p-3">
            <div className="font-display text-2xl font-bold text-violet-strong dark:text-violet">+{result.xpGained}</div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted">XP</div>
          </div>
          <div className="rounded-2xl bg-accent/15 p-3">
            <div className="font-display text-2xl font-bold text-accent-strong dark:text-accent">
              {result.scoreGained >= 0 ? '+' : ''}
              {result.scoreGained}
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted">Pontos</div>
          </div>
          <div className="rounded-2xl bg-primary/15 p-3">
            <div className="flex items-center justify-center gap-1 font-display text-2xl font-bold text-primary-strong dark:text-primary">
              <CoinIcon className="h-5 w-5" />+{result.coinsGained ?? 0}
            </div>
            <div className="text-xs font-bold uppercase tracking-wider text-muted">Moedas</div>
          </div>
        </div>

        {leveledUp ? (
          <div className="relative mt-3 flex items-center justify-center gap-2 rounded-2xl bg-primary/20 p-3 font-display font-bold text-ink">
            <TrendingUpRoundedIcon className="text-primary-strong dark:text-primary" />
            Subiu para o nível {result.userLevel}!
          </div>
        ) : null}

        <div className="relative mt-5">
          {wonSticker ? (
            <div className="space-y-3">
              <p className="font-display text-lg font-bold text-ink">{result.rewardCharacterUnlocked ? 'Nova figurinha!' : 'Figurinha repetida'}</p>
              <div className="mx-auto w-40">
                <StickerCard
                  name={result.rewardCharacterName ?? ''}
                  rarity={(result.rewardCharacterRarity ?? 'COMMON') as StickerRarity}
                  imageUrl={result.rewardCharacterImageUrl}
                  owned
                  onClick={onOpenSticker && result.rewardCharacterId ? () => onOpenSticker(result.rewardCharacterId!) : undefined}
                />
              </div>
              {!result.rewardCharacterUnlocked ? (
                <p className="text-sm text-muted">{result.duplicateCoins ? `Você já tinha: virou +${result.duplicateCoins} moedas.` : 'Você já tinha essa figurinha.'}</p>
              ) : null}
            </div>
          ) : result.rewardGranted ? (
            <div className="flex flex-col items-center gap-2">
              <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-surface-2">
                <RewardIcon type={result.rewardType} />
              </span>
              <p className="font-display text-lg font-bold text-ink">{result.rewardName}</p>
            </div>
          ) : dailyLimitReached ? (
            <p className="text-sm text-muted">Você já ganhou os {result.rewardMatchesLimitPerDay} prêmios de hoje. Amanhã tem mais!</p>
          ) : (
            <p className="text-sm text-muted">
              Sem prêmio desta vez.
              {minCorrectForReward ? ` No quiz geral, acerte ${minCorrectForReward}+ para concorrer.` : ''}
            </p>
          )}
        </div>

        {result.rewardMatchesLimitPerDay > 0 ? (
          <p className="relative mt-4 text-xs font-bold uppercase tracking-wider text-muted">
            Prêmios hoje: {result.rewardMatchesUsedToday}/{result.rewardMatchesLimitPerDay}
          </p>
        ) : null}

        <Button size="xl" className="relative mt-5 w-full" onClick={onContinue}>
          Continuar
        </Button>
      </div>
    </div>
  );
}

function RewardIcon({ type }: { type?: string | null }) {
  if (type === 'COINS') return <CoinIcon className="h-12 w-12" />;
  if (type === 'FIFTY_FIFTY') return <ContentCutRoundedIcon className="text-violet" sx={{ fontSize: 48 }} />;
  if (type === 'EXTRA_LIFE') return <FavoriteRoundedIcon className="text-danger" sx={{ fontSize: 48 }} />;
  if (type === 'EXTRA_TIME') return <TimerRoundedIcon className="text-info" sx={{ fontSize: 48 }} />;
  return <BoltRoundedIcon className="text-primary" sx={{ fontSize: 48 }} />;
}
