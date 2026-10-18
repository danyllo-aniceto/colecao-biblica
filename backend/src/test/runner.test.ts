import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../db/prisma";
import { api, bearer, login, resetDatabase } from "./helpers";

// As fases do seed são longas (minutos): conferir a partida inteira no servidor passa dos 5 s padrão.
vi.setConfig({ testTimeout: 60_000 });

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL);

describe.skipIf(!hasDatabase)("corrida: personagens pelo painel", () => {
  beforeEach(async () => {
    await resetDatabase();
    // Os 6 personagens do seed vêm da migração (o reset do teste não os apaga): volta tudo ao estado inicial.
    await prisma.runnerCharacter.deleteMany({ where: { system: false } });
    await prisma.runnerCharacter.updateMany({ data: { active: true, sprites: {}, sounds: {}, unlockLevel: null } });
    // Volta as fases que abrem os personagens dos cenários (os da migração).
    for (const [slug, unlockLevel] of Object.entries({ jonatas: "cd-3", joabe: "cd-5", moises: "mv-2", arao: "mv-3", miria: "mv-4", ezequiel: "vo-3", daniel: "vo-6", jeremias: "vo-9" })) await prisma.runnerCharacter.update({ where: { slug }, data: { unlockLevel } });
  });

  it("o jogador vê só os personagens ativos, na ordem do painel; só admin edita", async () => {
    const user = await login("user@email.com");
    const admin = await login("admin2@email.com");
    const list = await api.get("/api/runner/characters").set(bearer(user));
    expect(list.status).toBe(200);
    expect(list.body.map((character: { slug: string }) => character.slug)).toEqual(["davi", "jonatas", "joabe", "moises", "arao", "miria", "ezequiel", "daniel", "jeremias"]);
    // Os personagens dos cenários abrem ao concluir a fase indicada.
    expect(list.body.find((character: { slug: string }) => character.slug === "jonatas")).toMatchObject({ unlockLevel: "cd-3" });
    expect(list.body[0]).toMatchObject({ name: "Davi", color: "#38bdf8", sprites: {}, sounds: {}, system: true, scenarioSlug: "cidade-de-davi" });
    // Cada cenário do seed tem o grupo dele (o Davi começa liberado mas é da Cidade de Davi).
    const groupOf = (slug: string) => list.body.filter((character: { scenarioSlug: string | null }) => character.scenarioSlug === slug).map((character: { slug: string }) => character.slug);
    expect(groupOf("cidade-de-davi")).toEqual(["davi", "jonatas", "joabe"]);
    expect(groupOf("mar-vermelho")).toEqual(["moises", "arao", "miria"]);
    expect(groupOf("vale-dos-ossos-secos")).toEqual(["ezequiel", "daniel", "jeremias"]);
    expect(list.body.find((character: { slug: string }) => character.slug === "daniel")).toMatchObject({ unlockLevel: "vo-6" });
    expect(list.body.find((character: { slug: string }) => character.slug === "jeremias")).toMatchObject({ unlockLevel: "vo-9" });

    const davi = list.body[0];
    expect((await api.put(`/api/runner/admin/characters/${davi.id}`).set(bearer(user)).send({ active: false })).status).toBe(403);
    expect((await api.get("/api/runner/admin/characters").set(bearer(user))).status).toBe(403);
    expect((await api.post("/api/runner/admin/characters").set(bearer(user)).send({ name: "Fulano" })).status).toBe(403);

    expect((await api.put(`/api/runner/admin/characters/${davi.id}`).set(bearer(admin)).send({ active: false })).status).toBe(200);
    const after = await api.get("/api/runner/characters").set(bearer(user));
    expect(after.body.map((character: { slug: string }) => character.slug)).not.toContain("davi");
    // O painel continua vendo o desativado.
    const adminList = await api.get("/api/runner/admin/characters?size=3&page=0").set(bearer(admin));
    expect(adminList.body).toMatchObject({ totalElements: 9, totalPages: 3, size: 3 });
    expect(adminList.body.content.map((character: { slug: string }) => character.slug)).toEqual(["davi", "jonatas", "joabe"]);
  });

  it("cria, atualiza pedaços (sprites e sons por pose) e valida os campos", async () => {
    const admin = await login("admin2@email.com");
    const bad = await api.post("/api/runner/admin/characters").set(bearer(admin)).send({ name: "  ", color: "azul" });
    expect(bad.status).toBe(400);
    const badColor = await api.post("/api/runner/admin/characters").set(bearer(admin)).send({ name: "Maria Madalena", color: "azul" });
    expect(badColor.status).toBe(400);

    const created = await api.post("/api/runner/admin/characters").set(bearer(admin)).send({ name: "Maria Madalena", color: "#ef4444", description: "Testemunha da ressurreição." });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ slug: "maria-madalena", name: "Maria Madalena", color: "#ef4444", active: true, system: false, sprites: {}, sounds: {} });
    // Mesmo nome: identificador diferente.
    const twin = await api.post("/api/runner/admin/characters").set(bearer(admin)).send({ name: "Maria Madalena" });
    expect(twin.body.slug).toBe("maria-madalena-2");

    const id = created.body.id;
    const withSprites = await api
      .put(`/api/runner/admin/characters/${id}`)
      .set(bearer(admin))
      .send({ sprites: { run: { url: "https://x/run.webp", frames: 4 }, jump: { url: "https://x/jump.webp", frames: 1 } }, sounds: { jump: "https://x/jump.mp3" } });
    expect(withSprites.status).toBe(200);
    expect(withSprites.body.sprites).toEqual({ run: { url: "https://x/run.webp", frames: 4 }, jump: { url: "https://x/jump.webp", frames: 1 } });
    expect(withSprites.body.sounds).toEqual({ jump: ["https://x/jump.mp3"] });

    // A pose "Parado" é guardada como as outras (sem mudança de banco: os sprites são JSON).
    const idle = await api.put(`/api/runner/admin/characters/${id}`).set(bearer(admin)).send({ sprites: { idle: { url: "https://x/idle.webp", frames: 4 } } });
    expect(idle.status).toBe(200);
    expect(idle.body.sprites.idle).toEqual({ url: "https://x/idle.webp", frames: 4 });
    expect(idle.body.sprites.run).toEqual({ url: "https://x/run.webp", frames: 4 });

    // Campo ausente não altera; null limpa só aquela pose/som/campo.
    const partial = await api.put(`/api/runner/admin/characters/${id}`).set(bearer(admin)).send({ sprites: { jump: null, fly: { url: "https://x/fly.webp", frames: 2 } }, sounds: { jump: null, win: ["https://x/win.mp3", "https://x/win2.mp3", "https://x/win.mp3"] }, description: null });
    expect(partial.body.sprites).toEqual({ run: { url: "https://x/run.webp", frames: 4 }, idle: { url: "https://x/idle.webp", frames: 4 }, fly: { url: "https://x/fly.webp", frames: 2 } });
    expect(partial.body.sounds).toEqual({ win: ["https://x/win.mp3", "https://x/win2.mp3"] });
    expect(partial.body.description).toBeNull();
    expect(partial.body.name).toBe("Maria Madalena");

    // Quadros fora de 1–12 e pose desconhecida são recusados; pose sem imagem também.
    expect((await api.put(`/api/runner/admin/characters/${id}`).set(bearer(admin)).send({ sprites: { run: { url: "https://x/a.webp", frames: 20 } } })).status).toBe(400);
    expect((await api.put(`/api/runner/admin/characters/${id}`).set(bearer(admin)).send({ sprites: { voar: { url: "https://x/a.webp", frames: 2 } } })).status).toBe(400);
    expect((await api.put(`/api/runner/admin/characters/${id}`).set(bearer(admin)).send({ sprites: { run: { url: "", frames: 2 } } })).status).toBe(400);
    expect((await api.put("/api/runner/admin/characters/999999").set(bearer(admin)).send({ name: "Ninguém" })).status).toBe(404);
  });

  it("exclui os criados no painel; os do seed só podem ser desativados", async () => {
    const admin = await login("admin2@email.com");
    const created = await api.post("/api/runner/admin/characters").set(bearer(admin)).send({ name: "Gideão" });
    expect((await api.delete(`/api/runner/admin/characters/${created.body.id}`).set(bearer(admin))).status).toBe(204);
    expect((await api.delete(`/api/runner/admin/characters/${created.body.id}`).set(bearer(admin))).status).toBe(404);
    const davi = await prisma.runnerCharacter.findUniqueOrThrow({ where: { slug: "davi" } });
    const refused = await api.delete(`/api/runner/admin/characters/${davi.id}`).set(bearer(admin));
    expect(refused.status).toBe(400);
    expect(refused.body.message).toMatch(/não podem ser excluídos/);
  });
});

