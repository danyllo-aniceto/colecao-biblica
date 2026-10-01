import type { QuestionDifficulty, StickerRarity } from "@prisma/client";

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

/** Partida "perfeita" para o bônus de moedas: sem erros e com um mínimo de perguntas. */
export const PERFECT_MATCH_MIN_QUESTIONS = 5;

type CoinRules = { coinsPerCorrectAnswer: number; perfectMatchBonusCoins: number };

/** Moedas ganhas ao terminar uma partida: por acerto, mais o bônus de partida perfeita. */
export function calculateMatchCoins(correctAnswers: number, wrongAnswers: number, rules: CoinRules): number {
  const perCorrect = Math.max(0, correctAnswers) * Math.max(0, rules.coinsPerCorrectAnswer);
  const perfect = wrongAnswers === 0 && correctAnswers >= PERFECT_MATCH_MIN_QUESTIONS ? Math.max(0, rules.perfectMatchBonusCoins) : 0;
  return perCorrect + perfect;
}

type DuplicateRules = { duplicateCoinsCommon: number; duplicateCoinsRare: number; duplicateCoinsEpic: number; duplicateCoinsLegendary: number };

/** Valor de venda de uma figurinha repetida, conforme a raridade. */
export function duplicateStickerCoins(rarity: StickerRarity, rules: DuplicateRules): number {
  const value = {
    COMMON: rules.duplicateCoinsCommon,
    RARE: rules.duplicateCoinsRare,
    EPIC: rules.duplicateCoinsEpic,
    LEGENDARY: rules.duplicateCoinsLegendary,
  }[rarity];
  return Math.max(0, value);
}

type PackRules = { packOddsCommon: number; packOddsRare: number; packOddsEpic: number; packOddsLegendary: number };

/** Chances (em %) de cada raridade no pacote surpresa, a partir dos pesos configurados. */
export function packOdds(rules: PackRules): Record<StickerRarity, number> {
  const weights: Record<StickerRarity, number> = {
    COMMON: Math.max(0, rules.packOddsCommon),
    RARE: Math.max(0, rules.packOddsRare),
    EPIC: Math.max(0, rules.packOddsEpic),
    LEGENDARY: Math.max(0, rules.packOddsLegendary),
  };
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return { COMMON: 100, RARE: 0, EPIC: 0, LEGENDARY: 0 };
  }
  return {
    COMMON: (weights.COMMON / total) * 100,
    RARE: (weights.RARE / total) * 100,
    EPIC: (weights.EPIC / total) * 100,
    LEGENDARY: (weights.LEGENDARY / total) * 100,
  };
}

/** Sorteia a raridade do pacote, só entre as raridades que têm figurinha cadastrada. */
export function pickPackRarity(rules: PackRules, available: Set<StickerRarity>, random = Math.random): StickerRarity | null {
  const odds = packOdds(rules);
  const options = (Object.keys(odds) as StickerRarity[]).filter((rarity) => available.has(rarity));
  return weightedPick(options, (rarity) => odds[rarity], random);
}

export const DAILY_CYCLE_DAYS = 7;

type DailyRules = { dailyRewardBaseCoins: number; dailyRewardStepCoins: number; dailyRewardDay7Coins: number };

/** Prêmio do dia `day` (1 a 7) da sequência: cresce a cada dia e o 7º vale mais e dá uma dica. */
export function dailyRewardFor(day: number, rules: DailyRules): { coins: number; hints: number } {
  if (day >= DAILY_CYCLE_DAYS) {
    return { coins: Math.max(0, rules.dailyRewardDay7Coins), hints: 1 };
  }
  return { coins: Math.max(0, rules.dailyRewardBaseCoins + rules.dailyRewardStepCoins * (Math.max(day, 1) - 1)), hints: 0 };
}

/** Dia do ciclo (1 a 7) correspondente a uma sequência de N dias seguidos. */
export function cycleDay(streak: number): number {
  return ((Math.max(streak, 1) - 1) % DAILY_CYCLE_DAYS) + 1;
}

