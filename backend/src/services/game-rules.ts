import type { QuestionDifficulty, StickerRarity } from "@prisma/client";

/**
 * Regras puras do jogo (sem banco), para ficarem fáceis de testar e de ajustar.
 */

/** Tolerância para a latência entre o fim do cronômetro e a chegada da resposta. */
export const ANSWER_GRACE_SECONDS = 3;

const XP_PER_CORRECT = 10;
const POINTS_PER_CORRECT = 100;
const POINTS_PER_WRONG = 30;
/** XP para sair do nível 1; cada nível seguinte pede mais LEVEL_XP_STEP. */
const LEVEL_BASE_XP = 300;
const LEVEL_XP_STEP = 100;

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

/**
 * Freio diário de XP: as primeiras partidas do dia rendem XP cheio; depois, só uma porcentagem.
 * Evita subir de nível (e destravar baús e a campanha) só jogando sem parar num único dia.
 */
export function applyDailyXpLimit(xp: number, matchesToday: number, fullMatchesPerDay: number, percentAfterLimit: number): number {
  if (fullMatchesPerDay <= 0 || matchesToday < fullMatchesPerDay) return xp;
  return Math.trunc((xp * Math.min(100, Math.max(0, percentAfterLimit))) / 100);
}

export function calculateScore(correctAnswers: number, wrongAnswers: number): number {
  return correctAnswers * POINTS_PER_CORRECT - wrongAnswers * POINTS_PER_WRONG;
}

/** XP total para chegar ao nível (curva progressiva: cada nível pede 100 XP a mais que o anterior). */
export function xpForLevel(level: number): number {
  const steps = Math.max(0, level - 1);
  return LEVEL_BASE_XP * steps + (LEVEL_XP_STEP * steps * (steps - 1)) / 2;
}

export function calculateLevel(xp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level += 1;
  return level;
}

/**
 * Estudo de personagem: não dá XP, moedas nem prêmios. Só acumula acertos naquele personagem
 * e, a cada marco, o jogador sobe de status (apenas um selo de dedicação).
 */
export const STUDY_STATUSES = [
  { level: 0, label: "Iniciante", minCorrect: 0 },
  { level: 1, label: "Aprendiz", minCorrect: 10 },
  { level: 2, label: "Estudioso", minCorrect: 30 },
  { level: 3, label: "Conhecedor", minCorrect: 60 },
  { level: 4, label: "Mestre", minCorrect: 100 },
] as const;

export function studyStatus(correctAnswers: number) {
  const total = Math.max(0, Math.trunc(correctAnswers));
  const current = [...STUDY_STATUSES].reverse().find((status) => total >= status.minCorrect) ?? STUDY_STATUSES[0];
  const next = STUDY_STATUSES.find((status) => status.minCorrect > total) ?? null;
  return { level: current.level, label: current.label, correctAnswers: total, nextLabel: next?.label ?? null, nextAt: next?.minCorrect ?? null };
}

/** Acertos mínimos no quiz geral, limitados ao banco de perguntas para bancos pequenos continuarem premiando. */
export function requiredCorrectAnswersForReward(configured: number, activeQuestionCount: number): number {
  const minimum = Math.max(1, configured);
  return activeQuestionCount > 0 ? Math.min(minimum, activeQuestionCount) : minimum;
}

export type ChestTier = "BRONZE" | "SILVER" | "GOLD" | "DIAMOND";

/**
 * Baú da partida (quiz geral em maratona): o nível depende dos acertos. Abaixo do mínimo não há baú.
 * Prata e ouro nunca ficam abaixo do mínimo nem fora de ordem.
 */
export function chestTierFor(correctAnswers: number, minCorrect: number, silverMin: number, goldMin: number, diamondMin = Number.POSITIVE_INFINITY): ChestTier | null {
  const bronze = Math.max(1, minCorrect);
  if (correctAnswers < bronze) return null;
  const silver = Math.max(bronze + 1, silverMin);
  const gold = Math.max(silver + 1, goldMin);
  const diamond = Math.max(gold + 1, diamondMin);
  if (correctAnswers >= diamond) return "DIAMOND";
  if (correctAnswers >= gold) return "GOLD";
  if (correctAnswers >= silver) return "SILVER";
  return "BRONZE";
}

