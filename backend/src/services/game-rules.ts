import type { QuestionDifficulty } from "@prisma/client";

/**
 * Regras puras do jogo (sem banco), para ficarem fáceis de testar e de ajustar.
 */

/** Tolerância para a latência entre o fim do cronômetro e a chegada da resposta. */
export const ANSWER_GRACE_SECONDS = 3;

const XP_PER_CORRECT = 10;
const POINTS_PER_CORRECT = 100;
const POINTS_PER_WRONG = 30;
const XP_PER_LEVEL = 200;

export function defaultTimeByDifficulty(difficulty: QuestionDifficulty): number {
  switch (difficulty) {
    case "EASY":
      return 30;
    case "MEDIUM":
      return 25;
    case "HARD":
      return 20;
    case "VERY_HARD":
      return 15;
  }
}

/** Bônus por acerto conforme o aproveitamento da partida. */
export function accuracyBonus(correctAnswers: number, questionsAnswered: number): number {
  if (questionsAnswered <= 0) {
    return 0;
  }
  const accuracy = correctAnswers / questionsAnswered;
  if (accuracy >= 0.9) return 12;
  if (accuracy >= 0.7) return 8;
  if (accuracy >= 0.5) return 4;
  return 0;
}

export function calculateXp(correctAnswers: number, questionsAnswered: number, xpMultiplier: number): number {
  const base = correctAnswers * XP_PER_CORRECT + correctAnswers * accuracyBonus(correctAnswers, questionsAnswered);
  return Math.round(base * xpMultiplier);
}

/** XP do estudo de personagem: só uma porcentagem do XP normal (divisão inteira). */
export function applyCharacterStudyPercent(xp: number, percent: number): number {
  return Math.trunc((xp * percent) / 100);
}

export function calculateScore(correctAnswers: number, wrongAnswers: number): number {
  return correctAnswers * POINTS_PER_CORRECT - wrongAnswers * POINTS_PER_WRONG;
}

export function calculateLevel(xp: number): number {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

/** A figurinha do estudo de personagem exige aproveitamento mínimo e ao menos um acerto. */
export function reachedStickerAccuracy(correctAnswers: number, questionsAnswered: number, minPercent: number): boolean {
  if (questionsAnswered <= 0 || correctAnswers <= 0) {
    return false;
  }
  return correctAnswers * 100 >= minPercent * questionsAnswered;
}

/** Acertos mínimos no quiz geral, limitados ao banco de perguntas para bancos pequenos continuarem premiando. */
export function requiredCorrectAnswersForReward(configured: number, activeQuestionCount: number): number {
  const minimum = Math.max(1, configured);
  return activeQuestionCount > 0 ? Math.min(minimum, activeQuestionCount) : minimum;
}

type Timer = { startedAt: Date | null; timeLimitSeconds: number; extraSeconds: number };

export function availableSeconds(timer: Timer): number {
  return timer.timeLimitSeconds + timer.extraSeconds;
}

function elapsedSeconds(startedAt: Date, now: Date) {
  return Math.floor((now.getTime() - startedAt.getTime()) / 1000);
}

export function remainingSeconds(timer: Timer, now = new Date()): number {
  const available = availableSeconds(timer);
  if (!timer.startedAt) {
    return available;
  }
  return Math.max(0, available - elapsedSeconds(timer.startedAt, now));
}

export function isTimeExpired(timer: Timer, now = new Date()): boolean {
  if (!timer.startedAt) {
    return false;
  }
  return elapsedSeconds(timer.startedAt, now) > availableSeconds(timer) + ANSWER_GRACE_SECONDS;
}

/** Sorteio ponderado: cada item tem chance proporcional ao seu peso. */
export function weightedPick<T>(items: T[], weight: (item: T) => number, random = Math.random): T | null {
  const total = items.reduce((sum, item) => sum + Math.max(0, weight(item)), 0);
  if (items.length === 0 || total <= 0) {
    return null;
  }
  const target = random() * total;
  let accumulator = 0;
  for (const item of items) {
    accumulator += Math.max(0, weight(item));
    if (target < accumulator) {
      return item;
    }
  }
  return items[items.length - 1];
}

export function shuffle<T>(items: T[], random = Math.random): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

/**
 * Início e fim do dia atual no fuso informado (em UTC), para contar as
 * partidas premiadas "de hoje" no horário do Brasil.
 */
export function dayRangeInTimeZone(now: Date, timeZone: string): { start: Date; end: Date } {
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .format(now)
    .split("-")
    .map(Number);
  return {
    start: zonedMidnight(year, month, day, timeZone),
    end: zonedMidnight(year, month, day + 1, timeZone),
  };
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function zonedMidnight(year: number, month: number, day: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day);
  let result = guess - timeZoneOffsetMs(new Date(guess), timeZone);
  // Segunda passada corrige dias com mudança de horário de verão.
  result = guess - timeZoneOffsetMs(new Date(result), timeZone);
  return new Date(result);
}
