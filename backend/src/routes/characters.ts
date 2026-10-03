import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { badRequest, forbidden, notFound } from "../lib/errors";
import { pageOf, queryText, readPage } from "../lib/pagination";
import { clearableText, imageRef, parseId, requiredText, richText, z } from "../lib/validation";
import { currentUser, requireAdmin } from "../middleware/auth";
import { asyncHandler } from "../middleware/errorHandler";
import { toCharacterResponse, toCharacterSummary } from "../services/mappers";
import { isCharacterVisible, scheduledCharacter, visibleCharacter } from "../services/visibility";

export const charactersRouter = Router();

const rarity = z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY", "SPECIAL"]);
const testament = z.enum(["OLD", "NEW"]);

// Campos opcionais: ausente não altera; null ou vazio limpa.
const optionalFields = {
  imageUrl: imageRef(),
  testament: testament.nullish(),
  bibleBooks: clearableText(),
  bibleReferences: clearableText(),
  historicalPeriod: clearableText(200),
  narrativeRole: clearableText(200),
  genealogy: clearableText(),
  curiosities: clearableText(),
  importantEvents: clearableText(),
  keyVerses: clearableText(1000),
  keywords: clearableText(1000),
  // Publicação agendada (ISO 8601). null tira o agendamento.
  publishAt: z
    .string()
    .datetime({ offset: true })
    .nullish()
    .transform((value) => (value === undefined ? undefined : value === null ? null : new Date(value))),
};

const createSchema = z.object({
  name: requiredText(150),
  rarity,
  published: z.boolean().optional(),
  shortSummary: richText(),
  fullDescription: richText(),
  ...optionalFields,
});

const updateSchema = z.object({
  name: requiredText(150).optional(),
  rarity: rarity.optional(),
  published: z.boolean().optional(),
  shortSummary: richText().optional(),
  fullDescription: richText().optional(),
  ...optionalFields,
});

async function ensureNameAvailable(name: string, exceptId?: number) {
  const existing = await prisma.biblicalCharacter.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (existing) {
    throw badRequest("Já existe um personagem com esse nome");
  }
}

async function getCharacter(id: number) {
  const character = await prisma.biblicalCharacter.findUnique({ where: { id } });
  if (!character) {
    throw notFound("Personagem não encontrado");
  }
  return character;
}

/** Remove só os campos ausentes (undefined); null significa "limpar". */
function withoutUndefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>;
}

/** Quantidade de perguntas ativas por personagem. */
async function activeQuestionCounts(characterIds?: number[]) {
  const groups = await prisma.question.groupBy({
    by: ["relatedCharacterId"],
    where: { active: true, relatedCharacterId: characterIds ? { in: characterIds } : { not: null } },
    _count: { _all: true },
  });
  return new Map(groups.map((group) => [group.relatedCharacterId, group._count._all]));
}

// ---------------------------------------------------------------------------
// Admin (antes de "/:id" para não colidir)
// ---------------------------------------------------------------------------

/** Lista paginada do painel, com filtros e contagem de perguntas. */
charactersRouter.get(
  "/admin/list",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { page, size, skip, take } = readPage(req, 10, 100);
    const search = queryText(req.query.search);
    const rarityFilter = queryText(req.query.rarity)?.toUpperCase();
    const status = queryText(req.query.status);
    const issue = queryText(req.query.issue);

    const where: Prisma.BiblicalCharacterWhereInput = {
      ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
      ...(rarityFilter ? { rarity: rarity.parse(rarityFilter) } : {}),
      ...(status === "published"
        ? visibleCharacter()
        : status === "draft"
          ? { published: false }
          : status === "scheduled"
            ? scheduledCharacter()
            : {}),
      ...(issue === "noImage" ? { OR: [{ imageUrl: null }, { imageUrl: "" }] } : {}),
      ...(issue === "noQuestions" ? { questions: { none: { active: true } } } : {}),
    };

    const [characters, total] = await Promise.all([
      prisma.biblicalCharacter.findMany({ where, orderBy: [{ name: "asc" }, { id: "asc" }], skip, take }),
      prisma.biblicalCharacter.count({ where }),
    ]);
    const counts = await activeQuestionCounts(characters.map((character) => character.id));
    res.json(pageOf(characters.map((character) => toCharacterSummary(character, counts.get(character.id) ?? 0)), total, page, size));
  }),
);

