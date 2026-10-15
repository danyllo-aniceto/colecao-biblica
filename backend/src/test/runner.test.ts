import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../db/prisma";
import { api, bearer, login, resetDatabase } from "./helpers";

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasDatabase)("corrida: personagens pelo painel", () => {
  beforeEach(async () => {
    await resetDatabase();
    // Os 6 personagens do seed vêm da migração (o reset do teste não os apaga): volta tudo ao estado inicial.
    await prisma.runnerCharacter.deleteMany({ where: { system: false } });
    await prisma.runnerCharacter.updateMany({ data: { active: true, sprites: {}, sounds: {}, unlockLevel: null } });
  });

  it("o jogador vê só os personagens ativos, na ordem do painel; só admin edita", async () => {
    const user = await login("user@email.com");
    const admin = await login("admin2@email.com");
    const list = await api.get("/api/runner/characters").set(bearer(user));
    expect(list.status).toBe(200);
    expect(list.body.map((character: { slug: string }) => character.slug)).toEqual(["davi", "debora", "elias", "ester", "jonas", "daniel"]);
    expect(list.body[0]).toMatchObject({ name: "Davi", color: "#38bdf8", sprites: {}, sounds: {}, system: true });

    const davi = list.body[0];
    expect((await api.put(`/api/runner/admin/characters/${davi.id}`).set(bearer(user)).send({ active: false })).status).toBe(403);
    expect((await api.get("/api/runner/admin/characters").set(bearer(user))).status).toBe(403);
    expect((await api.post("/api/runner/admin/characters").set(bearer(user)).send({ name: "Fulano" })).status).toBe(403);

    expect((await api.put(`/api/runner/admin/characters/${davi.id}`).set(bearer(admin)).send({ active: false })).status).toBe(200);
    const after = await api.get("/api/runner/characters").set(bearer(user));
    expect(after.body.map((character: { slug: string }) => character.slug)).not.toContain("davi");
    // O painel continua vendo o desativado.
    const adminList = await api.get("/api/runner/admin/characters?size=3&page=0").set(bearer(admin));
    expect(adminList.body).toMatchObject({ totalElements: 6, totalPages: 2, size: 3 });
    expect(adminList.body.content.map((character: { slug: string }) => character.slug)).toEqual(["davi", "debora", "elias"]);
  });

  it("cria, atualiza pedaços (sprites e sons por pose) e valida os campos", async () => {
    const admin = await login("admin2@email.com");
    const bad = await api.post("/api/runner/admin/characters").set(bearer(admin)).send({ name: "  ", color: "azul" });
    expect(bad.status).toBe(400);
    const badColor = await api.post("/api/runner/admin/characters").set(bearer(admin)).send({ name: "Maria Madalena", color: "azul" });
    expect(badColor.status).toBe(400);

    const created = await api.post("/api/runner/admin/characters").set(bearer(admin)).send({ name: "Maria Madalena", color: "#ef4444", description: "Testemunha da ressurreição." });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ slug: "maria-madalena", name: "Maria Madalena", color: "#ef4444", active: true, system: false, sprites: {}, sounds: {} });
    // Mesmo nome: identificador diferente.
    const twin = await api.post("/api/runner/admin/characters").set(bearer(admin)).send({ name: "Maria Madalena" });
    expect(twin.body.slug).toBe("maria-madalena-2");

    const id = created.body.id;
    const withSprites = await api
      .put(`/api/runner/admin/characters/${id}`)
      .set(bearer(admin))
      .send({ sprites: { run: { url: "https://x/run.webp", frames: 4 }, jump: { url: "https://x/jump.webp", frames: 1 } }, sounds: { jump: "https://x/jump.mp3" } });
    expect(withSprites.status).toBe(200);
    expect(withSprites.body.sprites).toEqual({ run: { url: "https://x/run.webp", frames: 4 }, jump: { url: "https://x/jump.webp", frames: 1 } });
    expect(withSprites.body.sounds).toEqual({ jump: "https://x/jump.mp3" });

    // Campo ausente não altera; null limpa só aquela pose/som/campo.
    const partial = await api.put(`/api/runner/admin/characters/${id}`).set(bearer(admin)).send({ sprites: { jump: null, fly: { url: "https://x/fly.webp", frames: 2 } }, sounds: { jump: null, win: "https://x/win.mp3" }, description: null });
    expect(partial.body.sprites).toEqual({ run: { url: "https://x/run.webp", frames: 4 }, fly: { url: "https://x/fly.webp", frames: 2 } });
    expect(partial.body.sounds).toEqual({ win: "https://x/win.mp3" });
    expect(partial.body.description).toBeNull();
    expect(partial.body.name).toBe("Maria Madalena");

    // Quadros fora de 1–12 e pose desconhecida são recusados; pose sem imagem também.
    expect((await api.put(`/api/runner/admin/characters/${id}`).set(bearer(admin)).send({ sprites: { run: { url: "https://x/a.webp", frames: 20 } } })).status).toBe(400);
    expect((await api.put(`/api/runner/admin/characters/${id}`).set(bearer(admin)).send({ sprites: { voar: { url: "https://x/a.webp", frames: 2 } } })).status).toBe(400);
    expect((await api.put(`/api/runner/admin/characters/${id}`).set(bearer(admin)).send({ sprites: { run: { url: "", frames: 2 } } })).status).toBe(400);
    expect((await api.put("/api/runner/admin/characters/999999").set(bearer(admin)).send({ name: "Ninguém" })).status).toBe(404);
  });

  it("exclui os criados no painel; os do seed só podem ser desativados", async () => {
    const admin = await login("admin2@email.com");
    const created = await api.post("/api/runner/admin/characters").set(bearer(admin)).send({ name: "Gideão" });
    expect((await api.delete(`/api/runner/admin/characters/${created.body.id}`).set(bearer(admin))).status).toBe(204);
    expect((await api.delete(`/api/runner/admin/characters/${created.body.id}`).set(bearer(admin))).status).toBe(404);
    const davi = await prisma.runnerCharacter.findUniqueOrThrow({ where: { slug: "davi" } });
    const refused = await api.delete(`/api/runner/admin/characters/${davi.id}`).set(bearer(admin));
    expect(refused.status).toBe(400);
    expect(refused.body.message).toMatch(/não podem ser excluídos/);
  });
});
