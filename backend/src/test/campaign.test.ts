import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../db/prisma";
import { defaultXpPerStop, calculateLevel, nodeCoins } from "../services/game-rules";
import { loadXpBands, syncUserLevels } from "../services/xp-curve";
import { api, bearer, login, resetDatabase } from "./helpers";

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasDatabase)("campanha", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("o seed cria os cenários e a figurinha especial Jesus", async () => {
    const jesus = await prisma.biblicalCharacter.findUniqueOrThrow({ where: { name: "Jesus" } });
    expect(jesus.rarity).toBe("SPECIAL");
    const scenarios = await prisma.scenario.findMany({ include: { nodes: true }, orderBy: { sortOrder: "asc" } });
    expect(scenarios.length).toBe(28);
    // Uma parada por nível, sem buracos, e a última de cada cenário é a relíquia.
    const levels = scenarios.flatMap((scenario) => scenario.nodes.map((node) => node.level)).sort((a, b) => a - b);
    expect(levels).toEqual(Array.from({ length: 122 }, (_, index) => index + 1));
    for (const scenario of scenarios) {
      const last = [...scenario.nodes].sort((a, b) => b.level - a.level)[0];
      expect(last.relic).toBe(true);
      // Os 10 de lançamento dão o fragmento de Jesus; os das Pedras (depois dele) têm 4 paradas e nenhum fragmento.
      const launch = scenario.sortOrder <= 100;
      expect(last.fragment).toBe(launch);
      expect(scenario.fragmentCharacterId).toBe(launch ? jesus.id : null);
      if (!launch) expect(scenario.nodes).toHaveLength(4);
    }
    expect(scenarios.slice(10).map((scenario) => scenario.slug)).toEqual(["babel", "betel", "peniel", "horebe", "tabernaculo", "cidade-davi", "carmelo", "ossos-secos", "pentecostes", "campos-belem", "elim", "monte-oliveiras", "ur-caldeus", "susa", "ninive", "transfiguracao", "jordao", "manjedoura"]);
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
    // Fundo do quiz de cada cenário: o admin cadastra e o jogador recebe na campanha.
    await api.put(`/api/campaign/admin/scenarios/${first.id}`).set(bearer(admin)).send({ name: first.name, color: first.color, sortOrder: first.sortOrder, active: true, musicUrl: "https://exemplo.com/tema-eden.mp3", quizBackgroundUrl: "https://exemplo.com/fundo-eden.jpg" });
    expect((await api.get("/api/campaign").set(bearer(token))).body.scenarios[0].quizBackgroundUrl).toBe("https://exemplo.com/fundo-eden.jpg");

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
    // Só os 10 cenários de lançamento (níveis 1 a 50): os das Pedras vêm depois de Jesus.
    const nodes = (campaign.body.scenarios.flatMap((scenario: { nodes: Array<{ id: number; fragment: boolean; level: number }> }) => scenario.nodes) as Array<{ id: number; fragment: boolean; level: number }>).filter((node) => node.level <= 50);
    const jesus = await prisma.biblicalCharacter.findUniqueOrThrow({ where: { name: "Jesus" } });

    let last: Awaited<ReturnType<typeof api.post>> | null = null;
    const emeralds: Array<{ tier: string; prizes: Array<{ kind: string; amount?: number; name?: string; rarity?: string }> }> = [];
    for (const node of nodes) {
      last = await api.post(`/api/campaign/nodes/${node.id}/claim`).set(bearer(token));
      expect(last.status).toBe(200);
      if (last.body.emeraldChest) emeralds.push(last.body.emeraldChest);
      const owned = await prisma.userSticker.findUnique({ where: { userId_characterId: { userId: user.id, characterId: jesus.id } } });
      const lastFragment = nodes.filter((item) => item.fragment).at(-1)!;
      expect(Boolean(owned)).toBe(node.id === lastFragment.id || (owned !== null && node.id > lastFragment.id));
    }
    expect(last!.body.user.coins).toBeGreaterThan(0);

    // Ao conquistar a figurinha especial abre o Baú de Esmeralda (uma única vez) com prêmios muito bons.
    expect(emeralds).toHaveLength(1);
    const [emerald] = emeralds;
    expect(emerald.tier).toBe("EMERALD");
    expect(emerald.prizes[0]).toEqual({ kind: "COINS", amount: 1000 });
    expect(emerald.prizes.filter((prize) => prize.kind === "HELPER")).toHaveLength(4);
    expect(emerald.prizes.filter((prize) => prize.kind === "COSMETIC").map((prize) => prize.name).sort()).toEqual(["Luz da manhã", "Luz esmeralda", "Ovelha do Bom Pastor", "Pastor das ovelhas", "Verde celestial"]);
    const stickerPrizes = emerald.prizes.filter((prize) => prize.kind === "STICKER");
    // A figurinha especial vem por último; antes dela, uma épica e uma lendária.
    expect(stickerPrizes.at(-1)).toMatchObject({ name: "Jesus", rarity: "SPECIAL" });
    expect(emerald.prizes.at(-1)).toMatchObject({ kind: "STICKER", rarity: "SPECIAL" });
    expect(await prisma.userCosmetic.count({ where: { userId: user.id, cosmetic: { name: { in: ["Pastor das ovelhas", "Luz esmeralda", "Ovelha do Bom Pastor", "Verde celestial", "Luz da manhã"] } } } })).toBe(5);
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

  it("pacote surpresa e recompensa do painel nunca entregam a figurinha especial", async () => {
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

    const node = { level: 171, title: "Travessia", relic: false, fragment: false, rewardCoins: 100, rewardDefinitionId: null, rewardCosmeticId: null, posX: null, posY: null };
    const made = await api.post(`/api/campaign/admin/scenarios/${created.body.id}/nodes`).set(bearer(admin)).send(node);
    expect(made.status).toBe(201);
    // Nível já usado (em qualquer cenário), fragmento sem carta e parada vazia são recusados.
    expect((await api.post(`/api/campaign/admin/scenarios/${created.body.id}/nodes`).set(bearer(admin)).send(node)).status).toBe(400);
    expect((await api.post(`/api/campaign/admin/scenarios/${created.body.id}/nodes`).set(bearer(admin)).send({ ...node, level: 172, fragment: true })).status).toBe(400);
    expect((await api.post(`/api/campaign/admin/scenarios/${created.body.id}/nodes`).set(bearer(admin)).send({ ...node, level: 173, rewardCoins: 0 })).status).toBe(400);
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
    const started = await api.post("/api/quiz/sessions/start").set(bearer(token)).send({ quizType: "GENERAL", questionLimit: 6, training: true });
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

  it("o XP por parada sobe de cenário em cenário e o nível acompanha a curva", async () => {
    const scenarios = await prisma.scenario.findMany({ orderBy: { sortOrder: "asc" } });
    expect(scenarios.map((scenario) => scenario.xpPerStop)).toEqual(scenarios.map((_, index) => defaultXpPerStop(index)));

    // Todas as paradas pagam pelo mesmo padrão: 1 moeda a cada 10 XP do cenário (relíquia em dobro).
    const nodes = await prisma.scenarioNode.findMany({ include: { scenario: { select: { xpPerStop: true } } } });
    for (const node of nodes) expect(node.rewardCoins).toBe(nodeCoins(node.scenario.xpPerStop, node.relic));

    const bands = await loadXpBands(prisma);
    expect(bands[0]).toEqual({ fromLevel: 1, cost: 500 });
    expect(bands.length).toBe(20);

    // Quem já tem XP é reposicionado pela curva nova (e ninguém perde XP).
    const user = await prisma.user.update({ where: { email: "user@email.com" }, data: { xp: 3000, level: 40, chestLevel: 35 } });
    await syncUserLevels(prisma, true);
    const synced = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(synced.xp).toBe(3000);
    expect(synced.level).toBe(calculateLevel(3000, bands));
    expect(synced.chestLevel).toBeLessThanOrEqual(synced.level);

    // Mudar o XP por parada no painel recalcula o nível na hora.
    const admin = await login("admin2@email.com");
    const eden = scenarios[0];
    const before = synced.level;
    const res = await api.put(`/api/campaign/admin/scenarios/${eden.id}`).set(bearer(admin)).send({ name: eden.name, sortOrder: eden.sortOrder, active: true, xpPerStop: 250 });
    expect(res.status).toBe(200);
    expect(res.body.xpPerStop).toBe(250);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(after.level).toBeGreaterThan(before);

    // A campanha entrega a curva para o app calcular a barra de progresso.
    const userToken = await login("user@email.com");
    const campaign = await api.get("/api/campaign").set(bearer(userToken));
    expect(campaign.body.xpBands[0]).toEqual({ fromLevel: 1, cost: 250 });
  });

  it("pedra do Peitoral: só libera ao concluir os 3 cenários do grupo e entrega moedas, cosmético e brasão", async () => {
    const stones = await prisma.stone.findMany({ orderBy: { slot: "asc" } });
    expect(stones.map((stone) => stone.name)).toEqual(["Sardônio", "Topázio", "Carbúnculo", "Esmeralda", "Safira", "Diamante", "Jacinto", "Ágata", "Ametista", "Berilo", "Ônix", "Jaspe"]);
    const sardonio = stones[0];
    const user = await prisma.user.update({ where: { email: "user@email.com" }, data: { level: 62, coins: 0 } });
    const token = await login("user@email.com");

    const first = await api.get("/api/campaign").set(bearer(token));
    const trio = first.body.scenarios.filter((scenario: { stoneId: number | null }) => scenario.stoneId === sardonio.id) as Array<{ slug: string; nodes: Array<{ id: number }> }>;
    expect(trio.map((scenario) => scenario.slug)).toEqual(["babel", "betel", "peniel"]);
    expect(first.body.breastplate.stones).toHaveLength(12);
    expect(first.body.breastplate.stones[0]).toMatchObject({ slot: 1, state: "locked", completed: 0, required: 3 });
    expect((await api.post(`/api/campaign/stones/${sardonio.id}/claim`).set(bearer(token))).status).toBe(400);

    // Concluir só dois cenários ainda não basta.
    for (const scenario of trio.slice(0, 2)) for (const node of scenario.nodes) expect((await api.post(`/api/campaign/nodes/${node.id}/claim`).set(bearer(token))).status).toBe(200);
    const partial = await api.get("/api/campaign").set(bearer(token));
    expect(partial.body.breastplate.stones[0]).toMatchObject({ state: "locked", completed: 2 });
    expect((await api.post(`/api/campaign/stones/${sardonio.id}/claim`).set(bearer(token))).status).toBe(400);

    for (const node of trio[2].nodes) expect((await api.post(`/api/campaign/nodes/${node.id}/claim`).set(bearer(token))).status).toBe(200);
    expect((await api.get("/api/campaign").set(bearer(token))).body.breastplate.stones[0]).toMatchObject({ state: "available", completed: 3 });

    const coinsBefore = (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).coins;
    const claimed = await api.post(`/api/campaign/stones/${sardonio.id}/claim`).set(bearer(token));
    expect(claimed.status).toBe(200);
    expect(claimed.body).toMatchObject({ coins: sardonio.rewardCoins, cosmeticGranted: true, badgeGranted: true, completeReward: null });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).coins).toBe(coinsBefore + sardonio.rewardCoins);
    expect((await api.post(`/api/campaign/stones/${sardonio.id}/claim`).set(bearer(token))).status).toBe(400);
    expect((await api.get("/api/campaign").set(bearer(token))).body.breastplate).toMatchObject({ claimed: 1, complete: false });

    // O brasão da pedra se equipa e aparece na aparência do jogador.
    const badge = await prisma.cosmetic.findUniqueOrThrow({ where: { id: sardonio.badgeCosmeticId! } });
    expect(badge.type).toBe("BADGE");
    const equipped = await api.put("/api/cosmetics/equip").set(bearer(token)).send({ type: "BADGE", cosmeticId: badge.id });
    expect(equipped.status).toBe(200);
    expect(equipped.body.badge).toMatchObject({ name: "Brasão: Sardônio" });
    expect((await api.put("/api/cosmetics/equip").set(bearer(token)).send({ type: "BADGE", cosmeticId: null })).body.badge).toBeNull();
  });

  it("a 12ª pedra entrega o Peitoral Completo uma única vez", async () => {
    const stones = await prisma.stone.findMany({ orderBy: { slot: "asc" } });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "user@email.com" } });
    // Atalho de teste: o jogador já concluiu os cenários das 11 primeiras pedras e resgatou-as; falta a última.
    await prisma.userClaim.createMany({ data: stones.slice(0, 11).map((stone) => ({ userId: user.id, kind: "STONE", code: String(stone.slot), periodKey: "once" })) });
    const jaspe = stones[11];
    const group = await Promise.all([1, 2, 3].map((n) => prisma.scenario.create({ data: { slug: `jaspe-${n}`, name: `Jaspe ${n}`, sortOrder: 900 + n, stoneId: jaspe.id } })));
    const nodes = await Promise.all(group.map((scenario, index) => prisma.scenarioNode.create({ data: { scenarioId: scenario.id, level: 200 + index, relic: true, rewardCoins: 10 } })));
    await prisma.userClaim.createMany({ data: nodes.map((node) => ({ userId: user.id, kind: "CAMPAIGN", code: String(node.id), periodKey: "once" })) });
    await prisma.user.update({ where: { id: user.id }, data: { coins: 0 } });

    const token = await login("user@email.com");
    const claimed = await api.post(`/api/campaign/stones/${jaspe.id}/claim`).set(bearer(token));
    expect(claimed.status).toBe(200);
    expect(claimed.body.completeReward).toMatchObject({ coins: 2000, badgeName: "Brasão: Peitoral Completo" });
    expect(claimed.body.user.coins).toBe(jaspe.rewardCoins + 2000);
    const owned = await prisma.userCosmetic.findMany({ where: { userId: user.id, cosmetic: { name: { in: ["Brasão: Peitoral Completo", "Moldura: Peitoral Completo"] } } } });
    expect(owned).toHaveLength(2);
    const state = await api.get("/api/campaign").set(bearer(token));
    expect(state.body.breastplate).toMatchObject({ claimed: 12, complete: true, finalClaimed: true });
  });
});
