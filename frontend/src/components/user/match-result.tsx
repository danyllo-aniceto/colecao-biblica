import { useEffect, useState } from 'react';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import { Button } from '@/components/ui/button';
import { CoinIcon, ProgressBar } from '@/components/game/game-ui';
import LocalFireDepartmentRoundedIcon from '@mui/icons-material/LocalFireDepartmentRounded';
import CelebrationRoundedIcon from '@mui/icons-material/CelebrationRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import { StickerCard } from '@/components/game/sticker-card';
import type { StickerRarity } from '@/lib/admin-api';
import type { ChestPrize, QuizMatchResult } from '@/lib/user-api';
import { ChestIcon, ChestOpening, useChestLook } from '@/components/user/chest-opening';

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

const CHEST_LABELS = {
  BRONZE: { label: 'Baú de Bronze', tone: 'bg-[#b87333]/20 text-[#8a4f1d] dark:text-[#e0a164]' },
  SILVER: { label: 'Baú de Prata', tone: 'bg-slate-400/25 text-slate-700 dark:text-slate-200' },
  GOLD: { label: 'Baú de Ouro', tone: 'bg-primary/25 text-primary-strong dark:text-primary' },
  DIAMOND: { label: 'Baú de Diamante', tone: 'bg-info/25 text-info' },
} as const;

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
  const [opening, setOpening] = useState(false);
  const [opened, setOpened] = useState(false);
  const matchId = summary?.result.matchId;
  const chestLook = useChestLook(summary?.result.chestTier ?? 'BRONZE');
  useEffect(() => {
    setOpening(false);
    setOpened(false);
  }, [matchId]);

  if (!summary) {
    return null;
  }

  const { result, correct, answered, previousLevel } = summary;
  const study = result.studyStatus ?? null;
  const stars = starsFor(correct, answered);
  const leveledUp = result.userLevel > previousLevel;
  const chestPrizes = result.chestPrizes ?? [];
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
            {result.xpReduced ? (
              <p className="relative mt-3 text-xs font-semibold text-muted">Você já jogou bastante hoje: o XP das partidas extras do dia é menor. Amanhã volta ao normal!</p>
            ) : null}
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
          {result.chestTier && chestPrizes.length > 0 ? (
            opened ? (
              <div className="space-y-3">
                <p className={cn('inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-display text-sm font-bold', CHEST_LABELS[result.chestTier].tone)}>
                  <Inventory2RoundedIcon fontSize="small" /> {chestLook.label}
                </p>
                {result.pityGuaranteed ? <p className="text-xs font-bold uppercase tracking-wider text-violet-strong dark:text-violet">Figurinha garantida pela sorte acumulada</p> : null}
                <ul className="space-y-1 text-sm font-semibold text-ink">
                  {chestPrizes
                    .filter((prize) => prize.kind !== 'STICKER')
                    .map((prize, position) => (
                      <li key={position} className="flex items-center justify-center gap-1.5">
                        {prize.kind === 'COINS' ? (
                          <>
                            <CoinIcon className="h-4 w-4" /> +{prize.amount} moedas
                          </>
                        ) : prize.kind === 'HELPER' ? (
                          <>+1 {prize.name}</>
                        ) : (
                          <>
                            <PaletteRoundedIcon fontSize="small" /> Item visual: {prize.kind === 'COSMETIC' ? prize.name : ''}
                          </>
                        )}
                      </li>
                    ))}
                </ul>
                <div className="flex flex-wrap items-start justify-center gap-3">
                  {chestPrizes
                    .filter((prize): prize is Extract<ChestPrize, { kind: 'STICKER' }> => prize.kind === 'STICKER')
                    .map((prize, position) => (
                      <div key={position} className="w-28 space-y-1">
                        <StickerCard
                          name={prize.name ?? 'Figurinha'}
                          rarity={(prize.rarity ?? 'COMMON') as StickerRarity}
                          imageUrl={prize.imageUrl}
                          owned
                          size="sm"
                          onClick={onOpenSticker && prize.characterId ? () => onOpenSticker(prize.characterId!) : undefined}
                        />
                        <p className="text-xs font-bold text-muted">{prize.unlocked ? 'Nova!' : 'Repetida: foi para as repetidas'}</p>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setOpening(true)} className="group mx-auto flex flex-col items-center gap-2" aria-label={`Abrir ${chestLook.label}`}>
                <ChestIcon tier={result.chestTier} className="animate-chest-idle h-28 w-32 drop-shadow-xl transition group-hover:scale-105" />
                <span className="font-display text-lg font-bold text-ink">{chestLook.label}</span>
                <span className="rounded-full bg-primary px-5 py-2 font-display text-sm font-bold text-on-primary">Toque para abrir</span>
              </button>
            )
          ) : dailyLimitReached ? (
            <p className="text-sm text-muted">Você já abriu os {result.rewardMatchesLimitPerDay} baús de hoje. Amanhã tem mais!</p>
          ) : (
            <p className="text-sm text-muted">
              Sem baú desta vez.
              {minCorrectForReward ? ` Na maratona, acerte ${minCorrectForReward}+ para ganhar um baú (o treino não rende baú).` : ''}
            </p>
          )}
        </div>

        {result.rewardMatchesLimitPerDay > 0 ? (
          <p className="relative mt-4 text-xs font-bold uppercase tracking-wider text-muted">
            Baús hoje: {result.rewardMatchesUsedToday}/{result.rewardMatchesLimitPerDay}
          </p>
        ) : null}

          </>
        )}

        <Button size="xl" className="relative mt-5 w-full" onClick={onContinue}>
          Continuar
        </Button>
      </div>
      {opening && result.chestTier ? (
        <ChestOpening
          tier={result.chestTier}
          prizes={chestPrizes}
          onDone={() => {
            setOpening(false);
            setOpened(true);
          }}
        />
      ) : null}
    </div>
  );
}
