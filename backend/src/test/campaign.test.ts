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

  it("só libera a parada no nível certo e não deixa resgatar duas vezes", async () => {
    const token = await login("user@email.com");
    const before = await api.get("/api/campaign").set(bearer(token));
    expect(before.status).toBe(200);
    expect(before.body.level).toBe(1);
    const first = before.body.scenarios[0].nodes[0];
    const second = before.body.scenarios[0].nodes[1];
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

    const sticker = await prisma.userSticker.findUniqueOrThrow({ where: { userId_characterId: { userId: user.id, characterId: jesus.id } } });
    expect(sticker.duplicates).toBe(0);

    // Nem repetida existe, nem venda, nem troca.
    await prisma.userSticker.update({ where: { id: sticker.id }, data: { duplicates: 2 } });
    const sold = await api.post("/api/collection/sell").set(bearer(token)).send({ characterId: jesus.id, quantity: 1 });
    expect(sold.status).toBe(400);
    const friend = await prisma.user.findFirstOrThrow({ where: { email: "admin2@email.com" } });
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
});
