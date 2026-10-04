import { useEffect, useMemo, useState } from 'react';
import { FREE_PAWNS, PAWN_NAMES } from '@board/engine';
import { getInventory } from '@/lib/rewards-api';

export type PawnOption = { value: string; name: string };

export const BASE_PAWNS: PawnOption[] = FREE_PAWNS.map((pawn) => ({ value: pawn, name: PAWN_NAMES[pawn] ?? pawn }));

/**
 * Peões que o jogador pode usar: os básicos (de todos) mais os que ele tem no armário (comprados, ganhos ou
 * cadastrados pelo painel, com emoji ou imagem). Carrega o inventário quando `active` fica verdadeiro.
 */
export function usePawnOptions(active: boolean): PawnOption[] {
  const [owned, setOwned] = useState<PawnOption[]>([]);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    getInventory()
      .then((inventory) => {
        if (!alive) return;
        setOwned(
          inventory.items
            .filter((item) => item.type === 'PAWN' && item.owned && (item.imageUrl || item.style))
            .map((item) => ({ value: (item.imageUrl || item.style) as string, name: item.name.replace(/^Peão:\s*/i, '') })),
        );
      })
      .catch(() => alive && setOwned([]));
    return () => {
      alive = false;
    };
  }, [active]);

  return useMemo(() => [...BASE_PAWNS, ...owned.filter((item) => !BASE_PAWNS.some((base) => base.value === item.value))], [owned]);
}
