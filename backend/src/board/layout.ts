/**
 * Geometria do caminho do tabuleiro: onde fica cada casa, a estrada e os marcos do cenário.
 *
 * Tudo é calculado em "unidades" de um quadro de 360 de largura (a tela é esse quadro esticado). O caminho sobe da
 * largada (embaixo) à chegada (em cima) em curvas, e as casas ficam sempre à mesma distância umas das outras, não
 * importa o tamanho do tabuleiro. Como o app desenha a estrada, a arte de fundo nunca precisa "bater" com as casas.
 */

export type PathStyle = "SOFT" | "MEDIUM" | "WIDE";

/** Quanto a estrada balança para os lados e de quantas em quantas unidades de altura ela muda de lado. */
export const PATH_STYLES: Record<PathStyle, { label: string; description: string; amplitude: number; period: number }> = {
  SOFT: { label: "Suave", description: "Curvas abertas, o caminho fica mais no centro.", amplitude: 70, period: 900 },
  MEDIUM: { label: "Média", description: "O equilíbrio entre curvas e espaço para os marcos.", amplitude: 105, period: 760 },
  WIDE: { label: "Larga", description: "Curvas bem marcadas, ocupando quase toda a largura.", amplitude: 125, period: 640 },
};

export const LAYOUT_WIDTH = 360;
/** Distância entre o centro de duas casas seguidas (ao longo da estrada). */
export const TILE_SPACING = 62;
const MARGIN_TOP = 76;
const MARGIN_BOTTOM = 76;
/** Altura de cada faixa da imagem de fundo (9:16 sobre a largura do quadro). A imagem se repete espelhada. */
export const BAND_HEIGHT = (LAYOUT_WIDTH * 16) / 9;
export const MAX_LANDMARKS = 12;

export type LayoutPoint = { x: number; y: number };

export type BoardLayout = {
  width: number;
  height: number;
  /** Centro de cada casa, da largada (0) à chegada. */
  points: LayoutPoint[];
  /** Traçado da estrada (SVG), da largada à chegada. */
  roadPath: string;
  style: PathStyle;
};

/** Marco do cenário: desenho (imagem ou emoji) ao lado da estrada, colocado por % do caminho. */
export type Landmark = {
  imageUrl?: string | null;
  emoji?: string | null;
  /** Posição ao longo do caminho: 0 = largada, 100 = chegada. */
  at: number;
  side: "L" | "R";
  /** Distância do centro da estrada até o centro do marco. */
  offset: number;
  /** Tamanho do marco (largura, em unidades do quadro). */
  size: number;
};

export const isPathStyle = (value: unknown): value is PathStyle => value === "SOFT" || value === "MEDIUM" || value === "WIDE";

/** Calcula o caminho para `count` casas (de 0 a count - 1). */
export function computeLayout(count: number, style: PathStyle = "MEDIUM"): BoardLayout {
  const { amplitude, period } = PATH_STYLES[style];
  const center = LAYOUT_WIDTH / 2;
  const curveX = (t: number) => center + amplitude * Math.sin((2 * Math.PI * t) / period);

  // Anda pela curva de 1 em 1 unidade de altura e marca uma casa a cada TILE_SPACING de comprimento.
  const samples: Array<{ t: number; x: number }> = [];
  const tiles: Array<{ t: number; x: number }> = [{ t: 0, x: curveX(0) }];
  let length = 0;
  let previous = { t: 0, x: curveX(0) };
  let next = 1;
  for (let t = 1; next < count; t += 1) {
    const point = { t, x: curveX(t) };
    const step = Math.hypot(point.x - previous.x, point.t - previous.t);
    while (next < count && length + step >= next * TILE_SPACING) {
      const along = (next * TILE_SPACING - length) / step;
      tiles.push({ t: previous.t + (point.t - previous.t) * along, x: previous.x + (point.x - previous.x) * along });
      next += 1;
    }
    length += step;
    previous = point;
  }

  const top = tiles[tiles.length - 1].t;
  for (let t = 0; t <= top; t += 4) samples.push({ t, x: curveX(t) });
  samples.push({ t: top, x: tiles[tiles.length - 1].x });

  const height = Math.round(MARGIN_BOTTOM + top + MARGIN_TOP);
  const toY = (t: number) => height - MARGIN_BOTTOM - t;
  return {
    width: LAYOUT_WIDTH,
    height,
    points: tiles.map((tile) => ({ x: tile.x, y: toY(tile.t) })),
    roadPath: samples.map((sample, index) => `${index === 0 ? "M" : "L"}${sample.x.toFixed(1)} ${toY(sample.t).toFixed(1)}`).join(" "),
    style,
  };
}

/** Ponto do caminho a `percent`% da largada à chegada (entre duas casas, interpola). */
export function pointAtPercent(layout: BoardLayout, percent: number): LayoutPoint {
  const last = layout.points.length - 1;
  const position = (Math.max(0, Math.min(100, percent)) / 100) * last;
  const index = Math.min(last - 1, Math.floor(position));
  const from = layout.points[index];
  const to = layout.points[index + 1] ?? from;
  const fraction = position - index;
  return { x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction };
}

/** Centro do marco: ao lado da estrada, sempre dentro do quadro. */
export function landmarkCenter(layout: BoardLayout, landmark: Landmark): LayoutPoint {
  const base = pointAtPercent(layout, landmark.at);
  const half = landmark.size / 2;
  const x = landmark.side === "L" ? base.x - landmark.offset : base.x + landmark.offset;
  return { x: Math.max(half, Math.min(layout.width - half, x)), y: base.y };
}
