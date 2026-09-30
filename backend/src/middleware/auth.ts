import type { NextFunction, Request, Response } from "express";
import type { User } from "@prisma/client";
import { prisma } from "../db/prisma";
import { forbidden, unauthorized } from "../lib/errors";
import { verifyToken } from "../lib/jwt";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

const INVALID_TOKEN = "Token inválido ou expirado";

/**
 * Confere o access token e carrega o usuário do banco a cada requisição, para
 * que exclusão de conta e mudança de papel valham na hora.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw unauthorized("Autenticação necessária");
    }

    const email = verifyToken(header.slice("Bearer ".length), "ACCESS");
    if (!email) {
      throw unauthorized(INVALID_TOKEN);
    }

    const user = await prisma.user.findFirst({ where: { email, deleted: false } });
    if (!user) {
      throw unauthorized(INVALID_TOKEN);
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN") {
    return next(forbidden("Apenas administradores podem realizar esta ação"));
  }
  next();
}

/** Usuário autenticado da requisição (as rotas que chamam já passaram por requireAuth). */
export function currentUser(req: Request): User {
  if (!req.user) {
    throw unauthorized("Autenticação necessária");
  }
  return req.user;
}
