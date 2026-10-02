import type { StickerRarity } from './admin-api';

export const RARITY_ORDER: StickerRarity[] = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'SPECIAL'];

/** Raridades que podem sair em sorteio, pacote ou prêmio do painel (a especial só vem da campanha). */
export const DROP_RARITIES: StickerRarity[] = RARITY_ORDER.filter((rarity) => rarity !== 'SPECIAL');

const labels: Record<StickerRarity, string> = {
  COMMON: 'Comum',
  RARE: 'Rara',
  EPIC: 'Épica',
  LEGENDARY: 'Lendária',
  SPECIAL: 'Especial',
};

export function getRarityLabel(rarity: StickerRarity): string {
  return labels[rarity] ?? rarity;
}

/**
 * Classes por raridade. As cores vêm de `.rarity[data-rarity]` no globals.css;
 * use junto com `data-rarity={rarity}` e a classe `rarity` no mesmo elemento ou num ancestral.
 */
export const rarityConfig: Record<StickerRarity, { label: string; background: string; border: string; badge: string; text: string }> = {
  COMMON: { label: labels.COMMON, background: 'rarity-bg', border: 'rarity-frame', badge: 'rarity-chip', text: 'rarity-text' },
  RARE: { label: labels.RARE, background: 'rarity-bg', border: 'rarity-frame', badge: 'rarity-chip', text: 'rarity-text' },
  EPIC: { label: labels.EPIC, background: 'rarity-bg', border: 'rarity-frame', badge: 'rarity-chip', text: 'rarity-text' },
  LEGENDARY: { label: labels.LEGENDARY, background: 'rarity-bg', border: 'rarity-frame', badge: 'rarity-chip', text: 'rarity-text' },
  SPECIAL: { label: labels.SPECIAL, background: 'rarity-bg', border: 'rarity-frame', badge: 'rarity-chip', text: 'rarity-text' },
};
