import { lockUser, prisma, transaction, type Db } from "../db/prisma";
import { badRequest, notFound } from "../lib/errors";
import { checkAchievements } from "./achievements";
import { campaignNodeState, currentScenarioId, defaultNodePosition, fragmentsComplete } from "./game-rules";
import { grantCosmetic, toCosmeticResponse } from "./cosmetics";
import { toUserResponse } from "./mappers";
import { applyReward, grantStickerIfMissing, walletData } from "./rewards";
import { getSettings } from "./settings";

const KIND = "CAMPAIGN";
const ONCE = "once";

const nodeInclude = { rewardDefinition: { select: { id: true, name: true, rewardType: true } }, rewardCosmetic: true } as const;

async function claimedNodeIds(userId: number): Promise<Set<number>> {
  const rows = await prisma.userClaim.findMany({ where: { userId, kind: KIND }, select: { code: true } });
  return new Set(rows.map((row) => Number(row.code)));
}

/** Campanha do jogador: cenários na ordem do caminho, paradas com situação e progresso da carta especial. */
export async function getCampaign(userId: number) {
  const [user, scenarios, claimed] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { level: true } }),
    prisma.scenario.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: { nodes: { orderBy: { level: "asc" }, include: nodeInclude }, fragmentCharacter: { select: { id: true, name: true, imageUrl: true, rarity: true } } },
    }),
    claimedNodeIds(userId),
  ]);

  const allNodes = scenarios.flatMap((scenario) => scenario.nodes.map((node) => ({ level: node.level, scenarioId: scenario.id, id: node.id })));
  const claimedLevels = new Set(allNodes.filter((node) => claimed.has(node.id)).map((node) => node.level));
  const currentId = currentScenarioId(scenarios, allNodes, claimedLevels);

  // A carta especial: um fragmento por parada marcada, de qualquer cenário que aponte para ela.
  const fragmentNodes = scenarios.flatMap((scenario) => (scenario.fragmentCharacterId ? scenario.nodes.filter((node) => node.fragment) : []));
  const fragmentCharacter = scenarios.find((scenario) => scenario.fragmentCharacter)?.fragmentCharacter ?? null;
  const owned = fragmentCharacter ? (await prisma.userSticker.count({ where: { userId, characterId: fragmentCharacter.id } })) > 0 : false;

  return {
    level: user.level,
    currentScenarioId: currentId,
    special: fragmentCharacter
      ? {
          character: fragmentCharacter,
          fragments: fragmentNodes.filter((node) => claimed.has(node.id)).length,
          totalFragments: fragmentNodes.length,
          owned,
        }
      : null,
    scenarios: scenarios.map((scenario) => {
      const positions = scenario.nodes.map((_, index) => defaultNodePosition(index, scenario.nodes.length));
      const nodes = scenario.nodes.map((node, index) => ({
        id: node.id,
        level: node.level,
        title: node.title,
        relic: node.relic,
        fragment: node.fragment,
        rewardCoins: node.rewardCoins,
        reward: node.rewardDefinition,
        cosmetic: node.rewardCosmetic ? toCosmeticResponse(node.rewardCosmetic) : null,
        x: node.posX ?? positions[index].x,
        y: node.posY ?? positions[index].y,
        state: campaignNodeState(user.level, node.level, claimed.has(node.id)),
      }));
      const claimedCount = nodes.filter((node) => node.state === "claimed").length;
      return {
        id: scenario.id,
        slug: scenario.slug,
        name: scenario.name,
        description: scenario.description,
        verse: scenario.verse,
        verseReference: scenario.verseReference,
        color: scenario.color,
        mapImageUrl: scenario.mapImageUrl,
        iconImageUrl: scenario.iconImageUrl,
        startLevel: nodes[0]?.level ?? null,
        endLevel: nodes[nodes.length - 1]?.level ?? null,
        total: nodes.length,
        claimed: claimedCount,
        completed: nodes.length > 0 && claimedCount === nodes.length,
        nodes,
      };
    }),
  };
}

