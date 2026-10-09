import { describe, expect, it } from "vitest";
import {
  MINI_GAMES,
  miniGameUnlocked,
  weeklyTotal,
  campaignNodeState,
  currentScenarioId,
  defaultNodePosition,
  fragmentsComplete,
  pickGeneralQuestionIds,
  isCampaignOnlyRarity,
  chestCoins,
  duplicateCosmeticCoins,
  nextMonthKey,
  passForMonth,
  comboBonus,
  monthKeyInTimeZone,
  monthRangeInTimeZone,
  crowdPercentages,
  multiplyCoins,
  nextCombo,
  accuracyBonus,
  applyDailyXpLimit,
  CHEST_BONUS_COINS,
  CHEST_HELPER_FALLBACK_COINS,
  chestStickerWeight,
  planChest,
  chestTierFor,
  friendSalePrice,
  friendSaleSellerCoins,
  stickerUpgradeCost,
  breastplateComplete,
  buildXpBands,
  stoneState,
  nextChestLevel,
  nodeCoins,
  pendingLevelChests,
  calculateLevel,
  DEFAULT_XP_BANDS,
  defaultXpPerStop,
  xpCostOfLevel,
  xpForLevel,
  calculateMatchCoins,
  cycleDay,
  dailyRewardFor,
  dailyChallengeQuestionIds,
  dailyStatus,
  dailyStatusWithFreezes,
  duplicateStickerCoins,
  packOdds,
  pickFiftyFiftyRemovals,
  pickPackRarity,
  pityActive,
  previousWeekKey,
  suggestedDifficulty,
  weekKeyInTimeZone,
  weekRangeInTimeZone,
  calculateScore,
  calculateXp,
  dayRangeInTimeZone,
  defaultTimeByDifficulty,
  isTimeExpired,
  studyStatus,
  remainingSeconds,
  requiredCorrectAnswersForReward,
  shuffle,
  weightedPick,
} from "./game-rules";

