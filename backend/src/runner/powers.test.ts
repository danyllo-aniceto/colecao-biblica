import { describe, expect, it } from "vitest";
import { applyPower, emptyEffects, GRACE_TICKS, isImmune, MAGNET_TICKS, POWER_INFO, POWER_KINDS, POWERS_BY_FORM, tickEffects, TRIPLE_TICKS, TURBO_TICKS } from "./powers";

describe("Corrida: poderes (regras puras)", () => {
  it("cada poder liga o seu efeito e pegar de novo renova", () => {
    expect(applyPower(emptyEffects(), "TURBO").turbo).toBe(TURBO_TICKS);
    expect(applyPower(emptyEffects(), "SHIELD").shield).toBe(1);
    expect(applyPower(emptyEffects(), "TRIPLE").triple).toBe(TRIPLE_TICKS);
    expect(applyPower(emptyEffects(), "MAGNET").magnet).toBe(MAGNET_TICKS);
    const half = { ...emptyEffects(), turbo: 10 };
    expect(applyPower(half, "TURBO").turbo).toBe(TURBO_TICKS);
    // Não mexe nos outros efeitos nem no objeto de entrada.
    expect(applyPower(half, "MAGNET")).toEqual({ ...half, magnet: MAGNET_TICKS });
    expect(half.magnet).toBe(0);
  });

  it("só o Turbo e a imunidade curta do Escudo deixam imune", () => {
    expect(isImmune(emptyEffects())).toBe(false);
    expect(isImmune({ ...emptyEffects(), turbo: 1 })).toBe(true);
    expect(isImmune({ ...emptyEffects(), grace: GRACE_TICKS })).toBe(true);
    expect(isImmune({ ...emptyEffects(), shield: 1, triple: 50, magnet: 50 })).toBe(false);
  });

  it("os tempos diminuem 1 por passo, nunca abaixo de 0, e o Escudo não tem tempo", () => {
    expect(tickEffects({ turbo: 2, shield: 1, triple: 1, magnet: 0, grace: 3 })).toEqual({ turbo: 1, shield: 1, triple: 0, magnet: 0, grace: 2 });
    expect(tickEffects(emptyEffects())).toEqual(emptyEffects());
  });

  it("os 4 poderes têm nome, cor, símbolo e dica para a tela", () => {
    expect(POWER_KINDS).toHaveLength(4);
    for (const kind of POWER_KINDS) {
      expect(POWER_INFO[kind].label.length).toBeGreaterThan(2);
      expect(POWER_INFO[kind].hint.length).toBeGreaterThan(10);
      expect(POWER_INFO[kind].color).toMatch(/^#[0-9a-f]{6}$/);
      expect(POWER_INFO[kind].symbol.length).toBe(1);
    }
    expect(POWER_INFO.SHIELD.ticks).toBeNull();
  });

  it("só aparecem poderes que fazem sentido na forma: triplo só na Corrida, ímã só onde há palavras", () => {
    expect(POWERS_BY_FORM.RUN).toContain("TRIPLE");
    expect(POWERS_BY_FORM.FLY).not.toContain("TRIPLE");
    expect(POWERS_BY_FORM.GRAVITY).not.toContain("TRIPLE");
    expect(POWERS_BY_FORM.GRAVITY).not.toContain("MAGNET");
  });
});
