import { useEffect, useMemo, useState } from 'react';
import { FREE_PAWNS, PAWN_NAMES } from '@board/engine';
import { getInventory } from '@/lib/rewards-api';

export type PawnOption = { value: string; name: string };

export const BASE_PAWNS: PawnOption[] = FREE_PAWNS.map((pawn) => ({ value: pawn, name: PAWN_NAMES[pawn] ?? pawn }));

/**
 * Peões que o jogador pode usar: os do armário (os básicos grátis, que o painel pode editar, mais os comprados, ganhos
 * ou cadastrados, com emoji ou imagem). Se o armário não responder, valem os emojis básicos de fábrica.
 * Carrega o inventário quando `active` fica verdadeiro.
 */
export function usePawnOptions(active: boolean): PawnOption[] {
  const [owned, setOwned] = useState<PawnOption[]>([]);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    getInventory()
      .then((inventory) => {
        if (!alive) return;
        const options: PawnOption[] = [];
        for (const item of inventory.items) {
          const value = item.imageUrl || item.style;
          if (item.type !== 'PAWN' || !item.owned || !value || options.some((option) => option.value === value)) continue;
          options.push({ value, name: item.name.replace(/^Peão:\s*/i, '') });
        }
        setOwned(options);
      })
      .catch(() => alive && setOwned([]));
    return () => {
      alive = false;
    };
  }, [active]);

  return useMemo(() => (owned.length > 0 ? owned : BASE_PAWNS), [owned]);
}