/** Data local (AAAA-MM-DD) no fuso informado. */
export function dayKeyInTimeZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Diferença em dias entre duas datas locais AAAA-MM-DD. */
export function daysBetweenKeys(from: string, to: string): number {
  const toUtc = (key: string) => {
    const [year, month, day] = key.split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

/**
 * Situação do prêmio diário: já resgatado hoje, sequência que continua
 * (resgate ontem) ou que recomeça.
 */
export function dailyStatus(lastClaim: Date | null, currentStreak: number, now: Date, timeZone: string) {
  const today = dayKeyInTimeZone(now, timeZone);
  if (!lastClaim) {
    return { claimedToday: false, nextStreak: 1 };
  }
  const gap = daysBetweenKeys(dayKeyInTimeZone(lastClaim, timeZone), today);
  if (gap <= 0) {
    return { claimedToday: true, nextStreak: currentStreak };
  }
  return { claimedToday: false, nextStreak: gap === 1 ? currentStreak + 1 : 1 };
}

/** Escolhe duas alternativas erradas para a dica 50/50. */
export function pickFiftyFiftyRemovals(correctOption: string, random = Math.random): string[] {
  const wrong = ["A", "B", "C", "D"].filter((option) => option !== correctOption.toUpperCase());
  return shuffle(wrong, random).slice(0, 2).sort();
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

/** Hash simples e estável de um texto (para sementes). */
export function hashString(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Gerador pseudoaleatório com semente (mulberry32): mesma semente, mesma sequência. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Perguntas do desafio do dia: as mesmas para todos no mesmo dia. */
export function dailyChallengeQuestionIds(questionIds: number[], dayKey: string, count: number): number[] {
  const ordered = [...questionIds].sort((a, b) => a - b);
  return shuffle(ordered, seededRandom(hashString(`desafio:${dayKey}`))).slice(0, Math.max(1, count));
}

/** Garantia contra azar: depois de N prêmios seguidos sem figurinha, o próximo é figurinha. */
export function pityActive(prizesWithoutSticker: number, threshold: number): boolean {
  return threshold > 0 && prizesWithoutSticker >= threshold - 1;
}

/** Dificuldade sugerida pela taxa de acerto (só com respostas suficientes). */
export function suggestedDifficulty(timesAnswered: number, timesCorrect: number, minAnswers = 20): QuestionDifficulty | null {
  if (timesAnswered < minAnswers) return null;
  const rate = timesCorrect / timesAnswered;
  if (rate >= 0.8) return "EASY";
  if (rate >= 0.55) return "MEDIUM";
  if (rate >= 0.3) return "HARD";
  return "VERY_HARD";
}

/** Chave da semana (segunda-feira, AAAA-MM-DD) no fuso informado, e o intervalo dela. */
export function weekKeyInTimeZone(date: Date, timeZone: string): string {
  const key = dayKeyInTimeZone(date, timeZone);
  const [year, month, day] = key.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const weekday = (utc.getUTCDay() + 6) % 7; // segunda = 0
  utc.setUTCDate(utc.getUTCDate() - weekday);
  return utc.toISOString().slice(0, 10);
}

export function weekRangeInTimeZone(weekKey: string, timeZone: string): { start: Date; end: Date } {
  const [year, month, day] = weekKey.split("-").map(Number);
  return { start: zonedMidnight(year, month, day, timeZone), end: zonedMidnight(year, month, day + 7, timeZone) };
}

export function previousWeekKey(weekKey: string): string {
  const [year, month, day] = weekKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day - 7)).toISOString().slice(0, 10);
}

/**
 * Prêmio diário com protetores: dias esquecidos são cobertos por protetores
 * (um por dia). Se não houver protetores suficientes, a sequência recomeça.
 */
export function dailyStatusWithFreezes(lastClaim: Date | null, currentStreak: number, freezes: number, now: Date, timeZone: string) {
  const base = dailyStatus(lastClaim, currentStreak, now, timeZone);
  if (!lastClaim || base.claimedToday) {
    return { ...base, freezesUsed: 0 };
  }
  const missed = daysBetweenKeys(dayKeyInTimeZone(lastClaim, timeZone), dayKeyInTimeZone(now, timeZone)) - 1;
  if (missed > 0 && currentStreak > 0 && freezes >= missed) {
    return { claimedToday: false, nextStreak: currentStreak + 1, freezesUsed: missed };
  }
  return { ...base, freezesUsed: 0 };
}

// ---------------------------------------------------------------------------
// Ajudas novas e sequência de acertos
// ---------------------------------------------------------------------------

export const OPTION_LETTERS = ["A", "B", "C", "D"] as const;
export type OptionLetter = (typeof OPTION_LETTERS)[number];

/** Votos "imaginários" somados aos reais: perguntas novas já mostram uma multidão plausível. */
const CROWD_PRIOR_VOTES = 20;
const CROWD_PRIOR_CORRECT: Record<QuestionDifficulty, number> = { EASY: 0.7, MEDIUM: 0.55, HARD: 0.4, VERY_HARD: 0.32 };

/**
 * Voz da multidão: % de jogadores em cada alternativa. Mistura o que foi
 * respondido de verdade com uma estimativa pela dificuldade; alternativas
 * eliminadas (50/50, segunda chance) ficam com 0. Soma sempre 100.
 */
export function crowdPercentages(
  counts: Record<OptionLetter, number>,
  correctOption: string,
  difficulty: QuestionDifficulty,
  removed: string[] = [],
): Record<OptionLetter, number> {
  const correct = correctOption.toUpperCase();
  const open = OPTION_LETTERS.filter((letter) => !removed.includes(letter));
  const wrongOpen = open.filter((letter) => letter !== correct).length;
  const share = CROWD_PRIOR_CORRECT[difficulty];
  const weights = OPTION_LETTERS.map((letter) => {
    if (!open.includes(letter)) return 0;
    const prior = letter === correct ? CROWD_PRIOR_VOTES * share : wrongOpen > 0 ? (CROWD_PRIOR_VOTES * (1 - share)) / wrongOpen : 0;
    return Math.max(0, counts[letter]) + prior;
  });
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const result = { A: 0, B: 0, C: 0, D: 0 } as Record<OptionLetter, number>;
  if (total <= 0) return result;
  // Maior resto: arredonda sem perder nem sobrar ponto percentual.
  const exact = weights.map((weight) => (weight / total) * 100);
  const floors = exact.map(Math.floor);
  let missing = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = exact.map((value, index) => ({ index, rest: value - floors[index] })).sort((left, right) => right.rest - left.rest);
  for (const { index } of order) {
    if (missing <= 0) break;
    if (weights[index] > 0) {
      floors[index] += 1;
      missing -= 1;
    }
  }
  OPTION_LETTERS.forEach((letter, index) => (result[letter] = floors[index]));
  return result;
}

type ComboRules = { comboStartAt: number; comboPointsPerAnswer: number; comboCoinsPerAnswer: number };

/**
 * Sequência de acertos depois de uma resposta. O escudo armado segura a
 * sequência num erro (e é gasto); sem escudo, o erro zera.
 */
export function nextCombo(streak: number, correct: boolean, shieldArmed: boolean): { streak: number; shieldSpent: boolean } {
  if (correct) return { streak: streak + 1, shieldSpent: false };
  if (shieldArmed) return { streak, shieldSpent: true };
  return { streak: 0, shieldSpent: false };
}

/** Bônus de um acerto dentro da sequência (a partir do N-ésimo acerto seguido). */
export function comboBonus(streak: number, rules: ComboRules): { points: number; coins: number } {
  if (streak < Math.max(2, rules.comboStartAt)) return { points: 0, coins: 0 };
  return { points: rules.comboPointsPerAnswer, coins: rules.comboCoinsPerAnswer };
}

/** Moedas com multiplicador (bênção dobrada, evento), sem frações. */
export function multiplyCoins(coins: number, ...multipliers: number[]): number {
  return Math.round(multipliers.reduce((total, multiplier) => total * Math.max(1, multiplier), coins));
}

// ---------------------------------------------------------------------------
// Baú de nível e passe da temporada
// ---------------------------------------------------------------------------

/** "2026-10": mês corrente no fuso do jogo (o passe recomeça todo mês). */
export function monthKeyInTimeZone(date: Date, timeZone: string): string {
  return dayKeyInTimeZone(date, timeZone).slice(0, 7);
}

/** Início e fim do mês (meia-noite local) a partir de "AAAA-MM". */
export function monthRangeInTimeZone(monthKey: string, timeZone: string): { start: Date; end: Date } {
  const [year, month] = monthKey.split("-").map(Number);
  return { start: zonedMidnight(year, month, 1, timeZone), end: zonedMidnight(year, month + 1, 1, timeZone) };
}

type ChestRules = { chestBaseCoins: number; chestCoinsPerLevel: number };

/** Moedas do baú do nível alcançado: cresce com o nível. */
export function chestCoins(level: number, rules: ChestRules): number {
  return Math.max(0, rules.chestBaseCoins + rules.chestCoinsPerLevel * Math.max(level, 1));
}
