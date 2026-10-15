/**
 * Montagem de uma tira de sprites a partir de quadros soltos (feita no navegador do Painel; as contas ficam aqui para ter teste).
 * Todos os quadros da pose usam a MESMA escala (o personagem não "pula de tamanho" entre quadros) e ficam com os pés na base da célula.
 */
export const STRIP_CELL = 256;
export const STRIP_MAX_WIDTH = 1536;

export type FrameSize = { w: number; h: number };
export type FramePlacement = { x: number; y: number; w: number; h: number };
export type StripLayout = { cell: number; width: number; height: number; scale: number; placements: FramePlacement[] };

/**
 * Disposição da tira: células quadradas lado a lado. A célula é 256 px (ou menor, se passaria de 1536 px de largura com muitos quadros).
 * A escala é única: a do maior quadro para caber na célula (nunca amplia). Cada quadro fica centrado na célula, com a base alinhada.
 */
export function stripLayout(frames: FrameSize[]): StripLayout {
  if (frames.length === 0) throw new Error("Nenhum quadro");
  const cell = Math.max(32, Math.min(STRIP_CELL, Math.floor(STRIP_MAX_WIDTH / frames.length)));
  const maxW = Math.max(...frames.map((frame) => frame.w));
  const maxH = Math.max(...frames.map((frame) => frame.h));
  const scale = Math.min(1, cell / maxW, cell / maxH);
  const placements = frames.map((frame, index) => {
    const w = Math.round(frame.w * scale);
    const h = Math.round(frame.h * scale);
    return { x: index * cell + Math.round((cell - w) / 2), y: cell - h, w, h };
  });
  return { cell, width: cell * frames.length, height: cell, scale, placements };
}

/**
 * Remove o fundo verde chapado (#00FF00) de um pixel: quanto mais "verde puro", mais transparente. Nas bordas (verde misturado) deixa meio
 * transparente e tira a sobra de verde para não ficar um contorno esverdeado. Cores que não são verdes passam intactas.
 */
export function greenKey(r: number, g: number, b: number, a: number): [number, number, number, number] {
  const dominance = g - Math.max(r, b);
  if (g < 90 || dominance < 30) return [r, g, b, a];
  const strength = Math.min(1, (dominance - 30) / 60);
  const nextAlpha = Math.round(a * (1 - strength));
  // Tira o verde que sobrou nas bordas: o canal verde não passa do maior entre vermelho e azul.
  return [r, Math.min(g, Math.max(r, b)), b, nextAlpha];
}

export type CellRect = { sx: number; sy: number; w: number; h: number };

/**
 * Recortes de uma imagem que já é uma tira horizontal de `cells` quadros lado a lado: cada quadro tem largura `w / cells` (arredondada para baixo)
 * e a altura inteira. Devolve também um aviso quando a tira provavelmente não é de quadros quadrados: largura não divisível pelo número de quadros
 * ou quadro que difere da altura em mais de ~5%. Com 1 quadro a imagem toda vale (não precisa ser quadrada) e nunca há aviso.
 */
export function cellRects(size: FrameSize, cells: number): { rects: CellRect[]; warning: string | null } {
  if (!Number.isInteger(cells) || cells < 1) throw new Error("Número de quadros inválido");
  const cellW = Math.max(1, Math.floor(size.w / cells));
  const rects = Array.from({ length: cells }, (_, index) => ({ sx: index * cellW, sy: 0, w: cellW, h: size.h }));
  if (cells === 1) return { rects: [{ sx: 0, sy: 0, w: size.w, h: size.h }], warning: null };
  if (size.w % cells !== 0) return { rects, warning: `A largura (${size.w} px) não divide por ${cells}: confira se são ${cells} quadros iguais.` };
  if (Math.abs(cellW / size.h - 1) > 0.05) return { rects, warning: `Cada quadro ficaria com ${cellW} × ${size.h} px, que não é quadrado: confira o número de quadros.` };
  return { rects, warning: null };
}
