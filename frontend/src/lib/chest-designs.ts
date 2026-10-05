import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/http';
import type { ChestTierName } from '@/lib/user-api';

/** Visual de um baú cadastrado no painel (campos vazios usam o desenho padrão do app). */
export type ChestDesign = { tier: ChestTierName; imageUrl: string | null; openImageUrl: string | null; name: string | null; color: string | null };

export type ChestDesigns = Partial<Record<ChestTierName, ChestDesign>>;

let cache: ChestDesigns | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<(designs: ChestDesigns) => void>();

function publish(next: ChestDesigns) {
  cache = next;
  listeners.forEach((listener) => listener(next));
}

function load() {
  loading ??= apiRequest<ChestDesign[]>('/chests/designs', { method: 'GET' }, 'Não foi possível carregar o visual dos baús.')
    .then((list) => publish(Object.fromEntries(list.map((design) => [design.tier, design]))))
    .catch(() => publish({}))
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** Visual dos baús (cacheado: uma consulta por sessão). */
export function useChestDesigns(): ChestDesigns {
  const [designs, setDesigns] = useState<ChestDesigns>(cache ?? {});
  useEffect(() => {
    listeners.add(setDesigns);
    if (cache) setDesigns(cache);
    else void load();
    return () => {
      listeners.delete(setDesigns);
    };
  }, []);
  return designs;
}

/** Atualiza o cache depois de o admin salvar (o app todo passa a usar o novo visual). */
export function setChestDesign(design: ChestDesign) {
  publish({ ...(cache ?? {}), [design.tier]: design });
}

export function saveChestDesign(tier: ChestTierName, payload: { imageUrl: string | null; openImageUrl: string | null; name: string | null; color: string | null }) {
  return apiRequest<ChestDesign>(`/chests/admin/designs/${tier.toLowerCase()}`, { method: 'PUT', body: JSON.stringify(payload) }, 'Não foi possível salvar o visual do baú.');
}
