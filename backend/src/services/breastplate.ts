import { lockUser, transaction, type Db } from "../db/prisma";
import { badRequest, notFound } from "../lib/errors";
import { checkAchievements } from "./achievements";
import { grantCosmetic, toCosmeticResponse } from "./cosmetics";
import { breastplateComplete, STONE_SCENARIOS, stoneState } from "./game-rules";
import { toUserResponse } from "./mappers";
import { walletData } from "./rewards";

const KIND = "CAMPAIGN";
const STONE_KIND = "STONE";
const FINAL_KIND = "BREASTPLATE";
const ONCE = "once";

/** Conquista final: brasão e cosmético de prestígio, entregues junto com a 12ª pedra. */
export const BREASTPLATE_REWARD = { coins: 2000, badgeName: "Brasão: Peitoral Completo", prestigeName: "Moldura: Peitoral Completo" } as const;

type StoneSeed = { slot: number; name: string; tribe: string; color: string; description: string };

/** As 12 pedras na ordem bíblica (Êxodo 28:17-20), em fileiras de 3; a tribo segue a tradição. */
export const DEFAULT_STONES: StoneSeed[] = [
  { slot: 1, name: "Sardônio", tribe: "Rúben", color: "#c8553d", description: "A primeira pedra do peitoral: vermelho-alaranjado, cor de tijolo e de brasa." },
  { slot: 2, name: "Topázio", tribe: "Simeão", color: "#e8b92f", description: "Dourada como a luz do santuário." },
  { slot: 3, name: "Carbúnculo", tribe: "Levi", color: "#d6283a", description: "Vermelho vivo, como brasa que não se apaga." },
  { slot: 4, name: "Esmeralda", tribe: "Judá", color: "#2fa66a", description: "Verde de pasto, de colheita e de esperança." },
  { slot: 5, name: "Safira", tribe: "Dã", color: "#2f5fb3", description: "Azul profundo, como o chão sob os pés de Deus." },
  { slot: 6, name: "Diamante", tribe: "Naftali", color: "#a8dcec", description: "Clara e brilhante como a luz." },
  { slot: 7, name: "Jacinto", tribe: "Gade", color: "#e0793a", description: "Cor de crepúsculo, entre o laranja e o azul." },
  { slot: 8, name: "Ágata", tribe: "Aser", color: "#a98467", description: "Listrada, com as cores da terra." },
  { slot: 9, name: "Ametista", tribe: "Issacar", color: "#8e5bc4", description: "Roxa, a cor da realeza." },
  { slot: 10, name: "Berilo", tribe: "Zebulom", color: "#3fb5a3", description: "Verde-água, como o mar de vidro." },
  { slot: 11, name: "Ônix", tribe: "José", color: "#4a4560", description: "Escura, com brilho dourado por dentro." },
  { slot: 12, name: "Jaspe", tribe: "Benjamim", color: "#5fae6a", description: "A última pedra: verde translúcida, como os muros da cidade santa." },
];

/** Moedas de cada pedra (a economia será reavaliada junto com o resto do jogo). */
const STONE_COINS = 500;

/**
 * Garante as 12 pedras, o cosmético (cor do nome) e o brasão de cada uma, e os itens da conquista final.
 * Só cria o que falta: o que o admin ajustou (nome, cor, arte, moedas) nunca é sobrescrito.
 */
