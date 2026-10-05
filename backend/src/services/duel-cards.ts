import type { DuelCard } from "@prisma/client";
import { buildCard } from "../duel/dsl";
import type { CardDef } from "../duel/types";

export const normalizeName = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

type WithCharacter = DuelCard & { character: { id: number; name: string; imageUrl: string | null } };

/** Carta pronta para o motor a partir da linha do banco (null se o texto do Dom estiver inválido). */
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

export const slugOf = (name: string) => normalizeName(name).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "time";

export type ReadyDeckInfo = { id: string; name: string; description: string; cards: string[] };

/** Times prontos: cada nome de Time reúne as cartas disponíveis que o citam; só vale com exatamente 12. */
export function readyDecks(cards: Array<{ def: CardDef; teams: string[] }>): { decks: ReadyDeckInfo[]; incomplete: Array<{ name: string; count: number }> } {
  const byTeam = new Map<string, { name: string; ids: string[] }>();
  for (const { def, teams } of cards) {
    for (const team of teams) {
      const key = normalizeName(team);
      if (!key) continue;
      const entry = byTeam.get(key) ?? { name: team.trim(), ids: [] };
      entry.ids.push(def.id);
      byTeam.set(key, entry);
    }
  }
  const decks: ReadyDeckInfo[] = [];
  const incomplete: Array<{ name: string; count: number }> = [];
  for (const entry of byTeam.values()) {
    if (entry.ids.length === 12) decks.push({ id: slugOf(entry.name), name: entry.name, description: "12 cartas escolhidas para jogar juntas.", cards: entry.ids });
    else incomplete.push({ name: entry.name, count: entry.ids.length });
  }
  decks.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return { decks, incomplete };
}
