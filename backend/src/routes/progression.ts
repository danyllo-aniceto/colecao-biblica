import { Router } from "express";
import { prisma } from "../db/prisma";
import { badRequest, notFound } from "../lib/errors";
import { pageOf, readPage } from "../lib/pagination";
import type { Prisma } from "@prisma/client";
import { env } from "../lib/env";
import { clearableText, imageRef, normalizeKey, parseId, requiredText, z } from "../lib/validation";
import { currentUser, requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { toCosmeticResponse } from "../services/cosmetics";
import { monthKeyInTimeZone, nextMonthKey, passForMonth } from "../services/game-rules";
import { claimCollection, claimPassTier, getActiveEvent, getPass, listCollections, openChest } from "../services/progression";

const cosmeticRef = z.number().int().positive().nullish();

async function ensureCosmetic(id?: number | null) {
  if (!id) return;
  if (!(await prisma.cosmetic.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Item visual não encontrado");
}

// ---------------------------------------------------------------------------
// Baú de nível
// ---------------------------------------------------------------------------

export const chestsRouter = Router();

const CHEST_TIERS = ["BRONZE", "SILVER", "GOLD", "DIAMOND", "EMERALD"] as const;

/** Visual cadastrado de cada baú da partida (o app usa o desenho padrão para o que estiver vazio). */
chestsRouter.get(
  "/designs",
  asyncHandler(async (_req, res) => {
    res.json(await prisma.chestDesign.findMany({ select: { tier: true, imageUrl: true, openImageUrl: true, name: true, color: true } }));
  }),
);

const designSchema = z.object({
  imageUrl: imageRef(),
  openImageUrl: imageRef(),
  name: clearableText(40),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "use o formato #rrggbb")
    .nullish(),
});

chestsRouter.put(
  "/admin/designs/:tier",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const tier = z.enum(CHEST_TIERS).parse(String(req.params.tier).toUpperCase());
    const input = designSchema.parse(req.body);
    const data = { imageUrl: input.imageUrl ?? null, openImageUrl: input.openImageUrl ?? null, name: input.name ?? null, color: input.color ?? null };
    const saved = await prisma.chestDesign.upsert({ where: { tier }, create: { tier, ...data }, update: data, select: { tier: true, imageUrl: true, openImageUrl: true, name: true, color: true } });
    res.json(saved);
  }),
);

chestsRouter.post(
  "/open",
  asyncHandler(async (req, res) => {
    res.json(await openChest(currentUser(req).id));
  }),
);

// ---------------------------------------------------------------------------
// Coleções temáticas
// ---------------------------------------------------------------------------

export const collectionsRouter = Router();

collectionsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await listCollections(currentUser(req).id));
  }),
);

collectionsRouter.post(
  "/:id/claim",
  asyncHandler(async (req, res) => {
    res.json(await claimCollection(currentUser(req).id, parseId(req.params.id)));
  }),
);

const collectionSchema = z.object({
  name: requiredText(80),
  description: clearableText(300),
  rewardCoins: z.number().int().min(0).max(100_000),
  rewardCosmeticId: cosmeticRef,
  characterIds: z.array(z.number().int().positive()).min(2, "Escolha pelo menos 2 personagens").max(200),
  active: z.boolean().optional(),
});

collectionsRouter.get(
  "/admin/list",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { page, size, skip, take } = readPage(req, 10, 50);
    const [items, total] = await Promise.all([
      prisma.characterCollection.findMany({
        orderBy: { id: "desc" },
        skip,
        take,
        include: { characters: { select: { id: true, name: true } }, rewardCosmetic: { select: { id: true, name: true, type: true } } },
      }),
      prisma.characterCollection.count(),
    ]);
    res.json(pageOf(items, total, page, size));
  }),
);

async function saveCollection(id: number | null, body: unknown) {
  const input = collectionSchema.parse(body);
  await ensureCosmetic(input.rewardCosmeticId);
  const characters = await prisma.biblicalCharacter.count({ where: { id: { in: input.characterIds } } });
  if (characters !== new Set(input.characterIds).size) throw badRequest("Algum personagem escolhido não existe mais");
  const duplicated = await prisma.characterCollection.findFirst({
    where: { name: { equals: input.name, mode: "insensitive" }, ...(id ? { id: { not: id } } : {}) },
    select: { id: true },
  });
  if (duplicated) throw badRequest("Já existe uma coleção com esse nome");
  const data = {
    name: input.name,
    description: input.description ?? null,
    rewardCoins: input.rewardCoins,
    rewardCosmeticId: input.rewardCosmeticId ?? null,
    active: input.active ?? true,
  };
  const connect = input.characterIds.map((characterId) => ({ id: characterId }));
  return id
    ? prisma.characterCollection.update({ where: { id }, data: { ...data, characters: { set: connect } } })
    : prisma.characterCollection.create({ data: { ...data, characters: { connect } } });
}

