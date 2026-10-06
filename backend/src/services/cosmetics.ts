import type { Cosmetic, CosmeticType, Prisma } from "@prisma/client";
import { lockUser, prisma, transaction, type Db } from "../db/prisma";
import { badRequest, notFound } from "../lib/errors";
import { loadStats, type AchievementStats } from "./achievements";
import { visibleCharacter } from "./visibility";

/**
 * Visual do jogador: ícones (avatar), molduras, títulos que brilham, cor do
 * nome e reações do chat. O admin cadastra os itens; o jogador ganha (meta,
 * baú, coleção, passe, admin), compra na loja ou recebe de graça, e equipa.
 */

export type CosmeticStats = AchievementStats & {
  correctAnswers: number;
  bestCombo: number;
  leagueWins: number;
  achievements: number;
  allLegendary: boolean;
  collectionsCompleted: number;
  boardWins: number;
};

type RequirementDefinition = {
  code: string;
  label: string;
  /** Precisa de um número (ex.: nível 20)? */
  needsValue: boolean;
  progress: (stats: CosmeticStats, value: number) => { current: number; target: number };
};

/** Metas que liberam itens. O admin escolhe uma e o número. */
export const REQUIREMENTS: RequirementDefinition[] = [
  { code: "LEVEL", label: "Chegar ao nível", needsValue: true, progress: (s, v) => ({ current: s.level, target: v }) },
  { code: "STICKERS", label: "Ter figurinhas no álbum", needsValue: true, progress: (s, v) => ({ current: s.stickers, target: v }) },
  {
    code: "ALBUM_COMPLETE",
    label: "Completar o álbum",
    needsValue: false,
    progress: (s) => ({ current: s.stickers, target: s.totalStickers > 0 ? s.totalStickers : Number.POSITIVE_INFINITY }),
  },
  { code: "ALL_LEGENDARY", label: "Ter todas as lendárias", needsValue: false, progress: (s) => ({ current: s.allLegendary ? 1 : 0, target: 1 }) },
  { code: "DAILY_STREAK", label: "Dias seguidos no prêmio diário", needsValue: true, progress: (s, v) => ({ current: s.dailyStreak, target: v }) },
  { code: "MATCHES", label: "Partidas terminadas", needsValue: true, progress: (s, v) => ({ current: s.matches, target: v }) },
  { code: "CORRECT_ANSWERS", label: "Perguntas acertadas", needsValue: true, progress: (s, v) => ({ current: s.correctAnswers, target: v }) },
  { code: "PERFECT_MATCHES", label: "Partidas perfeitas", needsValue: true, progress: (s, v) => ({ current: s.perfectMatches, target: v }) },
  { code: "BEST_COMBO", label: "Sequência de acertos numa partida", needsValue: true, progress: (s, v) => ({ current: s.bestCombo, target: v }) },
  { code: "LEAGUE_WINS", label: "Vencer a liga semanal (1º lugar)", needsValue: true, progress: (s, v) => ({ current: s.leagueWins, target: v }) },
  { code: "FRIENDS", label: "Amigos no app", needsValue: true, progress: (s, v) => ({ current: s.friends, target: v }) },
  { code: "TRADES", label: "Trocas concluídas", needsValue: true, progress: (s, v) => ({ current: s.trades, target: v }) },
  { code: "ACHIEVEMENTS", label: "Conquistas desbloqueadas", needsValue: true, progress: (s, v) => ({ current: s.achievements, target: v }) },
  { code: "COLLECTIONS", label: "Coleções temáticas completas", needsValue: true, progress: (s, v) => ({ current: s.collectionsCompleted, target: v }) },
  { code: "BOARD_WINS", label: "Vencer partidas online do Tabuleiro", needsValue: true, progress: (s, v) => ({ current: s.boardWins, target: v }) },
];

export const requirementByCode = (code: string | null) => REQUIREMENTS.find((requirement) => requirement.code === code);

export const TITLE_STYLES = ["plain", "glow", "rainbow", "pulse", "shimmer", "wave"] as const;
/** Como a reação entra no chat. `pop` é a padrão. */
export const REACTION_ANIMATIONS = ["pop", "bounce", "shake", "spin", "rise", "pulse"] as const;
export const FRAME_STYLES = ["solid", "wood", "silver", "gold", "fire", "rainbow", "copper", "ice", "sunset", "laurel", "aurora", "neon", "royal", "galaxy", "pearl", "pentecost"] as const;

