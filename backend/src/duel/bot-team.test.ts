import { describe, expect, it } from "vitest";
import { botTeam } from "./bot-team";
import { validateTeam } from "./cards";
import { STARTER_CARDS } from "./starter";

describe("Time do bot", () => {
  it("12 figurinhas diferentes, com curva de Vigor, e a mesma semente dá o mesmo Time", () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const team = botTeam(STARTER_CARDS, seed)!;
      expect(validateTeam(team)).toBeNull();
      expect(team.filter((card) => card.def.cost <= 2).length).toBeGreaterThanOrEqual(3);
      expect(team.filter((card) => card.def.cost >= 4).length).toBeGreaterThanOrEqual(2);
    }
    expect(botTeam(STARTER_CARDS, 7)).toEqual(botTeam(STARTER_CARDS, 7));
    expect(botTeam(STARTER_CARDS, 7)?.map((card) => card.def.id)).not.toEqual(botTeam(STARTER_CARDS, 8)?.map((card) => card.def.id));
  });

  it("sem figurinhas suficientes, não monta Time; o nível vai para todas", () => {
    expect(botTeam(STARTER_CARDS.slice(0, 11), 1)).toBeNull();
    expect(botTeam(STARTER_CARDS, 1, 3)!.every((card) => card.level === 3)).toBe(true);
  });
});
