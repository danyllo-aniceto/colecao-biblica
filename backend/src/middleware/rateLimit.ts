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
export const boardLimiter = limiter(60 * 1000, 20, "Muitos tabuleiros em sequência. Aguarde um instante e tente de novo.");
export const boardActionLimiter = limiter(60 * 1000, 120, "Muitas jogadas em sequência. Aguarde um instante.");

export const duelActionLimiter = limiter(60 * 1000, 240, "Muitas jogadas em sequência. Aguarde um instante.");
