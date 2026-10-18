import type { Prisma } from "@prisma/client";
import type { Db } from "../db/prisma";
import { badRequest, notFound } from "../lib/errors";
import { pageOf } from "../lib/pagination";
import { normalizeKey } from "../lib/validation";
import { DEFAULT_DIFFICULTY, validateLevelDef, type CampaignLevelDef, type Scenario } from "../runner/campaign";
import { ART_KEYS, LEVEL_STYLES, type Form, type LevelStyle, type ScenarioArt } from "../runner/types";

type ScenarioRow = Prisma.RunnerScenarioGetPayload<Record<string, never>>;
type LevelRow = Prisma.RunnerLevelGetPayload<Record<string, never>>;

/** Só as chaves de arte conhecidas, com texto não vazio (o que vem do banco pode estar velho ou adulterado). */
export function sanitizeArt(raw: unknown): ScenarioArt {
  const art: ScenarioArt = {};
  if (!raw || typeof raw !== "object") return art;
  for (const key of ART_KEYS) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim()) art[key] = value.trim();
  }
  return art;
}

/** Estilo conhecido ou o clássico (o que vem do banco pode estar velho). */
export function sanitizeStyle(raw: unknown): LevelStyle {
  return (LEVEL_STYLES as readonly string[]).includes(raw as string) ? (raw as LevelStyle) : "CLASSIC";
}

const FORMS: Form[] = ["RUN", "FLY", "GRAVITY"];
export function sanitizeOrder(raw: unknown): Form[] {
  const list = Array.isArray(raw) ? raw.filter((item): item is Form => FORMS.includes(item as Form)) : [];
  return list.length > 0 ? list : ["RUN"];
}

export function toLevelDef(row: LevelRow): CampaignLevelDef {
  return { id: row.slug, name: row.name, seed: row.seed, seconds: row.seconds, order: sanitizeOrder(row.formOrder), ref: row.verseRef, verse: row.verseText, forks: row.forks, powers: row.powers, difficulty: row.difficulty, style: sanitizeStyle(row.style) };
}

/** Cenário do painel (com a contagem de fases). */
export function toAdminScenario(row: ScenarioRow, levelCount: number) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    story: row.story,
    skyTop: row.skyTop,
    skyBottom: row.skyBottom,
    art: sanitizeArt(row.art),
    musicUrl: row.musicUrl,
    active: row.active,
    sortOrder: row.sortOrder,
    system: row.system,
    levelCount,
  };
}

export function toAdminLevel(row: LevelRow & { scenario?: { slug: string; name: string } }) {
  return {
    id: row.id,
    slug: row.slug,
    scenarioId: row.scenarioId,
    scenarioName: row.scenario?.name ?? null,
    name: row.name,
    seed: row.seed,
    seconds: row.seconds,
    order: sanitizeOrder(row.formOrder),
    verseRef: row.verseRef,
    verseText: row.verseText,
    forks: row.forks,
    powers: row.powers,
    difficulty: row.difficulty,
    style: sanitizeStyle(row.style),
    active: row.active,
    sortOrder: row.sortOrder,
    system: row.system,
  };
}

/** A campanha que o jogador vê: cenários ativos (com pelo menos uma fase ativa), na ordem do painel, cada um com as fases ativas. Pequena e sem paginação no servidor (o app pagina no navegador). */
export async function getCampaign(db: Db): Promise<Scenario[]> {
  const rows = await db.runnerScenario.findMany({
    where: { active: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: { levels: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] } },
  });
  return rows
    .filter((row) => row.levels.length > 0)
    .map((row) => ({
      id: row.slug,
      name: row.name,
      story: row.story ?? "",
      theme: { skyTop: row.skyTop, skyBottom: row.skyBottom },
      art: sanitizeArt(row.art),
      ...(row.musicUrl ? { music: row.musicUrl } : {}),
      levels: row.levels.map(toLevelDef),
    }));
}

async function uniqueSlug(db: Db, table: "scenario" | "level", name: string) {
  const base = normalizeKey(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || (table === "scenario" ? "cenario" : "fase");
  for (let index = 1; index < 500; index += 1) {
    const slug = index === 1 ? base : `${base}-${index}`;
    const taken = table === "scenario" ? await db.runnerScenario.findUnique({ where: { slug }, select: { id: true } }) : await db.runnerLevel.findUnique({ where: { slug }, select: { id: true } });
    if (!taken) return slug;
  }
  throw badRequest("Não foi possível gerar um identificador para este nome");
}

// ---------- Cenários ----------

export async function adminScenarios(db: Db, skip: number, take: number, page: number, size: number, search?: string) {
  const where: Prisma.RunnerScenarioWhereInput = search ? { name: { contains: search, mode: "insensitive" } } : {};
  const [rows, total] = await Promise.all([
    db.runnerScenario.findMany({ where, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], skip, take, include: { _count: { select: { levels: true } } } }),
    db.runnerScenario.count({ where }),
  ]);
  return pageOf(rows.map((row) => toAdminScenario(row, row._count.levels)), total, page, size);
}

