import type { Request } from "express";
import { parseIntQuery } from "./validation";

/** Página no formato que o frontend já usa (mesmo da API antiga em Spring). */
export function pageOf<T>(content: T[], total: number, page: number, size: number) {
  return {
    content,
    totalElements: total,
    totalPages: Math.ceil(total / size),
    number: page,
    size,
    first: page === 0,
    last: (page + 1) * size >= total,
    empty: content.length === 0,
  };
}

/** Lê `page` (a partir de 0) e `size` da query, com limites. */
export function readPage(req: Request, defaultSize = 10, maxSize = 100) {
  const page = Math.max(0, parseIntQuery(req.query.page, 0));
  const size = Math.max(1, Math.min(parseIntQuery(req.query.size, defaultSize), maxSize));
  return { page, size, skip: page * size, take: size };
}

/** Texto de filtro da query (vazio vira undefined). */
export function queryText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
