import { Router } from "express";
import { prisma } from "../db/prisma";
import { readPage, queryText } from "../lib/pagination";
import { clearableText, parseId, requiredText, z } from "../lib/validation";
import { requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { isHexColor, MAX_FRAMES, POSES, SOUND_KEYS } from "../runner/characters";
import { adminRunnerCharacters, createRunnerCharacter, deleteRunnerCharacter, listRunnerCharacters, updateRunnerCharacter } from "../services/runner-characters";

/** Modo Corrida: personagens (sprites e sons enviados pelo painel). Nada do modo dá XP, moedas, figurinhas nem ranking geral. */
export const runnerRouter = Router();

/** Endereço do sprite: link normal ou a própria imagem embutida (como as outras imagens do painel). */
const spriteUrl = z
  .string()
  .trim()
  .min(1, "Envie a imagem do sprite")
  .refine((value) => (value.startsWith("data:image/") ? value.length <= 5_500_000 : value.length <= 2048), { message: "Endereço da imagem muito longo" });
const sheet = z.object({ url: spriteUrl, frames: z.number().int().min(1).max(MAX_FRAMES) });
const soundUrl = z.string().trim().min(1).max(2048, "Endereço do som muito longo");
const color = z.string().trim().refine(isHexColor, { message: "use uma cor no formato #RRGGBB" });

const body = z.object({
  name: requiredText(60).optional(),
  description: clearableText(200),
  color: color.optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  unlockLevel: clearableText(60),
  sprites: z.record(z.enum(POSES), z.union([sheet, z.null()])).optional(),
  sounds: z.record(z.enum(SOUND_KEYS), z.union([soundUrl, z.null()])).optional(),
});

/** Personagens ativos (qualquer jogador logado lê; o app guarda para abrir offline). */
runnerRouter.get(
  "/characters",
  asyncHandler(async (_req, res) => {
    res.json(await listRunnerCharacters(prisma));
  }),
);

runnerRouter.get(
  "/admin/characters",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { page, size, skip, take } = readPage(req, 10, 50);
    res.json(await adminRunnerCharacters(prisma, skip, take, page, size, queryText(req.query.q)));
  }),
);

runnerRouter.post(
  "/admin/characters",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = body.extend({ name: requiredText(60) }).parse(req.body);
    res.status(201).json(await createRunnerCharacter(prisma, input as typeof input & { name: string }));
  }),
);

runnerRouter.put(
  "/admin/characters/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await updateRunnerCharacter(prisma, parseId(String(req.params.id), "Personagem"), body.parse(req.body)));
  }),
);

runnerRouter.delete(
  "/admin/characters/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    await deleteRunnerCharacter(prisma, parseId(String(req.params.id), "Personagem"));
    res.status(204).end();
  }),
);
