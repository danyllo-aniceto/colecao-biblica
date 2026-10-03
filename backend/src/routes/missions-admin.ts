import { Router } from "express";
import { randomBytes } from "node:crypto";
import { prisma } from "../db/prisma";
import { badRequest, notFound } from "../lib/errors";
import { parseId, requiredText, z } from "../lib/validation";
import { requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { MISSION_METRICS, MISSION_METRIC_KEYS } from "../services/missions";

/** Painel das missões: metas diárias e semanais com prêmio de moedas e/ou uma recompensa. */
export const missionsAdminRouter = Router();
missionsAdminRouter.use(requireAdmin);

const include = { rewardDefinition: { select: { id: true, name: true, rewardType: true } } } as const;

const baseSchema = z.object({
  title: requiredText(120),
  target: z.number().int().min(1).max(10_000),
  rewardCoins: z.number().int().min(0).max(100_000),
  rewardDefinitionId: z.number().int().positive().nullish(),
  active: z.boolean().optional(),
});
const createSchema = baseSchema.extend({ period: z.enum(["DAILY", "WEEKLY"]), metric: z.enum(MISSION_METRIC_KEYS) });
// As missões do sistema mantêm período e o que contam; o resto é editável.
const updateSchema = baseSchema.partial().extend({ period: z.enum(["DAILY", "WEEKLY"]).optional(), metric: z.enum(MISSION_METRIC_KEYS).optional() });

async function ensureReward(id: number | null | undefined, coins: number) {
  if (id) {
    const reward = await prisma.rewardDefinition.findUnique({ where: { id }, select: { id: true, rewardType: true } });
    if (!reward) throw notFound("Recompensa não encontrada");
    if (reward.rewardType.startsWith("CHEST_")) throw badRequest("Use uma recompensa que não seja baú");
  } else if (coins <= 0) {
    throw badRequest("Defina moedas e/ou uma recompensa para a missão");
  }
}

missionsAdminRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const missions = await prisma.mission.findMany({ include, orderBy: [{ period: "asc" }, { sortOrder: "asc" }, { id: "asc" }] });
    res.json({
      metrics: MISSION_METRIC_KEYS.map((key) => ({ value: key, label: MISSION_METRICS[key].label })),
      missions: missions.map(({ rewardDefinition, ...mission }) => ({ ...mission, reward: rewardDefinition })),
    });
  }),
);

missionsAdminRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createSchema.parse(req.body);
    await ensureReward(data.rewardDefinitionId, data.rewardCoins);
    const last = await prisma.mission.aggregate({ _max: { sortOrder: true } });
    const created = await prisma.mission.create({
      data: { ...data, rewardDefinitionId: data.rewardDefinitionId ?? null, code: `X${randomBytes(5).toString("hex")}`, system: false, sortOrder: (last._max.sortOrder ?? 0) + 10 },
      include,
    });
    res.status(201).json(created);
  }),
);

missionsAdminRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = await prisma.mission.findUnique({ where: { id } });
    if (!existing) throw notFound("Missão não encontrada");
    const data = updateSchema.parse(req.body);
    const coins = data.rewardCoins ?? existing.rewardCoins;
    const rewardId = data.rewardDefinitionId === undefined ? existing.rewardDefinitionId : data.rewardDefinitionId;
    await ensureReward(rewardId, coins);
    if (existing.system) {
      delete data.period;
      delete data.metric;
    }
    res.json(await prisma.mission.update({ where: { id }, data, include }));
  }),
);

missionsAdminRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = await prisma.mission.findUnique({ where: { id } });
    if (!existing) throw notFound("Missão não encontrada");
    if (existing.system) throw badRequest("Missões do sistema não podem ser excluídas: desative-a");
    await prisma.mission.delete({ where: { id } });
    res.status(204).end();
  }),
);
