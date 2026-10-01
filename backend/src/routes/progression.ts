import { Router } from "express";
import { prisma } from "../db/prisma";
import { badRequest, notFound } from "../lib/errors";
import { pageOf, readPage } from "../lib/pagination";
import { clearableText, imageRef, parseId, requiredText, z } from "../lib/validation";
import { currentUser, requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { toCosmeticResponse } from "../services/cosmetics";
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

const tierSchema = z.object({
  level: z.number().int().min(1).max(100),
  requiredXp: z.number().int().min(1).max(10_000_000),
  rewardCoins: z.number().int().min(0).max(100_000),
  rewardDefinitionId: z.number().int().positive().nullish(),
  rewardCosmeticId: cosmeticRef,
  active: z.boolean().optional(),
});

passRouter.get(
  "/admin/tiers",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const tiers = await prisma.passTier.findMany({
      orderBy: { level: "asc" },
      include: { rewardDefinition: { select: { id: true, name: true } }, rewardCosmetic: { select: { id: true, name: true, type: true } } },
    });
    res.json(tiers);
  }),
);

async function saveTier(id: number | null, body: unknown) {
  const input = tierSchema.parse(body);
  if (input.rewardCoins === 0 && !input.rewardDefinitionId && !input.rewardCosmeticId) throw badRequest("O degrau precisa dar alguma coisa");
  await ensureCosmetic(input.rewardCosmeticId);
  if (input.rewardDefinitionId) {
    const reward = await prisma.rewardDefinition.findUnique({ where: { id: input.rewardDefinitionId }, select: { rewardType: true } });
    if (!reward) throw notFound("Recompensa não encontrada");
  }
  const sameLevel = await prisma.passTier.findFirst({ where: { level: input.level, ...(id ? { id: { not: id } } : {}) }, select: { id: true } });
  if (sameLevel) throw badRequest(`Já existe o degrau ${input.level}`);
  const data = { ...input, rewardDefinitionId: input.rewardDefinitionId ?? null, rewardCosmeticId: input.rewardCosmeticId ?? null, active: input.active ?? true };
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
