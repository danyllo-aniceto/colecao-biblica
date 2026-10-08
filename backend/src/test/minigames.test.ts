import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../db/prisma";
import { recordMiniGameScore } from "../services/minigames";
import { api, bearer, login, resetDatabase } from "./helpers";

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

/** Dá ao jogador as pedras (resgatadas) e, se pedido, a conquista final do Peitoral. */
async function giveStones(email: string, slots: number[], final = false) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  await prisma.userClaim.createMany({ data: slots.map((slot) => ({ userId: user.id, kind: "STONE", code: String(slot), periodKey: "once" })) });
  if (final) await prisma.userClaim.create({ data: { userId: user.id, kind: "BREASTPLATE", code: "once", periodKey: "once" } });
  return user.id;
}

describe.skipIf(!hasDatabase)("mini games", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("cada pedra resgatada libera o jogo dela; o ranking semanal só abre com o Peitoral Completo", async () => {
    const token = await login("user@email.com");
    const first = await api.get("/api/minigames").set(bearer(token));
    expect(first.status).toBe(200);
    expect(first.body.games).toHaveLength(12);
    expect(first.body.games.every((game: { unlocked: boolean }) => !game.unlocked)).toBe(true);
    expect(first.body.rankingUnlocked).toBe(false);
    expect((await api.get("/api/minigames/ranking").set(bearer(token))).status).toBe(400);

    await giveStones("user@email.com", [1, 3]);
    const some = (await api.get("/api/minigames").set(bearer(token))).body;
    expect(some.games.filter((game: { unlocked: boolean }) => game.unlocked).map((game: { stoneSlot: number }) => game.stoneSlot)).toEqual([1, 3]);
    expect(some.games[0].stoneName).toBe("Sardônio");
    expect(some.rankingUnlocked).toBe(false);
  });

  it("a pontuação guarda só a melhor da semana e só entra no ranking quem completou o Peitoral", async () => {
    const token = await login("user@email.com");
    const userId = await giveStones("user@email.com", [1]);
    // Sem o Peitoral completo a pontuação não é guardada.
    expect(await recordMiniGameScore(prisma, userId, "caca-palavras", 100)).toMatchObject({ recorded: false });
    await expect(recordMiniGameScore(prisma, userId, "forca", 10)).rejects.toThrow("ainda não foi liberado");
    await expect(recordMiniGameScore(prisma, userId, "nao-existe", 10)).rejects.toThrow("não encontrado");
    await expect(recordMiniGameScore(prisma, userId, "caca-palavras", -1)).rejects.toThrow("inválida");

    await prisma.userClaim.createMany({ data: Array.from({ length: 11 }, (_, index) => ({ userId, kind: "STONE", code: String(index + 2), periodKey: "once" })) });
    await prisma.userClaim.create({ data: { userId, kind: "BREASTPLATE", code: "once", periodKey: "once" } });
    const best = await recordMiniGameScore(prisma, userId, "caca-palavras", 100);
    expect(best).toMatchObject({ recorded: true, best: 100 });
    expect(await recordMiniGameScore(prisma, userId, "caca-palavras", 60)).toMatchObject({ recorded: false, best: 100 });
    expect(await recordMiniGameScore(prisma, userId, "forca", 40)).toMatchObject({ recorded: true });
    expect(await recordMiniGameScore(prisma, userId, "caca-palavras", 130)).toMatchObject({ recorded: true, best: 130 });

    const ranking = await api.get("/api/minigames/ranking").set(bearer(token));
    expect(ranking.status).toBe(200);
    expect(ranking.body.content).toHaveLength(1);
    expect(ranking.body.content[0]).toMatchObject({ position: 1, userId, total: 170 });
    expect(ranking.body.me).toMatchObject({ position: 1, total: 170 });
  });

  it("a Galeria dos Peitorais lista quem completou, paginada, do primeiro ao mais recente", async () => {
    const token = await login("user@email.com");
    const empty = await api.get("/api/minigames/gallery").set(bearer(token));
    expect(empty.status).toBe(200);
    expect(empty.body.content).toHaveLength(0);
    expect(empty.body.me).toBeNull();

    await giveStones("user@email.com", [], true);
    const one = await api.get("/api/minigames/gallery?page=0&size=1").set(bearer(token));
    expect(one.body.totalElements).toBe(1);
    expect(one.body.content[0]).toMatchObject({ position: 1, userName: expect.any(String) });
    expect(one.body.me.completedAt).toBeTruthy();
  });
});