describe("XP, pontos e nível", () => {
  it("dá bônus por acerto conforme o aproveitamento", () => {
    expect(accuracyBonus(4, 10)).toBe(0);
    expect(accuracyBonus(5, 10)).toBe(4);
    expect(accuracyBonus(7, 10)).toBe(8);
    expect(accuracyBonus(9, 10)).toBe(12);
    expect(accuracyBonus(0, 0)).toBe(0);
  });

  it("calcula XP com bônus e multiplicador", () => {
    expect(calculateXp(10, 10, 1)).toBe(220);
    expect(calculateXp(7, 10, 1)).toBe(126);
    expect(calculateXp(7, 10, 2)).toBe(252);
    expect(calculateXp(3, 10, 1)).toBe(30);
  });

  it("pontua acertos e desconta erros", () => {
    expect(calculateScore(7, 3)).toBe(610);
    expect(calculateScore(0, 3)).toBe(-90);
  });

  it("curva de nível sem cenários: todo nível custa o valor inicial", () => {
    expect(calculateLevel(0)).toBe(1);
    expect(calculateLevel(499)).toBe(1);
    expect(calculateLevel(500)).toBe(2);
    expect(calculateLevel(999)).toBe(2);
    expect(calculateLevel(1000)).toBe(3);
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(10)).toBe(4500);
  });

  it("o XP por parada sugerido sobe de cenário em cenário até o teto", () => {
    expect(defaultXpPerStop(0)).toBe(500);
    expect(defaultXpPerStop(1)).toBe(570);
    expect(defaultXpPerStop(9)).toBe(1130);
    expect(defaultXpPerStop(18)).toBe(1760);
    expect(defaultXpPerStop(19)).toBe(1800);
    expect(defaultXpPerStop(45)).toBe(1800);
  });

  it("baú de nível: um a cada 3 níveis (3, 6, 9...)", () => {
    expect(pendingLevelChests(1, 1)).toBe(0);
    expect(pendingLevelChests(2, 1)).toBe(0);
    expect(pendingLevelChests(3, 1)).toBe(1);
    expect(pendingLevelChests(9, 1)).toBe(3);
    expect(pendingLevelChests(9, 3)).toBe(2);
    expect(pendingLevelChests(9, 9)).toBe(0);
    expect(pendingLevelChests(5, 9)).toBe(0);
    expect(nextChestLevel(1)).toBe(3);
    expect(nextChestLevel(3)).toBe(6);
    expect(nextChestLevel(5)).toBe(6);
  });

  it("moedas da parada: 1 para cada 10 XP do cenário, relíquia em dobro", () => {
    expect(nodeCoins(500, false)).toBe(50);
    expect(nodeCoins(500, true)).toBe(100);
    expect(nodeCoins(620, false)).toBe(60);
    expect(nodeCoins(3000, false)).toBe(300);
    expect(nodeCoins(3000, true)).toBe(600);
    expect(nodeCoins(10, false)).toBe(5);
  });

  it("pedra do Peitoral: libera com 3 cenários concluídos e o Peitoral completa com todas resgatadas", () => {
    expect(stoneState(0, false)).toBe("locked");
    expect(stoneState(2, false)).toBe("locked");
    expect(stoneState(3, false)).toBe("available");
    expect(stoneState(1, true)).toBe("claimed");
    expect(breastplateComplete(11, 12)).toBe(false);
    expect(breastplateComplete(12, 12)).toBe(true);
    expect(breastplateComplete(0, 0)).toBe(false);
  });

  it("curva por cenário: cada parada custa o XP do cenário dela", () => {
    const bands = buildXpBands([
      { levels: [1, 2, 3, 4], xpPerStop: 500 },
      { levels: [5, 6, 7, 8], xpPerStop: 620 },
    ]);
    expect(bands).toEqual([
      { fromLevel: 1, cost: 500 },
      { fromLevel: 5, cost: 620 },
    ]);
    // Nível 1 é de graça; 2, 3 e 4 custam 500 cada.
    expect(xpForLevel(1, bands)).toBe(0);
    expect(xpForLevel(4, bands)).toBe(1500);
    expect(xpForLevel(5, bands)).toBe(2120);
    expect(xpForLevel(8, bands)).toBe(1500 + 4 * 620);
    // Depois do último cenário continua o último custo.
    expect(xpForLevel(10, bands)).toBe(1500 + 6 * 620);
    expect(calculateLevel(1499, bands)).toBe(3);
    expect(calculateLevel(1500, bands)).toBe(4);
    expect(calculateLevel(2119, bands)).toBe(4);
    expect(calculateLevel(2120, bands)).toBe(5);
    expect(calculateLevel(xpForLevel(30, bands), bands)).toBe(30);
    expect(calculateLevel(xpForLevel(30, bands) - 1, bands)).toBe(29);
  });

  it("curva por cenário: lacunas e cenários fora de ordem seguem o custo anterior", () => {
    const bands = buildXpBands([
      { levels: [1, 2], xpPerStop: 400 },
      { levels: [6, 7], xpPerStop: 800 },
    ]);
    expect(xpCostOfLevel(4, bands)).toBe(400);
    expect(xpCostOfLevel(6, bands)).toBe(800);
    expect(xpCostOfLevel(50, bands)).toBe(800);
    expect(buildXpBands([])).toEqual(DEFAULT_XP_BANDS);
    // Nível repetido: vale o primeiro cenário da lista.
    expect(buildXpBands([{ levels: [1, 2], xpPerStop: 400 }, { levels: [2, 3], xpPerStop: 900 }])).toEqual([
      { fromLevel: 1, cost: 400 },
      { fromLevel: 3, cost: 900 },
    ]);
  });

  it("freio diário de XP: cheio nas primeiras partidas, só uma parte depois", () => {
    expect(applyDailyXpLimit(100, 0, 6, 25)).toBe(100);
    expect(applyDailyXpLimit(100, 5, 6, 25)).toBe(100);
    expect(applyDailyXpLimit(100, 6, 6, 25)).toBe(25);
    expect(applyDailyXpLimit(150, 9, 6, 25)).toBe(37);
    expect(applyDailyXpLimit(100, 20, 0, 25)).toBe(100); // 0 desliga o freio
    expect(applyDailyXpLimit(100, 6, 6, 150)).toBe(100); // porcentagem limitada a 100
  });
});

