import { Router } from "express";
import { prisma } from "../db/prisma";
import { badRequest, notFound } from "../lib/errors";
import { pageOf, readPage } from "../lib/pagination";
import { clearableText, imageRef, parseId, requiredText, z } from "../lib/validation";
import { requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";

/** Painel da campanha: cenários e paradas. */
export const campaignAdminRouter = Router();
campaignAdminRouter.use(requireAdmin);

const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use uma cor no formato #rrggbb")
  .nullish();

const scenarioSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,40}$/, "Use letras minúsculas, números e hífen (2 a 40)"),
  name: requiredText(80),
  description: clearableText(300),
  verse: clearableText(300),
  verseReference: clearableText(60),
  color,
  mapImageUrl: imageRef(),
  iconImageUrl: imageRef(),
  fragmentCharacterId: z.number().int().positive().nullish(),
  sortOrder: z.number().int().min(0).max(100_000),
  active: z.boolean(),
});

const nodeSchema = z.object({
  level: z.number().int().min(1).max(1000),
  title: clearableText(80),
  relic: z.boolean(),
  fragment: z.boolean(),
  rewardCoins: z.number().int().min(0).max(100_000),
  rewardDefinitionId: z.number().int().positive().nullish(),
  rewardCosmeticId: z.number().int().positive().nullish(),
  posX: z.number().int().min(0).max(100).nullish(),
  posY: z.number().int().min(0).max(100).nullish(),
});

const nodeInclude = {
  rewardDefinition: { select: { id: true, name: true, rewardType: true } },
  rewardCosmetic: { select: { id: true, name: true, type: true, rarity: true } },
} as const;

async function ensureCharacter(id?: number | null) {
  if (!id) return;
  const character = await prisma.biblicalCharacter.findUnique({ where: { id }, select: { rarity: true } });
  if (!character) throw notFound("Personagem não encontrado");
  if (character.rarity !== "SPECIAL") throw badRequest("Só uma figurinha de raridade Especial pode ser entregue por fragmentos");
}

campaignAdminRouter.get(
  "/scenarios",
  asyncHandler(async (req, res) => {
    const { page, size, skip, take } = readPage(req, 10, 50);
    const [items, total] = await Promise.all([
      prisma.scenario.findMany({
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        skip,
        take,
        include: { fragmentCharacter: { select: { id: true, name: true } }, _count: { select: { nodes: true } } },
      }),
      prisma.scenario.count(),
    ]);
    res.json(pageOf(items.map(({ _count, ...scenario }) => ({ ...scenario, nodeCount: _count.nodes })), total, page, size));
  }),
);

campaignAdminRouter.post(
  "/scenarios",
  asyncHandler(async (req, res) => {
    const input = scenarioSchema.parse(req.body);
    if (await prisma.scenario.findUnique({ where: { slug: input.slug }, select: { id: true } })) throw badRequest("Já existe um cenário com esse identificador");
    await ensureCharacter(input.fragmentCharacterId);
    const scenario = await prisma.scenario.create({
      data: {
        ...input,
        description: input.description ?? null,
        verse: input.verse ?? null,
        verseReference: input.verseReference ?? null,
        color: input.color ?? null,
        mapImageUrl: input.mapImageUrl ?? null,
        iconImageUrl: input.iconImageUrl ?? null,
        fragmentCharacterId: input.fragmentCharacterId ?? null,
      },
    });
    res.status(201).json(scenario);
  }),
);

// Em atualizações o identificador não muda (as imagens padrão usam o slug).
const scenarioUpdateSchema = scenarioSchema.omit({ slug: true });

campaignAdminRouter.put(
  "/scenarios/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!(await prisma.scenario.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Cenário não encontrado");
    const input = scenarioUpdateSchema.parse(req.body);
    await ensureCharacter(input.fragmentCharacterId);
    const scenario = await prisma.scenario.update({
      where: { id },
      data: {
        ...input,
        color: input.color ?? null,
        fragmentCharacterId: input.fragmentCharacterId ?? null,
        // Ausente mantém a imagem; vazio limpa (volta para a padrão).
        mapImageUrl: input.mapImageUrl,
        iconImageUrl: input.iconImageUrl,
      },
    });
    res.json(scenario);
  }),
);

