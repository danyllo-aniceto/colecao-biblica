import { Readable } from "node:stream";
import express, { Router } from "express";
import { badRequest, notFound } from "../lib/errors";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { MAX_UPLOAD_BYTES, UPLOAD_FOLDERS, isValidUploadPath, readPrivateImage, saveImage, uploadsConfigured, type UploadFolder } from "../services/uploads";

export const uploadsRouter = Router();

/**
 * Imagens de store privado: servidas por aqui (a tag <img> não manda token).
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
  express.raw({ type: "image/*", limit: MAX_UPLOAD_BYTES }),
  asyncHandler(async (req, res) => {
    const folder = String(req.query.folder ?? "");
    if (!UPLOAD_FOLDERS.includes(folder as UploadFolder)) {
      throw badRequest("Destino de upload inválido.");
    }
    if (!Buffer.isBuffer(req.body)) {
      throw badRequest("Envie a imagem no corpo da requisição.");
    }
    const name = typeof req.query.name === "string" ? req.query.name : "imagem";
    res.status(201).json(await saveImage(req.body, folder as UploadFolder, name));
  }),
);
