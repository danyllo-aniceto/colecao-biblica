import type { DuelCard } from "@prisma/client";
import { buildCard } from "../duel/dsl";
import type { CardDef } from "../duel/types";

export const normalizeName = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

type WithCharacter = DuelCard & { character: { id: number; name: string; imageUrl: string | null } };

/** Figurinha pronta para o motor a partir da linha do banco (null se o texto do Dom estiver inválido). */
export function toCardDef(row: WithCharacter): CardDef | null {
  const built = buildCard({
    id: String(row.characterId),
    name: row.character.name,
    cost: row.cost,
    power: row.power,
    tags: row.tags,
    trigger: row.trigger ?? undefined,
    effects: row.effects ?? undefined,
    text: row.domText ?? undefined,
    imageUrl: row.character.imageUrl,
  });
  return built.ok ? built.card : null;
}
