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

  it("peão do tabuleiro: o admin cadastra com emoji ou imagem, o jogador compra e ele não se equipa", async () => {
    const admin = await login("admin2@email.com");
    const empty = await api.post("/api/cosmetics/admin").set(bearer(admin)).send({ type: "PAWN", name: "Vazio", unlock: "REWARD" });
    expect(empty.status).toBe(400);

    const emoji = await api.post("/api/cosmetics/admin").set(bearer(admin)).send({ type: "PAWN", name: "Peão: Teste", style: "🦊", unlock: "SHOP", priceCoins: 10 });
    expect(emoji.status).toBe(201);
    const image = await api.post("/api/cosmetics/admin").set(bearer(admin)).send({ type: "PAWN", name: "Peão: Imagem", imageUrl: "/api/uploads/file/peoes/raposa.png", unlock: "REWARD" });
    expect(image.status).toBe(201);
    expect(image.body).toMatchObject({ type: "PAWN", imageUrl: "/api/uploads/file/peoes/raposa.png" });

    // Os peões padrão vêm do seed (da loja, com emoji).
    expect(await prisma.cosmetic.count({ where: { type: "PAWN", system: true } })).toBeGreaterThanOrEqual(10);

    const token = await login("user@email.com");
    await prisma.user.update({ where: { email: "user@email.com" }, data: { coins: 100 } });
    const bought = await api.post(`/api/cosmetics/${emoji.body.id}/buy`).set(bearer(token));
    expect(bought.status).toBe(200);
    const inventory = await api.get("/api/cosmetics").set(bearer(token));
    const owned = (inventory.body.items as Array<{ id: number; type: string; owned: boolean; style: string | null }>).find((item) => item.id === emoji.body.id);
    expect(owned).toMatchObject({ type: "PAWN", owned: true, style: "🦊" });

    // Peão não se equipa: escolhe-se em cada partida.
    expect((await api.put("/api/cosmetics/equip").set(bearer(token)).send({ type: "PAWN", cosmeticId: emoji.body.id })).status).toBe(400);
  });

  it("peão: importação em lote aceita o tipo Peão com emoji ou imagem e recusa sem nenhum dos dois", async () => {
    const admin = await login("admin2@email.com");
    const rows = [
      { type: "Peão", name: "Peão: Lote", emoji: "🐢", price: 120 },
      { type: "peao", name: "Peão: Imagem do lote", imageUrl: "/api/uploads/file/peoes/lote.png" },
      { type: "Peão", name: "Peão: Sem nada" },
    ];
    const preview = await api.post("/api/cosmetics/admin/bulk").set(bearer(admin)).send({ rows, dryRun: true });
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ valid: 2, created: 0 });
    expect(preview.body.errors).toHaveLength(1);
    const saved = await api.post("/api/cosmetics/admin/bulk").set(bearer(admin)).send({ rows });
    expect(saved.body.created).toBe(2);
    const loja = await prisma.cosmetic.findFirstOrThrow({ where: { name: "Peão: Lote" } });
    expect(loja).toMatchObject({ type: "PAWN", style: "🐢", unlock: "SHOP", priceCoins: 120, color: null });
  });

  it("imagem do tabuleiro: o admin cadastra por cenário e o jogador a recebe na campanha", async () => {
    const admin = await login("admin2@email.com");
    const token = await login("user@email.com");
    const scenario = await prisma.scenario.findFirstOrThrow({ orderBy: { sortOrder: "asc" } });
    expect((await api.get("/api/campaign").set(bearer(token))).body.scenarios[0].boardImageUrl).toBeNull();

    const saved = await api
      .put(`/api/campaign/admin/scenarios/${scenario.id}`)
      .set(bearer(admin))
      .send({ name: scenario.name, color: scenario.color, sortOrder: scenario.sortOrder, active: true, boardImageUrl: "https://exemplo.com/tabuleiro-eden.jpg" });
    expect(saved.status).toBe(200);
    expect(saved.body.boardImageUrl).toBe("https://exemplo.com/tabuleiro-eden.jpg");
    expect((await api.get("/api/campaign").set(bearer(token))).body.scenarios[0].boardImageUrl).toBe("https://exemplo.com/tabuleiro-eden.jpg");

    // Ausente mantém; vazio limpa.
    await api.put(`/api/campaign/admin/scenarios/${scenario.id}`).set(bearer(admin)).send({ name: scenario.name, color: scenario.color, sortOrder: scenario.sortOrder, active: true });
    expect((await prisma.scenario.findUniqueOrThrow({ where: { id: scenario.id } })).boardImageUrl).toBe("https://exemplo.com/tabuleiro-eden.jpg");
    await api.put(`/api/campaign/admin/scenarios/${scenario.id}`).set(bearer(admin)).send({ name: scenario.name, color: scenario.color, sortOrder: scenario.sortOrder, active: true, boardImageUrl: "" });
    expect((await prisma.scenario.findUniqueOrThrow({ where: { id: scenario.id } })).boardImageUrl).toBeNull();
  });
});
