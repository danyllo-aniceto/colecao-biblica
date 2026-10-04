import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../db/prisma";
import { api, bearer, login, resetDatabase } from "./helpers";

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

type View = {
  changed: boolean;
  code: string;
  status: "LOBBY" | "PLAYING" | "FINISHED";
  version: number;
  hostUserId: number;
  config: { size: number; timeSeconds: number };
  players: Array<{ key: string; slot: number; userId: number | null; name: string; pawn: string; bot: string | null; replaced: boolean; isHost: boolean }>;
  me: { key: string; userId: number; isHost: boolean; wins: number | null } | null;
  state: { phase: string; turn: number; players: Array<{ id: string; name: string; position: number; bot: unknown }>; pending: { questionId: number; kind: string } | null; winnerId: string | null; rng: number } | null;
  question: Record<string, unknown> | null;
  reveal: { correctOption: string; correct: boolean; explanation: string | null } | null;
  log: string[];
  deadlineAt: number | null;
};

describe.skipIf(!hasDatabase)("tabuleiro online", () => {
  let ana: string;
  let bia: string;
  let anaId: number;
  let biaId: number;

  beforeEach(async () => {
    await resetDatabase();
    ana = await login("user@email.com");
    bia = await login("outro@email.com");
    anaId = (await prisma.user.findUniqueOrThrow({ where: { email: "user@email.com" } })).id;
    biaId = (await prisma.user.findUniqueOrThrow({ where: { email: "outro@email.com" } })).id;
    // Perguntas suficientes para uma partida (o seed de teste traz poucas).
    const count = await prisma.question.count();
    if (count < 60) {
      await prisma.question.createMany({
        data: Array.from({ length: 60 }, (_, index) => ({
          text: `Pergunta de teste ${index}?`,
          difficulty: (["EASY", "MEDIUM", "HARD", "VERY_HARD"] as const)[index % 4],
          timeLimitSeconds: 20,
          optionA: "A", optionB: "B", optionC: "C", optionD: "D",
          correctOption: ["A", "B", "C", "D"][index % 4],
          explanation: "Porque sim.",
          bibleReference: "Gênesis 1:1",
        })),
      });
    }
  });

  const get = async (token: string, code: string, since?: number) => {
    const response = await api.get(`/api/board/rooms/${code}${since === undefined ? "" : `?since=${since}`}`).set(bearer(token));
    return response;
  };
  const post = (token: string, path: string, body: object = {}) => api.post(`/api/board/rooms/${path}`).set(bearer(token)).send(body);
  const scenarioId = async () => (await prisma.scenario.findFirstOrThrow({ orderBy: { sortOrder: "asc" } })).id;

  async function newRoom(token = ana, config: object = {}) {
    const response = await api.post("/api/board/rooms").set(bearer(token)).send({ scenarioId: await scenarioId(), config });
    expect(response.status).toBe(201);
    return response.body as View;
  }

  /** Quem tem a vez numa sala em jogo. */
  const currentKey = (view: View) => view.state!.players[view.state!.turn].id;
  const tokenOfKey = (key: string) => (key === `u${anaId}` ? ana : key === `u${biaId}` ? bia : null);
  const correctOf = async (code: string, questionId: number) => {
    const room = await prisma.boardRoom.findUniqueOrThrow({ where: { code } });
    return (room.pool as Array<{ id: number; correct: string }>).find((item) => item.id === questionId)!.correct;
  };

  /** Joga as vezes de pessoas (certo/errado conforme `right`) e deixa o relógio andar para os bots, até acabar ou estourar o limite. */
  async function playUntilDone(code: string, options: { right: boolean; maxSteps?: number }) {
    let view = (await get(ana, code)).body as View;
    for (let step = 0; step < (options.maxSteps ?? 1500) && view.status === "PLAYING"; step += 1) {
      const key = currentKey(view);
      const token = tokenOfKey(key);
      if (view.reveal) {
        // Gabarito aberto: quem respondeu fecha, ou o relógio vence.
        const answerer = tokenOfKey((await prisma.boardRoom.findUniqueOrThrow({ where: { code } })).reveal ? ((await prisma.boardRoom.findUniqueOrThrow({ where: { code } })).reveal as { playerId: string }).playerId : "") ;
        if (answerer) await post(answerer, `${code}/continue`);
        else await prisma.boardRoom.update({ where: { code }, data: { dueAt: new Date(Date.now() - 1000) } });
      } else if (!token || view.state!.players[view.state!.turn].bot) {
        await prisma.boardRoom.update({ where: { code }, data: { dueAt: new Date(Date.now() - 1000) } });
      } else if (view.state!.phase === "ROLL") {
        await post(token, `${code}/roll`);
      } else if (view.state!.phase === "TRIAL_OFFER") {
        await post(token, `${code}/trial`, { accept: true });
      } else if (view.state!.pending) {
        const right = await correctOf(code, view.state!.pending.questionId);
        await post(token, `${code}/answer`, { selected: options.right ? right : right === "A" ? "B" : "A" });
      }
      view = (await get(ana, code)).body as View;
    }
    return view;
  }

  it("cria a sala, mostra a prévia pública e só deixa participantes olharem", async () => {
    const room = await newRoom();
    expect(room.code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
    expect(room).toMatchObject({ status: "LOBBY", hostUserId: anaId, me: { isHost: true } });
    expect(room.players).toHaveLength(1);
    expect(room.state).toBeNull();

    const preview = await api.get(`/api/board-public/${room.code.toLowerCase()}`);
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ code: room.code, hostName: "Usuário Teste", players: 1, maxPlayers: 6 });
    expect((await api.get("/api/board-public/ZZZZZ")).status).toBe(404);

    expect((await get(bia, room.code)).status).toBe(403);
    expect((await api.get(`/api/board/rooms/${room.code}`)).status).toBe(401);
    expect((await api.post("/api/board/rooms").set(bearer(ana)).send({ scenarioId: 999999 })).status).toBe(404);
    expect((await api.post("/api/board/rooms").set(bearer(ana)).send({ scenarioId: await scenarioId(), config: { size: 33 } })).status).toBe(400);
  });

  it("entrar: peão sem repetir, sala cheia, uma sala por pessoa e o código aceita minúsculas", async () => {
    const room = await newRoom();
    const joined = await post(bia, `${room.code.toLowerCase()}/join`, { pawn: room.players[0].pawn });
    expect(joined.status).toBe(200);
    const view = joined.body as View;
    expect(view.players).toHaveLength(2);
    // O peão pedido já era do anfitrião: a pessoa recebe outro.
    expect(view.players[1].pawn).not.toBe(view.players[0].pawn);
    expect((await api.get("/api/board/rooms/mine").set(bearer(bia))).body).toMatchObject({ code: room.code, status: "LOBBY" });

    // Peão que a pessoa não tem não vale.
    await post(bia, `${room.code}/leave`);
    const other = await post(bia, `${room.code}/join`, { pawn: "https://exemplo.com/peao-roubado.png" });
    expect((other.body as View).players[1].pawn).not.toBe("https://exemplo.com/peao-roubado.png");

    // Sala cheia: o anfitrião completa com bots.
    for (let n = 0; n < 4; n += 1) expect((await post(ana, `${room.code}/bots`, { skill: "MASTER" })).status).toBe(200);
    expect((await post(ana, `${room.code}/bots`, { skill: "MASTER" })).status).toBe(400);

    // Quem cria outra sala sai da anterior.
    const second = await newRoom(bia);
    const old = (await get(ana, room.code)).body as View;
    expect(old.players.some((player) => player.userId === biaId)).toBe(false);
    expect((await api.get("/api/board/rooms/mine").set(bearer(bia))).body.code).toBe(second.code);
  });

  it("só o anfitrião muda regras, bots, expulsa e começa; precisa de 2 jogadores", async () => {
    const room = await newRoom();
    await post(bia, `${room.code}/join`);
    const tryAsGuest = [
      await api.put(`/api/board/rooms/${room.code}/config`).set(bearer(bia)).send({ config: { size: 25 } }),
      await post(bia, `${room.code}/bots`, { skill: "STUDENT" }),
      await post(bia, `${room.code}/start`),
      await api.delete(`/api/board/rooms/${room.code}/players/0`).set(bearer(bia)),
    ];
    expect(tryAsGuest.map((response) => response.status)).toEqual([403, 403, 403, 403]);

    const changed = await api.put(`/api/board/rooms/${room.code}/config`).set(bearer(ana)).send({ config: { size: 25, timeSeconds: 30, push: false } });
    expect(changed.body.config).toMatchObject({ size: 25, timeSeconds: 30, push: false });
    expect((await api.put(`/api/board/rooms/${room.code}/config`).set(bearer(ana)).send({ config: { timeSeconds: 7 } })).status).toBe(400);

    const kicked = await api.delete(`/api/board/rooms/${room.code}/players/1`).set(bearer(ana));
    expect((kicked.body as View).players).toHaveLength(1);
    expect((await get(bia, room.code)).status).toBe(403);
    expect((await post(ana, `${room.code}/start`)).status).toBe(400);
  });

  it("consulta com versão: só baixa a sala quando algo mudou", async () => {
    const room = await newRoom();
    const same = await get(ana, room.code, room.version);
    expect(same.body).toMatchObject({ changed: false, version: room.version });
    await post(bia, `${room.code}/join`);
    const after = (await get(ana, room.code, room.version)).body as View;
    expect(after.changed).toBe(true);
    expect(after.version).toBeGreaterThan(room.version);
  });

  it("partida entre duas pessoas: só joga quem tem a vez, a resposta certa não vaza e o gabarito abre para todos", async () => {
    const room = await newRoom(ana, { size: 25 });
    await post(bia, `${room.code}/join`);
    const started = (await post(ana, `${room.code}/start`)).body as View;
    expect(started.status).toBe("PLAYING");
    expect(started.state!.rng).toBe(0);
    const key = currentKey(started);
    const [mine, other] = key === `u${anaId}` ? [ana, bia] : [bia, ana];

    expect((await post(other, `${room.code}/roll`)).status).toBe(400);
    const rolled = (await post(mine, `${room.code}/roll`)).body as View;
    expect(rolled.state!.phase).toBe("QUESTION");
    expect(rolled.question).not.toBeNull();
    // Nada de gabarito antes da resposta.
    expect(Object.keys(rolled.question!)).not.toContain("correctOption");
    expect(JSON.stringify(rolled)).not.toContain("explanation");
    expect(rolled.reveal).toBeNull();
    expect(rolled.deadlineAt).toBeGreaterThan(Date.now());

    const right = await correctOf(room.code, rolled.state!.pending!.questionId);
    const sameForOther = (await get(other, room.code)).body as View;
    expect(Object.keys(sameForOther.question!)).not.toContain("correctOption");
    expect((await post(other, `${room.code}/answer`, { selected: right })).status).toBe(400);

    const answered = (await post(mine, `${room.code}/answer`, { selected: right })).body as View;
    expect(answered.reveal).toMatchObject({ correct: true, correctOption: right, explanation: "Porque sim." });
    // A jogada ainda não valeu: o mesmo estado, esperando o gabarito.
    expect(answered.state!.phase).toBe("QUESTION");
    expect((await post(mine, `${room.code}/roll`)).status).toBe(400);
    // O outro jogador não fecha o gabarito do colega; quem respondeu fecha.
    const stillOpen = (await post(other, `${room.code}/continue`)).body as View;
    expect(stillOpen.reveal).not.toBeNull();
    const moved = (await post(mine, `${room.code}/continue`)).body as View;
    expect(moved.reveal).toBeNull();
    expect(moved.state!.turn).not.toBe(started.state!.turn);
    expect(moved.log.length).toBeGreaterThan(0);
    expect(moved.state!.players.find((player) => player.id === key)!.position).toBeGreaterThan(0);
  });

  it("o gabarito fecha sozinho depois do tempo e a pergunta sem resposta vira erro", async () => {
    const room = await newRoom(ana, { size: 25 });
    await post(bia, `${room.code}/join`);
    const started = (await post(ana, `${room.code}/start`)).body as View;
    const [mine] = currentKey(started) === `u${anaId}` ? [ana] : [bia];
    const rolled = (await post(mine, `${room.code}/roll`)).body as View;
    const right = await correctOf(room.code, rolled.state!.pending!.questionId);
    await post(mine, `${room.code}/answer`, { selected: right });
    // O tempo do gabarito passa sem ninguém fechar.
    await prisma.boardRoom.update({ where: { code: room.code }, data: { dueAt: new Date(Date.now() - 500) } });
    const next = (await get(ana, room.code)).body as View;
    expect(next.reveal).toBeNull();
    expect(next.state!.turn).not.toBe(started.state!.turn);

    // Agora o próximo jogador deixa o tempo da pergunta estourar.
    const second = currentKey(next) === `u${anaId}` ? ana : bia;
    await post(second, `${room.code}/roll`);
    await prisma.boardRoom.update({ where: { code: room.code }, data: { dueAt: new Date(Date.now() - 500) } });
    const timedOut = (await get(ana, room.code)).body as View;
    expect(timedOut.reveal).toMatchObject({ timedOut: true, correct: false });
    const row = await prisma.boardRoomPlayer.findFirstOrThrow({ where: { room: { code: room.code }, userId: second === ana ? anaId : biaId } });
    expect(row.afkStrikes).toBe(1);
  });

  it("três faltas seguidas passam o lugar a um bot", async () => {
    const room = await newRoom(ana, { size: 25 });
    await post(bia, `${room.code}/join`);
    await post(ana, `${room.code}/start`);
    let view = (await get(ana, room.code)).body as View;
    // Só a Ana vai faltar: a Bia joga rápido, errando de propósito.
    for (let step = 0; step < 200; step += 1) {
      const row = await prisma.boardRoomPlayer.findFirstOrThrow({ where: { room: { code: room.code }, userId: anaId } });
      if (row.replaced) break;
      const key = currentKey(view);
      if (view.reveal) await prisma.boardRoom.update({ where: { code: room.code }, data: { dueAt: new Date(Date.now() - 1) } });
      else if (key === `u${anaId}`) await prisma.boardRoom.update({ where: { code: room.code }, data: { dueAt: new Date(Date.now() - 1) } });
      else if (view.state!.phase === "ROLL") await post(bia, `${room.code}/roll`);
      else if (view.state!.pending) await post(bia, `${room.code}/answer`, { selected: null }).then(async (response) => response.status !== 200 && (await prisma.boardRoom.update({ where: { code: room.code }, data: { dueAt: new Date(Date.now() - 1) } })));
      else await prisma.boardRoom.update({ where: { code: room.code }, data: { dueAt: new Date(Date.now() - 1) } });
      view = (await get(bia, room.code)).body as View;
    }
    const replaced = view.players.find((player) => player.userId === anaId)!;
    expect(replaced).toMatchObject({ replaced: true, bot: "STUDENT" });
    expect(view.state!.players.find((player) => player.id === `u${anaId}`)!.bot).toEqual({ skill: "STUDENT" });
    // Quem foi substituído não consulta mais a sala.
    expect((await get(ana, room.code)).status).toBe(403);
  });

  it("uma pessoa com bots termina a partida sozinha pelo relógio, sem somar vitória", async () => {
    const room = await newRoom(ana, { size: 25 });
    await post(ana, `${room.code}/bots`, { skill: "MASTER" });
    await post(ana, `${room.code}/bots`, { skill: "APPRENTICE" });
    await post(ana, `${room.code}/start`);
    const done = await playUntilDone(room.code, { right: true });
    expect(done.status).toBe("FINISHED");
    expect(done.state!.winnerId).not.toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: anaId } })).boardWins).toBe(0);
  });

  it("vitória online soma ao vencedor quando há 2 pessoas, a revanche volta ao lobby e a meta libera o peão", async () => {
    const room = await newRoom(ana, { size: 25 });
    await post(bia, `${room.code}/join`);
    await post(ana, `${room.code}/start`);
    const done = await playUntilDone(room.code, { right: true });
    expect(done.status).toBe("FINISHED");
    const winnerId = done.state!.winnerId!;
    const winnerUser = winnerId === `u${anaId}` ? anaId : biaId;
    expect((await prisma.user.findUniqueOrThrow({ where: { id: winnerUser } })).boardWins).toBe(1);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: winnerUser === anaId ? biaId : anaId } })).boardWins).toBe(0);
    expect((done.me as { wins: number }).wins).toBe(winnerUser === anaId ? 1 : 0);

    // Só o anfitrião pede a revanche.
    expect((await post(bia, `${room.code}/rematch`)).status).toBe(403);
    const lobby = (await post(ana, `${room.code}/rematch`)).body as View;
    expect(lobby).toMatchObject({ status: "LOBBY", state: null });
    expect(lobby.players).toHaveLength(2);

    // A meta de vitórias libera o peão "Troféu" (3 vitórias).
    await prisma.user.update({ where: { id: anaId }, data: { boardWins: 3 } });
    const inventory = await api.get("/api/cosmetics").set(bearer(ana));
    const trophy = (inventory.body.items as Array<{ name: string; owned: boolean }>).find((item) => item.name === "Peão: Troféu");
    expect(trophy?.owned).toBe(true);
    const champion = (inventory.body.items as Array<{ name: string; owned: boolean }>).find((item) => item.name === "Peão: Campeão");
    expect(champion?.owned).toBe(false);
  });

  it("quem sai no meio do jogo é substituído por um bot; sem ninguém, a partida acaba", async () => {
    const room = await newRoom(ana, { size: 25 });
    await post(bia, `${room.code}/join`);
    await post(ana, `${room.code}/start`);
    expect((await post(bia, `${room.code}/leave`)).status).toBe(204);
    const view = (await get(ana, room.code)).body as View;
    expect(view.players.find((player) => player.userId === biaId)).toMatchObject({ replaced: true, bot: "STUDENT" });
    expect(view.status).toBe("PLAYING");
    await post(ana, `${room.code}/leave`);
    // Só sobraram bots: a sala é apagada.
    expect(await prisma.boardRoom.count({ where: { code: room.code } })).toBe(0);
    expect((await api.get("/api/board/rooms/mine").set(bearer(ana))).body).toBeNull();
  });

  it("no lobby: o anfitrião que sai passa a sala adiante e a sala vazia some", async () => {
    const room = await newRoom();
    await post(bia, `${room.code}/join`);
    await post(ana, `${room.code}/leave`);
    const view = (await get(bia, room.code)).body as View;
    expect(view.hostUserId).toBe(biaId);
    await post(bia, `${room.code}/leave`);
    expect(await prisma.boardRoom.count({ where: { code: room.code } })).toBe(0);
  });

  it("convites: só entre amigos, aparecem para o convidado e somem ao entrar", async () => {
    const room = await newRoom();
    const stranger = await api.post(`/api/board/rooms/${room.code}/invite`).set(bearer(ana)).send({ friendId: biaId });
    expect(stranger.status).toBe(403);
    await prisma.friendship.create({ data: { requesterId: anaId, addresseeId: biaId, status: "ACCEPTED" } });
    const ok = await api.post(`/api/board/rooms/${room.code}/invite`).set(bearer(ana)).send({ friendId: biaId });
    expect(ok.status).toBe(204);
    const invites = await api.get("/api/board/invites").set(bearer(bia));
    expect(invites.body).toHaveLength(1);
    expect(invites.body[0]).toMatchObject({ code: room.code, fromName: "Usuário Teste" });
    await post(bia, `${room.code}/join`);
    expect((await api.get("/api/board/invites").set(bearer(bia))).body).toHaveLength(0);

    // Dispensar o convite.
    const second = await newRoom(ana);
    await api.post(`/api/board/rooms/${second.code}/invite`).set(bearer(ana)).send({ friendId: biaId });
    const [invite] = (await api.get("/api/board/invites").set(bearer(bia))).body as Array<{ id: number }>;
    expect((await api.delete(`/api/board/invites/${invite.id}`).set(bearer(bia))).status).toBe(204);
    expect((await api.get("/api/board/invites").set(bearer(bia))).body).toHaveLength(0);
  });

  it("peão do painel que a pessoa tem vale na sala", async () => {
    const pawn = await prisma.cosmetic.create({ data: { type: "PAWN", name: "Peão: Raposa", style: "🦊", unlock: "REWARD" } });
    await prisma.userCosmetic.create({ data: { userId: anaId, cosmeticId: pawn.id, source: "REWARD" } });
    const response = await api.post("/api/board/rooms").set(bearer(ana)).send({ scenarioId: await scenarioId(), pawn: "🦊" });
    expect((response.body as View).players[0].pawn).toBe("🦊");
    const notOwned = await api.post("/api/board/rooms").set(bearer(bia)).send({ scenarioId: await scenarioId(), pawn: "🦊" });
    expect((notOwned.body as View).players[0].pawn).not.toBe("🦊");
  });
});
