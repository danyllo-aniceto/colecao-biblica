import { describe, expect, it } from "vitest";
import { cellRects, columnInk, detectFrames, extractFrames, foreignPixels, greenKey, inkMask, ownerMap, stripLayout, STRIP_CELL } from "./sprite-strip";

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

  describe("tira pronta: tirar os retalhos dos vizinhos", () => {
    const W = 240;
    const H = 100;
    const rect = (mask: Uint8Array, l: number, t: number, r: number, b: number) => {
      for (let y = t; y < b; y += 1) for (let x = l; x < r; x += 1) mask[y * W + x] = 1;
    };
    const scene = () => {
      const mask = new Uint8Array(W * H);
      rect(mask, 20, 10, 60, 100); // corpo A
      rect(mask, 75, 40, 85, 50); // mão solta de A (perto de A)
      rect(mask, 110, 40, 125, 50); // mão solta de B, que fica no lado de A da divisa
      rect(mask, 160, 10, 200, 100); // corpo B
      rect(mask, 230, 5, 233, 8); // fiapo sem dono
      return mask;
    };

    it("cada pedaço solto vai para o quadro do corpo mais perto; fiapo é descartado", () => {
      const owner = ownerMap(scene(), W, H, [0, 142, W]);
      const at = (x: number, y: number) => owner[y * W + x];
      expect(at(30, 50)).toBe(0); // corpo A
      expect(at(80, 45)).toBe(0); // mão de A
      expect(at(115, 45)).toBe(1); // mão de B, mesmo estando na faixa de A
      expect(at(180, 50)).toBe(1); // corpo B
      expect(at(231, 6)).toBe(-2); // fiapo
      expect(at(5, 5)).toBe(-1); // sem desenho
    });

    it("apaga do quadro o que é de outro (com margem), sem tocar no próprio desenho", () => {
      const owner = ownerMap(scene(), W, H, [0, 142, W]);
      const frameA = foreignPixels(owner, W, H, 0, 0, 140, 2);
      expect(frameA[45 * 140 + 115]).toBe(1); // mão de B some do quadro de A
      expect(frameA[45 * 140 + 112]).toBe(1); // e a margem em volta também
      expect(frameA[45 * 140 + 80]).toBe(0); // a mão de A fica
      expect(frameA[50 * 140 + 30]).toBe(0);
      const frameB = foreignPixels(owner, W, H, 1, 100, 140, 2);
      expect(frameB[45 * 140 + (115 - 100)]).toBe(0); // no quadro de B a mão dele fica
      expect(frameB[45 * 140 + (80 - 100 + 100)]).toBe(0);
      // Janela que sai da imagem não quebra.
      expect(foreignPixels(owner, W, H, 0, -30, 100, 2)).toHaveLength(100 * H);
    });

    it("centro e largura vêm só do desenho de cada quadro (sem os retalhos)", () => {
      const { rects, width } = extractFrames(scene(), W, H, 2);
      expect(new Set(rects.map((r) => r.w))).toEqual(new Set([width]));
      // O quadro B começa na mão dele (110) e vai até 200: o centro fica em torno de 170, não puxado para o fiapo (232) nem para A.
      const centerB = rects[1].sx + rects[1].w / 2;
      expect(centerB).toBeGreaterThan(150);
      expect(centerB).toBeLessThan(185);
      const centerA = rects[0].sx + rects[0].w / 2;
      expect(centerA).toBeGreaterThan(30);
      expect(centerA).toBeLessThan(65);
    });

    it("desenhos encostados (um pedaço só nos dois quadros) são repartidos pela faixa", () => {
      const mask = new Uint8Array(W * H);
      rect(mask, 20, 10, 120, 100);
      rect(mask, 120, 10, 220, 100);
      const owner = ownerMap(mask, W, H, [0, 120, W]);
      expect(owner[50 * W + 60]).toBe(0);
      expect(owner[50 * W + 180]).toBe(1);
    });

    it("máscara: transparência e fundo opaco", () => {
      const rgba = new Uint8ClampedArray(4 * 2 * 4); // 4x2 transparente
      rgba.set([9, 9, 9, 255], (0 * 4 + 1) * 4);
      expect(Array.from(inkMask(rgba, 4, 2))).toEqual([0, 1, 0, 0, 0, 0, 0, 0]);
    });
  });
});
