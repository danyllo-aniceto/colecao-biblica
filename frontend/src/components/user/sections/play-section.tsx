import type { FormEvent } from 'react';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import FitnessCenterRoundedIcon from '@mui/icons-material/FitnessCenterRounded';
import PersonSearchRoundedIcon from '@mui/icons-material/PersonSearchRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import { Button } from '@/components/ui/button';
import { fieldClassName } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Alert, BoostChips, ProgressBar, SectionHeading } from '@/components/game/game-ui';
import { DailyChallengeCard } from '@/components/user/daily-challenge-card';
import { DailyChestsCard } from '@/components/user/daily-chests-card';
import type { CharacterEntry, GameRules, QuizSessionStatus, UserSticker } from '@/lib/user-api';
import type { UserProfile } from '@/types/auth';

export type QuizFormState = {
  quizType: 'MARATHON' | 'TRAINING' | 'CHARACTER_STUDY';
  characterId: string;
  questionLimit: string;
};

const QUESTION_PRESETS = [5, 10, 15, 20];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

type PlaySectionProps = {
  profile: UserProfile | null;
  characters: CharacterEntry[];
  ownedIds: Set<number>;
  collection: UserSticker[];
  gameRules: GameRules | null;
  quizForm: QuizFormState;
  onChangeForm: (updater: (current: QuizFormState) => QuizFormState) => void;
  quizSession: QuizSessionStatus | null;
  submitting: boolean;
  error: string | null;
  onStart: (event: FormEvent<HTMLFormElement>) => void;
  onResume: () => void;
  onAbandon: () => void;
  onStartChallenge: () => void;
};