/** Campo do usuário que guarda o item equipado de cada tipo (reações não se equipam). */
const EQUIP_FIELD: Partial<Record<CosmeticType, "avatarId" | "frameId" | "titleId" | "nameColorId" | "profileBgId" | "albumCoverId" | "badgeId">> = {
  AVATAR: "avatarId",
  FRAME: "frameId",
  TITLE: "titleId",
  NAME_COLOR: "nameColorId",
  PROFILE_BG: "profileBgId",
  ALBUM_COVER: "albumCoverId",
  BADGE: "badgeId",
};

export async function loadCosmeticStats(db: Db, userId: number): Promise<CosmeticStats> {
  const [base, user, correct, leagueWins, achievements, legendaryTotal, legendaryOwned, collections] = await Promise.all([
    loadStats(db, userId),
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { bestCombo: true, boardWins: true } }),
    db.quizMatch.aggregate({ where: { userId }, _sum: { correctAnswers: true } }),
    db.userClaim.count({ where: { userId, kind: "LEAGUE", code: "POS1" } }),
    db.userAchievement.count({ where: { userId } }),
    db.biblicalCharacter.count({ where: { rarity: "LEGENDARY", ...visibleCharacter() } }),
    db.userSticker.count({ where: { userId, character: { rarity: "LEGENDARY", ...visibleCharacter() } } }),
    db.userClaim.count({ where: { userId, kind: "COLLECTION" } }),
  ]);
  return {
    ...base,
    correctAnswers: correct._sum.correctAnswers ?? 0,
    bestCombo: user.bestCombo,
    boardWins: user.boardWins,
    leagueWins,
    achievements,
    allLegendary: legendaryTotal > 0 && legendaryOwned >= legendaryTotal,
    collectionsCompleted: collections,
  };
}

function progressOf(cosmetic: Pick<Cosmetic, "requirement" | "requirementValue">, stats: CosmeticStats) {
  const requirement = requirementByCode(cosmetic.requirement);
  if (!requirement) return null;
  return requirement.progress(stats, cosmetic.requirementValue ?? 1);
}

export type UnlockedCosmetic = { id: number; name: string; type: CosmeticType; rarity: string };

/**
 * Entrega os itens grátis e os de meta já alcançada. Chamado no fim da
 * partida e ao abrir o inventário (dentro da transação quando houver).
 */
export async function checkCosmetics(db: Db, userId: number): Promise<UnlockedCosmetic[]> {
  const candidates = await db.cosmetic.findMany({
    where: { active: true, unlock: { in: ["FREE", "REQUIREMENT"] }, owners: { none: { userId } } },
  });
  if (candidates.length === 0) return [];
  const needsStats = candidates.some((cosmetic) => cosmetic.unlock === "REQUIREMENT");
  const stats = needsStats ? await loadCosmeticStats(db, userId) : null;
  const reached = candidates.filter((cosmetic) => {
    if (cosmetic.unlock === "FREE") return true;
    const progress = stats ? progressOf(cosmetic, stats) : null;
    return progress !== null && progress.current >= progress.target;
  });
  if (reached.length === 0) return [];
  await db.userCosmetic.createMany({
    data: reached.map((cosmetic) => ({ userId, cosmeticId: cosmetic.id, source: cosmetic.unlock })),
    skipDuplicates: true,
  });
  // Itens grátis entram em silêncio; só os de meta viram aviso de "novo item".
  return reached.filter((cosmetic) => cosmetic.unlock === "REQUIREMENT").map(({ id, name, type, rarity }) => ({ id, name, type, rarity }));
}

/** Concede um item (admin, baú, coleção, passe). Retorna false se o jogador já tinha. */
export async function grantCosmetic(db: Db, userId: number, cosmeticId: number, source: string): Promise<boolean> {
  const created = await db.userCosmetic.createMany({ data: [{ userId, cosmeticId, source }], skipDuplicates: true });
  return created.count > 0;
}

function shopAvailable(cosmetic: Cosmetic & { event: { startsAt: Date; endsAt: Date; active: boolean } | null }, now: Date) {
  if (cosmetic.unlock !== "SHOP" || cosmetic.priceCoins === null) return false;
  if (!cosmetic.event) return true;
  return cosmetic.event.active && cosmetic.event.startsAt <= now && cosmetic.event.endsAt > now;
}

