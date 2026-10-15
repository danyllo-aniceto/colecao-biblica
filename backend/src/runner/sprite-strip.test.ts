import { describe, expect, it } from "vitest";
import { cellRects, columnInk, detectFrames, greenKey, stripLayout, STRIP_CELL } from "./sprite-strip";

describe("Corrida: montagem da tira de sprites", () => {
  it("quadros iguais: células de 256, lado a lado, sem ampliar", () => {
    const layout = stripLayout([{ w: 256, h: 256 }, { w: 256, h: 256 }, { w: 256, h: 256 }, { w: 256, h: 256 }]);
    expect(layout).toMatchObject({ cell: 256, width: 1024, height: 256, scale: 1 });
    expect(layout.placements.map((p) => p.x)).toEqual([0, 256, 512, 768]);
    expect(layout.placements.every((p) => p.y === 0 && p.w === 256 && p.h === 256)).toBe(true);
  });

  it("quadros grandes (1024) são reduzidos com a mesma escala; menores não são ampliados", () => {
    const big = stripLayout([{ w: 1024, h: 1024 }, { w: 1024, h: 1024 }]);
    expect(big.scale).toBe(0.25);
    expect(big.placements[0]).toMatchObject({ w: 256, h: 256 });
    const small = stripLayout([{ w: 128, h: 128 }]);
    expect(small.scale).toBe(1);
    expect(small.placements[0]).toMatchObject({ x: 64, y: 128, w: 128, h: 128 });
  });

  it("mesma escala para todos os quadros: o personagem não muda de tamanho; pés na base, centrado", () => {
    // Quadro 2 é mais baixo (ex.: abaixado): a escala vem do maior quadro e ele fica com a base alinhada.
    const layout = stripLayout([{ w: 512, h: 512 }, { w: 512, h: 400 }]);
    expect(layout.scale).toBe(0.5);
    expect(layout.placements[0]).toMatchObject({ y: 0, h: 256 });
    expect(layout.placements[1]).toMatchObject({ x: 256, y: 56, h: 200 });
    expect(layout.placements[1].y + layout.placements[1].h).toBe(STRIP_CELL);
  });

  it("muitos quadros: a célula diminui para a tira não passar de 1536 px", () => {
    const layout = stripLayout(Array.from({ length: 8 }, () => ({ w: 256, h: 256 })));
    expect(layout.cell).toBe(192);
    expect(layout.width).toBeLessThanOrEqual(1536);
    expect(layout.scale).toBe(0.75);
    expect(() => stripLayout([])).toThrow();
  });

  it("greenKey: verde puro some, bordas ficam meio transparentes, o resto passa intacto", () => {
    expect(greenKey(0, 255, 0, 255)[3]).toBe(0);
    expect(greenKey(20, 240, 30, 255)[3]).toBe(0);
    const edge = greenKey(120, 170, 120, 255);
    expect(edge[3]).toBeGreaterThan(0);
    expect(edge[3]).toBeLessThan(255);
    expect(edge[1]).toBeLessThanOrEqual(120);
    expect(greenKey(56, 189, 248, 255)).toEqual([56, 189, 248, 255]);
    expect(greenKey(255, 224, 189, 255)).toEqual([255, 224, 189, 255]);
    expect(greenKey(30, 80, 30, 255)).toEqual([30, 80, 30, 255]);
    // Pixel já transparente continua transparente.
    expect(greenKey(0, 255, 0, 0)[3]).toBe(0);
  });

  it("tira pronta: recorta N quadros alinhados, de largura w / N e altura inteira", () => {
    const { rects, warning } = cellRects({ w: 1536, h: 256 }, 6);
    expect(warning).toBeNull();
    expect(rects).toHaveLength(6);
    expect(rects.map((rect) => rect.sx)).toEqual([0, 256, 512, 768, 1024, 1280]);
    expect(rects.every((rect) => rect.sy === 0 && rect.w === 256 && rect.h === 256)).toBe(true);
  });

  it("1 quadro: a imagem toda, de qualquer proporção, sem aviso", () => {
    expect(cellRects({ w: 300, h: 180 }, 1)).toEqual({ rects: [{ sx: 0, sy: 0, w: 300, h: 180 }], warning: null });
  });

  it("avisa quando a largura não divide pelo número de quadros ou o quadro não é quadrado", () => {
    expect(cellRects({ w: 1000, h: 256 }, 6).warning).toMatch(/não divide por 6/);
    expect(cellRects({ w: 1536, h: 256 }, 4).warning).toMatch(/não é quadrado/);
    // Até ~5% de diferença passa.
    expect(cellRects({ w: 1560, h: 256 }, 6).warning).toBeNull();
    expect(() => cellRects({ w: 100, h: 100 }, 0)).toThrow();
  });

  describe("tira pronta: achar os desenhos pelo conteúdo", () => {
    /** Colunas com desenho de `from` a `to` (altura 100 no meio, mais "fino" nas pontas). */
    const columnsOf = (width: number, drawings: Array<[number, number]>) => {
      const columns = new Array<number>(width).fill(0);
      for (const [from, to] of drawings) for (let x = from; x < to; x += 1) columns[x] = 100 - Math.abs(x - (from + to) / 2) / 2;
      return columns;
    };

    it("corta nos vãos vazios mesmo com desenhos de larguras e espaços diferentes", () => {
      // 4 desenhos em 400 colunas: a divisão igual cortaria o 2º ao meio (coluna 100).
      const columns = columnsOf(400, [[10, 50], [90, 170], [250, 280], [330, 385]]);
      const { rects, width, warning } = detectFrames(columns, 4);
      expect(warning).toBeNull();
      // Todos com a mesma largura, cada um centrado no próprio desenho.
      expect(new Set(rects.map((rect) => rect.w))).toEqual(new Set([width]));
      const centers = rects.map((rect) => rect.sx + rect.w / 2);
      expect(centers[0]).toBeCloseTo(30, 0);
      expect(centers[1]).toBeCloseTo(130, 0);
      expect(centers[2]).toBeCloseTo(265, 0);
      expect(Math.abs(centers[3] - 357.5)).toBeLessThan(1);
      // A largura cobre o maior desenho (80 colunas) com folga.
      expect(width).toBeGreaterThanOrEqual(80);
      expect(width).toBeLessThan(100);
    });

    it("o centro acompanha o corpo, não o braço esticado", () => {
      // Corpo largo e denso em 100–140; um "braço" fino até 190: o centro fica perto do corpo.
      const columns = columnsOf(300, [[100, 140]]);
      for (let x = 140; x < 190; x += 1) columns[x] = 4;
      const { rects } = detectFrames([...columns, ...columnsOf(300, [[100, 140]])], 2);
      const center = rects[0].sx + rects[0].w / 2;
      expect(center).toBeGreaterThan(115);
      expect(center).toBeLessThan(135);
    });

    it("desenhos encostados: corta no ponto de menor desenho e avisa", () => {
      const columns = columnsOf(200, [[10, 100], [100, 190]]);
      columns[100] = 30;
      const { rects, warning } = detectFrames(columns, 2);
      expect(warning).toMatch(/encostados/);
      expect(rects).toHaveLength(2);
    });

    it("sem desenho (ou desenho faltando): divide igual e avisa", () => {
      expect(detectFrames(new Array(120).fill(0), 3)).toMatchObject({ width: 40, warning: expect.stringMatching(/Não encontrei desenho/) });
      const result = detectFrames(columnsOf(300, [[10, 60], [110, 160]]), 3);
      expect(result.warning).toMatch(/quadro 3/);
      expect(result.rects.map((rect) => rect.sx)).toEqual([0, 100, 200]);
      expect(() => detectFrames([1, 2, 3], 1)).toThrow();
    });

    it("colunas de desenho: transparência e fundo opaco (cantos)", () => {
      const w = 6;
      const h = 2;
      const transparent = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y += 1) for (const x of [1, 2]) transparent.set([200, 10, 10, 255], (y * w + x) * 4);
      expect(columnInk(transparent, w, h)).toEqual([0, 2, 2, 0, 0, 0]);
      // Opaca, fundo branco: só o que difere do fundo conta.
      const opaque = new Uint8ClampedArray(w * h * 4).fill(255);
      for (let y = 0; y < h; y += 1) opaque.set([20, 20, 20, 255], (y * w + 4) * 4);
      expect(columnInk(opaque, w, h)).toEqual([0, 0, 0, 0, 2, 0]);
      // Fundo verde chapado vira fundo com removeGreen.
      const green = new Uint8ClampedArray(w * h * 4);
      for (let at = 0; at < w * h; at += 1) green.set([0, 255, 0, 255], at * 4);
      for (let y = 0; y < h; y += 1) green.set([200, 50, 50, 255], (y * w + 3) * 4);
      expect(columnInk(green, w, h, { removeGreen: true })).toEqual([0, 0, 0, 2, 0, 0]);
    });
  });
});