/**
 * O que cada baú traz. Todos dão moedas e ajudas; a figurinha vem por chance (ouro e diamante: garantida).
 * Os números aqui valem para o jogo e para o simulador do painel.
 */
export type ChestSpec = {
  coins: number;
  /** Ajudas sortidas (sem repetir). Se o jogador já está no limite de uma ajuda, ela é trocada por moedas. */
  helpers: number;
  /** Chance (0 a 1) de vir uma figurinha. */
  stickerChance: number;
  /** Chance (0 a 1) de vir uma segunda figurinha, quando a primeira veio. */
  extraStickerChance: number;
  /** Item visual: chance (0 a 1) de vir e peso de cada raridade (a raridade sorteada precisa ter item disponível). */
  cosmetic: { chance: number; weights: Partial<Record<StickerRarity, number>> };
};

export const CHEST_SPECS: Record<ChestTier, ChestSpec> = {
  // Itens visuais só a partir da prata; quanto melhor o baú, mais raro o item que pode vir.
  BRONZE: { coins: 10, helpers: 1, stickerChance: 0.45, extraStickerChance: 0, cosmetic: { chance: 0, weights: {} } },
  SILVER: { coins: 25, helpers: 2, stickerChance: 0.65, extraStickerChance: 0, cosmetic: { chance: 0.12, weights: { COMMON: 60, RARE: 35, EPIC: 5 } } },
  GOLD: { coins: 50, helpers: 2, stickerChance: 1, extraStickerChance: 0.1, cosmetic: { chance: 0.22, weights: { COMMON: 30, RARE: 45, EPIC: 22, LEGENDARY: 3 } } },
  DIAMOND: { coins: 100, helpers: 3, stickerChance: 1, extraStickerChance: 0.2, cosmetic: { chance: 0.35, weights: { RARE: 40, EPIC: 45, LEGENDARY: 15 } } },
};

/** Moedas garantidas de cada baú, além do restante. */
export const CHEST_BONUS_COINS: Record<ChestTier, number> = { BRONZE: CHEST_SPECS.BRONZE.coins, SILVER: CHEST_SPECS.SILVER.coins, GOLD: CHEST_SPECS.GOLD.coins, DIAMOND: CHEST_SPECS.DIAMOND.coins };

/** Moedas no lugar de uma ajuda que o jogador não pode mais receber (já está no limite). */
export const CHEST_HELPER_FALLBACK_COINS = 15;

type StickerRewardLike = { rewardType: string; stickerRarity: StickerRarity | null; dropChance: number };

const STICKER_WEIGHT_BOOST: Record<Exclude<ChestTier, "DIAMOND">, { COMMON: number; RARE: number; EPIC: number; LEGENDARY: number; PACK: number }> = {
  BRONZE: { COMMON: 1, RARE: 1, EPIC: 1, LEGENDARY: 1, PACK: 1 },
  SILVER: { COMMON: 0.8, RARE: 1.3, EPIC: 1.6, LEGENDARY: 1.3, PACK: 1.2 },
  GOLD: { COMMON: 1, RARE: 1.6, EPIC: 2.2, LEGENDARY: 1.5, PACK: 1.5 },
};

/** Peso de cada recompensa de figurinha no sorteio do baú (zero para o que não é figurinha). Quanto melhor o baú, mais raras. */
export function chestStickerWeight(tier: ChestTier, reward: StickerRewardLike): number {
  const isPack = reward.rewardType === "STICKER_PACK";
  if (reward.rewardType !== "STICKER" && !isPack) return 0;
  // Diamante: só figurinha épica (75%) ou lendária (25%).
  if (tier === "DIAMOND") return !isPack && reward.stickerRarity === "EPIC" ? 75 : !isPack && reward.stickerRarity === "LEGENDARY" ? 25 : 0;
  const boost = STICKER_WEIGHT_BOOST[tier];
  const multiplier = isPack ? boost.PACK : (boost[(reward.stickerRarity ?? "COMMON") as keyof typeof boost] ?? 1);
  return reward.dropChance * multiplier;
}

