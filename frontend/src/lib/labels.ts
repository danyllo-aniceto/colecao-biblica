import type { QuestionDifficulty, ReportReason, RewardType, ShopItemType, Testament } from '@/lib/admin-api';

export const DIFFICULTY_LABELS: Record<QuestionDifficulty, string> = {
  EASY: 'Fácil',
  MEDIUM: 'Média',
  HARD: 'Difícil',
  VERY_HARD: 'Muito difícil',
};

/** Tempo sugerido por dificuldade (mesma regra do backend quando o tempo não é informado). */
export const DIFFICULTY_TIME: Record<QuestionDifficulty, number> = { EASY: 30, MEDIUM: 25, HARD: 20, VERY_HARD: 15 };

export const REWARD_TYPE_LABELS: Record<RewardType, string> = {
  STICKER: 'Figurinha',
  STICKER_PACK: 'Pacote surpresa',
  EXTRA_LIFE: 'Vida extra',
  EXTRA_TIME: 'Tempo extra',
  XP_MULTIPLIER: 'XP em dobro',
  FIFTY_FIFTY: 'Dica 50/50',
  STREAK_FREEZE: 'Protetor de sequência',
  COINS: 'Moedas',
  SKIP_QUESTION: 'Pular pergunta',
  SECOND_CHANCE: 'Segunda chance',
  CROWD_HELP: 'Voz da multidão',
  VERSE_HINT: 'Pista do versículo',
  FREEZE_TIME: 'Ampulheta',
  DOUBLE_COINS: 'Bênção dobrada',
  COMBO_SHIELD: 'Escudo de sequência',
  COSMETIC: 'Item visual',
  CHEST_BRONZE: 'Baú de Bronze',
  CHEST_SILVER: 'Baú de Prata',
  CHEST_GOLD: 'Baú de Ouro',
};

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  WRONG_ANSWER: 'Resposta errada',
  TYPO: 'Erro de digitação',
  CONFUSING: 'Pergunta confusa',
  OTHER: 'Outro motivo',
};

/** Data e hora curtas em português (ex.: 05/10/2026 09:00). */
export function formatDateTime(value?: string | Date | null) {
  if (!value) return '';
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Taxa de acerto em % (null sem respostas). */
export function accuracy(timesAnswered: number, timesCorrect: number) {
  return timesAnswered > 0 ? Math.round((timesCorrect / timesAnswered) * 100) : null;
}

export const SHOP_TYPE_LABELS: Record<ShopItemType, string> = {
  STICKER: 'Figurinha',
  GAME_BONUS: 'Bônus de partida',
  ECONOMY: 'Economia',
};

export const TESTAMENT_LABELS: Record<Testament, string> = {
  OLD: 'Antigo Testamento',
  NEW: 'Novo Testamento',
};

/** Períodos da história bíblica, em ordem, para padronizar o campo e permitir filtros. */
export const HISTORICAL_PERIODS = [
  'Criação e primórdios',
  'Patriarcas',
  'Egito e Êxodo',
  'Conquista de Canaã',
  'Juízes',
  'Monarquia unida',
  'Reino dividido',
  'Exílio na Babilônia',
  'Pós-exílio',
  'Período intertestamentário',
  'Vida de Jesus',
  'Igreja primitiva',
] as const;

export const ACHIEVEMENT_ICONS = ['flag', 'repeat', 'fire', 'star', 'person', 'level', 'album', 'crown', 'trophy', 'calendar', 'note'] as const;

/** Texto puro de um conteúdo HTML do editor (para listas, contadores e campos curtos). */
export function stripHtml(value?: string | null) {
  if (!value) return '';
  const element = document.createElement('div');
  element.innerHTML = value;
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export const QUIZ_TYPE_LABELS: Record<string, string> = {
  GENERAL: 'Quiz geral',
  CHARACTER_STUDY: 'Estudo de personagem',
  DAILY_CHALLENGE: 'Desafio do dia',
};
