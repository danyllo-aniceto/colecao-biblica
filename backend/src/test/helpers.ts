import request from "supertest";
import { createApp } from "../app";
import { prisma } from "../db/prisma";
import { runSeed } from "../services/seed";

export const app = createApp();
export const api = request(app);

export async function resetDatabase() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE users, biblical_characters, questions, reward_definitions, shop_items, user_stickers,
     user_comments, quiz_matches, quiz_sessions, game_settings, user_achievements, user_claims, question_reports, friendships, messages, trades RESTART IDENTITY CASCADE`,
  );
  await runSeed(prisma, { demoData: true });
}

export async function login(email: string, password = "123456") {
  const response = await api.post("/api/auth/login").send({ email, password });
  if (response.status !== 200) {
    throw new Error(`login falhou: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return response.body.accessToken as string;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
