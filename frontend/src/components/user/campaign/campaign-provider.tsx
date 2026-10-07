import { createContext, useCallback, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { CampaignModal } from '@/components/user/campaign/campaign-modal';
import { getCampaign, type Campaign, type CampaignScenario } from '@/lib/campaign-api';
import { DEFAULT_XP_BANDS, type XpBand } from '@/components/game/game-ui';
import { scenarioThemeVars } from '@/lib/campaign-theme';
import type { UnlockedAchievement } from '@/lib/user-api';
import type { UserProfile } from '@/types/auth';

type CampaignContextValue = {
  campaign: Campaign | null;
  /** Cenário em que o jogador está agora. */
  current: CampaignScenario | null;
  /** Paradas já liberadas e ainda não resgatadas. */
  claimable: number;
  /** Variáveis de tema do cenário atual, para aplicar no quiz. */
  themeStyle: CSSProperties | undefined;
  /** Curva de XP por nível (custo por parada de cada cenário). */
  xpBands: XpBand[];
  open: () => void;
};

const CampaignContext = createContext<CampaignContextValue>({ campaign: null, current: null, claimable: 0, themeStyle: undefined, xpBands: DEFAULT_XP_BANDS, open: () => undefined });

export const useCampaign = () => useContext(CampaignContext);

/**
 * Guarda a campanha do jogador e o mapa (aberto ao tocar no nível ou no cartão da tela inicial).
 * Recarrega quando o nível muda, porque novas paradas se abrem.
 */
export function CampaignProvider({
  level,
  xp,
  playerName,
  onUserUpdate,
  children,
}: {
  level: number;
  /** XP total acumulado do jogador (para mostrar quanto falta até cada parada). */
  xp: number;
  playerName: string;
  onUserUpdate: (user: UserProfile, achievements: UnlockedAchievement[]) => void;
  children: ReactNode;
}) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    getCampaign()
      .then(setCampaign)
      .catch(() => undefined);
  }, []);

  useEffect(load, [load, level]);

  const value = useMemo<CampaignContextValue>(() => {
    const current = campaign?.scenarios.find((scenario) => scenario.id === campaign.currentScenarioId) ?? null;
    const claimable = campaign?.scenarios.reduce((sum, scenario) => sum + scenario.nodes.filter((node) => node.state === 'available').length, 0) ?? 0;
    return { campaign, current, claimable, themeStyle: current ? scenarioThemeVars(current.color) : undefined, xpBands: campaign?.xpBands ?? DEFAULT_XP_BANDS, open: () => setOpen(true) };
  }, [campaign]);

  return (
    <CampaignContext.Provider value={value}>
      {children}
      <CampaignModal open={open} campaign={campaign} xp={xp} playerName={playerName} onClose={() => setOpen(false)} onChanged={load} onUserUpdate={onUserUpdate} />
    </CampaignContext.Provider>
  );
}
