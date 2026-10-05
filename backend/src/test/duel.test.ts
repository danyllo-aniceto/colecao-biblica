import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../db/prisma";
import { api, bearer, login, resetDatabase } from "./helpers";

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasDatabase)("duelo: figurinhas e planilha", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  const row = (name: string, extra: Record<string, string> = {}) => ({ name, cost: "2", power: "4", tags: "Rei, Pastor", trigger: "revelar", effects: "poder valor=+2 alvo=si", available: "Sim", ...extra });

  it("só admin cadastra; qualquer jogador lê as figurinhas disponíveis", async () => {
    const user = await login("user@email.com");
    const davi = await prisma.biblicalCharacter.findUniqueOrThrow({ where: { name: "Davi" } });
    const body = { cost: 2, power: 4, tags: ["Rei"], trigger: "revelar", effects: "comprar qtd=1", available: true };
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

  it("Times do jogador: 12 figurinhas diferentes, disponíveis e de figurinhas que ele tem", async () => {
    const admin = await login("admin2@email.com");
    const user = await login("user@email.com");
    const userRow = await prisma.user.findUniqueOrThrow({ where: { email: "user@email.com" } });
    const names = Array.from({ length: 13 }, (_, index) => `Personagem ${index + 1}`);
    await prisma.biblicalCharacter.createMany({ data: names.map((name) => ({ name, rarity: "COMMON" as const, shortSummary: "x", fullDescription: "y", createdBy: "teste" })) });
    const characters = await prisma.biblicalCharacter.findMany({ where: { name: { in: names } }, orderBy: { id: "asc" } });
    await api.post("/api/duel/admin/import").set(bearer(admin)).send({ rows: names.slice(0, 12).map((name) => row(name, { trigger: "", effects: "" })) });
    const ids = characters.map((character) => character.id);
    const team = ids.slice(0, 12);

    // Sem as figurinhas, não pode.
    const denied = await api.put("/api/duel/decks/1").set(bearer(user)).send({ name: "Meu Time", cards: team });
    expect(denied.status).toBe(400);
    expect(denied.body.message).toMatch(/já conquistou/);

    await prisma.userSticker.createMany({ data: ids.map((characterId) => ({ userId: userRow.id, characterId })) });
    const saved = await api.put("/api/duel/decks/1").set(bearer(user)).send({ name: "Meu Time", cards: team });
    expect(saved.status).toBe(200);
    expect((await api.get("/api/duel/decks").set(bearer(user))).body.decks).toEqual([{ slot: 1, name: "Meu Time", cards: team }]);

    // Regras: 12 figurinhas, sem repetir, só disponíveis, espaço de 1 a 5.
    expect((await api.put("/api/duel/decks/2").set(bearer(user)).send({ name: "Curto", cards: team.slice(0, 11) })).status).toBe(400);
    expect((await api.put("/api/duel/decks/2").set(bearer(user)).send({ name: "Repetido", cards: [...team.slice(0, 11), team[0]] })).body.message).toMatch(/duas vezes/);
    expect((await api.put("/api/duel/decks/2").set(bearer(user)).send({ name: "Sem figurinha", cards: [...team.slice(0, 11), ids[12]] })).body.message).toMatch(/não está disponível/);
    expect((await api.put("/api/duel/decks/6").set(bearer(user)).send({ name: "Fora", cards: team })).status).toBe(400);

    // Cada jogador vê só os seus; apagar libera o espaço.
    expect((await api.get("/api/duel/decks").set(bearer(admin))).body.decks).toEqual([]);
    expect((await api.delete("/api/duel/decks/1").set(bearer(user))).status).toBe(204);
    expect((await api.get("/api/duel/decks").set(bearer(user))).body.decks).toEqual([]);
  });

  it("lista do painel é paginada, com busca e filtro, e a exportação traz todos os personagens", async () => {
    const admin = await login("admin2@email.com");
    const davi = await prisma.biblicalCharacter.findUniqueOrThrow({ where: { name: "Davi" } });
    await prisma.duelCard.create({ data: { characterId: davi.id, cost: 2, power: 4, tags: [] } });
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

  it("capas dos modos de jogo: qualquer jogador lê, só o admin troca", async () => {
    const user = await login("user@email.com");
    const admin = await login("admin2@email.com");
    expect((await api.get("/api/game-modes").set(bearer(user))).body).toEqual([]);
    expect((await api.put("/api/game-modes/admin/duel").set(bearer(user)).send({ imageUrl: "https://exemplo.com/a.png" })).status).toBe(403);
    expect((await api.put("/api/game-modes/admin/xadrez").set(bearer(admin)).send({ imageUrl: null })).status).toBe(400);
    const saved = await api.put("/api/game-modes/admin/duel").set(bearer(admin)).send({ imageUrl: "https://exemplo.com/a.png" });
    expect(saved.body).toEqual({ mode: "DUEL", imageUrl: "https://exemplo.com/a.png" });
    expect((await api.get("/api/game-modes").set(bearer(user))).body).toEqual([{ mode: "DUEL", imageUrl: "https://exemplo.com/a.png" }]);
    // A página inicial lê as capas sem login.
    expect((await api.get("/api/game-modes-public")).body).toEqual([{ mode: "DUEL", imageUrl: "https://exemplo.com/a.png" }]);
    // Remover a imagem volta ao fundo padrão.
    await api.put("/api/game-modes/admin/duel").set(bearer(admin)).send({ imageUrl: "" });
    expect((await api.get("/api/game-modes").set(bearer(user))).body).toEqual([{ mode: "DUEL", imageUrl: null }]);
  });

  it("página inicial: figurinhas de exemplo públicas, só as visíveis e na ordem pedida", async () => {
    const base = { shortSummary: "x", fullDescription: "y", createdBy: "teste" };
    const put = (name: string, data: { rarity: "COMMON" | "RARE" | "EPIC"; imageUrl: string | null; published?: boolean }) =>
      prisma.biblicalCharacter.upsert({ where: { name }, create: { name, ...base, ...data }, update: data });
    await put("Davi", { rarity: "RARE", imageUrl: "https://exemplo.com/davi.png" });
    await put("Rute", { rarity: "COMMON", imageUrl: "https://exemplo.com/rute.png" });
    await put("Ester", { rarity: "EPIC", imageUrl: null, published: false });
    await prisma.biblicalCharacter.updateMany({ where: { name: "Paulo" }, data: { published: false } });
    const response = await api.get("/api/landing/stickers");
    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { name: "Rute", rarity: "COMMON", imageUrl: "https://exemplo.com/rute.png" },
      { name: "Davi", rarity: "RARE", imageUrl: "https://exemplo.com/davi.png" },
    ]);
  });
});
