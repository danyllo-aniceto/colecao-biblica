import { describe, expect, it } from "vitest";
import { botInputs, createBot } from "./bots";
import { newPlayer, prepareLevel, respawnAt, simulate, stepPlayer } from "./engine";
import { buildJourney } from "./journey";
import { officialTicks } from "./room";
import { MAX_SEGMENTS, parseSegments, starsOf, verifyRun } from "./verify";

const level = prepareLevel(buildJourney({ id: "v", name: "V", seed: 7, seconds: 60, verse: { ref: "x", words: ["a", "b", "c", "d"] } }));

/** Até a bandeira 1 + `after` passos com o bot e depois sem tocar mais (cai), mais o estado do checkpoint. */
function fallAfterCheckpoint(after: number) {
  const bot = createBot(level);
  let checkpointAt = -1;
  while (bot.player.status === "running" && (checkpointAt < 0 || bot.player.tick < checkpointAt + after)) {
    bot.step();
    if (checkpointAt < 0 && bot.player.checkpoint >= 1) checkpointAt = bot.player.tick;
  }
  const limit = checkpointAt + after;
  const toggles = bot.toggles.filter((tick) => tick < limit);
  if (toggles.length % 2 === 1) toggles.push(limit);
  return toggles;
}

/** Repete a tentativa até cair e devolve o ponto do checkpoint guardado (como o jogo guarda). */
function snapshotAfter(toggles: number[]) {
  let player = newPlayer(level);
  let held = false;
  let next = 0;
  let snapshot: { count: number; collected: number[]; powers: number[]; tick: number } | null = null;
  for (let step = 0; step < 20_000 && player.status === "running"; step += 1) {
    while (next < toggles.length && toggles[next] <= step) {
      held = !held;
      next += 1;
    }
    const before = player;
    player = stepPlayer(level, player, held);
    if (player.checkpoint > before.checkpoint && player.status === "running") snapshot = { count: player.checkpoint, collected: [...player.collected], powers: [...player.powers], tick: player.tick };
  }
  return { player, snapshot };
}

describe("Corrida: conferência da partida pelos toques", () => {
  it("bot perfeito numa tentativa só: terminou, todas as palavras, sem cair = 3 estrelas", () => {
    const verdict = verifyRun(level, [{ fromCheckpoint: false, toggles: botInputs(level) }]);
    expect(verdict).toMatchObject({ ok: true, finished: true, allWords: true, clean: true, deaths: 0, progress: 1 });
    // O tempo da partida é a quantidade de passos (o mesmo número que o `simulate` conta).
    expect(verdict.ok && verdict.steps).toBe(simulate(level, botInputs(level)).ticks);
    expect(starsOf(verdict as { finished: boolean; allWords: boolean; clean: boolean })).toBe(3);
  });

  it("sem tocar: cai, não termina, sem estrelas", () => {
    const verdict = verifyRun(level, [{ fromCheckpoint: false, toggles: [] }]);
    expect(verdict).toMatchObject({ ok: true, finished: false, allWords: false, clean: false, deaths: 1 });
    expect(starsOf({ finished: false, allWords: true, clean: true })).toBe(0);
    if (verdict.ok) expect(verdict.progress).toBeLessThan(0.2);
  });

  it("cair e voltar ao checkpoint: termina, mas perde a estrela de 'sem cair'", () => {
    const fall = fallAfterCheckpoint(150);
    const { player, snapshot } = snapshotAfter(fall);
    expect(player.status).toBe("dead");
    expect(snapshot).not.toBeNull();
    const start = respawnAt(level, snapshot!.count, snapshot!.collected, snapshot!.tick, snapshot!.powers);
    const bot = createBot(level, { from: start });
    while (bot.player.status === "running") bot.step();
    expect(bot.player.status).toBe("finished");
    // Os toques da 2ª tentativa contam a partir do começo dela.
    const second = bot.toggles.map((tick) => tick - snapshot!.tick);
    const verdict = verifyRun(level, [{ fromCheckpoint: false, toggles: fall }, { fromCheckpoint: true, toggles: second }]);
    expect(verdict).toMatchObject({ ok: true, finished: true, clean: false, deaths: 1 });
    if (verdict.ok) expect(starsOf(verdict)).toBeLessThanOrEqual(2);
  });

  it("recusa tentativa fora de ordem ou impossível", () => {
    const perfect = { fromCheckpoint: false, toggles: botInputs(level) };
    expect(verifyRun(level, [{ fromCheckpoint: true, toggles: [] }])).toMatchObject({ ok: false });
    // Voltar ao checkpoint sem nunca ter alcançado um.
    expect(verifyRun(level, [{ fromCheckpoint: false, toggles: [] }, { fromCheckpoint: true, toggles: [] }])).toMatchObject({ ok: false, reason: expect.stringMatching(/checkpoint/) });
    // Depois de terminar não há mais tentativa; depois da 1ª só se sai de checkpoint.
    expect(verifyRun(level, [perfect, { fromCheckpoint: true, toggles: [] }])).toMatchObject({ ok: false });
    // Recomeçar do início depois de cair é válido (só deixa de contar como "sem cair"), mas não depois de terminar.
    expect(verifyRun(level, [{ fromCheckpoint: false, toggles: [] }, perfect])).toMatchObject({ ok: true, finished: true, clean: false, deaths: 1 });
    expect(verifyRun(level, [perfect, perfect])).toMatchObject({ ok: false });
  });

  it("não dá para fingir: toques de outra fase não terminam esta", () => {
    const other = prepareLevel(buildJourney({ id: "o", name: "O", seed: 99, seconds: 60, verse: { ref: "x", words: ["a", "b", "c", "d"] } }));
    const verdict = verifyRun(level, [{ fromCheckpoint: false, toggles: botInputs(other) }]);
    expect(verdict).toMatchObject({ ok: true, finished: false });
  });

  it("lê só o formato certo: inteiros crescentes, limites de tentativas e de toques", () => {
    expect(parseSegments([{ fromCheckpoint: false, toggles: [1, 5, 9] }], 1000)).toEqual([{ fromCheckpoint: false, toggles: [1, 5, 9] }]);
    for (const bad of [null, [], "x", [{ fromCheckpoint: "não", toggles: [] }], [{ fromCheckpoint: false, toggles: [5, 5] }], [{ fromCheckpoint: false, toggles: [-1] }], [{ fromCheckpoint: false, toggles: [1.5] }], [{ fromCheckpoint: false, toggles: [2000] }], [{ fromCheckpoint: false }], [1]]) {
      expect(parseSegments(bad, 1000), JSON.stringify(bad)).toBeNull();
    }
    expect(parseSegments(Array.from({ length: MAX_SEGMENTS + 1 }, () => ({ fromCheckpoint: true, toggles: [] })), 1000)).toBeNull();
  });

  it("a partida de um bot ao vivo (cai, espera e volta ao checkpoint ou ao início) é conferida e o tempo oficial é o dele", () => {
    for (const seed of [1, 2, 3]) {
      const bot = createBot(level, { skill: 0.6, lag: 3, seed, respawn: true });
      while (bot.player.status !== "finished" && bot.elapsed < 60 * 400) bot.step();
      expect(bot.player.status, `semente ${seed}`).toBe("finished");
      const verdict = verifyRun(level, bot.segments);
      expect(verdict, `semente ${seed}`).toMatchObject({ ok: true, finished: true, deaths: bot.deaths });
      expect(verdict.ok && officialTicks(verdict.steps, verdict.deaths), `semente ${seed}`).toBe(bot.elapsed);
    }
  }, 120_000);
});
