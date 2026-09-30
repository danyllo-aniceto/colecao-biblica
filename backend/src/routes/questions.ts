import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { notFound } from "../lib/errors";
import { optionLetter, parseId, parseIntQuery, requiredText, z } from "../lib/validation";
import { requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { defaultTimeByDifficulty, shuffle } from "../services/game-rules";
import { characterRef, toQuestionResponse } from "../services/mappers";

export const questionsRouter = Router();

const include = { relatedCharacter: characterRef } as const;
const difficulty = z.enum(["EASY", "MEDIUM", "HARD", "VERY_HARD"]);
const timeLimit = z.number().int().min(5).max(120);

const createSchema = z.object({
  text: requiredText(),
  difficulty,
  timeLimitSeconds: timeLimit.nullish(),
  optionA: requiredText(),
  optionB: requiredText(),
  optionC: requiredText(),
  optionD: requiredText(),
  correctOption: optionLetter,
  relatedCharacterId: z.number().int().positive().nullish(),
  active: z.boolean().nullish(),
});

const updateSchema = z.object({
  text: requiredText().optional(),
  difficulty: difficulty.optional(),
  timeLimitSeconds: timeLimit.nullish(),
  optionA: requiredText().optional(),
  optionB: requiredText().optional(),
  optionC: requiredText().optional(),
  optionD: requiredText().optional(),
  correctOption: optionLetter.nullish(),
  relatedCharacterId: z.number().int().positive().nullish(),
  active: z.boolean().nullish(),
});

async function ensureCharacter(id: number) {
  const character = await prisma.biblicalCharacter.findUnique({ where: { id }, select: { id: true } });
  if (!character) {
    throw notFound("Personagem não encontrado");
  }
}

async function getQuestion(id: number) {
  const question = await prisma.question.findUnique({ where: { id }, include });
  if (!question) {
    throw notFound("Pergunta não encontrada");
  }
  return question;
}

async function randomQuestions(where: Prisma.QuestionWhereInput, requestedLimit: number) {
  const questions = await prisma.question.findMany({ where, include });
  return shuffle(questions).slice(0, Math.max(requestedLimit, 1)).map(toQuestionResponse);
}

questionsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const questions = await prisma.question.findMany({ include, orderBy: { id: "asc" } });
    res.json(questions.map(toQuestionResponse));
  }),
);

questionsRouter.get(
  "/general/random",
  asyncHandler(async (req, res) => {
    res.json(await randomQuestions({ active: true }, parseIntQuery(req.query.limit, 10)));
  }),
);

questionsRouter.get(
  "/characters/:characterId/random",
  asyncHandler(async (req, res) => {
    const characterId = parseId(req.params.characterId);
    await ensureCharacter(characterId);
    res.json(await randomQuestions({ active: true, relatedCharacterId: characterId }, parseIntQuery(req.query.limit, 10)));
  }),
);

questionsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(toQuestionResponse(await getQuestion(parseId(req.params.id))));
  }),
);

questionsRouter.post(
  "/admin",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    if (input.relatedCharacterId) {
      await ensureCharacter(input.relatedCharacterId);
    }
    const question = await prisma.question.create({
      data: {
        text: input.text,
        difficulty: input.difficulty,
        timeLimitSeconds: input.timeLimitSeconds ?? defaultTimeByDifficulty(input.difficulty),
        optionA: input.optionA,
        optionB: input.optionB,
        optionC: input.optionC,
        optionD: input.optionD,
        correctOption: input.correctOption,
        relatedCharacterId: input.relatedCharacterId ?? null,
        active: input.active ?? true,
      },
      include,
    });
    res.status(201).json(toQuestionResponse(question));
  }),
);

questionsRouter.put(
  "/admin/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const question = await getQuestion(parseId(req.params.id));
    const input = updateSchema.parse(req.body);
    if (input.relatedCharacterId) {
      await ensureCharacter(input.relatedCharacterId);
    }

    const data: Prisma.QuestionUncheckedUpdateInput = {};
    if (input.text !== undefined) data.text = input.text;
    if (input.difficulty !== undefined) data.difficulty = input.difficulty;
    if (input.timeLimitSeconds != null) data.timeLimitSeconds = input.timeLimitSeconds;
    if (input.optionA !== undefined) data.optionA = input.optionA;
    if (input.optionB !== undefined) data.optionB = input.optionB;
    if (input.optionC !== undefined) data.optionC = input.optionC;
    if (input.optionD !== undefined) data.optionD = input.optionD;
    if (input.correctOption != null) data.correctOption = input.correctOption;
    if (input.relatedCharacterId != null) data.relatedCharacterId = input.relatedCharacterId;
    if (input.active != null) data.active = input.active;

    res.json(toQuestionResponse(await prisma.question.update({ where: { id: question.id }, data, include })));
  }),
);

questionsRouter.delete(
  "/admin/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const question = await getQuestion(parseId(req.params.id));
    await prisma.question.delete({ where: { id: question.id } });
    res.status(204).end();
  }),
);
