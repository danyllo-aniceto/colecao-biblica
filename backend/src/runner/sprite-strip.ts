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
