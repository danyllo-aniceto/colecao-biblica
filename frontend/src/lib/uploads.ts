import { authorizedFetch, extractErrorMessage, safeParseJson } from '@/lib/http';
import type { ApiErrorResponse } from '@/types/auth';

export type UploadFolder = 'personagens' | 'conteudo';

/** Maior lado da imagem depois de reduzida (figurinha e imagens dos textos). */
const MAX_SIDE: Record<UploadFolder, number> = { personagens: 1200, conteudo: 1600 };

/** Fotos de celular passam de 5 MB; antes de reduzir aceitamos até 25 MB. */
const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível abrir a imagem. Tente outro arquivo (PNG, JPG ou WEBP).'));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Reduz a imagem no navegador (WebP, ou JPEG se o navegador não gerar WebP).
 * Uma foto de 6 MB vira ~200 KB: o envio fica rápido e cabe no limite da Vercel.
 * GIF animado vai como está (reduzir quebraria a animação).
 */
export async function compressImage(file: File, maxSide: number): Promise<Blob> {
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return file;
  }
  const image = await loadImage(file);
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    return file;
  }
  context.drawImage(image, 0, 0, width, height);

  const webp = await canvasToBlob(canvas, 'image/webp', 0.85);
  const result = webp && webp.type === 'image/webp' ? webp : await canvasToBlob(canvas, 'image/jpeg', 0.86);
  // Se a "redução" ficou maior que o original (imagem já pequena), manda o original.
  return result && result.size < file.size ? result : file;
}

export type UploadResult = { url: string; storage: 'public' | 'private' | 'inline' };

/** Reduz e envia uma imagem; devolve a URL a salvar (Blob público, rota da API ou data URL). */
export async function uploadImage(file: File, folder: UploadFolder): Promise<UploadResult> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecione um arquivo de imagem (PNG, JPG, WEBP, GIF ou AVIF).');
  }
  if (file.size > MAX_ORIGINAL_BYTES) {
    throw new Error('Imagem muito grande (máximo de 25 MB).');
  }
  if (file.type === 'image/svg+xml') {
    throw new Error('SVG não é aceito. Use PNG, JPG ou WEBP.');
  }

  const body = await compressImage(file, MAX_SIDE[folder]);
  if (body.size > 4 * 1024 * 1024) {
    throw new Error('Mesmo reduzida a imagem passou de 4 MB. Use uma imagem menor.');
  }

  const query = new URLSearchParams({ folder, name: file.name });
  const response = await authorizedFetch(`/uploads?${query.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': body.type || file.type },
    body,
  });
  const payload = await safeParseJson<UploadResult & ApiErrorResponse>(response);
  if (!response.ok || !payload?.url) {
    if (response.status === 413) {
      throw new Error('Imagem grande demais para o servidor. Use uma imagem menor.');
    }
    throw new Error(extractErrorMessage(payload, 'Não foi possível enviar a imagem.'));
  }
  return payload;
}
