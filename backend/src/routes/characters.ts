import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { pageOf, queryText, readPage } from "../lib/pagination";
import { clearableText, imageRef, parseId, requiredText, richText, z } from "../lib/validation";
import { currentUser, requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { toCharacterResponse, toCharacterSummary } from "../services/mappers";
import { isCharacterVisible, scheduledCharacter, visibleCharacter } from "../services/visibility";

export const charactersRouter = Router();

const rarity = z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY", "SPECIAL"]);
const testament = z.enum(["OLD", "NEW"]);

// Campos opcionais: ausente não altera; null ou vazio limpa.
const optionalFields = {
  imageUrl: imageRef(),
  testament: testament.nullish(),
  bibleBooks: clearableText(),
  bibleReferences: clearableText(),
  historicalPeriod: clearableText(200),
  narrativeRole: clearableText(200),
  genealogy: clearableText(),
  curiosities: clearableText(),
  importantEvents: clearableText(),
  keyVerses: clearableText(1000),
  keywords: clearableText(1000),
  // Publicação agendada (ISO 8601). null tira o agendamento.
  publishAt: z
    .string()
    .datetime({ offset: true })
    .nullish()
    .transform((value) => (value === undefined ? undefined : value === null ? null : new Date(value))),
};

const createSchema = z.object({
  name: requiredText(150),
  rarity,
  published: z.boolean().optional(),
  shortSummary: richText(),
  fullDescription: richText(),
  ...optionalFields,
});

const updateSchema = z.object({
  name: requiredText(150).optional(),
  rarity: rarity.optional(),
  published: z.boolean().optional(),
  shortSummary: richText().optional(),
  fullDescription: richText().optional(),
  ...optionalFields,
});

async function ensureNameAvailable(name: string, exceptId?: number) {
  const existing = await prisma.biblicalCharacter.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (existing) {
    throw badRequest("Já existe um personagem com esse nome");
  }
}

async function getCharacter(id: number) {
  const character = await prisma.biblicalCharacter.findUnique({ where: { id } });
  if (!character) {
    throw notFound("Personagem não encontrado");
  }
  return character;
}

/** Remove só os campos ausentes (undefined); null significa "limpar". */
function withoutUndefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>;
}

/** Quantidade de perguntas ativas por personagem. */
async function activeQuestionCounts(characterIds?: number[]) {
  const groups = await prisma.question.groupBy({
    by: ["relatedCharacterId"],
    where: { active: true, relatedCharacterId: characterIds ? { in: characterIds } : { not: null } },
    _count: { _all: true },
  });
  return new Map(groups.map((group) => [group.relatedCharacterId, group._count._all]));
}

// ---------------------------------------------------------------------------
// Admin (antes de "/:id" para não colidir)
// ---------------------------------------------------------------------------

/** Lista paginada do painel, com filtros e contagem de perguntas. */
charactersRouter.get(
  "/admin/list",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { page, size, skip, take } = readPage(req, 10, 100);
    const search = queryText(req.query.search);
    const rarityFilter = queryText(req.query.rarity)?.toUpperCase();
    const status = queryText(req.query.status);
    const issue = queryText(req.query.issue);

    const where: Prisma.BiblicalCharacterWhereInput = {
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      ...(rarityFilter ? { rarity: rarity.parse(rarityFilter) } : {}),
      ...(status === "published"
        ? visibleCharacter()
        : status === "draft"
          ? { published: false }
          : status === "scheduled"
            ? scheduledCharacter()
            : {}),
      ...(issue === "noImage" ? { OR: [{ imageUrl: null }, { imageUrl: "" }] } : {}),
      ...(issue === "noQuestions" ? { questions: { none: { active: true } } } : {}),
    };

    const [characters, total] = await Promise.all([
      prisma.biblicalCharacter.findMany({ where, orderBy: [{ name: "asc" }, { id: "asc" }], skip, take }),
      prisma.biblicalCharacter.count({ where }),
    ]);
    const counts = await activeQuestionCounts(characters.map((character) => character.id));
    res.json(pageOf(characters.map((character) => toCharacterSummary(character, counts.get(character.id) ?? 0)), total, page, size));
  }),
);

/** Todos os personagens (id, nome, raridade) para os seletores do painel. */
charactersRouter.get(
  "/admin/options",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const characters = await prisma.biblicalCharacter.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, rarity: true, published: true },
    });
    res.json(characters);
  }),
);

charactersRouter.get(
  "/admin/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(toCharacterResponse(await getCharacter(parseId(req.params.id))));
  }),
);

charactersRouter.post(
  "/admin",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    await ensureNameAvailable(input.name);
    const character = await prisma.biblicalCharacter.create({
      data: { ...withoutUndefined(input), createdBy: currentUser(req).email } as Prisma.BiblicalCharacterCreateInput,
    });
    res.status(201).json(toCharacterResponse(character));
  }),
);

charactersRouter.put(
  "/admin/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const character = await getCharacter(parseId(req.params.id));
    const input = updateSchema.parse(req.body);
    if (input.name && input.name.toLowerCase() !== character.name.toLowerCase()) {
      await ensureNameAvailable(input.name, character.id);
    }
    const updated = await prisma.biblicalCharacter.update({
      where: { id: character.id },
      data: withoutUndefined(input) as Prisma.BiblicalCharacterUpdateInput,
    });
    res.json(toCharacterResponse(updated));
  }),
);

charactersRouter.delete(
  "/admin/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const character = await getCharacter(parseId(req.params.id));
    // Perguntas do personagem passam a ser gerais; figurinhas e anotações dele são removidas.
    await prisma.biblicalCharacter.delete({ where: { id: character.id } });
    res.status(204).end();
  }),
);

// ---------------------------------------------------------------------------
// Jogador
// ---------------------------------------------------------------------------

/** Álbum: só os publicados, em versão leve (os textos longos vêm no detalhe). */
charactersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const characters = await prisma.biblicalCharacter.findMany({ where: visibleCharacter(), orderBy: [{ name: "asc" }, { id: "asc" }] });
    const counts = await activeQuestionCounts();
    res.json(characters.map((character) => toCharacterSummary(character, counts.get(character.id) ?? 0)));
  }),
);

/** Figurinhas agendadas ("em breve"): só raridade e data, sem revelar quem é. */
charactersRouter.get(
  "/upcoming",
  asyncHandler(async (_req, res) => {
    const upcoming = await prisma.biblicalCharacter.findMany({
      where: scheduledCharacter(),
      orderBy: { publishAt: "asc" },
      take: 6,
      select: { rarity: true, publishAt: true, testament: true },
    });
    res.json(upcoming);
  }),
);

charactersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const character = await getCharacter(parseId(req.params.id));
    const user = currentUser(req);
    if (user.role !== "ADMIN") {
      // Rascunhos só aparecem para o admin.
      if (!isCharacterVisible(character)) throw notFound("Personagem não encontrado");
      // A ficha completa é o prêmio: só quem conquistou a figurinha pode abrir.
      const owned = await prisma.userSticker.findUnique({ where: { userId_characterId: { userId: user.id, characterId: character.id } }, select: { id: true } });
      if (!owned) throw forbidden("Conquiste esta figurinha para ver os detalhes");
    }
    res.json(toCharacterResponse(character));
  }),
);