describe("baús da partida", () => {
  it("o nível do baú vem dos acertos: abaixo do mínimo não há baú", () => {
    expect(chestTierFor(6, 7, 12, 20)).toBeNull();
    expect(chestTierFor(7, 7, 12, 20)).toBe("BRONZE");
    expect(chestTierFor(11, 7, 12, 20)).toBe("BRONZE");
    expect(chestTierFor(12, 7, 12, 20)).toBe("SILVER");
    expect(chestTierFor(19, 7, 12, 20)).toBe("SILVER");
    expect(chestTierFor(20, 7, 12, 20)).toBe("GOLD");
    // Configuração fora de ordem não quebra: prata e ouro ficam acima do mínimo e em sequência.
    expect(chestTierFor(8, 7, 3, 3)).toBe("SILVER");
    expect(chestTierFor(9, 7, 3, 3)).toBe("GOLD");
    expect(CHEST_BONUS_COINS.GOLD).toBeGreaterThan(CHEST_BONUS_COINS.SILVER);
  });

  it("o peso das figurinhas no baú: só conta figurinha e o ouro favorece as raras", () => {
    const common = { rewardType: "STICKER", stickerRarity: "COMMON" as const, dropChance: 9 };
    const epic = { rewardType: "STICKER", stickerRarity: "EPIC" as const, dropChance: 1.2 };
    const coins = { rewardType: "COINS", stickerRarity: null, dropChance: 30 };
    expect(chestStickerWeight("BRONZE", coins)).toBe(0);
    expect(chestStickerWeight("GOLD", coins)).toBe(0);
    expect(chestStickerWeight("BRONZE", common)).toBe(9);
    // Quanto melhor o baú, maior a fatia da épica em relação à comum.
    const share = (tier: "BRONZE" | "SILVER" | "GOLD") => chestStickerWeight(tier, epic) / (chestStickerWeight(tier, epic) + chestStickerWeight(tier, common));
    expect(share("SILVER")).toBeGreaterThan(share("BRONZE"));
    expect(share("GOLD")).toBeGreaterThan(share("SILVER"));
  });

  const stickers = [
    { id: 1, name: "Figurinha Comum", rewardType: "STICKER", stickerRarity: "COMMON" as const, dropChance: 9 },
    { id: 2, name: "Figurinha Épica", rewardType: "STICKER", stickerRarity: "EPIC" as const, dropChance: 1.2 },
    { id: 3, name: "Figurinha Lendária", rewardType: "STICKER", stickerRarity: "LEGENDARY" as const, dropChance: 0.4 },
  ];
  const helperPool = ["A", "B", "C", "D"].map((name) => ({ field: `f${name}`, name }));

  it("o baú traz moedas, ajudas sem repetir e figurinha conforme o nível", () => {
    const always = () => 0; // sempre "sorte"
    const never = () => 0.999;
    const bronze = planChest("BRONZE", { stickerRewards: stickers, helperPool, forceSticker: false, cosmeticRarities: ["RARE", "EPIC", "LEGENDARY"] }, always);
    expect(bronze.coins).toBe(CHEST_BONUS_COINS.BRONZE);
    expect(bronze.helpers).toHaveLength(1);
    expect(bronze.stickers).toHaveLength(1);
    expect(planChest("BRONZE", { stickerRewards: stickers, helperPool, forceSticker: false, cosmeticRarities: ["RARE", "EPIC", "LEGENDARY"] }, never).stickers).toHaveLength(0);
    // A garantia contra azar força a figurinha mesmo no azar.
    expect(planChest("BRONZE", { stickerRewards: stickers, helperPool, forceSticker: true, cosmeticRarities: [] }, never).stickers).toHaveLength(1);

    const diamond = planChest("DIAMOND", { stickerRewards: stickers, helperPool, forceSticker: false, cosmeticRarities: ["RARE", "EPIC", "LEGENDARY"] }, always);
    expect(diamond.helpers).toHaveLength(3);
    expect(new Set(diamond.helpers.map((helper) => helper.name)).size).toBe(3);
    // Diamante: sempre figurinha épica ou lendária, nunca a comum.
    expect(diamond.stickers.every((picked) => picked.rewardId !== 1)).toBe(true);
    expect(diamond.stickers.length).toBeGreaterThanOrEqual(1);
    // Diamante com sorte traz item visual de raridade alta (nunca comum).
    expect(diamond.cosmeticRarity).not.toBeNull();
    expect(diamond.cosmeticRarity).not.toBe("COMMON");
  });

  it("item visual no baú: nada no bronze; a prata traz comum e rara; só o diamante chega ao lendário com folga", () => {
    const base = { stickerRewards: stickers, helperPool, forceSticker: false, cosmeticRarities: ["COMMON", "RARE", "EPIC", "LEGENDARY"] as Array<"COMMON" | "RARE" | "EPIC" | "LEGENDARY"> };
    // Com "sorte" máxima: bronze nunca traz item visual; prata e acima sim.
    expect(planChest("BRONZE", base, () => 0).cosmeticRarity).toBeNull();
    expect(planChest("SILVER", base, () => 0).cosmeticRarity).not.toBeNull();
    const counts = (tier: "SILVER" | "GOLD" | "DIAMOND") => {
      const found: Record<string, number> = {};
      let seed = 7;
      const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let index = 0; index < 4000; index += 1) {
        const rarity = planChest(tier, base, random).cosmeticRarity;
        if (rarity) found[rarity] = (found[rarity] ?? 0) + 1;
      }
      return found;
    };
    const silver = counts("SILVER");
    const diamond = counts("DIAMOND");
    expect(silver.COMMON).toBeGreaterThan(silver.RARE ?? 0);
    expect(silver.LEGENDARY ?? 0).toBe(0);
    expect(diamond.COMMON ?? 0).toBe(0);
    expect(diamond.LEGENDARY ?? 0).toBeGreaterThan(0);
    // Se o jogador já tem todos os itens de uma raridade, ela sai do sorteio.
    expect(planChest("SILVER", { ...base, cosmeticRarities: [] }, () => 0).cosmeticRarity).toBeNull();
  });

  it("ajuda que não cabe mais vira moedas e sem figurinha disponível o baú vem sem figurinha", () => {
    const full = planChest("SILVER", { stickerRewards: [], helperPool: [], forceSticker: true, cosmeticRarities: [] }, () => 0);
    expect(full.helpers).toHaveLength(0);
    expect(full.stickers).toHaveLength(0);
    expect(full.coins).toBe(CHEST_BONUS_COINS.SILVER + 2 * CHEST_HELPER_FALLBACK_COINS);
  });
});

