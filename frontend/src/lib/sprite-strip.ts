import { greenKey, stripLayout } from '@runner/sprite-strip';

/**
 * Monta a tira de sprites a partir de quadros soltos (arquivos de imagem, na ordem): mesma escala em todos, pés na base de cada célula e,
 * se pedido, sem o fundo verde chapado. As contas de disposição estão em `@runner/sprite-strip` (com teste).
 */
export async function buildStripCanvas(files: File[], options: { removeGreen: boolean }): Promise<{ canvas: HTMLCanvasElement; frames: number }> {
  const bitmaps: ImageBitmap[] = [];
  try {
    for (const file of files) {
      try {
        bitmaps.push(await createImageBitmap(file));
      } catch {
        throw new Error(`Não foi possível abrir "${file.name}". Use PNG, WEBP ou JPG.`);
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