export async function ensureBreastplate(db: Db) {
  for (const seed of DEFAULT_STONES) {
    const colorName = `Cor: ${seed.name}`;
    const badgeName = `Brasão: ${seed.name}`;
    const colorItem =
      (await db.cosmetic.findFirst({ where: { type: "NAME_COLOR", name: colorName }, select: { id: true } })) ??
      (await db.cosmetic.create({ data: { type: "NAME_COLOR", name: colorName, description: `Pedra ${seed.name} do Peitoral.`, rarity: "EPIC", color: seed.color, unlock: "REWARD", system: true, sortOrder: 1000 + seed.slot } }));
    const badge =
      (await db.cosmetic.findFirst({ where: { type: "BADGE", name: badgeName }, select: { id: true } })) ??
      (await db.cosmetic.create({ data: { type: "BADGE", name: badgeName, description: `Brasão da tribo de ${seed.tribe}: pedra ${seed.name}.`, rarity: "EPIC", color: seed.color, style: "💎", unlock: "REWARD", system: true, sortOrder: 1100 + seed.slot } }));
    if (await db.stone.findUnique({ where: { slot: seed.slot }, select: { id: true } })) continue;
    await db.stone.create({ data: { ...seed, rewardCoins: STONE_COINS, rewardCosmeticId: colorItem.id, badgeCosmeticId: badge.id } });
  }
  if (!(await db.cosmetic.findFirst({ where: { type: "BADGE", name: BREASTPLATE_REWARD.badgeName }, select: { id: true } }))) {
    await db.cosmetic.create({ data: { type: "BADGE", name: BREASTPLATE_REWARD.badgeName, description: "Você reuniu as 12 pedras do peitoral do sumo sacerdote.", rarity: "LEGENDARY", color: "#e0b43a", style: "🛡️", unlock: "REWARD", system: true, sortOrder: 1120 } });
  }
  if (!(await db.cosmetic.findFirst({ where: { type: "FRAME", name: BREASTPLATE_REWARD.prestigeName }, select: { id: true } }))) {
    await db.cosmetic.create({ data: { type: "FRAME", name: BREASTPLATE_REWARD.prestigeName, description: "Moldura de prestígio de quem completou o Peitoral.", rarity: "LEGENDARY", color: "#e0b43a", style: "royal", unlock: "REWARD", system: true, sortOrder: 1121 } });
  }
}

async function loadStones(db: Db) {
  return db.stone.findMany({
    where: { active: true },
    orderBy: { slot: "asc" },
    include: {
      rewardCosmetic: true,
      badgeCosmetic: true,
      scenarios: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, slug: true, name: true, color: true, iconImageUrl: true, nodes: { select: { id: true } } } },
    },
  });
}

async function claimedCodes(db: Db, userId: number, kind: string, codes: string[]): Promise<Set<string>> {
  if (codes.length === 0) return new Set();
  const rows = await db.userClaim.findMany({ where: { userId, kind, code: { in: codes } }, select: { code: true } });
  return new Set(rows.map((row) => row.code));
}

/** O Peitoral do jogador: as 12 pedras com situação, progresso dos cenários de cada uma e a conquista final. */
export async function getBreastplate(db: Db, userId: number) {
  const stones = await loadStones(db);
  const nodeIds = stones.flatMap((stone) => stone.scenarios.flatMap((scenario) => scenario.nodes.map((node) => String(node.id))));
  const [nodeClaims, stoneClaims, finalClaims] = await Promise.all([
    claimedCodes(db, userId, KIND, nodeIds),
    claimedCodes(db, userId, STONE_KIND, stones.map((stone) => String(stone.slot))),
    claimedCodes(db, userId, FINAL_KIND, [ONCE]),
  ]);
  const items = stones.map((stone) => {
    const scenarios = stone.scenarios.map((scenario) => ({
      id: scenario.id,
      slug: scenario.slug,
      name: scenario.name,
      color: scenario.color,
      iconImageUrl: scenario.iconImageUrl,
      completed: scenario.nodes.length > 0 && scenario.nodes.every((node) => nodeClaims.has(String(node.id))),
    }));
    const completed = scenarios.filter((scenario) => scenario.completed).length;
    return {
      id: stone.id,
      slot: stone.slot,
      name: stone.name,
      tribe: stone.tribe,
      color: stone.color,
      description: stone.description,
      imageUrl: stone.imageUrl,
      rewardCoins: stone.rewardCoins,
      cosmetic: stone.rewardCosmetic ? toCosmeticResponse(stone.rewardCosmetic) : null,
      badge: stone.badgeCosmetic ? toCosmeticResponse(stone.badgeCosmetic) : null,
      /** Cenários do grupo já cadastrados (a pedra exige {required}; os que faltam aparecem como "em breve"). */
      scenarios,
      required: STONE_SCENARIOS,
      completed,
      state: stoneState(completed, stoneClaims.has(String(stone.slot))),
    };
  });
  const claimed = items.filter((item) => item.state === "claimed").length;
  return {
    stones: items,
    claimed,
    total: items.length,
    complete: breastplateComplete(claimed, items.length),
    finalClaimed: finalClaims.has(ONCE),
    finalReward: { coins: BREASTPLATE_REWARD.coins, badgeName: BREASTPLATE_REWARD.badgeName, prestigeName: BREASTPLATE_REWARD.prestigeName },
  };
}