export type ChestRollContext = {
  /** Recompensas de figurinha que podem sair (pacote incluído). */
  stickerRewards: Array<StickerRewardLike & { id: number; name: string }>;
  /** Ajudas que ainda cabem no inventário do jogador. */
  helperPool: Array<{ field: string; name: string }>;
  /** Garantia contra azar: depois de N baús sem figurinha, este traz uma. */
  forceSticker: boolean;
  /** Raridades de item visual que o jogador ainda pode ganhar (as que têm algum item no baú que ele não tem). */
  cosmeticRarities: StickerRarity[];
};

export type ChestPlan = {
  coins: number;
  helpers: Array<{ field: string; name: string }>;
  stickers: Array<{ rewardId: number; rewardName: string }>;
  /** Raridade do item visual que vem no baú (null: nenhum). */
  cosmeticRarity: StickerRarity | null;
};

function pickChestCosmeticRarity(spec: ChestSpec, available: StickerRarity[], random: () => number): StickerRarity | null {
  if (spec.cosmetic.chance <= 0 || available.length === 0 || random() >= spec.cosmetic.chance) return null;
  return weightedPick(available, (rarity) => spec.cosmetic.weights[rarity] ?? 0, random);
}

/** Sorteia o conteúdo de um baú. Pura: o jogo e o simulador do painel usam esta mesma função. */
export function planChest(tier: ChestTier, context: ChestRollContext, random: () => number = Math.random): ChestPlan {
  const spec = CHEST_SPECS[tier];
  const pool = [...context.helperPool];
  const helpers: ChestPlan["helpers"] = [];
  while (helpers.length < spec.helpers && pool.length > 0) {
    helpers.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  const missingHelpers = spec.helpers - helpers.length;

  const stickers: ChestPlan["stickers"] = [];
  const pickSticker = () => {
    const weighted = weightedPick(context.stickerRewards, (reward) => chestStickerWeight(tier, reward), random);
    // Sem nenhuma figurinha elegível para este nível, usa a chance normal do sorteio.
    return weighted ?? weightedPick(context.stickerRewards, (reward) => reward.dropChance, random);
  };
  if (context.stickerRewards.length > 0 && (context.forceSticker || spec.stickerChance >= 1 || random() < spec.stickerChance)) {
    const first = pickSticker();
    if (first) stickers.push({ rewardId: first.id, rewardName: first.name });
    if (first && spec.extraStickerChance > 0 && random() < spec.extraStickerChance) {
      const second = pickSticker();
      if (second) stickers.push({ rewardId: second.id, rewardName: second.name });
    }
  }

  return {
    coins: spec.coins + Math.max(0, missingHelpers) * CHEST_HELPER_FALLBACK_COINS,
    helpers,
    stickers,
    cosmeticRarity: pickChestCosmeticRarity(spec, context.cosmeticRarities, random),
  };
}

// ---------------------------------------------------------------------------
// Venda a amigos e nível da figurinha
// ---------------------------------------------------------------------------

type SaleRules = { friendSalePriceCommon: number; friendSalePriceRare: number; friendSalePriceEpic: number; friendSalePriceLegendary: number; friendSaleFeePercent: number };

/** Preço padrão da figurinha vendida a um amigo (único por raridade; a especial não se vende). */
export function friendSalePrice(rarity: StickerRarity, rules: SaleRules): number {
  const price = { COMMON: rules.friendSalePriceCommon, RARE: rules.friendSalePriceRare, EPIC: rules.friendSalePriceEpic, LEGENDARY: rules.friendSalePriceLegendary, SPECIAL: 0 }[rarity];
  return Math.max(0, price);
}

/** O que o vendedor recebe: o preço sem a taxa (que some do jogo, evitando criar moedas). */
export function friendSaleSellerCoins(price: number, feePercent: number): number {
  return Math.floor((Math.max(0, price) * (100 - Math.min(100, Math.max(0, feePercent)))) / 100);
}

export const STICKER_MAX_LEVEL = 5;
/** Repetidas gastas para chegar ao nível 2, 3, 4 e 5 (11 no total). */
const STICKER_LEVEL_COSTS = [1, 2, 3, 5];

/** Custo (em repetidas) de subir do nível atual para o próximo; null no nível máximo. */
export function stickerUpgradeCost(level: number): number | null {
  if (level >= STICKER_MAX_LEVEL) return null;
  return STICKER_LEVEL_COSTS[Math.max(1, level) - 1] ?? null;
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
    SPECIAL: 0,
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
    SPECIAL: 0,
  };
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return { COMMON: 100, RARE: 0, EPIC: 0, LEGENDARY: 0, SPECIAL: 0 };
  }
  return {
    COMMON: (weights.COMMON / total) * 100,
    RARE: (weights.RARE / total) * 100,
    EPIC: (weights.EPIC / total) * 100,
    LEGENDARY: (weights.LEGENDARY / total) * 100,
    SPECIAL: 0,
  };
}

