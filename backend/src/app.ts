import express from "express";
import cors from "cors";
import { requireAdmin, requireAuth } from "./middleware/auth";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { authRouter } from "./routes/auth";
import { charactersRouter } from "./routes/characters";
import { collectionRouter } from "./routes/collection";
import { commentsRouter } from "./routes/comments";
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
  // Imagens sem Vercel Blob vão como data URL no corpo: limite folgado.
  app.use(express.json({ limit: "8mb" }));

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

  app.use("/api", notFoundHandler);
  app.use(errorHandler);

  return app;
}
