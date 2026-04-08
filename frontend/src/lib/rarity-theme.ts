import type { StickerRarity } from './admin-api';

export const rarityConfig: Record<
  StickerRarity,
  {
    label: string;
    background: string;
    border: string;
    badge: string;
    text: string;
  }
> = {
  COMMON: {
    label: 'Comum',
    background: 'bg-slate-50 dark:bg-slate-900/30',
    border: 'border-slate-300 dark:border-slate-700',
    badge: 'bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-slate-100',
    text: 'text-slate-700 dark:text-slate-300',
  },
  RARE: {
    label: 'Rara',
    background: 'bg-blue-50 dark:bg-blue-900/30',
    border: 'border-blue-300 dark:border-blue-700',
    badge: 'bg-blue-200 dark:bg-blue-700 text-blue-900 dark:text-blue-100',
    text: 'text-blue-700 dark:text-blue-300',
  },
  EPIC: {
    label: 'Épica',
    background: 'bg-purple-50 dark:bg-purple-900/30',
    border: 'border-purple-300 dark:border-purple-700',
    badge: 'bg-purple-200 dark:bg-purple-700 text-purple-900 dark:text-purple-100',
    text: 'text-purple-700 dark:text-purple-300',
  },
  LEGENDARY: {
    label: 'Lendária',
    background: 'bg-yellow-50 dark:bg-yellow-900/30',
    border: 'border-yellow-300 dark:border-yellow-700',
    badge: 'bg-yellow-200 dark:bg-yellow-700 text-yellow-900 dark:text-yellow-100',
    text: 'text-yellow-700 dark:text-yellow-300',
  },
};

export function getRarityLabel(rarity: StickerRarity): string {
  return rarityConfig[rarity].label;
}
