import { Router } from "express";
import { parseIntQuery, z } from "../lib/validation";
import { currentUser } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { runnerRoomLimiter } from "../middleware/rateLimit";
import { BOT_SKILLS, MAX_ROOM_PLAYERS } from "../runner/room";
import { addBot, createRoom, finishRace, getRoom, joinRoom, leaveRoom, myRoom, publicRoom, rematch, removePlayer, reportProgress, setBotSkill, setCharacter, startRace, updateLevel } from "../services/runner-room";

/** Salas da corrida online (autenticado). */
export const runnerRoomRouter = Router();
/** Prévia do convite: sem login (o link é aberto por quem ainda não tem conta). */
export const runnerPublicRouter = Router();

const botSkill = z.enum(BOT_SKILLS);
const code = (value: unknown) => z.string().trim().min(4).max(8).parse(value);
const slotOf = (value: unknown) => Math.min(MAX_ROOM_PLAYERS - 1, Math.max(0, parseIntQuery(value, 0)));
const levelSlug = z.string().trim().min(1).max(60);
const characterSlug = z.string().trim().min(1).max(60).nullish();

runnerPublicRouter.get(
  "/:code",
  asyncHandler(async (req, res) => {
    res.json(await publicRoom(code(req.params.code)));
  }),
);

runnerRoomRouter.get(
  "/mine",
  asyncHandler(async (req, res) => {
    res.json(await myRoom(currentUser(req).id));
  }),
);

runnerRoomRouter.post(
  "/",
  runnerRoomLimiter,
  asyncHandler(async (req, res) => {
    const input = z.object({ levelSlug, characterSlug }).parse(req.body ?? {});
    res.status(201).json(await createRoom(currentUser(req).id, input));
  }),
);

runnerRoomRouter.get(
  "/:code",
  asyncHandler(async (req, res) => {
    const since = req.query.since === undefined ? undefined : Math.max(0, parseIntQuery(req.query.since, 0));
    res.json(await getRoom(code(req.params.code), currentUser(req).id, since));
  }),
);

runnerRoomRouter.post(
  "/:code/join",
  runnerRoomLimiter,
  asyncHandler(async (req, res) => {
    const input = z.object({ characterSlug }).parse(req.body ?? {});
    res.json(await joinRoom(currentUser(req).id, code(req.params.code), input));
  }),
);

runnerRoomRouter.post(
  "/:code/leave",
  runnerRoomLimiter,
  asyncHandler(async (req, res) => {
    await leaveRoom(currentUser(req).id, code(req.params.code));
    res.status(204).end();
  }),
);

runnerRoomRouter.put(
  "/:code/level",
  runnerRoomLimiter,
  asyncHandler(async (req, res) => {
    const input = z.object({ levelSlug }).parse(req.body);
    res.json(await updateLevel(currentUser(req).id, code(req.params.code), input.levelSlug));
  }),
);

runnerRoomRouter.put(
  "/:code/character",
  runnerRoomLimiter,
  asyncHandler(async (req, res) => {
    const input = z.object({ characterSlug }).parse(req.body);
    res.json(await setCharacter(currentUser(req).id, code(req.params.code), input.characterSlug ?? null));
  }),
);

runnerRoomRouter.post(
  "/:code/bots",
  runnerRoomLimiter,
  asyncHandler(async (req, res) => {
    const input = z.object({ skill: botSkill }).parse(req.body);
    res.json(await addBot(currentUser(req).id, code(req.params.code), input.skill));
  }),
);

runnerRoomRouter.put(
  "/:code/bots/:slot",
  runnerRoomLimiter,
  asyncHandler(async (req, res) => {
    const input = z.object({ skill: botSkill }).parse(req.body);
    res.json(await setBotSkill(currentUser(req).id, code(req.params.code), slotOf(req.params.slot), input.skill));
  }),
);

runnerRoomRouter.delete(
  "/:code/players/:slot",
  runnerRoomLimiter,
  asyncHandler(async (req, res) => {
    res.json(await removePlayer(currentUser(req).id, code(req.params.code), slotOf(req.params.slot)));
  }),
);

runnerRoomRouter.post(
  "/:code/start",
  runnerRoomLimiter,
  asyncHandler(async (req, res) => {
    res.json(await startRace(currentUser(req).id, code(req.params.code)));
  }),
);

runnerRoomRouter.post(
  "/:code/rematch",
  runnerRoomLimiter,
  asyncHandler(async (req, res) => {
    res.json(await rematch(currentUser(req).id, code(req.params.code)));
  }),
);

const report = z.object({ x: z.number(), y: z.number(), form: z.string(), dead: z.boolean().optional(), deaths: z.number(), words: z.number() });

/** Posição a cada ~1 s (e a dos bots, só do anfitrião); devolve a sala para o aparelho ver os rivais. */
runnerRoomRouter.post(
  "/:code/progress",
  runnerRoomLimiter,
  asyncHandler(async (req, res) => {
    const input = z.object({ report, bots: z.array(z.object({ slot: z.number().int().min(0).max(MAX_ROOM_PLAYERS - 1), report })).max(MAX_ROOM_PLAYERS).optional() }).parse(req.body);
    res.json(await reportProgress(currentUser(req).id, code(req.params.code), input));
  }),
);

/** Chegada: a partida inteira (corrente de tentativas com os toques) para o servidor repetir e conferir. */
runnerRoomRouter.post(
  "/:code/finish",
  runnerRoomLimiter,
  asyncHandler(async (req, res) => {
    const input = z.object({ slot: z.number().int().min(0).max(MAX_ROOM_PLAYERS - 1).optional(), segments: z.unknown() }).parse(req.body);
    res.json(await finishRace(currentUser(req).id, code(req.params.code), input));
  }),
);
