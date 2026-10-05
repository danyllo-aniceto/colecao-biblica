import { Router } from "express";
import { parseId, parseIntQuery, z } from "../lib/validation";
import { currentUser } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { boardActionLimiter, boardLimiter } from "../middleware/rateLimit";
import { BOARD_MAX_QUESTIONS, BOARD_MIN_QUESTIONS, getBoardQuestions } from "../services/board";
import {
  addBot,
  answer,
  answerTrial,
  continueAfterReveal,
  createRoom,
  dismissInvite,
  getRoom,
  inviteFriend,
  joinRoom,
  leaveRoom,
  listInvites,
  myRoom,
  publicRoom,
  rematch,
  removePlayer,
  roll,
  setBotSkill,
  setPawn,
  startGame,
  updateConfig,
  usePower,
} from "../services/board-room";

export const boardRouter = Router();
/** Prévia do convite: sem login (o link é aberto por quem ainda não tem conta). */
export const boardPublicRouter = Router();

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

// ---------------------------------------------------------------------------
// Salas online
// ---------------------------------------------------------------------------

const configSchema = z
  .object({
    size: z.number().int(),
    timeSeconds: z.number().int(),
    powerUps: z.boolean(),
    push: z.boolean(),
    catchUp: z.boolean(),
  })
  .partial();
const botSkill = z.enum(["APPRENTICE", "STUDENT", "MASTER"]);
const option = z.enum(["A", "B", "C", "D"]);
const powerKind = z.enum(["FIFTY", "TIME", "SWAP", "SHIELD", "DOUBLE", "REROLL", "TREE", "DOVE", "TENT", "STAFF", "MANNA", "TRUMPET", "WISDOM", "FOURTH", "NET", "LIGHT"]);
const code = (value: unknown) => z.string().trim().min(4).max(8).parse(value);

boardPublicRouter.get(
  "/:code",
  asyncHandler(async (req, res) => {
    res.json(await publicRoom(code(req.params.code)));
  }),
);

boardRouter.get(
  "/rooms/mine",
  asyncHandler(async (req, res) => {
    res.json(await myRoom(currentUser(req).id));
  }),
);

boardRouter.post(
  "/rooms",
  boardActionLimiter,
  asyncHandler(async (req, res) => {
    const input = z.object({ scenarioId: z.number().int().positive(), config: configSchema.optional(), pawn: z.string().max(2048).nullish() }).parse(req.body);
    res.status(201).json(await createRoom(currentUser(req).id, input));
  }),
);

boardRouter.get(
  "/rooms/:code",
  asyncHandler(async (req, res) => {
    const since = req.query.since === undefined ? undefined : Math.max(0, parseIntQuery(req.query.since, 0));
    res.json(await getRoom(code(req.params.code), currentUser(req).id, since));
  }),
);

boardRouter.post(
  "/rooms/:code/join",
  boardActionLimiter,
  asyncHandler(async (req, res) => {
    const input = z.object({ pawn: z.string().max(2048).nullish() }).parse(req.body ?? {});
    res.json(await joinRoom(currentUser(req).id, code(req.params.code), input));
  }),
);

boardRouter.post(
  "/rooms/:code/leave",
  boardActionLimiter,
  asyncHandler(async (req, res) => {
    await leaveRoom(currentUser(req).id, code(req.params.code));
    res.status(204).end();
  }),
);

boardRouter.put(
  "/rooms/:code/config",
  boardActionLimiter,
  asyncHandler(async (req, res) => {
    const input = z.object({ scenarioId: z.number().int().positive().optional(), config: configSchema.optional() }).parse(req.body);
    res.json(await updateConfig(currentUser(req).id, code(req.params.code), input));
  }),
);

boardRouter.put(
  "/rooms/:code/pawn",
  boardActionLimiter,
  asyncHandler(async (req, res) => {
    const input = z.object({ pawn: z.string().min(1).max(2048) }).parse(req.body);
    res.json(await setPawn(currentUser(req).id, code(req.params.code), input.pawn));
  }),
);

boardRouter.post(
  "/rooms/:code/bots",
  boardActionLimiter,
  asyncHandler(async (req, res) => {
    const input = z.object({ skill: botSkill }).parse(req.body);
    res.json(await addBot(currentUser(req).id, code(req.params.code), input.skill));
  }),
);

boardRouter.put(
  "/rooms/:code/bots/:slot",
  boardActionLimiter,
  asyncHandler(async (req, res) => {
    const input = z.object({ skill: botSkill }).parse(req.body);
    res.json(await setBotSkill(currentUser(req).id, code(req.params.code), Math.min(5, Math.max(0, parseIntQuery(req.params.slot, 0))), input.skill));
  }),
);

boardRouter.delete(
  "/rooms/:code/players/:slot",
  boardActionLimiter,
  asyncHandler(async (req, res) => {
    res.json(await removePlayer(currentUser(req).id, code(req.params.code), Math.min(5, Math.max(0, parseIntQuery(req.params.slot, 0)))));
  }),
);

boardRouter.post(
  "/rooms/:code/start",
  boardActionLimiter,
  asyncHandler(async (req, res) => {
    res.json(await startGame(currentUser(req).id, code(req.params.code)));
  }),
);

boardRouter.post(
  "/rooms/:code/rematch",
  boardActionLimiter,
  asyncHandler(async (req, res) => {
    res.json(await rematch(currentUser(req).id, code(req.params.code)));
  }),
);

boardRouter.post(
  "/rooms/:code/roll",
  boardActionLimiter,
  asyncHandler(async (req, res) => {
    res.json(await roll(currentUser(req).id, code(req.params.code)));
  }),
);

boardRouter.post(
  "/rooms/:code/power",
  boardActionLimiter,
  asyncHandler(async (req, res) => {
    const input = z.object({ kind: powerKind, targetId: z.string().max(20).optional() }).parse(req.body);
    res.json(await usePower(currentUser(req).id, code(req.params.code), input.kind, input.targetId));
  }),
);

boardRouter.post(
  "/rooms/:code/trial",
  boardActionLimiter,
  asyncHandler(async (req, res) => {
    const input = z.object({ accept: z.boolean() }).parse(req.body);
    res.json(await answerTrial(currentUser(req).id, code(req.params.code), input.accept));
  }),
);

boardRouter.post(
  "/rooms/:code/answer",
  boardActionLimiter,
  asyncHandler(async (req, res) => {
    const input = z.object({ selected: option.nullable() }).parse(req.body);
    res.json(await answer(currentUser(req).id, code(req.params.code), input.selected));
  }),
);

boardRouter.post(
  "/rooms/:code/continue",
  boardActionLimiter,
  asyncHandler(async (req, res) => {
    res.json(await continueAfterReveal(currentUser(req).id, code(req.params.code)));
  }),
);

boardRouter.post(
  "/rooms/:code/invite",
  boardActionLimiter,
  asyncHandler(async (req, res) => {
    const input = z.object({ friendId: z.number().int().positive() }).parse(req.body);
    await inviteFriend(currentUser(req).id, code(req.params.code), input.friendId);
    res.status(204).end();
  }),
);

boardRouter.get(
  "/invites",
  asyncHandler(async (req, res) => {
    res.json(await listInvites(currentUser(req).id));
  }),
);

boardRouter.delete(
  "/invites/:id",
  asyncHandler(async (req, res) => {
    await dismissInvite(currentUser(req).id, parseId(req.params.id));
    res.status(204).end();
  }),
);
