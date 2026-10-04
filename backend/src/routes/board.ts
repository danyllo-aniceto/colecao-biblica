import { Router } from "express";
import { z } from "../lib/validation";
import { asyncHandler } from "../middleware/errorHandler";
import { boardLimiter } from "../middleware/rateLimit";
import { BOARD_MAX_QUESTIONS, BOARD_MIN_QUESTIONS, getBoardQuestions } from "../services/board";

export const boardRouter = Router();

const questionsSchema = z.object({
  scenarioId: z.number().int().positive().nullish(),
  count: z.number().int().min(BOARD_MIN_QUESTIONS).max(BOARD_MAX_QUESTIONS),
});

boardRouter.post(
  "/questions",
  boardLimiter,
  asyncHandler(async (req, res) => {
    res.json(await getBoardQuestions(questionsSchema.parse(req.body)));
  }),
);
