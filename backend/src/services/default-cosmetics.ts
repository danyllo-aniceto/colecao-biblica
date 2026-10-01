import type { CosmeticType, CosmeticUnlock, StickerRarity } from "@prisma/client";
import type { Db } from "../db/prisma";

type DefaultCosmetic = {
  type: CosmeticType;
  name: string;
  description?: string;
  rarity: StickerRarity;
  imageUrl?: string;
  color?: string;
  style?: string;
  unlock: CosmeticUnlock;
  priceCoins?: number;
  requirement?: string;
  requirementValue?: number;
  inChestPool?: boolean;
};

const avatar = (file: string) => `/avatars/${file}.svg`;

/**
 * Itens visuais que já vêm no app. O admin pode editar, desativar e criar
 * outros; no deploy só são criados os que faltam (nada é sobrescrito).
 */
export const DEFAULT_COSMETICS: DefaultCosmetic[] = [
  // Ícones
  { type: "AVATAR", name: "Passarinho", rarity: "COMMON", imageUrl: avatar("pomba"), unlock: "FREE" },
  { type: "AVATAR", name: "Peixe", rarity: "COMMON", imageUrl: avatar("peixe"), unlock: "FREE" },
  { type: "AVATAR", name: "Lâmpada", rarity: "COMMON", imageUrl: avatar("lampada"), unlock: "FREE" },
  { type: "AVATAR", name: "Pergaminho", rarity: "COMMON", imageUrl: avatar("pergaminho"), unlock: "FREE" },
  { type: "AVATAR", name: "Patinha", rarity: "RARE", imageUrl: avatar("cordeiro"), unlock: "SHOP", priceCoins: 300 },
  { type: "AVATAR", name: "Arca", rarity: "RARE", imageUrl: avatar("arca"), unlock: "SHOP", priceCoins: 400 },
  { type: "AVATAR", name: "Louvor", rarity: "RARE", imageUrl: avatar("harpa"), unlock: "SHOP", priceCoins: 400 },
  { type: "AVATAR", name: "Medalha", rarity: "EPIC", imageUrl: avatar("coroa"), unlock: "REQUIREMENT", requirement: "LEVEL", requirementValue: 10 },
  { type: "AVATAR", name: "Estrela", rarity: "EPIC", imageUrl: avatar("estrela"), unlock: "REQUIREMENT", requirement: "BEST_COMBO", requirementValue: 10 },
  { type: "AVATAR", name: "Trombeta", rarity: "EPIC", imageUrl: avatar("trombeta"), unlock: "REWARD", inChestPool: true },
  { type: "AVATAR", name: "Sarça ardente", rarity: "LEGENDARY", imageUrl: avatar("sarca"), unlock: "REWARD", inChestPool: true },
  { type: "AVATAR", name: "Glória", rarity: "LEGENDARY", imageUrl: avatar("gloria"), unlock: "REQUIREMENT", requirement: "LEAGUE_WINS", requirementValue: 1 },

  // Molduras
  { type: "FRAME", name: "Madeira", rarity: "COMMON", style: "wood", color: "#a0693a", unlock: "SHOP", priceCoins: 150 },
  { type: "FRAME", name: "Prata", rarity: "RARE", style: "silver", color: "#c7cedd", unlock: "REQUIREMENT", requirement: "LEVEL", requirementValue: 5 },
  { type: "FRAME", name: "Esmeralda", rarity: "RARE", style: "solid", color: "#12b39a", unlock: "REWARD", inChestPool: true },
  { type: "FRAME", name: "Ouro", rarity: "EPIC", style: "gold", color: "#ffbf1f", unlock: "REQUIREMENT", requirement: "LEVEL", requirementValue: 15 },
  { type: "FRAME", name: "Chamas", rarity: "EPIC", style: "fire", color: "#ff6a3d", unlock: "REQUIREMENT", requirement: "DAILY_STREAK", requirementValue: 30 },
  { type: "FRAME", name: "Arco da aliança", rarity: "LEGENDARY", style: "rainbow", unlock: "REQUIREMENT", requirement: "ALBUM_COMPLETE" },

  // Títulos (brilham embaixo do nome; os melhores são difíceis)
  { type: "TITLE", name: "Peregrino", rarity: "COMMON", color: "#5b6190", style: "plain", unlock: "FREE" },
  { type: "TITLE", name: "Pastor de amigos", rarity: "RARE", color: "#12b39a", style: "glow", unlock: "REQUIREMENT", requirement: "FRIENDS", requirementValue: 10 },
  { type: "TITLE", name: "Profeta do ranking", rarity: "EPIC", color: "#7c4dff", style: "glow", unlock: "REQUIREMENT", requirement: "LEAGUE_WINS", requirementValue: 1 },
  { type: "TITLE", name: "Imparável", rarity: "EPIC", color: "#ff6a3d", style: "pulse", unlock: "REQUIREMENT", requirement: "BEST_COMBO", requirementValue: 20 },
  { type: "TITLE", name: "Mestre das Escrituras", rarity: "EPIC", color: "#2f8cff", style: "glow", unlock: "REQUIREMENT", requirement: "CORRECT_ANSWERS", requirementValue: 1000 },
  { type: "TITLE", name: "Coração perfeito", rarity: "LEGENDARY", color: "#ff4d6a", style: "pulse", unlock: "REQUIREMENT", requirement: "PERFECT_MATCHES", requirementValue: 50 },
  { type: "TITLE", name: "Discípulo fiel", rarity: "LEGENDARY", color: "#ffae00", style: "glow", unlock: "REQUIREMENT", requirement: "DAILY_STREAK", requirementValue: 100 },
  { type: "TITLE", name: "Rei das lendas", rarity: "LEGENDARY", color: "#ffae00", style: "rainbow", unlock: "REQUIREMENT", requirement: "ALL_LEGENDARY" },
  { type: "TITLE", name: "Guardião da Arca", rarity: "LEGENDARY", color: "#a64dff", style: "rainbow", unlock: "REQUIREMENT", requirement: "ALBUM_COMPLETE" },
  { type: "TITLE", name: "Peregrino da temporada", rarity: "EPIC", color: "#12b39a", style: "glow", unlock: "REWARD", description: "Prêmio do último degrau do passe da temporada." },

  // Cores do nome
  { type: "NAME_COLOR", name: "Celeste", rarity: "COMMON", color: "#2f8cff", unlock: "SHOP", priceCoins: 250 },
  { type: "NAME_COLOR", name: "Esmeralda", rarity: "COMMON", color: "#12b39a", unlock: "SHOP", priceCoins: 250 },
  { type: "NAME_COLOR", name: "Rubi", rarity: "RARE", color: "#e0324f", unlock: "REWARD", inChestPool: true },
  { type: "NAME_COLOR", name: "Dourado", rarity: "EPIC", color: "#d98f00", unlock: "SHOP", priceCoins: 600 },
  { type: "NAME_COLOR", name: "Púrpura real", rarity: "EPIC", color: "#7c4dff", unlock: "REQUIREMENT", requirement: "LEVEL", requirementValue: 20 },

  // Reações do chat (emoji animado; o admin também pode subir imagem/GIF)
  { type: "REACTION", name: "Amém", rarity: "COMMON", style: "🙏", unlock: "FREE" },
  { type: "REACTION", name: "Glória", rarity: "COMMON", style: "👏", unlock: "FREE" },
  { type: "REACTION", name: "Amor", rarity: "COMMON", style: "❤️", unlock: "FREE" },
  { type: "REACTION", name: "Fogo", rarity: "COMMON", style: "🔥", unlock: "FREE" },
  { type: "REACTION", name: "Paz", rarity: "RARE", style: "🕊️", unlock: "SHOP", priceCoins: 100 },
  { type: "REACTION", name: "Festa", rarity: "RARE", style: "🎉", unlock: "SHOP", priceCoins: 100 },
  { type: "REACTION", name: "Coroa", rarity: "EPIC", style: "👑", unlock: "SHOP", priceCoins: 200 },
  { type: "REACTION", name: "Brilho", rarity: "EPIC", style: "✨", unlock: "REWARD", inChestPool: true },
];