/**
 * Figurinha especial (ex.: Jesus) é única e intransferível: só a campanha concede.
 * Não entra em pacote, sorteio, troca, venda de repetida nem fusão.
 */
export function isCampaignOnlyRarity(rarity: StickerRarity): boolean {
  return rarity === "SPECIAL";
}

/** Sorteia a raridade do pacote, só entre as raridades que têm figurinha cadastrada. */
export function pickPackRarity(rules: PackRules, available: Set<StickerRarity>, random = Math.random): StickerRarity | null {
  const odds = packOdds(rules);
  const options = (Object.keys(odds) as StickerRarity[]).filter((rarity) => !isCampaignOnlyRarity(rarity) && available.has(rarity));
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

type ChestRules = { chestBaseCoins: number; chestCoinsPerLevel: number; chestMaxCoins?: number };

/** Moedas do baú do nível alcançado: cresce com o nível, até o teto (0 = sem teto). */
export function chestCoins(level: number, rules: ChestRules): number {
  const coins = Math.max(0, rules.chestBaseCoins + rules.chestCoinsPerLevel * Math.max(level, 1));
  return rules.chestMaxCoins && rules.chestMaxCoins > 0 ? Math.min(coins, rules.chestMaxCoins) : coins;
}

// ---------------------------------------------------------------------------
// Campanha
// ---------------------------------------------------------------------------

export type CampaignNodeState = "claimed" | "available" | "locked";

/** Situação de uma parada: resgatada, liberada (nível alcançado) ou bloqueada. */
export function campaignNodeState(userLevel: number, nodeLevel: number, claimed: boolean): CampaignNodeState {
  if (claimed) return "claimed";
  return userLevel >= nodeLevel ? "available" : "locked";
}

type CampaignNode = { level: number; scenarioId: number };

/**
 * Cenário atual: o do nível do jogador, ou seja, o último (na ordem do caminho) cuja primeira
 * parada já foi alcançada. Abaixo do primeiro cenário, é o primeiro. `scenarios` já vem ordenado.
 * Paradas antigas ainda não resgatadas continuam disponíveis nos cenários de baixo.
 */
export function currentScenarioId(scenarios: Array<{ id: number }>, nodes: CampaignNode[], userLevel: number): number | null {
  if (scenarios.length === 0) return null;
  let current = scenarios[0].id;
  for (const scenario of scenarios) {
    const levels = nodes.filter((node) => node.scenarioId === scenario.id).map((node) => node.level);
    if (levels.length > 0 && Math.min(...levels) <= userLevel) current = scenario.id;
  }
  return current;
}

/** A figurinha especial é entregue quando todos os fragmentos do caminho foram resgatados. */
export function fragmentsComplete(claimedFragments: number, totalFragments: number): boolean {
  return totalFragments > 0 && claimedFragments >= totalFragments;
}

/**
 * Posição padrão (em %) de uma parada no mapa quando o admin não definiu:
 * sobe em zigue-zague, da base do mapa para o topo.
 */
export function defaultNodePosition(index: number, total: number): { x: number; y: number } {
  const columns = [22, 62, 30, 70, 38, 78];
  const x = columns[index % columns.length];
  const span = Math.max(total - 1, 1);
  const y = 90 - (index / span) * 78;
  return { x, y: Math.round(y) };
}

/** Parte (0 a 1) das perguntas de uma partida geral que vem do cenário atual da campanha, quando há. */
export const SCENARIO_QUESTION_SHARE = 0.5;

/**
 * Perguntas da partida geral: dá prioridade às do cenário em que o jogador está (até `share` da
 * partida) e completa com as demais; se faltar pergunta de um lado, o outro cobre. Tudo embaralhado.
 */
export function pickGeneralQuestionIds(
  scenarioIds: number[],
  otherIds: number[],
  limit: number,
  share = SCENARIO_QUESTION_SHARE,
  random: () => number = Math.random,
): number[] {
  const fromScenario = shuffle(scenarioIds, random).slice(0, Math.min(Math.ceil(limit * share), limit));
  const rest = shuffle([...otherIds, ...scenarioIds.filter((id) => !fromScenario.includes(id))], random);
  return shuffle([...fromScenario, ...rest.slice(0, limit - fromScenario.length)], random);
}

// ---------------------------------------------------------------------------
// Passes temáticos
// ---------------------------------------------------------------------------

/** Moedas dadas no lugar de um item visual que o jogador já tem, por raridade. */
export const DUPLICATE_COSMETIC_COINS_BY_RARITY: Record<StickerRarity, number> = { COMMON: 50, RARE: 100, EPIC: 200, LEGENDARY: 400, SPECIAL: 400 };

export function duplicateCosmeticCoins(rarity: StickerRarity): number {
  return DUPLICATE_COSMETIC_COINS_BY_RARITY[rarity] ?? 50;
}

/** Índice absoluto do mês ("AAAA-MM"): janeiro de 2000 = 0. */
function monthNumber(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return (year - 2000) * 12 + (month - 1);
}

/** Próximo mês ("AAAA-MM") depois de `monthKey`. */
export function nextMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return month >= 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
}

