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

// ---------- Tira pronta: achar cada desenho pelo conteúdo (em vez de dividir em partes iguais) ----------

/**
 * Quantos pixels "de desenho" há em cada coluna da imagem (RGBA, `w × h`). O que é desenho:
 * - imagem com transparência: pixel não transparente;
 * - imagem opaca: pixel diferente da cor do fundo (estimada pelos 4 cantos).
 * Com `removeGreen`, o fundo verde chapado conta como fundo (mesma regra de `greenKey`).
 */
export function columnInk(rgba: ArrayLike<number>, w: number, h: number, options: { removeGreen?: boolean } = {}): number[] {
  const pixel = (x: number, y: number): [number, number, number, number] => {
    const at = (y * w + x) * 4;
    return options.removeGreen ? greenKey(rgba[at], rgba[at + 1], rgba[at + 2], rgba[at + 3]) : [rgba[at], rgba[at + 1], rgba[at + 2], rgba[at + 3]];
  };
  let transparent = false;
  for (let y = 0; y < h && !transparent; y += 1) for (let x = 0; x < w; x += 1) if (pixel(x, y)[3] < 250) {
    transparent = true;
    break;
  }
  const corners = [pixel(0, 0), pixel(w - 1, 0), pixel(0, h - 1), pixel(w - 1, h - 1)];
  const bg = [0, 1, 2].map((channel) => corners.map((corner) => corner[channel]).sort((a, b) => a - b)[1]);
  const columns = new Array<number>(w).fill(0);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const [r, g, b, a] = pixel(x, y);
      const ink = transparent ? a > 32 : a > 32 && Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) > 60;
      if (ink) columns[x] += 1;
    }
  }
  return columns;
}

export type DetectedFrame = { /** Centro do desenho (pelo peso do desenho em cada coluna, que não oscila com braço ou espada esticados). */ center: number; left: number; right: number };

/**
 * Acha os `cells` desenhos de uma tira pelo conteúdo. A ideia: os quadros ficam perto de `k × w / cells`, mas o corte de verdade vai para o maior
 * vão VAZIO entre dois desenhos (perto dali); sem vão (desenhos encostados), vale a coluna com menos desenho. Cada quadro então é centrado no corpo
 * (centro de massa) e todos ficam com a mesma largura `width`, a do maior desenho com folga, então o personagem não "anda" dentro do quadro.
 * `sx` pode ser negativo ou passar da imagem (o recorte é completado com transparência). Sem desenho em algum trecho, cai na divisão em partes iguais com aviso.
 */
export function detectFrames(columns: ArrayLike<number>, cells: number): { rects: Array<{ sx: number; w: number }>; width: number; warning: string | null } {
  if (!Number.isInteger(cells) || cells < 2) throw new Error("Use 2 ou mais quadros");
  const w = columns.length;
  const equal = (warning: string) => {
    const cellW = Math.max(1, Math.floor(w / cells));
    return { rects: Array.from({ length: cells }, (_, index) => ({ sx: index * cellW, w: cellW })), width: cellW, warning };
  };
  let maxInk = 0;
  for (let x = 0; x < w; x += 1) maxInk = Math.max(maxInk, columns[x]);
  if (w < cells || maxInk === 0) return equal("Não encontrei desenho na imagem: dividi em partes iguais.");
  const empty = Math.max(0, Math.floor(maxInk * 0.02));
  const slot = w / cells;

  const cuts: number[] = [0];
  let touching = 0;
  for (let k = 1; k < cells; k += 1) {
    const expected = k * slot;
    const from = Math.max(cuts[cuts.length - 1] + 1, Math.floor(expected - slot * 0.5));
    const to = Math.min(w - 1, Math.ceil(expected + slot * 0.5));
    // Maior sequência de colunas vazias na janela (empate: a mais perto do esperado).
    let best: { start: number; end: number } | null = null;
    let runStart = -1;
    for (let x = from; x <= to + 1; x += 1) {
      const isEmpty = x <= to && columns[x] <= empty;
      if (isEmpty && runStart < 0) runStart = x;
      if (!isEmpty && runStart >= 0) {
        const run = { start: runStart, end: x - 1 };
        const length = run.end - run.start;
        const bestLength = best ? best.end - best.start : -1;
        const distance = Math.abs((run.start + run.end) / 2 - expected);
        const bestDistance = best ? Math.abs((best.start + best.end) / 2 - expected) : Infinity;
        if (length > bestLength || (length === bestLength && distance < bestDistance)) best = run;
        runStart = -1;
      }
    }
    let cut: number;
    if (best) {
      cut = Math.round((best.start + best.end) / 2);
    } else {
      touching += 1;
      cut = from;
      for (let x = from; x <= to; x += 1) if (columns[x] < columns[cut] || (columns[x] === columns[cut] && Math.abs(x - expected) < Math.abs(cut - expected))) cut = x;
    }
    cuts.push(Math.max(cut, cuts[cuts.length - 1] + 1));
  }
  cuts.push(w);

  const frames: DetectedFrame[] = [];
  for (let index = 0; index < cells; index += 1) {
    const start = cuts[index];
    const end = cuts[index + 1];
    let left = -1;
    let right = -1;
    let weight = 0;
    let moment = 0;
    for (let x = start; x < end; x += 1) {
      if (columns[x] > empty) {
        if (left < 0) left = x;
        right = x;
      }
      weight += columns[x];
      moment += columns[x] * (x + 0.5);
    }
    if (left < 0 || weight === 0) return equal(`Não encontrei o desenho do quadro ${index + 1}: dividi em partes iguais. Confira o número de quadros.`);
    frames.push({ center: moment / weight, left, right: right + 1 });
  }
  // Largura comum: o desenho que mais se afasta do próprio centro, dos dois lados, mais uma folga de ~4%.
  const half = Math.max(...frames.map((frame) => Math.max(frame.center - frame.left, frame.right - frame.center)));
  const width = Math.max(1, Math.ceil(half * 2 * 1.04) + 2);
  const rects = frames.map((frame) => ({ sx: Math.round(frame.center - width / 2), w: width }));
  return { rects, width, warning: touching > 0 ? "Alguns desenhos estão encostados (sem vão entre eles): confira o recorte na prévia." : null };
}