export async function ensureDefaultCosmetics(db: Db) {
  const existing = await db.cosmetic.findMany({ select: { type: true, name: true } });
  const has = new Set(existing.map((item) => `${item.type}:${item.name.toLocaleLowerCase("pt-BR")}`));
  const missing = DEFAULT_COSMETICS.filter((item) => !has.has(`${item.type}:${item.name.toLocaleLowerCase("pt-BR")}`));
  if (missing.length > 0) {
    await db.cosmetic.createMany({
      data: missing.map((item) => ({ ...item, system: true, sortOrder: DEFAULT_COSMETICS.indexOf(item) * 10 })),
      skipDuplicates: true,
    });
  }
}

/** Trilha padrão do passe (só criada quando ainda não existe nenhum degrau). */
export async function ensureDefaultPassTiers(db: Db) {
  if ((await db.passTier.count()) > 0) return;
  const reward = async (name: string) => (await db.rewardDefinition.findFirst({ where: { name }, select: { id: true } }))?.id ?? null;
  const title = await db.cosmetic.findFirst({ where: { type: "TITLE", name: "Peregrino da temporada" }, select: { id: true } });
  const tiers = [
    { level: 1, requiredXp: 200, rewardCoins: 50 },
    { level: 2, requiredXp: 600, rewardCoins: 0, rewardDefinitionId: await reward("Dica 50/50") },
    { level: 3, requiredXp: 1200, rewardCoins: 100 },
    { level: 4, requiredXp: 2000, rewardCoins: 0, rewardDefinitionId: await reward("Pular pergunta") },
    { level: 5, requiredXp: 3000, rewardCoins: 0, rewardDefinitionId: await reward("Pacote surpresa") },
    { level: 6, requiredXp: 4200, rewardCoins: 200 },
    { level: 7, requiredXp: 5600, rewardCoins: 0, rewardDefinitionId: await reward("Bênção dobrada") },
    { level: 8, requiredXp: 7200, rewardCoins: 300, rewardCosmeticId: title?.id ?? null },
  ];
  await db.passTier.createMany({ data: tiers.map((tier) => ({ ...tier, rewardCoins: tier.rewardCoins || (tier.rewardDefinitionId ? 0 : 50) })) });
}
