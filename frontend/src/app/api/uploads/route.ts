import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/api';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];

/** Confere no backend se o token pertence a um admin. */
async function isAdmin(authorization: string | null) {
  if (!authorization?.startsWith('Bearer ')) {
    return false;
  }

  try {
    const response = await fetch(new URL('/users/me', getApiBaseUrl()), {
      headers: { Authorization: authorization },
      cache: 'no-store',
    });
    if (!response.ok) {
      return false;
    }
    const profile = (await response.json()) as { role?: string };
    return profile.role === 'ADMIN';
  } catch {
    return false;
  }
}

/**
 * Emite o token para o navegador enviar a imagem direto ao Vercel Blob
 * (o arquivo não passa por esta função). Só admins podem enviar imagens.
 */
export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ message: 'Upload de imagens não configurado (BLOB_READ_WRITE_TOKEN ausente).' }, { status: 501 });
  }

  const body = (await request.json()) as HandleUploadBody;

  if (body.type === 'blob.generate-client-token' && !(await isAdmin(request.headers.get('authorization')))) {
    return NextResponse.json({ message: 'Apenas administradores podem enviar imagens.' }, { status: 403 });
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith('personagens/') && !pathname.startsWith('conteudo/')) {
          throw new Error('Destino de upload inválido.');
        }
        return {
          allowedContentTypes: ALLOWED_IMAGE_TYPES,
          maximumSizeInBytes: MAX_IMAGE_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Falha no upload.' }, { status: 400 });
  }
}
