import express from "express";
import cors from "cors";
import { requireAdmin, requireAuth } from "./middleware/auth";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { achievementsRouter } from "./routes/achievements";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { boardPublicRouter, boardRouter } from "./routes/board";
import { campaignRouter } from "./routes/campaign";
import { duelRouter } from "./routes/duel";
import { charactersRouter } from "./routes/characters";
import { collectionRouter } from "./routes/collection";
import { commentsRouter } from "./routes/comments";
import { cosmeticsRouter } from "./routes/cosmetics";
import { dailyRouter } from "./routes/daily";
import { leagueRouter, missionsRouter } from "./routes/engagement";
import { reportsRouter } from "./routes/reports";
import { socialRouter } from "./routes/social";
import { chestsRouter, collectionsRouter, eventsRouter, passRouter } from "./routes/progression";
import { questionsRouter } from "./routes/questions";
import { quizRouter } from "./routes/quiz";
import { rankingRouter } from "./routes/ranking";
import { rewardsRouter } from "./routes/rewards";
import { settingsRouter } from "./routes/settings";
import { shopRouter } from "./routes/shop";
import { uploadsRouter } from "./routes/uploads";
import { usersRouter } from "./routes/users";

export function createApp() {
  const app = express();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(cors());
  // Textos ricos podem trazer imagens antigas em data URL: limite folgado.
  app.use(express.json({ limit: "4mb" }));

  // Respostas da API nunca ficam em cache de CDN (o service worker cuida do offline).
  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/uploads", uploadsRouter);
  app.use("/api/board-public", boardPublicRouter);

  // Daqui em diante tudo exige login.
  app.use("/api/characters", requireAuth, charactersRouter);
  // Perguntas trazem a alternativa correta: só o painel admin lê direto.
  app.use("/api/questions", requireAuth, requireAdmin, questionsRouter);
  app.use("/api/rewards", requireAuth, rewardsRouter);
  app.use("/api/shop", requireAuth, shopRouter);
  app.use("/api/settings", requireAuth, settingsRouter);
  app.use("/api/quiz", requireAuth, quizRouter);
  app.use("/api/collection", requireAuth, collectionRouter);
  app.use("/api/comments", requireAuth, commentsRouter);
  app.use("/api/ranking", requireAuth, rankingRouter);
  app.use("/api/daily-reward", requireAuth, dailyRouter);
  app.use("/api/achievements", requireAuth, achievementsRouter);
  app.use("/api/admin", requireAuth, requireAdmin, adminRouter);
  app.use("/api/missions", requireAuth, missionsRouter);
  app.use("/api/league", requireAuth, leagueRouter);
  app.use("/api/reports", requireAuth, reportsRouter);
  app.use("/api/social", requireAuth, socialRouter);
  app.use("/api/cosmetics", requireAuth, cosmeticsRouter);
  app.use("/api/chests", requireAuth, chestsRouter);
  app.use("/api/collections", requireAuth, collectionsRouter);
  app.use("/api/pass", requireAuth, passRouter);
  app.use("/api/events", requireAuth, eventsRouter);
  app.use("/api/campaign", requireAuth, campaignRouter);
  app.use("/api/board", requireAuth, boardRouter);
  app.use("/api/duel", requireAuth, duelRouter);

  app.use("/api", notFoundHandler);
  app.use(errorHandler);

  return app;
}
