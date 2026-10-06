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
  config: { format: string; levels: boolean; turnSeconds: number };
  players: Array<{ key: string; slot: number; userId: number | null; name: string; bot: string | null; replaced: boolean; isHost: boolean; hasDeck: boolean }>;
  me: { slot: number; key: string; userId: number; isHost: boolean; deckSlot: number | null; deckName: string | null } | null;
  series: { format: string; round: number; wins: [number, number]; over: boolean; winner: number | null; history: unknown[] } | null;
  duel: {
    you: 0 | 1;
    turn: number;
    status: string;
    ready: boolean;
    hand: Array<{ uid: number; def: { name: string; cost: number } }>;
    staged: Array<{ uid: number; lane: number }>;
    energyLeft: number;
    lanes: Array<{ open: boolean; slots: number; cards: [unknown[], unknown[]] }>;
    stakes: number;
    opponent: { handCount: number; deckCount: number; ready: boolean };
    events: Array<{ type: string; snap?: unknown }>;
    result: { winner: number | null } | null;
  } | null;
  round: number;
  roundBreak: { dueAt: number | null; acks: number[] } | null;
  log: string[];
  deadlineAt: number | null;
};

describe.skipIf(!hasDatabase)("duelo online", () => {
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

    // 16 figurinhas do Duelo (Vigor de 1 a 5, sem Dom) e as mesmas figurinhas para os dois jogadores, com um Time de 12 salvo.
    const names = Array.from({ length: 16 }, (_, index) => `Personagem ${index + 1}`);
    await prisma.biblicalCharacter.createMany({ data: names.map((name) => ({ name, rarity: "COMMON" as const, shortSummary: "x", fullDescription: "y", createdBy: "teste" })) });
    const characters = await prisma.biblicalCharacter.findMany({ where: { name: { in: names } }, orderBy: { id: "asc" }, select: { id: true } });
    expect(characters.length).toBe(16);
    await prisma.duelCard.createMany({ data: characters.map((character, index) => ({ characterId: character.id, cost: 1 + (index % 5), power: 2 + (index % 5) * 2, tags: [] })) });
    for (const userId of [anaId, biaId]) {
      await prisma.userSticker.createMany({ data: characters.map((character) => ({ userId, characterId: character.id })) });
      await prisma.duelDeck.create({ data: { userId, slot: 1, name: "Meu Time", characterIds: characters.slice(0, 12).map((character) => character.id) } });
    }
  });

  const get = (token: string, code: string, since?: number) => api.get(`/api/duel-room/${code}${since === undefined ? "" : `?since=${since}`}`).set(bearer(token));
  const post = (token: string, path: string, body: object = {}) => api.post(`/api/duel-room/${path}`).set(bearer(token)).send(body);
  const view = async (token: string, code: string) => (await get(token, code)).body as View;

  async function newRoom(config: object = {}, token = ana) {
    const response = await api.post("/api/duel-room").set(bearer(token)).send({ config, deckSlot: 1 });
    expect(response.status).toBe(201);
    return response.body as View;
  }

  /** Dois jogadores humanos já com o duelo começado. */
  async function startedRoom(config: object = {}) {
    const room = await newRoom(config);
    expect((await post(bia, `${room.code}/join`, { deckSlot: 1 })).status).toBe(200);
    const started = await post(ana, `${room.code}/start`);
    expect(started.status).toBe(200);
    return { code: room.code, started: started.body as View };
  }

  /** Coloca a figurinha mais cara que cabe no primeiro cenário aberto com espaço e diz "Pronto". */
  async function playTurn(token: string, code: string, stageOne: boolean) {
    const current = await view(token, code);
    if (stageOne) {
      const card = current.duel!.hand.filter((entry) => entry.def.cost <= current.duel!.energyLeft).sort((a, b) => b.def.cost - a.def.cost)[0];
      const side = current.duel!.you;
      const lane = current.duel!.lanes.findIndex((entry) => entry.open && entry.cards[side].length < entry.slots);
      if (card && lane >= 0) expect((await post(token, `${code}/stage`, { uid: card.uid, lane })).status).toBe(200);
    }
    return post(token, `${code}/ready`);
  }

  it("cria a sala, mostra a prévia pública e só deixa participantes olharem", async () => {
    const room = await newRoom();
    expect(room.code).toMatch(/^[A-HJ-NP-Z2-9]{5}$/);
    expect(room).toMatchObject({ status: "LOBBY", hostUserId: anaId, me: { isHost: true, deckSlot: 1, deckName: "Meu Time" } });
    expect(room.config).toEqual({ format: "bo3", levels: false, turnSeconds: 45 });
    expect(room.duel).toBeNull();

    const preview = await api.get(`/api/duel-public/${room.code.toLowerCase()}`);
    expect(preview.body).toMatchObject({ code: room.code, hostName: "Usuário Teste", players: 1, maxPlayers: 2 });
    expect((await api.get("/api/duel-public/ZZZZZ")).status).toBe(404);
    expect((await get(bia, room.code)).status).toBe(403);
    expect((await api.post("/api/duel-room").set(bearer(ana)).send({ deckSlot: 4 })).status).toBe(400);

    const joined = await post(bia, `${room.code}/join`, {});
    expect(joined.status).toBe(200);
    expect(joined.body.players).toHaveLength(2);
    // Sem Time escolhido não começa; escolhendo, começa. Só o anfitrião inicia.
    expect((await post(ana, `${room.code}/start`)).body.message).toMatch(/ainda não escolheu um Time/);
    expect((await post(bia, `${room.code}/start`)).status).toBe(403);
    expect((await api.put(`/api/duel-room/${room.code}/deck`).set(bearer(bia)).send({ deckSlot: 3 })).status).toBe(400);
    expect((await api.put(`/api/duel-room/${room.code}/deck`).set(bearer(bia)).send({ deckSlot: 1 })).status).toBe(200);
    expect((await post(ana, `${room.code}/start`)).body.status).toBe("PLAYING");
    // Sala cheia e já começada: um terceiro não entra.
    const admin = await login("admin2@email.com");
    expect((await post(admin, `${room.code}/join`)).status).toBe(400);
  });

  it("cada jogador só vê o seu lado: nada da mão, do baralho nem do sorteio do rival", async () => {
    const { code, started } = await startedRoom();
    const mine = started.duel!;
    expect(mine.you).toBe(0);
    expect(mine.hand).toHaveLength(3);
    expect(mine.opponent).toMatchObject({ handCount: 3, deckCount: 9, ready: false });
    const theirs = (await view(bia, code)).duel!;
    expect(theirs.you).toBe(1);
    expect(theirs.hand).toHaveLength(3);
    // As mãos não se misturam e a resposta não carrega o estado interno.
    const mineUids = new Set(mine.hand.map((card) => card.uid));
    expect(theirs.hand.some((card) => mineUids.has(card.uid))).toBe(false);
    const raw = JSON.stringify(await view(ana, code));
    expect(raw).not.toContain('"rng"');
    expect(raw).not.toContain('"teams"');
    expect(raw).not.toContain('"deck":');
    for (const card of theirs.hand) expect(raw).not.toContain(`"uid":${card.uid},"def"`);
  });

  it("colocar figurinha é segredo (a versão não sobe); jogar o turno só vale com os dois prontos", async () => {
    const { code, started } = await startedRoom();
    const before = await view(bia, code);
    const card = started.duel!.hand.find((entry) => entry.def.cost <= 1)!;
    // O turno 1 tem 1 de Vigor: uma figurinha de Vigor 1 cabe, e uma de Vigor maior não.
    const costly = started.duel!.hand.find((entry) => entry.def.cost > 1);
    if (costly) expect((await post(ana, `${code}/stage`, { uid: costly.uid, lane: 0 })).body.message).toMatch(/Vigor insuficiente/);
    if (card) {
      const staged = await post(ana, `${code}/stage`, { uid: card.uid, lane: 0 });
      expect(staged.status).toBe(200);
      expect(staged.body.version).toBe(started.version);
      expect(staged.body.duel.staged).toEqual([{ uid: card.uid, lane: 0 }]);
      // O rival não percebe nada: a consulta dele com a mesma versão volta "sem mudança".
      expect((await get(bia, code, before.version)).body.changed).toBe(false);
      expect((await post(ana, `${code}/unstage`, { uid: card.uid })).body.duel.staged).toEqual([]);
    }
    expect((await post(bia, `${code}/stage`, { uid: 999, lane: 0 })).status).toBe(400);
    expect((await post(bia, `${code}/stage`, { uid: 1, lane: 5 })).status).toBe(400);

    const first = await post(ana, `${code}/ready`);
    expect(first.body.duel).toMatchObject({ turn: 1, ready: true });
    const seen = await get(bia, code, before.version);
    expect(seen.body.changed).toBe(true);
    expect(seen.body.duel.opponent.ready).toBe(true);
    // Mexer na mesa depois de "Pronto" não pode.
    expect((await post(ana, `${code}/stage`, { uid: started.duel!.hand[0].uid, lane: 0 })).status).toBe(400);

    const second = await post(bia, `${code}/ready`);
    expect(second.body.duel.turn).toBe(2);
    expect(second.body.duel.events.some((event: { type: string }) => event.type === "turn")).toBe(true);
    expect((await view(ana, code)).duel!.turn).toBe(2);
  });

  it("uma rodada inteira entre duas pessoas, série de rodada única, e a revanche", async () => {
    const { code } = await startedRoom({ format: "single" });
    let current = await view(ana, code);
    for (let turn = 1; turn <= 6; turn += 1) {
      await playTurn(ana, code, true);
      await playTurn(bia, code, false);
      current = await view(ana, code);
    }
    expect(current.status).toBe("FINISHED");
    expect(current.duel).toMatchObject({ status: "finished", result: { winner: 0 } });
    expect(current.series).toMatchObject({ over: true, winner: 0 });
    expect(current.log.join(" ")).toMatch(/Usuário Teste venceu/);
    // Quem perdeu vê o mesmo fim, do seu lado.
    expect((await view(bia, code)).duel).toMatchObject({ you: 1, result: { winner: 0 } });

    expect((await post(bia, `${code}/rematch`)).status).toBe(403);
    const again = await post(ana, `${code}/rematch`);
    expect(again.body).toMatchObject({ status: "LOBBY", series: null, duel: null });
    expect(again.body.players).toHaveLength(2);
  });

  it("melhor de 3: entre as rodadas espera os dois; o tempo vencido também segue", async () => {
    const { code } = await startedRoom({ format: "bo3" });
    for (let turn = 1; turn <= 6; turn += 1) {
      await playTurn(ana, code, true);
      await playTurn(bia, code, false);
    }
    let current = await view(ana, code);
    expect(current.status).toBe("PLAYING");
    expect(current.duel!.status).toBe("finished");
    expect(current.series).toMatchObject({ over: false, wins: [1, 0], round: 2 });
    expect(current.roundBreak).toMatchObject({ acks: [] });

    expect((await post(ana, `${code}/next`)).body.roundBreak.acks).toEqual([0]);
    expect((await view(bia, code)).roundBreak!.acks).toEqual([0]);
    const started = await post(bia, `${code}/next`);
    expect(started.body.roundBreak).toBeNull();
    expect(started.body.duel).toMatchObject({ turn: 1, status: "playing", ready: false });
    expect(started.body.round).toBe(2);
    // "Próxima rodada" fora de hora é recusado.
    expect((await post(ana, `${code}/next`)).status).toBe(400);

    // Segunda rodada: ana ganha de novo e a série acaba em 2 a 0.
    for (let turn = 1; turn <= 6; turn += 1) {
      await playTurn(ana, code, true);
      await playTurn(bia, code, false);
    }
    current = await view(ana, code);
    expect(current).toMatchObject({ status: "FINISHED", series: { over: true, winner: 0, wins: [2, 0] } });
  });

  it("dobrar vale para todos; quem desiste do dobro perde só o que valia antes; na rodada única não dá para dobrar", async () => {
    const single = await startedRoom({ format: "single" });
    const blocked = await post(ana, `${single.code}/double`);
    expect(blocked.status).toBe(400);
    expect(blocked.body.message).toMatch(/rodada única/i);
    expect((await view(ana, single.code)).duel).toMatchObject({ canDouble: false, stakesMatter: false });
    await post(bia, `${single.code}/leave`);

    const { code } = await startedRoom({ format: "bo3" });
    const doubled = await post(ana, `${code}/double`);
    expect(doubled.body.duel.stakes).toBe(2);
    expect((await post(ana, `${code}/double`)).status).toBe(400);
    const foeSees = (await view(bia, code)).duel!;
    expect(foeSees).toMatchObject({ stakes: 2, foeDoubledNow: true, retreatCost: 1, canRetreat: true });
    // No turno em que dobrou, ana não pode desistir; bia pode, e perde só o que valia antes (1 ponto).
    expect((await post(ana, `${code}/retreat`)).status).toBe(400);
    const gave = await post(bia, `${code}/retreat`);
    expect(gave.status).toBe(200);
    expect(gave.body.duel.result).toMatchObject({ winner: 0, retreated: 1, stakes: 1 });
    expect(gave.body.series).toMatchObject({ over: false, wins: [1, 0] });
  });

  it("contra bot: o bot já jogou, então basta dizer Pronto; o tempo esgotado joga pela pessoa e 3 faltas passam o lugar a um bot", async () => {
    const room = await newRoom({ format: "single", turnSeconds: 30 });
    expect((await post(ana, `${room.code}/start`)).status).toBe(400);
    expect((await post(bia, `${room.code}/bots`, { skill: "STUDENT" })).status).toBe(403);
    const withBot = await post(ana, `${room.code}/bots`, { skill: "STUDENT" });
    expect(withBot.body.players.map((player: { bot: string | null }) => player.bot)).toEqual([null, "STUDENT"]);
    expect((await post(ana, `${room.code}/bots`, { skill: "MASTER" })).status).toBe(400);
    expect((await api.put(`/api/duel-room/${room.code}/bots/1`).set(bearer(ana)).send({ skill: "MASTER" })).body.players[1].bot).toBe("MASTER");

    const started = await post(ana, `${room.code}/start`);
    expect(started.body.duel.opponent.ready).toBe(true);
    expect(started.body.deadlineAt).toBeGreaterThan(Date.now());
    const turn1 = await post(ana, `${room.code}/ready`);
    expect(turn1.body.duel.turn).toBe(2);

    // Venceu o prazo: o servidor diz "Pronto" por ela, turno após turno, e na terceira falta o bot assume.
    for (let strike = 0; strike < 3; strike += 1) {
      await prisma.duelRoom.update({ where: { code: room.code }, data: { dueAt: new Date(Date.now() - 1000) } });
      await get(ana, room.code);
    }
    const afterwards = await prisma.duelRoomPlayer.findFirstOrThrow({ where: { room: { code: room.code }, userId: anaId } });
    expect(afterwards).toMatchObject({ replaced: true, bot: "STUDENT", afkStrikes: 3 });
    // Sem pessoa na mesa, a partida só tem bots e é encerrada para ela; a sala segue consultável por quem ficou? Ninguém ficou.
    expect((await get(ana, room.code)).status).toBe(403);
  });

  it("sair no meio: um bot assume e o outro segue; sair no lobby apaga a vaga", async () => {
    const { code } = await startedRoom({ format: "single" });
    expect((await post(bia, `${code}/leave`)).status).toBe(204);
    const current = await view(ana, code);
    expect(current.status).toBe("PLAYING");
    expect(current.players.find((player) => player.slot === 1)).toMatchObject({ replaced: true, bot: "STUDENT" });
    expect(current.duel!.opponent.ready).toBe(true);
    expect(current.log.join(" ")).toMatch(/saiu e um bot assumiu/);

    const lobby = await newRoom({}, bia);
    expect((await post(ana, `${lobby.code}/join`, {})).status).toBe(200);
    expect((await post(ana, `${lobby.code}/leave`)).status).toBe(204);
    expect((await view(bia, lobby.code)).players).toHaveLength(1);
    expect((await post(bia, `${lobby.code}/leave`)).status).toBe(204);
    expect((await api.get(`/api/duel-public/${lobby.code}`)).status).toBe(404);
  });

  it("convites: só amigos, caem na conversa, somem ao entrar ou dispensar", async () => {
    const room = await newRoom();
    expect((await post(ana, `${room.code}/invite`, { friendId: biaId })).status).toBe(403);
    await prisma.friendship.create({ data: { requesterId: anaId, addresseeId: biaId, status: "ACCEPTED" } });
    expect((await post(ana, `${room.code}/invite`, { friendId: biaId })).status).toBe(204);
    const invites = await api.get("/api/duel-room/invites").set(bearer(bia));
    expect(invites.body).toEqual([expect.objectContaining({ code: room.code, fromName: "Usuário Teste", players: 1 })]);
    const message = await prisma.message.findFirstOrThrow({ where: { receiverId: biaId } });
    expect(message.text).toContain(`/duelo/${room.code}`);
    // Convidar de novo logo em seguida não repete a mensagem.
    await post(ana, `${room.code}/invite`, { friendId: biaId });
    expect(await prisma.message.count({ where: { receiverId: biaId } })).toBe(1);

    expect((await api.get("/api/duel-room/mine").set(bearer(bia))).body).toBeNull();
    await post(bia, `${room.code}/join`, { deckSlot: 1 });
    expect((await api.get("/api/duel-room/invites").set(bearer(bia))).body).toEqual([]);
    expect((await api.get("/api/duel-room/mine").set(bearer(bia))).body).toMatchObject({ code: room.code, status: "LOBBY" });

    const second = await newRoom({}, ana);
    await post(ana, `${second.code}/invite`, { friendId: biaId });
    // Criar outra sala tira a pessoa da anterior.
    expect((await api.get(`/api/duel-room/${room.code}`).set(bearer(ana))).status).toBe(403);
  });

  it("o Time inválido na hora de começar é recusado com o motivo", async () => {
    const room = await newRoom();
    await post(bia, `${room.code}/join`, { deckSlot: 1 });
    const deck = await prisma.duelDeck.findFirstOrThrow({ where: { userId: biaId } });
    await prisma.userSticker.deleteMany({ where: { userId: biaId, characterId: deck.characterIds[0] } });
    const response = await post(ana, `${room.code}/start`);
    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/saiu do jogo ou que não é mais dele/);
  });
});
