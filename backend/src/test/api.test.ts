import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../db/prisma";
import { api, bearer, login, resetDatabase } from "./helpers";

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

async function correctOptionOf(questionId: number) {
  const question = await prisma.question.findUniqueOrThrow({ where: { id: questionId } });
  return question.correctOption;
}

const wrongOption = (correct: string) => (correct === "A" ? "B" : "A");

/** Responde a partida inteira; `pick` decide a alternativa de cada pergunta. */
async function playSession(token: string, start: Record<string, unknown>, pick: (correct: string, index: number) => string | null) {
  const started = await api.post("/api/quiz/sessions/start").set(bearer(token)).send(start);
  expect(started.status).toBe(200);
  let question = started.body.currentQuestion;
  let last;
  for (let index = 0; question; index += 1) {
    const correct = await correctOptionOf(question.id);
    last = await api
      .post(`/api/quiz/sessions/${started.body.sessionId}/answer`)
      .set(bearer(token))
      .send({ questionId: question.id, selectedOption: pick(correct, index) });
    expect(last.status).toBe(200);
    expect(last.body).not.toHaveProperty("nextQuestion");
    question = null;
    if (last.body.hasNextQuestion) {
      const next = await api.post(`/api/quiz/sessions/${started.body.sessionId}/next`).set(bearer(token));
      expect(next.status).toBe(200);
      question = next.body.currentQuestion;
    }
  }
  return { sessionId: started.body.sessionId as number, last: last!.body };
}