describe("diamante, venda a amigos e nível da figurinha", () => {
  it("diamante só com muitos acertos e sempre acima do ouro", () => {
    expect(chestTierFor(69, 7, 15, 40, 70)).toBe("GOLD");
    expect(chestTierFor(70, 7, 15, 40, 70)).toBe("DIAMOND");
    expect(chestTierFor(500, 7, 15, 40, 70)).toBe("DIAMOND");
    // Sem corte de diamante configurado (ou fora de ordem), nunca vira diamante abaixo do ouro.
    expect(chestTierFor(80, 7, 15, 40)).toBe("GOLD");
    expect(chestTierFor(41, 7, 15, 40, 10)).toBe("DIAMOND");
    expect(chestStickerWeight("DIAMOND", { rewardType: "STICKER", stickerRarity: "EPIC", dropChance: 1 })).toBe(75);
    expect(chestStickerWeight("DIAMOND", { rewardType: "STICKER", stickerRarity: "LEGENDARY", dropChance: 1 })).toBe(25);
    expect(chestStickerWeight("DIAMOND", { rewardType: "STICKER", stickerRarity: "COMMON", dropChance: 50 })).toBe(0);
    expect(chestStickerWeight("DIAMOND", { rewardType: "STICKER_PACK", stickerRarity: null, dropChance: 50 })).toBe(0);
  });

  it("venda a amigo: preço único por raridade e taxa que some do jogo", () => {
    const rules = { friendSalePriceCommon: 225, friendSalePriceRare: 550, friendSalePriceEpic: 1400, friendSalePriceLegendary: 4000, friendSaleFeePercent: 10 };
    expect(friendSalePrice("COMMON", rules)).toBe(225);
    expect(friendSalePrice("LEGENDARY", rules)).toBe(4000);
    expect(friendSalePrice("SPECIAL", rules)).toBe(0);
    expect(friendSaleSellerCoins(550, 10)).toBe(495);
    expect(friendSaleSellerCoins(225, 10)).toBe(202); // arredonda para baixo
    expect(friendSaleSellerCoins(225, 0)).toBe(225);
    expect(friendSaleSellerCoins(225, 150)).toBe(0);
  });

  it("nível da figurinha: 1, 2, 3 e 5 repetidas até o nível 5", () => {
    expect([1, 2, 3, 4].map(stickerUpgradeCost)).toEqual([1, 2, 3, 5]);
    expect(stickerUpgradeCost(5)).toBeNull();
    expect(stickerUpgradeCost(9)).toBeNull();
  });
});

describe("prêmios", () => {
  it("estudo de personagem: status sobe com os acertos acumulados", () => {
    expect(studyStatus(0)).toMatchObject({ label: "Iniciante", nextLabel: "Aprendiz", nextAt: 10 });
    expect(studyStatus(9).label).toBe("Iniciante");
    expect(studyStatus(10)).toMatchObject({ level: 1, label: "Aprendiz", nextAt: 30 });
    expect(studyStatus(59).label).toBe("Estudioso");
    expect(studyStatus(100)).toMatchObject({ level: 4, label: "Mestre", nextLabel: null, nextAt: null });
    expect(studyStatus(-5).correctAnswers).toBe(0);
  });

  it("limita os acertos exigidos ao tamanho do banco de perguntas", () => {
    expect(requiredCorrectAnswersForReward(7, 3)).toBe(3);
    expect(requiredCorrectAnswersForReward(7, 50)).toBe(7);
    expect(requiredCorrectAnswersForReward(0, 50)).toBe(1);
    expect(requiredCorrectAnswersForReward(7, 0)).toBe(7);
  });

  it("sorteia proporcionalmente ao peso", () => {
    const items = [
      { name: "a", weight: 1 },
      { name: "b", weight: 3 },
    ];
    expect(weightedPick(items, (item) => item.weight, () => 0)?.name).toBe("a");
    expect(weightedPick(items, (item) => item.weight, () => 0.24)?.name).toBe("a");
    expect(weightedPick(items, (item) => item.weight, () => 0.26)?.name).toBe("b");
    expect(weightedPick(items, (item) => item.weight, () => 0.999)?.name).toBe("b");
    expect(weightedPick([], () => 1)).toBeNull();
    expect(weightedPick(items, () => 0)).toBeNull();
  });

  it("embaralha sem perder itens", () => {
    const items = [1, 2, 3, 4, 5];
    expect(shuffle(items).sort()).toEqual(items);
  });
});

