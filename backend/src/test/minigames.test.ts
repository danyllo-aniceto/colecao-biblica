import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../db/prisma";
import { BOOKS } from "../minigames/books";
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
    expect(first.body.games).toHaveLength(17);
    expect(first.body.games.every((game: { unlocked: boolean }) => !game.unlocked)).toBe(true);
    expect(first.body.rankingUnlocked).toBe(false);
    expect((await api.get("/api/minigames/ranking").set(bearer(token))).status).toBe(400);

    await giveStones("user@email.com", [1, 3]);
    const some = (await api.get("/api/minigames").set(bearer(token))).body;
    expect(some.games.filter((game: { unlocked: boolean }) => game.unlocked).map((game: { stoneSlot: number }) => game.stoneSlot)).toEqual([1, 1, 3, 3]);
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

describe.skipIf(!hasDatabase)("mini games: partidas", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  async function unlockAll(final = true) {
    const userId = await giveStones("user@email.com", Array.from({ length: 12 }, (_, index) => index + 1), final);
    return { userId, token: await login("user@email.com") };
  }

  const start = (token: string, game: string) => api.post(`/api/minigames/${game}/start`).set(bearer(token));
  const finish = (token: string, runId: string, body: object) => api.post(`/api/minigames/runs/${runId}/finish`).set(bearer(token)).send(body);

  it("não começa jogo bloqueado nem inexistente ou ainda não feito", async () => {
    const token = await login("user@email.com");
    expect((await start(token, "caca-palavras")).status).toBe(400);
    expect((await start(token, "nao-existe")).status).toBe(404);
    await giveStones("user@email.com", [1, 9]);
    // Palavras cruzadas (pedra 9) está liberado mas ainda não existe no app.
    expect((await start(token, "palavras-cruzadas")).body.message).toMatch(/não está disponível/);
  });

  it("resolve o labirinto: o servidor confere, pontua, dá moedas uma vez no dia e guarda a melhor no ranking", async () => {
    const { userId, token } = await unlockAll();
    const coinsBefore = (await prisma.user.findUniqueOrThrow({ where: { id: userId } })).coins;
    const started = await start(token, "labirinto");
    expect(started.status).toBe(200);
    const { runId, puzzle } = started.body as { runId: string; puzzle: { width: number; height: number; cells: number[] } };
    // Caminho curto por busca (só o teste conhece o gabarito do labirinto pois ele vai inteiro para a tela).
    const dirs: Array<[string, number, number, number]> = [["U", -1, 0, 1], ["R", 0, 1, 2], ["D", 1, 0, 4], ["L", 0, -1, 8]];
    const previous = new Map<number, [number, string]>();
    const seen = new Set([0]);
    const queue = [0];
    for (let head = 0; head < queue.length; head += 1) {
      const at = queue[head];
      for (const [name, dr, dc, bit] of dirs) {
        if (!(puzzle.cells[at] & bit)) continue;
        const next = (Math.floor(at / puzzle.width) + dr) * puzzle.width + ((at % puzzle.width) + dc);
        if (seen.has(next)) continue;
        seen.add(next);
        previous.set(next, [at, name]);
        queue.push(next);
      }
    }
    let moves = "";
    for (let at = puzzle.width * puzzle.height - 1; at !== 0; ) {
      const [from, name] = previous.get(at)!;
      moves = name + moves;
      at = from;
    }
    const done = await finish(token, runId, { moves });
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ solved: true, coins: 10, recorded: true, rankingUnlocked: true });
    expect(done.body.score).toBeGreaterThan(700);
    expect(done.body.userCoins).toBe(coinsBefore + 10);
    // A mesma partida não vale duas vezes.
    expect((await finish(token, runId, { moves })).status).toBe(400);
    // Outra partida no mesmo jogo, no mesmo dia: sem moedas, e a melhor pontuação só sobe se melhorar.
    const again = (await start(token, "labirinto")).body as { runId: string };
    const slow = await finish(token, again.runId, { moves: "X" });
    expect(slow.status).toBe(200);
    expect(slow.body).toMatchObject({ solved: false, score: 0, coins: 0 });
    const ranking = await api.get("/api/minigames/ranking").set(bearer(token));
    expect(ranking.body.me.total).toBe(done.body.score);
  });

  it("forca: a palavra nunca sai do servidor; palpites são conferidos lá e vencer rende moedas", async () => {
    const { userId, token } = await unlockAll();
    const started = await start(token, "forca");
    expect(started.status).toBe(200);
    const { runId, puzzle } = started.body;
    expect(JSON.stringify(started.body)).not.toMatch(/"word"/);
    expect(puzzle.maxErrors).toBe(6);
    const stored = (await prisma.miniGameRun.findUniqueOrThrow({ where: { id: runId } })).state as { hangman: { word: string } };
    const word = stored.hangman.word;
    expect(puzzle.pattern.length).toBe(word.length);
    expect((await api.post(`/api/minigames/runs/${runId}/guess`).set(bearer(token)).send({ letter: "12" })).status).toBe(400);
    let last: { status: string; result?: { coins: number; solved: boolean } } = { status: "playing" };
    for (const letter of new Set([...word.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z]/g, "")])) {
      const response = await api.post(`/api/minigames/runs/${runId}/guess`).set(bearer(token)).send({ letter });
      expect(response.status).toBe(200);
      last = response.body;
    }
    expect(last.status).toBe("won");
    expect(last.result).toMatchObject({ solved: true, coins: 10 });
    expect((await api.post(`/api/minigames/runs/${runId}/guess`).set(bearer(token)).send({ letter: "A" })).status).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).coins).toBeGreaterThanOrEqual(10);
  });

  it("forca: perder (6 erros) revela a palavra e não rende moedas", async () => {
    const { token } = await unlockAll();
    const { runId } = (await start(token, "forca")).body as { runId: string };
    const word = ((await prisma.miniGameRun.findUniqueOrThrow({ where: { id: runId } })).state as { hangman: { word: string } }).hangman.word;
    const inWord = new Set(word.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase());
    const wrong = [..."QWXZKYJVBPFGHU"].filter((letter) => !inWord.has(letter)).slice(0, 6);
    let last: { status: string; word?: string; result?: { coins: number } } = { status: "playing" };
    for (const letter of wrong) last = (await api.post(`/api/minigames/runs/${runId}/guess`).set(bearer(token)).send({ letter })).body;
    expect(last).toMatchObject({ status: "lost", word, result: { coins: 0 } });
  });

  it("os outros jogos começam sem erro e a resposta vazia não pontua", async () => {
    const { token } = await unlockAll();
    for (const [game, body] of [["caca-palavras", { found: [] }], ["quebra-cabeca", { swaps: [] }], ["memoria", { flips: [] }], ["versiculo", { taps: [] }]] as const) {
      const started = await start(token, game);
      expect(started.status, game).toBe(200);
      const result = await finish(token, started.body.runId, body);
      expect(result.status, game).toBe(200);
      expect(result.body.solved, game).toBe(false);
      expect(result.body.coins, game).toBe(0);
    }
    // Resposta com formato errado é recusada.
    const bad = await start(token, "memoria");
    expect((await finish(token, bad.body.runId, { flips: "x" })).status).toBe(400);
  });

  it("só 3 jogos por dia rendem moedas, e quem não completou o Peitoral joga mas não pontua no ranking", async () => {
    const { userId, token } = await unlockAll(false);
    // Vitória rápida de 4 jogos: cada resposta é montada com o gabarito guardado no banco.
    const wins: number[] = [];
    for (const game of ["quebra-cabeca", "memoria", "versiculo", "caca-palavras"]) {
      const { runId } = (await start(token, game)).body as { runId: string };
      const state = (await prisma.miniGameRun.findUniqueOrThrow({ where: { id: runId } })).state as Record<string, unknown>;
      let body: object;
      if (game === "quebra-cabeca") {
        const order = [...(state.puzzle as { order: number[] }).order];
        const swaps: Array<[number, number]> = [];
        for (let position = 0; position < order.length; position += 1) {
          if (order[position] === position) continue;
          const at = order.indexOf(position);
          [order[position], order[at]] = [order[at], order[position]];
          swaps.push([position, at]);
        }
        body = { swaps };
      } else if (game === "memoria") {
        const cards = (state.memory as { cards: Array<{ pair: number }> }).cards;
        const flips = [...new Set(cards.map((card) => card.pair))].flatMap((pair) => cards.flatMap((card, index) => (card.pair === pair ? [index] : [])));
        body = { flips };
      } else if (game === "versiculo") {
        const { puzzle, words } = state as { puzzle: { chips: string[] }; words: string[] };
        const used = new Set<number>();
        body = { taps: words.map((word) => { const index = puzzle.chips.findIndex((chip, at) => chip === word && !used.has(at)); used.add(index); return index; }) };
      } else {
        const puzzle = state.puzzle as { size: number; grid: string[]; words: string[] };
        const found = puzzle.words.map((word) => {
          for (let r = 0; r < puzzle.size; r += 1) for (let c = 0; c < puzzle.size; c += 1) for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]]) {
            const er = r + dr * (word.length - 1);
            const ec = c + dc * (word.length - 1);
            if (er < 0 || er >= puzzle.size || ec < 0 || ec >= puzzle.size) continue;
            let text = "";
            for (let i = 0; i < word.length; i += 1) text += puzzle.grid[r + dr * i][c + dc * i];
            if (text === word) return { word, from: [r, c], to: [er, ec] };
          }
          throw new Error("palavra não achada");
        });
        body = { found };
      }
      const result = await finish(token, runId, body);
      expect(result.status, game).toBe(200);
      expect(result.body.solved, game).toBe(true);
      expect(result.body.rankingUnlocked).toBe(false);
      expect(result.body.recorded).toBe(false);
      wins.push(result.body.coins);
    }
    expect(wins).toEqual([10, 10, 10, 0]);
    expect(await prisma.miniGameScore.count({ where: { userId } })).toBe(0);
    const overview = (await api.get("/api/minigames").set(bearer(token))).body;
    expect(overview.coins).toEqual({ perWin: 10, limit: 3, winsToday: 3 });
  });
});