collectionsRouter.post(
  "/admin",
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.status(201).json(await saveCollection(null, req.body));
  }),
);

collectionsRouter.put(
  "/admin/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!(await prisma.characterCollection.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Coleção não encontrada");
    res.json(await saveCollection(id, req.body));
  }),
);

collectionsRouter.delete(
  "/admin/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!(await prisma.characterCollection.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Coleção não encontrada");
    await prisma.characterCollection.delete({ where: { id } });
    res.status(204).end();
  }),
);

// ---------------------------------------------------------------------------
// Passe da temporada
// ---------------------------------------------------------------------------

export const passRouter = Router();

passRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await getPass(currentUser(req).id));
  }),
);

passRouter.post(
  "/tiers/:id/claim",
  asyncHandler(async (req, res) => {
    res.json(await claimPassTier(currentUser(req).id, parseId(req.params.id)));
  }),
);

const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor no formato #rrggbb")
  .nullish();

const passSchema = z.object({
  name: requiredText(80),
  description: clearableText(300),
  color,
  imageUrl: imageRef(),
  pinnedMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use o mês no formato AAAA-MM")
    .nullish()
    .or(z.literal("")),
  active: z.boolean().optional(),
});

const passInclude = { _count: { select: { tiers: true } } } as const;

passRouter.get(
  "/admin/passes",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const passes = await prisma.pass.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }], include: passInclude });
    res.json(passes.map(({ _count, ...pass }) => ({ ...pass, tiers: _count.tiers })));
  }),
);

/** Qual passe vale em cada um dos próximos meses (rodízio e meses fixados). */
passRouter.get(
  "/admin/schedule",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const passes = await prisma.pass.findMany({ where: { active: true }, orderBy: { id: "asc" } });
    let monthKey = monthKeyInTimeZone(new Date(), env.timezone);
    const months = [];
    for (let index = 0; index < 12; index += 1) {
      const pass = passForMonth(passes, monthKey);
      months.push({ monthKey, passId: pass?.id ?? null, name: pass?.name ?? null, pinned: Boolean(pass?.pinnedMonth) });
      monthKey = nextMonthKey(monthKey);
    }
    res.json(months);
  }),
);

passRouter.post(
  "/admin/passes",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = passSchema.parse(req.body);
    const last = await prisma.pass.aggregate({ _max: { sortOrder: true } });
    res.status(201).json(await prisma.pass.create({ data: { ...input, pinnedMonth: input.pinnedMonth || null, sortOrder: (last._max.sortOrder ?? 0) + 10 } }));
  }),
);

passRouter.put(
  "/admin/passes/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!(await prisma.pass.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Passe não encontrado");
    const input = passSchema.partial().parse(req.body);
    res.json(await prisma.pass.update({ where: { id }, data: { ...input, ...(input.pinnedMonth !== undefined ? { pinnedMonth: input.pinnedMonth || null } : {}) } }));
  }),
);

passRouter.delete(
  "/admin/passes/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!(await prisma.pass.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Passe não encontrado");
    if ((await prisma.pass.count()) <= 1) throw badRequest("Mantenha pelo menos um passe: desative-o se não quiser usá-lo");
    await prisma.pass.delete({ where: { id } });
    res.status(204).end();
  }),
);

const tierSchema = z.object({
  passId: z.number().int().positive(),
  level: z.number().int().min(1).max(100),
  requiredXp: z.number().int().min(1).max(10_000_000),
  rewardCoins: z.number().int().min(0).max(100_000),
  rewardDefinitionId: z.number().int().positive().nullish(),
  rewardCosmeticId: cosmeticRef,
  duplicateCoins: z.number().int().min(0).max(100_000).nullish(),
  duplicateRewardDefinitionId: z.number().int().positive().nullish(),
  active: z.boolean().optional(),
});

const tierInclude = {
  rewardDefinition: { select: { id: true, name: true } },
  rewardCosmetic: { select: { id: true, name: true, type: true, rarity: true } },
  duplicateRewardDefinition: { select: { id: true, name: true } },
} as const;