describe("cronômetro", () => {
  const startedAt = new Date("2026-01-01T12:00:00Z");
  const at = (seconds: number) => new Date(startedAt.getTime() + seconds * 1000);
  const timer = { startedAt, timeLimitSeconds: 20, extraSeconds: 0 };

  it("tempo padrão por dificuldade", () => {
    expect(defaultTimeByDifficulty("EASY")).toBe(30);
    expect(defaultTimeByDifficulty("MEDIUM")).toBe(25);
    expect(defaultTimeByDifficulty("HARD")).toBe(20);
    expect(defaultTimeByDifficulty("VERY_HARD")).toBe(15);
  });

  it("aceita resposta até 3 segundos depois do fim (latência)", () => {
    expect(isTimeExpired(timer, at(23))).toBe(false);
    expect(isTimeExpired(timer, at(24))).toBe(true);
  });

  it("considera o tempo extra", () => {
    expect(isTimeExpired({ ...timer, extraSeconds: 15 }, at(30))).toBe(false);
    expect(remainingSeconds({ ...timer, extraSeconds: 15 }, at(30))).toBe(5);
    expect(remainingSeconds(timer, at(60))).toBe(0);
  });
});

describe("dia no fuso do Brasil", () => {
  it("usa a meia-noite de São Paulo (UTC-3)", () => {
    const { start, end } = dayRangeInTimeZone(new Date("2026-09-30T02:00:00Z"), "America/Sao_Paulo");
    expect(start.toISOString()).toBe("2026-09-29T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-09-30T03:00:00.000Z");
  });

  it("vira o mês corretamente", () => {
    const { start, end } = dayRangeInTimeZone(new Date("2026-10-31T15:00:00Z"), "America/Sao_Paulo");
    expect(start.toISOString()).toBe("2026-10-31T03:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-01T03:00:00.000Z");
  });
});

describe("economia", () => {
  const coins = { coinsPerCorrectAnswer: 2, perfectMatchBonusCoins: 15 };

  it("moedas por acerto e bônus de partida perfeita só com 5+ perguntas", () => {
    expect(calculateMatchCoins(7, 3, coins)).toBe(14);
    expect(calculateMatchCoins(5, 0, coins)).toBe(25);
    expect(calculateMatchCoins(4, 0, coins)).toBe(8);
    expect(calculateMatchCoins(0, 3, coins)).toBe(0);
  });

  it("valor de venda da repetida pela raridade", () => {
    const rules = { duplicateCoinsCommon: 15, duplicateCoinsRare: 40, duplicateCoinsEpic: 90, duplicateCoinsLegendary: 200 };
    expect(duplicateStickerCoins("COMMON", rules)).toBe(15);
    expect(duplicateStickerCoins("LEGENDARY", rules)).toBe(200);
  });

  it("chances do pacote somam 100% e ignoram raridades sem figurinha", () => {
    const rules = { packOddsCommon: 60, packOddsRare: 28, packOddsEpic: 10, packOddsLegendary: 2 };
    const odds = packOdds(rules);
    expect(odds.COMMON + odds.RARE + odds.EPIC + odds.LEGENDARY).toBeCloseTo(100);
    expect(pickPackRarity(rules, new Set(["EPIC"]), () => 0)).toBe("EPIC");
    expect(pickPackRarity(rules, new Set(), () => 0)).toBeNull();
  });

  it("dica 50/50 remove duas alternativas erradas", () => {
    const removed = pickFiftyFiftyRemovals("c");
    expect(removed).toHaveLength(2);
    expect(removed).not.toContain("C");
  });
});

describe("prêmio diário", () => {
  const tz = "America/Sao_Paulo";
  const rules = { dailyRewardBaseCoins: 20, dailyRewardStepCoins: 10, dailyRewardDay7Coins: 120 };

  it("cresce a cada dia e o 7º dia dá dica", () => {
    expect(dailyRewardFor(1, rules)).toEqual({ coins: 20, hints: 0 });
    expect(dailyRewardFor(6, rules)).toEqual({ coins: 70, hints: 0 });
    expect(dailyRewardFor(7, rules)).toEqual({ coins: 120, hints: 1 });
    expect(cycleDay(8)).toBe(1);
    expect(cycleDay(14)).toBe(7);
  });

  it("continua a sequência no dia seguinte e recomeça se pular um dia (no fuso do Brasil)", () => {
    // 23h de 30/09 em São Paulo = 02h UTC de 01/10.
    const last = new Date("2026-10-01T02:00:00Z");
    expect(dailyStatus(last, 3, new Date("2026-10-01T12:00:00Z"), tz)).toEqual({ claimedToday: false, nextStreak: 4 });
    expect(dailyStatus(last, 3, new Date("2026-10-01T02:30:00Z"), tz)).toEqual({ claimedToday: true, nextStreak: 3 });
    expect(dailyStatus(last, 3, new Date("2026-10-02T12:00:00Z"), tz)).toEqual({ claimedToday: false, nextStreak: 1 });
    expect(dailyStatus(null, 0, new Date(), tz)).toEqual({ claimedToday: false, nextStreak: 1 });
  });
});

