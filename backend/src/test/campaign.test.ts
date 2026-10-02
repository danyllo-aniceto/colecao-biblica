import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../db/prisma";
import { api, bearer, login, resetDatabase } from "./helpers";

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasDatabase)("campanha", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("o seed cria os cenários e a carta especial Jesus", async () => {
    const jesus = await prisma.biblicalCharacter.findUniqueOrThrow({ where: { name: "Jesus" } });
    expect(jesus.rarity).toBe("SPECIAL");
    const scenarios = await prisma.scenario.findMany({ include: { nodes: true }, orderBy: { sortOrder: "asc" } });
    expect(scenarios.length).toBe(10);
    // Uma parada por nível, sem buracos, e a última de cada cenário é a relíquia com fragmento.
    const levels = scenarios.flatMap((scenario) => scenario.nodes.map((node) => node.level)).sort((a, b) => a - b);
    expect(levels).toEqual(Array.from({ length: 50 }, (_, index) => index + 1));
    for (const scenario of scenarios) {
      const last = [...scenario.nodes].sort((a, b) => b.level - a.level)[0];
      expect(last.relic).toBe(true);
      expect(last.fragment).toBe(true);
      expect(scenario.fragmentCharacterId).toBe(jesus.id);
    }
  });

  it("música do tema: o admin cadastra e só chega ao jogador no nível do cenário", async () => {
    const admin = await login("admin2@email.com");
    const scenarios = await prisma.scenario.findMany({ orderBy: { sortOrder: "asc" }, include: { nodes: { orderBy: { level: "asc" } } } });
    const [first, second] = scenarios;
    const saved = await api.put(`/api/campaign/admin/scenarios/${first.id}`).set(bearer(admin)).send({ name: first.name, color: first.color, sortOrder: first.sortOrder, active: true, musicUrl: "https://exemplo.com/tema-eden.mp3" });
    expect(saved.status).toBe(200);
    expect(saved.body.musicUrl).toBe("https://exemplo.com/tema-eden.mp3");
    await api.put(`/api/campaign/admin/scenarios/${second.id}`).set(bearer(admin)).send({ name: second.name, color: second.color, sortOrder: second.sortOrder, active: true, musicUrl: "/api/uploads/file/musicas/tema-arca.mp3" });
    // Endereço que não é áudio do app nem link é recusado.
    expect((await api.put(`/api/campaign/admin/scenarios/${first.id}`).set(bearer(admin)).send({ name: first.name, sortOrder: first.sortOrder, active: true, musicUrl: "javascript:alert(1)" })).status).toBe(400);

    const token = await login("user@email.com");
    const before = await api.get("/api/campaign").set(bearer(token));
    expect(before.body.scenarios[0]).toMatchObject({ musicUnlocked: true, musicUrl: "https://exemplo.com/tema-eden.mp3" });
    expect(before.body.scenarios[1]).toMatchObject({ musicUnlocked: false, musicUrl: null });

    await prisma.user.update({ where: { email: "user@email.com" }, data: { level: second.nodes[0].level } });
    const after = await api.get("/api/campaign").set(bearer(token));
    expect(after.body.scenarios[1]).toMatchObject({ musicUnlocked: true, musicUrl: "/api/uploads/file/musicas/tema-arca.mp3" });
  });

  it("só libera a parada no nível certo e não deixa resgatar duas vezes", async () => {
    const token = await login("user@email.com");
    const before = await api.get("/api/campaign").set(bearer(token));
    expect(before.status).toBe(200);
    expect(before.body.level).toBe(1);
    const first = before.body.scenarios[0].nodes[0];
    const second = before.body.scenarios[0].nodes[1];
    expect(before.body.currentScenarioId).toBe(before.body.scenarios[0].id);
    expect(first.state).toBe("available");
    expect(second.state).toBe("locked");

    const tooEarly = await api.post(`/api/campaign/nodes/${second.id}/claim`).set(bearer(token));
    expect(tooEarly.status).toBe(400);

    const claimed = await api.post(`/api/campaign/nodes/${first.id}/claim`).set(bearer(token));
    expect(claimed.status).toBe(200);
    expect(claimed.body.coins).toBe(first.rewardCoins);
    const again = await api.post(`/api/campaign/nodes/${first.id}/claim`).set(bearer(token));
    expect(again.status).toBe(400);

    const after = await api.get("/api/campaign").set(bearer(token));
    expect(after.body.scenarios[0].nodes[0].state).toBe("claimed");
    expect(after.body.special.fragments).toBe(0);

    // O cenário atual segue o nível: no nível 15 é o Egito, mesmo sem ter resgatado o Éden inteiro.
    await prisma.user.update({ where: { email: "user@email.com" }, data: { level: 15 } });
    const egypt = await api.get("/api/campaign").set(bearer(token));
    expect(egypt.body.scenarios.find((scenario: { id: number; slug: string }) => scenario.id === egypt.body.currentScenarioId).slug).toBe("egito");
  });

  it("juntar todos os fragmentos entrega Jesus, que é intransferível e não vira repetida", async () => {
    const user = await prisma.user.update({ where: { email: "user@email.com" }, data: { level: 60, coins: 0 } });
    const token = await login("user@email.com");
    const campaign = await api.get("/api/campaign").set(bearer(token));
    const nodes = campaign.body.scenarios.flatMap((scenario: { nodes: Array<{ id: number; fragment: boolean }> }) => scenario.nodes) as Array<{ id: number; fragment: boolean }>;
    const jesus = await prisma.biblicalCharacter.findUniqueOrThrow({ where: { name: "Jesus" } });

    let last: Awaited<ReturnType<typeof api.post>> | null = null;
    for (const node of nodes) {
      last = await api.post(`/api/campaign/nodes/${node.id}/claim`).set(bearer(token));
      expect(last.status).toBe(200);
      const owned = await prisma.userSticker.findUnique({ where: { userId_characterId: { userId: user.id, characterId: jesus.id } } });
      const lastFragment = nodes.filter((item) => item.fragment).at(-1)!;
      expect(Boolean(owned)).toBe(node.id === lastFragment.id || (owned !== null && node.id > lastFragment.id));
    }
    expect(last!.body.user.coins).toBeGreaterThan(0);
    // Cada relíquia entrega também o ícone de perfil do cenário.
    const avatars = await prisma.userCosmetic.findMany({ where: { userId: user.id, cosmetic: { type: "AVATAR", name: { startsWith: "Ícone: " } } }, include: { cosmetic: true } });
    expect(avatars).toHaveLength(10);
    expect(avatars.every((item) => item.cosmetic.imageUrl?.startsWith("/campaign/"))).toBe(true);

    const sticker = await prisma.userSticker.findUniqueOrThrow({ where: { userId_characterId: { userId: user.id, characterId: jesus.id } } });
    expect(sticker.duplicates).toBe(0);

    // Nem repetida existe, nem venda, nem troca.
    await prisma.userSticker.update({ where: { id: sticker.id }, data: { duplicates: 2 } });
    const sold = await api.post("/api/collection/sell").set(bearer(token)).send({ characterId: jesus.id, quantity: 1 });
    expect(sold.status).toBe(400);
    const friend = await prisma.user.findFirstOrThrow({ where: { email: "outro@email.com" } });
    await prisma.friendship.create({ data: { requesterId: user.id, addresseeId: friend.id, status: "ACCEPTED" } });
    const trade = await api.post("/api/social/trades").set(bearer(token)).send({ toUserId: friend.id, offeredCharacterId: jesus.id });
    expect(trade.status).toBe(400);
  });

  it("pacote surpresa e recompensa do painel nunca entregam a carta especial", async () => {
    const admin = await login("admin2@email.com");
    const jesus = await prisma.biblicalCharacter.findUniqueOrThrow({ where: { name: "Jesus" } });
    const reward = await api
      .post("/api/rewards/admin")
      .set(bearer(admin))
      .send({ name: "Jesus de graça", rewardType: "STICKER", stickerCharacterId: jesus.id, dropChance: 1 });
    expect(reward.status).toBe(400);
    const byRarity = await api.post("/api/rewards/admin").set(bearer(admin)).send({ name: "Especial", rewardType: "STICKER", stickerRarity: "SPECIAL", dropChance: 1 });
    expect(byRarity.status).toBe(400);
  });

  it("cada cenário dá itens visuais exclusivos ao longo do caminho", async () => {
    const scenarios = await prisma.scenario.findMany({ include: { nodes: { include: { rewardCosmetic: true } } } });
    for (const scenario of scenarios) {
      const types = scenario.nodes.map((node) => node.rewardCosmetic?.type).filter(Boolean);
      expect(types).toEqual(expect.arrayContaining(["REACTION", "NAME_COLOR", "FRAME", "TITLE"]));
    }
    // Quem resgata a primeira parada (reação) passa a ter o item.
    const token = await login("user@email.com");
    const campaign = await api.get("/api/campaign").set(bearer(token));
    const first = campaign.body.scenarios[0].nodes[0];
    expect(first.cosmetic.type).toBe("REACTION");
    const claimed = await api.post(`/api/campaign/nodes/${first.id}/claim`).set(bearer(token));
    expect(claimed.body.cosmeticGranted).toBe(true);
    expect(claimed.body.cosmeticName).toContain("Reação");
  });

  it("o painel cria cenários e paradas, com as validações", async () => {
    const admin = await login("admin2@email.com");
    const user = await login("user@email.com");
    expect((await api.get("/api/campaign/admin/scenarios").set(bearer(user))).status).toBe(403);

    const created = await api.post("/api/campaign/admin/scenarios").set(bearer(admin)).send({
      slug: "mar-vermelho", name: "Mar Vermelho", description: null, verse: null, verseReference: null, color: "#2288cc",
      mapImageUrl: null, iconImageUrl: null, fragmentCharacterId: null, sortOrder: 500, active: true,
    });
    expect(created.status).toBe(201);
    expect(created.body.avatarCosmeticId).not.toBeNull();
    const repeated = await api.post("/api/campaign/admin/scenarios").set(bearer(admin)).send({ ...created.body, slug: "mar-vermelho" });
    expect(repeated.status).toBe(400);

    const node = { level: 51, title: "Travessia", relic: false, fragment: false, rewardCoins: 100, rewardDefinitionId: null, rewardCosmeticId: null, posX: null, posY: null };
    const made = await api.post(`/api/campaign/admin/scenarios/${created.body.id}/nodes`).set(bearer(admin)).send(node);
    expect(made.status).toBe(201);
    // Nível já usado (em qualquer cenário), fragmento sem carta e parada vazia são recusados.
    expect((await api.post(`/api/campaign/admin/scenarios/${created.body.id}/nodes`).set(bearer(admin)).send(node)).status).toBe(400);
    expect((await api.post(`/api/campaign/admin/scenarios/${created.body.id}/nodes`).set(bearer(admin)).send({ ...node, level: 52, fragment: true })).status).toBe(400);
    expect((await api.post(`/api/campaign/admin/scenarios/${created.body.id}/nodes`).set(bearer(admin)).send({ ...node, level: 53, rewardCoins: 0 })).status).toBe(400);
    expect((await api.put(`/api/campaign/admin/nodes/${made.body.id}`).set(bearer(admin)).send({ ...node, rewardCoins: 150 })).body.rewardCoins).toBe(150);

    // Trocar o ícone do cenário troca a arte do ícone de perfil.
    const icon = "https://exemplo.com/icone.png";
    const updated = await api.put(`/api/campaign/admin/scenarios/${created.body.id}`).set(bearer(admin)).send({ ...created.body, slug: undefined, iconImageUrl: icon });
    expect(updated.status).toBe(200);
    expect((await prisma.cosmetic.findUniqueOrThrow({ where: { id: created.body.avatarCosmeticId } })).imageUrl).toBe(icon);

    // Editor de posições: salva em lote, valida o cenário e permite voltar ao automático.
    const nodeIds = [made.body.id as number];
    const saved = await api.put(`/api/campaign/admin/scenarios/${created.body.id}/positions`).set(bearer(admin)).send({ positions: [{ id: nodeIds[0], posX: 40, posY: 55 }] });
    expect(saved.status).toBe(200);
    expect(await prisma.scenarioNode.findUniqueOrThrow({ where: { id: nodeIds[0] } })).toMatchObject({ posX: 40, posY: 55 });
    const foreign = await prisma.scenarioNode.findFirstOrThrow({ where: { scenarioId: { not: created.body.id } } });
    expect((await api.put(`/api/campaign/admin/scenarios/${created.body.id}/positions`).set(bearer(admin)).send({ positions: [{ id: foreign.id, posX: 1, posY: 1 }] })).status).toBe(400);
    expect((await api.put(`/api/campaign/admin/scenarios/${created.body.id}/positions`).set(bearer(admin)).send({ positions: [{ id: nodeIds[0], posX: 10, posY: null }] })).status).toBe(400);
    expect((await api.put(`/api/campaign/admin/scenarios/${created.body.id}/positions`).set(bearer(admin)).send({ positions: [{ id: nodeIds[0], posX: 101, posY: 5 }] })).status).toBe(400);
    await api.put(`/api/campaign/admin/scenarios/${created.body.id}/positions`).set(bearer(admin)).send({ positions: [{ id: nodeIds[0], posX: null, posY: null }] });
    expect((await prisma.scenarioNode.findUniqueOrThrow({ where: { id: nodeIds[0] } })).posX).toBeNull();

    const system = await prisma.scenario.findFirstOrThrow({ where: { system: true } });
    expect((await api.delete(`/api/campaign/admin/scenarios/${system.id}`).set(bearer(admin))).status).toBe(400);
    expect((await api.delete(`/api/campaign/admin/scenarios/${created.body.id}`).set(bearer(admin))).status).toBe(204);
  });

  it("perguntas do cenário entram com prioridade na partida geral de quem está nele", async () => {
    const eden = await prisma.scenario.findUniqueOrThrow({ where: { slug: "eden" } });
    const base = await prisma.question.findFirstOrThrow();
    const created = [];
    for (let index = 0; index < 8; index += 1) {
      created.push(
        await prisma.question.create({
          data: { text: `Pergunta do Éden ${index}`, difficulty: "EASY", timeLimitSeconds: 30, optionA: "a", optionB: "b", optionC: "c", optionD: "d", correctOption: "A", scenarioId: eden.id },
        }),
      );
    }
    expect(base.scenarioId).toBeNull();
    const token = await login("user@email.com");
    const started = await api.post("/api/quiz/sessions/start").set(bearer(token)).send({ quizType: "GENERAL", questionLimit: 6 });
    expect(started.status).toBe(200);
    const session = await prisma.quizSession.findUniqueOrThrow({ where: { id: started.body.sessionId } });
    const ids = session.questionIds as number[];
    expect(ids).toHaveLength(6);
    const fromScenario = ids.filter((id) => created.some((question) => question.id === id));
    expect(fromScenario.length).toBeGreaterThanOrEqual(3);

    // O painel liga e desliga a pergunta de um cenário.
    const admin = await login("admin2@email.com");
    const linked = await api.put(`/api/questions/admin/${base.id}`).set(bearer(admin)).send({ scenarioId: eden.id });
    expect(linked.body.scenarioName).toBe("Jardim do Éden");
    expect((await api.put(`/api/questions/admin/${base.id}`).set(bearer(admin)).send({ scenarioId: null })).body.scenarioId).toBeNull();
    expect((await api.put(`/api/questions/admin/${base.id}`).set(bearer(admin)).send({ scenarioId: 9999 })).status).toBe(404);
  });
});
