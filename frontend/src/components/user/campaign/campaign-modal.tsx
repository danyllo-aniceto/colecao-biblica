import { useEffect, useRef, useState } from 'react';
import CardGiftcardRoundedIcon from '@mui/icons-material/CardGiftcardRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { LoadingState } from '@/components/ui/spinner';
import { errorMessage, useToast } from '@/components/ui/toast';
import { Alert, CoinIcon, EmptyState, ProgressBar } from '@/components/game/game-ui';
import { StickerCard } from '@/components/game/sticker-card';
import { CosmeticPreview } from '@/components/user/rewards/cosmetic-preview';
import { ScenarioIcon } from '@/components/user/campaign/scenario-art';
import { cn } from '@/lib/cn';
import { claimCampaignNode, type Campaign, type CampaignNode, type CampaignScenario, type ClaimNodeResult } from '@/lib/campaign-api';
import { scenarioFallbackBackground, scenarioMapSrc, scenarioThemeVars } from '@/lib/campaign-theme';
import { rewardVisual } from '@/lib/reward-visual';
import type { UnlockedAchievement } from '@/lib/user-api';
import type { UserProfile } from '@/types/auth';

/** Curva suave ligando as paradas, de baixo para cima. */
function pathBetween(nodes: CampaignNode[]) {
  return nodes
    .map((node, index) => {
      if (index === 0) return `M ${node.x} ${node.y}`;
      const previous = nodes[index - 1];
      const middle = (previous.y + node.y) / 2;
      return `C ${previous.x} ${middle}, ${node.x} ${middle}, ${node.x} ${node.y}`;
    })
    .join(' ');
}

function nodeTitle(node: CampaignNode) {
  return node.title ?? (node.relic ? 'Relíquia do cenário' : `Parada do nível ${node.level}`);
}

function NodeButton({ node, onOpen }: { node: CampaignNode; onOpen: (node: CampaignNode) => void }) {
  const size = node.relic ? 'h-14 w-14' : 'h-11 w-11';
  return (
    <button
      type="button"
      onClick={() => onOpen(node)}
      aria-label={`${nodeTitle(node)}, nível ${node.level}, ${node.state === 'claimed' ? 'resgatada' : node.state === 'available' ? 'pronta para resgatar' : 'bloqueada'}`}
      className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 focus-visible:outline-none"
      style={{ left: `${node.x}%`, top: `${node.y}%` }}
    >
      <span
        className={cn(
          'relative flex items-center justify-center rounded-full border-4 font-display font-bold shadow-lg transition-transform group-hover:scale-110 group-focus-visible:ring-4 group-focus-visible:ring-primary/50',
          size,
          node.state === 'claimed' && 'border-white bg-success text-white',
          node.state === 'available' && 'animate-pulse border-white bg-primary text-on-primary ring-4 ring-primary/40',
          node.state === 'locked' && 'border-white/70 bg-surface-3 text-muted',
        )}
      >
        {node.state === 'claimed' ? <CheckRoundedIcon /> : node.state === 'available' ? (node.relic ? <StarRoundedIcon /> : <CardGiftcardRoundedIcon />) : node.relic ? <StarRoundedIcon className="opacity-60" /> : <LockRoundedIcon fontSize="small" />}
      </span>
      <span className="rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-bold text-white">Nv {node.level}</span>
    </button>
  );
}

function ScenarioMap({ scenario, onOpenNode }: { scenario: CampaignScenario; onOpenNode: (node: CampaignNode) => void }) {
  const [mapFailed, setMapFailed] = useState(false);
  useEffect(() => setMapFailed(false), [scenario.id]);
  const ordered = [...scenario.nodes].sort((a, b) => a.level - b.level);
  const reached = ordered.filter((node) => node.state !== 'locked');

  return (
    <div className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-3xl border-4 border-edge-strong shadow-lg" style={{ background: scenarioFallbackBackground(scenario.color) }}>
      {!mapFailed ? <img src={scenarioMapSrc(scenario)} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" onError={() => setMapFailed(true)} /> : null}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <path d={pathBetween(ordered)} fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="2.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        <path d={pathBetween(ordered)} fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="1.6" strokeDasharray="1 3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {reached.length > 1 ? <path d={pathBetween(reached)} fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" /> : null}
      </svg>
      {ordered.map((node) => (
        <NodeButton key={node.id} node={node} onOpen={onOpenNode} />
      ))}
    </div>
  );
}