campaignAdminRouter.delete(
  "/scenarios/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const scenario = await prisma.scenario.findUnique({ where: { id }, select: { system: true } });
    if (!scenario) throw notFound("Cenário não encontrado");
    if (scenario.system) throw badRequest("Cenários do sistema não podem ser excluídos; desative-o");
    await prisma.scenario.delete({ where: { id } });
    res.status(204).end();
  }),
);

campaignAdminRouter.get(
  "/scenarios/:id/nodes",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!(await prisma.scenario.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Cenário não encontrado");
    const { page, size, skip, take } = readPage(req, 10, 50);
    const [items, total] = await Promise.all([
      prisma.scenarioNode.findMany({ where: { scenarioId: id }, orderBy: { level: "asc" }, skip, take, include: nodeInclude }),
      prisma.scenarioNode.count({ where: { scenarioId: id } }),
    ]);
    res.json(pageOf(items, total, page, size));
  }),
);

async function saveNode(scenarioId: number, nodeId: number | null, body: unknown) {
  const input = nodeSchema.parse(body);
  const scenario = await prisma.scenario.findUnique({ where: { id: scenarioId }, select: { fragmentCharacterId: true } });
  if (!scenario) throw notFound("Cenário não encontrado");
  if (input.fragment && !scenario.fragmentCharacterId) throw badRequest("Escolha a figurinha especial do cenário antes de criar um fragmento");
  if (input.rewardCoins === 0 && !input.rewardDefinitionId && !input.rewardCosmeticId && !input.fragment) throw badRequest("A parada precisa dar alguma coisa");
  if (input.rewardCosmeticId && !(await prisma.cosmetic.findUnique({ where: { id: input.rewardCosmeticId }, select: { id: true } }))) throw notFound("Item visual não encontrado");
  if (input.rewardDefinitionId && !(await prisma.rewardDefinition.findUnique({ where: { id: input.rewardDefinitionId }, select: { id: true } }))) throw notFound("Recompensa não encontrada");
  const sameLevel = await prisma.scenarioNode.findFirst({ where: { level: input.level, ...(nodeId ? { id: { not: nodeId } } : {}) }, select: { scenario: { select: { name: true } } } });
  if (sameLevel) throw badRequest(`O nível ${input.level} já tem uma parada em ${sameLevel.scenario.name}`);
  const data = {
    ...input,
    title: input.title ?? null,
    rewardDefinitionId: input.rewardDefinitionId ?? null,
    rewardCosmeticId: input.rewardCosmeticId ?? null,
    posX: input.posX ?? null,
    posY: input.posY ?? null,
  };
  return nodeId ? prisma.scenarioNode.update({ where: { id: nodeId }, data, include: nodeInclude }) : prisma.scenarioNode.create({ data: { ...data, scenarioId }, include: nodeInclude });
}

campaignAdminRouter.post(
  "/scenarios/:id/nodes",
  asyncHandler(async (req, res) => {
    res.status(201).json(await saveNode(parseId(req.params.id), null, req.body));
  }),
);

campaignAdminRouter.put(
  "/nodes/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const node = await prisma.scenarioNode.findUnique({ where: { id }, select: { scenarioId: true } });
    if (!node) throw notFound("Parada não encontrada");
    res.json(await saveNode(node.scenarioId, id, req.body));
  }),
);

campaignAdminRouter.delete(
  "/nodes/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!(await prisma.scenarioNode.findUnique({ where: { id }, select: { id: true } }))) throw notFound("Parada não encontrada");
    await prisma.scenarioNode.delete({ where: { id } });
    res.status(204).end();
  }),
);
