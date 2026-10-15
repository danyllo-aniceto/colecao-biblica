import { useEffect, useMemo, useState } from 'react';
import { campaignLevels, SCENARIOS, type Scenario } from '@runner/campaign';
import type { Level } from '@runner/types';
import { getRunnerCampaign } from '@/lib/runner-api';

let cache: Scenario[] | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<(list: Scenario[]) => void>();

function load() {
  loading ??= getRunnerCampaign()
    .then((data) => {
      cache = data.scenarios.length > 0 ? data.scenarios : SCENARIOS;
    })
    .catch(() => {
      // Sem internet (ou erro): a campanha de partida; tenta de novo na próxima vez que a tela abrir.
      cache = cache ?? SCENARIOS;
    })
    .finally(() => {
      loading = null;
      listeners.forEach((listener) => listener(cache ?? SCENARIOS));
    });
  return loading;
}

/** Cenários e fases da campanha (do Painel; uma consulta por sessão, com a campanha de partida de reserva). */
export function useRunnerCampaign(): { scenarios: Scenario[]; levels: Level[] } {
  const [scenarios, setScenarios] = useState<Scenario[]>(cache ?? SCENARIOS);
  useEffect(() => {
    listeners.add(setScenarios);
    if (cache) setScenarios(cache);
    void load();
    return () => {
      listeners.delete(setScenarios);
    };
  }, []);
  // As fases saem da semente (determinístico): montar é barato e fica guardado enquanto a campanha não muda.
  const levels = useMemo(() => campaignLevels(scenarios), [scenarios]);
  return { scenarios, levels };
}
