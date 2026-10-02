import { useEffect, useState } from 'react';
import { listScenariosAdmin } from '@/lib/admin-campaign-api';

/** Cenários da campanha para os seletores do painel (busca todas as páginas uma vez). */
export function useScenarioOptions() {
  const [options, setOptions] = useState<Array<{ value: string; label: string }>>([]);
  useEffect(() => {
    let ignore = false;
    (async () => {
      const found: Array<{ value: string; label: string }> = [];
      for (let page = 0; page < 20; page += 1) {
        const response = await listScenariosAdmin({ page, size: 50 });
        found.push(...response.content.map((scenario) => ({ value: String(scenario.id), label: scenario.name })));
        if (page + 1 >= response.totalPages) break;
      }
      if (!ignore) setOptions(found);
    })().catch(() => undefined);
    return () => {
      ignore = true;
    };
  }, []);
  return options;
}
