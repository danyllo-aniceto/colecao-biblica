import { describe, expect, it } from "vitest";
import {
  campaignNodeState,
  currentScenarioId,
  defaultNodePosition,
  fragmentsComplete,
  pickGeneralQuestionIds,
  isCampaignOnlyRarity,
  chestCoins,
  comboBonus,
  monthKeyInTimeZone,
  monthRangeInTimeZone,
  crowdPercentages,
  multiplyCoins,
  nextCombo,
  accuracyBonus,
  applyCharacterStudyPercent,
  calculateLevel,
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
  reachedStickerAccuracy,
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

  it("estudo de personagem rende só a porcentagem configurada (arredonda para baixo)", () => {
    expect(applyCharacterStudyPercent(126, 35)).toBe(44);
    expect(applyCharacterStudyPercent(0, 35)).toBe(0);
  });

  it("pontua acertos e desconta erros", () => {
    expect(calculateScore(7, 3)).toBe(610);
    expect(calculateScore(0, 3)).toBe(-90);
  });

  it("sobe um nível a cada 200 XP", () => {
    expect(calculateLevel(0)).toBe(1);
    expect(calculateLevel(199)).toBe(1);
    expect(calculateLevel(200)).toBe(2);
    // Curva progressiva: 200, 250, 300... XP por nível.
    expect(calculateLevel(449)).toBe(2);
    expect(calculateLevel(450)).toBe(3);
    expect(calculateLevel(750)).toBe(4);
    expect(xpForLevel(10)).toBe(3600);
  });
});

describe("prêmios", () => {
  it("exige aproveitamento mínimo e ao menos um acerto para a figurinha do personagem", () => {
    expect(reachedStickerAccuracy(7, 10, 70)).toBe(true);
    expect(reachedStickerAccuracy(6, 10, 70)).toBe(false);
    expect(reachedStickerAccuracy(0, 0, 0)).toBe(false);
    expect(reachedStickerAccuracy(0, 3, 0)).toBe(false);
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

describe("campanha e carta especial", () => {
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

  it("o cenário atual é o primeiro com parada ainda não resgatada", () => {
    const scenarios = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const nodes = [
      { level: 1, scenarioId: 1 },
      { level: 2, scenarioId: 1 },
      { level: 3, scenarioId: 2 },
      { level: 4, scenarioId: 3 },
    ];
    expect(currentScenarioId(scenarios, nodes, new Set())).toBe(1);
    expect(currentScenarioId(scenarios, nodes, new Set([1, 2]))).toBe(2);
    expect(currentScenarioId(scenarios, nodes, new Set([1, 2, 3]))).toBe(3);
    expect(currentScenarioId(scenarios, nodes, new Set([1, 2, 3, 4]))).toBe(3);
    expect(currentScenarioId([], nodes, new Set())).toBeNull();
  });

  it("a carta especial só é entregue com todos os fragmentos", () => {
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
