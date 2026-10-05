import { Router } from "express";
import { parseId, parseIntQuery, z } from "../lib/validation";
import { currentUser } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { duelActionLimiter } from "../middleware/rateLimit";
import {
  addBot,
  createRoom,
  dismissInvite,
  doubleDown,
  getRoom,
  giveUp,
  inviteFriend,
  joinRoom,
  leaveRoom,
  listInvites,
  myRoom,
  nextRound,
  publicRoom,
  ready,
  rematch,
  removePlayer,
  setBotSkill,
  setDeck,
  stageCard,
  startGame,
  unstageCard,
  updateConfig,
} from "../services/duel-room";

/** Salas online do Duelo de Cartas (autenticado). */
export const duelRoomRouter = Router();
/** Prévia do convite: sem login (o link é aberto por quem ainda não tem conta). */
export const duelPublicRouter = Router();

const configSchema = z
  .object({
    format: z.enum(["single", "bo3", "lives"]),
    levels: z.boolean(),
    turnSeconds: z.number().int(),
  })
  .partial();
const botSkill = z.enum(["APPRENTICE", "STUDENT", "MASTER"]);
const code = (value: unknown) => z.string().trim().min(4).max(8).parse(value);
const slotOf = (value: unknown) => Math.min(1, Math.max(0, parseIntQuery(value, 0)));
const deckSlot = z.number().int().min(1).max(5);

duelPublicRouter.get(
  "/:code",
  asyncHandler(async (req, res) => {
    res.json(await publicRoom(code(req.params.code)));
  }),
);

duelRoomRouter.get(
  "/mine",
  asyncHandler(async (req, res) => {
    res.json(await myRoom(currentUser(req).id));
  }),
);

duelRoomRouter.get(
  "/invites",
  asyncHandler(async (req, res) => {
    res.json(await listInvites(currentUser(req).id));
  }),
);

duelRoomRouter.delete(
  "/invites/:id",
  asyncHandler(async (req, res) => {
    await dismissInvite(currentUser(req).id, parseId(req.params.id));
    res.status(204).end();
  }),
);

duelRoomRouter.post(
  "/",
  duelActionLimiter,
  asyncHandler(async (req, res) => {
    const input = z.object({ config: configSchema.optional(), deckSlot: deckSlot.nullish() }).parse(req.body ?? {});
    res.status(201).json(await createRoom(currentUser(req).id, input));
  }),
);

duelRoomRouter.get(
  "/:code",
  asyncHandler(async (req, res) => {
    const since = req.query.since === undefined ? undefined : Math.max(0, parseIntQuery(req.query.since, 0));
    res.json(await getRoom(code(req.params.code), currentUser(req).id, since));
  }),
);

duelRoomRouter.post(
  "/:code/join",
  duelActionLimiter,
  asyncHandler(async (req, res) => {
    const input = z.object({ deckSlot: deckSlot.nullish() }).parse(req.body ?? {});
    res.json(await joinRoom(currentUser(req).id, code(req.params.code), input));
  }),
);

duelRoomRouter.post(
  "/:code/leave",
  duelActionLimiter,
  asyncHandler(async (req, res) => {
    await leaveRoom(currentUser(req).id, code(req.params.code));
    res.status(204).end();
  }),
);

duelRoomRouter.put(
  "/:code/config",
  duelActionLimiter,
  asyncHandler(async (req, res) => {
    const input = z.object({ config: configSchema.optional() }).parse(req.body);
    res.json(await updateConfig(currentUser(req).id, code(req.params.code), input));
  }),
);

duelRoomRouter.put(
  "/:code/deck",
  duelActionLimiter,
  asyncHandler(async (req, res) => {
    const input = z.object({ deckSlot }).parse(req.body);
    res.json(await setDeck(currentUser(req).id, code(req.params.code), input.deckSlot));
  }),
);

duelRoomRouter.post(
  "/:code/bots",
  duelActionLimiter,
  asyncHandler(async (req, res) => {
    const input = z.object({ skill: botSkill }).parse(req.body);
    res.json(await addBot(currentUser(req).id, code(req.params.code), input.skill));
  }),
);

duelRoomRouter.put(
  "/:code/bots/:slot",
  duelActionLimiter,
  asyncHandler(async (req, res) => {
    const input = z.object({ skill: botSkill }).parse(req.body);
    res.json(await setBotSkill(currentUser(req).id, code(req.params.code), slotOf(req.params.slot), input.skill));
  }),
);

duelRoomRouter.delete(
  "/:code/players/:slot",
  duelActionLimiter,
  asyncHandler(async (req, res) => {
    res.json(await removePlayer(currentUser(req).id, code(req.params.code), slotOf(req.params.slot)));
  }),
);

duelRoomRouter.post(
  "/:code/start",
  duelActionLimiter,
  asyncHandler(async (req, res) => {
    res.json(await startGame(currentUser(req).id, code(req.params.code)));
  }),
);

duelRoomRouter.post(
  "/:code/rematch",
  duelActionLimiter,
  asyncHandler(async (req, res) => {
    res.json(await rematch(currentUser(req).id, code(req.params.code)));
  }),
);

duelRoomRouter.post(
  "/:code/stage",
  duelActionLimiter,
  asyncHandler(async (req, res) => {
    const input = z.object({ uid: z.number().int().positive(), lane: z.number().int().min(0).max(2) }).parse(req.body);
    res.json(await stageCard(currentUser(req).id, code(req.params.code), input.uid, input.lane));
  }),
);

duelRoomRouter.post(
  "/:code/unstage",
  duelActionLimiter,
  asyncHandler(async (req, res) => {
    const input = z.object({ uid: z.number().int().positive() }).parse(req.body);
    res.json(await unstageCard(currentUser(req).id, code(req.params.code), input.uid));
  }),
);

duelRoomRouter.post(
  "/:code/ready",
  duelActionLimiter,
  asyncHandler(async (req, res) => {
    res.json(await ready(currentUser(req).id, code(req.params.code)));
  }),
);

duelRoomRouter.post(
  "/:code/double",
  duelActionLimiter,
  asyncHandler(async (req, res) => {
    res.json(await doubleDown(currentUser(req).id, code(req.params.code)));
  }),
);

duelRoomRouter.post(
  "/:code/retreat",
  duelActionLimiter,
  asyncHandler(async (req, res) => {
    res.json(await giveUp(currentUser(req).id, code(req.params.code)));
  }),
);

duelRoomRouter.post(
  "/:code/next",
  duelActionLimiter,
  asyncHandler(async (req, res) => {
    res.json(await nextRound(currentUser(req).id, code(req.params.code)));
  }),
);

duelRoomRouter.post(
  "/:code/invite",
  duelActionLimiter,
  asyncHandler(async (req, res) => {
    const input = z.object({ friendId: z.number().int().positive() }).parse(req.body);
    await inviteFriend(currentUser(req).id, code(req.params.code), input.friendId);
    res.status(204).end();
  }),
);
