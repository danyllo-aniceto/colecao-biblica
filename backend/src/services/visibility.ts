import type { BiblicalCharacter, Prisma } from "@prisma/client";

/**
 * Personagem visível para os jogadores: publicado e, se tiver publicação
 * agendada, só depois da data. Use sempre este filtro no lugar de published: true.
 */
export function visibleCharacter(now = new Date()): Prisma.BiblicalCharacterWhereInput {
  return { AND: [{ published: true }, { OR: [{ publishAt: null }, { publishAt: { lte: now } }] }] };
}

/** Publicado, mas com data futura: aparece como "em breve". */
export function scheduledCharacter(now = new Date()): Prisma.BiblicalCharacterWhereInput {
  return { published: true, publishAt: { gt: now } };
}

export function isCharacterVisible(character: Pick<BiblicalCharacter, "published" | "publishAt">, now = new Date()) {
  return character.published && (!character.publishAt || character.publishAt <= now);
}