/** Volta as fases e os cenários do seed ao que a migração gravou (os testes de edição mexem nelas). */
async function restoreSeedCampaign() {
  const { SCENARIOS } = await import("../runner/campaign");
  for (const scenario of SCENARIOS) {
    await prisma.runnerScenario.update({ where: { slug: scenario.id }, data: { name: scenario.name, story: scenario.story, skyTop: scenario.theme.skyTop, skyBottom: scenario.theme.skyBottom, active: true, art: {}, musicUrl: null } });
    for (const def of scenario.levels) {
      await prisma.runnerLevel.update({ where: { slug: def.id }, data: { name: def.name, seed: def.seed, seconds: def.seconds, formOrder: def.order, verseRef: def.ref, verseText: def.verse, forks: true, powers: true, difficulty: def.difficulty ?? 50, style: def.style ?? "CLASSIC", active: true } });
    }
  }
}

describe.skipIf(!hasDatabase)("corrida: cenários e fases pelo painel", () => {
  beforeEach(async () => {
    await resetDatabase();
    await restoreSeedCampaign();
    // Cenários e fases do seed vêm da migração: volta ao estado inicial e tira o que os testes criaram.
    await prisma.runnerLevel.deleteMany({ where: { system: false } });
    await prisma.runnerScenario.deleteMany({ where: { system: false } });
    await prisma.runnerScenario.updateMany({ data: { active: true, art: {}, musicUrl: null } });
    await prisma.runnerLevel.updateMany({ data: { active: true } });
    await prisma.runnerCharacter.deleteMany({ where: { system: false } });
  });

  it("o jogador lê a campanha pronta: 3 cenários do seed, com as fases na ordem e o versículo", async () => {
    const user = await login("user@email.com");
    const res = await api.get("/api/runner/campaign").set(bearer(user));
    expect(res.status).toBe(200);
    expect(res.body.scenarios.map((scenario: { id: string }) => scenario.id)).toEqual(["cidade-de-davi", "mar-vermelho", "vale-dos-ossos-secos"]);
    const davi = res.body.scenarios[0];
    expect(davi.levels.map((level: { id: string }) => level.id)).toEqual(["cd-1", "cd-2", "cd-3", "cd-4", "cd-5", "cd-6", "cd-7", "cd-8", "cd-9", "cd-10"]);
    expect(davi.levels[0]).toMatchObject({ name: "O pastor", seed: 101, seconds: 90, difficulty: 5, order: ["RUN"], ref: "Salmos 23:1", verse: "O Senhor é o meu pastor; nada me faltará." });
    expect(davi.theme).toEqual({ skyTop: "#1c1917", skyBottom: "#78350f" });
    expect(davi.art).toEqual({});
  });

  it("só admin vê e edita cenários e fases", async () => {
    const user = await login("user@email.com");
    expect((await api.get("/api/runner/admin/scenarios").set(bearer(user))).status).toBe(403);
    expect((await api.get("/api/runner/admin/levels").set(bearer(user))).status).toBe(403);
    expect((await api.post("/api/runner/admin/scenarios").set(bearer(user)).send({ name: "X" })).status).toBe(403);
  });

  it("cria cenário com arte e trilha; atualiza pedaços e some da campanha sem fases ativas", async () => {
    const admin = await login("admin2@email.com");
    const created = await api.post("/api/runner/admin/scenarios").set(bearer(admin)).send({ name: "Jericó", story: "As muralhas caíram.", skyTop: "#111111", skyBottom: "#aa5500", art: { far: "https://x/far.webp", spike: "https://x/espeto.webp" }, musicUrl: "https://x/trilha.mp3" });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ slug: "jerico", name: "Jericó", art: { far: "https://x/far.webp", spike: "https://x/espeto.webp" }, musicUrl: "https://x/trilha.mp3", levelCount: 0, system: false });

    const partial = await api.put(`/api/runner/admin/scenarios/${created.body.id}`).set(bearer(admin)).send({ art: { far: null, block: "https://x/bloco.webp" }, story: null });
    expect(partial.body.art).toEqual({ spike: "https://x/espeto.webp", block: "https://x/bloco.webp" });
    expect(partial.body.story).toBeNull();
    expect(partial.body.name).toBe("Jericó");

    // Cor inválida e chave de arte desconhecida são recusadas.
    expect((await api.put(`/api/runner/admin/scenarios/${created.body.id}`).set(bearer(admin)).send({ skyTop: "azul" })).status).toBe(400);
    expect((await api.put(`/api/runner/admin/scenarios/${created.body.id}`).set(bearer(admin)).send({ art: { chao: "https://x/a.png" } })).status).toBe(400);

    // Sem fase ativa, o cenário não aparece para o jogador.
    const user = await login("user@email.com");
    const before = await api.get("/api/runner/campaign").set(bearer(user));
    expect(before.body.scenarios.map((scenario: { id: string }) => scenario.id)).not.toContain("jerico");
    const level = await api.post("/api/runner/admin/levels").set(bearer(admin)).send({ scenarioId: created.body.id, name: "Sete voltas", seed: 401, seconds: 60, order: ["RUN", "FLY"], verseRef: "Hebreus 11:30", verseText: "Pela fé caíram os muros de Jericó" });
    expect(level.status).toBe(201);
    const after = await api.get("/api/runner/campaign").set(bearer(user));
    const jerico = after.body.scenarios.find((scenario: { id: string }) => scenario.id === "jerico");
    expect(jerico.art).toEqual({ spike: "https://x/espeto.webp", block: "https://x/bloco.webp" });
    expect(jerico.music).toBe("https://x/trilha.mp3");
    expect(jerico.levels).toEqual([{ id: "sete-voltas", name: "Sete voltas", seed: 401, seconds: 60, order: ["RUN", "FLY"], ref: "Hebreus 11:30", verse: "Pela fé caíram os muros de Jericó", forks: true, powers: true, difficulty: 50, style: "CLASSIC" }]);
    // Cenário novo vai para o fim da campanha (ordem 100).
    expect(after.body.scenarios.at(-1).id).toBe("jerico");
  });

  it("valida a fase: semente, duração, formas e versículo", async () => {
    const admin = await login("admin2@email.com");
    const scenario = await prisma.runnerScenario.findUniqueOrThrow({ where: { slug: "mar-vermelho" } });
    const base = { scenarioId: scenario.id, name: "Teste", seed: 5, seconds: 60, order: ["RUN"], verseRef: "Êxodo 1:1", verseText: "Estes são os nomes" };
    expect((await api.post("/api/runner/admin/levels").set(bearer(admin)).send(base)).status).toBe(201);
    for (const patch of [{ seed: 0 }, { seed: 1_000_000 }, { seconds: 10 }, { seconds: 900 }, { order: [] }, { order: ["VOAR"] }, { name: "" }, { verseText: "só" }, { scenarioId: 999999 }]) {
      const res = await api.post("/api/runner/admin/levels").set(bearer(admin)).send({ ...base, ...patch });
      expect([400, 404], JSON.stringify(patch)).toContain(res.status);
    }
    // Identificador repetido ganha sufixo.
    const second = await api.post("/api/runner/admin/levels").set(bearer(admin)).send(base);
    expect(second.body.slug).toBe("teste-2");
  });

  it("edita a fase por pedaços, move de cenário e desativa (some da campanha)", async () => {
    const admin = await login("admin2@email.com");
    const first = await prisma.runnerLevel.findUniqueOrThrow({ where: { slug: "cd-1" } });
    const edited = await api.put(`/api/runner/admin/levels/${first.id}`).set(bearer(admin)).send({ seconds: 55, order: ["RUN", "GRAVITY"], forks: false });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ slug: "cd-1", seconds: 55, order: ["RUN", "GRAVITY"], forks: false, name: "O pastor", seed: 101 });
    expect((await api.put(`/api/runner/admin/levels/${first.id}`).set(bearer(admin)).send({ verseText: "uma" })).status).toBe(400);
    expect((await api.put("/api/runner/admin/levels/999999").set(bearer(admin)).send({ name: "x" })).status).toBe(404);

    await api.put(`/api/runner/admin/levels/${first.id}`).set(bearer(admin)).send({ active: false });
    const user = await login("user@email.com");
    const res = await api.get("/api/runner/campaign").set(bearer(user));
    expect(res.body.scenarios[0].levels.map((level: { id: string }) => level.id)).toEqual(["cd-2", "cd-3", "cd-4", "cd-5", "cd-6", "cd-7", "cd-8", "cd-9", "cd-10"]);
  });

  it("lista as fases do painel paginadas, com filtro por cenário e busca", async () => {
    const admin = await login("admin2@email.com");
    const mar = await prisma.runnerScenario.findUniqueOrThrow({ where: { slug: "mar-vermelho" } });
    const filtered = await api.get(`/api/runner/admin/levels?scenarioId=${mar.id}&size=3&page=0`).set(bearer(admin));
    expect(filtered.body).toMatchObject({ totalElements: 10, totalPages: 4, size: 3 });
    expect(filtered.body.content.map((level: { slug: string }) => level.slug)).toEqual(["mv-1", "mv-2", "mv-3"]);
    expect(filtered.body.content[0].scenarioName).toBe("Mar Vermelho");
    const search = await api.get("/api/runner/admin/levels?q=pastor").set(bearer(admin));
    expect(search.body.content.map((level: { slug: string }) => level.slug)).toEqual(["cd-1"]);
    const scenarios = await api.get("/api/runner/admin/scenarios?size=2&page=0").set(bearer(admin));
    expect(scenarios.body).toMatchObject({ totalElements: 3, totalPages: 2 });
    expect(scenarios.body.content[0]).toMatchObject({ slug: "cidade-de-davi", levelCount: 10, system: true });
    const options = await api.get("/api/runner/admin/scenario-options").set(bearer(admin));
    expect(options.body.map((item: { name: string }) => item.name)).toEqual(["Cidade de Davi", "Mar Vermelho", "Vale dos Ossos Secos"]);
    const levels = await api.get("/api/runner/admin/level-options").set(bearer(admin));
    expect(levels.body).toHaveLength(30);
    expect(levels.body[0]).toEqual({ slug: "cd-1", name: "O pastor", scenarioName: "Cidade de Davi" });
  });

  it("exclusão: do seed só desativa; cenário com fases e fase que abre personagem não saem", async () => {
    const admin = await login("admin2@email.com");
    const davi = await prisma.runnerScenario.findUniqueOrThrow({ where: { slug: "cidade-de-davi" } });
    const seeded = await api.delete(`/api/runner/admin/scenarios/${davi.id}`).set(bearer(admin));
    expect(seeded.status).toBe(400);
    expect(seeded.body.message).toMatch(/não podem ser excluídos/);
    const cd1 = await prisma.runnerLevel.findUniqueOrThrow({ where: { slug: "cd-1" } });
    expect((await api.delete(`/api/runner/admin/levels/${cd1.id}`).set(bearer(admin))).status).toBe(400);

    const scenario = await api.post("/api/runner/admin/scenarios").set(bearer(admin)).send({ name: "Monte Sinai" });
    const level = await api.post("/api/runner/admin/levels").set(bearer(admin)).send({ scenarioId: scenario.body.id, name: "Tábuas", seed: 9, seconds: 60, order: ["RUN"], verseRef: "Êxodo 20:3", verseText: "Não terás outros deuses diante de mim" });
    const withLevels = await api.delete(`/api/runner/admin/scenarios/${scenario.body.id}`).set(bearer(admin));
    expect(withLevels.status).toBe(400);
    expect(withLevels.body.message).toMatch(/Exclua ou mova as fases/);

    // Personagem que depende da fase impede a exclusão dela.
    await api.post("/api/runner/admin/characters").set(bearer(admin)).send({ name: "Josué", unlockLevel: level.body.slug });
    const held = await api.delete(`/api/runner/admin/levels/${level.body.id}`).set(bearer(admin));
    expect(held.status).toBe(400);
    expect(held.body.message).toMatch(/Josué/);
    await prisma.runnerCharacter.deleteMany({ where: { name: "Josué" } });
    expect((await api.delete(`/api/runner/admin/levels/${level.body.id}`).set(bearer(admin))).status).toBe(204);
    expect((await api.delete(`/api/runner/admin/scenarios/${scenario.body.id}`).set(bearer(admin))).status).toBe(204);
  });
});