describe("engajamento", () => {
  it("desafio do dia: mesmas perguntas no mesmo dia, outras no dia seguinte", () => {
    const ids = Array.from({ length: 30 }, (_, index) => index + 1);
    const today = dailyChallengeQuestionIds(ids, "2026-10-01", 10);
    expect(dailyChallengeQuestionIds([...ids].reverse(), "2026-10-01", 10)).toEqual(today);
    expect(new Set(today).size).toBe(10);
    expect(dailyChallengeQuestionIds(ids, "2026-10-02", 10)).not.toEqual(today);
  });

  it("garantia contra azar a partir do limite", () => {
    expect(pityActive(3, 5)).toBe(false);
    expect(pityActive(4, 5)).toBe(true);
    expect(pityActive(10, 0)).toBe(false);
  });

  it("dificuldade sugerida pela taxa de acerto", () => {
    expect(suggestedDifficulty(10, 10)).toBeNull();
    expect(suggestedDifficulty(20, 18)).toBe("EASY");
    expect(suggestedDifficulty(20, 12)).toBe("MEDIUM");
    expect(suggestedDifficulty(20, 7)).toBe("HARD");
    expect(suggestedDifficulty(20, 2)).toBe("VERY_HARD");
  });

  it("semana começa na segunda no fuso do Brasil", () => {
    // Domingo 04/10/2026 às 23h em São Paulo (segunda 02h UTC) ainda é a semana de 28/09.
    expect(weekKeyInTimeZone(new Date("2026-10-05T02:00:00Z"), "America/Sao_Paulo")).toBe("2026-09-28");
    expect(weekKeyInTimeZone(new Date("2026-10-05T12:00:00Z"), "America/Sao_Paulo")).toBe("2026-10-05");
    expect(previousWeekKey("2026-10-05")).toBe("2026-09-28");
    expect(weekRangeInTimeZone("2026-09-28", "America/Sao_Paulo").start.toISOString()).toBe("2026-09-28T03:00:00.000Z");
  });

  it("protetor cobre os dias esquecidos", () => {
    const tz = "America/Sao_Paulo";
    const last = new Date("2026-10-01T15:00:00Z");
    expect(dailyStatusWithFreezes(last, 4, 1, new Date("2026-10-03T15:00:00Z"), tz)).toEqual({ claimedToday: false, nextStreak: 5, freezesUsed: 1 });
    expect(dailyStatusWithFreezes(last, 4, 1, new Date("2026-10-04T15:00:00Z"), tz)).toEqual({ claimedToday: false, nextStreak: 1, freezesUsed: 0 });
    expect(dailyStatusWithFreezes(last, 4, 2, new Date("2026-10-02T15:00:00Z"), tz)).toEqual({ claimedToday: false, nextStreak: 5, freezesUsed: 0 });
  });
});

describe("ajudas novas", () => {
  it("voz da multidão soma 100, zera eliminadas e favorece a certa em pergunta fácil sem dados", () => {
    const empty = { A: 0, B: 0, C: 0, D: 0 };
    const easy = crowdPercentages(empty, "B", "EASY");
    expect(Object.values(easy).reduce((sum, value) => sum + value, 0)).toBe(100);
    expect(easy.B).toBe(70);
    const removed = crowdPercentages(empty, "C", "HARD", ["A", "D"]);
    expect(removed.A).toBe(0);
    expect(removed.D).toBe(0);
    expect(removed.B + removed.C).toBe(100);
    // Com muitas respostas reais, os dados reais pesam mais que a estimativa.
    const real = crowdPercentages({ A: 900, B: 50, C: 25, D: 25 }, "B", "EASY");
    expect(real.A).toBeGreaterThan(80);
  });

  it("sequência de acertos: escudo segura um erro e o bônus começa no N-ésimo acerto", () => {
    expect(nextCombo(4, true, false)).toEqual({ streak: 5, shieldSpent: false });
    expect(nextCombo(4, false, true)).toEqual({ streak: 4, shieldSpent: true });
    expect(nextCombo(4, false, false)).toEqual({ streak: 0, shieldSpent: false });
    const rules = { comboStartAt: 3, comboPointsPerAnswer: 5, comboCoinsPerAnswer: 1 };
    expect(comboBonus(2, rules)).toEqual({ points: 0, coins: 0 });
    expect(comboBonus(3, rules)).toEqual({ points: 5, coins: 1 });
    expect(multiplyCoins(15, 2, 1.5)).toBe(45);
    expect(multiplyCoins(15, 0.5)).toBe(15);
  });
});

