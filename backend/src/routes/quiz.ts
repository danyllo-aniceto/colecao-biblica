import { Router } from "express";
import { optionLetter, parseId, parseIntQuery, z } from "../lib/validation";
import { currentUser } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { readPage } from "../lib/pagination";
import {
  abandonSession,
  answerQuestion,
  getActiveSession,
  getDailyChallenge,
  getHistory,
  getMatchesPage,
  getSessionStatus,
  nextQuestion,
  startSession,
  useExtraTime,
  useFiftyFifty,
} from "../services/quiz";

export const quizRouter = Router();

const startSchema = z.object({
  quizType: z.enum(["GENERAL", "CHARACTER_STUDY", "DAILY_CHALLENGE"]),
  characterId: z.number().int().positive().nullish(),
  questionLimit: z.number().int().min(1).max(100).nullish(),
});

// selectedOption nulo indica que o tempo acabou sem resposta.
const answerSchema = z.object({
  questionId: z.number().int().positive(),
  selectedOption: optionLetter.nullish(),
  useExtraLife: z.boolean().nullish(),
  useXpMultiplier: z.boolean().nullish(),
});

quizRouter.post(
  "/sessions/start",
  asyncHandler(async (req, res) => {
    res.json(await startSession(currentUser(req), startSchema.parse(req.body)));
  }),
);

quizRouter.get(
  "/sessions/active",
  asyncHandler(async (req, res) => {
    res.json(await getActiveSession(currentUser(req)));
  }),
);

quizRouter.get(
  "/sessions/:id",
  asyncHandler(async (req, res) => {
    res.json(await getSessionStatus(currentUser(req), parseId(req.params.id)));
  }),
);

quizRouter.post(
  "/sessions/:id/answer",
  asyncHandler(async (req, res) => {
    res.json(await answerQuestion(currentUser(req).id, parseId(req.params.id), answerSchema.parse(req.body)));
  }),
);

quizRouter.post(
  "/sessions/:id/next",
  asyncHandler(async (req, res) => {
    res.json(await nextQuestion(currentUser(req).id, parseId(req.params.id)));
  }),
);

quizRouter.post(
  "/sessions/:id/extra-time",
  asyncHandler(async (req, res) => {
    res.json(await useExtraTime(currentUser(req).id, parseId(req.params.id)));
  }),
);

quizRouter.post(
  "/sessions/:id/fifty-fifty",
  asyncHandler(async (req, res) => {
    res.json(await useFiftyFifty(currentUser(req).id, parseId(req.params.id)));
  }),
);

quizRouter.post(
  "/sessions/:id/abandon",
  asyncHandler(async (req, res) => {
    res.json(await abandonSession(currentUser(req).id, parseId(req.params.id)));
  }),
);

quizRouter.get(
  "/history",
  asyncHandler(async (req, res) => {
    res.json(await getHistory(currentUser(req).id, parseIntQuery(req.query.limit, 20)));
  }),
);

quizRouter.get(
  "/matches",
  asyncHandler(async (req, res) => {
    const { page, size } = readPage(req, 10, 50);
    res.json(await getMatchesPage(currentUser(req).id, page, size));
  }),
);

quizRouter.get(
  "/daily-challenge",
  asyncHandler(async (req, res) => {
    const { page, size } = readPage(req, 10, 50);
    res.json(await getDailyChallenge(currentUser(req).id, page, size));
  }),
);
