import { Router } from "express";
import { prisma } from "../db/prisma";
import { readPage } from "../lib/pagination";
import { z } from "../lib/validation";
import { currentUser } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { claimLeaguePrize, getLeague } from "../services/league";
import { claimMission, listMissions } from "../services/missions";
import { missionsAdminRouter } from "./missions-admin";

/** Missões (/api/missions) e liga semanal (/api/league). */
export const missionsRouter = Router();
export const leagueRouter = Router();

missionsRouter.use("/admin", missionsAdminRouter);

missionsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json(await listMissions(prisma, currentUser(req).id));
  }),
);

missionsRouter.post(
  "/:code/claim",
  asyncHandler(async (req, res) => {
    res.json(await claimMission(currentUser(req).id, z.string().min(1).max(40).parse(req.params.code)));
  }),
);

leagueRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, size } = readPage(req, 20, 100);
    res.json(await getLeague(currentUser(req).id, page, size));
  }),
);

leagueRouter.post(
  "/claim",
  asyncHandler(async (req, res) => {
    res.json(await claimLeaguePrize(currentUser(req).id));
  }),
);
