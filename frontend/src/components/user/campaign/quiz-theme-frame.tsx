import type { ReactNode } from 'react';
import { useCampaign } from '@/components/user/campaign/campaign-provider';

/**
 * Veste a tela do quiz com as cores do cenário atual da campanha nos botões e superfícies
 * (display: contents não muda o layout). O fundo é só a imagem do cenário, sem ornamentos por cima.
 */
export function QuizThemeFrame({ children }: { children: ReactNode }) {
  const { themeStyle } = useCampaign();
  return (
    <div className="contents" style={themeStyle}>
      {children}
    </div>
  );
}
