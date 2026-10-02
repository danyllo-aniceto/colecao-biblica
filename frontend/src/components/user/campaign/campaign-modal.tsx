import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import CardGiftcardRoundedIcon from '@mui/icons-material/CardGiftcardRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { LoadingState } from '@/components/ui/spinner';
import { Tooltip } from '@/components/ui/tooltip';
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
  const ordered = [...scenario.nodes].sort((a, b) => a.level - b.level);
  const reached = ordered.filter((node) => node.state !== 'locked');

  return (
    // O mapa mantém a proporção 3:4 e cabe inteiro na altura que sobra na tela (unidades de container).
    <div
      className="relative aspect-[3/4] overflow-hidden rounded-3xl border-4 border-edge-strong shadow-lg"
      style={{ width: 'min(100cqw, 75cqh)', background: scenarioFallbackBackground(scenario.color) }}
    >
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

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Campanha em tela cheia: cada cenário ocupa a tela inteira e o jogador sobe e desce arrastando
 * (ou pelos botões ▲ ▼). A rolagem encaixa em cada mapa e a cor da tela acompanha o cenário.
 */
export function CampaignModal({ open, campaign, playerName, onClose, onChanged, onUserUpdate }: CampaignModalProps) {
  const toast = useToast();
  const scenarios = campaign?.scenarios ?? [];
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const positioned = useRef(false);
  const frame = useRef(0);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<CampaignNode | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [unlocked, setUnlocked] = useState<ClaimNodeResult | null>(null);

  const special = campaign?.special ?? null;
  const scenario = scenarios[active] ?? null;
  const selectedScenario = selected ? (scenarios.find((item) => item.nodes.some((node) => node.id === selected.id)) ?? null) : null;
  const liveSelected = selected && selectedScenario ? (selectedScenario.nodes.find((node) => node.id === selected.id) ?? selected) : selected;

  // Trava a rolagem da página de trás enquanto a campanha está aberta.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) positioned.current = false;
  }, [open]);

  // Ao abrir, vai direto (sem animação) para o cenário atual.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (!open || !campaign || !scroller || positioned.current) return;
    positioned.current = true;
    const index = Math.max(0, campaign.scenarios.findIndex((item) => item.id === campaign.currentScenarioId));
    scroller.scrollTo({ top: index * scroller.clientHeight, behavior: 'auto' });
    setActive(index);
  }, [open, campaign]);

  const goTo = useCallback((index: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const target = Math.max(0, Math.min(index, scenarios.length - 1));
    scroller.scrollTo({ top: target * scroller.clientHeight, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [scenarios.length]);

  function handleScroll() {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const scroller = scrollerRef.current;
      if (scroller && scroller.clientHeight > 0) setActive(Math.round(scroller.scrollTop / scroller.clientHeight));
    });
  }

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (selected || unlocked) return;
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowDown' || event.key === 'PageDown') {
        event.preventDefault();
        goTo(active + 1);
      } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        goTo(active - 1);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, selected, unlocked, active, goTo, onClose]);

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

  const arrow = 'flex h-12 w-12 items-center justify-center rounded-full bg-primary text-on-primary shadow-[0_4px_0_var(--primary-strong)] transition active:translate-y-0.5 active:shadow-none disabled:opacity-40 disabled:shadow-none';

  return (
    <>
      {open ? (
        <div role="dialog" aria-modal="true" aria-label="Campanha" style={scenario ? scenarioThemeVars(scenario.color) : undefined} className="fixed inset-0 z-[60] flex flex-col bg-bg transition-colors duration-700">
          <header className="flex shrink-0 items-center gap-3 border-b border-edge bg-surface/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl transition-colors duration-700">
            <Tooltip content="Fechar a campanha" side="bottom">
              <button type="button" onClick={onClose} aria-label="Fechar a campanha" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-3 text-muted transition hover:text-ink">
                <CloseRoundedIcon />
              </button>
            </Tooltip>
            <h2 className="font-display text-xl font-bold text-ink">Campanha</h2>
            {special ? (
              <div data-rarity={special.character.rarity} className="rarity ml-auto flex min-w-0 max-w-[55%] items-center gap-2 rounded-2xl border-2 border-r-special/50 bg-r-special/10 px-3 py-1.5">
                <StarRoundedIcon className="shrink-0 text-r-special" fontSize="small" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-ink">{special.owned ? `${special.character.name} conquistado!` : `Carta ${special.character.name}`}</p>
                  {special.owned ? null : <ProgressBar className="mt-1 h-1.5" value={(special.fragments / Math.max(special.totalFragments, 1)) * 100} color="var(--r-special)" />}
                </div>
                {special.owned ? null : (
                  <span className="shrink-0 text-xs font-bold text-muted">
                    {special.fragments}/{special.totalFragments}
                  </span>
                )}
              </div>
            ) : null}
          </header>

          {!campaign ? (
            <div className="flex flex-1 items-center justify-center">
              <LoadingState label="Carregando o caminho..." />
            </div>
          ) : scenarios.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState icon={<StarRoundedIcon />} title="A campanha ainda não começou">
                Em breve os cenários estarão disponíveis.
              </EmptyState>
            </div>
          ) : (
            <div className="relative min-h-0 flex-1">
              <div ref={scrollerRef} onScroll={handleScroll} tabIndex={0} aria-label="Cenários da campanha" className="h-full snap-y snap-mandatory overflow-y-auto overscroll-contain scroll-smooth outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {scenarios.map((item, index) => (
                  <section
                    key={item.id}
                    style={scenarioThemeVars(item.color)}
                    aria-label={item.name}
                    aria-hidden={index === active ? undefined : true}
                    className="flex h-full snap-start snap-always flex-col gap-3 bg-bg px-4 pb-4 pt-3"
                  >
                    <div className={cn('flex shrink-0 items-center gap-3 transition-all duration-500 ease-out', index === active ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0')}>
                      <ScenarioIcon scenario={item} size={52} />
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-display text-lg font-bold text-ink">{item.name}</h3>
                        <p className="truncate text-xs font-semibold text-muted">
                          {item.completed && item.verse ? `“${item.verse}”${item.verseReference ? ` — ${item.verseReference}` : ''}` : (item.description ?? '')}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <ProgressBar className="h-2 flex-1" value={(item.claimed / Math.max(item.total, 1)) * 100} />
                          <span className="shrink-0 text-[11px] font-bold text-muted">
                            {item.claimed}/{item.total}
                            {item.startLevel && item.endLevel ? ` · Nv ${item.startLevel}–${item.endLevel}` : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className={cn('flex min-h-0 flex-1 items-center justify-center transition-all duration-700 ease-out [container-type:size]', index === active ? 'scale-100 opacity-100' : 'scale-95 opacity-40')}>
                      <ScenarioMap scenario={item} onOpenNode={setSelected} />
                    </div>
                  </section>
                ))}
              </div>

              <nav aria-label="Navegar entre cenários" className="pointer-events-none absolute inset-y-0 right-3 flex flex-col items-center justify-center gap-3">
                <Tooltip content="Cenário anterior" side="bottom">
                  <button type="button" onClick={() => goTo(active - 1)} disabled={active <= 0} aria-label="Cenário anterior" className={cn(arrow, 'pointer-events-auto')}>
                    <KeyboardArrowUpRoundedIcon />
                  </button>
                </Tooltip>
                <ol className="pointer-events-auto flex flex-col items-center gap-1.5 rounded-full bg-surface/80 px-1.5 py-2 backdrop-blur">
                  {scenarios.map((item, index) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => goTo(index)}
                        aria-label={`Ir para ${item.name}`}
                        aria-current={index === active ? 'true' : undefined}
                        className={cn('block rounded-full transition-all duration-300', index === active ? 'h-5 w-2.5 bg-primary' : item.completed ? 'h-2.5 w-2.5 bg-success' : 'h-2.5 w-2.5 bg-edge-strong')}
                      />
                    </li>
                  ))}
                </ol>
                <Tooltip content="Próximo cenário" side="top">
                  <button type="button" onClick={() => goTo(active + 1)} disabled={active >= scenarios.length - 1} aria-label="Próximo cenário" className={cn(arrow, 'pointer-events-auto')}>
                    <KeyboardArrowDownRoundedIcon />
                  </button>
                </Tooltip>
              </nav>
            </div>
          )}
        </div>
      ) : null}

      <Modal
        open={liveSelected !== null}
        size="sm"
        title={liveSelected ? nodeTitle(liveSelected) : ''}
        description={liveSelected ? `Nível ${liveSelected.level}${selectedScenario ? ` · ${selectedScenario.name}` : ''}` : undefined}
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
          <div className="space-y-3">
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
