import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { badRequest, notFound } from "../lib/errors";
import { pageOf, queryText, readPage } from "../lib/pagination";
import { clearableText, imageRef, normalizeKey, parseId, requiredText, z } from "../lib/validation";
import { currentUser, requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import {
  FRAME_STYLES,
  REACTION_ANIMATIONS,
  REQUIREMENTS,
  TITLE_STYLES,
  buyCosmetic,
  equipCosmetic,
  getInventory,
  getProfile,
  grantCosmetic,
  requirementByCode,
  setShowcase,
  toCosmeticResponse,
} from "../services/cosmetics";

export const cosmeticsRouter = Router();

const cosmeticType = z.enum(["AVATAR", "FRAME", "TITLE", "NAME_COLOR", "REACTION"]);
const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor no formato #rrggbb")
  .nullish();

// ---------------------------------------------------------------------------
// Jogador
// ---------------------------------------------------------------------------

cosmeticsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await getInventory(currentUser(req).id));
  }),
);

cosmeticsRouter.post(
  "/:id/buy",
  asyncHandler(async (req, res) => {
    res.json(await buyCosmetic(currentUser(req).id, parseId(req.params.id)));
  }),
);

const equipSchema = z.object({ type: cosmeticType, cosmeticId: z.number().int().positive().nullable() });

cosmeticsRouter.put(
  "/equip",
  asyncHandler(async (req, res) => {
    const input = equipSchema.parse(req.body);
    res.json(await equipCosmetic(currentUser(req).id, input.type, input.cosmeticId));
  }),
);

cosmeticsRouter.put(
  "/showcase",
  asyncHandler(async (req, res) => {
    const input = z.object({ characterIds: z.array(z.number().int().positive()).max(3) }).parse(req.body);
    res.json(await setShowcase(currentUser(req).id, input.characterIds));
  }),
);

cosmeticsRouter.get(
  "/profile/:userId",
  asyncHandler(async (req, res) => {
    res.json(await getProfile(parseId(req.params.userId)));
  }),
);

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

cosmeticsRouter.get(
  "/admin/requirements",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json({
      requirements: REQUIREMENTS.map(({ code, label, needsValue }) => ({ code, label, needsValue })),
      titleStyles: TITLE_STYLES,
      frameStyles: FRAME_STYLES,
      reactionAnimations: REACTION_ANIMATIONS,
    });
  }),
);

cosmeticsRouter.get(
  "/admin/list",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { page, size, skip, take } = readPage(req, 20, 100);
    const type = cosmeticType.safeParse(req.query.type);
    const search = queryText(req.query.search);
    const where: Prisma.CosmeticWhereInput = {
      ...(type.success ? { type: type.data } : {}),
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.cosmetic.findMany({
        where,
        orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
        skip,
        take,
        include: { _count: { select: { owners: true } }, event: { select: { name: true } } },
      }),
      prisma.cosmetic.count({ where }),
    ]);
    res.json(
      pageOf(
        items.map((item) => ({ ...toCosmeticResponse(item), owners: item._count.owners, eventName: item.event?.name ?? null })),
        total,
        page,
        size,
      ),
    );
  }),
);