export function toCosmeticResponse(cosmetic: Cosmetic) {
  return {
    id: cosmetic.id,
    type: cosmetic.type,
    name: cosmetic.name,
    description: cosmetic.description,
    rarity: cosmetic.rarity,
    imageUrl: cosmetic.imageUrl,
    color: cosmetic.color,
    style: cosmetic.style,
    animation: cosmetic.animation,
    pack: cosmetic.pack,
    unlock: cosmetic.unlock,
    priceCoins: cosmetic.priceCoins,
    requirement: cosmetic.requirement,
    requirementValue: cosmetic.requirementValue,
    requirementLabel: requirementByCode(cosmetic.requirement)?.label ?? null,
    inChestPool: cosmetic.inChestPool,
    eventId: cosmetic.eventId,
    active: cosmetic.active,
    system: cosmetic.system,
    sortOrder: cosmetic.sortOrder,
  };
}

/** Inventário: todos os itens ativos com "tenho/não tenho", progresso da meta e preço. */
export async function getInventory(userId: number) {
  const unlocked = await transaction((tx) => checkCosmetics(tx, userId));
  const now = new Date();
  const [cosmetics, owned, user, stats] = await Promise.all([
    prisma.cosmetic.findMany({ where: { active: true }, include: { event: true }, orderBy: [{ type: "asc" }, { sortOrder: "asc" }, { id: "asc" }] }),
    prisma.userCosmetic.findMany({ where: { userId }, select: { cosmeticId: true, acquiredAt: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { avatarId: true, frameId: true, titleId: true, nameColorId: true, profileBgId: true, albumCoverId: true, badgeId: true, coins: true } }),
    loadCosmeticStats(prisma, userId),
  ]);
  const ownedAt = new Map(owned.map((row) => [row.cosmeticId, row.acquiredAt]));
  return {
    unlocked,
    equipped: { avatarId: user.avatarId, frameId: user.frameId, titleId: user.titleId, nameColorId: user.nameColorId, profileBgId: user.profileBgId, albumCoverId: user.albumCoverId, badgeId: user.badgeId },
    coins: user.coins,
    items: cosmetics
      // Itens de evento fora do período só aparecem para quem já tem.
      .filter((cosmetic) => ownedAt.has(cosmetic.id) || !cosmetic.eventId || shopAvailable(cosmetic, now))
      .map((cosmetic) => ({
        ...toCosmeticResponse(cosmetic),
        owned: ownedAt.has(cosmetic.id),
        acquiredAt: ownedAt.get(cosmetic.id) ?? null,
        forSale: shopAvailable(cosmetic, now),
        eventName: cosmetic.event?.name ?? null,
        eventEndsAt: cosmetic.event?.endsAt ?? null,
        progress: cosmetic.unlock === "REQUIREMENT" ? progressOf(cosmetic, stats) : null,
      })),
  };
}

/** Equipa (ou tira, com null) o item de um tipo. Só itens que o jogador tem. */
export async function equipCosmetic(userId: number, type: CosmeticType, cosmeticId: number | null) {
  const field = EQUIP_FIELD[type];
  if (!field) throw badRequest("Este tipo de item não se equipa");
  if (cosmeticId !== null) {
    const owned = await prisma.userCosmetic.findUnique({
      where: { userId_cosmeticId: { userId, cosmeticId } },
      include: { cosmetic: { select: { type: true } } },
    });
    if (!owned) throw badRequest("Você ainda não tem este item");
    if (owned.cosmetic.type !== type) throw badRequest("Item de outro tipo");
  }
  await prisma.user.update({ where: { id: userId }, data: { [field]: cosmeticId } });
  return getPlayerLook(userId);
}

/** Compra um item visual da loja (os de evento só durante o evento). */
export async function buyCosmetic(userId: number, cosmeticId: number) {
  return transaction(async (tx) => {
    const cosmetic = await tx.cosmetic.findFirst({ where: { id: cosmeticId, active: true }, include: { event: true } });
    if (!cosmetic || !shopAvailable(cosmetic, new Date())) throw notFound("Item não está à venda");
    await lockUser(tx, userId);
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { coins: true } });
    if (await tx.userCosmetic.findUnique({ where: { userId_cosmeticId: { userId, cosmeticId } } })) throw badRequest("Você já tem este item");
    const price = cosmetic.priceCoins ?? 0;
    if (user.coins < price) throw badRequest("Moedas insuficientes");
    await tx.userCosmetic.create({ data: { userId, cosmeticId, source: "SHOP" } });
    const saved = await tx.user.update({ where: { id: userId }, data: { coins: user.coins - price } });
    return { cosmetic: toCosmeticResponse(cosmetic), userCoins: saved.coins };
  });
}

