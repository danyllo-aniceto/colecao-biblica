import { useState } from 'react';
import { ScenarioFallbackIcon, scenarioIconSrc } from '@/lib/campaign-theme';
import type { CampaignScenario } from '@/lib/campaign-api';

/** Posição, tamanho (rem) e giro de cada ornamento; fica nos cantos para não cobrir a pergunta. */
const SPOTS = [
  { top: '4%', right: '-2rem', size: 9, rotate: 14 },
  { top: '30%', left: '-2.5rem', size: 7, rotate: -18 },
  { bottom: '22%', right: '-1.5rem', size: 6, rotate: -10 },
  { bottom: '3%', left: '8%', size: 8, rotate: 20 },
  { top: '58%', right: '10%', size: 3.5, rotate: 8 },
  { top: '12%', left: '14%', size: 3, rotate: -12 },
] as const;

function Ornament({ scenario, size }: { scenario: Pick<CampaignScenario, 'slug' | 'iconImageUrl'>; size: number }) {
  const [failed, setFailed] = useState(false);
  const px = `${size}rem`;
  return failed ? (
    <ScenarioFallbackIcon slug={scenario.slug} fontSize={size * 16} className="text-primary" />
  ) : (
    <img src={scenarioIconSrc(scenario)} alt="" draggable={false} style={{ width: px, height: px }} className="rounded-3xl object-cover" onError={() => setFailed(true)} />
  );
}

/**
 * Decoração do cenário por cima do quiz (sem capturar toques): ícones grandes e suaves nos cantos
 * e um tom de cor no rodapé, para a partida ter a cara do lugar.
 */
export function ScenarioOrnaments({ scenario }: { scenario: Pick<CampaignScenario, 'slug' | 'iconImageUrl'> }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[55] overflow-hidden">
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-primary/15 to-transparent" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/10 to-transparent" />
      {SPOTS.map(({ size, rotate, ...position }, index) => (
        <span key={index} className="absolute opacity-[0.1] dark:opacity-[0.14]" style={{ ...position, width: `${size}rem`, height: `${size}rem`, transform: `rotate(${rotate}deg)` }}>
          <Ornament scenario={scenario} size={size} />
        </span>
      ))}
    </div>
  );
}
