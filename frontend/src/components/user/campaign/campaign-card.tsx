import MapRoundedIcon from '@mui/icons-material/MapRounded';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/game/game-ui';
import { ScenarioIcon } from '@/components/user/campaign/scenario-art';
import { useCampaign } from '@/components/user/campaign/campaign-provider';
import { scenarioThemeVars } from '@/lib/campaign-theme';

/** Cartão da tela inicial: mostra o cenário atual e abre o mapa da campanha. */
export function CampaignCard() {
  const { campaign, current, claimable, open } = useCampaign();
  if (!campaign || !current) return null;

  return (
    <section style={scenarioThemeVars(current.color)} className="panel flex items-center gap-4 p-5">
      <ScenarioIcon scenario={current} size={64} />
      <div className="min-w-0 flex-1 space-y-1.5">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink">
          <MapRoundedIcon className="text-primary" fontSize="small" /> Campanha · {current.name}
        </h3>
        <ProgressBar className="h-2.5" value={(current.claimed / Math.max(current.total, 1)) * 100} />
        <p className="text-xs font-semibold text-muted">
          {claimable > 0 ? `${claimable} ${claimable === 1 ? 'recompensa pronta' : 'recompensas prontas'} para resgatar` : `${current.claimed}/${current.total} paradas · suba de nível para avançar`}
        </p>
      </div>
      <Button size="sm" variant={claimable > 0 ? 'primary' : 'secondary'} onClick={open}>
        {claimable > 0 ? 'Resgatar' : 'Ver mapa'}
      </Button>
    </section>
  );
}