const baseSchema = {
  name: requiredText(60),
  description: clearableText(200),
  rarity: z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY", "SPECIAL"]).optional(),
  imageUrl: imageRef(),
  color,
  style: clearableText(20),
  animation: clearableText(20),
  pack: clearableText(40),
  unlock: z.enum(["FREE", "SHOP", "REQUIREMENT", "REWARD"]),
  priceCoins: z.number().int().min(0).max(1_000_000).nullish(),
  requirement: clearableText(40),
  requirementValue: z.number().int().min(1).max(1_000_000).nullish(),
  inChestPool: z.boolean().optional(),
  eventId: z.number().int().positive().nullish(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
};

const createSchema = z.object({ type: cosmeticType, ...baseSchema });
const updateSchema = z.object(baseSchema).partial();

type CosmeticInput = z.infer<typeof updateSchema> & { type?: z.infer<typeof cosmeticType> };

/** Regras de cada tipo/forma de obter, para o item nunca ficar impossível de usar ou ganhar. */
async function validate(type: z.infer<typeof cosmeticType>, input: CosmeticInput) {
  if ((type === "AVATAR" || type === "REACTION") && !input.imageUrl && !(type === "REACTION" && input.style)) {
    throw badRequest(type === "AVATAR" ? "O ícone precisa de uma imagem" : "A reação precisa de uma imagem ou de um emoji");
  }
  if ((type === "TITLE" || type === "NAME_COLOR") && !input.color) {
    throw badRequest("Escolha a cor");
  }
  if (type === "TITLE" && input.style && !(TITLE_STYLES as readonly string[]).includes(input.style)) throw badRequest("Efeito de título inválido");
  if (type === "REACTION" && input.animation && !(REACTION_ANIMATIONS as readonly string[]).includes(input.animation)) throw badRequest("Animação de reação inválida");
  if (type === "FRAME" && input.style && !(FRAME_STYLES as readonly string[]).includes(input.style)) throw badRequest("Estilo de moldura inválido");
  if (input.unlock === "SHOP" && (input.priceCoins === null || input.priceCoins === undefined)) throw badRequest("Informe o preço em moedas");
  if (input.unlock === "REQUIREMENT") {
    const requirement = requirementByCode(input.requirement ?? null);
    if (!requirement) throw badRequest("Escolha a meta que libera o item");
    if (requirement.needsValue && !input.requirementValue) throw badRequest("Informe o número da meta");
  }
  if (input.eventId) {
    const event = await prisma.gameEvent.findUnique({ where: { id: input.eventId }, select: { id: true } });
    if (!event) throw notFound("Evento não encontrado");
  }
}

async function ensureNameAvailable(type: string, name: string, exceptId?: number) {
  const existing = await prisma.cosmetic.findFirst({
    where: { type: type as never, name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (existing) throw badRequest("Já existe um item desse tipo com esse nome");
}

/** Campos que não fazem sentido para a forma de obter escolhida ficam vazios. */
function normalize(input: CosmeticInput) {
  return {
    ...input,
    priceCoins: input.unlock === undefined ? input.priceCoins : input.unlock === "SHOP" ? input.priceCoins : null,
    requirement: input.unlock === undefined ? input.requirement : input.unlock === "REQUIREMENT" ? input.requirement : null,
    requirementValue: input.unlock === undefined ? input.requirementValue : input.unlock === "REQUIREMENT" ? (input.requirementValue ?? null) : null,
  };
}

cosmeticsRouter.post(
  "/admin",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    await validate(input.type, input);
    await ensureNameAvailable(input.type, input.name);
    const created = await prisma.cosmetic.create({ data: { ...normalize(input), type: input.type, system: false } as Prisma.CosmeticUncheckedCreateInput });
    res.status(201).json(toCosmeticResponse(created));
  }),
);

cosmeticsRouter.put(
  "/admin/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const current = await prisma.cosmetic.findUnique({ where: { id } });
    if (!current) throw notFound("Item não encontrado");
    const input = updateSchema.parse(req.body);
    const merged = { ...current, ...Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) } as CosmeticInput;
    await validate(current.type, merged);
    if (input.name && input.name !== current.name) await ensureNameAvailable(current.type, input.name, id);
    const updated = await prisma.cosmetic.update({ where: { id }, data: normalize({ ...input, unlock: input.unlock ?? undefined }) as Prisma.CosmeticUncheckedUpdateInput });
    res.json(toCosmeticResponse(updated));
  }),
);

cosmeticsRouter.delete(
  "/admin/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const current = await prisma.cosmetic.findUnique({ where: { id } });
    if (!current) throw notFound("Item não encontrado");
    if (current.system) throw badRequest("Itens padrão não podem ser excluídos. Você pode desativá-los.");
    await prisma.cosmetic.delete({ where: { id } });
    res.status(204).end();
  }),
);

/** Admin dá o item para um jogador (eventos, premiações). */
cosmeticsRouter.post(
  "/admin/:id/grant",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const { userId } = z.object({ userId: z.number().int().positive() }).parse(req.body);
    const [cosmetic, user] = await Promise.all([
      prisma.cosmetic.findUnique({ where: { id }, select: { id: true } }),
      prisma.user.findFirst({ where: { id: userId, deleted: false }, select: { id: true, name: true } }),
    ]);
    if (!cosmetic) throw notFound("Item não encontrado");
    if (!user) throw notFound("Jogador não encontrado");
    const granted = await grantCosmetic(prisma, userId, id, "ADMIN");
    if (!granted) throw badRequest(`${user.name} já tem este item`);
    res.json({ granted: true });
  }),
);

