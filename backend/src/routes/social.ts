import { Router } from "express";
import { readPage } from "../lib/pagination";
import { parseId, parseIntQuery, requiredText, z } from "../lib/validation";
import { currentUser } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import {
  blockUser,
  cancelFriendRequest,
  createTrade,
  ensureFriendCode,
  friendAlbum,
  getMessages,
  listFriendRequests,
  listFriends,
  listTrades,
  removeFriend,
  respondFriendRequest,
  respondTrade,
  sendFriendRequest,
  sendMessage,
  socialSummary,
  unblockUser,
} from "../services/social";

/** Amigos, conversa e trocas: /api/social. */
export const socialRouter = Router();

socialRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    res.json({ friendCode: await ensureFriendCode(currentUser(req).id) });
  }),
);

socialRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    res.json(await socialSummary(currentUser(req).id));
  }),
);

socialRouter.get(
  "/friends",
  asyncHandler(async (req, res) => {
    const { page, size } = readPage(req, 20, 50);
    res.json(await listFriends(currentUser(req).id, page, size));
  }),
);

socialRouter.post(
  "/friends/request",
  asyncHandler(async (req, res) => {
    const { code } = z.object({ code: z.string().trim().min(4).max(12) }).parse(req.body);
    res.status(201).json(await sendFriendRequest(currentUser(req).id, code));
  }),
);

socialRouter.get(
  "/friends/requests",
  asyncHandler(async (req, res) => {
    res.json(await listFriendRequests(currentUser(req).id));
  }),
);

socialRouter.post(
  "/friends/requests/:id/:action(accept|decline)",
  asyncHandler(async (req, res) => {
    res.json(await respondFriendRequest(currentUser(req).id, parseId(req.params.id), req.params.action === "accept"));
  }),
);

socialRouter.delete(
  "/friends/requests/:id",
  asyncHandler(async (req, res) => {
    await cancelFriendRequest(currentUser(req).id, parseId(req.params.id));
    res.status(204).end();
  }),
);

socialRouter.delete(
  "/friends/:userId",
  asyncHandler(async (req, res) => {
    await removeFriend(currentUser(req).id, parseId(req.params.userId));
    res.status(204).end();
  }),
);

socialRouter.post(
  "/friends/:userId/block",
  asyncHandler(async (req, res) => {
    await blockUser(currentUser(req).id, parseId(req.params.userId));
    res.status(204).end();
  }),
);

socialRouter.delete(
  "/friends/:userId/block",
  asyncHandler(async (req, res) => {
    await unblockUser(currentUser(req).id, parseId(req.params.userId));
    res.status(204).end();
  }),
);

socialRouter.get(
  "/friends/:userId/album",
  asyncHandler(async (req, res) => {
    res.json(await friendAlbum(currentUser(req).id, parseId(req.params.userId)));
  }),
);

socialRouter.get(
  "/chat/:userId",
  asyncHandler(async (req, res) => {
    const before = parseIntQuery(req.query.before, 0);
    res.json(await getMessages(currentUser(req).id, parseId(req.params.userId), before > 0 ? before : null, parseIntQuery(req.query.limit, 30)));
  }),
);

socialRouter.post(
  "/chat/:userId",
  asyncHandler(async (req, res) => {
    const { text } = z.object({ text: requiredText(500) }).parse(req.body);
    res.status(201).json(await sendMessage(currentUser(req).id, parseId(req.params.userId), text));
  }),
);

const tradeSchema = z.object({
  toUserId: z.number().int().positive(),
  offeredCharacterId: z.number().int().positive().nullish(),
  requestedCharacterId: z.number().int().positive().nullish(),
  message: z.string().trim().max(300).nullish(),
});

socialRouter.post(
  "/trades",
  asyncHandler(async (req, res) => {
    res.status(201).json(await createTrade(currentUser(req).id, tradeSchema.parse(req.body)));
  }),
);

socialRouter.get(
  "/trades",
  asyncHandler(async (req, res) => {
    const { page, size } = readPage(req, 10, 50);
    const box = z.enum(["received", "sent", "history"]).catch("received").parse(req.query.box);
    res.json(await listTrades(currentUser(req).id, box, page, size));
  }),
);

socialRouter.post(
  "/trades/:id/:action(accept|decline|cancel)",
  asyncHandler(async (req, res) => {
    res.json(await respondTrade(currentUser(req).id, parseId(req.params.id), req.params.action as "accept" | "decline" | "cancel"));
  }),
);
