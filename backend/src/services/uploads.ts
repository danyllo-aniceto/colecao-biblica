import { get, put } from "@vercel/blob";
import { badRequest } from "../lib/errors";

/**
 * Imagens do painel (figurinhas e conteúdo dos textos).
 *
 * O navegador já manda a imagem reduzida (WebP/JPEG de até ~1600 px), então ela
 * cabe no limite de 4,5 MB das funções da Vercel e passa pelo servidor:
 *
 * - Com Vercel Blob (BLOB_READ_WRITE_TOKEN, ou BLOB_STORE_ID com OIDC quando o
 *   store foi conectado pelo painel da Vercel) a imagem vai para o Blob.
 *   Funciona com store público (URL direta) e privado (servida por
 *   /api/uploads/file/..., já que um store privado não abre URL sem login).
 * - Sem Blob, vira data URL e fica no próprio banco (desenvolvimento).
 */

export const UPLOAD_FOLDERS = ["personagens", "conteudo", "musicas"] as const;
export type UploadFolder = (typeof UPLOAD_FOLDERS)[number];

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const SIGNATURES: Array<{ type: string; ext: string; test: (bytes: Buffer) => boolean }> = [
  { type: "image/png", ext: "png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { type: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { type: "image/gif", ext: "gif", test: (b) => b.subarray(0, 4).toString("ascii") === "GIF8" },
  { type: "image/webp", ext: "webp", test: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WEBP" },
  { type: "image/avif", ext: "avif", test: (b) => b.subarray(4, 12).toString("ascii").startsWith("ftypavi") },
];

/** Tipo real da imagem pelos primeiros bytes (não confia no que o navegador diz). */
export function detectImageType(bytes: Buffer) {
  return SIGNATURES.find((signature) => signature.test(bytes)) ?? null;
}

const AUDIO_SIGNATURES: Array<{ type: string; ext: string; test: (bytes: Buffer) => boolean }> = [
  // MP3: com etiqueta ID3 ou direto no quadro de áudio (sincronia 0xFFEx).
  { type: "audio/mpeg", ext: "mp3", test: (b) => b.subarray(0, 3).toString("ascii") === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) },
  { type: "audio/ogg", ext: "ogg", test: (b) => b.subarray(0, 4).toString("ascii") === "OggS" },
  { type: "audio/mp4", ext: "m4a", test: (b) => b.subarray(4, 8).toString("ascii") === "ftyp" },
  { type: "audio/wav", ext: "wav", test: (b) => b.subarray(0, 4).toString("ascii") === "RIFF" && b.subarray(8, 12).toString("ascii") === "WAVE" },
];

/** Tipo real do áudio pelos primeiros bytes. */
export function detectAudioType(bytes: Buffer) {
  return AUDIO_SIGNATURES.find((signature) => signature.test(bytes)) ?? null;
}

export function uploadsConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

/** Token explícito quando existe; senão o SDK usa OIDC + BLOB_STORE_ID. */
function credentials() {
  return process.env.BLOB_READ_WRITE_TOKEN ? { token: process.env.BLOB_READ_WRITE_TOKEN } : {};
}

type Access = "public" | "private";

/** BLOB_ACCESS força o modo; sem ele, descobre na primeira tentativa e lembra. */
let detectedAccess: Access | null = null;

function configuredAccess(): Access | null {
  const value = process.env.BLOB_ACCESS?.trim().toLowerCase();
  return value === "public" || value === "private" ? value : null;
}

function isAccessMismatch(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("private") || message.includes("public") || message.includes("access");
}

function safeName(name: string) {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "arquivo";
}

async function putWithAccess(pathname: string, body: Buffer, contentType: string, access: Access) {
  return put(pathname, body, {
    access,
    contentType,
    addRandomSuffix: true,
    cacheControlMaxAge: 60 * 60 * 24 * 365,
    ...credentials(),
  });
}

/** Guarda a imagem e devolve a URL para salvar no personagem/texto. */
export async function saveImage(body: Buffer, folder: UploadFolder, fileName: string) {
  if (body.length === 0) {
    throw badRequest("Arquivo vazio.");
  }
  if (body.length > MAX_UPLOAD_BYTES) {
    throw badRequest("Imagem grande demais (máximo de 4 MB).");
  }
  const kind = detectImageType(body);
  if (!kind) {
    throw badRequest("Formato não suportado. Use PNG, JPG, WEBP, GIF ou AVIF.");
  }

  if (!uploadsConfigured()) {
    return { url: `data:${kind.type};base64,${body.toString("base64")}`, storage: "inline" as const };
  }
  return storeInBlob(body, folder, fileName, kind);
}

/** Guarda a música do cenário. Áudio é grande demais para o banco: exige o Vercel Blob. */
export async function saveAudio(body: Buffer, fileName: string) {
  if (body.length === 0) {
    throw badRequest("Arquivo vazio.");
  }
  if (body.length > MAX_UPLOAD_BYTES) {
    throw badRequest("Música grande demais (máximo de 4 MB). Use um MP3 mais curto ou com taxa menor (128 kbps).");
  }
  const kind = detectAudioType(body);
  if (!kind) {
    throw badRequest("Formato não suportado. Use MP3, M4A, OGG ou WAV.");
  }
  if (!uploadsConfigured()) {
    throw badRequest("Enviar músicas exige o Vercel Blob configurado. Enquanto isso, cole o link de um arquivo de áudio.");
  }
  return storeInBlob(body, "musicas", fileName, kind);
}

async function storeInBlob(body: Buffer, folder: UploadFolder, fileName: string, kind: { type: string; ext: string }) {
  // O Blob acrescenta um sufixo aleatório: nomes iguais nunca colidem.
  const pathname = `${folder}/${safeName(fileName)}.${kind.ext}`;
  const preferred = configuredAccess() ?? detectedAccess ?? "public";

  let access: Access = preferred;
  let blob;
  try {
    blob = await putWithAccess(pathname, body, kind.type, access);
  } catch (error) {
    // Store criado como privado (ou público) e modo errado: tenta o outro uma vez.
    if (configuredAccess() || !isAccessMismatch(error)) {
      throw uploadError(error);
    }
    access = preferred === "public" ? "private" : "public";
    try {
      blob = await putWithAccess(pathname, body, kind.type, access);
    } catch (retryError) {
      throw uploadError(retryError);
    }
  }
  detectedAccess = access;

  return {
    url: access === "public" ? blob.url : `/api/uploads/file/${blob.pathname}`,
    storage: access,
  };
}

function uploadError(error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error("[uploads] falha ao enviar para o Vercel Blob:", detail);
  return badRequest(`Não foi possível salvar a imagem no Vercel Blob: ${detail}`);
}

/** Lê um arquivo (imagem ou música) de store privado para servir pela API. */
export async function readPrivateImage(pathname: string) {
  return get(pathname, { access: "private", ...credentials() });
}

export function isValidUploadPath(pathname: string) {
  return UPLOAD_FOLDERS.some((folder) => pathname.startsWith(`${folder}/`)) && !pathname.includes("..") && !pathname.includes("//");
}
