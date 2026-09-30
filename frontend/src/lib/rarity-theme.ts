import type { StickerRarity } from './admin-api';

export const RARITY_ORDER: StickerRarity[] = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];

const labels: Record<StickerRarity, string> = {
  COMMON: 'Comum',
  RARE: 'Rara',
  EPIC: 'Épica',
  LEGENDARY: 'Lendária',
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
};