/** Cenário em que o jogador está (o primeiro com parada ainda não resgatada); null sem campanha. */
export async function currentScenarioIdFor(db: Db, userId: number): Promise<number | null> {
  const [scenarios, claims] = await Promise.all([
    db.scenario.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, nodes: { select: { id: true, level: true } } } }),
    db.userClaim.findMany({ where: { userId, kind: KIND }, select: { code: true } }),
  ]);
  const claimed = new Set(claims.map((claim) => Number(claim.code)));
  const nodes = scenarios.flatMap((scenario) => scenario.nodes.map((node) => ({ level: node.level, scenarioId: scenario.id, id: node.id })));
  const claimedLevels = new Set(nodes.filter((node) => claimed.has(node.id)).map((node) => node.level));
  return currentScenarioId(scenarios, nodes, claimedLevels);
}

/** Resgata a parada (precisa ter chegado ao nível): moedas, ajuda, item visual e fragmento da carta especial. */
export async function claimNode(userId: number, nodeId: number) {
  return transaction(async (tx) => {
    const node = await tx.scenarioNode.findFirst({ where: { id: nodeId, scenario: { active: true } }, include: { rewardDefinition: true, scenario: true } });
    if (!node) throw notFound("Parada não encontrada");
    await lockUser(tx, userId);
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.level < node.level) throw badRequest(`Chegue ao nível ${node.level} para abrir esta parada`);
    const created = await tx.userClaim.createMany({ data: [{ userId, kind: KIND, code: String(node.id), periodKey: ONCE }], skipDuplicates: true });
    if (created.count === 0) throw badRequest("Esta parada já foi resgatada");

    const settings = await getSettings(tx);
    const wallet = { ...user, coins: user.coins + node.rewardCoins };
    const applied = node.rewardDefinition ? await applyReward(tx, wallet, node.rewardDefinition, settings) : null;
    await tx.user.update({ where: { id: userId }, data: walletData(wallet) });
    const cosmeticGranted = node.rewardCosmeticId ? await grantCosmetic(tx, userId, node.rewardCosmeticId, "CAMPAIGN") : false;

    // Fragmento: ao juntar todos, a carta especial é entregue (uma única vez).
    let fragments: { claimed: number; total: number } | null = null;
    let specialUnlocked = false;
    let special: { id: number; name: string; imageUrl: string | null } | null = null;
    const characterId = node.fragment ? node.scenario.fragmentCharacterId : null;
    if (characterId) {
      const fragmentNodes = await tx.scenarioNode.findMany({ where: { fragment: true, scenario: { fragmentCharacterId: characterId, active: true } }, select: { id: true } });
      const ids = new Set(fragmentNodes.map((fragment) => String(fragment.id)));
      const mine = await tx.userClaim.findMany({ where: { userId, kind: KIND, code: { in: [...ids] } }, select: { code: true } });
      fragments = { claimed: mine.length, total: ids.size };
      if (fragmentsComplete(mine.length, ids.size)) {
        specialUnlocked = await grantStickerIfMissing(tx, userId, characterId);
        special = await tx.biblicalCharacter.findUnique({ where: { id: characterId }, select: { id: true, name: true, imageUrl: true } });
      }
    }

    const unlockedAchievements = await checkAchievements(tx, userId);
    const saved = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    return {
      nodeId: node.id,
      coins: node.rewardCoins,
      reward: applied,
      cosmeticGranted,
      cosmeticName: node.rewardCosmeticId ? (await tx.cosmetic.findUnique({ where: { id: node.rewardCosmeticId }, select: { name: true } }))?.name ?? null : null,
      fragments,
      specialUnlocked,
      special: specialUnlocked ? special : null,
      unlockedAchievements,
      user: toUserResponse(saved),
    };
  });
}
