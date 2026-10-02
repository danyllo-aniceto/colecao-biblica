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

/**
 * Músicas passam de 4,5 MB (limite do corpo das funções da Vercel), então vão direto do navegador
 * para o Blob com um token de curta duração gerado aqui, e não pelo servidor.
 */
export const MAX_MUSIC_BYTES = 12 * 1024 * 1024;
export const MUSIC_CONTENT_TYPES = ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/ogg", "audio/wav", "audio/x-wav"];

/** Modo do store, quando já se sabe (BLOB_ACCESS ou descoberto num envio anterior). */
export function knownBlobAccess(): Access | null {
  return configuredAccess() ?? detectedAccess;
}

/**
 * Descobre se o store é público ou privado com um arquivo de 1 byte (sobrescrito sempre).
 * O navegador precisa saber: enviar no modo errado não devolve erro legível (o Blob responde sem
 * CORS) e o envio ficaria tentando de novo sem fim.
 */
export async function resolveBlobAccess(): Promise<Access> {
  const known = knownBlobAccess();
  if (known) return known;
  const probe = async (access: Access) =>
    put("musicas/.teste-de-acesso", Buffer.from("ok"), { access, contentType: "text/plain", addRandomSuffix: false, allowOverwrite: true, ...credentials() });
  try {
    await probe("public");
    detectedAccess = "public";
  } catch (error) {
    if (!isAccessMismatch(error)) throw uploadError(error);
    try {
      await probe("private");
      detectedAccess = "private";
    } catch (retryError) {
      throw uploadError(retryError);
    }
  }
  return detectedAccess!;
}

export function blobCredentials() {
  return credentials();
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

export function safeName(name: string) {
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