// ---------------------------------------------------------------------------
// Aparência do jogador em listas (ranking, amigos, conversa, perfil)
// ---------------------------------------------------------------------------

const lookSelect = {
  id: true,
  avatar: { select: { imageUrl: true, name: true } },
  frame: { select: { imageUrl: true, color: true, style: true } },
  title: { select: { name: true, color: true, style: true, rarity: true } },
  nameColor: { select: { color: true } },
  profileBg: { select: { imageUrl: true, color: true, style: true } },
  albumCover: { select: { imageUrl: true, color: true, style: true } },
  badge: { select: { name: true, imageUrl: true, color: true, style: true } },
} satisfies Prisma.UserSelect;

type LookRow = Prisma.UserGetPayload<{ select: typeof lookSelect }>;

export type PlayerLook = {
  avatarUrl: string | null;
  frame: { imageUrl: string | null; color: string | null; style: string | null } | null;
  title: { name: string; color: string | null; style: string | null; rarity: string } | null;
  nameColor: string | null;
  /** Fundo do cartão de perfil e capa do álbum (imagem e/ou cor). */
  profileBg: { imageUrl: string | null; color: string | null; style: string | null } | null;
  albumCover: { imageUrl: string | null; color: string | null; style: string | null } | null;
  /** Brasão equipado: imagem, ou o emoji em `style` sobre a cor. */
  badge: { name: string; imageUrl: string | null; color: string | null; style: string | null } | null;
};

function toLook(row: LookRow | undefined): PlayerLook {
  return {
    avatarUrl: row?.avatar?.imageUrl ?? null,
    frame: row?.frame ?? null,
    title: row?.title ?? null,
    nameColor: row?.nameColor?.color ?? null,
    profileBg: row?.profileBg ?? null,
    albumCover: row?.albumCover ?? null,
    badge: row?.badge ?? null,
  };
}

/** Aparência de vários jogadores numa consulta só. */
export async function playerLooks(db: Db, userIds: number[]): Promise<Map<number, PlayerLook>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const rows = await db.user.findMany({ where: { id: { in: ids } }, select: lookSelect });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return new Map(ids.map((id) => [id, toLook(byId.get(id))]));
}

export async function getPlayerLook(userId: number) {
  return (await playerLooks(prisma, [userId])).get(userId)!;
}

/** Cartão de perfil: o que os outros jogadores veem. */
export async function getProfile(userId: number) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deleted: false },
    select: { id: true, name: true, level: true, xp: true, dailyStreak: true, bestCombo: true, showcase: true, createdAt: true, role: true },
  });
  if (!user) throw notFound("Jogador não encontrado");
  const [look, owned, total, matches, achievements, showcase, leagueWins] = await Promise.all([
    getPlayerLook(userId),
    prisma.userSticker.count({ where: { userId, character: visibleCharacter() } }),
    prisma.biblicalCharacter.count({ where: visibleCharacter() }),
    prisma.quizMatch.count({ where: { userId } }),
    prisma.userAchievement.count({ where: { userId } }),
    user.showcase.length
      ? prisma.userSticker.findMany({
          where: { userId, characterId: { in: user.showcase }, character: visibleCharacter() },
          select: { character: { select: { id: true, name: true, rarity: true, imageUrl: true } } },
        })
      : Promise.resolve([]),
    prisma.userClaim.count({ where: { userId, kind: "LEAGUE", code: "POS1" } }),
  ]);
  const byId = new Map(showcase.map((row) => [row.character.id, row.character]));
  return {
    id: user.id,
    name: user.name,
    level: user.level,
    xp: user.xp,
    memberSince: user.createdAt,
    look,
    album: { owned, total },
    stats: { matches, achievements, dailyStreak: user.dailyStreak, bestCombo: user.bestCombo, leagueWins },
    // Mantém a ordem escolhida pelo jogador.
    showcase: user.showcase.map((id) => byId.get(id)).filter((character) => character !== undefined),
  };
}

/** Escolhe até 3 figurinhas próprias para a vitrine do perfil. */
export async function setShowcase(userId: number, characterIds: number[]) {
  const unique = [...new Set(characterIds)].slice(0, 3);
  if (unique.length > 0) {
    const owned = await prisma.userSticker.count({ where: { userId, characterId: { in: unique } } });
    if (owned !== unique.length) throw badRequest("Só dá para exibir figurinhas que você tem");
  }
  await prisma.user.update({ where: { id: userId }, data: { showcase: unique } });
  return getProfile(userId);
}