function RewardLines({ node, playerName }: { node: CampaignNode; playerName: string }) {
  return (
    <ul className="space-y-2">
      {node.rewardCoins > 0 ? (
        <li className="flex items-center gap-3 rounded-2xl bg-primary/15 p-3">
          <CoinIcon className="h-7 w-7" />
          <span className="font-display font-bold text-ink">+{node.rewardCoins} moedas</span>
        </li>
      ) : null}
      {node.reward ? (
        <li className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
          <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', rewardVisual(node.reward.rewardType, 22).tint)}>{rewardVisual(node.reward.rewardType, 22).icon}</span>
          <span className="font-display font-bold text-ink">{node.reward.name}</span>
        </li>
      ) : null}
      {node.cosmetic ? (
        <li data-rarity={node.cosmetic.rarity} className="rarity rarity-bg flex items-center gap-3 rounded-2xl p-3">
          <span className="flex max-w-[11rem] items-center">
            <CosmeticPreview item={node.cosmetic} playerName={playerName} size="md" />
          </span>
          {node.cosmetic.type === 'TITLE' ? <span className="text-xs font-semibold text-muted">Título exclusivo</span> : <span className="font-display font-bold text-ink">{node.cosmetic.name}</span>}
        </li>
      ) : null}
      {node.fragment ? (
        <li className="flex items-center gap-3 rounded-2xl bg-r-special/15 p-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-r-special text-white">
            <StarRoundedIcon />
          </span>
          <span className="font-display font-bold text-ink">1 fragmento da carta especial</span>
        </li>
      ) : null}
    </ul>
  );
}

type CampaignModalProps = {
  open: boolean;
  campaign: Campaign | null;
  playerName: string;
  onClose: () => void;
  onChanged: () => void;
  onUserUpdate: (user: UserProfile, achievements: UnlockedAchievement[]) => void;
};

