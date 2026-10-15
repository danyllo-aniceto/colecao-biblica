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
 * Máscara de desenho da imagem (RGBA, `w × h`; 1 = desenho). O que é desenho:
 * - imagem com transparência: pixel não transparente;
 * - imagem opaca: pixel diferente da cor do fundo (estimada pelos 4 cantos).
 * Com `removeGreen`, o fundo verde chapado conta como fundo (mesma regra de `greenKey`).
 */
export function inkMask(rgba: ArrayLike<number>, w: number, h: number, options: { removeGreen?: boolean } = {}): Uint8Array {
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
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const [r, g, b, a] = pixel(x, y);
      if (transparent ? a > 32 : a > 32 && Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) > 60) mask[y * w + x] = 1;
    }
  }
  return mask;
}

/** Quantos pixels de desenho há em cada coluna da máscara (`inkMask`). */
export function columnsOf(mask: Uint8Array, w: number, h: number): number[] {
  const columns = new Array<number>(w).fill(0);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) if (mask[y * w + x]) columns[x] += 1;
  return columns;
}

/** Atalho: colunas de desenho direto dos pixels (ver `inkMask`). */
export function columnInk(rgba: ArrayLike<number>, w: number, h: number, options: { removeGreen?: boolean } = {}): number[] {
  return columnsOf(inkMask(rgba, w, h, options), w, h);
}

export type DetectedFrame = { /** Centro do desenho (pelo peso do desenho em cada coluna, que não oscila com braço ou espada esticados). */ center: number; left: number; right: number };

/**
 * Acha os `cells` desenhos de uma tira pelo conteúdo. A ideia: os quadros ficam perto de `k × w / cells`, mas o corte de verdade vai para o maior
 * vão VAZIO entre dois desenhos (perto dali); sem vão (desenhos encostados), vale a coluna com menos desenho. Cada quadro então é centrado no corpo
 * (centro de massa) e todos ficam com a mesma largura `width`, a do maior desenho com folga, então o personagem não "anda" dentro do quadro.
 * `sx` pode ser negativo ou passar da imagem (o recorte é completado com transparência). Sem desenho em algum trecho, cai na divisão em partes iguais com aviso.
 */
export function detectFrames(columns: ArrayLike<number>, cells: number): { rects: Array<{ sx: number; w: number }>; width: number; cuts: number[]; warning: string | null } {
  if (!Number.isInteger(cells) || cells < 2) throw new Error("Use 2 ou mais quadros");
  const w = columns.length;
  const equal = (warning: string) => {
    const cellW = Math.max(1, Math.floor(w / cells));
    return { rects: Array.from({ length: cells }, (_, index) => ({ sx: index * cellW, w: cellW })), width: cellW, cuts: [...Array.from({ length: cells }, (_, index) => index * cellW), w], warning };
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
  return { rects, width, cuts, warning: touching > 0 ? "Alguns desenhos estão encostados (sem vão entre eles): confira o recorte na prévia." : null };
}

// ---------- Limpar os retalhos dos desenhos vizinhos ----------

const DROPPED = -2;
const NONE = -1;

/**
 * De quem é cada pixel de desenho. Os pedaços de desenho (conjuntos de pixels ligados, juntando vãos de ~3% da altura para uma mão ou espada
 * solta continuar com o corpo) são atribuídos aos quadros: o pedaço principal de cada quadro é o maior dentro da sua faixa (`cuts`); os outros
 * vão para o quadro cujo principal está mais perto; fiapos (menos de 1% do principal) são descartados. Pedaço que atravessa dois quadros
 * (desenhos encostados) é repartido pela faixa. Devolve, por pixel, o índice do quadro (`-1` sem desenho, `-2` descartado).
 */
export function ownerMap(mask: Uint8Array, w: number, h: number, cuts: number[]): Int16Array {
  const cells = cuts.length - 1;
  const owner = new Int16Array(w * h).fill(NONE);
  const segmentOf = (x: number) => {
    let index = 0;
    while (index < cells - 1 && x >= cuts[index + 1]) index += 1;
    return index;
  };
  // Grade reduzida (um bloco = 1 se tiver desenho), dilatada para juntar pedaços próximos.
  const block = Math.max(1, Math.round(h / 128));
  const gw = Math.ceil(w / block);
  const gh = Math.ceil(h / block);
  let grid = new Uint8Array(gw * gh);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) if (mask[y * w + x]) grid[Math.floor(y / block) * gw + Math.floor(x / block)] = 1;
  const reach = Math.max(1, Math.round((h * 0.03) / block));
  const spread = (source: Uint8Array, horizontal: boolean) => {
    const out = new Uint8Array(gw * gh);
    for (let y = 0; y < gh; y += 1) {
      for (let x = 0; x < gw; x += 1) {
        if (!source[y * gw + x]) continue;
        for (let d = -reach; d <= reach; d += 1) {
          const nx = horizontal ? x + d : x;
          const ny = horizontal ? y : y + d;
          if (nx >= 0 && nx < gw && ny >= 0 && ny < gh) out[ny * gw + nx] = 1;
        }
      }
    }
    return out;
  };
  grid = spread(spread(grid, true), false);
  // Componentes ligados (8 vizinhos) na grade.
  const label = new Int32Array(gw * gh);
  let count = 0;
  const stack: number[] = [];
  for (let start = 0; start < grid.length; start += 1) {
    if (!grid[start] || label[start]) continue;
    count += 1;
    label[start] = count;
    stack.push(start);
    while (stack.length > 0) {
      const at = stack.pop() as number;
      const x = at % gw;
      const y = (at - x) / gw;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= gw || ny < 0 || ny >= gh) continue;
          const next = ny * gw + nx;
          if (grid[next] && !label[next]) {
            label[next] = count;
            stack.push(next);
          }
        }
      }
    }
  }
  // Área de cada pedaço (total e por faixa) e caixa.
  const area = new Float64Array(count + 1);
  const perSegment = new Float64Array((count + 1) * cells);
  const box = Array.from({ length: count + 1 }, () => ({ l: Infinity, t: Infinity, r: -Infinity, b: -Infinity }));
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!mask[y * w + x]) continue;
      const id = label[Math.floor(y / block) * gw + Math.floor(x / block)];
      area[id] += 1;
      perSegment[id * cells + segmentOf(x)] += 1;
      const b = box[id];
      b.l = Math.min(b.l, x);
      b.r = Math.max(b.r, x);
      b.t = Math.min(b.t, y);
      b.b = Math.max(b.b, y);
    }
  }
  // Pedaço principal de cada quadro: o de maior área na faixa dele.
  const main = new Array<number>(cells).fill(0);
  for (let seg = 0; seg < cells; seg += 1) for (let id = 1; id <= count; id += 1) if (perSegment[id * cells + seg] > (main[seg] ? perSegment[main[seg] * cells + seg] : 0)) main[seg] = id;
  const mainOwners = new Map<number, number[]>();
  main.forEach((id, seg) => {
    if (id > 0) mainOwners.set(id, [...(mainOwners.get(id) ?? []), seg]);
  });
  const gap = (a: (typeof box)[number], b: (typeof box)[number]) => Math.hypot(Math.max(0, a.l - b.r, b.l - a.r), Math.max(0, a.t - b.b, b.t - a.b));
  const componentOwner = new Int16Array(count + 1).fill(NONE);
  for (let id = 1; id <= count; id += 1) {
    const owners = mainOwners.get(id);
    if (owners && owners.length === 1) {
      componentOwner[id] = owners[0];
    } else if (owners) {
      componentOwner[id] = -3; // principal de dois quadros (encostados): reparte pela faixa
    } else {
      // Pedaço solto: vai para o quadro de principal mais perto; fiapo some.
      let nearest = -1;
      let nearestGap = Infinity;
      main.forEach((mainId, seg) => {
        if (mainId <= 0) return;
        const distance = gap(box[id], box[mainId]);
        if (distance < nearestGap) {
          nearestGap = distance;
          nearest = seg;
        }
      });
      componentOwner[id] = nearest >= 0 && area[id] >= area[main[nearest]] * 0.01 ? nearest : DROPPED;
    }
  }
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!mask[y * w + x]) continue;
      const id = label[Math.floor(y / block) * gw + Math.floor(x / block)];
      const value = componentOwner[id];
      owner[y * w + x] = value === -3 ? segmentOf(x) : value;
    }
  }
  return owner;
}

