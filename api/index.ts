import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createApp } from "../backend/src/app";

// Toda a API roda nesta única função serverless; o vercel.json manda /api/* para cá.
const app = createApp();

export default function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as never, res as never);
}
