import type { ReactNode } from 'react';
import { ScenarioOrnaments } from '@/components/user/campaign/scenario-ornaments';
import { useCampaign } from '@/components/user/campaign/campaign-provider';

/**
 * Veste a tela do quiz com o cenário atual da campanha: cores nos botões e superfícies
 * (display: contents não muda o layout) e ornamentos nos cantos.
 */
export function QuizThemeFrame({ children }: { children: ReactNode }) {
  const { themeStyle, current } = useCampaign();
  return (
    <div className="contents" style={themeStyle}>
      {children}
      {current ? <ScenarioOrnaments scenario={current} /> : null}
    </div>
  );
}
