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

  const start = (token: string, game: string, options: object = {}) => api.post(`/api/minigames/${game}/start`).set(bearer(token)).send(options);
  const finish = (token: string, runId: string, body: object) => api.post(`/api/minigames/runs/${runId}/finish`).set(bearer(token)).send(body);

  it("não começa jogo bloqueado nem inexistente ou ainda não feito", async () => {
    const token = await login("user@email.com");
    expect((await start(token, "caca-palavras")).status).toBe(400);
    expect((await start(token, "nao-existe")).status).toBe(404);
    await giveStones("user@email.com", [1, 9]);
    // Jogo de outra pedra continua bloqueado; o da pedra 9 abre.
    expect((await start(token, "mapa")).body.message).toMatch(/não foi liberado/);
    expect((await start(token, "palavras-cruzadas")).status).toBe(200);
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

  const act = (token: string, runId: string, body: object) => api.post(`/api/minigames/runs/${runId}/act`).set(bearer(token)).send(body);
  const stateOf = async (runId: string) => (await prisma.miniGameRun.findUniqueOrThrow({ where: { id: runId } })).state as Record<string, any>;
  const base = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z]/g, "");

  it("forca em turnos: a palavra nunca sai do servidor; palpites conferidos lá; vencer todas rende moedas", async () => {
    const { userId, token } = await unlockAll();
    const started = await start(token, "forca", { difficulty: "facil", rounds: 3, time: 60 });
    expect(started.status).toBe(200);
    const { runId, puzzle } = started.body;
    expect(JSON.stringify(started.body)).not.toMatch(/"word"/);
    expect(puzzle).toMatchObject({ round: 0, maxErrors: 8, timePerRound: 60, level: "facil" });
    const rounds = ((await prisma.miniGameRun.findUniqueOrThrow({ where: { id: runId } })).state as { state: { rounds: Array<{ word: string }> } }).state.rounds;
    expect(puzzle.pattern.length).toBe(rounds[0].word.length);
    expect((await act(token, runId, { action: "guess", letter: "12" })).status).toBe(400);
    // Ainda há tempo: o servidor recusa o "tempo esgotado".
    expect((await act(token, runId, { action: "timeout" })).status).toBe(400);
    let last: { status: string; result?: { coins: number; solved: boolean } } = { status: "playing" };
    for (const round of rounds) {
      for (const letter of new Set([...base(round.word)])) {
        const response = await act(token, runId, { action: "guess", letter });
        expect(response.status).toBe(200);
        last = response.body;
      }
      await act(token, runId, { action: "begin" });
    }
    expect(last.status).toBe("won");
    expect(last.result).toMatchObject({ solved: true, coins: 10 });
    expect((await act(token, runId, { action: "guess", letter: "A" })).status).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).coins).toBeGreaterThanOrEqual(10);
    expect((await start(token, "forca", { rounds: 4 })).status).toBe(400);
  });

  it("forca: perder as palavras revela a resposta e não rende moedas", async () => {
    const { token } = await unlockAll();
    const { runId } = (await start(token, "forca", { rounds: 1, difficulty: "medio" })).body as { runId: string };
    const word = ((await prisma.miniGameRun.findUniqueOrThrow({ where: { id: runId } })).state as { state: { rounds: Array<{ word: string }> } }).state.rounds[0].word;
    const inWord = new Set(base(word));
    const wrong = [..."QWXZKYJVBPFGHU"].filter((letter) => !inWord.has(letter)).slice(0, 6);
    let last: { status: string; turn?: { end?: { answer: string } }; result?: { coins: number } } = { status: "playing" };
    for (const letter of wrong) last = (await act(token, runId, { action: "guess", letter })).body;
    expect(last).toMatchObject({ status: "lost", turn: { kind: "end", end: { answer: word } }, result: { coins: 0 } });
  });

  it("livros em ordem em turnos e antigo ou novo? conferidos no servidor", async () => {
    const { token } = await unlockAll();
    const livros = (await start(token, "livros", { difficulty: "facil", rounds: 3 })).body;
    const sets = (await stateOf(livros.runId)).state.sets as string[][];
    expect(livros.puzzle.books).toHaveLength(4);
    expect(livros.puzzle.books[0].testament).not.toBeUndefined();
    expect((await act(token, livros.runId, { action: "order", order: ["Gênesis"] })).status).toBe(400);
    let last = { status: "playing" } as { status: string; result?: unknown };
    for (const set of sets) last = (await act(token, livros.runId, { action: "order", order: set })).body;
    expect(last).toMatchObject({ status: "won", result: { solved: true, coins: 10 } });

    const testamento = (await start(token, "testamento", { difficulty: "medio", rounds: 10, time: 12 })).body;
    const items = (await stateOf(testamento.runId)).state.items as Array<{ text: string; answer: string }>;
    expect(items).toHaveLength(10);
    expect(JSON.stringify(testamento.puzzle)).not.toMatch(/"answer"/);
    const first = await act(token, testamento.runId, { action: "classify", choice: items[0].answer });
    expect(first.body.turn).toMatchObject({ kind: "end", end: { right: true, correct: items[0].answer } });
    let end = first.body;
    for (const item of items.slice(1)) {
      await act(token, testamento.runId, { action: "begin" });
      end = (await act(token, testamento.runId, { action: "classify", choice: item.answer })).body;
    }
    expect(end).toMatchObject({ status: "won", result: { solved: true } });
  });

  it("os outros jogos começam sem erro e a resposta vazia não pontua", async () => {
    const { token } = await unlockAll();
    for (const [game, body] of [["caca-palavras", { found: [] }], ["quebra-cabeca", { swaps: [] }], ["memoria", { flips: [] }]] as const) {
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
    for (const game of ["quebra-cabeca", "memoria", "caca-palavras"]) {
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
    // O quarto jogo (em turnos) já não rende moedas: o limite é de 3 jogos por dia.
    const livros = (await start(token, "livros", { difficulty: "facil", rounds: 1 })).body;
    const set = ((await prisma.miniGameRun.findUniqueOrThrow({ where: { id: livros.runId } })).state as { state: { sets: string[][] } }).state.sets[0];
    const fourth = await act(token, livros.runId, { action: "order", order: set });
    expect(fourth.body).toMatchObject({ status: "won", result: { solved: true, rankingUnlocked: false, recorded: false } });
    wins.push(fourth.body.result.coins);
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

  const start = (token: string, game: string, options: object = {}) => api.post(`/api/minigames/${game}/start`).set(bearer(token)).send(options);
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
    expect((await start(admin, "mapa")).status).toBe(200);
    const user = await login("user@email.com");
    const plain = (await api.get("/api/minigames").set(bearer(user))).body;
    expect(plain.adminPreview).toBe(false);
    expect(plain.games.some((game: { unlocked: boolean }) => game.unlocked)).toBe(false);
    expect((await start(user, "livros")).status).toBe(400);
  });

  it("complete o versículo e relâmpago: o servidor confere e dá as moedas", async () => {
    const token = await unlockAll();
    // Relâmpago precisa de perguntas: o seed de demonstração tem poucas.
    await prisma.question.createMany({
      data: Array.from({ length: 8 }, (_, index) => ({ text: `Pergunta extra ${index}?`, difficulty: "EASY" as const, timeLimitSeconds: 20, optionA: "Certa", optionB: "Errada B", optionC: "Errada C", optionD: "Errada D", correctOption: "A" })),
    });

    const lacunas = (await start(token, "lacunas", { difficulty: "medio", rounds: 1 })).body;
    const blanks = (await stateOf(lacunas.runId)).state.rounds as Array<{ answers: string[] }>;
    expect(lacunas.puzzle.options).toHaveLength(6);
    expect(JSON.stringify(lacunas.puzzle)).not.toContain(JSON.stringify(blanks[0].answers));
    expect((await act(token, lacunas.runId, { action: "fill", fills: blanks[0].answers })).body).toMatchObject({ status: "won", result: { solved: true, coins: 10 } });

    const relampago = (await start(token, "relampago", { difficulty: "facil", rounds: 10, time: 12 })).body;
    const items = (await stateOf(relampago.runId)).state.items as Array<{ truth: boolean }>;
    expect(relampago.puzzle.total).toBeGreaterThanOrEqual(5);
    expect(JSON.stringify(relampago.puzzle)).not.toContain("truth");
    let blitz = (await act(token, relampago.runId, { action: "judge", value: items[0].truth })).body;
    expect(blitz.turn).toMatchObject({ kind: "end", end: { right: true } });
    for (const item of items.slice(1)) {
      await act(token, relampago.runId, { action: "begin" });
      blitz = (await act(token, relampago.runId, { action: "judge", value: item.truth })).body;
    }
    // Já gastou as 3 vitórias com moedas do dia: ganha pontos, mas não moedas.
    expect(blitz).toMatchObject({ status: "won", result: { solved: true, coins: 0 } });
  });

  it("versículo em pedaços: o servidor confere cada toque e a ordem nunca vai à tela", async () => {
    const token = await unlockAll();
    const run = (await start(token, "versiculo", { difficulty: "medio", rounds: 1 })).body;
    expect(JSON.stringify(run.puzzle)).not.toContain('"words"');
    const round = ((await stateOf(run.runId)).state.rounds as Array<{ words: string[]; chips: string[] }>)[0];
    const used = new Set<number>();
    const taps = round.words.map((word) => {
      const index = round.chips.findIndex((chip, at) => chip === word && !used.has(at));
      used.add(index);
      return index;
    });
    expect((await act(token, run.runId, { action: "tap", index: 9999 })).status).toBe(400);
    const wrong = round.chips.findIndex((chip, at) => chip !== round.words[0] && at !== taps[0]);
    expect((await act(token, run.runId, { action: "tap", index: wrong })).body.turn).toMatchObject({ kind: "tap", right: false, errors: 1 });
    expect((await act(token, run.runId, { action: "hint" })).body.turn).toMatchObject({ kind: "hint", index: taps[0] });
    let last = { status: "playing" } as { status: string; result?: unknown };
    for (const index of taps) last = (await act(token, run.runId, { action: "tap", index })).body;
    expect(last).toMatchObject({ status: "won", result: { solved: true, coins: 10 } });
  });

  it("anagrama: turnos, tentativas e tempo conferidos no servidor", async () => {
    const token = await unlockAll();
    const run = (await start(token, "anagrama", { difficulty: "facil", rounds: 3, time: 45 })).body;
    const rounds = (await stateOf(run.runId)).state.rounds as Array<{ word: string }>;
    expect(rounds.length).toBeGreaterThan(0);
    expect(JSON.stringify(run)).not.toContain(`"${rounds[0].word}"`);
    expect(run.puzzle).toMatchObject({ round: 0, timePerRound: 45, difficulty: "facil" });
    expect(run.puzzle.length).toBe(run.puzzle.letters.length);
    const wrong = await act(token, run.runId, { action: "check", word: "zzzz" });
    expect(wrong.body).toMatchObject({ status: "playing", turn: { kind: "wrong", attemptsLeft: 2 } });
    // Ainda há tempo: o servidor recusa o "tempo esgotado".
    expect((await act(token, run.runId, { action: "timeout" })).status).toBe(400);
    let last = (await act(token, run.runId, { action: "check", word: rounds[0].word })).body;
    expect(last.turn).toMatchObject({ kind: "end", end: { right: true, answer: rounds[0].word } });
    for (let index = 1; index < rounds.length; index += 1) {
      await act(token, run.runId, { action: "begin" });
      last = (await act(token, run.runId, { action: "check", word: rounds[index].word })).body;
    }
    expect(last).toMatchObject({ status: "won", result: { solved: true, coins: 10 } });
    expect((await act(token, run.runId, { action: "check", word: rounds[0].word })).status).toBe(400);

    const lost = (await start(token, "anagrama", { rounds: 3 })).body;
    const lostRounds = (await stateOf(lost.runId)).state.rounds as unknown[];
    let ending: { status: string } = { status: "playing" };
    for (let index = 0; index < lostRounds.length; index += 1) ending = (await act(token, lost.runId, { action: "skip" })).body;
    expect(ending.status).toBe("lost");
    // Opção inválida é recusada.
    expect((await start(token, "anagrama", { rounds: 4 })).status).toBe(400);
  });

  it("quem sou eu? em turnos: dicas uma a uma, a foto só no fim, menos dicas rendem mais; resposta errada perde o turno", async () => {
    const token = await unlockAll();
    const run = (await start(token, "quem-sou-eu", { difficulty: "medio", rounds: 3 })).body;
    expect(run.puzzle.clues).toHaveLength(1);
    expect(run.puzzle.options).toHaveLength(4);
    expect(JSON.stringify(run.puzzle)).not.toMatch(/answer|imageUrl/);
    const rounds = (await stateOf(run.runId)).state.rounds as Array<{ answer: number; options: string[]; clues: string[]; name: string }>;
    const hint = await act(token, run.runId, { action: "hint" });
    expect(hint.body).toMatchObject({ status: "playing", turn: { kind: "hint", shown: 2, clue: rounds[0].clues[1] } });
    const first = await act(token, run.runId, { action: "answer", choice: rounds[0].answer });
    expect(first.body.turn).toMatchObject({ kind: "end", end: { right: true, answer: rounds[0].name } });
    await act(token, run.runId, { action: "begin" });
    const second = await act(token, run.runId, { action: "answer", choice: (rounds[1].answer + 1) % 4 });
    expect(second.body.turn).toMatchObject({ kind: "end", end: { right: false } });
    await act(token, run.runId, { action: "begin" });
    const last = await act(token, run.runId, { action: "answer", choice: rounds[2].answer });
    expect(last.body).toMatchObject({ status: "won", result: { solved: true, coins: 10 } });
    expect((await act(token, run.runId, { action: "hint" })).status).toBe(400);
    expect((await start(token, "quem-sou-eu", { rounds: 4 })).status).toBe(400);
  });

  it("linha do tempo, mapa, árvore e interconexão: o servidor confere pelo gabarito e a solução não vai à tela", async () => {
    const token = await unlockAll();

    const timeline = (await start(token, "linha-do-tempo")).body;
    expect(JSON.stringify(timeline.puzzle)).not.toMatch(/year|"order"/);
    const order = (await stateOf(timeline.runId)).state.order as string[];
    expect((await finish(token, timeline.runId, { order })).body).toMatchObject({ solved: true, coins: 10, score: expect.any(Number) });

    const map = (await start(token, "mapa")).body;
    expect(map.puzzle.places).toHaveLength(5);
    expect(JSON.stringify(map.puzzle)).not.toMatch(/"lat"/);
    const places = (await stateOf(map.runId)).state.places as Array<{ lat: number; lon: number }>;
    expect((await finish(token, map.runId, { guesses: places.map(({ lat, lon }) => ({ lat, lon })) })).body).toMatchObject({ solved: true, score: 1000 });

    const lineage = (await start(token, "arvore")).body;
    const pairs = (await stateOf(lineage.runId)).state.pairs as Array<{ father: string; son: string }>;
    const links = lineage.puzzle.fathers.map((father: string) => pairs.find((pair) => pair.father === father)!.son);
    expect((await finish(token, lineage.runId, { fathers: lineage.puzzle.fathers, links })).body).toMatchObject({ solved: true });

    const chain = (await start(token, "interconexao")).body;
    const { from, to } = chain.puzzle as { from: string; to: string; edges: Array<[string, string, string, string]> };
    // Caminho mais curto por busca nas relações que a própria tela recebeu.
    const around = (node: string) => chain.puzzle.edges.flatMap(([a, b]: [string, string]) => (a === node ? [b] : b === node ? [a] : []));
    const previous = new Map<string, string>();
    const queue = [from];
    for (let head = 0; head < queue.length; head += 1) for (const next of around(queue[head])) if (next !== from && !previous.has(next)) { previous.set(next, queue[head]); queue.push(next); }
    const path = [to];
    while (path[0] !== from) path.unshift(previous.get(path[0])!);
    expect((await finish(token, chain.runId, { path })).body).toMatchObject({ solved: true, score: expect.any(Number) });
    expect((await finish(token, chain.runId, { path })).status).toBe(400);
  });

  it("palavras cruzadas: a grade chega sem as letras; conferir e revelar são contados no servidor; a solução guardada vence", async () => {
    const token = await unlockAll();
    const run = (await start(token, "palavras-cruzadas", { difficulty: "facil", time: 300 })).body;
    expect(run.puzzle.words.length).toBeGreaterThanOrEqual(4);
    expect(run.puzzle).toMatchObject({ level: "facil", timeLimit: 300 });
    expect(JSON.stringify(run.puzzle)).not.toMatch(/solution|imageUrl/);
    const rows = (await stateOf(run.runId)).state.solution as string[];
    expect(rows).toHaveLength(run.puzzle.rows);
    const empty = rows.map((row) => row.replace(/[A-Z]/g, " "));
    const verify = await act(token, run.runId, { action: "verify", rows: empty });
    expect(verify.body.turn).toMatchObject({ kind: "verify", wrong: [], left: 2 });
    const row = rows.findIndex((line) => /[A-Z]/.test(line));
    const col = rows[row].search(/[A-Z]/);
    const peek = await act(token, run.runId, { action: "peek", row, col });
    expect(peek.body.turn).toMatchObject({ kind: "peek", row, col, letter: rows[row][col], left: 4 });
    expect((await act(token, run.runId, { action: "peek", row: 0, col: 99 })).status).toBe(400);
    const done = await finish(token, run.runId, { rows });
    expect(done.body).toMatchObject({ solved: true, score: expect.any(Number) });
    expect(done.body.detail).toContain("2 ajudas");
    expect(done.body.reveal.length).toBeGreaterThanOrEqual(4);
    // 1.000 menos 80 de ajudas, vezes 60% do fácil.
    expect(done.body.score).toBe(Math.round((1000 - 50 - 30) * 0.6));
    const second = (await start(token, "palavras-cruzadas")).body;
    expect((await finish(token, second.runId, { rows: ["x"] })).body).toMatchObject({ solved: false, score: 0 });
    expect((await start(token, "palavras-cruzadas", { time: 123 })).status).toBe(400);
  });
});
