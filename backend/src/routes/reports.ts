import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { badRequest, notFound } from "../lib/errors";
import { pageOf, queryText, readPage } from "../lib/pagination";
import { parseId, z } from "../lib/validation";
import { currentUser, requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";

export const reportsRouter = Router();

export const REPORT_REASONS = ["WRONG_ANSWER", "TYPO", "CONFUSING", "OTHER"] as const;

const createSchema = z.object({
  questionId: z.number().int().positive(),
  reason: z.enum(REPORT_REASONS),
  message: z.string().trim().max(500).nullish(),
});

/** Jogador marca uma pergunta como errada/confusa (um reporte aberto por pergunta). */
reportsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    const userId = currentUser(req).id;
    const question = await prisma.question.findUnique({ where: { id: input.questionId }, select: { id: true } });
    if (!question) {
      throw notFound("Pergunta não encontrada");
    }
    const open = await prisma.questionReport.findFirst({ where: { questionId: question.id, userId, status: "OPEN" } });
    if (open) {
      throw badRequest("Você já reportou esta pergunta. Obrigado!");
    }
    await prisma.questionReport.create({ data: { questionId: question.id, userId, reason: input.reason, message: input.message || null } });
    res.status(201).json({ ok: true });
  }),
);

reportsRouter.get(
  "/admin",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { page, size, skip, take } = readPage(req, 10, 100);
    const status = queryText(req.query.status)?.toUpperCase() ?? "OPEN";
    const where: Prisma.QuestionReportWhereInput = status === "ALL" ? {} : { status: z.enum(["OPEN", "RESOLVED", "DISMISSED"]).parse(status) };
    const [reports, total] = await Promise.all([
      prisma.questionReport.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        include: {
          user: { select: { name: true } },
          question: { select: { id: true, text: true, correctOption: true, active: true, timesAnswered: true, timesCorrect: true, _count: { select: { reports: true } } } },
        },
      }),
      prisma.questionReport.count({ where }),
    ]);
    res.json(
      pageOf(
        reports.map((report) => ({
          id: report.id,
          reason: report.reason,
          message: report.message,
          status: report.status,
          createdAt: report.createdAt,
          resolvedAt: report.resolvedAt,
          resolvedBy: report.resolvedBy,
          userName: report.user.name,
          questionId: report.question.id,
          questionText: report.question.text,
          questionActive: report.question.active,
          questionReports: report.question._count.reports,
        })),
        total,
        page,
        size,
      ),
    );
  }),
);

reportsRouter.get(
  "/admin/count",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json({ open: await prisma.questionReport.count({ where: { status: "OPEN" } }) });
  }),
);

reportsRouter.put(
  "/admin/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const { status } = z.object({ status: z.enum(["OPEN", "RESOLVED", "DISMISSED"]) }).parse(req.body);
    const report = await prisma.questionReport.findUnique({ where: { id } });
    if (!report) {
      throw notFound("Reporte não encontrado");
    }
    // Resolver/descartar vale para todos os reportes abertos da mesma pergunta.
    const closing = status !== "OPEN";
    await prisma.questionReport.updateMany({
      where: closing ? { questionId: report.questionId, status: "OPEN" } : { id },
      data: { status, resolvedAt: closing ? new Date() : null, resolvedBy: closing ? currentUser(req).email : null },
    });
    res.json({ ok: true });
  }),
);
