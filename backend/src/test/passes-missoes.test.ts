import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../db/prisma";
import { env } from "../lib/env";
import { monthKeyInTimeZone } from "../services/game-rules";
import { api, bearer, login, resetDatabase } from "./helpers";

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasDatabase)("missões e passes no painel", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("missões: criar exige prêmio, só admin mexe, as do sistema não se excluem", async () => {
    const admin = await login("admin2@email.com");
    const user = await login("user@email.com");
    expect((await api.get("/api/missions/admin").set(bearer(user))).status).toBe(403);

    const list = await api.get("/api/missions/admin").set(bearer(admin));
    expect(list.body.missions).toHaveLength(9);
    expect(list.body.metrics.length).toBeGreaterThan(3);

    const noReward = await api.post("/api/missions/admin").set(bearer(admin)).send({ title: "Sem prêmio", period: "DAILY", metric: "PLAY_MATCHES", target: 1, rewardCoins: 0 });
    expect(noReward.status).toBe(400);
    const created = await api.post("/api/missions/admin").set(bearer(admin)).send({ title: "Jogue 4 partidas", period: "DAILY", metric: "PLAY_MATCHES", target: 4, rewardCoins: 15 });
    expect(created.status).toBe(201);
    expect(created.body.system).toBe(false);
    expect((await api.delete(`/api/missions/admin/${created.body.id}`).set(bearer(admin))).status).toBe(204);

    const system = list.body.missions.find((mission: { system: boolean }) => mission.system);
    expect((await api.delete(`/api/missions/admin/${system.id}`).set(bearer(admin))).status).toBe(400);
    // Missão desativada não vai para os jogadores.
    await api.put(`/api/missions/admin/${system.id}`).set(bearer(admin)).send({ active: false });
    const mine = await api.get("/api/missions").set(bearer(user));
    expect(mine.body.some((mission: { code: string }) => mission.code === system.code)).toBe(false);
  });

  it("missões: importação em lote valida linha por linha e só cria no confirmar", async () => {
    const admin = await login("admin2@email.com");
    const rows = [
      { title: "Termine 3 partidas hoje", period: "Diária", metric: "Partidas terminadas", target: "3", coins: "30" },
      { title: "Acerte 50 na semana", period: "Semanal", metric: "Perguntas acertadas", target: "50", reward: "Pacote surpresa" },
      { title: "Período errado", period: "Mensal", metric: "Partidas terminadas", target: "1", coins: "10" },
      { title: "Sem prêmio", period: "Diária", metric: "Partidas terminadas", target: "1" },
      { title: "Recompensa inexistente", period: "Diária", metric: "Partidas terminadas", target: "1", reward: "Nada disso" },
    ];
    const preview = await api.post("/api/missions/admin/bulk").set(bearer(admin)).send({ rows, dryRun: true });
    expect(preview.body.valid).toBe(2);
    expect(preview.body.created).toBe(0);
    expect(preview.body.errors.map((error: { row: number }) => error.row)).toEqual([3, 4, 5]);
    expect(await prisma.mission.count()).toBe(9);

    const done = await api.post("/api/missions/admin/bulk").set(bearer(admin)).send({ rows });
    expect(done.body.created).toBe(2);
    expect(await prisma.mission.count()).toBe(11);
    // De novo: já existem.
    const again = await api.post("/api/missions/admin/bulk").set(bearer(admin)).send({ rows: rows.slice(0, 2), dryRun: true });
    expect(again.body.valid).toBe(0);
  });

  it("reações: importação em lote (loja com preço, prêmio sem preço) e pacote/animação no chat", async () => {
    const admin = await login("admin2@email.com");
    const rows = [
      { name: "Mãos para o alto", emoji: "🙌", rarity: "Rara", animation: "Girar", pack: "Louvor", price: "150" },
      { name: "Estrela de Belém", emoji: "⭐", pack: "Natal" },
      { name: "Sem nada" },
      { name: "Animação ruim", emoji: "🔥", animation: "Voar" },
    ];
    const result = await api.post("/api/cosmetics/admin/bulk-reactions").set(bearer(admin)).send({ rows });
    expect(result.body).toMatchObject({ created: 2 });
    expect(result.body.errors.map((error: { row: number }) => error.row)).toEqual([3, 4]);
    const loja = await prisma.cosmetic.findFirstOrThrow({ where: { name: "Mãos para o alto" } });
    expect(loja).toMatchObject({ type: "REACTION", unlock: "SHOP", priceCoins: 150, animation: "spin", pack: "Louvor", rarity: "RARE" });
    expect(await prisma.cosmetic.findFirstOrThrow({ where: { name: "Estrela de Belém" } })).toMatchObject({ unlock: "REWARD", priceCoins: null, animation: "pop" });
  });

  it("fundo de perfil e capa do álbum: precisam de imagem ou cor e se equipam", async () => {
    const admin = await login("admin2@email.com");
    const token = await login("user@email.com");
    const player = await prisma.user.findUniqueOrThrow({ where: { email: "user@email.com" } });
    const bad = await api.post("/api/cosmetics/admin").set(bearer(admin)).send({ type: "PROFILE_BG", name: "Vazio", unlock: "REWARD" });
    expect(bad.status).toBe(400);
    const bg = await api.post("/api/cosmetics/admin").set(bearer(admin)).send({ type: "PROFILE_BG", name: "Deserto", color: "#c8693a", unlock: "REWARD" });
    const cover = await api.post("/api/cosmetics/admin").set(bearer(admin)).send({ type: "ALBUM_COVER", name: "Couro marrom", color: "#5b3a1e", unlock: "REWARD" });
    expect([bg.status, cover.status]).toEqual([201, 201]);

    expect((await api.put("/api/cosmetics/equip").set(bearer(token)).send({ type: "ALBUM_COVER", cosmeticId: cover.body.id })).status).toBe(400);
    await prisma.userCosmetic.createMany({ data: [bg.body.id, cover.body.id].map((cosmeticId) => ({ userId: player.id, cosmeticId, source: "ADMIN" })) });
    await api.put("/api/cosmetics/equip").set(bearer(token)).send({ type: "PROFILE_BG", cosmeticId: bg.body.id });
    const look = await api.put("/api/cosmetics/equip").set(bearer(token)).send({ type: "ALBUM_COVER", cosmeticId: cover.body.id });
    expect(look.body).toMatchObject({ profileBg: { color: "#c8693a" }, albumCover: { color: "#5b3a1e" } });
  });

  it("passes: o passe fixado no mês vale; item repetido vira moedas e o degrau extra", async () => {
    const admin = await login("admin2@email.com");
    const token = await login("user@email.com");
    const player = await prisma.user.findUniqueOrThrow({ where: { email: "user@email.com" } });
    const month = monthKeyInTimeZone(new Date(), env.timezone);

    const natal = await api.post("/api/pass/admin/passes").set(bearer(admin)).send({ name: "Passe de teste", color: "#8e6bd1", pinnedMonth: month });
    expect(natal.status).toBe(201);
    const cover = await prisma.cosmetic.create({ data: { type: "ALBUM_COVER", name: "Capa do passe", rarity: "EPIC", color: "#112233", unlock: "REWARD" } });
    const tier = await api.post("/api/pass/admin/tiers").set(bearer(admin)).send({ passId: natal.body.id, level: 1, requiredXp: 10, rewardCoins: 5, rewardCosmeticId: cover.id });
    expect(tier.status).toBe(201);
    expect((await api.post("/api/pass/admin/tiers").set(bearer(admin)).send({ passId: natal.body.id, level: 1, requiredXp: 20, rewardCoins: 5 })).status).toBe(400);

    const pass = await api.get("/api/pass").set(bearer(token));
    expect(pass.body.pass).toMatchObject({ id: natal.body.id, name: "Passe de teste" });
    expect(pass.body.tiers).toHaveLength(1);

    await prisma.quizMatch.create({ data: { userId: player.id, quizType: "GENERAL", finishedAt: new Date(), questionsAnswered: 5, correctAnswers: 5, wrongAnswers: 0, xpGained: 100, scoreGained: 10 } });
    // O jogador já tinha a capa de um passe anterior: o degrau paga moedas por raridade (épica = 200).
    await prisma.userCosmetic.create({ data: { userId: player.id, cosmeticId: cover.id, source: "PASS" } });
    const before = (await prisma.user.findUniqueOrThrow({ where: { id: player.id } })).coins;
    const claimed = await api.post(`/api/pass/tiers/${tier.body.id}/claim`).set(bearer(token));
    expect(claimed.status).toBe(200);
    expect(claimed.body).toMatchObject({ cosmeticGranted: false, duplicate: { coins: 200 } });
    // Conquistas liberadas pelo resgate também pagam moedas: confere pelo menos moedas do degrau + as do item repetido.
    expect(claimed.body.user.coins).toBeGreaterThanOrEqual(before + 5 + 200);

    // Degrau de outro passe (que não vale neste mês) não resgata.
    const outro = await api.post("/api/pass/admin/passes").set(bearer(admin)).send({ name: "Outro passe" });
    const outroTier = await api.post("/api/pass/admin/tiers").set(bearer(admin)).send({ passId: outro.body.id, level: 1, requiredXp: 1, rewardCoins: 9 });
    expect((await api.post(`/api/pass/tiers/${outroTier.body.id}/claim`).set(bearer(token))).status).toBe(404);
  });

  it("passes: importação de degraus em lote e o calendário dos próximos meses", async () => {
    const admin = await login("admin2@email.com");
    const natal = await api.post("/api/pass/admin/passes").set(bearer(admin)).send({ name: "Natal" });
    const rows = [
      { pass: "Natal", level: "1", xp: "300", coins: "40" },
      { pass: "Natal", level: "2", xp: "900", reward: "Dica 50/50" },
      { pass: "Natal", level: "3", xp: "1500" },
      { pass: "Páscoa", level: "1", xp: "300", coins: "10" },
      { pass: "Natal", level: "1", xp: "300", coins: "10" },
    ];
    const result = await api.post("/api/pass/admin/tiers/bulk").set(bearer(admin)).send({ rows });
    expect(result.body.created).toBe(2);
    expect(result.body.errors.map((error: { row: number }) => error.row)).toEqual([3, 4, 5]);
    expect(await prisma.passTier.count({ where: { passId: natal.body.id } })).toBe(2);

    const schedule = await api.get("/api/pass/admin/schedule").set(bearer(admin));
    expect(schedule.body).toHaveLength(12);
    expect(schedule.body.every((month: { name: string | null }) => month.name)).toBe(true);

    // Sempre sobra pelo menos um passe.
    const all = await api.get("/api/pass/admin/passes").set(bearer(admin));
    for (const pass of all.body.slice(0, -1)) expect((await api.delete(`/api/pass/admin/passes/${pass.id}`).set(bearer(admin))).status).toBe(204);
    expect((await api.delete(`/api/pass/admin/passes/${all.body.at(-1).id}`).set(bearer(admin))).status).toBe(400);
  });

  it("itens visuais: importação em lote de qualquer tipo (ícone sem imagem entra desativado)", async () => {
    const admin = await login("admin2@email.com");
    const rows = [
      { type: "Cor do nome", name: "Dourado de Belém", rarity: "Rara", color: "#f2c94c" },
      { type: "Título", name: "Pastor de Belém", rarity: "Épica", color: "#f2c94c", effect: "Cintilar" },
      { type: "Ícone", name: "Manjedoura", rarity: "Rara" },
      { type: "Fundo de perfil", name: "Noite em Belém", color: "#1b2a5c" },
      { type: "Capa do álbum", name: "Capa Noite de Belém", rarity: "Lendária", color: "#1b2a5c" },
      { type: "Reação", name: "Estrela de Belém", emoji: "⭐", animation: "Girar", pack: "Natal", price: "120" },
      { type: "Fundo de perfil", name: "Sem cor nem imagem" },
      { type: "Moldura", name: "Moldura ruim", effect: "inexistente" },
      { type: "Brinquedo", name: "Tipo errado" },
      { type: "Cor do nome", name: "Dourado de Belém", color: "#ffffff" },
    ];
    const preview = await api.post("/api/cosmetics/admin/bulk").set(bearer(admin)).send({ rows, dryRun: true });
    expect(preview.body.valid).toBe(6);
    expect(preview.body.errors.map((error: { row: number }) => error.row)).toEqual([7, 8, 9, 10]);
    expect(await prisma.cosmetic.count({ where: { name: "Manjedoura" } })).toBe(0);

    await api.post("/api/cosmetics/admin/bulk").set(bearer(admin)).send({ rows });
    expect(await prisma.cosmetic.findFirstOrThrow({ where: { name: "Manjedoura" } })).toMatchObject({ type: "AVATAR", active: false, unlock: "REWARD" });
    expect(await prisma.cosmetic.findFirstOrThrow({ where: { name: "Pastor de Belém" } })).toMatchObject({ type: "TITLE", style: "shimmer", color: "#f2c94c" });
    expect(await prisma.cosmetic.findFirstOrThrow({ where: { name: "Estrela de Belém" } })).toMatchObject({ type: "REACTION", unlock: "SHOP", priceCoins: 120, animation: "spin", pack: "Natal" });
  });
});
