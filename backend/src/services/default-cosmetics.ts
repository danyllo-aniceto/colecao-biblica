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

/** Conjunto exclusivo do Baú de Esmeralda (entregue ao juntar todos os fragmentos da figurinha especial). */
export const EMERALD_SET_NAMES = ["Pastor das ovelhas", "Luz esmeralda", "Ovelha do Bom Pastor", "Verde celestial", "Luz da manhã"] as const;

/**
 * Itens visuais que já vêm no app. O admin pode editar, desativar e criar
 * outros; no deploy só são criados os que faltam (nada é sobrescrito).
 */
export const DEFAULT_COSMETICS: DefaultCosmetic[] = [
  // Conjunto exclusivo do Baú de Esmeralda (figurinha especial): só vem dele
  { type: "AVATAR", name: "Pastor das ovelhas", description: "Exclusivo do Baú de Esmeralda", rarity: "LEGENDARY", imageUrl: avatar("pastor"), unlock: "REWARD" },
  { type: "FRAME", name: "Luz esmeralda", description: "Exclusivo do Baú de Esmeralda", rarity: "LEGENDARY", style: "emerald", color: "#14b8a6", unlock: "REWARD" },
  { type: "TITLE", name: "Ovelha do Bom Pastor", description: "Exclusivo do Baú de Esmeralda", rarity: "LEGENDARY", color: "#14b8a6", style: "shimmer", unlock: "REWARD" },
  { type: "NAME_COLOR", name: "Verde celestial", description: "Exclusivo do Baú de Esmeralda", rarity: "LEGENDARY", color: "#14b8a6", unlock: "REWARD" },
  { type: "REACTION", name: "Luz da manhã", description: "Exclusivo do Baú de Esmeralda", rarity: "LEGENDARY", style: "🌅", unlock: "REWARD" },
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
  { type: "AVATAR", name: "Barquinho", rarity: "COMMON", imageUrl: avatar("barco"), unlock: "FREE" },
  { type: "AVATAR", name: "Pãozinho", rarity: "COMMON", imageUrl: avatar("pao"), unlock: "FREE" },
  { type: "AVATAR", name: "Sol da manhã", rarity: "COMMON", imageUrl: avatar("sol"), unlock: "SHOP", priceCoins: 150 },
  { type: "AVATAR", name: "Coração", rarity: "COMMON", imageUrl: avatar("coracao"), unlock: "SHOP", priceCoins: 150 },
  { type: "AVATAR", name: "Trigal", rarity: "RARE", imageUrl: avatar("trigo"), unlock: "SHOP", priceCoins: 300 },
  { type: "AVATAR", name: "Âncora da esperança", rarity: "RARE", imageUrl: avatar("ancora"), unlock: "SHOP", priceCoins: 350 },
  { type: "AVATAR", name: "Palavra", rarity: "RARE", imageUrl: avatar("livro"), unlock: "REQUIREMENT", requirement: "CORRECT_ANSWERS", requirementValue: 100 },
  { type: "AVATAR", name: "Ramo de oliveira", rarity: "RARE", imageUrl: avatar("oliveira"), unlock: "REWARD", inChestPool: true },
  { type: "AVATAR", name: "Vinha", rarity: "RARE", imageUrl: avatar("uvas"), unlock: "REQUIREMENT", requirement: "STICKERS", requirementValue: 30 },
  { type: "AVATAR", name: "Luz da noite", rarity: "RARE", imageUrl: avatar("lua"), unlock: "REQUIREMENT", requirement: "DAILY_STREAK", requirementValue: 7 },
  { type: "AVATAR", name: "Monte Sião", rarity: "EPIC", imageUrl: avatar("montanha"), unlock: "REQUIREMENT", requirement: "MATCHES", requirementValue: 100 },
  { type: "AVATAR", name: "Escudo da fé", rarity: "EPIC", imageUrl: avatar("escudo"), unlock: "SHOP", priceCoins: 700 },
  { type: "AVATAR", name: "Cálice", rarity: "EPIC", imageUrl: avatar("calice"), unlock: "REWARD", inChestPool: true },
  { type: "AVATAR", name: "Chaves do reino", rarity: "EPIC", imageUrl: avatar("chave"), unlock: "REQUIREMENT", requirement: "ACHIEVEMENTS", requirementValue: 10 },
  { type: "AVATAR", name: "Vela acesa", rarity: "EPIC", imageUrl: avatar("vela"), unlock: "REQUIREMENT", requirement: "DAILY_STREAK", requirementValue: 14 },
  { type: "AVATAR", name: "Leão de Judá", rarity: "LEGENDARY", imageUrl: avatar("leao"), unlock: "REQUIREMENT", requirement: "ALL_LEGENDARY" },
  { type: "AVATAR", name: "Cruz", rarity: "LEGENDARY", imageUrl: avatar("cruz"), unlock: "REWARD", inChestPool: true },
  // Peões do tabuleiro (os dez emojis básicos são de todos; estes vêm da loja e o painel pode trocar o emoji por uma imagem)
  { type: "PAWN", name: "Peão: Maçã do Éden", description: "Peão do tabuleiro", rarity: "COMMON", style: "🍎", unlock: "SHOP", priceCoins: 150 },
  { type: "PAWN", name: "Peão: Girafa da Arca", description: "Peão do tabuleiro", rarity: "COMMON", style: "🦒", unlock: "SHOP", priceCoins: 150 },
  { type: "PAWN", name: "Peão: Camelo de Canaã", description: "Peão do tabuleiro", rarity: "COMMON", style: "🐪", unlock: "SHOP", priceCoins: 150 },
  { type: "PAWN", name: "Peão: Rã do Egito", description: "Peão do tabuleiro", rarity: "COMMON", style: "🐸", unlock: "SHOP", priceCoins: 150 },
  { type: "PAWN", name: "Peão: Pedra do Sinai", description: "Peão do tabuleiro", rarity: "RARE", style: "🪨", unlock: "SHOP", priceCoins: 300 },
  { type: "PAWN", name: "Peão: Trombeta de Jericó", description: "Peão do tabuleiro", rarity: "RARE", style: "📯", unlock: "SHOP", priceCoins: 300 },
  { type: "PAWN", name: "Peão: Menorá do Templo", description: "Peão do tabuleiro", rarity: "RARE", style: "🕎", unlock: "SHOP", priceCoins: 300 },
  { type: "PAWN", name: "Peão: Muralha da Babilônia", description: "Peão do tabuleiro", rarity: "RARE", style: "🧱", unlock: "SHOP", priceCoins: 300 },
  { type: "PAWN", name: "Peão: Barco da Galileia", description: "Peão do tabuleiro", rarity: "EPIC", style: "⛵", unlock: "SHOP", priceCoins: 600 },
  { type: "PAWN", name: "Peão: Túmulo vazio", description: "Peão do tabuleiro", rarity: "EPIC", style: "⛰️", unlock: "SHOP", priceCoins: 600 },
  { type: "PAWN", name: "Peão: Troféu", description: "Vença 3 partidas online do Tabuleiro", rarity: "RARE", style: "🏆", unlock: "REQUIREMENT", requirement: "BOARD_WINS", requirementValue: 3 },
  { type: "PAWN", name: "Peão: Campeão", description: "Vença 15 partidas online do Tabuleiro", rarity: "EPIC", style: "🥇", unlock: "REQUIREMENT", requirement: "BOARD_WINS", requirementValue: 15 },
  { type: "AVATAR", name: "Aliança", rarity: "LEGENDARY", imageUrl: avatar("arcoiris"), unlock: "REQUIREMENT", requirement: "COLLECTIONS", requirementValue: 5 },

  // Molduras
  { type: "FRAME", name: "Madeira", rarity: "COMMON", style: "wood", color: "#a0693a", unlock: "SHOP", priceCoins: 150 },
  { type: "FRAME", name: "Prata", rarity: "RARE", style: "silver", color: "#c7cedd", unlock: "REQUIREMENT", requirement: "LEVEL", requirementValue: 5 },
  { type: "FRAME", name: "Esmeralda", rarity: "RARE", style: "solid", color: "#12b39a", unlock: "REWARD", inChestPool: true },
  { type: "FRAME", name: "Ouro", rarity: "EPIC", style: "gold", color: "#ffbf1f", unlock: "REQUIREMENT", requirement: "LEVEL", requirementValue: 15 },
  { type: "FRAME", name: "Chamas", rarity: "EPIC", style: "fire", color: "#ff6a3d", unlock: "REQUIREMENT", requirement: "DAILY_STREAK", requirementValue: 30 },
  { type: "FRAME", name: "Arco da aliança", rarity: "LEGENDARY", style: "rainbow", unlock: "REQUIREMENT", requirement: "ALBUM_COMPLETE" },
  { type: "FRAME", name: "Cobre", rarity: "COMMON", style: "copper", unlock: "SHOP", priceCoins: 200 },
  { type: "FRAME", name: "Gelo", rarity: "RARE", style: "ice", unlock: "SHOP", priceCoins: 450 },
  { type: "FRAME", name: "Entardecer", rarity: "RARE", style: "sunset", unlock: "REWARD", inChestPool: true },
  { type: "FRAME", name: "Louros", rarity: "RARE", style: "laurel", unlock: "REQUIREMENT", requirement: "MATCHES", requirementValue: 50 },
  { type: "FRAME", name: "Aurora", rarity: "EPIC", style: "aurora", unlock: "REQUIREMENT", requirement: "STICKERS", requirementValue: 50 },
  { type: "FRAME", name: "Neon", rarity: "EPIC", style: "neon", unlock: "SHOP", priceCoins: 900 },
  { type: "FRAME", name: "Realeza", rarity: "EPIC", style: "royal", unlock: "REQUIREMENT", requirement: "LEVEL", requirementValue: 25 },
  { type: "FRAME", name: "Céu estrelado", rarity: "LEGENDARY", style: "galaxy", unlock: "REWARD", inChestPool: true },
  { type: "FRAME", name: "Pérola", rarity: "LEGENDARY", style: "pearl", unlock: "REQUIREMENT", requirement: "PERFECT_MATCHES", requirementValue: 25 },
  { type: "FRAME", name: "Língua de fogo", rarity: "LEGENDARY", style: "pentecost", unlock: "REQUIREMENT", requirement: "LEAGUE_WINS", requirementValue: 5 },

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
  { type: "TITLE", name: "Aprendiz", rarity: "COMMON", color: "#2f8cff", style: "plain", unlock: "FREE" },
  { type: "TITLE", name: "Semeador", rarity: "COMMON", color: "#4aa13a", style: "plain", unlock: "SHOP", priceCoins: 200 },
  { type: "TITLE", name: "Sentinela", rarity: "RARE", color: "#5c6bc0", style: "glow", unlock: "REQUIREMENT", requirement: "DAILY_STREAK", requirementValue: 7 },
  { type: "TITLE", name: "Colecionador", rarity: "RARE", color: "#e0a030", style: "shimmer", unlock: "REQUIREMENT", requirement: "STICKERS", requirementValue: 50 },
  { type: "TITLE", name: "Mercador de figurinhas", rarity: "RARE", color: "#12b39a", style: "glow", unlock: "REQUIREMENT", requirement: "TRADES", requirementValue: 10 },
  { type: "TITLE", name: "Estudioso", rarity: "RARE", color: "#7c4dff", style: "wave", unlock: "REQUIREMENT", requirement: "CORRECT_ANSWERS", requirementValue: 300 },
  { type: "TITLE", name: "Voz que clama", rarity: "EPIC", color: "#ff8a3d", style: "shimmer", unlock: "SHOP", priceCoins: 800 },
  { type: "TITLE", name: "Escriba veloz", rarity: "EPIC", color: "#2fb8c9", style: "wave", unlock: "REQUIREMENT", requirement: "MATCHES", requirementValue: 200 },
  { type: "TITLE", name: "Sábio de Israel", rarity: "EPIC", color: "#b04fd8", style: "pulse", unlock: "REQUIREMENT", requirement: "CORRECT_ANSWERS", requirementValue: 2500 },
  { type: "TITLE", name: "Luz do mundo", rarity: "LEGENDARY", color: "#ffc83d", style: "shimmer", unlock: "REQUIREMENT", requirement: "ACHIEVEMENTS", requirementValue: 25 },

  // Cores do nome
  { type: "NAME_COLOR", name: "Celeste", rarity: "COMMON", color: "#2f8cff", unlock: "SHOP", priceCoins: 250 },
  { type: "NAME_COLOR", name: "Esmeralda", rarity: "COMMON", color: "#12b39a", unlock: "SHOP", priceCoins: 250 },
  { type: "NAME_COLOR", name: "Rubi", rarity: "RARE", color: "#e0324f", unlock: "REWARD", inChestPool: true },
  { type: "NAME_COLOR", name: "Dourado", rarity: "EPIC", color: "#d98f00", unlock: "SHOP", priceCoins: 600 },
  { type: "NAME_COLOR", name: "Púrpura real", rarity: "EPIC", color: "#7c4dff", unlock: "REQUIREMENT", requirement: "LEVEL", requirementValue: 20 },
  { type: "NAME_COLOR", name: "Oliva", rarity: "COMMON", color: "#6b8e23", unlock: "SHOP", priceCoins: 250 },
  { type: "NAME_COLOR", name: "Coral", rarity: "COMMON", color: "#ff6b5c", unlock: "SHOP", priceCoins: 250 },
  { type: "NAME_COLOR", name: "Mar Vermelho", rarity: "RARE", color: "#c2185b", unlock: "SHOP", priceCoins: 400 },
  { type: "NAME_COLOR", name: "Turquesa", rarity: "RARE", color: "#00acc1", unlock: "REWARD", inChestPool: true },
  { type: "NAME_COLOR", name: "Lavanda", rarity: "RARE", color: "#9575cd", unlock: "REQUIREMENT", requirement: "FRIENDS", requirementValue: 5 },
  { type: "NAME_COLOR", name: "Âmbar", rarity: "EPIC", color: "#ff8f00", unlock: "REQUIREMENT", requirement: "DAILY_STREAK", requirementValue: 21 },
  { type: "NAME_COLOR", name: "Safira", rarity: "EPIC", color: "#1e57d6", unlock: "REWARD", inChestPool: true },
  { type: "NAME_COLOR", name: "Rosa de Sarom", rarity: "EPIC", color: "#e91e8c", unlock: "SHOP", priceCoins: 700 },

  // Reações do chat (emoji animado; o admin também pode subir imagem/GIF)
  { type: "REACTION", name: "Amém", rarity: "COMMON", style: "🙏", unlock: "FREE" },
  { type: "REACTION", name: "Glória", rarity: "COMMON", style: "👏", unlock: "FREE" },
  { type: "REACTION", name: "Amor", rarity: "COMMON", style: "❤️", unlock: "FREE" },
  { type: "REACTION", name: "Fogo", rarity: "COMMON", style: "🔥", unlock: "FREE" },
  { type: "REACTION", name: "Paz", rarity: "RARE", style: "🕊️", unlock: "SHOP", priceCoins: 100 },
  { type: "REACTION", name: "Festa", rarity: "RARE", style: "🎉", unlock: "SHOP", priceCoins: 100 },
  { type: "REACTION", name: "Coroa", rarity: "EPIC", style: "👑", unlock: "SHOP", priceCoins: 200 },
  { type: "REACTION", name: "Brilho", rarity: "EPIC", style: "✨", unlock: "REWARD", inChestPool: true },
  { type: "REACTION", name: "Louvor", rarity: "COMMON", style: "🎶", unlock: "FREE" },
  { type: "REACTION", name: "Sorriso", rarity: "COMMON", style: "😊", unlock: "FREE" },
  { type: "REACTION", name: "Ideia", rarity: "COMMON", style: "💡", unlock: "SHOP", priceCoins: 80 },
  { type: "REACTION", name: "Sabedoria", rarity: "COMMON", style: "📖", unlock: "SHOP", priceCoins: 80 },
  { type: "REACTION", name: "Força", rarity: "RARE", style: "💪", unlock: "SHOP", priceCoins: 120 },
  { type: "REACTION", name: "Olhos de fé", rarity: "RARE", style: "🤩", unlock: "SHOP", priceCoins: 120 },
  { type: "REACTION", name: "Arco-íris", rarity: "RARE", style: "🌈", unlock: "REWARD", inChestPool: true },
  { type: "REACTION", name: "Barco", rarity: "RARE", style: "⛵", unlock: "SHOP", priceCoins: 150 },
  { type: "REACTION", name: "Leão", rarity: "EPIC", style: "🦁", unlock: "SHOP", priceCoins: 250 },
  { type: "REACTION", name: "Cordeiro", rarity: "EPIC", style: "🐑", unlock: "SHOP", priceCoins: 250 },
  { type: "REACTION", name: "Trombeta", rarity: "EPIC", style: "📯", unlock: "REWARD", inChestPool: true },
  { type: "REACTION", name: "Estrela cadente", rarity: "EPIC", style: "🌠", unlock: "REWARD", inChestPool: true },
  { type: "REACTION", name: "Anjo", rarity: "LEGENDARY", style: "😇", unlock: "REQUIREMENT", requirement: "LEVEL", requirementValue: 30 },
  { type: "REACTION", name: "Milagre", rarity: "LEGENDARY", style: "🌟", unlock: "REWARD", inChestPool: true },
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
  if ((await db.pass.count()) === 0) await db.pass.create({ data: { name: "Passe da temporada", description: "A trilha mensal de prêmios." } });
  if ((await db.passTier.count()) > 0) return;
  const pass = await db.pass.findFirstOrThrow({ orderBy: { id: "asc" } });
  const reward = async (name: string) => (await db.rewardDefinition.findFirst({ where: { name }, select: { id: true } }))?.id ?? null;
  const title = await db.cosmetic.findFirst({ where: { type: "TITLE", name: "Peregrino da temporada" }, select: { id: true } });
  const tiers = [
    { level: 1, requiredXp: 500, rewardCoins: 50 },
    { level: 2, requiredXp: 1500, rewardCoins: 0, rewardDefinitionId: await reward("Dica 50/50") },
    { level: 3, requiredXp: 3000, rewardCoins: 100 },
    { level: 4, requiredXp: 5000, rewardCoins: 0, rewardDefinitionId: await reward("Pular pergunta") },
    { level: 5, requiredXp: 7500, rewardCoins: 0, rewardDefinitionId: await reward("Pacote surpresa") },
    { level: 6, requiredXp: 10500, rewardCoins: 200 },
    { level: 7, requiredXp: 14000, rewardCoins: 0, rewardDefinitionId: await reward("Bênção dobrada") },
    { level: 8, requiredXp: 18000, rewardCoins: 300, rewardCosmeticId: title?.id ?? null },
  ];
  await db.passTier.createMany({ data: tiers.map((tier) => ({ ...tier, passId: pass.id, rewardCoins: tier.rewardCoins || (tier.rewardDefinitionId ? 0 : 50) })) });
}