export function PlaySection({
  profile,
  characters,
  ownedIds,
  collection,
  gameRules,
  quizForm,
  onChangeForm,
  quizSession,
  submitting,
  error,
  onStart,
  onResume,
  onAbandon,
  onStartChallenge,
}: PlaySectionProps) {
  if (quizSession) {
    const answered = quizSession.currentQuestionIndex;
    return (
      <div className="space-y-5">
        <SectionHeading title="Partida em andamento" subtitle="O cronômetro da pergunta continua correndo." />
        <section className="panel space-y-5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-display text-xl font-semibold text-ink">
              {quizSession.marathon ? `Questão ${answered + 1}` : `Questão ${answered + 1} de ${quizSession.totalQuestions}`}
            </p>
            <Hearts lives={quizSession.livesRemaining} />
          </div>
          {quizSession.marathon ? null : <ProgressBar value={(answered / Math.max(quizSession.totalQuestions, 1)) * 100} className="h-4" />}
          <p className="text-sm font-semibold text-muted">
            {quizSession.correctAnswers} acertos · {quizSession.wrongAnswers} erros
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="xl" variant="accent" onClick={onResume} loading={submitting}>
              <PlayArrowRoundedIcon />
              Continuar
            </Button>
            <Button size="xl" variant="secondary" onClick={onAbandon} disabled={submitting}>
              Abandonar
            </Button>
          </div>
          {error ? <Alert tone="danger">{error}</Alert> : null}
        </section>
      </div>
    );
  }

  const isStudy = quizForm.quizType === 'CHARACTER_STUDY';
  const isMarathon = quizForm.quizType === 'MARATHON';
  const limit = Number(quizForm.questionLimit);
  const studyById = new Map(collection.map((item) => [item.characterId, item.study]));
  const studyCharacters = [...characters]
    .filter((character) => ownedIds.has(character.id))
    .sort((left, right) => Number(right.questionCount > 0) - Number(left.questionCount > 0) || left.name.localeCompare(right.name, 'pt-BR'));
  const selectedCharacter = characters.find((character) => String(character.id) === quizForm.characterId);

  const modeDescription = isMarathon
    ? gameRules
      ? `Perguntas de toda a Bíblia até suas ${gameRules.startingLives} vidas acabarem. Acerte ${gameRules.rewardMinCorrectAnswers}+ para ganhar um baú (até ${gameRules.rewardMatchLimitPerDay} por dia): quanto mais acertos, melhor o baú.`
      : 'Perguntas de toda a Bíblia até suas vidas acabarem. Quanto mais acertos, melhor o baú.'
    : isStudy
      ? 'Estudo de personagem: só para personagens que você já tem. Não rende prêmios: cada acerto soma no status do personagem.'
      : 'Você escolhe quantas perguntas. Sem baú: serve para praticar com calma.';

  return (
    <form className="space-y-4" onSubmit={onStart}>
      <SectionHeading title="Escolha o desafio" subtitle="Quanto mais você acerta, mais XP e prêmios ganha." />

      {/* Recontado a cada partida que termina (a sessão volta a ser nula). */}
      <DailyChestsCard refreshKey={quizSession === null} />

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <ModeCard
          active={isMarathon}
          onClick={() => onChangeForm((current) => ({ ...current, quizType: 'MARATHON' }))}
          icon={<PublicRoundedIcon sx={{ fontSize: 30 }} />}
          title="Maratona"
          tone="primary"
        />
        <ModeCard
          active={quizForm.quizType === 'TRAINING'}
          onClick={() => onChangeForm((current) => ({ ...current, quizType: 'TRAINING' }))}
          icon={<FitnessCenterRoundedIcon sx={{ fontSize: 30 }} />}
          title="Treino"
          tone="accent"
        />
        <ModeCard
          active={isStudy}
          onClick={() => onChangeForm((current) => ({ ...current, quizType: 'CHARACTER_STUDY' }))}
          icon={<PersonSearchRoundedIcon sx={{ fontSize: 30 }} />}
          title="Estudo"
          tone="violet"
        />
      </div>

      <section className="panel space-y-4 p-4 sm:p-6">
        <p className="text-sm font-semibold text-muted">{modeDescription}</p>

        {isStudy ? (
          <div className="space-y-2">
            <span className="text-sm font-bold text-muted">Personagem</span>
            <Select
              aria-label="Personagem"
              searchable
              value={quizForm.characterId}
              placeholder="Escolha um personagem"
              onChange={(value) => onChangeForm((current) => ({ ...current, characterId: value }))}
              options={studyCharacters.map((character) => {
                const study = studyById.get(character.id);
                return {
                  value: String(character.id),
                  label: character.name,
                  disabled: character.questionCount === 0,
                  description:
                    character.questionCount === 0
                      ? 'Ainda sem perguntas'
                      : `${study?.label ?? 'Iniciante'} · ${study?.correctAnswers ?? 0} acerto(s) · ${character.questionCount} pergunta(s)`,
                };
              })}
            />
            {studyCharacters.length === 0 ? <p className="text-xs font-semibold text-muted">Você ainda não tem figurinhas para estudar. Jogue o quiz geral para conquistar as primeiras.</p> : null}
            {selectedCharacter && selectedCharacter.questionCount < limit ? (
              <p className="text-xs font-semibold text-muted">Este personagem tem {selectedCharacter.questionCount} pergunta(s): a partida terá no máximo esse número.</p>
            ) : null}
          </div>
        ) : null}

        {isMarathon ? (
          <p className="rounded-2xl bg-surface-2 p-4 text-sm font-semibold text-muted">Sem limite de perguntas: você joga até perder todas as vidas. Responda rápido e sem errar para chegar longe.</p>
        ) : (
        <fieldset className="space-y-2">
          <legend className="text-sm font-bold text-muted">Número de perguntas</legend>
          <div className="flex flex-wrap gap-2">
            {QUESTION_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => onChangeForm((current) => ({ ...current, questionLimit: String(preset) }))}
                aria-pressed={limit === preset}
                className={cn(
                  'h-12 min-w-14 rounded-2xl border-2 px-4 font-display text-lg font-bold transition',
                  limit === preset ? 'border-primary bg-primary/15 text-ink' : 'border-edge bg-surface-2 text-muted hover:text-ink',
                )}
              >
                {preset}
              </button>
            ))}
            <input
              type="number"
              min={1}
              max={gameRules?.maxQuestionsPerMatch ?? 100}
              value={quizForm.questionLimit}
              onChange={(event) => onChangeForm((current) => ({ ...current, questionLimit: event.target.value }))}
              aria-label="Outro número de perguntas"
              className={cn(fieldClassName, 'h-12 w-24 text-center font-display text-lg')}
              required
            />
          </div>
        </fieldset>
        )}

        {error ? <Alert tone="danger">{error}</Alert> : null}

        <Button type="submit" size="xl" className="w-full" loading={submitting} disabled={isStudy && !quizForm.characterId}>
          {submitting ? null : <PlayArrowRoundedIcon />}
          {submitting ? 'Preparando...' : 'Começar partida'}
        </Button>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-muted">Seus bônus:</span>
          <BoostChips life={profile?.extraLifeBoosts ?? 0} time={profile?.extraTimeBoosts ?? 0} xp={profile?.doubleXpBoosts ?? 0} hint={profile?.hintBoosts ?? 0} />
        </div>

        {gameRules ? (
          <p className="text-sm text-muted">
            Cada acerto vale {gameRules.coinsPerCorrectAnswer} moeda(s){isStudy ? ' (no estudo de personagem não há moedas nem XP)' : ''}; partida perfeita com 5+ perguntas dá +{gameRules.perfectMatchBonusCoins}.
          </p>
        ) : null}

      </section>

      <DailyChallengeCard onStart={onStartChallenge} starting={submitting} currentUserId={profile?.id} />
    </form>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  tone: 'primary' | 'violet' | 'accent';
}) {
  const toneClass = tone === 'primary' ? 'bg-primary text-on-primary' : tone === 'accent' ? 'bg-accent text-white' : 'bg-violet text-white';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn('panel flex flex-col items-center gap-2 p-3 text-center transition sm:p-4', active ? 'ring-4 ring-primary/50' : 'opacity-75 hover:opacity-100')}
    >
      <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl', toneClass)}>{icon}</span>
      <span className="font-display text-base font-bold leading-tight text-ink sm:text-lg">{title}</span>
    </button>
  );
}

export function Hearts({ lives, max = 3 }: { lives: number; max?: number }) {
  const total = Math.max(max, lives);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${lives} vidas`}>
      {Array.from({ length: total }, (_, index) => (
        <FavoriteRoundedIcon key={index} className={index < lives ? 'text-danger' : 'text-surface-3'} />
      ))}
    </span>
  );
}
