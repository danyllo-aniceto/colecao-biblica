import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../db/prisma";
import { transaction } from "../db/prisma";
import { finalizeMatch } from "../services/quiz";
import { getSettings } from "../services/settings";
import { api, bearer, login, resetDatabase } from "./helpers";

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

async function correctOf(questionId: number) {
  return (await prisma.question.findUniqueOrThrow({ where: { id: questionId } })).correctOption;
}
const wrong = (correct: string) => (correct === "A" ? "B" : "A");

async function start(token: string, questionLimit = 2) {
  const started = await api.post("/api/quiz/sessions/start").set(bearer(token)).send({ quizType: "GENERAL", questionLimit, training: true });
  expect(started.status).toBe(200);
  return started.body as { sessionId: number; currentQuestion: { id: number } };
}

const answer = (token: string, sessionId: number, questionId: number, selectedOption: string | null) =>
  api.post(`/api/quiz/sessions/${sessionId}/answer`).set(bearer(token)).send({ questionId, selectedOption });

describe.skipIf(!hasDatabase)("recompensas novas", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe("ajudas do quiz", () => {
    it("pular troca a pergunta, multidão e pista mostram dados, ampulheta congela; cada uma uma vez", async () => {
      const user = await prisma.user.update({
        where: { email: "user@email.com" },
        data: { skipBoosts: 2, crowdBoosts: 1, verseHintBoosts: 1, freezeTimeBoosts: 1 },
      });
      await prisma.question.updateMany({ data: { bibleReference: "Êxodo 14" } });
      const token = await login("user@email.com");
      const session = await start(token);

      const skipped = await api.post(`/api/quiz/sessions/${session.sessionId}/skip`).set(bearer(token));
      expect(skipped.status).toBe(200);
      expect(skipped.body.skipUsed).toBe(true);
      expect(skipped.body.currentQuestion.id).not.toBe(session.currentQuestion.id);
      expect((await api.post(`/api/quiz/sessions/${session.sessionId}/skip`).set(bearer(token))).status).toBe(400);

      const crowd = await api.post(`/api/quiz/sessions/${session.sessionId}/crowd`).set(bearer(token));
      const percents = Object.values(crowd.body.currentQuestion.crowd as Record<string, number>);
      expect(percents.reduce((sum, value) => sum + value, 0)).toBe(100);

      const hint = await api.post(`/api/quiz/sessions/${session.sessionId}/verse-hint`).set(bearer(token));
      expect(hint.body.currentQuestion.verseHint).toBe("Êxodo 14");

      const frozen = await api.post(`/api/quiz/sessions/${session.sessionId}/freeze`).set(bearer(token));
      expect(frozen.body.currentQuestion.timeFrozen).toBe(true);
      // Congelada, a pergunta não expira mesmo com o relógio bem passado.
      await prisma.quizSession.update({ where: { id: session.sessionId }, data: { currentQuestionStartedAt: new Date(Date.now() - 10 * 60_000) } });
      const questionId = frozen.body.currentQuestion.id;
      const late = await answer(token, session.sessionId, questionId, await correctOf(questionId));
      expect(late.body).toMatchObject({ correct: true, timedOut: false });

      const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(after).toMatchObject({ skipBoosts: 1, crowdBoosts: 0, verseHintBoosts: 0, freezeTimeBoosts: 0 });
      const question = await prisma.question.findUniqueOrThrow({ where: { id: questionId } });
      expect(question.answersA + question.answersB + question.answersC + question.answersD).toBe(1);
    });

    it("segunda chance: o primeiro erro não conta e a alternativa errada sai", async () => {
      await prisma.user.update({ where: { email: "user@email.com" }, data: { secondChanceBoosts: 1 } });
      const token = await login("user@email.com");
      const session = await start(token);
      const armed = await api.post(`/api/quiz/sessions/${session.sessionId}/second-chance`).set(bearer(token));
      expect(armed.body.currentQuestion.secondChanceArmed).toBe(true);

      const questionId = session.currentQuestion.id;
      const correct = await correctOf(questionId);
      const first = await answer(token, session.sessionId, questionId, wrong(correct));
      expect(first.body).toMatchObject({ retry: true, removedOption: wrong(correct), livesRemaining: 3, wrongAnswers: 0 });
      expect(first.body).not.toHaveProperty("correctOption");
      expect((await answer(token, session.sessionId, questionId, wrong(correct))).body.message).toBe("Essa alternativa já foi eliminada");

      const second = await answer(token, session.sessionId, questionId, correct);
      expect(second.body).toMatchObject({ retry: false, correct: true, livesRemaining: 3 });
    });

    it("sequência de acertos dá pontos e moedas extras; escudo segura um erro; bênção dobra as moedas", async () => {
      await prisma.user.update({ where: { email: "user@email.com" }, data: { comboShieldBoosts: 1, doubleCoinsBoosts: 1 } });
      await prisma.gameSetting.upsert({ where: { settingKey: "combo.startAt" }, create: { settingKey: "combo.startAt", settingValue: "2" }, update: { settingValue: "2" } });
      const token = await login("user@email.com");
      const session = await start(token, 3);
      await api.post(`/api/quiz/sessions/${session.sessionId}/double-coins`).set(bearer(token));
      await api.post(`/api/quiz/sessions/${session.sessionId}/combo-shield`).set(bearer(token));

      let question = session.currentQuestion;
      const picks = ["right", "wrong", "right"];
      let last;
      for (const pick of picks) {
        const correct = await correctOf(question.id);
        last = (await answer(token, session.sessionId, question.id, pick === "right" ? correct : wrong(correct))).body;
        if (last.hasNextQuestion) question = (await api.post(`/api/quiz/sessions/${session.sessionId}/next`).set(bearer(token))).body.currentQuestion;
      }
      // Certo (1), erro com escudo (continua 1), certo (2) → bônus no 2º acerto seguido.
      expect(last.comboStreak).toBe(2);
      expect(last.matchResult).toMatchObject({ bestCombo: 2, comboBonusPoints: 5, coinMultiplier: 2 });
      // (2 acertos x 2 moedas + 1 da sequência) x 2 = 10.
      expect(last.matchResult.coinsGained).toBe(10);
    });

    it("evento ativo multiplica XP e moedas", async () => {
      await prisma.gameEvent.create({
        data: { name: "Páscoa", startsAt: new Date(Date.now() - 60_000), endsAt: new Date(Date.now() + 3_600_000), xpMultiplier: 2, coinMultiplier: 3 },
      });
      const token = await login("user@email.com");
      const session = await start(token, 1);
      const result = await answer(token, session.sessionId, session.currentQuestion.id, await correctOf(session.currentQuestion.id));
      expect(result.body.matchResult.eventName).toBe("Páscoa");
      expect(result.body.matchResult.coinsGained).toBe(6);
      const active = await api.get("/api/events/active").set(bearer(token));
      expect(active.body.name).toBe("Páscoa");
    });

    it("ajudas novas saem na loja e respeitam o limite guardado", async () => {
      await prisma.user.update({ where: { email: "user@email.com" }, data: { coins: 5000, skipBoosts: 3 } });
      const token = await login("user@email.com");
      const shop = await api.get("/api/shop").set(bearer(token));
      const skip = shop.body.find((item: { name: string }) => item.name === "Pular pergunta");
      const crowd = shop.body.find((item: { name: string }) => item.name === "Voz da multidão");
      expect((await api.post(`/api/shop/buy/${skip.id}`).set(bearer(token))).body.message).toBe('Você já tem o máximo de "Pular pergunta"');
      const bought = await api.post(`/api/shop/buy/${crowd.id}`).set(bearer(token));
      expect(bought.body.crowdBoosts).toBe(1);
    });
  });

  describe("equilíbrio", () => {
    it("loja limita figurinhas compradas por dia; ajudas não contam no limite", async () => {
      await prisma.user.update({ where: { email: "user@email.com" }, data: { coins: 10_000 } });
      const token = await login("user@email.com");
      const shop = await api.get("/api/shop").set(bearer(token));
      const pack = shop.body.find((item: { name: string }) => item.name === "Pacote surpresa");
      const crowd = shop.body.find((item: { name: string }) => item.name === "Voz da multidão");
      expect((await api.post(`/api/shop/buy/${pack.id}`).set(bearer(token))).status).toBe(200);
      const second = await api.post(`/api/shop/buy/${pack.id}`).set(bearer(token));
      expect(second.status).toBe(400);
      expect(second.body.message).toContain("1 figurinha(s) hoje");
      expect((await api.post(`/api/shop/buy/${crowd.id}`).set(bearer(token))).status).toBe(200);
      expect((await api.get("/api/shop/limits").set(bearer(token))).body).toMatchObject({ stickerLimitPerDay: 1, stickersBoughtToday: 1 });
    });

    it("nível sobe por curva progressiva", async () => {
      const player = await prisma.user.update({ where: { email: "user@email.com" }, data: { xp: 680 } });
      const token = await login("user@email.com");
      const session = await start(token, 1);
      // 1 acerto em 1 pergunta = 10 + 12 de bônus = 22 XP → 702 XP = nível 3 (700).
      const result = await answer(token, session.sessionId, session.currentQuestion.id, await correctOf(session.currentQuestion.id));
      expect(result.body.matchResult.userLevel).toBe(3);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: player.id } })).level).toBe(3);
    });
  });

  describe("visual do jogador", () => {
    it("itens grátis entram sozinhos, meta libera, loja vende e só equipa o que tem", async () => {
      const token = await login("user@email.com");
      const inventory = await api.get("/api/cosmetics").set(bearer(token));
      const item = (name: string, type: string) => inventory.body.items.find((entry: { name: string; type: string }) => entry.name === name && entry.type === type);
      expect(item("Passarinho", "AVATAR").owned).toBe(true);
      expect(item("Medalha", "AVATAR")).toMatchObject({ owned: false, progress: { current: 1, target: 10 } });

      const locked = await api.put("/api/cosmetics/equip").set(bearer(token)).send({ type: "AVATAR", cosmeticId: item("Medalha", "AVATAR").id });
      expect(locked.status).toBe(400);
      const equipped = await api.put("/api/cosmetics/equip").set(bearer(token)).send({ type: "AVATAR", cosmeticId: item("Passarinho", "AVATAR").id });
      expect(equipped.body.avatarUrl).toBe("/avatars/pomba.svg");

      await prisma.user.update({ where: { email: "user@email.com" }, data: { level: 10, coins: 1000 } });
      const later = await api.get("/api/cosmetics").set(bearer(token));
      expect(later.body.unlocked.map((entry: { name: string }) => entry.name)).toContain("Medalha");

      const gold = item("Dourado", "NAME_COLOR");
      const bought = await api.post(`/api/cosmetics/${gold.id}/buy`).set(bearer(token));
      expect(bought.body.userCoins).toBe(400);
      expect((await api.post(`/api/cosmetics/${gold.id}/buy`).set(bearer(token))).status).toBe(400);
      await api.put("/api/cosmetics/equip").set(bearer(token)).send({ type: "NAME_COLOR", cosmeticId: gold.id });

      const ranking = await api.get("/api/ranking").set(bearer(token));
      expect(ranking.body.me.look).toMatchObject({ avatarUrl: "/avatars/pomba.svg", nameColor: "#d98f00" });
    });

    it("admin cria título por meta, dá item a um jogador e não exclui itens padrão", async () => {
      const admin = await login("admin2@email.com");
      const invalid = await api.post("/api/cosmetics/admin").set(bearer(admin)).send({ type: "TITLE", name: "Sem cor", unlock: "FREE" });
      expect(invalid.status).toBe(400);
      const created = await api
        .post("/api/cosmetics/admin")
        .set(bearer(admin))
        .send({ type: "TITLE", name: "Herói do evento", color: "#ff0000", style: "glow", unlock: "REWARD", rarity: "LEGENDARY" });
      expect(created.status).toBe(201);
      const player = await prisma.user.findUniqueOrThrow({ where: { email: "user@email.com" } });
      expect((await api.post(`/api/cosmetics/admin/${created.body.id}/grant`).set(bearer(admin)).send({ userId: player.id })).body.granted).toBe(true);
      expect((await api.post(`/api/cosmetics/admin/${created.body.id}/grant`).set(bearer(admin)).send({ userId: player.id })).status).toBe(400);

      const token = await login("user@email.com");
      await api.put("/api/cosmetics/equip").set(bearer(token)).send({ type: "TITLE", cosmeticId: created.body.id });
      const profile = await api.get(`/api/cosmetics/profile/${player.id}`).set(bearer(admin));
      expect(profile.body.look.title).toMatchObject({ name: "Herói do evento", style: "glow" });

      const system = await prisma.cosmetic.findFirstOrThrow({ where: { system: true } });
      expect((await api.delete(`/api/cosmetics/admin/${system.id}`).set(bearer(admin))).status).toBe(400);
      expect((await api.get("/api/cosmetics/admin/list?type=TITLE").set(bearer(token))).status).toBe(403);
    });

    it("vitrine do perfil só aceita figurinhas próprias e reação só se tiver", async () => {
      const token = await login("user@email.com");
      const player = await prisma.user.findUniqueOrThrow({ where: { email: "user@email.com" } });
      const davi = await prisma.biblicalCharacter.findUniqueOrThrow({ where: { name: "Davi" } });
      expect((await api.put("/api/cosmetics/showcase").set(bearer(token)).send({ characterIds: [davi.id] })).status).toBe(400);
      await prisma.userSticker.create({ data: { userId: player.id, characterId: davi.id } });
      const profile = await api.put("/api/cosmetics/showcase").set(bearer(token)).send({ characterIds: [davi.id] });
      expect(profile.body.showcase.map((character: { name: string }) => character.name)).toEqual(["Davi"]);
    });
  });

  describe("baú, coleções e passe", () => {
    it("baú de nível: um por nível novo, com moedas e ajuda", async () => {
      const player = await prisma.user.update({ where: { email: "user@email.com" }, data: { level: 3, chestLevel: 1, coins: 0 } });
      const token = await login("user@email.com");
      const first = await api.post("/api/chests/open").set(bearer(token));
      expect(first.body).toMatchObject({ level: 2, coins: 26, chestsPending: 1 });
      expect(first.body.boost).not.toBeNull();
      await api.post("/api/chests/open").set(bearer(token));
      const none = await api.post("/api/chests/open").set(bearer(token));
      expect(none.status).toBe(400);
      const after = await prisma.user.findUniqueOrThrow({ where: { id: player.id } });
      expect(after.chestLevel).toBe(3);
      expect(after.coins).toBe(55);
    });

    it("coleção temática: esconde as que faltam e paga uma vez ao completar", async () => {
      const admin = await login("admin2@email.com");
      const characters = await prisma.biblicalCharacter.findMany({ take: 2, orderBy: { id: "asc" } });
      const created = await api
        .post("/api/collections/admin")
        .set(bearer(admin))
        .send({ name: "Dupla", rewardCoins: 300, characterIds: characters.map((character) => character.id) });
      expect(created.status).toBe(201);

      const token = await login("user@email.com");
      const player = await prisma.user.findUniqueOrThrow({ where: { email: "user@email.com" } });
      await prisma.userSticker.create({ data: { userId: player.id, characterId: characters[0].id } });
      const list = await api.get("/api/collections").set(bearer(token));
      expect(list.body[0]).toMatchObject({ owned: 1, total: 2, complete: false });
      expect(list.body[0].characters.find((character: { owned: boolean }) => !character.owned).name).toBeNull();
      expect((await api.post(`/api/collections/${created.body.id}/claim`).set(bearer(token))).status).toBe(400);

      await prisma.userSticker.create({ data: { userId: player.id, characterId: characters[1].id } });
      const claimed = await api.post(`/api/collections/${created.body.id}/claim`).set(bearer(token));
      expect(claimed.body.coins).toBe(300);
      expect((await api.post(`/api/collections/${created.body.id}/claim`).set(bearer(token))).status).toBe(400);
    });

    it("passe da temporada: progresso pelo XP do mês e resgate único por degrau", async () => {
      const token = await login("user@email.com");
      const player = await prisma.user.findUniqueOrThrow({ where: { email: "user@email.com" } });
      const pass = await api.get("/api/pass").set(bearer(token));
      expect(pass.body.tiers.length).toBe(8);
      const firstTier = pass.body.tiers[0];
      expect((await api.post(`/api/pass/tiers/${firstTier.id}/claim`).set(bearer(token))).status).toBe(400);

      await prisma.quizMatch.create({
        data: { userId: player.id, quizType: "GENERAL", finishedAt: new Date(), questionsAnswered: 10, correctAnswers: 10, wrongAnswers: 0, xpGained: 1600, scoreGained: 100 },
      });
      const second = pass.body.tiers[1];
      const claimed = await api.post(`/api/pass/tiers/${second.id}/claim`).set(bearer(token));
      expect(claimed.status).toBe(200);
      expect(claimed.body.user.hintBoosts).toBe(1);
      expect(claimed.body.user).not.toHaveProperty("password");
      expect((await api.post(`/api/pass/tiers/${second.id}/claim`).set(bearer(token))).status).toBe(400);
    });
  });

  describe("nível da figurinha e baú de diamante", () => {
    it("repetidas sobem o nível da figurinha (1, 2, 3 e 5 repetidas) até o nível 5", async () => {
      const token = await login("user@email.com");
      const player = await prisma.user.findUniqueOrThrow({ where: { email: "user@email.com" } });
      const davi = await prisma.biblicalCharacter.findUniqueOrThrow({ where: { name: "Davi" } });
      await prisma.userSticker.create({ data: { userId: player.id, characterId: davi.id, duplicates: 1 } });

      expect((await api.get("/api/collection/my").set(bearer(token))).body[0]).toMatchObject({ level: 1, upgradeCost: 1, duplicates: 1 });
      const first = await api.post("/api/collection/upgrade").set(bearer(token)).send({ characterId: davi.id });
      expect(first.body).toMatchObject({ level: 2, duplicates: 0, spent: 1, nextCost: 2 });

      // Faltam repetidas para o próximo nível.
      const short = await api.post("/api/collection/upgrade").set(bearer(token)).send({ characterId: davi.id });
      expect(short.status).toBe(400);
      expect(short.body.message).toMatch(/Faltam repetidas/);

      await prisma.userSticker.update({ where: { userId_characterId: { userId: player.id, characterId: davi.id } }, data: { duplicates: 10 } });
      expect((await api.post("/api/collection/upgrade").set(bearer(token)).send({ characterId: davi.id })).body).toMatchObject({ level: 3, duplicates: 8 });
      expect((await api.post("/api/collection/upgrade").set(bearer(token)).send({ characterId: davi.id })).body).toMatchObject({ level: 4, duplicates: 5 });
      expect((await api.post("/api/collection/upgrade").set(bearer(token)).send({ characterId: davi.id })).body).toMatchObject({ level: 5, duplicates: 0, nextCost: null });
      expect((await api.post("/api/collection/upgrade").set(bearer(token)).send({ characterId: davi.id })).body.message).toMatch(/nível máximo/);
    });

    it("loja vende baús (nunca o de diamante), abre na hora e respeita o limite diário de baús (3 por padrão, ajustável)", async () => {
      const token = await login("user@email.com");
      await prisma.user.update({ where: { email: "user@email.com" }, data: { coins: 10_000 } });
      const shop = (await api.get("/api/shop").set(bearer(token))).body as Array<{ id: number; name: string; rewardType: string; priceCoins: number; itemType: string }>;
      const chests = shop.filter((item) => item.rewardType.startsWith("CHEST_"));
      expect(chests.map((item) => item.name)).toEqual(["Baú de Bronze", "Baú de Prata", "Baú de Ouro"]);
      expect(chests.map((item) => item.priceCoins)).toEqual([600, 1100, 2000]);
      expect(chests.every((item) => item.itemType === "STICKER")).toBe(true);
      expect(shop.some((item) => /diamante/i.test(item.name))).toBe(false);

      const bought = await api.post(`/api/shop/buy/${chests[1].id}`).set(bearer(token));
      expect(bought.status).toBe(200);
      expect(bought.body.chestTier).toBe("SILVER");
      expect(bought.body.chestPrizes[0]).toEqual({ kind: "COINS", amount: 25 });
      expect(bought.body.chestPrizes.filter((prize: { kind: string }) => prize.kind === "HELPER")).toHaveLength(2);
      // Pagou 1.100 e recebeu as moedas do baú.
      expect(bought.body.userCoins).toBeGreaterThanOrEqual(10_000 - 1100 + 25);

      // O limite padrão é de 3 baús por dia; o 4º é recusado e o limite de figurinhas/pacotes é à parte.
      expect((await api.post(`/api/shop/buy/${chests[0].id}`).set(bearer(token))).status).toBe(200);
      expect((await api.post(`/api/shop/buy/${chests[0].id}`).set(bearer(token))).status).toBe(200);
      const fourth = await api.post(`/api/shop/buy/${chests[0].id}`).set(bearer(token));
      expect(fourth.status).toBe(400);
      expect(fourth.body.message).toContain("3 baú(s) hoje");
      expect((await api.get("/api/shop/limits").set(bearer(token))).body).toMatchObject({ chestLimitPerDay: 3, chestsBoughtToday: 3, stickersBoughtToday: 0 });
      const pack = shop.find((item) => item.rewardType === "STICKER_PACK")!;
      expect((await api.post(`/api/shop/buy/${pack.id}`).set(bearer(token))).status).toBe(200);

      // O admin muda o limite: com 4, o mesmo jogador compra mais um.
      const admin = await login("admin2@email.com");
      expect((await api.put("/api/settings/admin").set(bearer(admin)).send({ shopChestLimitPerDay: 4 })).status).toBe(200);
      expect((await api.post(`/api/shop/buy/${chests[0].id}`).set(bearer(token))).status).toBe(200);
    });

    it("visual dos baús: admin cadastra imagem, nome e cor; todos leem; cor inválida é recusada", async () => {
      const admin = await login("admin2@email.com");
      const player = await login("user@email.com");
      expect((await api.get("/api/chests/designs").set(bearer(player))).body).toEqual([]);
      expect((await api.put("/api/chests/admin/designs/gold").set(bearer(player)).send({ name: "x" })).status).toBe(403);
      expect((await api.put("/api/chests/admin/designs/gold").set(bearer(admin)).send({ color: "azul" })).status).toBe(400);

      const saved = await api.put("/api/chests/admin/designs/gold").set(bearer(admin)).send({ imageUrl: "https://exemplo.com/ouro.png", openImageUrl: "https://exemplo.com/ouro-aberto.png", name: "Tesouro de Ouro", color: "#ffcc00" });
      expect(saved.body).toEqual({ tier: "GOLD", imageUrl: "https://exemplo.com/ouro.png", openImageUrl: "https://exemplo.com/ouro-aberto.png", name: "Tesouro de Ouro", color: "#ffcc00" });
      expect((await api.get("/api/chests/designs").set(bearer(player))).body).toEqual([saved.body]);
      expect((await api.put("/api/chests/admin/designs/rubi").set(bearer(admin)).send({})).status).toBe(400);
      // Limpar os campos volta ao desenho padrão.
      const cleared = await api.put("/api/chests/admin/designs/gold").set(bearer(admin)).send({ imageUrl: null, openImageUrl: null, name: "", color: null });
      expect(cleared.body).toEqual({ tier: "GOLD", imageUrl: null, openImageUrl: null, name: null, color: null });
    });

    it("simulador de baús do painel: só admin, números coerentes e nada é gravado", async () => {
      const admin = await login("admin2@email.com");
      const player = await login("user@email.com");
      expect((await api.post("/api/admin/chests/simulate").set(bearer(player)).send({ runs: 500 })).status).toBe(403);
      const before = await prisma.userSticker.count();

      const simulation = await api.post("/api/admin/chests/simulate").set(bearer(admin)).send({ runs: 1000 });
      expect(simulation.status).toBe(200);
      const { tiers, thresholds } = simulation.body;
      expect(thresholds).toMatchObject({ bronze: 7, silver: 15, gold: 40, diamond: 70, dailyLimit: 5 });
      // Ouro e diamante sempre trazem figurinha; o bronze, só às vezes.
      expect(tiers.GOLD.chanceSticker).toBe(1);
      expect(tiers.BRONZE.chanceSticker).toBeGreaterThan(0.3);
      expect(tiers.BRONZE.chanceSticker).toBeLessThan(0.6);
      expect(tiers.BRONZE.avgCoins).toBe(10);
      expect(tiers.DIAMOND.avgCoins).toBe(100);
      expect(tiers.GOLD.samples).toHaveLength(3);
      expect(tiers.GOLD.samples[0][0]).toMatchObject({ kind: "COINS", amount: 50 });
      expect(await prisma.userSticker.count()).toBe(before);
    });

    it("diamante: figurinha épica ou lendária, extras, e só um por dia (o resto vira ouro)", async () => {
      const player = await prisma.user.findUniqueOrThrow({ where: { email: "user@email.com" } });
      await prisma.biblicalCharacter.createMany({
        data: [
          { name: "Épico de teste", rarity: "EPIC", shortSummary: "<p>x</p>", fullDescription: "<p>x</p>", published: true, createdBy: "teste" },
          { name: "Lendário de teste", rarity: "LEGENDARY", shortSummary: "<p>x</p>", fullDescription: "<p>x</p>", published: true, createdBy: "teste" },
        ],
      });
      const play = (correctAnswers: number) =>
        transaction(async (tx) => {
          const user = await tx.user.findUniqueOrThrow({ where: { id: player.id } });
          const settings = await getSettings(tx);
          return finalizeMatch(tx, user, settings, {
            quizType: "GENERAL",
            questionsAnswered: correctAnswers + 3,
            correctAnswers,
            wrongAnswers: 3,
            characterId: null,
            xpMultiplier: 1,
            startedAt: new Date(),
          }, () => 0.1);
        });

      const first = await play(70);
      expect(first).toMatchObject({ chestTier: "DIAMOND", chestCoins: 100, rewardCharacterRarity: "EPIC" });
      const prizes = first.chestPrizes as Array<{ kind: string; rarity?: string }>;
      expect(prizes.filter((prize) => prize.kind === "HELPER")).toHaveLength(3);
      const stickers = prizes.filter((prize) => prize.kind === "STICKER");
      expect(stickers.length).toBeGreaterThanOrEqual(1);
      expect(stickers.every((prize) => prize.rarity === "EPIC" || prize.rarity === "LEGENDARY")).toBe(true);
      expect((await prisma.quizMatch.findUniqueOrThrow({ where: { id: first.matchId } })).chestTier).toBe("DIAMOND");

      // O limite é de 1 diamante por dia: o segundo vira baú de ouro.
      const second = await play(75);
      expect(second.chestTier).toBe("GOLD");

      // Abaixo do corte não é diamante.
      expect((await play(45)).chestTier).toBe("GOLD");
    });
  });
});
