import type { Prisma } from "@prisma/client";
import { prisma, transaction, type Db } from "../db/prisma";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { buildCampaignLevel, isLevelUnlocked, type CampaignLevelDef, type Scenario } from "../runner/campaign";
import { maxTicksOf, prepareLevel } from "../runner/engine";
import type { PreparedLevel } from "../runner/types";
import { parseSegments, starsOf, verifyRun } from "../runner/verify";
import { getCampaign } from "./runner-campaign";

type Row = Prisma.RunnerProgressGetPayload<Record<string, never>>;

/** Melhor resultado de uma fase como o app recebe. */
export function toProgress(row: Pick<Row, "bestPermille" | "bestWords" | "finished" | "allWords" | "clean">) {
  return {
    progress: row.bestPermille / 1000,
    words: row.bestWords,
    finished: row.finished,
    allWords: row.allWords,
    clean: row.clean,
    stars: starsOf(row),
  };
}

/** Progresso do jogador em todas as fases (um registro por fase jogada). Pequeno: o app guarda para abrir offline. */
export async function getRunnerProgress(db: Db, userId: number) {
  const rows = await db.runnerProgress.findMany({ where: { userId }, orderBy: { id: "asc" } });
  return { levels: Object.fromEntries(rows.map((row) => [row.levelSlug, toProgress(row)])) };
}

// A fase é só dados (semente, duração, formas, versículo): montar de novo é determinístico, mas custa; guarda as últimas.
const prepared = new Map<string, PreparedLevel>();
function preparedFor(scenario: Scenario, def: CampaignLevelDef): PreparedLevel {
  const key = JSON.stringify([def, scenario.theme]);
  const found = prepared.get(key);
  if (found) return found;
  const next = prepareLevel(buildCampaignLevel(scenario, def));
  if (prepared.size >= 40) prepared.delete(prepared.keys().next().value as string);
  prepared.set(key, next);
  return next;
}

/**
 * Confere uma partida da campanha repetindo os toques (nunca confia em pontos da tela) e guarda o melhor resultado do jogador na fase.
 * A fase precisa estar aberta (a anterior concluída). Partida inválida é recusada; resultado pior que o guardado não muda nada (só conta a tentativa).
 */
export async function submitRunnerResult(userId: number, levelSlug: string, rawSegments: unknown) {
  const scenarios = await getCampaign(prisma);
  const scenario = scenarios.find((item) => item.levels.some((def) => def.id === levelSlug));
  const def = scenario?.levels.find((item) => item.id === levelSlug);
  if (!scenario || !def) throw notFound("Fase não encontrada");
  const level = preparedFor(scenario, def);
  const segments = parseSegments(rawSegments, maxTicksOf(level));
  if (!segments) throw badRequest("Partida inválida");

  return transaction(async (tx) => {
    const rows = await tx.runnerProgress.findMany({ where: { userId } });
    const finished = new Set(rows.filter((row) => row.finished).map((row) => row.levelSlug));
    if (!isLevelUnlocked(levelSlug, finished, scenarios)) throw forbidden("Conclua a fase anterior para abrir esta");
    const verdict = verifyRun(level, segments);
    if (!verdict.ok) throw badRequest(verdict.reason);
    const current = rows.find((row) => row.levelSlug === levelSlug);
    const merged = {
      bestPermille: Math.max(current?.bestPermille ?? 0, Math.round(verdict.progress * 1000)),
      bestWords: Math.max(current?.bestWords ?? 0, verdict.words),
      finished: (current?.finished ?? false) || verdict.finished,
      allWords: (current?.allWords ?? false) || verdict.allWords,
      clean: (current?.clean ?? false) || verdict.clean,
    };
    const row = await tx.runnerProgress.upsert({
      where: { userId_levelSlug: { userId, levelSlug } },
      create: { userId, levelSlug, ...merged, attempts: 1, finishedAt: merged.finished ? new Date() : null },
      update: { ...merged, attempts: { increment: 1 }, ...(merged.finished && !current?.finished ? { finishedAt: new Date() } : {}) },
    });
    return { ...toProgress(row), newlyFinished: merged.finished && !current?.finished };
  });
}