passRouter.get(
  "/admin/tiers",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const passId = Number(req.query.passId);
    res.json(await prisma.passTier.findMany({ where: Number.isInteger(passId) && passId > 0 ? { passId } : {}, orderBy: [{ passId: "asc" }, { level: "asc" }], include: tierInclude }));
  }),
);

async function ensureReward(id?: number | null) {
  if (id && !(await prisma.rewardDefinition.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Recompensa não encontrada");
}

async function saveTier(id: number | null, body: unknown) {
  const input = tierSchema.parse(body);
  if (input.rewardCoins === 0 && !input.rewardDefinitionId && !input.rewardCosmeticId) throw badRequest("O degrau precisa dar alguma coisa");
  if (!(await prisma.pass.findUnique({ where: { id: input.passId }, select: { id: true } }))) throw notFound("Passe não encontrado");
  await ensureCosmetic(input.rewardCosmeticId);
  await ensureReward(input.rewardDefinitionId);
  await ensureReward(input.duplicateRewardDefinitionId);
  const sameLevel = await prisma.passTier.findFirst({ where: { passId: input.passId, level: input.level, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (sameLevel) throw badRequest(`Já existe o degrau ${input.level} neste passe`);
  const data = {
    ...input,
    rewardDefinitionId: input.rewardDefinitionId ?? null,
    rewardCosmeticId: input.rewardCosmeticId ?? null,
    duplicateCoins: input.duplicateCoins ?? null,
    duplicateRewardDefinitionId: input.duplicateRewardDefinitionId ?? null,
    active: input.active ?? true,
  };
  return id ? prisma.passTier.update({ where: { id }, data }) : prisma.passTier.create({ data });
}

passRouter.post(
  "/admin/tiers",
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.status(201).json(await saveTier(null, req.body));
  }),
);

passRouter.put(
  "/admin/tiers/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!(await prisma.passTier.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Degrau não encontrado");
    res.json(await saveTier(id, req.body));
  }),
);

passRouter.delete(
  "/admin/tiers/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!(await prisma.passTier.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Degrau não encontrado");
    await prisma.passTier.delete({ where: { id } });
    res.status(204).end();
  }),
);

const bulkTierRow = z.object({
  pass: z.string().trim().optional(),
  level: z.coerce.number().int().min(1).max(100),
  xp: z.coerce.number().int().min(1).max(10_000_000),
  coins: z.coerce.number().int().min(0).max(100_000).optional(),
  reward: z.string().trim().optional(),
  cosmetic: z.string().trim().optional(),
  duplicateCoins: z.coerce.number().int().min(0).max(100_000).optional(),
  duplicateReward: z.string().trim().optional(),
});

/**
 * Importa degraus em lote (planilha). A coluna "Passe" diz em qual passe cada degrau entra (nome igual ao cadastrado);
 * sem ela, `passId` do corpo vale para todos. Valida linha por linha; com dryRun só mostra a prévia.
 */
