import { cellRects, greenKey, stripLayout } from '@runner/sprite-strip';

/** Um arquivo de imagem e quantos quadros ele traz (1 = um quadro solto; N = tira horizontal de N quadros quadrados). */
export type StripSource = { file: File; cells: number };

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
 * Monta a tira de sprites a partir de arquivos de imagem, na ordem (cada um vale 1 quadro solto ou uma tira de N quadros): mesma escala em todos,
 * pés na base de cada célula e, se pedido, sem o fundo verde chapado. As contas de recorte e de disposição estão em `@runner/sprite-strip` (com teste).
 * Devolve o total de quadros (a soma das células de todos os arquivos).
 */
export async function buildStripCanvas(sources: StripSource[], options: { removeGreen: boolean }): Promise<{ canvas: HTMLCanvasElement; frames: number }> {
  const bitmaps: ImageBitmap[] = [];
  try {
    for (const { file, cells } of sources) {
      const size = await imageSize(file);
      for (const rect of cellRects(size, cells).rects) {
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
    return { canvas, frames: bitmaps.length };
  } finally {
    bitmaps.forEach((bitmap) => bitmap.close());
  }
}

export function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(new File([blob], name, { type: 'image/png' })) : reject(new Error('Não foi possível gerar a imagem.'))), 'image/png');
  });
}
