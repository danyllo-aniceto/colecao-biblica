import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { badRequest, notFound } from "../lib/errors";
import { pageOf, queryText, readPage } from "../lib/pagination";
import { clearableText, optionLetter, parseId, parseIntQuery, requiredText, z } from "../lib/validation";
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
  explanation: clearableText(2000),
  bibleReference: clearableText(200),
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
  // null transforma a pergunta em geral (sem personagem).
  relatedCharacterId: z.number().int().positive().nullish(),
  explanation: clearableText(2000),
  bibleReference: clearableText(200),
  active: z.boolean().nullish(),
});

/** As quatro alternativas precisam ser diferentes entre si. */
function ensureDistinctOptions(options: Array<string | undefined>) {
  const filled = options.filter((option): option is string => Boolean(option)).map((option) => option.trim().toLowerCase());
  if (new Set(filled).size !== filled.length) {
    throw badRequest("As alternativas precisam ser diferentes entre si");
  }
}

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

/** Lista paginada com filtros: texto, dificuldade, personagem ("none" = gerais) e status. */
questionsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, size, skip, take } = readPage(req, 10, 100);
    const search = queryText(req.query.search);
    const difficultyFilter = queryText(req.query.difficulty)?.toUpperCase();
    const character = queryText(req.query.characterId);
    const status = queryText(req.query.status);

    const where: Prisma.QuestionWhereInput = {
      ...(search
        ? {
            OR: [
              { text: { contains: search, mode: "insensitive" } },
              { optionA: { contains: search, mode: "insensitive" } },
              { optionB: { contains: search, mode: "insensitive" } },
              { optionC: { contains: search, mode: "insensitive" } },
              { optionD: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(difficultyFilter ? { difficulty: difficulty.parse(difficultyFilter) } : {}),
      ...(character === "none" ? { relatedCharacterId: null } : character ? { relatedCharacterId: parseId(character, "Personagem") } : {}),
      ...(status === "active" ? { active: true } : status === "inactive" ? { active: false } : {}),
    };

    const [questions, total] = await Promise.all([
      prisma.question.findMany({ where, include, orderBy: { id: "desc" }, skip, take }),
      prisma.question.count({ where }),
    ]);
    res.json(pageOf(questions.map(toQuestionResponse), total, page, size));
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
    ensureDistinctOptions([input.optionA, input.optionB, input.optionC, input.optionD]);
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
        explanation: input.explanation ?? null,
        bibleReference: input.bibleReference ?? null,
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
    ensureDistinctOptions([
      input.optionA ?? question.optionA,
      input.optionB ?? question.optionB,
      input.optionC ?? question.optionC,
      input.optionD ?? question.optionD,
    ]);
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
    if (input.relatedCharacterId !== undefined) data.relatedCharacterId = input.relatedCharacterId;
    if (input.explanation !== undefined) data.explanation = input.explanation;
    if (input.bibleReference !== undefined) data.bibleReference = input.bibleReference;
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
