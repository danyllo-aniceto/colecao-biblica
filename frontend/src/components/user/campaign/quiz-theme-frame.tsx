import type { ReactNode } from 'react';
import { useCampaign } from '@/components/user/campaign/campaign-provider';

/** Veste a tela do quiz com as cores do cenário atual da campanha (display: contents não muda o layout). */
export function QuizThemeFrame({ children }: { children: ReactNode }) {
  const { themeStyle } = useCampaign();
  return (
    <div className="contents" style={themeStyle}>
      {children}
    </div>
  );
}
