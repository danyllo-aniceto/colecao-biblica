import { Router } from "express";
import { parseId } from "../lib/validation";
import { currentUser } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { claimStone } from "../services/breastplate";
import { claimNode, getCampaign } from "../services/campaign";
import { campaignAdminRouter } from "./campaign-admin";

export const campaignRouter = Router();

campaignRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await getCampaign(currentUser(req).id));
  }),
);

campaignRouter.post(
  "/nodes/:id/claim",
  asyncHandler(async (req, res) => {
    res.json(await claimNode(currentUser(req).id, parseId(req.params.id)));
  }),
);

campaignRouter.post(
  "/stones/:id/claim",
  asyncHandler(async (req, res) => {
    res.json(await claimStone(currentUser(req).id, parseId(req.params.id)));
  }),
);

campaignRouter.use("/admin", campaignAdminRouter);