/**
 * Quais pixels apagar do quadro `frame` (janela de `width` colunas a partir de `sx`, altura `h`): todo desenho que é de outro quadro (ou fiapo),
 * mais uma margem de `margin` px em volta para não sobrar o contorno suave do retalho. Devolve `width × h` com 1 = apagar.
 */
export function foreignPixels(owner: Int16Array, w: number, h: number, frame: number, sx: number, width: number, margin = 2): Uint8Array {
  const foreign = new Uint8Array(width * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceX = sx + x;
      if (sourceX < 0 || sourceX >= w) continue;
      const value = owner[y * w + sourceX];
      if (value !== NONE && value !== frame) foreign[y * width + x] = 1;
    }
  }
  if (margin <= 0) return foreign;
  const grown = new Uint8Array(width * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!foreign[y * width + x]) continue;
      for (let dy = -margin; dy <= margin; dy += 1) {
        for (let dx = -margin; dx <= margin; dx += 1) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= h) continue;
          // Nunca apaga o desenho do próprio quadro.
          const sourceX = sx + nx;
          if (sourceX >= 0 && sourceX < w && owner[ny * w + sourceX] === frame) continue;
          grown[ny * width + nx] = 1;
        }
      }
    }
  }
  return grown;
}

/**
 * Tira inteira: acha os quadros pelo desenho (`detectFrames`), separa o desenho de cada um (`ownerMap`) e refaz o centro e a largura só com o que
 * é de cada quadro (sem os retalhos dos vizinhos). Devolve os recortes (`sx` pode sair da imagem), a largura comum e o mapa de donos para
 * `foreignPixels`.
 */
export function extractFrames(mask: Uint8Array, w: number, h: number, cells: number): { rects: Array<{ sx: number; w: number }>; width: number; owner: Int16Array; warning: string | null } {
  const first = detectFrames(columnsOf(mask, w, h), cells);
  const owner = ownerMap(mask, w, h, first.cuts);
  const frames: DetectedFrame[] = [];
  for (let index = 0; index < cells; index += 1) {
    let left = Infinity;
    let right = -Infinity;
    let weight = 0;
    let moment = 0;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        if (owner[y * w + x] !== index) continue;
        left = Math.min(left, x);
        right = Math.max(right, x);
        weight += 1;
        moment += x + 0.5;
      }
    }
    if (weight === 0) return { rects: first.rects, width: first.width, owner, warning: first.warning };
    frames.push({ center: moment / weight, left, right: right + 1 });
  }
  const half = Math.max(...frames.map((frame) => Math.max(frame.center - frame.left, frame.right - frame.center)));
  const width = Math.max(1, Math.ceil(half * 2 * 1.04) + 2);
  return { rects: frames.map((frame) => ({ sx: Math.round(frame.center - width / 2), w: width })), width, owner, warning: first.warning };
}
