import StarRoundedIcon from '@mui/icons-material/StarRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import { Button } from '@/components/ui/button';
import { CoinIcon, ProgressBar } from '@/components/game/game-ui';
import { rewardVisual } from '@/lib/reward-visual';
import LocalFireDepartmentRoundedIcon from '@mui/icons-material/LocalFireDepartmentRounded';
import CelebrationRoundedIcon from '@mui/icons-material/CelebrationRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
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
  const study = result.studyStatus ?? null;
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

        {study ? (
          <div className="relative mt-5 space-y-2 rounded-2xl bg-violet/15 p-4 text-left">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-display text-lg font-bold text-violet-strong dark:text-violet">
                <SchoolRoundedIcon /> {study.label}
              </span>
              <span className="text-sm font-bold text-muted">
                {study.correctAnswers} {study.correctAnswers === 1 ? 'acerto' : 'acertos'} no total
              </span>
            </div>
            {study.nextAt ? (
              <>
                <ProgressBar value={(study.correctAnswers / study.nextAt) * 100} className="h-3" />
                <p className="text-xs font-semibold text-muted">
                  Faltam {study.nextAt - study.correctAnswers} acerto(s) para {study.nextLabel}.
                </p>
              </>
            ) : (
              <p className="text-xs font-semibold text-muted">Status máximo alcançado.</p>
            )}
            {result.studyLevelUp ? <p className="font-display font-bold text-ink">Você subiu de status!</p> : null}
            <p className="text-xs text-muted">O estudo de personagem não rende XP, moedas nem prêmios: é só para aprender e acompanhar seu avanço.</p>
          </div>
        ) : (
          <>
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

          </>
        )}

        {study ? null : (
          <>
        {leveledUp ? (
          <div className="relative mt-3 flex flex-col items-center justify-center gap-1 rounded-2xl bg-primary/20 p-3 font-display font-bold text-ink">
            <span className="flex items-center gap-2">
              <TrendingUpRoundedIcon className="text-primary-strong dark:text-primary" />
              Subiu para o nível {result.userLevel}!
            </span>
            {result.chestsPending ? (
              <span className="flex items-center gap-1.5 text-sm text-primary-strong dark:text-primary">
                <Inventory2RoundedIcon fontSize="small" /> Um baú de nível está esperando por você no início.
              </span>
            ) : null}
          </div>
        ) : null}

        {(result.bestCombo ?? 0) >= 3 || (result.coinMultiplier ?? 1) > 1 || result.eventName ? (
          <div className="relative mt-3 flex flex-wrap justify-center gap-2 text-sm font-bold">
            {(result.bestCombo ?? 0) >= 3 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-danger/15 px-3 py-1 text-danger">
                <LocalFireDepartmentRoundedIcon fontSize="small" /> {result.bestCombo} seguidas
                {result.comboBonusPoints ? ` · +${result.comboBonusPoints} pts` : ''}
              </span>
            ) : null}
            {(result.coinMultiplier ?? 1) > 1 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-3 py-1 text-primary-strong dark:text-primary">
                <CoinIcon className="h-4 w-4" /> Moedas x{result.coinMultiplier}
              </span>
            ) : null}
            {result.eventName ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet/15 px-3 py-1 text-violet-strong dark:text-violet">
                <CelebrationRoundedIcon fontSize="small" /> Bônus do evento {result.eventName}
              </span>
            ) : null}
          </div>
        ) : null}

        {result.unlockedCosmetics?.length ? (
          <div className="relative mt-3 rounded-2xl bg-accent/15 p-3 text-sm font-bold text-accent-strong dark:text-accent">
            <PaletteRoundedIcon fontSize="small" /> Item novo liberado: {result.unlockedCosmetics.map((item) => item.name).join(', ')}. Equipe em Perfil → Visual.
          </div>
        ) : null}

        <div className="relative mt-5">
          {wonSticker ? (
            <div className="space-y-3">
              <p className="font-display text-lg font-bold text-ink">{result.rewardCharacterUnlocked ? 'Nova figurinha!' : 'Figurinha repetida'}</p>
              {result.pityGuaranteed ? <p className="text-xs font-bold uppercase tracking-wider text-violet-strong dark:text-violet">Figurinha garantida pela sorte acumulada</p> : null}
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
                <p className="text-sm text-muted">Você já tinha: a cópia foi guardada nas repetidas do álbum (venda ou funda).</p>
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

        {result.rewardGranted && !wonSticker && result.pityRemaining ? (
          <p className="relative mt-3 text-xs text-muted">
            {result.pityRemaining === 1 ? 'O próximo prêmio é figurinha garantida!' : `Figurinha garantida em no máximo ${result.pityRemaining} prêmios.`}
          </p>
        ) : null}

        {result.rewardMatchesLimitPerDay > 0 ? (
          <p className="relative mt-4 text-xs font-bold uppercase tracking-wider text-muted">
            Prêmios hoje: {result.rewardMatchesUsedToday}/{result.rewardMatchesLimitPerDay}
          </p>
        ) : null}

          </>
        )}

        <Button size="xl" className="relative mt-5 w-full" onClick={onContinue}>
          Continuar
        </Button>
      </div>
    </div>
  );
}

function RewardIcon({ type }: { type?: string | null }) {
  const { icon, tint } = rewardVisual(type, 44);
  return <span className={cn('flex h-full w-full items-center justify-center rounded-3xl text-5xl', tint)}>{icon}</span>;
}
