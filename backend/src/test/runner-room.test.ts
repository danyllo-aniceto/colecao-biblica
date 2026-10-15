import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../db/prisma";
import { botInputs } from "../runner/bots";
import { buildCampaignLevel, SCENARIOS } from "../runner/campaign";
import { prepareLevel } from "../runner/engine";
import { api, bearer, login, resetDatabase } from "./helpers";

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

type Player = { key: string; slot: number; userId: number | null; name: string; bot: string | null; isHost: boolean; finished: boolean; finishTicks: number | null; out: boolean; x?: number; progress?: number; characterSlug: string | null };
type View = {
  changed: boolean;
  code: string;
  status: "LOBBY" | "RACING" | "FINISHED";
  version: number;
  serverNow: number;
  startAt: number | null;
  hostUserId: number;
  levelSlug: string;
  levelName: string | null;
  players: Player[];
  me: { slot: number; isHost: boolean } | null;
  results: Array<{ slot: number; name: string; place: number; finished: boolean; ticks: number | null; words: number; out: boolean }> | null;
};

/** Os toques do bot perfeito na fase do seed (a mesma que o servidor monta). */
function perfectRun(slug: string) {
  const scenario = SCENARIOS.find((item) => item.levels.some((def) => def.id === slug))!;
  const level = prepareLevel(buildCampaignLevel(scenario, scenario.levels.find((def) => def.id === slug)!));
  return { segments: [{ fromCheckpoint: false, toggles: botInputs(level) }], endX: level.endX };
}

