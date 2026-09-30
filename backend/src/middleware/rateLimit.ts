import rateLimit from "express-rate-limit";
import { errorBody } from "../lib/errors";

function limiter(windowMs: number, limit: number, message: string) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test",
    handler: (_req, res) => {
      res.status(429).json(errorBody(429, message));
    },
  });
}

// Por instância: na Vercel cada instância conta separado, mas já freia tentativas em sequência.
export const loginLimiter = limiter(15 * 60 * 1000, 20, "Muitas tentativas de login. Aguarde alguns minutos e tente de novo.");
export const signupLimiter = limiter(60 * 60 * 1000, 10, "Muitos cadastros deste endereço. Tente novamente mais tarde.");
