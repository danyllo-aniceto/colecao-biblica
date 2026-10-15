import { cellRects, extractFrames, foreignPixels, greenKey, inkMask, stripLayout } from '@runner/sprite-strip';

/** Um arquivo de imagem e quantos quadros ele traz (1 = um quadro solto; N = tira horizontal de N quadros quadrados). */
export type StripSource = { file: File; cells: number; /** Como dividir uma tira: pelo desenho (acha cada personagem) ou em partes iguais. Só vale com 2+ quadros; padrão: pelo desenho. */ split?: 'ink' | 'equal' };

/** Tamanho de uma imagem (para conferir se a tira é de quadros quadrados antes de montar). */
export async function imageSize(file: File): Promise<{ w: number; h: number }> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { w: bitmap.width, h: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    throw new Error(`Não foi possível abrir "${file.name}". Use PNG, WEBP ou JPG.`);
  }
}

/**
 * Divide uma tira pelo desenho: vê onde há personagem em cada coluna (transparência ou diferença do fundo), corta nos vãos entre eles, centra
 * cada um pelo corpo (todos com a mesma largura) e apaga de cada quadro os retalhos que são do vizinho (contas em `@runner/sprite-strip`, com teste). Cada quadro sai com a altura inteira da imagem,
 * então o chão e a altura do personagem se mantêm.
 */
async function splitByDrawing(file: File, cells: number, removeGreen: boolean, warnings: string[]): Promise<ImageBitmap[]> {
  let source: ImageBitmap;
  try {
    source = await createImageBitmap(file);
  } catch {
    throw new Error(`Não foi possível abrir "${file.name}". Use PNG, WEBP ou JPG.`);
  }
  try {
    const probe = document.createElement('canvas');
    probe.width = source.width;
    probe.height = source.height;
    const probeCtx = probe.getContext('2d', { willReadFrequently: true });
    if (!probeCtx) throw new Error('Este navegador não consegue montar a imagem.');
    probeCtx.drawImage(source, 0, 0);
    const pixels = probeCtx.getImageData(0, 0, source.width, source.height).data;
    const found = extractFrames(inkMask(pixels, source.width, source.height, { removeGreen }), source.width, source.height, cells);
    if (found.warning) warnings.push(`${file.name}: ${found.warning}`);
    const bitmaps: ImageBitmap[] = [];
    for (const [index, rect] of found.rects.entries()) {
      const frame = document.createElement('canvas');
      frame.width = rect.w;
      frame.height = source.height;
      const frameCtx = frame.getContext('2d', { willReadFrequently: true });
      if (!frameCtx) throw new Error('Este navegador não consegue montar a imagem.');
      // Fora da imagem (desenho perto da borda) fica transparente.
      frameCtx.drawImage(source, -rect.sx, 0);
      // Apaga os retalhos dos desenhos vizinhos (mão, espada, pé do quadro ao lado) e os fiapos soltos.
      const erase = foreignPixels(found.owner, source.width, source.height, index, rect.sx, rect.w, 2);
      const data = frameCtx.getImageData(0, 0, rect.w, source.height);
      for (let at = 0; at < erase.length; at += 1) if (erase[at]) data.data[at * 4 + 3] = 0;
      frameCtx.putImageData(data, 0, 0);
      bitmaps.push(await createImageBitmap(frame));
    }
    return bitmaps;
  } finally {
    source.close();
  }
}

/**
 * Monta a tira de sprites a partir de arquivos de imagem, na ordem (cada um vale 1 quadro solto ou uma tira de N quadros): mesma escala em todos,
 * pés na base de cada célula e, se pedido, sem o fundo verde chapado. As contas de recorte e de disposição estão em `@runner/sprite-strip` (com teste).
 * Devolve o total de quadros (a soma das células de todos os arquivos).
 */
export async function buildStripCanvas(sources: StripSource[], options: { removeGreen: boolean }): Promise<{ canvas: HTMLCanvasElement; frames: number; warnings: string[] }> {
  const bitmaps: ImageBitmap[] = [];
  const warnings: string[] = [];
  try {
    for (const { file, cells, split = 'ink' } of sources) {
      if (cells > 1 && split === 'ink') {
        bitmaps.push(...(await splitByDrawing(file, cells, options.removeGreen, warnings)));
        continue;
      }
      const size = await imageSize(file);
      const { rects, warning } = cellRects(size, cells);
      if (warning) warnings.push(`${file.name}: ${warning}`);
      for (const rect of rects) {
        try {
          bitmaps.push(cells === 1 ? await createImageBitmap(file) : await createImageBitmap(file, rect.sx, rect.sy, rect.w, rect.h));
        } catch {
          throw new Error(`Não foi possível abrir "${file.name}". Use PNG, WEBP ou JPG.`);
        }
      }
    }
    const layout = stripLayout(bitmaps.map((bitmap) => ({ w: bitmap.width, h: bitmap.height })));
    const canvas = document.createElement('canvas');
    canvas.width = layout.width;
    canvas.height = layout.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: options.removeGreen });
    if (!ctx) throw new Error('Este navegador não consegue montar a imagem.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    bitmaps.forEach((bitmap, index) => {
      const place = layout.placements[index];
      ctx.drawImage(bitmap, place.x, place.y, place.w, place.h);
    });
    if (options.removeGreen) {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = data.data;
      for (let offset = 0; offset < pixels.length; offset += 4) {
        const [r, g, b, a] = greenKey(pixels[offset], pixels[offset + 1], pixels[offset + 2], pixels[offset + 3]);
        pixels[offset] = r;
        pixels[offset + 1] = g;
        pixels[offset + 2] = b;
        pixels[offset + 3] = a;
      }
      ctx.putImageData(data, 0, 0);
    }
    return { canvas, frames: bitmaps.length, warnings };
  } finally {
    bitmaps.forEach((bitmap) => bitmap.close());
  }
}

export function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(new File([blob], name, { type: 'image/png' })) : reject(new Error('Não foi possível gerar a imagem.'))), 'image/png');
  });
}
