import { Router } from "express";
import { prisma } from "../db/prisma";
import { readPage, queryText } from "../lib/pagination";
import { clearableText, parseId, requiredText, z } from "../lib/validation";
import { currentUser, requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { DIFFICULTY_RANGE, SECONDS_RANGE, SEED_RANGE, MAX_FORM_ORDER } from "../runner/campaign";
import { isHexColor, MAX_FRAMES, MAX_VARIANTS, POSES, SOUND_KEYS } from "../runner/characters";
import { ART_KEYS } from "../runner/types";
import { getRunnerProgress, submitRunnerResult } from "../services/runner-progress";
import { adminLevels, adminScenarios, createLevel, createScenario, deleteLevel, deleteScenario, getCampaign, levelOptions, scenarioOptions, updateLevel, updateScenario } from "../services/runner-campaign";
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
  sounds: z.record(z.enum(SOUND_KEYS), z.union([soundUrl, z.array(soundUrl).max(MAX_VARIANTS), z.null()])).optional(),
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

// ---------- Campanha: cenários e fases (o painel cria, edita e testa; o jogador lê a campanha pronta) ----------

const artUrl = z
  .string()
  .trim()
  .max(5_500_000, "Imagem muito grande")
  .refine((value) => (value.startsWith("data:image/") ? true : value.length <= 2048), { message: "Endereço da imagem muito longo" });

const scenarioBody = z.object({
  name: requiredText(60).optional(),
  story: clearableText(300),
  skyTop: color.optional(),
  skyBottom: color.optional(),
  art: z.record(z.enum(ART_KEYS), z.union([artUrl, z.null()])).optional(),
  musicUrl: clearableText(2048),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

const levelBody = z.object({
  scenarioId: z.number().int().positive().optional(),
  name: requiredText(80).optional(),
  seed: z.number().int().min(SEED_RANGE.min).max(SEED_RANGE.max).optional(),
  seconds: z.number().int().min(SECONDS_RANGE.min).max(SECONDS_RANGE.max).optional(),
  order: z.array(z.enum(["RUN", "FLY", "GRAVITY"])).min(1).max(MAX_FORM_ORDER).optional(),
  verseRef: requiredText(60).optional(),
  verseText: requiredText(400).optional(),
  forks: z.boolean().optional(),
  powers: z.boolean().optional(),
  difficulty: z.number().int().min(DIFFICULTY_RANGE.min).max(DIFFICULTY_RANGE.max).optional(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

/** Progresso do jogador na campanha (melhor resultado de cada fase, conferido pelo servidor; o app guarda para abrir offline). */
runnerRouter.get(
  "/progress",
  asyncHandler(async (req, res) => {
    res.json(await getRunnerProgress(prisma, currentUser(req).id));
  }),
);

/** Resultado de uma partida da campanha: a corrente de tentativas com os toques (o servidor repete tudo e confere). */
runnerRouter.post(
  "/levels/:slug/result",
  asyncHandler(async (req, res) => {
    const body = z.object({ segments: z.unknown() }).parse(req.body);
    res.json(await submitRunnerResult(currentUser(req).id, String(req.params.slug), body.segments));
  }),
);

/** Campanha ativa (qualquer jogador logado lê; o app guarda para abrir offline). */
runnerRouter.get(
  "/campaign",
  asyncHandler(async (_req, res) => {
    res.json({ scenarios: await getCampaign(prisma) });
  }),
);

runnerRouter.get(
  "/admin/scenarios",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { page, size, skip, take } = readPage(req, 10, 50);
    res.json(await adminScenarios(prisma, skip, take, page, size, queryText(req.query.q)));
  }),
);

runnerRouter.get(
  "/admin/scenario-options",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await scenarioOptions(prisma));
  }),
);

runnerRouter.get(
  "/admin/level-options",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await levelOptions(prisma));
  }),
);

runnerRouter.post(
  "/admin/scenarios",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = scenarioBody.extend({ name: requiredText(60) }).parse(req.body);
    res.status(201).json(await createScenario(prisma, input as typeof input & { name: string }));
  }),
);

runnerRouter.put(
  "/admin/scenarios/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await updateScenario(prisma, parseId(String(req.params.id), "Cenário"), scenarioBody.parse(req.body)));
  }),
);

runnerRouter.delete(
  "/admin/scenarios/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    await deleteScenario(prisma, parseId(String(req.params.id), "Cenário"));
    res.status(204).end();
  }),
);

runnerRouter.get(
  "/admin/levels",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { page, size, skip, take } = readPage(req, 10, 50);
    const scenario = Number(req.query.scenarioId);
    res.json(await adminLevels(prisma, skip, take, page, size, { scenarioId: Number.isInteger(scenario) && scenario > 0 ? scenario : undefined, search: queryText(req.query.q) }));
  }),
);

runnerRouter.post(
  "/admin/levels",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = levelBody
      .extend({ scenarioId: z.number().int().positive(), name: requiredText(80), seed: z.number().int().min(SEED_RANGE.min).max(SEED_RANGE.max), seconds: z.number().int().min(SECONDS_RANGE.min).max(SECONDS_RANGE.max), order: z.array(z.enum(["RUN", "FLY", "GRAVITY"])).min(1).max(MAX_FORM_ORDER), verseRef: requiredText(60), verseText: requiredText(400) })
      .parse(req.body);
    res.status(201).json(await createLevel(prisma, input));
  }),
);

runnerRouter.put(
  "/admin/levels/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(await updateLevel(prisma, parseId(String(req.params.id), "Fase"), levelBody.parse(req.body)));
  }),
);

runnerRouter.delete(
  "/admin/levels/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    await deleteLevel(prisma, parseId(String(req.params.id), "Fase"));
    res.status(204).end();
  }),
);
