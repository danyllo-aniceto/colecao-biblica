import type { Prisma } from "@prisma/client";
import type { Db } from "../db/prisma";
import { badRequest, notFound } from "../lib/errors";
import { pageOf } from "../lib/pagination";
import { normalizeKey } from "../lib/validation";
import { mergeSounds, mergeSprites, sanitizeSounds, sanitizeSprites, type Pose, type SoundKey, type SpriteSheet } from "../runner/characters";

type Row = Prisma.RunnerCharacterGetPayload<Record<string, never>>;

/** Personagem como o app e o painel recebem. */
export function toRunnerCharacter(row: Row) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    color: row.color,
    active: row.active,
    sortOrder: row.sortOrder,
    unlockLevel: row.unlockLevel,
    scenarioSlug: row.scenarioSlug,
    sprites: sanitizeSprites(row.sprites),
    sounds: sanitizeSounds(row.sounds),
    system: row.system,
  };
}

/** Personagens que o jogador vê: só os ativos, na ordem do painel. Sem paginação no servidor: são poucos e a tela do jogo precisa de todos (a lista do app é paginada no navegador). */
export async function listRunnerCharacters(db: Db) {
  const rows = await db.runnerCharacter.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  return rows.map(toRunnerCharacter);
}

/** Lista do painel (todos, com busca por nome), paginada no servidor. */
export async function adminRunnerCharacters(db: Db, skip: number, take: number, page: number, size: number, search?: string) {
  const where: Prisma.RunnerCharacterWhereInput = search ? { name: { contains: search, mode: "insensitive" } } : {};
  const [rows, total] = await Promise.all([
    db.runnerCharacter.findMany({ where, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], skip, take }),
    db.runnerCharacter.count({ where }),
  ]);
  return pageOf(rows.map(toRunnerCharacter), total, page, size);
}

export type RunnerCharacterInput = {
  name?: string;
  description?: string | null;
  color?: string;
  active?: boolean;
  sortOrder?: number;
  unlockLevel?: string | null;
  scenarioSlug?: string | null;
  sprites?: Partial<Record<Pose, SpriteSheet | null>>;
  sounds?: Partial<Record<SoundKey, string | string[] | null>>;
};

/** Identificador curto e único a partir do nome ("Maria Madalena" → "maria-madalena"; repetido ganha -2, -3...). */
async function uniqueSlug(db: Db, name: string) {
  const base = normalizeKey(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "personagem";
  for (let index = 1; index < 500; index += 1) {
    const slug = index === 1 ? base : `${base}-${index}`;
    if (!(await db.runnerCharacter.findUnique({ where: { slug }, select: { id: true } }))) return slug;
  }
  throw badRequest("Não foi possível gerar um identificador para este nome");
}

export async function createRunnerCharacter(db: Db, input: RunnerCharacterInput & { name: string }) {
  const row = await db.runnerCharacter.create({
    data: {
      slug: await uniqueSlug(db, input.name),
      name: input.name,
      description: input.description ?? null,
      color: input.color ?? "#38bdf8",
      active: input.active ?? true,
      sortOrder: input.sortOrder ?? 100,
      unlockLevel: input.unlockLevel ?? null,
      scenarioSlug: input.scenarioSlug ?? null,
      sprites: mergeSprites({}, input.sprites ?? {}) as Prisma.InputJsonValue,
      sounds: mergeSounds({}, input.sounds ?? {}) as Prisma.InputJsonValue,
    },
  });
  return toRunnerCharacter(row);
}

/** Atualização parcial: campo ausente não altera; `null` limpa (descrição, fase de desbloqueio, pose ou som). */
export async function updateRunnerCharacter(db: Db, id: number, input: RunnerCharacterInput) {
  const current = await db.runnerCharacter.findUnique({ where: { id } });
  if (!current) throw notFound("Personagem não encontrado");
  const row = await db.runnerCharacter.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.unlockLevel !== undefined ? { unlockLevel: input.unlockLevel } : {}),
      ...(input.scenarioSlug !== undefined ? { scenarioSlug: input.scenarioSlug } : {}),
      ...(input.sprites !== undefined ? { sprites: mergeSprites(sanitizeSprites(current.sprites), input.sprites) as Prisma.InputJsonValue } : {}),
      ...(input.sounds !== undefined ? { sounds: mergeSounds(sanitizeSounds(current.sounds), input.sounds) as Prisma.InputJsonValue } : {}),
    },
  });
  return toRunnerCharacter(row);
}

/** Os personagens do seed não são excluídos (só desativados). */
export async function deleteRunnerCharacter(db: Db, id: number) {
  const current = await db.runnerCharacter.findUnique({ where: { id }, select: { system: true } });
  if (!current) throw notFound("Personagem não encontrado");
  if (current.system) throw badRequest("Os personagens que já vêm com o jogo não podem ser excluídos. Desative-o para escondê-lo.");
  await db.runnerCharacter.delete({ where: { id } });
}
