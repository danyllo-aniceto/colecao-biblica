import { useState } from 'react';
import { cn } from '@/lib/cn';
import { ScenarioFallbackIcon, scenarioIconSrc } from '@/lib/campaign-theme';
import type { CampaignScenario } from '@/lib/campaign-api';

/** Ícone quadrado do cenário: usa a arte enviada e, na falta dela, um ícone padrão. */
export function ScenarioIcon({ scenario, size = 48, className }: { scenario: Pick<CampaignScenario, 'slug' | 'iconImageUrl'>; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary text-on-primary shadow-[0_3px_0_var(--primary-strong)]', className)}
      style={{ width: size, height: size }}
    >
      {failed ? (
        <ScenarioFallbackIcon slug={scenario.slug} fontSize={Math.round(size * 0.58)} />
      ) : (
        <img src={scenarioIconSrc(scenario)} alt="" draggable={false} className="h-full w-full object-cover" onError={() => setFailed(true)} />
      )}
    </span>
  );
}
