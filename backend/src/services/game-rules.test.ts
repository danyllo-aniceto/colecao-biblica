import { describe, expect, it } from "vitest";
import {
  accuracyBonus,
  applyCharacterStudyPercent,
  calculateLevel,
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
    expect(calculateLevel(650)).toBe(4);
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
