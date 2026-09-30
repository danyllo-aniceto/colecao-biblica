import { Router } from "express";
import type { BiblicalCharacter, UserComment } from "@prisma/client";
import { prisma } from "../db/prisma";
import { notFound } from "../lib/errors";
import { parseId, requiredText, z } from "../lib/validation";
import { currentUser } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";

export const commentsRouter = Router();

const include = { character: { select: { id: true, name: true } } } as const;

function toCommentResponse(comment: UserComment & { character: Pick<BiblicalCharacter, "id" | "name"> }) {
  return {
    id: comment.id,
    characterId: comment.character.id,
    characterName: comment.character.name,
    text: comment.text,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}

const createSchema = z.object({ characterId: z.number().int().positive(), text: requiredText(2000) });
const updateSchema = z.object({ text: requiredText(2000) });

commentsRouter.get(
  "/my",
  asyncHandler(async (req, res) => {
    const comments = await prisma.userComment.findMany({ where: { userId: currentUser(req).id }, include, orderBy: { updatedAt: "desc" } });
    res.json(comments.map(toCommentResponse));
  }),
);

commentsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    const character = await prisma.biblicalCharacter.findUnique({ where: { id: input.characterId }, select: { id: true } });
    if (!character) {
      throw notFound("Personagem não encontrado");
    }
    const comment = await prisma.userComment.create({
      data: { userId: currentUser(req).id, characterId: character.id, text: input.text },
      include,
    });
    res.status(201).json(toCommentResponse(comment));
  }),
);

commentsRouter.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const input = updateSchema.parse(req.body);
    const comment = await prisma.userComment.findFirst({ where: { id, userId: currentUser(req).id } });
    if (!comment) {
      throw notFound("Comentário não encontrado");
    }
    res.json(toCommentResponse(await prisma.userComment.update({ where: { id }, data: { text: input.text }, include })));
  }),
);