/**
 * Qual passe vale no mês. O passe fixado naquele mês ("pinnedMonth": "AAAA-MM" ou "MM" para todo ano) vence; senão os passes livres entram em
 * rodízio: cada "volta" sorteia a ordem de todos (estável, pelo número da volta) e nunca repete o último da volta
 * anterior no começo da seguinte. Com mais passes cadastrados, cada um volta mais raramente.
 */
export function passForMonth<T extends { id: number; pinnedMonth?: string | null }>(passes: T[], monthKey: string): T | null {
  const pinnedFor = (key: string) => passes.find((pass) => pass.pinnedMonth === key) ?? passes.find((pass) => pass.pinnedMonth === key.slice(5, 7));
  const pinned = pinnedFor(monthKey);
  if (pinned) return pinned;
  const pool = passes.filter((pass) => !pass.pinnedMonth).sort((left, right) => left.id - right.id);
  if (pool.length === 0) return null;
  if (pool.length === 1) return pool[0];

  // O rodízio só conta os meses livres: meses com passe fixado não gastam a vez de ninguém.
  const target = monthNumber(monthKey);
  let freeIndex = 0;
  for (let month = 0; month < target; month += 1) {
    const year = 2000 + Math.floor(month / 12);
    if (!pinnedFor(`${year}-${String((month % 12) + 1).padStart(2, "0")}`)) freeIndex += 1;
  }

  const round = Math.floor(freeIndex / pool.length);
  // Cada volta sorteia a ordem; os últimos passes da volta anterior (2 se houver 4 ou mais) vão para o fim da nova volta,
  // assim nenhum passe reaparece logo depois de passar.
  const keepApart = pool.length >= 4 ? 2 : 1;
  let recent = new Set<number>();
  let order = pool;
  for (let current = 0; current <= round; current += 1) {
    const shuffled = shuffle(pool, seededRandom(hashString(`passes:${current}`)));
    order = [...shuffled.filter((pass) => !recent.has(pass.id)), ...shuffled.filter((pass) => recent.has(pass.id))];
    recent = new Set(order.slice(-keepApart).map((pass) => pass.id));
  }
  return order[freeIndex % pool.length];
}
