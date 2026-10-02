import { Readable } from "node:stream";
import express, { Router } from "express";
import { badRequest, notFound } from "../lib/errors";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { MAX_UPLOAD_BYTES, UPLOAD_FOLDERS, isValidUploadPath, readPrivateImage, saveAudio, saveImage, uploadsConfigured, type UploadFolder } from "../services/uploads";

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
        const end = range[1] && range[2] ? Math.min(Number(range[2]), file.length - 1) : file.length - 1;
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
uploadsRouter.get("/config", (_req, res) => {
  res.json({ storage: uploadsConfigured() ? "blob" : "inline", maxBytes: MAX_UPLOAD_BYTES });
});

/**
 * Recebe a imagem crua no corpo (Content-Type: image/...).
 * Query: folder=personagens|conteudo e name=nome-original.
 */
uploadsRouter.post(
  "/",
  express.raw({ type: ["image/*", "audio/*"], limit: MAX_UPLOAD_BYTES }),
  asyncHandler(async (req, res) => {
    const folder = String(req.query.folder ?? "");
    if (!UPLOAD_FOLDERS.includes(folder as UploadFolder)) {
      throw badRequest("Destino de upload inválido.");
    }
    if (!Buffer.isBuffer(req.body)) {
      throw badRequest("Envie a imagem no corpo da requisição.");
    }
    const name = typeof req.query.name === "string" ? req.query.name : "arquivo";
    // Músicas só vão para a pasta própria, e imagens nunca para ela.
    const isAudio = String(req.headers["content-type"] ?? "").startsWith("audio/");
    if (isAudio !== (folder === "musicas")) {
      throw badRequest(isAudio ? "Músicas só podem ser enviadas para a pasta de músicas." : "Destino de upload inválido.");
    }
    res.status(201).json(isAudio ? await saveAudio(req.body, name) : await saveImage(req.body, folder as UploadFolder, name));
  }),
);