/** Resgata a pedra (precisa ter concluído os cenários do grupo): moedas, cosmético e brasão; a 12ª entrega a conquista final. */
export async function claimStone(userId: number, stoneId: number) {
  return transaction(async (tx) => {
    const stone = await tx.stone.findFirst({ where: { id: stoneId, active: true }, select: { id: true, slot: true } });
    if (!stone) throw notFound("Pedra não encontrada");
    await lockUser(tx, userId);
    const before = (await getBreastplate(tx, userId)).stones.find((item) => item.id === stone.id);
    if (!before) throw notFound("Pedra não encontrada");
    if (before.state === "claimed") throw badRequest("Esta pedra já foi resgatada");
    if (before.state === "locked") throw badRequest(`Conclua ${before.required} cenários desta pedra para resgatá-la (${before.completed}/${before.required})`);
    const created = await tx.userClaim.createMany({ data: [{ userId, kind: STONE_KIND, code: String(stone.slot), periodKey: ONCE }], skipDuplicates: true });
    if (created.count === 0) throw badRequest("Esta pedra já foi resgatada");

    const full = await tx.stone.findUniqueOrThrow({ where: { id: stone.id } });
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const wallet = { ...user, coins: user.coins + full.rewardCoins };
    const cosmeticGranted = full.rewardCosmeticId ? await grantCosmetic(tx, userId, full.rewardCosmeticId, "CAMPAIGN") : false;
    const badgeGranted = full.badgeCosmeticId ? await grantCosmetic(tx, userId, full.badgeCosmeticId, "CAMPAIGN") : false;

    // 12ª pedra: Peitoral Completo (uma única vez).
    let completeReward: { coins: number; badgeName: string; prestigeName: string } | null = null;
    const after = await getBreastplate(tx, userId);
    if (after.complete && !after.finalClaimed) {
      const finalCreated = await tx.userClaim.createMany({ data: [{ userId, kind: FINAL_KIND, code: ONCE, periodKey: ONCE }], skipDuplicates: true });
      if (finalCreated.count > 0) {
        wallet.coins += BREASTPLATE_REWARD.coins;
        for (const [type, name] of [["BADGE", BREASTPLATE_REWARD.badgeName], ["FRAME", BREASTPLATE_REWARD.prestigeName]] as const) {
          const item = await tx.cosmetic.findFirst({ where: { type, name }, select: { id: true } });
          if (item) await grantCosmetic(tx, userId, item.id, "CAMPAIGN");
        }
        completeReward = { ...BREASTPLATE_REWARD };
      }
    }
    await tx.user.update({ where: { id: userId }, data: walletData(wallet) });
    const unlockedAchievements = await checkAchievements(tx, userId);
    const saved = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    return { stoneId: stone.id, coins: full.rewardCoins, cosmeticGranted, badgeGranted, completeReward, unlockedAchievements, user: toUserResponse(saved) };
  });
}
