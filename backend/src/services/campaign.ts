import { lockUser, prisma, transaction, type Db } from "../db/prisma";
import { badRequest, notFound } from "../lib/errors";
import { checkAchievements } from "./achievements";
import { campaignNodeState, currentScenarioId, defaultNodePosition, fragmentsComplete } from "./game-rules";
import { EMERALD_CHEST, openEmeraldChest } from "./chests";
import { EMERALD_SET_NAMES } from "./default-cosmetics";
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

/** Campanha do jogador: cenários na ordem do caminho, paradas com situação e progresso da figurinha especial. */
export async function getCampaign(userId: number) {
  const [user, scenarios, claimed] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { level: true } }),
    prisma.scenario.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: { avatarCosmetic: true, nodes: { orderBy: { level: "asc" }, include: nodeInclude }, fragmentCharacter: { select: { id: true, name: true, imageUrl: true, rarity: true } } },
    }),
    claimedNodeIds(userId),
  ]);

  const allNodes = scenarios.flatMap((scenario) => scenario.nodes.map((node) => ({ level: node.level, scenarioId: scenario.id, id: node.id })));
  const currentId = currentScenarioId(scenarios, allNodes, user.level);

  // A figurinha especial: um fragmento por parada marcada, de qualquer cenário que aponte para ela.
  const fragmentNodes = scenarios.flatMap((scenario) => (scenario.fragmentCharacterId ? scenario.nodes.filter((node) => node.fragment) : []));
  const fragmentCharacter = scenarios.find((scenario) => scenario.fragmentCharacter)?.fragmentCharacter ?? null;
  const owned = fragmentCharacter ? (await prisma.userSticker.count({ where: { userId, characterId: fragmentCharacter.id } })) > 0 : false;

  // Prévia do Baú de Esmeralda (o prêmio da figurinha especial): o que ele traz, para o mapa mostrar bloqueado.
  const emeraldCosmetics = await prisma.cosmetic.findMany({ where: { name: { in: [...EMERALD_SET_NAMES] }, active: true }, orderBy: { id: "asc" } });

  return {
    level: user.level,
    currentScenarioId: currentId,
    emeraldChest: {
      coins: EMERALD_CHEST.coins,
      helpers: EMERALD_CHEST.helpers,
      stickerRarities: ["EPIC", "LEGENDARY"] as const,
      cosmetics: emeraldCosmetics.map(toCosmeticResponse),
    },
    special: fragmentCharacter
      ? {
          character: fragmentCharacter,
          fragments: fragmentNodes.filter((node) => claimed.has(node.id)).length,
          totalFragments: fragmentNodes.length,
          owned,
        }
      : null,
    scenarios: scenarios.map((scenario, scenarioIndex) => {
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
        // A relíquia também entrega o ícone de perfil do cenário.
        avatar: node.relic && scenario.avatarCosmetic ? toCosmeticResponse(scenario.avatarCosmetic) : null,
        x: node.posX ?? positions[index].x,
        y: node.posY ?? positions[index].y,
        state: campaignNodeState(user.level, node.level, claimed.has(node.id)),
      }));
      const claimedCount = nodes.filter((node) => node.state === "claimed").length;
      // A música do tema é liberada ao chegar ao primeiro nível do cenário (o primeiro cenário já nasce liberado).
      const startLevel = nodes[0]?.level ?? null;
      const musicUnlocked = startLevel === null ? scenarioIndex === 0 : user.level >= startLevel;
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
        quizBackgroundUrl: scenario.quizBackgroundUrl,
        boardImageUrl: scenario.boardImageUrl,
        hasMusic: Boolean(scenario.musicUrl),
        musicUnlocked,
        musicUrl: musicUnlocked ? scenario.musicUrl : null,
        startLevel,
        endLevel: nodes[nodes.length - 1]?.level ?? null,
        total: nodes.length,
        claimed: claimedCount,
        completed: nodes.length > 0 && claimedCount === nodes.length,
        nodes,
      };
    }),
  };
}

/** Cenário em que o jogador está (pelo nível); null sem campanha. */
export async function currentScenarioIdFor(db: Db, userId: number): Promise<number | null> {
  const [scenarios, user] = await Promise.all([
    db.scenario.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true, nodes: { select: { level: true } } } }),
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { level: true } }),
  ]);
  const nodes = scenarios.flatMap((scenario) => scenario.nodes.map((node) => ({ level: node.level, scenarioId: scenario.id })));
  return currentScenarioId(scenarios, nodes, user.level);
}

/** Resgata a parada (precisa ter chegado ao nível): moedas, ajuda, item visual e fragmento da figurinha especial. */
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
    const avatarId = node.relic ? node.scenario.avatarCosmeticId : null;
    const avatarGranted = avatarId ? await grantCosmetic(tx, userId, avatarId, "CAMPAIGN") : false;

    // Fragmento: ao juntar todos, a figurinha especial é entregue (uma única vez).
    let fragments: { claimed: number; total: number } | null = null;
    let specialUnlocked = false;
    let special: { id: number; name: string; imageUrl: string | null } | null = null;
    let emeraldChest: Awaited<ReturnType<typeof openEmeraldChest>> | null = null;
    const characterId = node.fragment ? node.scenario.fragmentCharacterId : null;
    if (characterId) {
      const fragmentNodes = await tx.scenarioNode.findMany({ where: { fragment: true, scenario: { fragmentCharacterId: characterId, active: true } }, select: { id: true } });
      const ids = new Set(fragmentNodes.map((fragment) => String(fragment.id)));
      const mine = await tx.userClaim.findMany({ where: { userId, kind: KIND, code: { in: [...ids] } }, select: { code: true } });
      fragments = { claimed: mine.length, total: ids.size };
      if (fragmentsComplete(mine.length, ids.size)) {
        specialUnlocked = await grantStickerIfMissing(tx, userId, characterId);
        special = await tx.biblicalCharacter.findUnique({ where: { id: characterId }, select: { id: true, name: true, imageUrl: true } });
        // Conquistar a figurinha especial abre o Baú de Esmeralda (uma única vez, junto com a carta).
        if (specialUnlocked && special) {
          emeraldChest = await openEmeraldChest(tx, wallet, settings, Math.random, special);
          await tx.user.update({ where: { id: userId }, data: walletData(wallet) });
        }
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
      avatarGranted,
      fragments,
      specialUnlocked,
      special: specialUnlocked ? special : null,
      emeraldChest,
      unlockedAchievements,
      user: toUserResponse(saved),
    };
  });
}
