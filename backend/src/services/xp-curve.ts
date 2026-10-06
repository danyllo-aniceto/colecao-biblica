import type { Db } from "../db/prisma";
import { buildXpBands, calculateLevel, defaultXpPerStop, type XpBand } from "./game-rules";

/** Curva de nível atual, montada com o XP por parada de cada cenário ativo (na ordem do caminho). */
export async function loadXpBands(db: Db): Promise<XpBand[]> {
  const scenarios = await db.scenario.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { xpPerStop: true, nodes: { select: { level: true } } },
  });
  return buildXpBands(scenarios.map((scenario) => ({ levels: scenario.nodes.map((node) => node.level), xpPerStop: scenario.xpPerStop })));
}

/** XP por parada sugerido para o próximo cenário a criar (continua a escada do último, com teto). */
export async function nextXpPerStop(db: Db): Promise<number> {
  return defaultXpPerStop(await db.scenario.count());
}

let lastSignature: string | null = null;

/**
 * Recalcula o nível de todos os jogadores a partir do XP quando a curva mudou (cenário novo, XP por parada ou paradas editados).
 * Ninguém perde XP; o nível só acompanha a curva. O baú de nível não passa do nível (não fica baú "devendo").
 */
export async function syncUserLevels(db: Db, force = false): Promise<number> {
  const bands = await loadXpBands(db);
  const signature = JSON.stringify(bands);
  if (!force && signature === lastSignature) return 0;

  let changed = 0;
  let cursor = 0;
  for (;;) {
    const users = await db.user.findMany({ where: { id: { gt: cursor } }, orderBy: { id: "asc" }, take: 500, select: { id: true, xp: true, level: true, chestLevel: true } });
    if (users.length === 0) break;
    cursor = users[users.length - 1].id;
    for (const user of users) {
      const level = calculateLevel(user.xp, bands);
      const chestLevel = Math.min(user.chestLevel, level);
      if (level === user.level && chestLevel === user.chestLevel) continue;
      await db.user.update({ where: { id: user.id }, data: { level, chestLevel } });
      changed += 1;
    }
  }
  lastSignature = signature;
  return changed;
}
