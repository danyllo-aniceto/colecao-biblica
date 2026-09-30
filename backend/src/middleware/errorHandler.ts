import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { HttpError, errorBody } from "../lib/errors";

type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Express 4 não captura rejeições de funções async: repassa o erro ao errorHandler. */
export function asyncHandler(fn: AsyncHandler): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json(errorBody(404, "Recurso não encontrado"));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json(errorBody(err.status, err.message));
  }

  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "body";
      fields[key] ??= issue.message;
    }
    return res.status(400).json(errorBody(400, "Dados de entrada inválidos", fields));
  }

  // JSON malformado no corpo (erro do express.json).
  if (typeof err === "object" && err !== null && (err as { type?: string }).type === "entity.parse.failed") {
    return res.status(400).json(errorBody(400, "Corpo da requisição inválido"));
  }
  if (typeof err === "object" && err !== null && (err as { type?: string }).type === "entity.too.large") {
    return res.status(413).json(errorBody(413, "Conteúdo grande demais. Use imagens menores."));
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(400).json(errorBody(400, "Já existe um registro com esses dados"));
    }
    if (err.code === "P2025") {
      return res.status(404).json(errorBody(404, "Recurso não encontrado"));
    }
  }

  console.error(err);
  return res.status(500).json(errorBody(500, "Erro inesperado"));
}