describe.skipIf(!hasDatabase)("API", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  describe("autenticação e contas", () => {
    it("faz login, renova o token e rejeita senha errada com a mesma mensagem", async () => {
      const ok = await api.post("/api/auth/login").send({ email: "USER@email.com", password: "123456" });
      expect(ok.status).toBe(200);
      expect(ok.body.accessToken).toBeTruthy();

      const refreshed = await api.post("/api/auth/refresh").send({ refreshToken: ok.body.refreshToken });
      expect(refreshed.status).toBe(200);

      // Access token não serve como refresh.
      const wrongType = await api.post("/api/auth/refresh").send({ refreshToken: ok.body.accessToken });
      expect(wrongType.status).toBe(401);

      const wrong = await api.post("/api/auth/login").send({ email: "user@email.com", password: "errada" });
      const unknown = await api.post("/api/auth/login").send({ email: "ninguem@email.com", password: "123456" });
      expect(wrong.status).toBe(401);
      expect(wrong.body.message).toBe("E-mail ou senha inválidos");
      expect(unknown.body.message).toBe(wrong.body.message);
    });

    it("exige token nas rotas protegidas", async () => {
      const response = await api.get("/api/users/me");
      expect(response.status).toBe(401);
      expect(response.body.message).toBeTruthy();
      expect((await api.get("/api/users/me").set(bearer("lixo"))).status).toBe(401);
    });

    it("cadastro público sempre cria jogador comum, mesmo pedindo ADMIN", async () => {
      const created = await api.post("/api/users").send({ name: "Novo", email: "Novo@Email.com", password: "123456", role: "ADMIN" });
      expect(created.status).toBe(201);
      expect(created.body.role).toBe("USER");
      expect(created.body.email).toBe("novo@email.com");
      expect(created.body).not.toHaveProperty("password");

      const duplicated = await api.post("/api/users").send({ name: "Outro", email: "novo@email.com", password: "123456" });
      expect(duplicated.status).toBe(400);
      expect(duplicated.body.message).toBe("E-mail já cadastrado");
    });

    it("valida o cadastro com mensagens por campo", async () => {
      const response = await api.post("/api/users").send({ name: "", email: "invalido", password: "1" });
      expect(response.status).toBe(400);
      expect(Object.keys(response.body.fields)).toEqual(expect.arrayContaining(["name", "email", "password"]));
    });

    it("admin logado pode criar outro admin pelo painel", async () => {
      const admin = await login("admin2@email.com");
      const created = await api.post("/api/users").set(bearer(admin)).send({ name: "Chefe", email: "chefe@email.com", password: "123456", role: "ADMIN" });
      expect(created.body.role).toBe("ADMIN");
      expect(created.body.createdBy).toBe("admin2@email.com");
    });

    it("jogador não consegue se promover a admin nem editar outra conta", async () => {
      const token = await login("user@email.com");
      const me = await api.get("/api/users/me").set(bearer(token));

      const promote = await api.put(`/api/users/${me.body.id}`).set(bearer(token)).send({ role: "ADMIN" });
      expect(promote.status).toBe(403);

      const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin2@email.com" } });
      const other = await api.put(`/api/users/${admin.id}`).set(bearer(token)).send({ name: "Hack" });
      expect(other.status).toBe(403);

      const rename = await api.put(`/api/users/${me.body.id}`).set(bearer(token)).send({ name: "Novo Nome", password: "" });
      expect(rename.status).toBe(200);
      expect(rename.body.name).toBe("Novo Nome");
    });

    it("excluir a conta invalida o login e o token", async () => {
      const token = await login("user@email.com");
      const me = await api.get("/api/users/me").set(bearer(token));
      expect((await api.delete(`/api/users/${me.body.id}`).set(bearer(token))).status).toBe(204);
      expect((await api.get("/api/users/me").set(bearer(token))).status).toBe(401);
      expect((await api.post("/api/auth/login").send({ email: "user@email.com", password: "123456" })).status).toBe(401);
    });

    it("lista usuários paginados só para admin", async () => {
      const user = await login("user@email.com");
      expect((await api.get("/api/users").set(bearer(user))).status).toBe(403);

      const admin = await login("admin2@email.com");
      const page = await api.get("/api/users?page=0&size=1&role=user").set(bearer(admin));
      expect(page.status).toBe(200);
      expect(page.body).toMatchObject({ totalElements: 2, totalPages: 2, number: 0, size: 1 });
      expect(page.body.content[0].email).toBe("user@email.com");
    });
  });

  describe("conteúdo (admin)", () => {
    it("perguntas com resposta só aparecem para admin", async () => {
      const user = await login("user@email.com");
      expect((await api.get("/api/questions").set(bearer(user))).status).toBe(403);
      const admin = await login("admin2@email.com");
      const questions = await api.get("/api/questions").set(bearer(admin));
      expect(questions.body).toMatchObject({ totalElements: 3, number: 0 });
      expect(questions.body.content[0]).toHaveProperty("correctOption");

      const filtered = await api.get("/api/questions?search=golias&difficulty=easy&size=1").set(bearer(admin));
      expect(filtered.body.totalElements).toBe(1);
      expect(filtered.body.content[0].text).toBe("Quem derrotou Golias?");
      expect((await api.get("/api/questions?characterId=none").set(bearer(admin))).body.totalElements).toBe(0);
    });

    it("cria personagem e pergunta com tempo padrão pela dificuldade", async () => {
      const admin = await login("admin2@email.com");
      const character = await api
        .post("/api/characters/admin")
        .set(bearer(admin))
        .send({ name: "Rute", rarity: "COMMON", shortSummary: "Moabita fiel", fullDescription: "História de Rute" });
      expect(character.status).toBe(201);
      expect(character.body.createdBy).toBe("admin2@email.com");

      const duplicated = await api.post("/api/characters/admin").set(bearer(admin)).send({ name: "rute", rarity: "COMMON", shortSummary: "x", fullDescription: "y" });
      expect(duplicated.body.message).toBe("Já existe um personagem com esse nome");

      const question = await api.post("/api/questions/admin").set(bearer(admin)).send({
        text: "Quem era sogra de Rute?",
        difficulty: "HARD",
        optionA: "Noemi",
        optionB: "Ana",
        optionC: "Sara",
        optionD: "Raquel",
        correctOption: "a",
        relatedCharacterId: character.body.id,
      });
      expect(question.status).toBe(201);
      expect(question.body).toMatchObject({ timeLimitSeconds: 20, correctOption: "A", relatedCharacterName: "Rute", active: true });

      const user = await login("user@email.com");
      const forbidden = await api.post("/api/characters/admin").set(bearer(user)).send({ name: "X", rarity: "COMMON", shortSummary: "x", fullDescription: "y" });
      expect(forbidden.status).toBe(403);
    });

    it("recompensas e itens fixos são ajustáveis; os criados pelo admin podem ser removidos", async () => {
      const admin = await login("admin2@email.com");
      expect((await api.post("/api/rewards/admin").set(bearer(admin)).send({})).status).toBe(400);
      expect((await api.delete("/api/shop/admin/1").set(bearer(admin))).status).toBe(400);
      expect((await api.delete("/api/rewards/admin/1").set(bearer(admin))).status).toBe(400);

      const rewards = await api.get("/api/rewards").set(bearer(admin));
      expect(rewards.body).toHaveLength(18);
      expect(rewards.body.every((reward: { system: boolean }) => reward.system)).toBe(true);
      const coins = rewards.body.find((reward: { rewardType: string }) => reward.rewardType === "COINS");
      const zero = await api.put(`/api/rewards/admin/${coins.id}`).set(bearer(admin)).send({ dropChance: 0 });
      expect(zero.body.message).toBe("Chance de drop deve ser maior que zero");
      const updated = await api.put(`/api/rewards/admin/${coins.id}`).set(bearer(admin)).send({ coinAmount: 80, dropChance: 12.5 });
      expect(updated.body).toMatchObject({ coinAmount: 80, dropChance: 12.5 });

      // Rodar o seed de novo não desfaz o ajuste.
      await resetDatabaseKeepingRewards();
      const again = await api.get("/api/rewards").set(bearer(admin));
      expect(again.body.find((reward: { id: number }) => reward.id === coins.id).coinAmount).toBe(80);

      // Recompensa e item criados pelo admin sobrevivem ao seed e podem ser excluídos.
      const custom = await api
        .post("/api/rewards/admin")
        .set(bearer(admin))
        .send({ name: "Saco de moedas", rewardType: "COINS", amount: 300, dropChance: 1 });
      expect(custom.status).toBe(201);
      expect(custom.body).toMatchObject({ coinAmount: 300, system: false });
      const coinItem = await api
        .post("/api/shop/admin")
        .set(bearer(admin))
        .send({ name: "Moedas", description: "x", itemType: "ECONOMY", priceCoins: 10, rewardDefinitionId: custom.body.id });
      expect(coinItem.body.message).toBe("Itens de loja não podem conceder moedas");

      const fifty = rewards.body.find((reward: { rewardType: string }) => reward.rewardType === "FIFTY_FIFTY");
      const item = await api
        .post("/api/shop/admin")
        .set(bearer(admin))
        .send({ name: "Combo de dicas", description: "Promoção", itemType: "GAME_BONUS", priceCoins: 99, rewardDefinitionId: fifty.id, active: false });
      expect(item.status).toBe(201);
      await resetDatabaseKeepingRewards();
      const adminShop = await api.get("/api/shop/admin").set(bearer(admin));
      expect(adminShop.body.find((entry: { id: number }) => entry.id === item.body.id)).toMatchObject({ active: false, system: false });
      expect((await api.get("/api/shop").set(bearer(admin))).body.some((entry: { id: number }) => entry.id === item.body.id)).toBe(false);
      expect((await api.delete(`/api/shop/admin/${item.body.id}`).set(bearer(admin))).status).toBe(204);
      expect((await api.delete(`/api/rewards/admin/${custom.body.id}`).set(bearer(admin))).status).toBe(204);
    });

    it("personagem: rascunho não aparece para o jogador e campos opcionais podem ser limpos", async () => {
      const admin = await login("admin2@email.com");
      const empty = await api.post("/api/characters/admin").set(bearer(admin)).send({ name: "Noé", rarity: "COMMON", shortSummary: "<p></p>", fullDescription: "x" });
      expect(empty.body.fields.shortSummary).toBeTruthy();

      const draft = await api
        .post("/api/characters/admin")
        .set(bearer(admin))
        .send({ name: "Noé", rarity: "COMMON", published: false, shortSummary: "<p>Construiu a arca</p>", fullDescription: "x", curiosities: "Viveu 950 anos", testament: "OLD" });
      expect(draft.status).toBe(201);

      const user = await login("user@email.com");
      const album = await api.get("/api/characters").set(bearer(user));
      expect(album.body.map((character: { name: string }) => character.name)).not.toContain("Noé");
      expect(album.body[0]).not.toHaveProperty("fullDescription");
      expect((await api.get(`/api/characters/${draft.body.id}`).set(bearer(user))).status).toBe(404);

      const cleared = await api.put(`/api/characters/admin/${draft.body.id}`).set(bearer(admin)).send({ curiosities: "", testament: null, published: true });
      expect(cleared.body).toMatchObject({ curiosities: null, testament: null, published: true });

      // Publicado, mas a ficha completa só abre para quem conquistou a figurinha.
      expect((await api.get(`/api/characters/${draft.body.id}`).set(bearer(user))).status).toBe(403);
      const player = await prisma.user.findUniqueOrThrow({ where: { email: "user@email.com" } });
      await prisma.userSticker.create({ data: { userId: player.id, characterId: draft.body.id } });
      expect((await api.get(`/api/characters/${draft.body.id}`).set(bearer(user))).body).toMatchObject({ name: "Noé" });
      expect((await api.get(`/api/characters/${draft.body.id}`).set(bearer(admin))).status).toBe(200);

      const list = await api.get("/api/characters/admin/list?issue=noQuestions&size=50").set(bearer(admin));
      expect(list.body.content.map((character: { name: string }) => character.name)).toContain("Noé");
    });

    it("valida e salva as configurações do jogo", async () => {
      const admin = await login("admin2@email.com");
      const invalid = await api.put("/api/settings/admin").set(bearer(admin)).send({ startingLives: 0 });
      expect(invalid.status).toBe(400);
      expect(invalid.body.fields.startingLives).toBeTruthy();

      const saved = await api.put("/api/settings/admin").set(bearer(admin)).send({ startingLives: 5, doubleXpMultiplier: 3 });
      expect(saved.body).toMatchObject({ startingLives: 5, doubleXpMultiplier: 3, maxQuestionsPerMatch: 100 });
    });
  });

  describe("quiz", () => {
    it("maratona perfeita dá XP, pontos e um baú de bronze com prêmio", async () => {
      const token = await login("user@email.com");
      const { last } = await playSession(token, { quizType: "GENERAL" }, (correct) => correct);

      expect(last.finished).toBe(true);
      const result = last.matchResult;
      expect(result.xpGained).toBe(66); // 3 acertos × (10 + 12 de bônus por 100%)
      expect(result.scoreGained).toBe(305); // 300 + 5 do 3º acerto seguido (sequência)
      expect(result.rewardGranted).toBe(true);
      expect(result.rewardName).toBeTruthy();
      expect(result.rewardMatchesUsedToday).toBe(1);
      expect(result.rewardMatchesLimitPerDay).toBe(5);
      // Só 3 perguntas ativas: o mínimo cai para 3 e o baú é de bronze (6 moedas garantidas, além do item).
      expect(result.chestTier).toBe("BRONZE");
      expect(result.chestCoins).toBe(6);
      expect(result.coinsGained).toBe(7); // 1 da sequência + 3 acertos × 2 (bônus de perfeita só com 5+ perguntas)
      expect(result.unlockedAchievements).toEqual(expect.arrayContaining([expect.objectContaining({ code: "FIRST_MATCH", coins: 30 })]));
      expect(last.correctOption).toMatch(/^[ABCD]$/);

      const me = await api.get("/api/users/me").set(bearer(token));
      expect(me.body).toMatchObject({ xp: 66, totalScore: 305, level: 1 });
      expect(me.body.coins).toBe(result.userCoins);

      const matches = await api.get("/api/quiz/matches?size=5").set(bearer(token));
      expect(matches.body).toMatchObject({ totalElements: 1 });
      expect(matches.body.content[0].coinsGained).toBe(7);

      const history = await api.get("/api/quiz/history").set(bearer(token));
      expect(history.body.sessions[0].status).toBe("FINISHED");
      expect(history.body.matches[0]).toMatchObject({ xpGained: 66, rewardGranted: true });
    });

    it("treino do quiz geral não rende baú e a maratona vai até as vidas acabarem", async () => {
      const token = await login("user@email.com");
      const training = await playSession(token, { quizType: "GENERAL", questionLimit: 3, training: true }, (correct) => correct);
      expect(training.last.matchResult).toMatchObject({ rewardGranted: false, chestTier: null, chestCoins: 0 });

      const started = await api.post("/api/quiz/sessions/start").set(bearer(token)).send({ quizType: "GENERAL", questionLimit: 1 });
      expect(started.body).toMatchObject({ marathon: true, training: false });
      // A maratona ignora o número de perguntas pedido: sorteia todas as ativas.
      expect(started.body.totalQuestions).toBe(3);
      await api.post(`/api/quiz/sessions/${started.body.sessionId}/abandon`).set(bearer(token));
    });

    it("sem acertos suficientes não há prêmio; erros tiram vidas e encerram a partida", async () => {
      const token = await login("user@email.com");
      const { last } = await playSession(token, { quizType: "GENERAL" }, (correct) => wrongOption(correct));
      expect(last.livesRemaining).toBe(0);
      expect(last.matchResult).toMatchObject({ xpGained: 0, scoreGained: -90, rewardGranted: false });
    });

    it("não sorteia figurinha de raridade sem personagens (a partida não pode travar)", async () => {
      // Os dados de demonstração não têm figurinhas comuns: só essa recompensa fica ativa.
      await prisma.rewardDefinition.updateMany({ where: { name: { not: "Figurinha Comum" } }, data: { active: false } });
      const token = await login("user@email.com");
      const { last } = await playSession(token, { quizType: "GENERAL" }, (correct) => correct);
      expect(last.finished).toBe(true);
      expect(last.matchResult.rewardGranted).toBe(false);
    });

    it("respeita o limite diário de partidas premiadas", async () => {
      const admin = await login("admin2@email.com");
      await api.put("/api/settings/admin").set(bearer(admin)).send({ rewardMatchLimitPerDay: 1 });
      const token = await login("user@email.com");
      const first = await playSession(token, { quizType: "GENERAL" }, (correct) => correct);
      const second = await playSession(token, { quizType: "GENERAL" }, (correct) => correct);
      expect(first.last.matchResult.rewardGranted).toBe(true);
      expect(second.last.matchResult.rewardGranted).toBe(false);
    });

    it("resposta fora do prazo conta como erro mesmo se estiver certa", async () => {
      const token = await login("user@email.com");
      const started = await api.post("/api/quiz/sessions/start").set(bearer(token)).send({ quizType: "GENERAL" });
      const question = started.body.currentQuestion;
      await prisma.quizSession.update({
        where: { id: started.body.sessionId },
        data: { currentQuestionStartedAt: new Date(Date.now() - (question.timeLimitSeconds + 10) * 1000) },
      });
      const answer = await api
        .post(`/api/quiz/sessions/${started.body.sessionId}/answer`)
        .set(bearer(token))
        .send({ questionId: question.id, selectedOption: await correctOptionOf(question.id) });
      expect(answer.body).toMatchObject({ correct: false, timedOut: true, livesRemaining: 2 });
    });

    it("só permite uma partida em andamento e aceita abandonar", async () => {
      const token = await login("user@email.com");
      const started = await api.post("/api/quiz/sessions/start").set(bearer(token)).send({ quizType: "GENERAL" });
      const again = await api.post("/api/quiz/sessions/start").set(bearer(token)).send({ quizType: "GENERAL" });
      expect(again.status).toBe(400);

      const active = await api.get("/api/quiz/sessions/active").set(bearer(token));
      expect(active.body.sessionId).toBe(started.body.sessionId);

      const abandoned = await api.post(`/api/quiz/sessions/${started.body.sessionId}/abandon`).set(bearer(token));
      expect(abandoned.body.status).toBe("ABANDONED");
      expect((await api.get("/api/quiz/sessions/active").set(bearer(token))).status).toBe(404);
    });

    it("rejeita resposta para outra pergunta e sessão de outro jogador", async () => {
      const token = await login("user@email.com");
      const started = await api.post("/api/quiz/sessions/start").set(bearer(token)).send({ quizType: "GENERAL" });
      const wrongQuestion = await api
        .post(`/api/quiz/sessions/${started.body.sessionId}/answer`)
        .set(bearer(token))
        .send({ questionId: 999, selectedOption: "A" });
      expect(wrongQuestion.status).toBe(400);

      const admin = await login("admin2@email.com");
      expect((await api.get(`/api/quiz/sessions/${started.body.sessionId}`).set(bearer(admin))).status).toBe(404);
    });

    it("bônus: vida extra salva do erro, XP em dobro e tempo extra são consumidos uma vez", async () => {
      const user = await prisma.user.update({ where: { email: "user@email.com" }, data: { extraLifeBoosts: 2, doubleXpBoosts: 2, extraTimeBoosts: 2 } });
      const token = await login("user@email.com");
      const started = await api.post("/api/quiz/sessions/start").set(bearer(token)).send({ quizType: "GENERAL" });
      const sessionId = started.body.sessionId;

      const extraTime = await api.post(`/api/quiz/sessions/${sessionId}/extra-time`).set(bearer(token));
      expect(extraTime.body.extraTimeUsed).toBe(true);
      expect(extraTime.body.currentQuestion.timeLimitSeconds).toBe(started.body.currentQuestion.timeLimitSeconds + 15);
      expect((await api.post(`/api/quiz/sessions/${sessionId}/extra-time`).set(bearer(token))).status).toBe(400);

      const first = started.body.currentQuestion;
      const saved = await api
        .post(`/api/quiz/sessions/${sessionId}/answer`)
        .set(bearer(token))
        .send({ questionId: first.id, selectedOption: wrongOption(await correctOptionOf(first.id)), useExtraLife: true, useXpMultiplier: true });
      expect(saved.body).toMatchObject({ correct: false, livesRemaining: 3, extraLifeUsed: true, xpMultiplierUsed: true, hasNextQuestion: true });
      expect(saved.body.correctOption).toBe(await correctOptionOf(first.id));

      // O tempo da próxima só conta depois que ela é pedida: ler o gabarito não gasta tempo.
      const waiting = await prisma.quizSession.findUniqueOrThrow({ where: { id: sessionId } });
      expect(waiting.currentQuestionStartedAt).toBeNull();
      const next = await api.post(`/api/quiz/sessions/${sessionId}/next`).set(bearer(token));
      expect(next.body.currentQuestion.remainingSeconds).toBe(next.body.currentQuestion.timeLimitSeconds);

      const repeat = await api
        .post(`/api/quiz/sessions/${sessionId}/answer`)
        .set(bearer(token))
        .send({ questionId: next.body.currentQuestion.id, selectedOption: "A", useXpMultiplier: true });
      expect(repeat.body.message).toBe("Bônus de XP em dobro já foi usado nesta partida");

      const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(after).toMatchObject({ extraLifeBoosts: 1, doubleXpBoosts: 1, extraTimeBoosts: 1 });
    });

    it("estudo de personagem: só de figurinha que já tem, sem prêmio algum, só acumula acertos", async () => {
      const token = await login("user@email.com");
      const user = await prisma.user.findUniqueOrThrow({ where: { email: "user@email.com" } });
      const davi = await prisma.biblicalCharacter.findUniqueOrThrow({ where: { name: "Davi" } });

      // Sem a figurinha, não abre.
      const blocked = await api.post("/api/quiz/sessions/start").set(bearer(token)).send({ quizType: "CHARACTER_STUDY", characterId: davi.id });
      expect(blocked.status).toBe(400);

      await prisma.userSticker.create({ data: { userId: user.id, characterId: davi.id } });
      const before = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

      const win = await playSession(token, { quizType: "CHARACTER_STUDY", characterId: davi.id }, (correct) => correct);
      expect(win.last.matchResult).toMatchObject({
        rewardGranted: false,
        rewardType: null,
        rewardCharacterId: null,
        xpGained: 0,
        coinsGained: 0,
        scoreGained: 0,
      });
      expect(win.last.matchResult.studyStatus.correctAnswers).toBeGreaterThan(0);

      const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(after).toMatchObject({ xp: before.xp, coins: before.coins, totalScore: before.totalScore });

      const collection = await api.get("/api/collection/my").set(bearer(token));
      expect(collection.body).toEqual([
        expect.objectContaining({ characterId: davi.id, study: expect.objectContaining({ correctAnswers: win.last.matchResult.studyStatus.correctAnswers }) }),
      ]);

      const missing = await api.post("/api/quiz/sessions/start").set(bearer(token)).send({ quizType: "CHARACTER_STUDY" });
      expect(missing.status).toBe(400);
    });
  });

  describe("loja", () => {
    it("compra com moedas, respeita limites e não vende o que já tem", async () => {
      const token = await login("user@email.com");
      const shop = await api.get("/api/shop").set(bearer(token));
      expect(shop.body.map((item: { priceCoins: number }) => item.priceCoins)).toEqual([180, 190, 200, 200, 200, 220, 230, 250, 270, 300, 330, 350, 450, 750, 1100, 2800]);
      const life = shop.body.find((item: { name: string }) => item.name === "Vida extra");
      const rare = shop.body.find((item: { name: string }) => item.name === "Figurinha Rara");

      const poor = await api.post(`/api/shop/buy/${life.id}`).set(bearer(token));
      expect(poor.body.message).toBe("Moedas insuficientes");

      await prisma.user.update({ where: { email: "user@email.com" }, data: { coins: 1500, extraLifeBoosts: 4 } });
      const bought = await api.post(`/api/shop/buy/${life.id}`).set(bearer(token));
      expect(bought.body).toMatchObject({ rewardType: "EXTRA_LIFE", userCoins: 1250, extraLifeBoosts: 5 });

      const capped = await api.post(`/api/shop/buy/${life.id}`).set(bearer(token));
      expect(capped.body.message).toBe("Você já atingiu o limite de vidas extras");

      const sticker = await api.post(`/api/shop/buy/${rare.id}`).set(bearer(token));
      expect(sticker.body).toMatchObject({ rewardType: "STICKER", characterName: "Davi", characterUnlocked: true, userCoins: 150 });
      // Com saldo de sobra, a loja ainda recusa o que o jogador já tem por completo.
      await prisma.user.update({ where: { email: "user@email.com" }, data: { coins: 2000 } });
      const allOwned = await api.post(`/api/shop/buy/${rare.id}`).set(bearer(token));
      expect(allOwned.body.message).toBe("Você já possui todas as figurinhas desta raridade");

      const me = await api.get("/api/users/me").set(bearer(token));
      expect(me.body.coins).toBe(2000);
    });

    it("compras simultâneas não gastam moedas que o jogador não tem", async () => {
      const token = await login("user@email.com");
      await prisma.user.update({ where: { email: "user@email.com" }, data: { coins: 200 } });
      const time = (await api.get("/api/shop").set(bearer(token))).body.find((item: { name: string }) => item.name === "Tempo extra");
      const results = await Promise.all([1, 2, 3].map(() => api.post(`/api/shop/buy/${time.id}`).set(bearer(token))));
      expect(results.filter((response) => response.status === 200)).toHaveLength(1);
      expect((await prisma.user.findUniqueOrThrow({ where: { email: "user@email.com" } })).coins).toBe(0);
    });
  });

  describe("novas recompensas", () => {
    it("prêmio diário: resgata uma vez por dia e monta a sequência", async () => {
      const token = await login("user@email.com");
      const status = await api.get("/api/daily-reward").set(bearer(token));
      expect(status.body).toMatchObject({ canClaim: true, streak: 0, nextDay: 1 });
      expect(status.body.cycle).toHaveLength(7);

      const claimed = await api.post("/api/daily-reward/claim").set(bearer(token));
      expect(claimed.body).toMatchObject({ day: 1, streak: 1, coins: 20, userCoins: 20 });
      expect((await api.post("/api/daily-reward/claim").set(bearer(token))).status).toBe(400);

      // Último resgate "ontem" no 6º dia: hoje é o 7º, com dica 50/50 e a conquista de 7 dias.
      await prisma.user.update({
        where: { email: "user@email.com" },
        data: { dailyStreak: 6, lastDailyClaim: new Date(Date.now() - 86_400_000) },
      });
      const seventh = await api.post("/api/daily-reward/claim").set(bearer(token));
      expect(seventh.body).toMatchObject({ day: 7, streak: 7, coins: 100, hints: 1 });
      expect(seventh.body.unlockedAchievements).toEqual([expect.objectContaining({ code: "STREAK_7" })]);

      const achievements = await api.get("/api/achievements").set(bearer(token));
      expect(achievements.body.find((item: { code: string }) => item.code === "STREAK_7")).toMatchObject({ unlocked: true });
      expect(achievements.body.find((item: { code: string }) => item.code === "MATCHES_10")).toMatchObject({ unlocked: false, current: 0, target: 10 });
    });

    it("dica 50/50 elimina duas erradas uma vez por partida", async () => {
      const token = await login("user@email.com");
      const started = await api.post("/api/quiz/sessions/start").set(bearer(token)).send({ quizType: "GENERAL" });
      const sessionId = started.body.sessionId;
      expect((await api.post(`/api/quiz/sessions/${sessionId}/fifty-fifty`).set(bearer(token))).body.message).toBe("Você não possui dicas 50/50");

      await prisma.user.update({ where: { email: "user@email.com" }, data: { hintBoosts: 2 } });
      const used = await api.post(`/api/quiz/sessions/${sessionId}/fifty-fifty`).set(bearer(token));
      const correct = await correctOptionOf(used.body.currentQuestion.id);
      expect(used.body.fiftyFiftyUsed).toBe(true);
      expect(used.body.currentQuestion.removedOptions).toHaveLength(2);
      expect(used.body.currentQuestion.removedOptions).not.toContain(correct);
      expect((await api.post(`/api/quiz/sessions/${sessionId}/fifty-fifty`).set(bearer(token))).status).toBe(400);
      expect((await prisma.user.findUniqueOrThrow({ where: { email: "user@email.com" } })).hintBoosts).toBe(1);
    });

    it("pacote surpresa dá figurinha e a repetida fica guardada para vender ou fundir", async () => {
      const token = await login("user@email.com");
      const pack = (await api.get("/api/shop").set(bearer(token))).body.find((item: { name: string }) => item.name === "Pacote surpresa");
      expect(pack).toMatchObject({ rewardType: "STICKER_PACK", priceCoins: 750 });
      const characters = await prisma.biblicalCharacter.findMany();
      const user = await prisma.user.findUniqueOrThrow({ where: { email: "user@email.com" } });
      await prisma.userSticker.createMany({ data: characters.map((character) => ({ userId: user.id, characterId: character.id })) });
      await prisma.user.update({ where: { id: user.id }, data: { coins: 750 } });

      const bought = await api.post(`/api/shop/buy/${pack.id}`).set(bearer(token));
      // A compra também libera conquistas (álbum completo, lenda), que pagam moedas.
      expect(bought.body).toMatchObject({ characterUnlocked: false, duplicate: true });

      const collection = await api.get("/api/collection/my").set(bearer(token));
      const copy = collection.body.find((sticker: { characterId: number }) => sticker.characterId === bought.body.characterId);
      expect(copy.duplicates).toBe(1);

      const sold = await api.post("/api/collection/sell").set(bearer(token)).send({ characterId: bought.body.characterId, quantity: 5 });
      expect(sold.body.sold).toBe(1);
      expect(sold.body.userCoins).toBe(bought.body.userCoins + sold.body.coins);
      expect((await api.post("/api/collection/sell").set(bearer(token)).send({ characterId: bought.body.characterId })).status).toBe(404);
    });

    it("admin volta um jogador ao começo (conta e login ficam) e o reset geral exige confirmação", async () => {
      const token = await login("user@email.com");
      const admin = await login("admin2@email.com");
      const user = await prisma.user.findUniqueOrThrow({ where: { email: "user@email.com" } });
      const davi = await prisma.biblicalCharacter.findUniqueOrThrow({ where: { name: "Davi" } });
      await playSession(token, { quizType: "GENERAL", questionLimit: 3 }, (correct) => correct);
      await prisma.userSticker.upsert({ where: { userId_characterId: { userId: user.id, characterId: davi.id } }, create: { userId: user.id, characterId: davi.id }, update: {} });
      await prisma.characterStudy.create({ data: { userId: user.id, characterId: davi.id, correctAnswers: 12, questionsAnswered: 15 } });
      await prisma.user.update({ where: { id: user.id }, data: { coins: 999, hintBoosts: 3, skipBoosts: 2, dailyStreak: 4, chestLevel: 3 } });

      // Jogador comum não pode resetar ninguém.
      expect((await api.post(`/api/users/${user.id}/reset`).set(bearer(token)).send({})).status).toBe(403);

      const reset = await api.post(`/api/users/${user.id}/reset`).set(bearer(admin)).send({});
      expect(reset.status).toBe(200);
      expect(reset.body).toMatchObject({ coins: 0, xp: 0, level: 1 });
      const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(fresh).toMatchObject({ email: "user@email.com", xp: 0, level: 1, coins: 0, totalScore: 0, hintBoosts: 0, skipBoosts: 0, dailyStreak: 0, chestLevel: 1, stickerPity: 0 });
      expect(fresh.lastDailyClaim).toBeNull();
      expect(await prisma.userSticker.count({ where: { userId: user.id } })).toBe(0);
      expect(await prisma.characterStudy.count({ where: { userId: user.id } })).toBe(0);
      expect(await prisma.quizMatch.count({ where: { userId: user.id } })).toBe(0);
      expect(await prisma.userAchievement.count({ where: { userId: user.id } })).toBe(0);
      expect((await api.get("/api/collection/my").set(bearer(token))).body).toEqual([]);
      // O login continua valendo.
      expect((await api.get("/api/users/me").set(bearer(token))).status).toBe(200);

      // Reset geral: sem a palavra de confirmação, nada acontece.
      expect((await api.post("/api/users/reset-all").set(bearer(admin)).send({})).status).toBe(400);
      await prisma.user.update({ where: { id: user.id }, data: { coins: 50 } });
      const all = await api.post("/api/users/reset-all").set(bearer(admin)).send({ confirm: "RESETAR" });
      expect(all.status).toBe(200);
      expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).coins).toBe(0);
      // Administradores não são resetados.
      await prisma.user.update({ where: { email: "admin2@email.com" }, data: { coins: 77 } });
      await api.post("/api/users/reset-all").set(bearer(admin)).send({ confirm: "RESETAR" });
      expect((await prisma.user.findUniqueOrThrow({ where: { email: "admin2@email.com" } })).coins).toBe(77);
    });

    it("admin vê estatísticas e ajusta o saldo de um jogador", async () => {
      const admin = await login("admin2@email.com");
      const stats = await api.get("/api/admin/stats").set(bearer(admin));
      expect(stats.body).toMatchObject({ users: 2, characters: 4, questions: 3, uploads: "inline" });

      const target = await prisma.user.findUniqueOrThrow({ where: { email: "user@email.com" } });
      const granted = await api.post(`/api/users/${target.id}/grant`).set(bearer(admin)).send({ coins: 500, hintBoosts: 2, extraLifeBoosts: -3 });
      expect(granted.body).toMatchObject({ coins: 500, hintBoosts: 2, extraLifeBoosts: 0 });

      const user = await login("user@email.com");
      expect((await api.get("/api/admin/stats").set(bearer(user))).status).toBe(403);
    });

    it("upload sem Blob guarda a imagem no banco e recusa o que não é imagem", async () => {
      const admin = await login("admin2@email.com");
      const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
      const saved = await api.post("/api/uploads?folder=personagens&name=davi.png").set(bearer(admin)).set("Content-Type", "image/png").send(png);
      expect(saved.status).toBe(201);
      expect(saved.body.url).toMatch(/^data:image\/png;base64,/);

      const fake = await api.post("/api/uploads?folder=personagens").set(bearer(admin)).set("Content-Type", "image/png").send(Buffer.from("nao sou imagem"));
      expect(fake.status).toBe(400);
      const wrongFolder = await api.post("/api/uploads?folder=outra").set(bearer(admin)).set("Content-Type", "image/png").send(png);
      expect(wrongFolder.status).toBe(400);

      const user = await login("user@email.com");
      expect((await api.post("/api/uploads?folder=personagens").set(bearer(user)).set("Content-Type", "image/png").send(png)).status).toBe(403);
    });
  });

  describe("engajamento", () => {
    async function addCharacter(name: string, rarity: string, extra: Record<string, unknown> = {}) {
      return prisma.biblicalCharacter.create({ data: { name, rarity: rarity as "COMMON", shortSummary: "x", fullDescription: "y", createdBy: "teste", ...extra } });
    }

    it("fusão: 3 repetidas comuns viram uma rara nova", async () => {
      const token = await login("user@email.com");
      const user = await prisma.user.findUniqueOrThrow({ where: { email: "user@email.com" } });
      const rute = await addCharacter("Rute", "COMMON");
      const noemi = await addCharacter("Noemi", "COMMON");
      await prisma.userSticker.createMany({ data: [{ userId: user.id, characterId: rute.id, duplicates: 2 }, { userId: user.id, characterId: noemi.id, duplicates: 1 }] });

      expect((await api.post("/api/collection/fuse").set(bearer(token)).send({ rarity: "LEGENDARY" })).status).toBe(400);
      const fused = await api.post("/api/collection/fuse").set(bearer(token)).send({ rarity: "COMMON" });
      expect(fused.body).toMatchObject({ spent: 3, characterName: "Davi", characterRarity: "RARE", characterUnlocked: true });
      const left = await prisma.userSticker.aggregate({ where: { userId: user.id }, _sum: { duplicates: true } });
      expect(left._sum.duplicates).toBe(0);
      expect((await api.post("/api/collection/fuse").set(bearer(token)).send({ rarity: "COMMON" })).body.message).toMatch(/precisa de 3/);
    });

    it("publicação agendada: some do álbum até a data e aparece como em breve", async () => {
      const admin = await login("admin2@email.com");
      const future = new Date(Date.now() + 3 * 86_400_000).toISOString();
      const created = await api
        .post("/api/characters/admin")
        .set(bearer(admin))
        .send({ name: "Gideão", rarity: "EPIC", published: true, publishAt: future, shortSummary: "<p>Juiz</p>", fullDescription: "x" });
      expect(created.status).toBe(201);

      const token = await login("user@email.com");
      expect((await api.get("/api/characters").set(bearer(token))).body.some((c: { name: string }) => c.name === "Gideão")).toBe(false);
      expect((await api.get(`/api/characters/${created.body.id}`).set(bearer(token))).status).toBe(404);
      const upcoming = await api.get("/api/characters/upcoming").set(bearer(token));
      expect(upcoming.body).toEqual([expect.objectContaining({ rarity: "EPIC" })]);
      expect(upcoming.body[0]).not.toHaveProperty("name");

      await api.put(`/api/characters/admin/${created.body.id}`).set(bearer(admin)).send({ publishAt: null });
      expect((await api.get("/api/characters").set(bearer(token))).body.some((c: { name: string }) => c.name === "Gideão")).toBe(true);
    });

    it("missões diárias e semanais: progresso e resgate único", async () => {
      const token = await login("user@email.com");
      const before = await api.get("/api/missions").set(bearer(token));
      expect(before.body.filter((m: { period: string }) => m.period === "DAILY")).toHaveLength(3);
      expect(before.body.filter((m: { period: string }) => m.period === "WEEKLY")).toHaveLength(3);
      expect((await api.post("/api/missions/W_PLAY_15/claim").set(bearer(token))).body.message).toBe("Missão ainda não concluída");

      const user = await prisma.user.findUniqueOrThrow({ where: { email: "user@email.com" } });
      await prisma.quizMatch.createMany({
        data: Array.from({ length: 15 }, () => ({ userId: user.id, quizType: "GENERAL" as const, finishedAt: new Date(), questionsAnswered: 10, correctAnswers: 7, wrongAnswers: 3, xpGained: 0, scoreGained: 0 })),
      });
      const claim = await api.post("/api/missions/W_PLAY_15/claim").set(bearer(token));
      expect(claim.body).toMatchObject({ coins: 100, userCoins: 100 });
      expect((await api.post("/api/missions/W_PLAY_15/claim").set(bearer(token))).status).toBe(400);
      const after = await api.get("/api/missions").set(bearer(token));
      expect(after.body.find((m: { code: string }) => m.code === "W_PLAY_15")).toMatchObject({ completed: true, claimed: true });
    });

    it("liga semanal: ranking da semana e prêmio do top 3 da semana passada", async () => {
      const token = await login("user@email.com");
      const user = await prisma.user.findUniqueOrThrow({ where: { email: "user@email.com" } });
      const match = { userId: user.id, quizType: "GENERAL" as const, questionsAnswered: 5, correctAnswers: 5, wrongAnswers: 0, xpGained: 0 };
      await prisma.quizMatch.createMany({
        data: [
          { ...match, finishedAt: new Date(), scoreGained: 400 },
          { ...match, finishedAt: new Date(Date.now() - 7 * 86_400_000), scoreGained: 300 },
        ],
      });
      const league = await api.get("/api/league").set(bearer(token));
      expect(league.body.content[0]).toMatchObject({ position: 1, score: 400, prize: 500 });
      expect(league.body.me).toMatchObject({ position: 1, score: 400 });
      expect(league.body.lastWeek).toMatchObject({ position: 1, prize: 500, claimed: false });

      const claimed = await api.post("/api/league/claim").set(bearer(token));
      expect(claimed.body).toMatchObject({ position: 1, coins: 500 });
      expect((await api.post("/api/league/claim").set(bearer(token))).status).toBe(400);
    });

    it("protetor de sequência salva o prêmio diário de um dia esquecido", async () => {
      const token = await login("user@email.com");
      const freeze = (await api.get("/api/shop").set(bearer(token))).body.find((item: { name: string }) => item.name === "Protetor de sequência");
      await prisma.user.update({ where: { email: "user@email.com" }, data: { coins: 350, dailyStreak: 4, lastDailyClaim: new Date(Date.now() - 2 * 86_400_000) } });
      expect((await api.post(`/api/shop/buy/${freeze.id}`).set(bearer(token))).body).toMatchObject({ streakFreezes: 1 });

      expect((await api.get("/api/daily-reward").set(bearer(token))).body).toMatchObject({ canClaim: true, streak: 4, nextDay: 5, freezesToUse: 1 });
      const claimed = await api.post("/api/daily-reward/claim").set(bearer(token));
      expect(claimed.body).toMatchObject({ day: 5, streak: 5, freezesUsed: 1 });
      expect((await prisma.user.findUniqueOrThrow({ where: { email: "user@email.com" } })).streakFreezes).toBe(0);
    });

    it("garantia contra azar: depois de 9 prêmios sem figurinha, o 10º é figurinha", async () => {
      await prisma.user.update({ where: { email: "user@email.com" }, data: { stickerPity: 9 } });
      const token = await login("user@email.com");
      const { last } = await playSession(token, { quizType: "GENERAL" }, (correct) => correct);
      expect(last.matchResult.pityGuaranteed).toBe(true);
      expect(["STICKER", "STICKER_PACK"]).toContain(last.matchResult.rewardType);
      expect((await prisma.user.findUniqueOrThrow({ where: { email: "user@email.com" } })).stickerPity).toBe(0);
    });

    it("desafio do dia: mesmas perguntas para todos, uma tentativa e ranking do dia", async () => {
      const token = await login("user@email.com");
      const admin = await login("outro@email.com");
      const mine = await api.post("/api/quiz/sessions/start").set(bearer(token)).send({ quizType: "DAILY_CHALLENGE" });
      const other = await api.post("/api/quiz/sessions/start").set(bearer(admin)).send({ quizType: "DAILY_CHALLENGE" });
      const idsOf = async (sessionId: number) => (await prisma.quizSession.findUniqueOrThrow({ where: { id: sessionId } })).questionIds;
      expect(await idsOf(mine.body.sessionId)).toEqual(await idsOf(other.body.sessionId));

      await api.post(`/api/quiz/sessions/${mine.body.sessionId}/abandon`).set(bearer(token));
      expect((await api.post("/api/quiz/sessions/start").set(bearer(token)).send({ quizType: "DAILY_CHALLENGE" })).body.message).toMatch(/já fez o desafio/);

      // Termina a do admin para aparecer no ranking.
      let question = other.body.currentQuestion;
      while (question) {
        const answered = await api
          .post(`/api/quiz/sessions/${other.body.sessionId}/answer`)
          .set(bearer(admin))
          .send({ questionId: question.id, selectedOption: await correctOptionOf(question.id) });
        question = answered.body.hasNextQuestion ? (await api.post(`/api/quiz/sessions/${other.body.sessionId}/next`).set(bearer(admin))).body.currentQuestion : null;
      }
      const challenge = await api.get("/api/quiz/daily-challenge").set(bearer(token));
      expect(challenge.body).toMatchObject({ attemptStatus: "ABANDONED", totalQuestions: 3, totalElements: 1, me: null });
      expect(challenge.body.content[0]).toMatchObject({ position: 1, userName: "Jogador Dois", correctAnswers: 3 });
    });

    it("reportar pergunta e o admin resolve", async () => {
      const token = await login("user@email.com");
      const question = await prisma.question.findFirstOrThrow();
      expect((await api.post("/api/reports").set(bearer(token)).send({ questionId: question.id, reason: "WRONG_ANSWER", message: "A resposta é outra" })).status).toBe(201);
      expect((await api.post("/api/reports").set(bearer(token)).send({ questionId: question.id, reason: "TYPO" })).status).toBe(400);
      expect((await api.get("/api/reports/admin").set(bearer(token))).status).toBe(403);

      const admin = await login("admin2@email.com");
      const list = await api.get("/api/reports/admin").set(bearer(admin));
      expect(list.body.content[0]).toMatchObject({ questionId: question.id, reason: "WRONG_ANSWER", userName: "Usuário Teste", status: "OPEN" });
      expect((await api.get("/api/questions?reported=open").set(bearer(admin))).body.totalElements).toBe(1);
      await api.put(`/api/reports/admin/${list.body.content[0].id}`).set(bearer(admin)).send({ status: "RESOLVED" });
      expect((await api.get("/api/reports/admin/count").set(bearer(admin))).body.open).toBe(0);
    });

    it("importação em lote: prévia, erros por linha e criação", async () => {
      const admin = await login("admin2@email.com");
      const rows = [
        { text: "Quem construiu a arca?", optionA: "Noé", optionB: "Moisés", optionC: "Abraão", optionD: "Davi", correctOption: "a", difficulty: "Fácil", character: "davi" },
        { text: "Quem derrotou Golias?", optionA: "a", optionB: "b", optionC: "c", optionD: "d", correctOption: "A" },
        { text: "Pergunta ruim", optionA: "x", optionB: "x", optionC: "y", optionD: "z", correctOption: "A" },
        { text: "Outra", optionA: "1", optionB: "2", optionC: "3", optionD: "4", correctOption: "E" },
        { text: "Quantos livros tem a Bíblia?", optionA: "66", optionB: "72", optionC: "39", optionD: "27", correctOption: "A", difficulty: "Muito difícil", character: "Ninguém" },
      ];
      const preview = await api.post("/api/questions/admin/bulk").set(bearer(admin)).send({ rows, dryRun: true });
      expect(preview.body.valid).toBe(1);
      expect(preview.body.errors.map((error: { row: number }) => error.row)).toEqual([2, 3, 4, 5]);
      expect(preview.body.errors[0].message).toMatch(/já existe/);
      expect(await prisma.question.count()).toBe(3);

      const imported = await api.post("/api/questions/admin/bulk").set(bearer(admin)).send({ rows });
      expect(imported.body.created).toBe(1);
      const created = await prisma.question.findFirstOrThrow({ where: { text: "Quem construiu a arca?" }, include: { relatedCharacter: true } });
      expect(created).toMatchObject({ difficulty: "EASY", timeLimitSeconds: 30, correctOption: "A" });
      expect(created.relatedCharacter?.name).toBe("Davi");
    });

    it("estatística por pergunta e dificuldade sugerida", async () => {
      const token = await login("user@email.com");
      await playSession(token, { quizType: "GENERAL" }, (correct) => correct);
      expect(await prisma.question.aggregate({ _sum: { timesAnswered: true, timesCorrect: true } })).toMatchObject({ _sum: { timesAnswered: 3, timesCorrect: 3 } });

      const admin = await login("admin2@email.com");
      const question = await prisma.question.findFirstOrThrow({ where: { difficulty: "EASY" } });
      await prisma.question.update({ where: { id: question.id }, data: { timesAnswered: 40, timesCorrect: 4 } });
      const mismatch = await api.get("/api/questions?calibration=mismatch").set(bearer(admin));
      expect(mismatch.body.content).toEqual([expect.objectContaining({ id: question.id, suggestedDifficulty: "VERY_HARD" })]);
      expect((await api.get("/api/admin/stats").set(bearer(admin))).body.needsCalibration).toBe(1);

      const applied = await api.post("/api/questions/admin/apply-suggestions").set(bearer(admin)).send({ ids: [question.id] });
      expect(applied.body.updated).toBe(1);
      expect(await prisma.question.findUniqueOrThrow({ where: { id: question.id } })).toMatchObject({ difficulty: "VERY_HARD", timeLimitSeconds: 15 });
    });
  });

  describe("amigos, conversa e trocas", () => {
    async function befriend() {
      const user = await login("user@email.com");
      const admin = await login("outro@email.com");
      const code = (await api.get("/api/social/me").set(bearer(admin))).body.friendCode;
      expect(code).toMatch(/^[A-Z2-9]{6}$/);
      const sent = await api.post("/api/social/friends/request").set(bearer(user)).send({ code: code.toLowerCase() });
      expect(sent.body).toMatchObject({ status: "PENDING" });
      const requests = await api.get("/api/social/friends/requests").set(bearer(admin));
      expect((await api.get("/api/social/summary").set(bearer(admin))).body.pendingRequests).toBe(1);
      await api.post(`/api/social/friends/requests/${requests.body.incoming[0].id}/accept`).set(bearer(admin));
      const userRow = await prisma.user.findUniqueOrThrow({ where: { email: "user@email.com" } });
      const adminRow = await prisma.user.findUniqueOrThrow({ where: { email: "outro@email.com" } });
      return { user, admin, userId: userRow.id, adminId: adminRow.id };
    }

    it("amizade por código com aceite; conversa só entre amigos e com palavrões mascarados", async () => {
      const user = await login("user@email.com");
      const userRow = await prisma.user.findUniqueOrThrow({ where: { email: "user@email.com" } });
      const adminRow = await prisma.user.findUniqueOrThrow({ where: { email: "outro@email.com" } });
      expect((await api.post(`/api/social/chat/${adminRow.id}`).set(bearer(user)).send({ text: "oi" })).status).toBe(403);
      expect((await api.post("/api/social/friends/request").set(bearer(user)).send({ code: "ZZZZZZ" })).status).toBe(404);

      const { admin } = await befriend();
      const friends = await api.get("/api/social/friends").set(bearer(user));
      expect(friends.body.content).toEqual([expect.objectContaining({ userId: adminRow.id, name: "Jogador Dois" })]);

      const sent = await api.post(`/api/social/chat/${adminRow.id}`).set(bearer(user)).send({ text: "Que merda de pergunta kkk" });
      expect(sent.body.text).toBe("Que ***** de pergunta kkk");
      expect((await api.get("/api/social/summary").set(bearer(admin))).body.unreadMessages).toBe(1);
      const chat = await api.get(`/api/social/chat/${userRow.id}`).set(bearer(admin));
      expect(chat.body.messages).toHaveLength(1);
      expect((await api.get("/api/social/summary").set(bearer(admin))).body.unreadMessages).toBe(0);

      await prisma.gameSetting.updateMany({ where: { settingKey: "social.chatEnabled" }, data: { settingValue: "0" } });
      expect((await api.post(`/api/social/chat/${adminRow.id}`).set(bearer(user)).send({ text: "oi" })).body.message).toMatch(/desligada/);
    });

    it("administrador não é amigo de jogador: código não vale e não pode adicionar", async () => {
      const user = await login("user@email.com");
      const admin = await login("admin2@email.com");
      const adminCode = (await api.get("/api/social/me").set(bearer(admin))).body.friendCode;
      expect((await api.post("/api/social/friends/request").set(bearer(user)).send({ code: adminCode })).status).toBe(404);
      const userCode = (await api.get("/api/social/me").set(bearer(user))).body.friendCode;
      expect((await api.post("/api/social/friends/request").set(bearer(admin)).send({ code: userCode })).status).toBe(400);
    });

    it("troca de repetidas: só repetidas, aceite move as cópias e não troca duas vezes", async () => {
      const { user, admin, userId, adminId } = await befriend();
      const davi = await prisma.biblicalCharacter.findUniqueOrThrow({ where: { name: "Davi" } });
      const ester = await prisma.biblicalCharacter.findUniqueOrThrow({ where: { name: "Ester" } });
      await prisma.userSticker.createMany({
        data: [
          { userId, characterId: davi.id, duplicates: 1 },
          { userId: adminId, characterId: ester.id, duplicates: 0 },
        ],
      });

      // Ester do admin não é repetida: não pode ser pedida.
      const invalid = await api.post("/api/social/trades").set(bearer(user)).send({ toUserId: adminId, offeredCharacterId: davi.id, requestedCharacterId: ester.id });
      expect(invalid.body.message).toBe("Seu amigo não tem essa figurinha repetida");
      await prisma.userSticker.update({ where: { userId_characterId: { userId: adminId, characterId: ester.id } }, data: { duplicates: 2 } });

      const trade = await api.post("/api/social/trades").set(bearer(user)).send({ toUserId: adminId, offeredCharacterId: davi.id, requestedCharacterId: ester.id, message: "bora?" });
      expect(trade.status).toBe(201);
      expect((await api.get("/api/social/summary").set(bearer(admin))).body.pendingTrades).toBe(1);
      const chat = await api.get(`/api/social/chat/${userId}`).set(bearer(admin));
      expect(chat.body.messages.at(-1).trade).toMatchObject({ id: trade.body.id, status: "PENDING" });

      expect((await api.post(`/api/social/trades/${trade.body.id}/accept`).set(bearer(user))).status).toBe(403);
      const [first, second] = await Promise.all([
        api.post(`/api/social/trades/${trade.body.id}/accept`).set(bearer(admin)),
        api.post(`/api/social/trades/${trade.body.id}/accept`).set(bearer(admin)),
      ]);
      expect([first.status, second.status].sort()).toEqual([200, 400]);
      const accepted = first.status === 200 ? first : second;
      expect(accepted.body.received).toMatchObject({ name: "Davi", unlocked: true });
      expect(accepted.body.unlockedAchievements).toEqual(expect.arrayContaining([expect.objectContaining({ code: "FIRST_TRADE" })]));

      const userStickers = await prisma.userSticker.findMany({ where: { userId }, orderBy: { characterId: "asc" } });
      expect(userStickers.map((sticker) => [sticker.characterId, sticker.duplicates])).toEqual([
        [davi.id, 0],
        [ester.id, 0],
      ]);
      expect((await prisma.userSticker.findUniqueOrThrow({ where: { userId_characterId: { userId: adminId, characterId: ester.id } } })).duplicates).toBe(1);

      const history = await api.get("/api/social/trades?box=history").set(bearer(user));
      expect(history.body.content[0]).toMatchObject({ status: "ACCEPTED" });
    });

    it("limite diário de trocas e bloqueio cancela propostas e corta a conversa", async () => {
      const { user, admin, userId, adminId } = await befriend();
      const davi = await prisma.biblicalCharacter.findUniqueOrThrow({ where: { name: "Davi" } });
      await prisma.userSticker.create({ data: { userId, characterId: davi.id, duplicates: 5 } });
      await prisma.gameSetting.updateMany({ where: { settingKey: "social.tradesPerDay" }, data: { settingValue: "1" } });

      const gift1 = await api.post("/api/social/trades").set(bearer(user)).send({ toUserId: adminId, offeredCharacterId: davi.id });
      const gift2 = await api.post("/api/social/trades").set(bearer(user)).send({ toUserId: adminId, offeredCharacterId: davi.id });
      expect((await api.post(`/api/social/trades/${gift1.body.id}/accept`).set(bearer(admin))).status).toBe(200);
      expect((await api.post(`/api/social/trades/${gift2.body.id}/accept`).set(bearer(admin))).body.message).toMatch(/trocas hoje/);

      await api.post(`/api/social/friends/${userId}/block`).set(bearer(admin));
      expect((await prisma.trade.findUniqueOrThrow({ where: { id: gift2.body.id } })).status).toBe("CANCELLED");
      expect((await api.post(`/api/social/chat/${adminId}`).set(bearer(user)).send({ text: "oi" })).status).toBe(403);
      const code = (await api.get("/api/social/me").set(bearer(admin))).body.friendCode;
      expect((await api.post("/api/social/friends/request").set(bearer(user)).send({ code })).body.message).toBe("Não foi possível adicionar este jogador");
      expect((await api.get("/api/social/friends/requests").set(bearer(admin))).body.blocked).toHaveLength(1);
    });
  });

  describe("anotações e ranking", () => {
    it("cria e edita anotações próprias", async () => {
      const token = await login("user@email.com");
      const created = await api.post("/api/comments").set(bearer(token)).send({ characterId: 1, text: "Minha nota" });
      expect(created.status).toBe(201);
      const edited = await api.put(`/api/comments/${created.body.id}`).set(bearer(token)).send({ text: "Editada" });
      expect(edited.body).toMatchObject({ text: "Editada", characterName: "Davi" });

      const admin = await login("admin2@email.com");
      expect((await api.put(`/api/comments/${created.body.id}`).set(bearer(admin)).send({ text: "x" })).status).toBe(404);
      const mine = await api.get("/api/comments/my").set(bearer(token));
      expect(mine.body).toHaveLength(1);
    });

    it("ranking ordena por pontos e ignora contas excluídas", async () => {
      await prisma.user.update({ where: { email: "user@email.com" }, data: { totalScore: 500 } });
      await prisma.user.update({ where: { email: "outro@email.com" }, data: { totalScore: 900, deleted: true } });
      // Administradores nunca entram no ranking, mesmo com muitos pontos.
      await prisma.user.update({ where: { email: "admin2@email.com" }, data: { totalScore: 800 } });
      const token = await login("user@email.com");
      const ranking = await api.get("/api/ranking").set(bearer(token));
      expect(ranking.body.content).toEqual([expect.objectContaining({ position: 1, userName: "Usuário Teste", totalScore: 500 })]);
      expect(ranking.body.me).toMatchObject({ position: 1, totalScore: 500 });
    });
  });

  it("responde 404 em JSON para rotas desconhecidas", async () => {
    const response = await api.get("/api/nao-existe");
    expect(response.status).toBe(404);
    expect(response.body.message).toBe("Recurso não encontrado");
  });
});

/** Roda o seed de novo sem apagar nada (simula um novo deploy). */
async function resetDatabaseKeepingRewards() {
  const { runSeed } = await import("../services/seed");
  await runSeed(prisma, { demoData: true });
}