/** Todos os cenários (só id e nome), para o seletor do painel. */
export async function scenarioOptions(db: Db) {
  const rows = await db.runnerScenario.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, slug: true, name: true } });
  return rows;
}

/** Todas as fases (identificador, nome e cenário), para o seletor "fase que abre o personagem" do painel. */
export async function levelOptions(db: Db) {
  const rows = await db.runnerLevel.findMany({ orderBy: [{ scenario: { sortOrder: "asc" } }, { sortOrder: "asc" }, { id: "asc" }], select: { slug: true, name: true, scenario: { select: { name: true } } } });
  return rows.map((row) => ({ slug: row.slug, name: row.name, scenarioName: row.scenario.name }));
}

export type ScenarioInput = {
  name?: string;
  story?: string | null;
  skyTop?: string;
  skyBottom?: string;
  art?: Partial<Record<(typeof ART_KEYS)[number], string | null>>;
  musicUrl?: string | null;
  active?: boolean;
  sortOrder?: number;
};

function mergeArt(current: ScenarioArt, patch: ScenarioInput["art"]): ScenarioArt {
  const next: ScenarioArt = { ...current };
  for (const key of ART_KEYS) {
    const value = patch?.[key];
    if (value === undefined) continue;
    if (value === null || !value.trim()) delete next[key];
    else next[key] = value.trim();
  }
  return next;
}

export async function createScenario(db: Db, input: ScenarioInput & { name: string }) {
  const row = await db.runnerScenario.create({
    data: {
      slug: await uniqueSlug(db, "scenario", input.name),
      name: input.name,
      story: input.story ?? null,
      skyTop: input.skyTop ?? "#0f172a",
      skyBottom: input.skyBottom ?? "#1e3a5f",
      art: mergeArt({}, input.art) as Prisma.InputJsonValue,
      musicUrl: input.musicUrl ?? null,
      active: input.active ?? true,
      sortOrder: input.sortOrder ?? 100,
    },
  });
  return toAdminScenario(row, 0);
}

export async function updateScenario(db: Db, id: number, input: ScenarioInput) {
  const current = await db.runnerScenario.findUnique({ where: { id } });
  if (!current) throw notFound("Cenário não encontrado");
  const row = await db.runnerScenario.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.story !== undefined ? { story: input.story } : {}),
      ...(input.skyTop !== undefined ? { skyTop: input.skyTop } : {}),
      ...(input.skyBottom !== undefined ? { skyBottom: input.skyBottom } : {}),
      ...(input.art !== undefined ? { art: mergeArt(sanitizeArt(current.art), input.art) as Prisma.InputJsonValue } : {}),
      ...(input.musicUrl !== undefined ? { musicUrl: input.musicUrl } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
    include: { _count: { select: { levels: true } } },
  });
  return toAdminScenario(row, row._count.levels);
}

/** Os cenários do seed só podem ser desativados; os outros só saem se estiverem sem fases (para não apagar fases por engano). */
export async function deleteScenario(db: Db, id: number) {
  const current = await db.runnerScenario.findUnique({ where: { id }, include: { _count: { select: { levels: true } } } });
  if (!current) throw notFound("Cenário não encontrado");
  if (current.system) throw badRequest("Os cenários que já vêm com o jogo não podem ser excluídos. Desative-o para escondê-lo.");
  if (current._count.levels > 0) throw badRequest("Exclua ou mova as fases deste cenário antes de excluí-lo.");
  await db.runnerScenario.delete({ where: { id } });
}

// ---------- Fases ----------

export async function adminLevels(db: Db, skip: number, take: number, page: number, size: number, filters: { scenarioId?: number; search?: string }) {
  const where: Prisma.RunnerLevelWhereInput = {
    ...(filters.scenarioId ? { scenarioId: filters.scenarioId } : {}),
    ...(filters.search ? { name: { contains: filters.search, mode: "insensitive" } } : {}),
  };
  const [rows, total] = await Promise.all([
    db.runnerLevel.findMany({ where, orderBy: [{ scenario: { sortOrder: "asc" } }, { sortOrder: "asc" }, { id: "asc" }], skip, take, include: { scenario: { select: { slug: true, name: true } } } }),
    db.runnerLevel.count({ where }),
  ]);
  return pageOf(rows.map(toAdminLevel), total, page, size);
}

