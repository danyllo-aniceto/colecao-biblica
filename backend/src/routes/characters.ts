import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { badRequest, notFound } from "../lib/errors";
import { parseId, requiredText, z } from "../lib/validation";
import { currentUser, requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { toCharacterResponse } from "../services/mappers";

export const charactersRouter = Router();

const rarity = z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY"]);
const freeText = z.string().nullish();

const createSchema = z.object({
  name: requiredText(150),
  imageUrl: z.string().nullish(),
  rarity,
  shortSummary: requiredText(),
  fullDescription: requiredText(),
  bibleBooks: freeText,
  bibleReferences: freeText,
  historicalPeriod: freeText,
  narrativeRole: freeText,
  genealogy: freeText,
  curiosities: freeText,
  importantEvents: freeText,
  keyVerses: freeText,
  keywords: freeText,
});

const updateSchema = createSchema.partial().extend({
  name: requiredText(150).optional(),
  imageUrl: z.string().min(1).optional(),
  shortSummary: requiredText().optional(),
  fullDescription: requiredText().optional(),
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

/** Campos opcionais: `null`/ausente não altera (mesma regra da API antiga). */
function definedOnly<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined && value !== null)) as Partial<T>;
}

charactersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const characters = await prisma.biblicalCharacter.findMany({ orderBy: { id: "asc" } });
    res.json(characters.map(toCharacterResponse));
  }),
);

charactersRouter.get(
  "/:id",
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
      data: { ...input, createdBy: currentUser(req).email } as Prisma.BiblicalCharacterCreateInput,
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
      data: definedOnly(input) as Prisma.BiblicalCharacterUpdateInput,
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