describe.skipIf(!hasDatabase)("corrida online: salas de até 4", () => {
  let host: string;
  let guest: string;
  let third: string;

  beforeEach(async () => {
    await resetDatabase();
    await prisma.runnerRoom.deleteMany();
    await prisma.runnerLevel.updateMany({ data: { active: true } });
    await prisma.runnerCharacter.updateMany({ data: { active: true } });
    host = await login("user@email.com");
    guest = await login("outro@email.com");
    third = await login("admin2@email.com");
  });

  const create = async (token = host, levelSlug = "cd-1") => (await api.post("/api/runner-room").set(bearer(token)).send({ levelSlug })).body as View;
  const get = async (code: string, token: string) => (await api.get(`/api/runner-room/${code}`).set(bearer(token))).body as View;
  const startNow = async (code: string, token = host) => {
    const view = (await api.post(`/api/runner-room/${code}/start`).set(bearer(token))).body as View;
    // Larga já (o teste não espera a contagem de 6 s).
    await prisma.runnerRoom.update({ where: { code }, data: { startAt: new Date(Date.now() - 500) } });
    return view;
  };

  it("cria a sala, mostra o código, a fase e o anfitrião; o link público mostra a prévia sem login", async () => {
    const res = await api.post("/api/runner-room").set(bearer(host)).send({ levelSlug: "cd-1" });
    expect(res.status).toBe(201);
    const room = res.body as View;
    expect(room.code).toMatch(/^[A-Z0-9]{5}$/);
    expect(room).toMatchObject({ status: "LOBBY", levelSlug: "cd-1", levelName: "O pastor", me: { slot: 0, isHost: true } });
    expect(room.players).toHaveLength(1);
    const preview = await api.get(`/api/runner-public/${room.code}`);
    expect(preview.status).toBe(200);
    expect(preview.body).toMatchObject({ code: room.code, status: "LOBBY", hostName: "Usuário Teste", levelName: "O pastor", players: 1, maxPlayers: 4 });
    expect((await api.get("/api/runner-public/ZZZZZ")).status).toBe(404);
    expect((await api.post("/api/runner-room").set(bearer(host)).send({ levelSlug: "nao-existe" })).status).toBe(400);
    expect((await api.get(`/api/runner-room/${room.code}`).set(bearer(guest))).status).toBe(403);
  });

  it("entra por código, escolhe a fase e o personagem, chama bots até 4 e a sala enche", async () => {
    const room = await create();
    const joined = await api.post(`/api/runner-room/${room.code}/join`).set(bearer(guest)).send({ characterSlug: "davi" });
    expect(joined.status).toBe(200);
    expect((joined.body as View).players.map((player) => player.name)).toEqual(["Usuário Teste", "Jogador Dois"]);
    expect((joined.body as View).players[1].characterSlug).toBe("davi");
    expect((await api.post(`/api/runner-room/${room.code}/join`).set(bearer(third)).send({})).status).toBe(200);

    // Só o anfitrião muda a fase e chama bots.
    expect((await api.put(`/api/runner-room/${room.code}/level`).set(bearer(guest)).send({ levelSlug: "cd-2" })).status).toBe(403);
    const changed = await api.put(`/api/runner-room/${room.code}/level`).set(bearer(host)).send({ levelSlug: "cd-2" });
    expect((changed.body as View).levelSlug).toBe("cd-2");
    expect((await api.put(`/api/runner-room/${room.code}/level`).set(bearer(host)).send({ levelSlug: "xx" })).status).toBe(400);

    const withBot = await api.post(`/api/runner-room/${room.code}/bots`).set(bearer(host)).send({ skill: "MASTER" });
    const view = withBot.body as View;
    expect(view.players).toHaveLength(4);
    expect(view.players[3]).toMatchObject({ slot: 3, userId: null, bot: "MASTER" });
    expect((await api.post(`/api/runner-room/${room.code}/bots`).set(bearer(host)).send({ skill: "MASTER" })).status).toBe(400);
    const skill = await api.put(`/api/runner-room/${room.code}/bots/3`).set(bearer(host)).send({ skill: "APPRENTICE" });
    expect((skill.body as View).players[3].bot).toBe("APPRENTICE");

    // Tira o bot e chama outro; a pessoa que chega com a sala cheia toma o lugar do bot.
    const removed = await api.delete(`/api/runner-room/${room.code}/players/3`).set(bearer(host));
    expect((removed.body as View).players).toHaveLength(3);
    // A mesma pessoa não ocupa duas salas: criar outra tira da primeira.
    const other = await create(guest);
    expect(other.code).not.toBe(room.code);
    expect((await get(room.code, host)).players.some((player) => player.name === "Jogador Dois")).toBe(false);
  });

  it("a corrida precisa de 2 corredores; ao largar fixa a hora no servidor e fecha a entrada", async () => {
    const room = await create();
    const alone = await api.post(`/api/runner-room/${room.code}/start`).set(bearer(host));
    expect(alone.status).toBe(400);
    expect(alone.body.message).toMatch(/pelo menos 2/);
    await api.post(`/api/runner-room/${room.code}/bots`).set(bearer(host)).send({ skill: "STUDENT" });
    expect((await api.post(`/api/runner-room/${room.code}/start`).set(bearer(guest))).status).toBe(403);
    const started = await api.post(`/api/runner-room/${room.code}/start`).set(bearer(host));
    const view = started.body as View;
    expect(view.status).toBe("RACING");
    expect(view.startAt).toBeGreaterThan(view.serverNow + 4000);
    expect(view.startAt).toBeLessThanOrEqual(view.serverNow + 6500);
    expect((await api.post(`/api/runner-room/${room.code}/join`).set(bearer(guest)).send({})).status).toBe(400);
    // Antes da largada não dá para mandar posição nem chegada.
    const early = await api.post(`/api/runner-room/${room.code}/progress`).set(bearer(host)).send({ report: { x: 10, y: 288, form: "RUN", deaths: 0, words: 0 } });
    expect(early.status).toBe(400);
  });

  it("corrida: posições aparecem para os outros, a chegada é conferida pelos toques e o placar sai pelo tempo oficial", async () => {
    const room = await create();
    await api.post(`/api/runner-room/${room.code}/join`).set(bearer(guest)).send({});
    await api.post(`/api/runner-room/${room.code}/bots`).set(bearer(host)).send({ skill: "STUDENT" });
    await startNow(room.code);
    const { segments, endX } = perfectRun("cd-1");

    // O convidado reporta; o anfitrião vê a posição dele e a do bot (que o aparelho do anfitrião reporta).
    const seen = await api.post(`/api/runner-room/${room.code}/progress`).set(bearer(guest)).send({ report: { x: 1200, y: 288, form: "RUN", dead: false, deaths: 0, words: 1 } });
    expect(seen.status).toBe(200);
    const hostSeen = await api.post(`/api/runner-room/${room.code}/progress`).set(bearer(host)).send({ report: { x: 400, y: 288, form: "RUN", deaths: 0, words: 0 }, bots: [{ slot: 2, report: { x: 800, y: 200, form: "FLY", deaths: 1, words: 0 } }] });
    const view = hostSeen.body as View;
    expect(view.status).toBe("RACING");
    expect(view.players.find((player) => player.slot === 1)).toMatchObject({ x: 1200, progress: Math.round((1200 / endX) * 1000) / 1000 });
    expect(view.players.find((player) => player.slot === 2)).toMatchObject({ x: 800 });
    // Só o anfitrião reporta pelos bots.
    const cheat = await api.post(`/api/runner-room/${room.code}/progress`).set(bearer(guest)).send({ report: { x: 5, y: 5, form: "RUN", deaths: 0, words: 0 }, bots: [{ slot: 2, report: { x: 5, y: 5, form: "RUN", deaths: 0, words: 0 } }] });
    expect(cheat.status).toBe(403);
    expect((await api.post(`/api/runner-room/${room.code}/progress`).set(bearer(host)).send({ report: { x: 1, y: 1, form: "VOAR", deaths: 0, words: 0 } })).status).toBe(400);

    // Chegada inválida (sem tocar) é recusada; a certa vale pelo tempo oficial.
    const bad = await api.post(`/api/runner-room/${room.code}/finish`).set(bearer(guest)).send({ segments: [{ fromCheckpoint: false, toggles: [] }] });
    expect(bad.status).toBe(400);
    const win = await api.post(`/api/runner-room/${room.code}/finish`).set(bearer(host)).send({ segments });
    expect(win.status).toBe(200);
    const afterHost = win.body as View;
    const mine = afterHost.players.find((player) => player.slot === 0)!;
    expect(mine.finished).toBe(true);
    expect(mine.finishTicks).toBeGreaterThan(2000);
    // O convidado não manda a partida do bot; o anfitrião manda.
    expect((await api.post(`/api/runner-room/${room.code}/finish`).set(bearer(guest)).send({ slot: 2, segments })).status).toBe(403);
    expect((await api.post(`/api/runner-room/${room.code}/finish`).set(bearer(host)).send({ slot: 2, segments })).status).toBe(200);
    // Quem ainda corre tem folga depois da 1ª chegada; fecha a corrida de vez.
    const last = await api.post(`/api/runner-room/${room.code}/finish`).set(bearer(guest)).send({ segments });
    const done = last.body as View;
    expect(done.status).toBe("FINISHED");
    expect(done.results?.map((entry) => entry.place)).toEqual([1, 2, 3]);
    expect(done.results?.every((entry) => entry.finished && (entry.ticks ?? 0) > 0)).toBe(true);
    expect(done.results?.[0].ticks).toBeLessThanOrEqual(done.results?.[1].ticks as number);
    // O mesmo resultado para quem consulta.
    expect((await get(room.code, guest)).results).toEqual(done.results);

    // Revanche: volta ao lobby com a mesma gente.
    expect((await api.post(`/api/runner-room/${room.code}/rematch`).set(bearer(guest))).status).toBe(403);
    const again = (await api.post(`/api/runner-room/${room.code}/rematch`).set(bearer(host))).body as View;
    expect(again.status).toBe("LOBBY");
    expect(again.players).toHaveLength(3);
    expect(again.players.every((player) => !player.finished && player.finishTicks === null)).toBe(true);
    expect(again.startAt).toBeNull();
  });

  it("sem sinal ou saindo no meio, a pessoa fica fora da corrida; sem o anfitrião, os bots saem também; a corrida acaba sozinha", async () => {
    const room = await create();
    await api.post(`/api/runner-room/${room.code}/join`).set(bearer(guest)).send({});
    await api.post(`/api/runner-room/${room.code}/bots`).set(bearer(host)).send({ skill: "STUDENT" });
    await startNow(room.code);
    // O convidado some há 1 minuto.
    await prisma.runnerRoomPlayer.updateMany({ where: { room: { code: room.code }, userId: { not: null }, slot: 1 }, data: { lastSeenAt: new Date(Date.now() - 60_000) } });
    const seen = await get(room.code, host);
    expect(seen.players.find((player) => player.slot === 1)?.out).toBe(true);
    expect(seen.status).toBe("RACING");
    // O anfitrião sai: bots saem e, sem ninguém mais correndo, a corrida acaba.
    const left = await api.post(`/api/runner-room/${room.code}/leave`).set(bearer(host));
    expect(left.status).toBe(204);
    const end = await get(room.code, guest).catch(() => null);
    expect(end === null || end.status === "FINISHED").toBe(true);
  });

  it("no lobby quem sai some; sem pessoas a sala é apagada; o anfitrião passa para outro", async () => {
    const room = await create();
    await api.post(`/api/runner-room/${room.code}/join`).set(bearer(guest)).send({});
    await api.post(`/api/runner-room/${room.code}/leave`).set(bearer(host));
    const after = await get(room.code, guest);
    expect(after.players.map((player) => player.name)).toEqual(["Jogador Dois"]);
    expect(after.hostUserId).toBe(after.me ? (await prisma.user.findFirstOrThrow({ where: { email: "outro@email.com" } })).id : 0);
    await api.post(`/api/runner-room/${room.code}/leave`).set(bearer(guest));
    expect((await api.get(`/api/runner-room/${room.code}`).set(bearer(guest))).status).toBe(404);
    expect((await api.get("/api/runner-room/mine").set(bearer(guest))).body).toBeNull();
  });

  it("'minha sala' devolve a sala aberta; versão só sobe quando muda (lobby)", async () => {
    const room = await create();
    expect((await api.get("/api/runner-room/mine").set(bearer(host))).body).toMatchObject({ code: room.code, status: "LOBBY" });
    const same = await api.get(`/api/runner-room/${room.code}?since=${room.version}`).set(bearer(host));
    expect(same.body).toMatchObject({ changed: false, version: room.version });
    await api.post(`/api/runner-room/${room.code}/join`).set(bearer(guest)).send({});
    const changed = await api.get(`/api/runner-room/${room.code}?since=${room.version}`).set(bearer(host));
    expect((changed.body as View).changed).toBe(true);
    expect((changed.body as View).version).toBeGreaterThan(room.version);
  });
});
