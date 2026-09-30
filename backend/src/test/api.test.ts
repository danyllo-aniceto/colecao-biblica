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
    question = last.body.nextQuestion;
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
      expect(page.body).toMatchObject({ totalElements: 1, totalPages: 1, number: 0, size: 1 });
      expect(page.body.content[0].email).toBe("user@email.com");
    });
  });

  describe("conteúdo (admin)", () => {
    it("perguntas com resposta só aparecem para admin", async () => {
      const user = await login("user@email.com");
      expect((await api.get("/api/questions").set(bearer(user))).status).toBe(403);
      const admin = await login("admin2@email.com");
      const questions = await api.get("/api/questions").set(bearer(admin));
      expect(questions.body).toHaveLength(3);
      expect(questions.body[0]).toHaveProperty("correctOption");
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

    it("recompensas e itens da loja são fixos, mas ajustáveis", async () => {
      const admin = await login("admin2@email.com");
      expect((await api.post("/api/rewards/admin").set(bearer(admin)).send({})).status).toBe(400);
      expect((await api.delete("/api/shop/admin/1").set(bearer(admin))).status).toBe(400);

      const rewards = await api.get("/api/rewards").set(bearer(admin));
      expect(rewards.body).toHaveLength(8);
      const coins = rewards.body.find((reward: { rewardType: string }) => reward.rewardType === "COINS");
      const zero = await api.put(`/api/rewards/admin/${coins.id}`).set(bearer(admin)).send({ dropChance: 0 });
      expect(zero.body.message).toBe("Chance de drop deve ser maior que zero");
      const updated = await api.put(`/api/rewards/admin/${coins.id}`).set(bearer(admin)).send({ coinAmount: 80, dropChance: 12.5 });
      expect(updated.body).toMatchObject({ coinAmount: 80, dropChance: 12.5 });

      // Rodar o seed de novo não desfaz o ajuste.
      await resetDatabaseKeepingRewards();
      const again = await api.get("/api/rewards").set(bearer(admin));
      expect(again.body.find((reward: { id: number }) => reward.id === coins.id).coinAmount).toBe(80);
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
    it("quiz geral perfeito dá XP, pontos e sorteia um prêmio", async () => {
      const token = await login("user@email.com");
      const { last } = await playSession(token, { quizType: "GENERAL", questionLimit: 10 }, (correct) => correct);

      expect(last.finished).toBe(true);
      const result = last.matchResult;
      expect(result.xpGained).toBe(66); // 3 acertos × (10 + 12 de bônus por 100%)
      expect(result.scoreGained).toBe(300);
      expect(result.rewardGranted).toBe(true);
      expect(result.rewardName).toBeTruthy();
      expect(result.rewardMatchesUsedToday).toBe(1);
      expect(result.rewardMatchesLimitPerDay).toBe(4);

      const me = await api.get("/api/users/me").set(bearer(token));
      expect(me.body).toMatchObject({ xp: 66, totalScore: 300, level: 1 });

      const history = await api.get("/api/quiz/history").set(bearer(token));
      expect(history.body.sessions[0].status).toBe("FINISHED");
      expect(history.body.matches[0]).toMatchObject({ xpGained: 66, rewardGranted: true });
    });

    it("sem acertos suficientes não há prêmio; erros tiram vidas e encerram a partida", async () => {
      const token = await login("user@email.com");
      const { last } = await playSession(token, { quizType: "GENERAL" }, (correct) => wrongOption(correct));
      expect(last.livesRemaining).toBe(0);
      expect(last.matchResult).toMatchObject({ xpGained: 0, scoreGained: -90, rewardGranted: false });
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
      expect(saved.body).toMatchObject({ correct: false, livesRemaining: 3, extraLifeUsed: true, xpMultiplierUsed: true });

      const repeat = await api
        .post(`/api/quiz/sessions/${sessionId}/answer`)
        .set(bearer(token))
        .send({ questionId: saved.body.nextQuestion.id, selectedOption: "A", useXpMultiplier: true });
      expect(repeat.body.message).toBe("Bônus de XP em dobro já foi usado nesta partida");

      const after = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(after).toMatchObject({ extraLifeBoosts: 1, doubleXpBoosts: 1, extraTimeBoosts: 1 });
    });

    it("estudo de personagem: figurinha só com aproveitamento mínimo e XP reduzido", async () => {
      const token = await login("user@email.com");
      const davi = await prisma.biblicalCharacter.findUniqueOrThrow({ where: { name: "Davi" } });

      const fail = await playSession(token, { quizType: "CHARACTER_STUDY", characterId: davi.id }, (correct) => wrongOption(correct));
      expect(fail.last.matchResult.rewardCharacterId).toBeNull();

      const win = await playSession(token, { quizType: "CHARACTER_STUDY", characterId: davi.id }, (correct) => correct);
      expect(win.last.matchResult).toMatchObject({
        rewardGranted: false,
        rewardType: "STICKER",
        rewardCharacterId: davi.id,
        rewardCharacterUnlocked: true,
        xpGained: 7, // 22 XP × 35%
      });

      const collection = await api.get("/api/collection/my").set(bearer(token));
      expect(collection.body).toEqual([expect.objectContaining({ characterId: davi.id, characterName: "Davi", rarity: "RARE" })]);
      const progress = await api.get("/api/collection/my/progress").set(bearer(token));
      expect(progress.body).toEqual({ owned: 1, total: 3 });

      const missing = await api.post("/api/quiz/sessions/start").set(bearer(token)).send({ quizType: "CHARACTER_STUDY" });
      expect(missing.status).toBe(400);
    });
  });

  describe("loja", () => {
    it("compra com moedas, respeita limites e não vende o que já tem", async () => {
      const token = await login("user@email.com");
      const shop = await api.get("/api/shop").set(bearer(token));
      expect(shop.body.map((item: { priceCoins: number }) => item.priceCoins)).toEqual([120, 150, 180, 220, 260, 450]);
      const life = shop.body.find((item: { name: string }) => item.name === "Vida extra");
      const rare = shop.body.find((item: { name: string }) => item.name === "Figurinha Rara");

      const poor = await api.post(`/api/shop/buy/${life.id}`).set(bearer(token));
      expect(poor.body.message).toBe("Moedas insuficientes");

      await prisma.user.update({ where: { email: "user@email.com" }, data: { coins: 1000, extraLifeBoosts: 4 } });
      const bought = await api.post(`/api/shop/buy/${life.id}`).set(bearer(token));
      expect(bought.body).toMatchObject({ rewardType: "EXTRA_LIFE", userCoins: 820, extraLifeBoosts: 5 });

      const capped = await api.post(`/api/shop/buy/${life.id}`).set(bearer(token));
      expect(capped.body.message).toBe("Você já atingiu o limite de vidas extras");

      const sticker = await api.post(`/api/shop/buy/${rare.id}`).set(bearer(token));
      expect(sticker.body).toMatchObject({ rewardType: "STICKER", characterName: "Davi", characterUnlocked: true, userCoins: 560 });
      const allOwned = await api.post(`/api/shop/buy/${rare.id}`).set(bearer(token));
      expect(allOwned.body.message).toBe("Você já possui todas as figurinhas desta raridade");

      const me = await api.get("/api/users/me").set(bearer(token));
      expect(me.body.coins).toBe(560);
    });

    it("compras simultâneas não gastam moedas que o jogador não tem", async () => {
      const token = await login("user@email.com");
      await prisma.user.update({ where: { email: "user@email.com" }, data: { coins: 150 } });
      const time = (await api.get("/api/shop").set(bearer(token))).body.find((item: { name: string }) => item.name === "Tempo extra");
      const results = await Promise.all([1, 2, 3].map(() => api.post(`/api/shop/buy/${time.id}`).set(bearer(token))));
      expect(results.filter((response) => response.status === 200)).toHaveLength(1);
      expect((await prisma.user.findUniqueOrThrow({ where: { email: "user@email.com" } })).coins).toBe(0);
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
      await prisma.user.update({ where: { email: "admin2@email.com" }, data: { totalScore: 900, deleted: true } });
      const token = await login("user@email.com");
      const ranking = await api.get("/api/ranking").set(bearer(token));
      expect(ranking.body).toEqual([expect.objectContaining({ position: 1, userName: "Usuário Teste", totalScore: 500 })]);
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
