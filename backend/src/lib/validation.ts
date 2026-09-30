import { z } from "zod";
import { badRequest } from "./errors";

// Mensagens de validação em português (aparecem em `fields` na resposta 400).
z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      return { message: issue.received === "undefined" || issue.received === "null" ? "é obrigatório" : "tipo inválido" };
    case z.ZodIssueCode.too_small:
      return {
        message: issue.type === "string" ? (issue.minimum === 1 ? "não pode ficar em branco" : `deve ter pelo menos ${issue.minimum} caracteres`) : `deve ser no mínimo ${issue.minimum}`,
      };
    case z.ZodIssueCode.too_big:
      return { message: issue.type === "string" ? `deve ter no máximo ${issue.maximum} caracteres` : `deve ser no máximo ${issue.maximum}` };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: `valor inválido (use ${issue.options.join(", ")})` };
    case z.ZodIssueCode.invalid_string:
      return { message: issue.validation === "email" ? "e-mail inválido" : "formato inválido" };
    default:
      return { message: ctx.defaultError };
  }
});

/** Texto obrigatório: ignora espaços nas pontas e não aceita vazio. */
export const requiredText = (max?: number) => {
  const base = z.string().trim().min(1);
  return max ? base.max(max) : base;
};

/** Texto opcional em atualizações: se vier, não pode ser vazio. */
export const optionalText = (max?: number) => requiredText(max).optional();

export const optionLetter = z
  .string()
  .trim()
  .regex(/^[ABCDabcd]$/, "deve ser A, B, C ou D")
  .transform((value) => value.toUpperCase());

export function parseId(value: string, label = "Identificador"): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw badRequest(`${label} inválido`);
  }
  return id;
}

export function parseIntQuery(value: unknown, fallback: number): number {
  if (typeof value !== "string" || value.trim() === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw badRequest("Parâmetro numérico inválido");
  }
  return parsed;
}

export { z };