/** Todos os personagens (id, nome, raridade) para os seletores do painel. */
charactersRouter.get(
  "/admin/options",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const characters = await prisma.biblicalCharacter.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, rarity: true, published: true },
    });
    res.json(characters);
  }),
);

// ---------------------------------------------------------------------------
// Importação em lote (planilha)
// ---------------------------------------------------------------------------

const normalizeKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const RARITY_ALIASES: Record<string, z.infer<typeof rarity>> = {
  comum: "COMMON",
  rara: "RARE",
  epica: "EPIC",
  lendaria: "LEGENDARY",
  especial: "SPECIAL",
};

const TESTAMENT_ALIASES: Record<string, z.infer<typeof testament>> = {
  at: "OLD",
  antigo: "OLD",
  "antigo testamento": "OLD",
  nt: "NEW",
  novo: "NEW",
  "novo testamento": "NEW",
};

/** Texto puro da planilha vira HTML do editor rico (cada linha vira um parágrafo); HTML pronto passa direto. */
export function toRichHtml(value: string) {
  const text = value.trim();
  if (/<\/?[a-z][^>]*>/i.test(text)) return text;
  const escape = (line: string) => line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escape(line)}</p>`)
    .join("");
}

/** Mesma limpeza do painel: o desenho "timeline" do Mermaid não aceita classDef/class. */
function cleanDiagram(code: string) {
  const source = code.trim();
  if (!/^timeline\b/i.test(source)) return source;
  return source
    .split(/\r?\n/)
    .filter((line) => !/^\s*(classDef|class)\b/i.test(line.trim()))
    .join("\n")
    .trim();
}

/** Aceita "25/12/2026", "25/12/2026 18:30" (horário de Brasília) ou ISO 8601. */
function parsePublishAt(value: string): Date | null {
  const br = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  const date = br
    ? new Date(`${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}T${(br[4] ?? "00").padStart(2, "0")}:${br[5] ?? "00"}:00-03:00`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const bulkRow = z.object({
  name: requiredText(150),
  rarity: z.string().trim().optional(),
  testament: z.string().trim().optional(),
  shortSummary: z.string().trim().optional(),
  fullDescription: z.string().trim().optional(),
  curiosities: z.string().trim().optional(),
  bibleReferences: z.string().trim().optional(),
  narrativeRole: z.string().trim().max(200).optional(),
  historicalPeriod: z.string().trim().max(200).optional(),
  bibleBooks: z.string().trim().optional(),
  keyVerses: z.string().trim().max(1000).optional(),
  keywords: z.string().trim().max(1000).optional(),
  published: z.string().trim().optional(),
  imageUrl: z.string().trim().max(2048).optional(),
  publishAt: z.string().trim().optional(),
  genealogy: z.string().trim().optional(),
  importantEvents: z.string().trim().optional(),
});

const bulkSchema = z.object({ rows: z.array(z.unknown()).min(1).max(300), dryRun: z.boolean().optional() });

/**
 * Importa personagens de uma planilha. Nome que já existe é ATUALIZADO (só as colunas preenchidas;
 * célula vazia não apaga nada); nome novo é criado (exige raridade, resumo e história).
 * Cada linha é validada separadamente; com dryRun só mostra a prévia.
 */
charactersRouter.post(
  "/admin/bulk",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { rows, dryRun } = bulkSchema.parse(req.body);
    const existing = await prisma.biblicalCharacter.findMany({ select: { id: true, name: true } });
    const idByName = new Map(existing.map((character) => [normalizeKey(character.name), character.id]));

    const errors: Array<{ row: number; message: string }> = [];
    const toCreate: Prisma.BiblicalCharacterCreateManyInput[] = [];
    const toUpdate: Array<{ id: number; data: Prisma.BiblicalCharacterUpdateInput }> = [];
    const seen = new Set<string>();

    rows.forEach((raw, index) => {
      const row = index + 1;
      const parsed = bulkRow.safeParse(raw);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        errors.push({ row, message: `${issue.path.join(".") || "linha"}: ${issue.message}` });
        return;
      }
      const input = parsed.data;
      const key = normalizeKey(input.name);
      if (seen.has(key)) {
        errors.push({ row, message: "nome repetido na planilha" });
        return;
      }
      seen.add(key);

      const data: Record<string, unknown> = {};
      if (input.rarity) {
        const level = RARITY_ALIASES[normalizeKey(input.rarity)] ?? (rarity.safeParse(input.rarity.toUpperCase()).data);
        if (!level) {
          errors.push({ row, message: `raridade "${input.rarity}" inválida (use Comum, Rara, Épica, Lendária ou Especial)` });
          return;
        }
        if (level === "SPECIAL") {
          errors.push({ row, message: "a raridade Especial só vem da campanha" });
          return;
        }
        data.rarity = level;
      }
      if (input.testament) {
        const value = TESTAMENT_ALIASES[normalizeKey(input.testament)];
        if (!value) {
          errors.push({ row, message: `testamento "${input.testament}" inválido (use Antigo ou Novo)` });
          return;
        }
        data.testament = value;
      }
      if (input.published) {
        const flag = normalizeKey(input.published);
        if (["sim", "s", "true", "1", "publicado"].includes(flag)) data.published = true;
        else if (["nao", "n", "false", "0", "rascunho"].includes(flag)) data.published = false;
        else {
          errors.push({ row, message: `publicado "${input.published}" inválido (use Sim ou Não)` });
          return;
        }
      }
      if (input.imageUrl) data.imageUrl = input.imageUrl;
      if (input.publishAt) {
        const when = parsePublishAt(input.publishAt);
        if (!when) {
          errors.push({ row, message: `data de publicação "${input.publishAt}" inválida (use 25/12/2026 ou 25/12/2026 18:30)` });
          return;
        }
        data.publishAt = when;
      }
      for (const field of ["genealogy", "importantEvents"] as const) {
        const code = input[field] ? cleanDiagram(input[field]) : "";
        if (!code) continue;
        const expected = field === "genealogy" ? /^(graph|flowchart)\b/i : /^timeline\b/i;
        if (!expected.test(code)) {
          errors.push({ row, message: `${field === "genealogy" ? "árvore genealógica" : "linha do tempo"} deve começar com ${field === "genealogy" ? "graph TD" : "timeline"} (código Mermaid)` });
          return;
        }
        data[field] = code;
      }
      for (const field of ["shortSummary", "fullDescription", "curiosities", "bibleReferences"] as const) {
        if (input[field]) data[field] = toRichHtml(input[field]);
      }
      for (const field of ["narrativeRole", "historicalPeriod", "bibleBooks", "keyVerses", "keywords"] as const) {
        if (input[field]) data[field] = input[field];
      }

      const id = idByName.get(key);
      if (id) {
        if (Object.keys(data).length === 0) {
          errors.push({ row, message: "nenhum campo preenchido para atualizar" });
          return;
        }
        toUpdate.push({ id, data: data as Prisma.BiblicalCharacterUpdateInput });
        return;
      }
      const missing = (["rarity", "shortSummary", "fullDescription"] as const).filter((field) => !data[field]);
      if (missing.length > 0) {
        const labels = { rarity: "raridade", shortSummary: "resumo curto", fullDescription: "história completa" };
        errors.push({ row, message: `personagem novo precisa de: ${missing.map((field) => labels[field]).join(", ")}` });
        return;
      }
      toCreate.push({ ...data, name: input.name, published: (data.published as boolean | undefined) ?? false, createdBy: currentUser(req).email } as Prisma.BiblicalCharacterCreateManyInput);
    });

    if (!dryRun) {
      await prisma.$transaction([
        ...(toCreate.length > 0 ? [prisma.biblicalCharacter.createMany({ data: toCreate })] : []),
        ...toUpdate.map((item) => prisma.biblicalCharacter.update({ where: { id: item.id }, data: item.data })),
      ]);
    }
    res.json({
      valid: toCreate.length + toUpdate.length,
      created: dryRun ? 0 : toCreate.length,
      updated: dryRun ? 0 : toUpdate.length,
      willCreate: toCreate.length,
      willUpdate: toUpdate.length,
      errors,
    });
  }),
);

charactersRouter.get(
  "/admin/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    res.json(toCharacterResponse(await getCharacter(parseId(req.params.id))));
  }),
);

charactersRouter.post(
  "/admin",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const input = createSchema.parse(req.body);
    await ensureNameAvailable(input.name);
    const character = await prisma.biblicalCharacter.create({
      data: { ...withoutUndefined(input), createdBy: currentUser(req).email } as Prisma.BiblicalCharacterCreateInput,
    });
    res.status(201).json(toCharacterResponse(character));
  }),
);

charactersRouter.put(
  "/admin/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const character = await getCharacter(parseId(req.params.id));
    const input = updateSchema.parse(req.body);
    if (input.name && input.name.toLowerCase() !== character.name.toLowerCase()) {
      await ensureNameAvailable(input.name, character.id);
    }
    const updated = await prisma.biblicalCharacter.update({
      where: { id: character.id },
      data: withoutUndefined(input) as Prisma.BiblicalCharacterUpdateInput,
    });
    res.json(toCharacterResponse(updated));
  }),
);

charactersRouter.delete(
  "/admin/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const character = await getCharacter(parseId(req.params.id));
    // Perguntas do personagem passam a ser gerais; figurinhas e anotações dele são removidas.
    await prisma.biblicalCharacter.delete({ where: { id: character.id } });
    res.status(204).end();
  }),
);

// ---------------------------------------------------------------------------
// Jogador
// ---------------------------------------------------------------------------

/** Álbum: só os publicados, em versão leve (os textos longos vêm no detalhe). */
charactersRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const characters = await prisma.biblicalCharacter.findMany({ where: visibleCharacter(), orderBy: [{ name: "asc" }, { id: "asc" }] });
    const counts = await activeQuestionCounts();
    res.json(characters.map((character) => toCharacterSummary(character, counts.get(character.id) ?? 0)));
  }),
);

/** Figurinhas agendadas ("em breve"): só raridade e data, sem revelar quem é. */
charactersRouter.get(
  "/upcoming",
  asyncHandler(async (_req, res) => {
    const upcoming = await prisma.biblicalCharacter.findMany({
      where: scheduledCharacter(),
      orderBy: { publishAt: "asc" },
      take: 6,
      select: { rarity: true, publishAt: true, testament: true },
    });
    res.json(upcoming);
  }),
);

charactersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const character = await getCharacter(parseId(req.params.id));
    const user = currentUser(req);
    if (user.role !== "ADMIN") {
      // Rascunhos só aparecem para o admin.
      if (!isCharacterVisible(character)) throw notFound("Personagem não encontrado");
      // A ficha completa é o prêmio: só quem conquistou a figurinha pode abrir.
      const owned = await prisma.userSticker.findUnique({ where: { userId_characterId: { userId: user.id, characterId: character.id } }, select: { id: true } });
      if (!owned) throw forbidden("Conquiste esta figurinha para ver os detalhes");
    }
    res.json(toCharacterResponse(character));
  }),
);
