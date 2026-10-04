import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../db/prisma";
import { api, bearer, login, resetDatabase } from "./helpers";

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasDatabase)("tabuleiro", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("exige login e valida a quantidade de perguntas", async () => {
    expect((await api.post("/api/board/questions").send({ count: 20 })).status).toBe(401);
    const token = await login("user@email.com");
    expect((await api.post("/api/board/questions").set(bearer(token)).send({ count: 5 })).status).toBe(400);
    expect((await api.post("/api/board/questions").set(bearer(token)).send({ count: 500 })).status).toBe(400);
    expect((await api.post("/api/board/questions").set(bearer(token)).send({})).status).toBe(400);
  });

  it("sorteia perguntas ativas sem repetir, com a alternativa certa, e não mexe nas estatísticas", async () => {
    const token = await login("user@email.com");
    const total = await prisma.question.count({ where: { active: true } });
    const before = await prisma.question.aggregate({ _sum: { timesAnswered: true } });
    const scenario = await prisma.scenario.findFirstOrThrow({ orderBy: { sortOrder: "asc" } });

    const response = await api.post("/api/board/questions").set(bearer(token)).send({ scenarioId: scenario.id, count: 30 });
    expect(response.status).toBe(200);
    const questions = response.body.questions as Array<{ id: number; correctOption: string; optionA: string; difficulty: string }>;
    expect(questions.length).toBe(Math.min(30, total));
    expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length);
    expect(questions.every((question) => ["A", "B", "C", "D"].includes(question.correctOption) && question.optionA)).toBe(true);

    const after = await prisma.question.aggregate({ _sum: { timesAnswered: true } });
    expect(after._sum.timesAnswered).toBe(before._sum.timesAnswered);
  });

  it("não traz perguntas desativadas e traz as do cenário com prioridade", async () => {
    const token = await login("user@email.com");
    const scenario = await prisma.scenario.findFirstOrThrow({ orderBy: { sortOrder: "asc" } });
    const own = await prisma.question.findMany({ where: { active: true }, take: 5, orderBy: { id: "asc" } });
    await prisma.question.updateMany({ where: { id: { in: own.map((question) => question.id) } }, data: { scenarioId: scenario.id } });
    await prisma.question.update({ where: { id: own[0].id }, data: { active: false } });

    const response = await api.post("/api/board/questions").set(bearer(token)).send({ scenarioId: scenario.id, count: 20 });
    const ids = (response.body.questions as Array<{ id: number }>).map((question) => question.id);
    expect(ids).not.toContain(own[0].id);
    // As 4 perguntas ativas do cenário entram (a cota do cenário é de metade do lote).
    for (const question of own.slice(1)) expect(ids).toContain(question.id);
  });
});
