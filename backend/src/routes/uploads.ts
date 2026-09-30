import { Router } from "express";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { env } from "../lib/env";
import { errorBody } from "../lib/errors";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";

export const uploadsRouter = Router();

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"];

/**
 * Upload de imagens direto do navegador para o Vercel Blob: esta rota só emite
 * o token (o arquivo não passa pela função). Apenas admins podem enviar.
 */
uploadsRouter.post(
  "/",
  (req, res, next) => {
    if (!env.blobToken) {
      return res.status(501).json(errorBody(501, "Upload de imagens não configurado (BLOB_READ_WRITE_TOKEN ausente)."));
    }
    // O aviso de "upload concluído" vem da própria Vercel (assinado), sem token de usuário.
    if ((req.body as HandleUploadBody | undefined)?.type === "blob.upload-completed") {
      return next();
    }
    return requireAuth(req, res, (error?: unknown) => (error ? next(error) : requireAdmin(req, res, next)));
  },
  asyncHandler(async (req, res) => {
    try {
      const result = await handleUpload({
        body: req.body as HandleUploadBody,
        request: req,
        token: env.blobToken,
        onBeforeGenerateToken: async (pathname) => {
          if (!pathname.startsWith("personagens/") && !pathname.startsWith("conteudo/")) {
            throw new Error("Destino de upload inválido.");
          }
          return { allowedContentTypes: ALLOWED_IMAGE_TYPES, maximumSizeInBytes: MAX_IMAGE_BYTES, addRandomSuffix: true };
        },
        onUploadCompleted: async () => {},
      });
      res.json(result);
    } catch (error) {
      res.status(400).json(errorBody(400, error instanceof Error ? error.message : "Falha no upload."));
    }
  }),
);
