import jwt from "jsonwebtoken";
import { env } from "./env";

type TokenType = "ACCESS" | "REFRESH";

const EXPIRATION: Record<TokenType, number> = {
  ACCESS: 60 * 60,
  REFRESH: 7 * 24 * 60 * 60,
};

type TokenClaims = { sub: string; token_type: TokenType };

function sign(email: string, tokenType: TokenType) {
  return jwt.sign({ token_type: tokenType }, env.jwtSecret, {
    subject: email,
    algorithm: "HS256",
    expiresIn: EXPIRATION[tokenType],
  });
}

export function issueTokens(email: string) {
  return {
    accessToken: sign(email, "ACCESS"),
    refreshToken: sign(email, "REFRESH"),
  };
}

/** Devolve o e-mail do token se ele for válido e do tipo esperado; senão, null. */
export function verifyToken(token: string, expected: TokenType): string | null {
  try {
    const claims = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] }) as TokenClaims;
    return claims.token_type === expected && claims.sub ? claims.sub : null;
  } catch {
    return null;
  }
}
