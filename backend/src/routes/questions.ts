import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { badRequest, notFound } from "../lib/errors";
import { pageOf, queryText, readPage } from "../lib/pagination";
import { clearableText, optionLetter, parseId, parseIntQuery, requiredText, z } from "../lib/validation";
import { requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { defaultTimeByDifficulty, shuffle, suggestedDifficulty } from "../services/game-rules";
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
    const calibration = queryText(req.query.calibration);
    const reported = queryText(req.query.reported);

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
      ...(reported === "open" ? { reports: { some: { status: "OPEN" } } } : {}),
    };

    // Calibração: perguntas cuja dificuldade não bate com a taxa de acerto (precisa de 20+ respostas).
    if (calibration === "mismatch") {
      const candidates = await prisma.question.findMany({ where: { ...where, timesAnswered: { gte: 20 } }, include, orderBy: { id: "desc" } });
      const mismatched = candidates.filter((question) => {
        const suggested = suggestedDifficulty(question.timesAnswered, question.timesCorrect);
        return suggested !== null && suggested !== question.difficulty;
      });
      res.json(pageOf(mismatched.slice(skip, skip + take).map(toQuestionResponse), mismatched.length, page, size));
      return;
    }

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

// ---------------------------------------------------------------------------
// Importação em lote (planilha CSV convertida no navegador)
// ---------------------------------------------------------------------------

const DIFFICULTY_ALIASES: Record<string, z.infer<typeof difficulty>> = {
  easy: "EASY",
  facil: "EASY",
  medium: "MEDIUM",
  media: "MEDIUM",
  medio: "MEDIUM",
  hard: "HARD",
  dificil: "HARD",
  very_hard: "VERY_HARD",
  "muito dificil": "VERY_HARD",
  muito_dificil: "VERY_HARD",
};

const normalizeKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const bulkRow = z.object({
  text: requiredText(300),
  optionA: requiredText(200),
  optionB: requiredText(200),
  optionC: requiredText(200),
  optionD: requiredText(200),
  correctOption: optionLetter,
  difficulty: z.string().trim().optional(),
  timeLimitSeconds: z.coerce.number().int().min(5).max(120).optional(),
  character: z.string().trim().optional(),
  explanation: z.string().trim().max(2000).optional(),
  bibleReference: z.string().trim().max(200).optional(),
});

const bulkSchema = z.object({ rows: z.array(z.unknown()).min(1).max(500), dryRun: z.boolean().optional() });

/**
 * Valida cada linha separadamente e cria só as válidas. Com dryRun, apenas
 * valida (prévia antes de importar). Linha repetida (mesmo enunciado) é recusada.
 */
questionsRouter.post(
  "/admin/bulk",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { rows, dryRun } = bulkSchema.parse(req.body);
    const characters = await prisma.biblicalCharacter.findMany({ select: { id: true, name: true } });
    const characterByName = new Map(characters.map((character) => [normalizeKey(character.name), character.id]));
    const existing = new Set((await prisma.question.findMany({ select: { text: true } })).map((question) => normalizeKey(question.text)));

    const errors: Array<{ row: number; message: string }> = [];
    const valid: Prisma.QuestionCreateManyInput[] = [];

    rows.forEach((raw, index) => {
      const row = index + 1;
      const parsed = bulkRow.safeParse(raw);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        errors.push({ row, message: `${issue.path.join(".") || "linha"}: ${issue.message}` });
        return;
      }
      const data = parsed.data;
      const level = data.difficulty ? DIFFICULTY_ALIASES[normalizeKey(data.difficulty)] : "EASY";
      if (!level) {
        errors.push({ row, message: `dificuldade "${data.difficulty}" inválida (use Fácil, Média, Difícil ou Muito difícil)` });
        return;
      }
      const options = [data.optionA, data.optionB, data.optionC, data.optionD].map(normalizeKey);
      if (new Set(options).size !== 4) {
        errors.push({ row, message: "as alternativas precisam ser diferentes entre si" });
        return;
      }
      let relatedCharacterId: number | null = null;
      if (data.character) {
        relatedCharacterId = characterByName.get(normalizeKey(data.character)) ?? null;
        if (!relatedCharacterId) {
          errors.push({ row, message: `personagem "${data.character}" não encontrado` });
          return;
        }
      }
      const key = normalizeKey(data.text);
      if (existing.has(key)) {
        errors.push({ row, message: "já existe uma pergunta com este enunciado" });
        return;
      }
      existing.add(key);
      valid.push({
        text: data.text,
        optionA: data.optionA,
        optionB: data.optionB,
        optionC: data.optionC,
        optionD: data.optionD,
        correctOption: data.correctOption,
        difficulty: level,
        timeLimitSeconds: data.timeLimitSeconds ?? defaultTimeByDifficulty(level),
        relatedCharacterId,
        explanation: data.explanation || null,
        bibleReference: data.bibleReference || null,
        active: true,
      });
    });

    if (!dryRun && valid.length > 0) {
      await prisma.question.createMany({ data: valid });
    }
    res.json({ valid: valid.length, created: dryRun ? 0 : valid.length, errors });
  }),
);

/** Aplica a dificuldade sugerida (e o tempo padrão dela) às perguntas indicadas. */
questionsRouter.post(
  "/admin/apply-suggestions",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { ids } = z.object({ ids: z.array(z.number().int().positive()).min(1).max(500) }).parse(req.body);
    const questions = await prisma.question.findMany({ where: { id: { in: ids } } });
    let updated = 0;
    for (const question of questions) {
      const suggested = suggestedDifficulty(question.timesAnswered, question.timesCorrect);
      if (suggested && suggested !== question.difficulty) {
        await prisma.question.update({ where: { id: question.id }, data: { difficulty: suggested, timeLimitSeconds: defaultTimeByDifficulty(suggested) } });
        updated += 1;
      }
    }
    res.json({ updated });
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
