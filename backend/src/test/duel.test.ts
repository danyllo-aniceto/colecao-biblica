import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../db/prisma";
import { api, bearer, login, resetDatabase } from "./helpers";

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasDatabase)("duelo: cartas e planilha", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  const row = (name: string, extra: Record<string, string> = {}) => ({ name, cost: "2", power: "4", tags: "Rei, Pastor", trigger: "revelar", effects: "poder valor=+2 alvo=si", available: "Sim", teams: "", ...extra });

  it("só admin cadastra; qualquer jogador lê as cartas disponíveis", async () => {
    const user = await login("user@email.com");
    const davi = await prisma.biblicalCharacter.findUniqueOrThrow({ where: { name: "Davi" } });
    const body = { cost: 2, power: 4, tags: ["Rei"], trigger: "revelar", effects: "comprar qtd=1", available: true, teams: [] };
    expect((await api.put(`/api/duel/admin/cards/${davi.id}`).set(bearer(user)).send(body)).status).toBe(403);

    const admin = await login("admin2@email.com");
    const saved = await api.put(`/api/duel/admin/cards/${davi.id}`).set(bearer(admin)).send(body);
    expect(saved.status).toBe(200);
    const cards = await api.get("/api/duel/cards").set(bearer(user));
    expect(cards.body.cards).toEqual([expect.objectContaining({ id: String(davi.id), name: "Davi", cost: 2, power: 4, tags: ["Rei"] })]);
    expect(cards.body.cards[0].dom.effects).toEqual([{ kind: "draw", count: 1 }]);

    // Indisponível some do jogo; Dom inválido é recusado com o motivo.
    await api.put(`/api/duel/admin/cards/${davi.id}`).set(bearer(admin)).send({ ...body, available: false });
    expect((await api.get("/api/duel/cards").set(bearer(user))).body.cards).toEqual([]);
    const invalid = await api.put(`/api/duel/admin/cards/${davi.id}`).set(bearer(admin)).send({ ...body, effects: "voar" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.message).toMatch(/Efeito desconhecido/);
  });

  it("importação: prévia sem gravar, erros por linha e depois grava (atualiza o que já existe)", async () => {
    const admin = await login("admin2@email.com");
    const rows = [
      row("Davi"),
      row("ester", { effects: "comprar qtd=1" }),
      row("Fulano Inexistente"),
      row("Paulo", { effects: "poder valor=abc" }),
      row("Davi"),
      row("Jesus"),
    ];
    const preview = await api.post("/api/duel/admin/import").set(bearer(admin)).send({ rows, dryRun: true });
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ dryRun: true, total: 6, valid: 2, created: 2, updated: 0 });
    expect(preview.body.errors.map((error: { row: number }) => error.row)).toEqual([3, 4, 5, 6]);
    expect(preview.body.errors[0].message).toMatch(/não encontrado/);
    expect(preview.body.errors[1].message).toMatch(/valor precisa ser um número inteiro/);
    expect(preview.body.errors[2].message).toMatch(/repetido/);
    expect(await prisma.duelCard.count()).toBe(0);

    const done = await api.post("/api/duel/admin/import").set(bearer(admin)).send({ rows });
    expect(done.body).toMatchObject({ valid: 2, created: 2 });
    expect(await prisma.duelCard.count()).toBe(2);

    const again = await api.post("/api/duel/admin/import").set(bearer(admin)).send({ rows: [row("davi", { power: "5" })] });
    expect(again.body).toMatchObject({ valid: 1, created: 0, updated: 1 });
    const davi = await prisma.biblicalCharacter.findUniqueOrThrow({ where: { name: "Davi" }, include: { duelCard: true } });
    expect(davi.duelCard?.power).toBe(5);
  });

  it("Times prontos: só valem com exatamente 12 cartas disponíveis", async () => {
    const admin = await login("admin2@email.com");
    const user = await login("user@email.com");
    const names = Array.from({ length: 12 }, (_, index) => `Personagem ${index + 1}`);
    await prisma.biblicalCharacter.createMany({
      data: names.map((name) => ({ name, rarity: "COMMON" as const, shortSummary: "x", fullDescription: "y", createdBy: "teste" })),
    });
    const rows = names.map((name) => row(name, { trigger: "", effects: "", teams: "Os Doze" }));
    await api.post("/api/duel/admin/import").set(bearer(admin)).send({ rows: rows.slice(0, 11) });
    expect((await api.get("/api/duel/cards").set(bearer(user))).body.decks).toEqual([]);
    const preview = await api.post("/api/duel/admin/import").set(bearer(admin)).send({ rows: rows.slice(0, 12), dryRun: true });
    expect(preview.body.teams).toEqual([{ name: "Os Doze", count: 12, ready: true }]);
    await api.post("/api/duel/admin/import").set(bearer(admin)).send({ rows });
    const decks = (await api.get("/api/duel/cards").set(bearer(user))).body.decks;
    expect(decks).toEqual([expect.objectContaining({ id: "os-doze", name: "Os Doze" })]);
    expect(decks[0].cards).toHaveLength(12);
  });

  it("lista do painel é paginada, com busca e filtro, e a exportação traz todos os personagens", async () => {
    const admin = await login("admin2@email.com");
    const davi = await prisma.biblicalCharacter.findUniqueOrThrow({ where: { name: "Davi" } });
    await prisma.duelCard.create({ data: { characterId: davi.id, cost: 2, power: 4, tags: [], teams: [] } });
    const page = await api.get("/api/duel/admin/cards?size=2&page=0").set(bearer(admin));
    expect(page.body).toMatchObject({ size: 2, number: 0 });
    expect(page.body.content).toHaveLength(2);
    const withCard = await api.get("/api/duel/admin/cards?status=with").set(bearer(admin));
    expect(withCard.body.content.map((item: { name: string }) => item.name)).toEqual(["Davi"]);
    const search = await api.get("/api/duel/admin/cards?search=ESTE").set(bearer(admin));
    expect(search.body.content.map((item: { name: string }) => item.name)).toEqual(["Ester"]);
    const all = await api.get("/api/duel/admin/export").set(bearer(admin));
    expect(all.body.rows.length).toBeGreaterThanOrEqual(3);
    expect(all.body.rows.find((item: { name: string }) => item.name === "Davi").card.power).toBe(4);
  });
});
