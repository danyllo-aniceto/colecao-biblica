import { Readable } from "node:stream";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import express, { Router } from "express";
import { badRequest, notFound } from "../lib/errors";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { MAX_MUSIC_BYTES, MAX_UPLOAD_BYTES, MUSIC_CONTENT_TYPES, UPLOAD_FOLDERS, blobCredentials, isValidUploadPath, readPrivateImage, resolveBlobAccess, saveImage, uploadsConfigured, type UploadFolder } from "../services/uploads";

export const uploadsRouter = Router();

/**
 * Imagens e músicas de store privado: servidas por aqui (a tag <img> não manda token).
 * Os nomes têm sufixo aleatório, então só quem tem o link chega à imagem.
 */
uploadsRouter.get(
  "/file/*",
  asyncHandler(async (req, res) => {
    const pathname = (req.params as Record<string, string>)[0] ?? "";
    if (!isValidUploadPath(pathname)) {
      throw notFound("Imagem não encontrada");
    }
    const result = await readPrivateImage(pathname).catch(() => null);
    if (!result || result.statusCode !== 200) {
      throw notFound("Imagem não encontrada");
    }
    res.setHeader("Content-Type", result.blob.contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    if (result.blob.contentType.startsWith("audio/")) {
      // O Safari só toca áudio de um servidor que aceita Range: lê o arquivo (até 4 MB) e serve o trecho pedido.
      const file = Buffer.from(await new Response(result.stream as never).arrayBuffer());
      const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ""));
      res.setHeader("Accept-Ranges", "bytes");
      if (range && (range[1] || range[2])) {
        const start = range[1] ? Number(range[1]) : Math.max(file.length - Number(range[2]), 0);
        // Cada resposta da função da Vercel pode ter ~4,5 MB: devolve em pedaços de até 3 MB (o navegador pede o resto).
        const end = Math.min(range[1] && range[2] ? Number(range[2]) : file.length - 1, file.length - 1, start + 3 * 1024 * 1024 - 1);
        if (start > end || start >= file.length) {
          res.status(416).setHeader("Content-Range", `bytes */${file.length}`).end();
          return;
        }
        res.status(206).setHeader("Content-Range", `bytes ${start}-${end}/${file.length}`).setHeader("Content-Length", end - start + 1).end(file.subarray(start, end + 1));
        return;
      }
      res.setHeader("Content-Length", file.length).end(file);
      return;
    }
    Readable.fromWeb(result.stream as never).pipe(res);
  }),
);

uploadsRouter.use(requireAuth, requireAdmin);

/** Diz ao painel para onde as imagens vão (Blob ou banco). */
uploadsRouter.get(
  "/config",
  asyncHandler(async (_req, res) => {
    const blob = uploadsConfigured();
    res.json({ storage: blob ? "blob" : "inline", maxBytes: MAX_UPLOAD_BYTES, maxMusicBytes: MAX_MUSIC_BYTES, access: blob ? await resolveBlobAccess() : null });
  }),
);

/**
 * Token para o navegador enviar a música direto ao Blob (sem passar pelo limite de 4,5 MB do servidor).
 * Só o admin chega aqui; o token vale para a pasta de músicas, só áudio e até MAX_MUSIC_BYTES.
 */
uploadsRouter.post(
  "/music-token",
  asyncHandler(async (req, res) => {
    if (!uploadsConfigured()) {
      throw badRequest("Enviar músicas exige o Vercel Blob configurado. Enquanto isso, cole o link de um arquivo de áudio.");
    }
    const json = await handleUpload({
      body: req.body as HandleUploadBody,
      request: req,
      ...blobCredentials(),
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("musicas/") || pathname.includes("..")) {
          throw badRequest("Destino de upload inválido.");
        }
        return { allowedContentTypes: MUSIC_CONTENT_TYPES, maximumSizeInBytes: MAX_MUSIC_BYTES, addRandomSuffix: true, cacheControlMaxAge: 60 * 60 * 24 * 365 };
      },
    });
    res.json(json);
  }),
);

/**
 * Recebe a imagem crua no corpo (Content-Type: image/...).
 * Query: folder=personagens|conteudo e name=nome-original.
 */
uploadsRouter.post(
  "/",
  express.raw({ type: "image/*", limit: MAX_UPLOAD_BYTES }),
  asyncHandler(async (req, res) => {
    const folder = String(req.query.folder ?? "");
    // "musicas" não passa por aqui: vai direto ao Blob (ver /music-token).
    if (folder === "musicas" || !UPLOAD_FOLDERS.includes(folder as UploadFolder)) {
      throw badRequest("Destino de upload inválido.");
    }
    if (!Buffer.isBuffer(req.body)) {
      throw badRequest("Envie a imagem no corpo da requisição.");
    }
    const name = typeof req.query.name === "string" ? req.query.name : "imagem";
    res.status(201).json(await saveImage(req.body, folder as UploadFolder, name));
  }),
);
