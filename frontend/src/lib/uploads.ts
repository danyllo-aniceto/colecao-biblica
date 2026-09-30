import { upload } from '@vercel/blob/client';
import { getAccessToken } from '@/lib/auth-storage';
import { apiRequest } from '@/lib/http';

export type UploadFolder = 'personagens' | 'conteudo';

/**
 * `blob` (produção na Vercel): envia ao Vercel Blob e devolve a URL pública.
 * `inline` (padrão local): converte para data URL base64, como antes.
 */
const UPLOAD_MODE = process.env.NEXT_PUBLIC_IMAGE_UPLOADS === 'blob' ? 'blob' : 'inline';

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Não foi possível ler a imagem.')));
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

function safeFileName(name: string) {
  const normalized = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return normalized.replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, '') || 'imagem';
}

/** Envia uma imagem e devolve a URL a ser salva (link do Blob ou data URL). */
export async function uploadImage(file: File, folder: UploadFolder): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecione um arquivo de imagem.');
  }

  if (UPLOAD_MODE === 'inline') {
    return readAsDataUrl(file);
  }

  // Garante um access token válido (renova a sessão se preciso) antes de pedir o upload.
  await apiRequest('/users/me', { method: 'GET' }, 'Sua sessão expirou. Entre novamente.');

  const blob = await upload(`${folder}/${safeFileName(file.name)}`, file, {
    access: 'public',
    handleUploadUrl: '/api/uploads',
    headers: { Authorization: `Bearer ${getAccessToken() ?? ''}` },
  });
  return blob.url;
}
