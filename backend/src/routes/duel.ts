import { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../db/prisma";
import { describeDom } from "../duel/cards";
import { buildCard } from "../duel/dsl";
import { badRequest, notFound } from "../lib/errors";
import { pageOf, queryText, readPage } from "../lib/pagination";
import { parseId, z } from "../lib/validation";
import { requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { normalizeName, readyDecks, toCardDef } from "../services/duel-cards";
import { isCampaignOnlyRarity } from "../services/game-rules";
import { visibleCharacter } from "../services/visibility";

/** Modo Duelo: cartas para o jogo (qualquer jogador) e cadastro/importação (admin). */
export const duelRouter = Router();

const characterSelect = { id: true, name: true, imageUrl: true } as const;

/** Cartas disponíveis e Times prontos, para montar o duelo. */
duelRouter.get(
  "/cards",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.duelCard.findMany({ where: { available: true, character: visibleCharacter() }, include: { character: { select: characterSelect } }, orderBy: { characterId: "asc" } });
    const cards = rows.flatMap((row) => {
      const def = toCardDef(row);
      return def ? [{ def, teams: row.teams }] : [];
    });
    const { decks } = readyDecks(cards);
    res.json({ cards: cards.map((card) => card.def), decks });
  }),
);

// ---------------------------------------------------------------------------
// Painel
// ---------------------------------------------------------------------------

const cardInput = z.object({
  cost: z.number().int().min(0).max(6),
  power: z.number().int().min(0).max(30),
  tags: z.array(z.string().trim().min(1).max(30)).max(6).default([]),
  trigger: z.string().trim().max(40).optional().nullable(),
  effects: z.string().trim().max(600).optional().nullable(),
  domText: z.string().trim().max(300).optional().nullable(),
  available: z.boolean().default(true),
  teams: z.array(z.string().trim().min(1).max(40)).max(5).default([]),
});

type CardInput = z.infer<typeof cardInput>;

function validate(name: string, input: CardInput) {
  const built = buildCard({ id: "0", name, cost: input.cost, power: input.power, tags: input.tags, trigger: input.trigger ?? undefined, effects: input.effects ?? undefined, text: input.domText ?? undefined });
  return built;
}

const data = (input: CardInput) => ({
  cost: input.cost,
  power: input.power,
  tags: [...new Set(input.tags)],
  trigger: input.trigger?.trim() || null,
  effects: input.effects?.trim() || null,
  domText: input.domText?.trim() || null,
  available: input.available,
  teams: [...new Set(input.teams)],
});

async function ensureCharacter(id: number) {
  const character = await prisma.biblicalCharacter.findUnique({ where: { id }, select: { id: true, name: true, rarity: true } });
  if (!character) throw notFound("Personagem não encontrado");
  if (isCampaignOnlyRarity(character.rarity)) throw badRequest("A figurinha especial não entra no Duelo");
  return character;
}

const listRow = (character: { id: number; name: string; rarity: string; historicalPeriod: string | null; narrativeRole: string | null; duelCard: { cost: number; power: number; tags: string[]; trigger: string | null; effects: string | null; domText: string | null; available: boolean; teams: string[] } | null }) => ({
  characterId: character.id,
  name: character.name,
  rarity: character.rarity,
  historicalPeriod: character.historicalPeriod,
  narrativeRole: character.narrativeRole,
  card: character.duelCard,
});

/** Personagens com a carta do duelo (quando já existe), paginado e com busca. */
duelRouter.get(
  "/admin/cards",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { page, size, skip, take } = readPage(req, 20, 100);
    const search = queryText(req.query.search);
    const status = queryText(req.query.status);
    const where: Prisma.BiblicalCharacterWhereInput = {
      rarity: { not: "SPECIAL" },
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      ...(status === "with" ? { duelCard: { isNot: null } } : status === "without" ? { duelCard: null } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.biblicalCharacter.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take,
        select: { id: true, name: true, rarity: true, historicalPeriod: true, narrativeRole: true, duelCard: true },
      }),
      prisma.biblicalCharacter.count({ where }),
    ]);
    res.json(pageOf(rows.map(listRow), total, page, size));
  }),
);

/** Tudo de uma vez para montar a planilha (nome, contexto do personagem e a carta atual). */
duelRouter.get(
  "/admin/export",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const rows = await prisma.biblicalCharacter.findMany({
      where: { rarity: { not: "SPECIAL" } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, rarity: true, testament: true, historicalPeriod: true, narrativeRole: true, keywords: true, shortSummary: true, duelCard: true },
    });
    res.json({
      rows: rows.map((row) => ({ ...listRow(row), testament: row.testament, keywords: row.keywords, shortSummary: row.shortSummary })),
    });
  }),
);

duelRouter.put(
  "/admin/cards/:characterId",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const characterId = parseId(req.params.characterId);
    const character = await ensureCharacter(characterId);
    const input = cardInput.parse(req.body);
    const built = validate(character.name, input);
    if (!built.ok) throw badRequest(built.error);
    const saved = await prisma.duelCard.upsert({ where: { characterId }, create: { characterId, ...data(input) }, update: data(input) });
    res.json({ card: saved, warnings: built.warnings });
  }),
);

duelRouter.delete(
  "/admin/cards/:characterId",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const characterId = parseId(req.params.characterId);
    await prisma.duelCard.deleteMany({ where: { characterId } });
    res.status(204).end();
  }),
);

