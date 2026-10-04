import { describe, expect, it } from "vitest";
import { LAYOUT_WIDTH, PATH_STYLES, TILE_SPACING, computeLayout, landmarkCenter, pointAtPercent, type PathStyle } from "./layout";

const STYLES = Object.keys(PATH_STYLES) as PathStyle[];

describe("caminho do tabuleiro", () => {
  it("tem uma casa para cada posição, da largada embaixo à chegada em cima", () => {
    for (const style of STYLES) {
      for (const count of [26, 41, 61]) {
        const layout = computeLayout(count, style);
        expect(layout.points).toHaveLength(count);
        const first = layout.points[0];
        const last = layout.points[count - 1];
        expect(last.y).toBeLessThan(first.y);
        // Sobe sempre: nenhuma casa fica mais baixa que a anterior.
        layout.points.forEach((point, index) => {
          if (index > 0) expect(point.y).toBeLessThan(layout.points[index - 1].y);
        });
        expect(layout.height).toBeGreaterThan(last.y);
        expect(first.y).toBeLessThan(layout.height);
      }
    }
  });

  it("mantém as casas à mesma distância e dentro do quadro (sem encostar nas bordas)", () => {
    for (const style of STYLES) {
      const layout = computeLayout(61, style);
      layout.points.forEach((point, index) => {
        // Folga para o círculo da casa (raio máximo 36).
        expect(point.x).toBeGreaterThanOrEqual(36);
        expect(point.x).toBeLessThanOrEqual(LAYOUT_WIDTH - 36);
        if (index > 0) {
          const gap = Math.hypot(point.x - layout.points[index - 1].x, point.y - layout.points[index - 1].y);
          // O arco é um pouco maior que a corda; a diferença é mínima.
          expect(gap).toBeGreaterThan(TILE_SPACING * 0.95);
          expect(gap).toBeLessThanOrEqual(TILE_SPACING + 0.001);
        }
      });
    }
  });

  it("casas vizinhas nunca se encostam e a estrada não passa por cima de casas distantes", () => {
    const layout = computeLayout(61, "WIDE");
    for (let a = 0; a < layout.points.length; a += 1) {
      for (let b = a + 2; b < layout.points.length; b += 1) {
        const gap = Math.hypot(layout.points[a].x - layout.points[b].x, layout.points[a].y - layout.points[b].y);
        // Duas voltas diferentes da estrada ficam bem afastadas (casa maior = 54 de diâmetro).
        expect(gap, `casas ${a} e ${b}`).toBeGreaterThan(60);
      }
    }
  });

  it("o tabuleiro cresce com o número de casas", () => {
    expect(computeLayout(61).height).toBeGreaterThan(computeLayout(41).height);
    expect(computeLayout(41).height).toBeGreaterThan(computeLayout(26).height);
  });

  it("a estrada é um traçado único da largada até a chegada", () => {
    const layout = computeLayout(26);
    expect(layout.roadPath.startsWith("M")).toBe(true);
    expect(layout.roadPath.split("M")).toHaveLength(2);
    expect(layout.roadPath.length).toBeGreaterThan(100);
  });

  it("marcos: por porcentagem do caminho, ao lado da estrada e sempre dentro do quadro", () => {
    const layout = computeLayout(41, "MEDIUM");
    const start = pointAtPercent(layout, 0);
    const end = pointAtPercent(layout, 100);
    expect(start).toEqual(layout.points[0]);
    expect(end).toEqual(layout.points[40]);
    const half = pointAtPercent(layout, 50);
    expect(half.y).toBeLessThan(start.y);
    expect(half.y).toBeGreaterThan(end.y);

    const left = landmarkCenter(layout, { at: 30, side: "L", offset: 120, size: 80 });
    const right = landmarkCenter(layout, { at: 30, side: "R", offset: 120, size: 80 });
    expect(left.x).toBeLessThan(right.x);
    expect(left.x).toBeGreaterThanOrEqual(40);
    expect(right.x).toBeLessThanOrEqual(LAYOUT_WIDTH - 40);
    // Fora do quadro, o marco volta para dentro.
    expect(landmarkCenter(layout, { at: 10, side: "L", offset: 170, size: 150 }).x).toBeGreaterThanOrEqual(75);
  });
});
