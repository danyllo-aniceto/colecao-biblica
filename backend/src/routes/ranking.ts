import { Router } from "express";
import { playerLooks } from "../services/cosmetics";
import { prisma } from "../db/prisma";
import { pageOf, readPage } from "../lib/pagination";
import { currentUser } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";

export const rankingRouter = Router();

const ORDER = [{ totalScore: "desc" as const }, { xp: "desc" as const }, { id: "asc" as const }];

/** Ranking paginado; inclui a posição do jogador logado mesmo fora da página. */
rankingRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { page, size, skip, take } = readPage(req, 20, 100);
    // Administradores não competem: ficam fora do ranking.
    const where = { deleted: false, role: "USER" as const };
    const [users, total] = await Promise.all([
      prisma.user.findMany({ where, orderBy: ORDER, skip, take, select: { id: true, name: true, level: true, totalScore: true, xp: true } }),
      prisma.user.count({ where }),
    ]);

    const me = currentUser(req);
    // Posição = quantos estão à frente (mesma ordem do ranking) + 1.
    const ahead = await prisma.user.count({
      where: {
        deleted: false,
        role: "USER",
        OR: [
          { totalScore: { gt: me.totalScore } },
          { totalScore: me.totalScore, xp: { gt: me.xp } },
          { totalScore: me.totalScore, xp: me.xp, id: { lt: me.id } },
        ],
      },
    });

    const looks = await playerLooks(prisma, [...users.map((user) => user.id), me.id]);
    const entries = users.map((user, index) => ({
      position: skip + index + 1,
      userId: user.id,
      userName: user.name,
      level: user.level,
      look: looks.get(user.id) ?? null,
      totalScore: user.totalScore,
      xp: user.xp,
    }));

    res.json({
      ...pageOf(entries, total, page, size),
      me: { position: ahead + 1, userId: me.id, userName: me.name, level: me.level, look: looks.get(me.id) ?? null, totalScore: me.totalScore, xp: me.xp },
    });
  }),
);