/** Mapa da campanha: um cenário por página, com o caminho e as paradas liberadas pelo nível. */
export function CampaignModal({ open, campaign, playerName, onClose, onChanged, onUserUpdate }: CampaignModalProps) {
  const toast = useToast();
  const scenarios = campaign?.scenarios ?? [];
  const paging = usePagination(scenarios, 1);
  const positioned = useRef(false);
  const [selected, setSelected] = useState<CampaignNode | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [unlocked, setUnlocked] = useState<ClaimNodeResult | null>(null);

  // Ao abrir, vai direto para o cenário atual.
  useEffect(() => {
    if (!open) {
      positioned.current = false;
      return;
    }
    if (positioned.current || !campaign) return;
    positioned.current = true;
    const index = campaign.scenarios.findIndex((scenario) => scenario.id === campaign.currentScenarioId);
    paging.setPage(Math.max(0, index));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, campaign]);

  const scenario = paging.pageItems[0] ?? null;
  const special = campaign?.special ?? null;
  const liveSelected = selected && scenario ? (scenario.nodes.find((node) => node.id === selected.id) ?? selected) : selected;

  async function claim(node: CampaignNode) {
    setClaiming(true);
    try {
      const result = await claimCampaignNode(node.id);
      onUserUpdate(result.user, result.unlockedAchievements);
      onChanged();
      setSelected(null);
      if (result.specialUnlocked) {
        setUnlocked(result);
      } else {
        toast.success(`${nodeTitle(node)} resgatada!`, {
          description: [
            result.coins ? `+${result.coins} moedas` : null,
            result.reward?.characterName ?? result.reward?.rewardName,
            result.cosmeticGranted ? result.cosmeticName : null,
            result.fragments ? `Fragmentos: ${result.fragments.claimed}/${result.fragments.total}` : null,
          ]
            .filter(Boolean)
            .join(' · '),
        });
      }
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setClaiming(false);
    }
  }

  return (
    <>
      <Modal open={open} size="lg" title="Campanha" description="Suba de nível para abrir o caminho e ganhar as recompensas de cada cenário." onClose={onClose}>
        {!campaign ? (
          <LoadingState label="Carregando o caminho..." />
        ) : scenarios.length === 0 ? (
          <EmptyState icon={<StarRoundedIcon />} title="A campanha ainda não começou">
            Em breve os cenários estarão disponíveis.
          </EmptyState>
        ) : (
          <div className="space-y-4">
            {special ? (
              <section data-rarity={special.character.rarity} className="rarity flex items-center gap-4 rounded-3xl border-2 border-r-special/50 bg-r-special/10 p-3">
                <div className="w-16 shrink-0">
                  <StickerCard name={special.character.name} rarity={special.character.rarity} imageUrl={special.character.imageUrl} owned={special.owned} size="sm" />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <h3 className="font-display text-base font-bold text-ink">Carta especial: {special.character.name}</h3>
                  {special.owned ? (
                    <p className="text-sm font-semibold text-success-strong dark:text-success">Conquistada! Única e intransferível.</p>
                  ) : (
                    <>
                      <ProgressBar value={(special.fragments / Math.max(special.totalFragments, 1)) * 100} color="var(--r-special)" />
                      <p className="text-xs font-semibold text-muted">
                        {special.fragments}/{special.totalFragments} fragmentos · um por relíquia de cenário
                      </p>
                    </>
                  )}
                </div>
              </section>
            ) : null}

            {scenario ? (
              <section style={scenarioThemeVars(scenario.color)} className="space-y-4 rounded-3xl bg-bg p-3 sm:p-4">
                <header className="flex items-center gap-3">
                  <ScenarioIcon scenario={scenario} size={56} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-display text-xl font-bold text-ink">{scenario.name}</h3>
                    <p className="text-xs font-semibold text-muted">
                      {scenario.startLevel && scenario.endLevel ? `Níveis ${scenario.startLevel} a ${scenario.endLevel} · ` : ''}
                      {scenario.claimed}/{scenario.total} paradas
                    </p>
                    <ProgressBar className="mt-1 h-2" value={(scenario.claimed / Math.max(scenario.total, 1)) * 100} />
                  </div>
                </header>
                {scenario.description ? <p className="text-sm text-muted">{scenario.description}</p> : null}

                <ScenarioMap scenario={scenario} onOpenNode={setSelected} />

                {scenario.completed && scenario.verse ? (
                  <Alert tone="success">
                    <span className="font-semibold">“{scenario.verse}”</span>
                    {scenario.verseReference ? <span className="ml-1">— {scenario.verseReference}</span> : null}
                  </Alert>
                ) : null}
              </section>
            ) : null}

            <Pagination page={paging.page} totalPages={paging.totalPages} totalElements={paging.totalElements} pageSize={1} onPageChange={paging.setPage} itemLabel="cenários" />
          </div>
        )}
      </Modal>

      <Modal
        open={liveSelected !== null}
        size="sm"
        title={liveSelected ? nodeTitle(liveSelected) : ''}
        description={liveSelected ? `Nível ${liveSelected.level}${scenario ? ` · ${scenario.name}` : ''}` : undefined}
        onClose={() => (claiming ? undefined : setSelected(null))}
        footer={
          liveSelected ? (
            liveSelected.state === 'available' ? (
              <Button onClick={() => void claim(liveSelected)} loading={claiming}>
                Resgatar
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setSelected(null)}>
                Fechar
              </Button>
            )
          ) : null
        }
      >
        {liveSelected ? (
          <div className="space-y-3" style={scenario ? scenarioThemeVars(scenario.color) : undefined}>
            {liveSelected.state === 'locked' ? <Alert tone="info">Chegue ao nível {liveSelected.level} para abrir esta parada.</Alert> : null}
            {liveSelected.state === 'claimed' ? <Alert tone="success">Você já resgatou esta parada.</Alert> : null}
            <RewardLines node={liveSelected} playerName={playerName} />
          </div>
        ) : null}
      </Modal>

      <Modal
        open={unlocked !== null}
        size="sm"
        title="Carta especial conquistada!"
        onClose={() => setUnlocked(null)}
        footer={<Button onClick={() => setUnlocked(null)}>Continuar</Button>}
      >
        {unlocked?.special && special ? (
          <div className="space-y-4 text-center">
            <div className="animate-pop-in mx-auto w-48">
              <StickerCard name={unlocked.special.name} rarity={special.character.rarity} imageUrl={unlocked.special.imageUrl} owned size="lg" />
            </div>
            <p className="font-display text-lg font-semibold text-ink">Você juntou todos os fragmentos de {unlocked.special.name}!</p>
            <p className="text-sm text-muted">Esta carta é única: não pode ser trocada nem vendida.</p>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