export type LevelInput = {
  scenarioId?: number;
  name?: string;
  seed?: number;
  seconds?: number;
  order?: Form[];
  verseRef?: string;
  verseText?: string;
  forks?: boolean;
  powers?: boolean;
  difficulty?: number;
  style?: LevelStyle;
  active?: boolean;
  sortOrder?: number;
};

function assertLevelValid(input: Required<Pick<LevelInput, "name" | "seed" | "seconds" | "order" | "verseRef" | "verseText">> & { difficulty?: number; style?: string }) {
  const errors = validateLevelDef({ difficulty: input.difficulty, style: input.style, name: input.name, seed: input.seed, seconds: input.seconds, order: input.order, ref: input.verseRef, verse: input.verseText });
  const first = Object.values(errors)[0];
  if (first) throw badRequest(first);
}

export async function createLevel(db: Db, input: LevelInput & Required<Pick<LevelInput, "scenarioId" | "name" | "seed" | "seconds" | "order" | "verseRef" | "verseText">>) {
  if (!(await db.runnerScenario.findUnique({ where: { id: input.scenarioId }, select: { id: true } }))) throw notFound("Cenário não encontrado");
  assertLevelValid(input);
  const row = await db.runnerLevel.create({
    data: {
      slug: await uniqueSlug(db, "level", input.name),
      scenarioId: input.scenarioId,
      name: input.name,
      seed: input.seed,
      seconds: input.seconds,
      formOrder: input.order as Prisma.InputJsonValue,
      verseRef: input.verseRef,
      verseText: input.verseText,
      forks: input.forks ?? true,
      powers: input.powers ?? true,
      difficulty: input.difficulty ?? DEFAULT_DIFFICULTY,
      style: input.style ?? "CLASSIC",
      active: input.active ?? true,
      sortOrder: input.sortOrder ?? 100,
    },
    include: { scenario: { select: { slug: true, name: true } } },
  });
  return toAdminLevel(row);
}

export async function updateLevel(db: Db, id: number, input: LevelInput) {
  const current = await db.runnerLevel.findUnique({ where: { id } });
  if (!current) throw notFound("Fase não encontrada");
  if (input.scenarioId !== undefined && !(await db.runnerScenario.findUnique({ where: { id: input.scenarioId }, select: { id: true } }))) throw notFound("Cenário não encontrado");
  assertLevelValid({
    name: input.name ?? current.name,
    seed: input.seed ?? current.seed,
    seconds: input.seconds ?? current.seconds,
    order: input.order ?? sanitizeOrder(current.formOrder),
    verseRef: input.verseRef ?? current.verseRef,
    verseText: input.verseText ?? current.verseText,
    difficulty: input.difficulty ?? current.difficulty,
    style: input.style ?? sanitizeStyle(current.style),
  });
  const row = await db.runnerLevel.update({
    where: { id },
    data: {
      ...(input.scenarioId !== undefined ? { scenarioId: input.scenarioId } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.seed !== undefined ? { seed: input.seed } : {}),
      ...(input.seconds !== undefined ? { seconds: input.seconds } : {}),
      ...(input.order !== undefined ? { formOrder: input.order as Prisma.InputJsonValue } : {}),
      ...(input.verseRef !== undefined ? { verseRef: input.verseRef } : {}),
      ...(input.verseText !== undefined ? { verseText: input.verseText } : {}),
      ...(input.forks !== undefined ? { forks: input.forks } : {}),
      ...(input.powers !== undefined ? { powers: input.powers } : {}),
      ...(input.difficulty !== undefined ? { difficulty: input.difficulty } : {}),
      ...(input.style !== undefined ? { style: input.style } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
    include: { scenario: { select: { slug: true, name: true } } },
  });
  return toAdminLevel(row);
}

/** A fase do seed só pode ser desativada; fase que abre um personagem não sai (o personagem ficaria sem como abrir). */
export async function deleteLevel(db: Db, id: number) {
  const current = await db.runnerLevel.findUnique({ where: { id }, select: { system: true, slug: true } });
  if (!current) throw notFound("Fase não encontrada");
  if (current.system) throw badRequest("As fases que já vêm com o jogo não podem ser excluídas. Desative-a para escondê-la.");
  const holders = await db.runnerCharacter.findMany({ where: { unlockLevel: current.slug }, select: { name: true } });
  if (holders.length > 0) throw badRequest(`Esta fase abre ${holders.map((holder) => holder.name).join(", ")}. Troque a fase de desbloqueio dele(s) antes de excluí-la.`);
  await db.runnerLevel.delete({ where: { id } });
}