// ---------------------------------------------------------------------------
// Importação de reações em lote (planilha)
// ---------------------------------------------------------------------------

const RARITY_ALIASES: Record<string, "COMMON" | "RARE" | "EPIC" | "LEGENDARY"> = {
  comum: "COMMON",
  common: "COMMON",
  rara: "RARE",
  rare: "RARE",
  epica: "EPIC",
  epic: "EPIC",
  lendaria: "LEGENDARY",
  legendary: "LEGENDARY",
};

const ANIMATION_ALIASES: Record<string, (typeof REACTION_ANIMATIONS)[number]> = {
  pulo: "pop",
  pop: "pop",
  quicar: "bounce",
  bounce: "bounce",
  tremer: "shake",
  shake: "shake",
  girar: "spin",
  spin: "spin",
  subir: "rise",
  rise: "rise",
  pulsar: "pulse",
  pulse: "pulse",
};

const bulkReactionRow = z.object({
  name: requiredText(60),
  emoji: z.string().trim().max(20).optional(),
  imageUrl: z.string().trim().max(2048).optional(),
  rarity: z.string().trim().optional(),
  animation: z.string().trim().optional(),
  pack: z.string().trim().max(40).optional(),
  price: z.coerce.number().int().min(0).max(1_000_000).optional(),
  description: z.string().trim().max(200).optional(),
});

const bulkReactionsSchema = z.object({ rows: z.array(z.unknown()).min(1).max(300), dryRun: z.boolean().optional() });

/**
 * Cria várias reações de uma vez. Com preço, a reação vai para a loja; sem preço, fica como prêmio (passe, baú, admin).
 * Valida linha por linha; com dryRun só mostra a prévia.
 */
cosmeticsRouter.post(
  "/admin/bulk-reactions",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { rows, dryRun } = bulkReactionsSchema.parse(req.body);
    const existing = new Set((await prisma.cosmetic.findMany({ where: { type: "REACTION" }, select: { name: true } })).map((item) => normalizeKey(item.name)));
    const errors: Array<{ row: number; message: string }> = [];
    const valid: Prisma.CosmeticCreateManyInput[] = [];

    rows.forEach((raw, index) => {
      const row = index + 1;
      const parsed = bulkReactionRow.safeParse(raw);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        errors.push({ row, message: `${issue.path.join(".") || "linha"}: ${issue.message}` });
        return;
      }
      const data = parsed.data;
      if (!data.emoji && !data.imageUrl) {
        errors.push({ row, message: "informe um emoji ou o link de uma imagem" });
        return;
      }
      if (data.imageUrl && !/^(https?:\/\/|\/api\/uploads\/file\/|\/)/.test(data.imageUrl)) {
        errors.push({ row, message: "o link da imagem precisa começar com http(s)://" });
        return;
      }
      const rarity = data.rarity ? RARITY_ALIASES[normalizeKey(data.rarity)] : "COMMON";
      if (!rarity) {
        errors.push({ row, message: `raridade "${data.rarity}" inválida (Comum, Rara, Épica ou Lendária)` });
        return;
      }
      const animation = data.animation ? ANIMATION_ALIASES[normalizeKey(data.animation)] : "pop";
      if (!animation) {
        errors.push({ row, message: `animação "${data.animation}" inválida (Pulo, Quicar, Tremer, Girar, Subir ou Pulsar)` });
        return;
      }
      const key = normalizeKey(data.name);
      if (existing.has(key)) {
        errors.push({ row, message: "já existe uma reação com este nome" });
        return;
      }
      existing.add(key);
      const forSale = data.price !== undefined;
      valid.push({
        type: "REACTION",
        name: data.name,
        description: data.description || null,
        rarity,
        imageUrl: data.imageUrl || null,
        style: data.emoji || null,
        animation,
        pack: data.pack || null,
        unlock: forSale ? "SHOP" : "REWARD",
        priceCoins: forSale ? data.price : null,
        active: true,
      });
    });

    if (!dryRun && valid.length > 0) await prisma.cosmetic.createMany({ data: valid });
    res.json({ valid: valid.length, created: dryRun ? 0 : valid.length, errors });
  }),
);