describe.skipIf(!hasDatabase)("mini games: jogos novos e administrador", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  const start = (token: string, game: string) => api.post(`/api/minigames/${game}/start`).set(bearer(token));
  const finish = (token: string, runId: string, body: object) => api.post(`/api/minigames/runs/${runId}/finish`).set(bearer(token)).send(body);
  const act = (token: string, runId: string, body: object) => api.post(`/api/minigames/runs/${runId}/act`).set(bearer(token)).send(body);
  const stateOf = async (runId: string) => (await prisma.miniGameRun.findUniqueOrThrow({ where: { id: runId } })).state as Record<string, any>;

  async function unlockAll() {
    await giveStones("user@email.com", Array.from({ length: 12 }, (_, index) => index + 1), true);
    return login("user@email.com");
  }

  it("o administrador tem todos os jogos liberados para testar; o jogador comum não", async () => {
    const admin = await login("admin2@email.com");
    const overview = (await api.get("/api/minigames").set(bearer(admin))).body;
    expect(overview.adminPreview).toBe(true);
    expect(overview.rankingUnlocked).toBe(true);
    expect(overview.games.every((game: { unlocked: boolean }) => game.unlocked)).toBe(true);
    expect((await start(admin, "livros")).status).toBe(200);
    // Jogo que ainda não existe continua indisponível, até para o administrador.
    expect((await start(admin, "mapa")).body.message).toMatch(/não está disponível/);
    const user = await login("user@email.com");
    const plain = (await api.get("/api/minigames").set(bearer(user))).body;
    expect(plain.adminPreview).toBe(false);
    expect(plain.games.some((game: { unlocked: boolean }) => game.unlocked)).toBe(false);
    expect((await start(user, "livros")).status).toBe(400);
  });

  it("livros em ordem, antigo ou novo, complete o versículo e relâmpago: o servidor confere e dá as moedas", async () => {
    const token = await unlockAll();
    // Relâmpago precisa de perguntas: o seed de demonstração tem poucas.
    await prisma.question.createMany({
      data: Array.from({ length: 8 }, (_, index) => ({ text: `Pergunta extra ${index}?`, difficulty: "EASY" as const, timeLimitSeconds: 20, optionA: "Certa", optionB: "Errada B", optionC: "Errada C", optionD: "Errada D", correctOption: "A" })),
    });

    const livros = (await start(token, "livros")).body;
    const sorted = [...livros.puzzle.books].sort((a: string, b: string) => BOOKS.indexOf(a as never) - BOOKS.indexOf(b as never));
    expect((await finish(token, livros.runId, { order: sorted })).body).toMatchObject({ solved: true, coins: 10 });

    const testamento = (await start(token, "testamento")).body;
    const items = (await stateOf(testamento.runId)).items as Array<{ answer: string }>;
    expect(testamento.puzzle.items).toHaveLength(10);
    expect(JSON.stringify(testamento.puzzle)).not.toMatch(/"answer"/);
    expect((await finish(token, testamento.runId, { choices: items.map((item) => item.answer) })).body).toMatchObject({ solved: true, coins: 10 });

    const lacunas = (await start(token, "lacunas")).body;
    const blanks = await stateOf(lacunas.runId);
    expect(lacunas.puzzle.options).toHaveLength(6);
    expect(JSON.stringify(lacunas.puzzle)).not.toContain(JSON.stringify(blanks.state.answers));
    expect((await finish(token, lacunas.runId, { fills: blanks.state.answers })).body).toMatchObject({ solved: true, coins: 10 });

    const relampago = (await start(token, "relampago")).body;
    const truths = (await stateOf(relampago.runId)).state.truths as boolean[];
    expect(relampago.puzzle.statements.length).toBeGreaterThanOrEqual(5);
    // Já gastou as 3 vitórias com moedas do dia: ganha pontos, mas não moedas.
    expect((await finish(token, relampago.runId, { answers: truths })).body).toMatchObject({ solved: true, coins: 0 });
  });

  it("anagrama: 3 tentativas conferidas no servidor", async () => {
    const token = await unlockAll();
    const run = (await start(token, "anagrama")).body;
    const word = (await stateOf(run.runId)).state.word as string;
    expect(JSON.stringify(run)).not.toContain(`"${word}"`);
    expect(run.puzzle.length).toBe(run.puzzle.letters.length);
    const wrong = await act(token, run.runId, { action: "check", word: "zzzz" });
    expect(wrong.body).toMatchObject({ status: "playing", attemptsLeft: 2 });
    const right = await act(token, run.runId, { action: "check", word });
    expect(right.body).toMatchObject({ status: "won", result: { solved: true, coins: 10 } });
    expect((await act(token, run.runId, { action: "check", word })).status).toBe(400);

    const lost = (await start(token, "anagrama")).body;
    let last: { status: string; answer?: string } = { status: "playing" };
    for (let attempt = 0; attempt < 3; attempt += 1) last = (await act(token, lost.runId, { action: "check", word: "zzzz" })).body;
    expect(last.status).toBe("lost");
    expect(last.answer).toBeTruthy();
  });

  it("quem sou eu?: dicas uma a uma, menos dicas rendem mais; resposta errada perde", async () => {
    const token = await unlockAll();
    const run = (await start(token, "quem-sou-eu")).body;
    expect(run.puzzle.shown).toBe(1);
    expect(run.puzzle.options).toHaveLength(4);
    const state = (await stateOf(run.runId)).state as { answer: number; options: string[]; clues: string[] };
    const hint = await act(token, run.runId, { action: "hint" });
    expect(hint.body).toMatchObject({ status: "playing", shown: 2, clue: state.clues[1] });
    const won = await act(token, run.runId, { action: "answer", choice: state.answer });
    expect(won.body).toMatchObject({ status: "won", result: { solved: true, coins: 10 } });
    expect(won.body.result.score).toBe(550 + 300);

    const second = (await start(token, "quem-sou-eu")).body;
    const stored = (await stateOf(second.runId)).state as { answer: number; options: string[] };
    const lost = await act(token, second.runId, { action: "answer", choice: (stored.answer + 1) % 4 });
    expect(lost.body).toMatchObject({ status: "lost", answer: stored.options[stored.answer], result: { solved: false, score: 0 } });
    expect((await act(token, second.runId, { action: "hint" })).status).toBe(400);
  });
});
