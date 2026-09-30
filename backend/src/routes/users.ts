import { Router } from "express";
import bcrypt from "bcryptjs";
import type { Prisma, User } from "@prisma/client";
import { prisma } from "../db/prisma";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { verifyToken } from "../lib/jwt";
import { parseId, parseIntQuery, requiredText, z } from "../lib/validation";
import { currentUser, requireAdmin, requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { signupLimiter } from "../middleware/rateLimit";
import { toUserResponse } from "../services/mappers";

export const usersRouter = Router();

const PASSWORD_MIN = 6;
const email = z.string().trim().toLowerCase().email().max(200);

async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

async function ensureEmailAvailable(value: string, exceptUserId?: number) {
  // O e-mail é único na tabela inteira (inclusive contas excluídas).
  const existing = await prisma.user.findUnique({ where: { email: value }, select: { id: true } });
  if (existing && existing.id !== exceptUserId) {
    throw badRequest("E-mail já cadastrado");
  }
}

const createSchema = z.object({
  name: requiredText(120),
  email,
  password: z.string().min(PASSWORD_MIN).max(200),
  role: z.enum(["ADMIN", "USER"]).nullish(),
});

/** Admin logado que está criando a conta pelo painel (o cadastro público não manda token). */
async function adminFromHeader(authorization: string | undefined) {
  const userEmail = authorization?.startsWith("Bearer ") ? verifyToken(authorization.slice(7), "ACCESS") : null;
  if (!userEmail) {
    return null;
  }
  const actor = await prisma.user.findFirst({ where: { email: userEmail, deleted: false, role: "ADMIN" } });
  return actor;
}

// Cadastro público sempre cria jogador comum; só um admin logado escolhe o papel.
usersRouter.post(
  "/",
  signupLimiter,
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    const admin = await adminFromHeader(req.headers.authorization);
    await ensureEmailAvailable(input.email);
    const user = await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        password: await hashPassword(input.password),
        role: admin ? (input.role ?? "USER") : "USER",
        createdBy: admin?.email ?? input.email,
        updatedBy: admin?.email ?? input.email,
      },
    });
    res.status(201).json(toUserResponse(user));
  }),
);

usersRouter.use(requireAuth);

usersRouter.get("/me", (req, res) => {
  res.json(toUserResponse(currentUser(req)));
});

usersRouter.get(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const page = Math.max(0, parseIntQuery(req.query.page, 0));
    const size = Math.max(1, Math.min(parseIntQuery(req.query.size, 10), 100));
    const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);
    const name = text(req.query.name);
    const emailFilter = text(req.query.email);
    const role = text(req.query.role)?.toUpperCase();
    if (role && role !== "ADMIN" && role !== "USER") {
      throw badRequest("Papel inválido");
    }

    const where: Prisma.UserWhereInput = {
      deleted: false,
      ...(name ? { name: { contains: name, mode: "insensitive" } } : {}),
      ...(emailFilter ? { email: { contains: emailFilter, mode: "insensitive" } } : {}),
      ...(role ? { role: role as User["role"] } : {}),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, orderBy: { id: "asc" }, skip: page * size, take: size }),
      prisma.user.count({ where }),
    ]);

    // Mesmo formato de página da API antiga.
    res.json({
      content: users.map(toUserResponse),
      totalElements: total,
      totalPages: Math.ceil(total / size),
      number: page,
      size,
      first: page === 0,
      last: (page + 1) * size >= total,
      empty: users.length === 0,
    });
  }),
);

async function getActiveUser(id: number) {
  const user = await prisma.user.findFirst({ where: { id, deleted: false } });
  if (!user) {
    throw notFound("Usuário não encontrado");
  }
  return user;
}

function ensureOwnerOrAdmin(actor: User, target: User) {
  if (actor.role !== "ADMIN" && actor.id !== target.id) {
    throw forbidden("Apenas o dono da conta ou um administrador pode executar esta operação");
  }
}

usersRouter.get(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(toUserResponse(await getActiveUser(parseId(req.params.id))));
  }),
);

const updateSchema = z.object({
  name: requiredText(120).optional(),
  email: email.optional(),
  password: z.string().max(200).optional(),
  role: z.enum(["ADMIN", "USER"]).optional(),
});

usersRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const actor = currentUser(req);
    const target = await getActiveUser(parseId(req.params.id));
    ensureOwnerOrAdmin(actor, target);
    const input = updateSchema.parse(req.body);

    const data: Prisma.UserUpdateInput = { updatedBy: actor.email };
    if (input.name !== undefined) data.name = input.name;
    if (input.email !== undefined && input.email !== target.email) {
      await ensureEmailAvailable(input.email, target.id);
      data.email = input.email;
    }
    if (input.password !== undefined && input.password.trim() !== "") {
      if (input.password.length < PASSWORD_MIN) {
        throw badRequest(`A senha deve ter pelo menos ${PASSWORD_MIN} caracteres`);
      }
      data.password = await hashPassword(input.password);
    }
    if (input.role !== undefined && input.role !== target.role) {
      // Só admin muda papel (antes o próprio usuário conseguia se promover).
      if (actor.role !== "ADMIN") {
        throw forbidden("Apenas administradores podem alterar o papel de um usuário");
      }
      if (actor.id === target.id) {
        throw badRequest("Você não pode alterar o seu próprio papel");
      }
      data.role = input.role;
    }

    res.json(toUserResponse(await prisma.user.update({ where: { id: target.id }, data })));
  }),
);

usersRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const actor = currentUser(req);
    const target = await getActiveUser(parseId(req.params.id));
    ensureOwnerOrAdmin(actor, target);
    await prisma.user.update({
      where: { id: target.id },
      data: { deleted: true, deletedAt: new Date(), deletedBy: actor.email, updatedBy: actor.email },
    });
    res.status(204).end();
  }),
);