passRouter.post(
  "/admin/tiers/bulk",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { rows, dryRun, passId } = z.object({ rows: z.array(z.unknown()).min(1).max(300), dryRun: z.boolean().optional(), passId: z.number().int().positive().optional() }).parse(req.body);
    const [passes, rewards, cosmetics, tiers] = await Promise.all([
      prisma.pass.findMany({ select: { id: true, name: true } }),
      prisma.rewardDefinition.findMany({ select: { id: true, name: true } }),
      prisma.cosmetic.findMany({ select: { id: true, name: true } }),
      prisma.passTier.findMany({ select: { passId: true, level: true } }),
    ]);
    const passByName = new Map(passes.map((pass) => [normalizeKey(pass.name), pass.id]));
    const rewardByName = new Map(rewards.map((reward) => [normalizeKey(reward.name), reward.id]));
    const cosmeticsByName = new Map<string, number[]>();
    for (const cosmetic of cosmetics) cosmeticsByName.set(normalizeKey(cosmetic.name), [...(cosmeticsByName.get(normalizeKey(cosmetic.name)) ?? []), cosmetic.id]);
    const taken = new Set(tiers.map((tier) => `${tier.passId}:${tier.level}`));

    const errors: Array<{ row: number; message: string }> = [];
    const valid: Prisma.PassTierUncheckedCreateInput[] = [];
    rows.forEach((raw, index) => {
      const row = index + 1;
      const parsed = bulkTierRow.safeParse(raw);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        errors.push({ row, message: `${issue.path.join(".") || "linha"}: ${issue.message}` });
        return;
      }
      const data = parsed.data;
      const targetPass = data.pass ? passByName.get(normalizeKey(data.pass)) : passId;
      if (!targetPass) {
        errors.push({ row, message: data.pass ? `passe "${data.pass}" não encontrado` : "informe o passe" });
        return;
      }
      const rewardId = data.reward ? rewardByName.get(normalizeKey(data.reward)) : null;
      if (data.reward && !rewardId) {
        errors.push({ row, message: `recompensa "${data.reward}" não encontrada` });
        return;
      }
      const duplicateRewardId = data.duplicateReward ? rewardByName.get(normalizeKey(data.duplicateReward)) : null;
      if (data.duplicateReward && !duplicateRewardId) {
        errors.push({ row, message: `recompensa "${data.duplicateReward}" (para item repetido) não encontrada` });
        return;
      }
      const matches = data.cosmetic ? (cosmeticsByName.get(normalizeKey(data.cosmetic)) ?? []) : [];
      if (data.cosmetic && matches.length !== 1) {
        errors.push({ row, message: matches.length === 0 ? `item visual "${data.cosmetic}" não encontrado` : `há mais de um item visual chamado "${data.cosmetic}": renomeie um deles` });
        return;
      }
      const coins = data.coins ?? 0;
      if (coins === 0 && !rewardId && matches.length === 0) {
        errors.push({ row, message: "o degrau precisa dar moedas, uma recompensa ou um item visual" });
        return;
      }
      const key = `${targetPass}:${data.level}`;
      if (taken.has(key)) {
        errors.push({ row, message: `já existe o degrau ${data.level} neste passe` });
        return;
      }
      taken.add(key);
      valid.push({
        passId: targetPass,
        level: data.level,
        requiredXp: data.xp,
        rewardCoins: coins,
        rewardDefinitionId: rewardId ?? null,
        rewardCosmeticId: matches[0] ?? null,
        duplicateCoins: data.duplicateCoins ?? null,
        duplicateRewardDefinitionId: duplicateRewardId ?? null,
      });
    });
    if (!dryRun && valid.length > 0) await prisma.passTier.createMany({ data: valid });
    res.json({ valid: valid.length, created: dryRun ? 0 : valid.length, errors });
  }),
);

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

export const eventsRouter = Router();

eventsRouter.get(
  "/active",
  asyncHandler(async (_req, res) => {
    const event = await getActiveEvent();
    const items = event
      ? await prisma.cosmetic.findMany({ where: { eventId: event.id, active: true, unlock: "SHOP" }, orderBy: { sortOrder: "asc" } })
      : [];
    res.json(event ? { ...event, cosmetics: items.map(toCosmeticResponse) } : null);
  }),
);

const eventSchema = z
  .object({
    name: requiredText(80),
    description: clearableText(300),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    // Acima de x2 o evento desequilibra o resto do mês.
    xpMultiplier: z.number().min(1).max(2),
    coinMultiplier: z.number().min(1).max(2),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor no formato #rrggbb")
      .nullish(),
    imageUrl: imageRef(),
    active: z.boolean().optional(),
  })
  .refine((input) => input.endsAt > input.startsAt, { message: "O fim precisa ser depois do início", path: ["endsAt"] });

eventsRouter.get(
  "/admin/list",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { page, size, skip, take } = readPage(req, 10, 50);
    const [items, total] = await Promise.all([
      prisma.gameEvent.findMany({ orderBy: { startsAt: "desc" }, skip, take, include: { _count: { select: { cosmetics: true } } } }),
      prisma.gameEvent.count(),
    ]);
    res.json(pageOf(items.map(({ _count, ...event }) => ({ ...event, cosmetics: _count.cosmetics })), total, page, size));
  }),
);

eventsRouter.post(
  "/admin",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = eventSchema.parse(req.body);
    res.status(201).json(await prisma.gameEvent.create({ data: { ...input, description: input.description ?? null, color: input.color ?? null, imageUrl: input.imageUrl ?? null } }));
  }),
);

eventsRouter.put(
  "/admin/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!(await prisma.gameEvent.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Evento não encontrado");
    const input = eventSchema.parse(req.body);
    res.json(await prisma.gameEvent.update({ where: { id }, data: { ...input, description: input.description ?? null, color: input.color ?? null, imageUrl: input.imageUrl } }));
  }),
);

eventsRouter.delete(
  "/admin/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!(await prisma.gameEvent.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Evento não encontrado");
    await prisma.gameEvent.delete({ where: { id } });
    res.status(204).end();
  }),
);