describe("baú e passe", () => {
  it("moedas do baú crescem com o nível e o mês do passe vira na meia-noite local", () => {
    expect(chestCoins(5, { chestBaseCoins: 40, chestCoinsPerLevel: 10 })).toBe(90);
    expect(chestCoins(40, { chestBaseCoins: 30, chestCoinsPerLevel: 5, chestMaxCoins: 150 })).toBe(150);
    expect(chestCoins(40, { chestBaseCoins: 30, chestCoinsPerLevel: 5, chestMaxCoins: 0 })).toBe(230);
    expect(monthKeyInTimeZone(new Date("2026-11-01T02:00:00Z"), "America/Sao_Paulo")).toBe("2026-10");
    const range = monthRangeInTimeZone("2026-12", "America/Sao_Paulo");
    expect(range.start.toISOString()).toBe("2026-12-01T03:00:00.000Z");
    expect(range.end.toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });
});

describe("campanha e figurinha especial", () => {
  const rules = { packOddsCommon: 60, packOddsRare: 25, packOddsEpic: 12, packOddsLegendary: 3 };

  it("a raridade especial nunca sai em pacote nem vale moedas de repetida", () => {
    expect(isCampaignOnlyRarity("SPECIAL")).toBe(true);
    expect(isCampaignOnlyRarity("LEGENDARY")).toBe(false);
    expect(packOdds(rules).SPECIAL).toBe(0);
    expect(duplicateStickerCoins("SPECIAL", { duplicateCoinsCommon: 5, duplicateCoinsRare: 10, duplicateCoinsEpic: 20, duplicateCoinsLegendary: 40 })).toBe(0);
    // Mesmo que só exista figurinha especial publicada, o pacote não a entrega.
    expect(pickPackRarity(rules, new Set(["SPECIAL"]), () => 0.5)).toBeNull();
    expect(pickPackRarity(rules, new Set(["SPECIAL", "COMMON"]), () => 0.99)).toBe("COMMON");
  });

  it("a parada abre quando o jogador chega ao nível e fica resgatada depois", () => {
    expect(campaignNodeState(3, 4, false)).toBe("locked");
    expect(campaignNodeState(4, 4, false)).toBe("available");
    expect(campaignNodeState(9, 4, false)).toBe("available");
    expect(campaignNodeState(1, 4, true)).toBe("claimed");
  });

  it("o cenário atual segue o nível do jogador, mesmo com paradas antigas sem resgatar", () => {
    const scenarios = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const nodes = [
      { level: 1, scenarioId: 1 },
      { level: 2, scenarioId: 1 },
      { level: 5, scenarioId: 2 },
      { level: 6, scenarioId: 2 },
      { level: 14, scenarioId: 3 },
    ];
    expect(currentScenarioId(scenarios, nodes, 1)).toBe(1);
    expect(currentScenarioId(scenarios, nodes, 4)).toBe(1);
    expect(currentScenarioId(scenarios, nodes, 5)).toBe(2);
    expect(currentScenarioId(scenarios, nodes, 13)).toBe(2);
    expect(currentScenarioId(scenarios, nodes, 14)).toBe(3);
    expect(currentScenarioId(scenarios, nodes, 99)).toBe(3);
    expect(currentScenarioId(scenarios, nodes, 0)).toBe(1);
    expect(currentScenarioId([], nodes, 5)).toBeNull();
  });

  it("a figurinha especial só é entregue com todos os fragmentos", () => {
    expect(fragmentsComplete(9, 10)).toBe(false);
    expect(fragmentsComplete(10, 10)).toBe(true);
    expect(fragmentsComplete(0, 0)).toBe(false);
  });

  it("a posição padrão do mapa sobe em zigue-zague dentro da tela", () => {
    const positions = Array.from({ length: 6 }, (_, index) => defaultNodePosition(index, 6));
    expect(positions[0].y).toBe(90);
    expect(positions[5].y).toBe(12);
    expect(positions.every((point) => point.x >= 10 && point.x <= 90 && point.y >= 10 && point.y <= 90)).toBe(true);
    expect(positions[0].x).not.toBe(positions[1].x);
    expect(defaultNodePosition(0, 1)).toEqual({ x: 22, y: 90 });
  });

  it("a partida geral dá prioridade às perguntas do cenário atual, sem faltar pergunta", () => {
    const scenario = [1, 2, 3, 4, 5, 6];
    const others = [10, 11, 12, 13, 14, 15, 16, 17];
    const picked = pickGeneralQuestionIds(scenario, others, 10);
    expect(picked).toHaveLength(10);
    expect(new Set(picked).size).toBe(10);
    expect(picked.filter((id) => scenario.includes(id)).length).toBeGreaterThanOrEqual(5);
    // Poucas do cenário: as outras completam. Nenhuma do cenário: tudo vem das gerais.
    const few = pickGeneralQuestionIds([1], others, 10);
    expect(few).toHaveLength(9);
    expect(few).toContain(1);
    expect(pickGeneralQuestionIds([], others, 4)).toHaveLength(4);
    // Poucas gerais: o cenário cobre o resto.
    expect(pickGeneralQuestionIds(scenario, [10], 6)).toHaveLength(6);
    expect(pickGeneralQuestionIds(scenario, others, 2)).toHaveLength(2);
  });
});

describe("passes temáticos", () => {
  const passes = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const months = Array.from({ length: 36 }, (_, index) => `${2026 + Math.floor((index + 9) / 12)}-${String(((index + 9) % 12) + 1).padStart(2, "0")}`);

  it("sem passes não há passe no mês", () => {
    expect(passForMonth([], "2026-10")).toBeNull();
  });

  it("um passe só vale em todos os meses", () => {
    expect(passForMonth([{ id: 7 }], "2027-02")?.id).toBe(7);
  });

  it("o passe fixado num mês vence o rodízio", () => {
    const withNatal = [...passes, { id: 9, pinnedMonth: "2026-12" }];
    expect(passForMonth(withNatal, "2026-12")?.id).toBe(9);
    expect(passForMonth(withNatal, "2026-11")?.id).not.toBe(9);
  });

  it("passe fixado em \"MM\" vale todo ano; o mês exato vence", () => {
    const base = [...passes, { id: 9, pinnedMonth: "12" }];
    expect(passForMonth(base, "2026-12")?.id).toBe(9);
    expect(passForMonth(base, "2031-12")?.id).toBe(9);
    expect(passForMonth(base, "2031-11")?.id).not.toBe(9);
    expect(passForMonth([...base, { id: 10, pinnedMonth: "2027-12" }], "2027-12")?.id).toBe(10);
  });

  it("meses fixados não gastam a vez de ninguém no rodízio", () => {
    const withPins = [...Array.from({ length: 5 }, (_, index) => ({ id: index + 1 })), { id: 90, pinnedMonth: "12" }, { id: 91, pinnedMonth: "04" }];
    const free = months.filter((month) => !["12", "04"].includes(month.slice(5, 7)));
    const chosen = free.map((month) => passForMonth(withPins, month)!.id);
    // Com 5 passes livres, existe um alinhamento em que cada 5 meses livres seguidos trazem os 5 passes, sem repetir.
    const aligned = [0, 1, 2, 3, 4].some((offset) => {
      for (let start = offset; start + 5 <= chosen.length; start += 5) if (new Set(chosen.slice(start, start + 5)).size !== 5) return false;
      return true;
    });
    expect(aligned).toBe(true);
    for (let index = 1; index < chosen.length; index += 1) expect(chosen[index]).not.toBe(chosen[index - 1]);
  });

  it("o rodízio é estável e passa por todos antes de repetir", () => {
    const chosen = months.map((month) => passForMonth(passes, month)!.id);
    expect(chosen).toEqual(months.map((month) => passForMonth(passes, month)!.id));
    // Outubro de 2026 abre uma volta de 3 meses: cada volta tem os 3 passes.
    for (let start = 0; start + 3 <= chosen.length; start += 3) expect(new Set(chosen.slice(start, start + 3)).size).toBe(3);
  });

  it("nunca repete o mesmo passe em dois meses seguidos", () => {
    const chosen = months.map((month) => passForMonth(passes, month)!.id);
    for (let index = 1; index < chosen.length; index += 1) expect(chosen[index]).not.toBe(chosen[index - 1]);
    const two = months.map((month) => passForMonth([{ id: 1 }, { id: 2 }], month)!.id);
    for (let index = 1; index < two.length; index += 1) expect(two[index]).not.toBe(two[index - 1]);
  });

  it("passa o ano ao pedir o mês seguinte", () => {
    expect(nextMonthKey("2026-12")).toBe("2027-01");
    expect(nextMonthKey("2026-03")).toBe("2026-04");
  });

  it("item repetido vira mais moedas quanto mais raro", () => {
    expect(duplicateCosmeticCoins("COMMON")).toBeLessThan(duplicateCosmeticCoins("EPIC"));
    expect(duplicateCosmeticCoins("LEGENDARY")).toBe(400);
  });

  it("mini games: cada pedra libera pelo menos um jogo, ids únicos, e só liberam com a pedra resgatada", () => {
    expect(MINI_GAMES).toHaveLength(17);
    // 5 jogos livres para todos e um jogo para cada uma das 12 pedras.
    const free = MINI_GAMES.filter((game) => game.stoneSlot === null);
    expect(free.map((game) => game.id)).toEqual(["caca-palavras", "anagrama", "forca", "quebra-cabeca", "memoria"]);
    const locked = MINI_GAMES.filter((game) => game.stoneSlot !== null);
    expect(locked.map((game) => game.stoneSlot).sort((a, b) => a! - b!)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(new Set(MINI_GAMES.map((game) => game.id)).size).toBe(17);
    expect(MINI_GAMES.filter((game) => game.ready)).toHaveLength(17);
    expect(miniGameUnlocked(free[0], [])).toBe(true);
    expect(miniGameUnlocked(locked.find((game) => game.stoneSlot === 1)!, [])).toBe(false);
    expect(miniGameUnlocked(locked.find((game) => game.stoneSlot === 1)!, [1])).toBe(true);
    expect(miniGameUnlocked(locked.find((game) => game.stoneSlot === 2)!, [1])).toBe(false);
  });

  it("pontuação semanal: soma a melhor de cada jogo e ignora negativos", () => {
    expect(weeklyTotal([])).toBe(0);
    expect(weeklyTotal([120, 80, 0])).toBe(200);
    expect(weeklyTotal([50, -10])).toBe(50);
  });
});
