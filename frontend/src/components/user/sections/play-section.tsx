import type { FormEvent } from 'react';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import PersonSearchRoundedIcon from '@mui/icons-material/PersonSearchRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import { Button } from '@/components/ui/button';
import { fieldClassName } from '@/components/ui/input';
import { Alert, BoostChips, ProgressBar, SectionHeading } from '@/components/game/game-ui';
import type { CharacterEntry, GameRules, QuizSessionStatus } from '@/lib/user-api';
import type { UserProfile } from '@/types/auth';

export type QuizFormState = {
  quizType: 'GENERAL' | 'CHARACTER_STUDY';
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
  gameRules: GameRules | null;
  quizForm: QuizFormState;
  onChangeForm: (updater: (current: QuizFormState) => QuizFormState) => void;
  quizSession: QuizSessionStatus | null;
  submitting: boolean;
  error: string | null;
  feedback: string | null;
  onStart: (event: FormEvent<HTMLFormElement>) => void;
  onResume: () => void;
  onAbandon: () => void;
};

export function PlaySection({
  profile,
  characters,
  gameRules,
  quizForm,
  onChangeForm,
  quizSession,
  submitting,
  error,
  feedback,
  onStart,
  onResume,
  onAbandon,
}: PlaySectionProps) {
  if (quizSession) {
    const answered = quizSession.currentQuestionIndex;
    return (
      <div className="space-y-5">
        <SectionHeading title="Partida em andamento" subtitle="O cronômetro da pergunta continua correndo." />
        <section className="panel space-y-5 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-display text-xl font-semibold text-ink">
              Questão {answered + 1} de {quizSession.totalQuestions}
            </p>
            <Hearts lives={quizSession.livesRemaining} />
          </div>
          <ProgressBar value={(answered / Math.max(quizSession.totalQuestions, 1)) * 100} className="h-4" />
          <p className="text-sm font-semibold text-muted">
            {quizSession.correctAnswers} acertos · {quizSession.wrongAnswers} erros
          </p>
          <div className="flex flex-wrap gap-3">
            <Button size="xl" variant="accent" onClick={onResume} disabled={submitting}>
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

  const isGeneral = quizForm.quizType === 'GENERAL';
  const limit = Number(quizForm.questionLimit);

  return (
    <form className="space-y-5" onSubmit={onStart}>
      <SectionHeading title="Escolha o desafio" subtitle="Quanto mais você acerta, mais XP e prêmios ganha." />

      <div className="grid gap-4 sm:grid-cols-2">
        <ModeCard
          active={isGeneral}
          onClick={() => onChangeForm((current) => ({ ...current, quizType: 'GENERAL' }))}
          icon={<PublicRoundedIcon sx={{ fontSize: 36 }} />}
          title="Quiz geral"
          description={gameRules ? `Perguntas de toda a Bíblia. Acerte ${gameRules.rewardMinCorrectAnswers}+ para concorrer a um prêmio.` : 'Perguntas de toda a Bíblia, com prêmios.'}
          tone="primary"
        />
        <ModeCard
          active={!isGeneral}
          onClick={() => onChangeForm((current) => ({ ...current, quizType: 'CHARACTER_STUDY' }))}
          icon={<PersonSearchRoundedIcon sx={{ fontSize: 36 }} />}
          title="Estudo de personagem"
          description={gameRules ? `Foque em um personagem. Acerte ${gameRules.characterStickerMinAccuracyPercent}% para ganhar a figurinha dele.` : 'Foque em um personagem e ganhe a figurinha dele.'}
          tone="violet"
        />
      </div>

      <section className="panel space-y-5 p-5 sm:p-6">
        {!isGeneral ? (
          <label className="block space-y-2">
            <span className="text-sm font-bold text-muted">Personagem</span>
            <select
              className={cn(fieldClassName, 'h-12 w-full')}
              value={quizForm.characterId}
              onChange={(event) => onChangeForm((current) => ({ ...current, characterId: event.target.value }))}
              required
            >
              <option value="">Escolha um personagem</option>
              {characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

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

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-muted">Seus bônus:</span>
          <BoostChips life={profile?.extraLifeBoosts ?? 0} time={profile?.extraTimeBoosts ?? 0} xp={profile?.doubleXpBoosts ?? 0} />
        </div>

        {error ? <Alert tone="danger">{error}</Alert> : null}
        {feedback ? <Alert tone="success">{feedback}</Alert> : null}

        <Button type="submit" size="xl" className="w-full sm:w-auto" disabled={submitting}>
          <PlayArrowRoundedIcon />
          {submitting ? 'Preparando...' : 'Começar partida'}
        </Button>
      </section>
    </form>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  title,
  description,
  tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  tone: 'primary' | 'violet';
}) {
  const toneClass = tone === 'primary' ? 'bg-primary text-on-primary' : 'bg-violet text-white';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'panel flex items-start gap-4 p-5 text-left transition',
        active ? 'ring-4 ring-primary/50' : 'opacity-80 hover:opacity-100',
      )}
    >
      <span className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl', toneClass)}>{icon}</span>
      <span>
        <span className="block font-display text-xl font-bold text-ink">{title}</span>
        <span className="mt-1 block text-sm text-muted">{description}</span>
      </span>
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
