import { Router } from "express";
import { randomBytes } from "node:crypto";
import { prisma } from "../db/prisma";
import { badRequest, notFound } from "../lib/errors";
import { normalizeKey, parseId, requiredText, z } from "../lib/validation";
import { requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { MISSION_METRICS, MISSION_METRIC_KEYS, type MissionMetric } from "../services/missions";

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

// ---------------------------------------------------------------------------
// Importação em lote (planilha)
// ---------------------------------------------------------------------------

const PERIOD_ALIASES: Record<string, "DAILY" | "WEEKLY"> = { diaria: "DAILY", diarias: "DAILY", daily: "DAILY", semanal: "WEEKLY", semanais: "WEEKLY", weekly: "WEEKLY" };

const bulkRow = z.object({
  title: requiredText(120),
  period: z.string().trim().min(1, "informe o período (Diária ou Semanal)"),
  metric: z.string().trim().min(1, "informe o que a missão conta"),
  target: z.coerce.number().int().min(1).max(10_000),
  coins: z.coerce.number().int().min(0).max(100_000).optional(),
  reward: z.string().trim().optional(),
});

/** Cria várias missões de uma vez; valida linha por linha e, com dryRun, só mostra a prévia. */
missionsAdminRouter.post(
  "/bulk",
  asyncHandler(async (req, res) => {
    const { rows, dryRun } = z.object({ rows: z.array(z.unknown()).min(1).max(300), dryRun: z.boolean().optional() }).parse(req.body);
    const [rewards, existingTitles] = await Promise.all([
      prisma.rewardDefinition.findMany({ select: { id: true, name: true, rewardType: true } }),
      prisma.mission.findMany({ select: { title: true, period: true } }),
    ]);
    const rewardByName = new Map(rewards.map((reward) => [normalizeKey(reward.name), reward]));
    const metricByLabel = new Map<string, MissionMetric>(MISSION_METRIC_KEYS.flatMap((key) => [[normalizeKey(key), key] as const, [normalizeKey(MISSION_METRICS[key].label), key] as const]));
    const seen = new Set(existingTitles.map((mission) => `${mission.period}:${normalizeKey(mission.title)}`));
    const errors: Array<{ row: number; message: string }> = [];
    const valid: Array<{ title: string; period: "DAILY" | "WEEKLY"; metric: MissionMetric; target: number; rewardCoins: number; rewardDefinitionId: number | null }> = [];

    rows.forEach((raw, index) => {
      const row = index + 1;
      const parsed = bulkRow.safeParse(raw);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        errors.push({ row, message: `${issue.path.join(".") || "linha"}: ${issue.message}` });
        return;
      }
      const data = parsed.data;
      const period = PERIOD_ALIASES[normalizeKey(data.period)];
      if (!period) {
        errors.push({ row, message: `período "${data.period}" inválido (use Diária ou Semanal)` });
        return;
      }
      const metric = metricByLabel.get(normalizeKey(data.metric));
      if (!metric) {
        errors.push({ row, message: `"${data.metric}" não é algo que a missão conta (use ${MISSION_METRIC_KEYS.map((key) => MISSION_METRICS[key].label).join(", ")})` });
        return;
      }
      let rewardDefinitionId: number | null = null;
      if (data.reward) {
        const reward = rewardByName.get(normalizeKey(data.reward));
        if (!reward) {
          errors.push({ row, message: `recompensa "${data.reward}" não encontrada (use o nome igual ao da tela Recompensas)` });
          return;
        }
        if (reward.rewardType.startsWith("CHEST_")) {
          errors.push({ row, message: "baús não podem ser prêmio de missão" });
          return;
        }
        rewardDefinitionId = reward.id;
      }
      const coins = data.coins ?? 0;
      if (coins === 0 && !rewardDefinitionId) {
        errors.push({ row, message: "defina moedas e/ou uma recompensa" });
        return;
      }
      const key = `${period}:${normalizeKey(data.title)}`;
      if (seen.has(key)) {
        errors.push({ row, message: "já existe uma missão com este texto neste período" });
        return;
      }
      seen.add(key);
      valid.push({ title: data.title, period, metric, target: data.target, rewardCoins: coins, rewardDefinitionId });
    });

    if (!dryRun && valid.length > 0) {
      const last = await prisma.mission.aggregate({ _max: { sortOrder: true } });
      let order = (last._max.sortOrder ?? 0) + 10;
      await prisma.mission.createMany({ data: valid.map((mission) => ({ ...mission, code: `X${randomBytes(5).toString("hex")}`, system: false, sortOrder: (order += 10) })) });
    }
    res.json({ valid: valid.length, created: dryRun ? 0 : valid.length, errors });
  }),
);
