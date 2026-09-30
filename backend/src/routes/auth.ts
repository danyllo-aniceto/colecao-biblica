import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db/prisma";
import { unauthorized } from "../lib/errors";
import { issueTokens, verifyToken } from "../lib/jwt";
import { z } from "../lib/validation";
import { asyncHandler } from "../middleware/errorHandler";
import { loginLimiter } from "../middleware/rateLimit";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

authRouter.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findFirst({ where: { email: email.toLowerCase(), deleted: false } });

    // Mesma mensagem para e-mail inexistente e senha errada, para não revelar quais e-mails têm conta.
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw unauthorized("E-mail ou senha inválidos");
    }

    res.json(issueTokens(user.email));
  }),
);

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const email = verifyToken(refreshToken, "REFRESH");
    const user = email ? await prisma.user.findFirst({ where: { email, deleted: false } }) : null;
    if (!user) {
      throw unauthorized("Token de refresh inválido ou expirado");
    }
    res.json(issueTokens(user.email));
  }),
);
