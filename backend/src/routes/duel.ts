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
import { normalizeName, toCardDef } from "../services/duel-cards";
import { isCampaignOnlyRarity } from "../services/game-rules";
import { currentUser } from "../middleware/auth";
import { visibleCharacter } from "../services/visibility";

/** Modo Duelo: cartas para o jogo (qualquer jogador) e cadastro/importação (admin). */
export const duelRouter = Router();

const characterSelect = { id: true, name: true, imageUrl: true } as const;

/** Cartas disponíveis (o jogador monta o Time com as que ele tem; o bot usa qualquer uma). */
duelRouter.get(
  "/cards",
  asyncHandler(async (_req, res) => {
    const rows = await prisma.duelCard.findMany({ where: { available: true, character: visibleCharacter() }, include: { character: { select: characterSelect } }, orderBy: { characterId: "asc" } });
    res.json({ cards: rows.flatMap((row) => toCardDef(row) ?? []) });
  }),
);

// ---------------------------------------------------------------------------
// Times do jogador
// ---------------------------------------------------------------------------

const MAX_DECKS = 5;
const TEAM_SIZE = 12;

const deckInput = z.object({ name: z.string().trim().min(1, "Dê um nome ao Time").max(30), cards: z.array(z.number().int().positive()).length(TEAM_SIZE, `O Time precisa ter ${TEAM_SIZE} cartas`) });

const deckSlot = (value: unknown) => {
  const slot = Number(value);
  if (!Number.isInteger(slot) || slot < 1 || slot > MAX_DECKS) throw badRequest(`O Time vai de 1 a ${MAX_DECKS}`);
  return slot;
};

duelRouter.get(
  "/decks",
  asyncHandler(async (req, res) => {
    const decks = await prisma.duelDeck.findMany({ where: { userId: currentUser(req).id }, orderBy: { slot: "asc" } });
    res.json({ decks: decks.map((deck) => ({ slot: deck.slot, name: deck.name, cards: deck.characterIds })) });
  }),
);

/** Salva o Time do espaço (1 a 5): 12 cartas diferentes, todas disponíveis e de figurinhas que o jogador já tem. */
duelRouter.put(
  "/decks/:slot",
  asyncHandler(async (req, res) => {
    const slot = deckSlot(req.params.slot);
    const input = deckInput.parse(req.body);
    if (new Set(input.cards).size !== input.cards.length) throw badRequest("O Time não pode ter a mesma carta duas vezes");
    const userId = currentUser(req).id;
    const [owned, available] = await Promise.all([
      prisma.userSticker.findMany({ where: { userId, characterId: { in: input.cards } }, select: { characterId: true } }),
      prisma.duelCard.findMany({ where: { characterId: { in: input.cards }, available: true, character: visibleCharacter() }, select: { characterId: true } }),
    ]);
    const ownedIds = new Set(owned.map((row) => row.characterId));
    const availableIds = new Set(available.map((row) => row.characterId));
    if (input.cards.some((id) => !availableIds.has(id))) throw badRequest("Há carta que não está disponível no Duelo");
    if (input.cards.some((id) => !ownedIds.has(id))) throw badRequest("Você só pode usar figurinhas que já conquistou");
    await prisma.duelDeck.upsert({ where: { userId_slot: { userId, slot } }, create: { userId, slot, name: input.name, characterIds: input.cards }, update: { name: input.name, characterIds: input.cards } });
    res.json({ slot, name: input.name, cards: input.cards });
  }),
);

duelRouter.delete(
  "/decks/:slot",
  asyncHandler(async (req, res) => {
    await prisma.duelDeck.deleteMany({ where: { userId: currentUser(req).id, slot: deckSlot(req.params.slot) } });
    res.status(204).end();
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
});

async function ensureCharacter(id: number) {
  const character = await prisma.biblicalCharacter.findUnique({ where: { id }, select: { id: true, name: true, rarity: true } });
  if (!character) throw notFound("Personagem não encontrado");
  if (isCampaignOnlyRarity(character.rarity)) throw badRequest("A figurinha especial não entra no Duelo");
  return character;
}

const listRow = (character: { id: number; name: string; rarity: string; historicalPeriod: string | null; narrativeRole: string | null; duelCard: { cost: number; power: number; tags: string[]; trigger: string | null; effects: string | null; domText: string | null; available: boolean } | null }) => ({
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
      };
      const built = validate(character.name, input);
      if (!built.ok) return void errors.push({ row, name: item.name, message: built.error });
      built.warnings.forEach((message) => warnings.push({ row, name: item.name, message }));
      valid.push({ characterId: character.id, name: character.name, input, created: !character.duelCard, description: describeDom(built.card.dom) });
    });

    if (!dryRun && valid.length > 0) {
      await prisma.$transaction(valid.map((item) => prisma.duelCard.upsert({ where: { characterId: item.characterId }, create: { characterId: item.characterId, ...data(item.input) }, update: data(item.input) })));
    }

    res.json({
      dryRun: Boolean(dryRun),
      total: rows.length,
      valid: valid.length,
      created: valid.filter((item) => item.created).length,
      updated: valid.filter((item) => !item.created).length,
      errors,
      warnings,
      preview: valid.slice(0, 300).map((item) => ({ name: item.name, cost: item.input.cost, power: item.input.power, tags: item.input.tags, created: item.created, description: item.description, available: item.input.available })),
    });
  }),
);
