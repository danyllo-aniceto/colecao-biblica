import { STATUS_CODES } from "node:http";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new HttpError(400, message);
export const unauthorized = (message: string) => new HttpError(401, message);
export const forbidden = (message: string) => new HttpError(403, message);
export const notFound = (message: string) => new HttpError(404, message);

/** Corpo de erro no mesmo formato da API antiga: o frontend lê o campo `message`. */
export function errorBody(status: number, message: string, fields?: Record<string, string>) {
  return {
    timestamp: new Date().toISOString(),
    status,
    error: STATUS_CODES[status] ?? "Error",
    message,
    ...(fields ? { fields } : {}),
  };
}