describe.skipIf(!hasDatabase)("corrida: progresso da campanha conferido pelo servidor", () => {
  beforeEach(async () => {
    await resetDatabase();
    await prisma.runnerProgress.deleteMany();
    await restoreSeedCampaign();
  });

  /** Toques do bot perfeito numa fase do seed (a mesma fase que o servidor monta). */
  async function perfectRun(slug: string) {
    const { SCENARIOS, buildCampaignLevel } = await import("../runner/campaign");
    const { botInputs } = await import("../runner/bots");
    const { prepareLevel } = await import("../runner/engine");
    const scenario = SCENARIOS.find((item) => item.levels.some((def) => def.id === slug))!;
    const level = prepareLevel(buildCampaignLevel(scenario, scenario.levels.find((def) => def.id === slug)!));
    return [{ fromCheckpoint: false, toggles: botInputs(level) }];
  }

  it("começa vazio, abre as fases em ordem e guarda o melhor resultado conferido (3 estrelas)", async () => {
    const user = await login("user@email.com");
    const empty = await api.get("/api/runner/progress").set(bearer(user));
    expect(empty.body).toEqual({ levels: {} });

    // A 2ª fase só abre depois de concluir a 1ª.
    const locked = await api.post("/api/runner/levels/cd-2/result").set(bearer(user)).send({ segments: [{ fromCheckpoint: false, toggles: [] }] });
    expect(locked.status).toBe(403);

    // Sem tocar: cai cedo; conta como tentativa e guarda a % (não abre a próxima).
    const fall = await api.post("/api/runner/levels/cd-1/result").set(bearer(user)).send({ segments: [{ fromCheckpoint: false, toggles: [] }] });
    expect(fall.status).toBe(200);
    expect(fall.body).toMatchObject({ finished: false, words: 0, stars: 0, newlyFinished: false });
    expect(fall.body.progress).toBeGreaterThan(0);
    expect(fall.body.progress).toBeLessThan(0.3);

    const win = await api.post("/api/runner/levels/cd-1/result").set(bearer(user)).send({ segments: await perfectRun("cd-1") });
    expect(win.status).toBe(200);
    expect(win.body).toMatchObject({ progress: 1, finished: true, allWords: true, clean: true, stars: 3, newlyFinished: true });
    expect(win.body.words).toBe(9);

    // Um resultado pior depois não tira nada do melhor, e a conclusão já não é "nova".
    const worse = await api.post("/api/runner/levels/cd-1/result").set(bearer(user)).send({ segments: [{ fromCheckpoint: false, toggles: [] }] });
    expect(worse.body).toMatchObject({ progress: 1, finished: true, stars: 3, newlyFinished: false });

    const progress = await api.get("/api/runner/progress").set(bearer(user));
    expect(progress.body.levels["cd-1"]).toMatchObject({ progress: 1, words: 9, finished: true, allWords: true, clean: true, stars: 3 });
    const row = await prisma.runnerProgress.findFirstOrThrow({ where: { levelSlug: "cd-1" } });
    expect(row.attempts).toBe(3);
    expect(row.finishedAt).not.toBeNull();

    // Agora a 2ª fase abre.
    const second = await api.post("/api/runner/levels/cd-2/result").set(bearer(user)).send({ segments: [{ fromCheckpoint: false, toggles: [] }] });
    expect(second.status).toBe(200);
  });

  it("recusa partida que não confere: toques de outra fase, fora de ordem ou formato errado", async () => {
    const user = await login("user@email.com");
    const bad = (segments: unknown) => api.post("/api/runner/levels/cd-1/result").set(bearer(user)).send({ segments });
    expect((await bad("x")).status).toBe(400);
    expect((await bad([])).status).toBe(400);
    expect((await bad([{ fromCheckpoint: false, toggles: [5, 3] }])).status).toBe(400);
    const orderless = await bad([{ fromCheckpoint: true, toggles: [] }]);
    expect(orderless.status).toBe(400);
    expect(orderless.body.message).toMatch(/início/);
    expect((await api.post("/api/runner/levels/nao-existe/result").set(bearer(user)).send({ segments: [{ fromCheckpoint: false, toggles: [] }] })).status).toBe(404);
    // A fase certa, com os toques certos, termina (o servidor repete tudo: o resultado vem da repetição, nunca do que a tela diz).
    const toggles = (await perfectRun("cd-1"))[0].toggles;
    expect((await api.post("/api/runner/levels/cd-1/result").set(bearer(user)).send({ segments: [{ fromCheckpoint: false, toggles }] })).body.finished).toBe(true);
    expect(await prisma.runnerProgress.count()).toBe(1);
  });

  it("o progresso é de cada jogador e a fase desativada some da campanha (resultado recusado)", async () => {
    const user = await login("user@email.com");
    const admin = await login("admin2@email.com");
    await api.post("/api/runner/levels/cd-1/result").set(bearer(user)).send({ segments: await perfectRun("cd-1") });
    expect((await api.get("/api/runner/progress").set(bearer(admin))).body).toEqual({ levels: {} });
    await prisma.runnerLevel.update({ where: { slug: "cd-1" }, data: { active: false } });
    const res = await api.post("/api/runner/levels/cd-1/result").set(bearer(user)).send({ segments: [{ fromCheckpoint: false, toggles: [] }] });
    expect(res.status).toBe(404);
  });
});
