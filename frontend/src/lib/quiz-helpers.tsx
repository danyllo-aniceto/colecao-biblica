import type { ReactNode } from 'react';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import HourglassBottomRoundedIcon from '@mui/icons-material/HourglassBottomRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import MonetizationOnRoundedIcon from '@mui/icons-material/MonetizationOnRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded';
import type { QuizHelperAction, QuizSessionStatus } from '@/lib/user-api';
import type { UserProfile } from '@/types/auth';

export type HelperField = 'skipBoosts' | 'secondChanceBoosts' | 'crowdBoosts' | 'verseHintBoosts' | 'freezeTimeBoosts' | 'doubleCoinsBoosts' | 'comboShieldBoosts';
type UsedKey = 'skipUsed' | 'secondChanceUsed' | 'crowdUsed' | 'verseHintUsed' | 'freezeUsed' | 'doubleCoinsUsed' | 'comboShieldUsed';

export type QuizHelper = {
  action: QuizHelperAction;
  rewardType: string;
  field: HelperField;
  usedKey: UsedKey;
  /** Nome na loja/inventário. */
  name: string;
  /** Rótulo curto no botão do quiz. */
  short: string;
  hint: string;
  icon: ReactNode;
  tone: 'info' | 'danger' | 'primary' | 'violet' | 'accent' | 'success';
  /** Precisa de tempo sobrando na pergunta. */
  needsTime: boolean;
};

/** As 7 ajudas novas (as 4 antigas ficam na própria tela do quiz). */
export const QUIZ_HELPERS: QuizHelper[] = [
  { action: 'skip',
    rewardType: 'SKIP_QUESTION', field: 'skipBoosts', usedKey: 'skipUsed', name: 'Pular pergunta', short: 'Pular', hint: 'Troca a pergunta por outra, sem perder vida', icon: <SkipNextRoundedIcon />, tone: 'info', needsTime: true },
  {
    action: 'second-chance',
    rewardType: 'SECOND_CHANCE',
    field: 'secondChanceBoosts',
    usedKey: 'secondChanceUsed',
    name: 'Segunda chance',
    short: '2ª chance',
    hint: 'Se errar esta pergunta, a alternativa sai e você tenta de novo sem perder vida',
    icon: <ReplayRoundedIcon />,
    tone: 'success',
    needsTime: true,
  },
  { action: 'crowd',
    rewardType: 'CROWD_HELP', field: 'crowdBoosts', usedKey: 'crowdUsed', name: 'Voz da multidão', short: 'Multidão', hint: 'Mostra quantos % dos jogadores escolheram cada alternativa', icon: <GroupsRoundedIcon />, tone: 'accent', needsTime: true },
  {
    action: 'verse-hint',
    rewardType: 'VERSE_HINT',
    field: 'verseHintBoosts',
    usedKey: 'verseHintUsed',
    name: 'Pista do versículo',
    short: 'Versículo',
    hint: 'Mostra a referência bíblica que leva à resposta',
    icon: <MenuBookRoundedIcon />,
    tone: 'violet',
    needsTime: true,
  },
  { action: 'freeze',
    rewardType: 'FREEZE_TIME', field: 'freezeTimeBoosts', usedKey: 'freezeUsed', name: 'Ampulheta', short: 'Congelar', hint: 'Congela o cronômetro desta pergunta', icon: <HourglassBottomRoundedIcon />, tone: 'info', needsTime: true },
  {
    action: 'double-coins',
    rewardType: 'DOUBLE_COINS',
    field: 'doubleCoinsBoosts',
    usedKey: 'doubleCoinsUsed',
    name: 'Bênção dobrada',
    short: 'Moedas x2',
    hint: 'A partida inteira rende o dobro de moedas',
    icon: <MonetizationOnRoundedIcon />,
    tone: 'primary',
    needsTime: false,
  },
  {
    action: 'combo-shield',
    rewardType: 'COMBO_SHIELD',
    field: 'comboShieldBoosts',
    usedKey: 'comboShieldUsed',
    name: 'Escudo de sequência',
    short: 'Escudo',
    hint: 'O próximo erro não zera sua sequência de acertos (a vida ainda cai)',
    icon: <ShieldRoundedIcon />,
    tone: 'danger',
    needsTime: false,
  },
];

export const helperByReward = (rewardType?: string | null) => QUIZ_HELPERS.find((helper) => helper.rewardType === rewardType);

export const helperByField = (field: string) => QUIZ_HELPERS.find((helper) => helper.field === field);

/** Ícone genérico das ajudas (loja, baú, passe). */
export const HelperIcon = AutoFixHighRoundedIcon;

/** Quantas de cada ajuda o jogador tem. */
export function helperCounts(profile: UserProfile | null): Record<HelperField, number> {
  return Object.fromEntries(QUIZ_HELPERS.map((helper) => [helper.field, profile?.[helper.field] ?? 0])) as Record<HelperField, number>;
}

/** Desconta do inventário as ajudas que acabaram de ser usadas na sessão. */
export function spentHelpers(previous: QuizSessionStatus, next: QuizSessionStatus): HelperField[] {
  return QUIZ_HELPERS.filter((helper) => next[helper.usedKey] && !previous[helper.usedKey]).map((helper) => helper.field);
}