// ---------------------------------------------------------------------------
// Importação por planilha
// ---------------------------------------------------------------------------

const bulkRow = z.object({
  name: z.string().trim().min(1).max(150),
  cost: z.string().trim().min(1, "informe o Vigor"),
  power: z.string().trim().min(1, "informe a Influência"),
  tags: z.string().trim().optional(),
  trigger: z.string().trim().max(40).optional(),
  effects: z.string().trim().max(600).optional(),
  text: z.string().trim().max(300).optional(),
  available: z.string().trim().optional(),
  teams: z.string().trim().optional(),
});

const bulkSchema = z.object({ rows: z.array(z.unknown()).min(1).max(300), dryRun: z.boolean().optional() });

const splitList = (value: string | undefined) => (value ?? "").split(/[,|]/).map((part) => part.trim()).filter(Boolean);

/**
 * Importa cartas de uma planilha. O personagem é achado pelo nome (sem acento); a carta que já existe é SUBSTITUÍDA pela linha.
 * Cada linha é validada separadamente (com o mesmo código do painel); com dryRun só mostra a prévia.
 */
duelRouter.post(
  "/admin/import",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { rows, dryRun } = bulkSchema.parse(req.body);
    const characters = await prisma.biblicalCharacter.findMany({ select: { id: true, name: true, rarity: true, duelCard: { select: { id: true } } } });
    const byName = new Map(characters.map((character) => [normalizeName(character.name), character]));

    const errors: Array<{ row: number; name: string; message: string }> = [];
    const warnings: Array<{ row: number; name: string; message: string }> = [];
    const valid: Array<{ characterId: number; name: string; input: CardInput; created: boolean; description: string }> = [];
    const seen = new Set<string>();

    rows.forEach((raw, index) => {
      const row = index + 1;
      const parsed = bulkRow.safeParse(raw);
      const label = typeof (raw as { name?: unknown })?.name === "string" ? String((raw as { name: string }).name) : `linha ${row}`;
      if (!parsed.success) {
        errors.push({ row, name: label, message: `${parsed.error.issues[0].path.join(".") || "linha"}: ${parsed.error.issues[0].message}` });
        return;
      }
      const item = parsed.data;
      const character = byName.get(normalizeName(item.name));
      if (!character) return void errors.push({ row, name: item.name, message: "personagem não encontrado (confira o nome)" });
      if (isCampaignOnlyRarity(character.rarity)) return void errors.push({ row, name: item.name, message: "a figurinha especial não entra no Duelo" });
      if (seen.has(normalizeName(item.name))) return void errors.push({ row, name: item.name, message: "personagem repetido na planilha" });
      seen.add(normalizeName(item.name));

      const cost = Number(item.cost);
      const power = Number(item.power);
      const flag = normalizeName(item.available ?? "sim");
      if (!["sim", "s", "true", "1", "nao", "n", "false", "0", ""].includes(flag)) return void errors.push({ row, name: item.name, message: `disponível "${item.available}" inválido (use Sim ou Não)` });
      const input: CardInput = {
        cost,
        power,
        tags: splitList(item.tags),
        trigger: item.trigger || null,
        effects: item.effects || null,
        domText: item.text || null,
        available: !["nao", "n", "false", "0"].includes(flag),
        teams: splitList(item.teams),
      };
      const built = validate(character.name, input);
      if (!built.ok) return void errors.push({ row, name: item.name, message: built.error });
      built.warnings.forEach((message) => warnings.push({ row, name: item.name, message }));
      valid.push({ characterId: character.id, name: character.name, input, created: !character.duelCard, description: describeDom(built.card.dom) });
    });

    if (!dryRun && valid.length > 0) {
      await prisma.$transaction(valid.map((item) => prisma.duelCard.upsert({ where: { characterId: item.characterId }, create: { characterId: item.characterId, ...data(item.input) }, update: data(item.input) })));
    }

    // Times que a planilha deixaria sem exatamente 12 cartas (aviso; o resto do cadastro vale).
    const afterCards = dryRun || valid.length > 0 ? await prisma.duelCard.findMany({ where: { available: true }, include: { character: { select: characterSelect } } }) : [];
    const merged = new Map(afterCards.map((row) => [row.characterId, { teams: row.teams, available: row.available }]));
    if (dryRun) for (const item of valid) merged.set(item.characterId, { teams: item.input.teams, available: item.input.available });
    const counts = new Map<string, { name: string; count: number }>();
    for (const { teams, available } of merged.values()) {
      if (!available) continue;
      for (const team of teams) {
        const key = normalizeName(team);
        counts.set(key, { name: team, count: (counts.get(key)?.count ?? 0) + 1 });
      }
    }
    const teamsReport = [...counts.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((team) => ({ ...team, ready: team.count === 12 }));

    res.json({
      dryRun: Boolean(dryRun),
      total: rows.length,
      valid: valid.length,
      created: valid.filter((item) => item.created).length,
      updated: valid.filter((item) => !item.created).length,
      errors,
      warnings,
      teams: teamsReport,
      preview: valid.slice(0, 300).map((item) => ({ name: item.name, cost: item.input.cost, power: item.input.power, tags: item.input.tags, created: item.created, description: item.description, available: item.input.available })),
    });
  }),
);
