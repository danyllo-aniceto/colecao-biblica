import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import CardGiftcardRoundedIcon from '@mui/icons-material/CardGiftcardRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import MusicNoteRoundedIcon from '@mui/icons-material/MusicNoteRounded';
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
import { claimCampaignNode, claimStone, type Campaign, type CampaignNode, type CampaignScenario, type ClaimNodeResult, type ClaimStoneResult, type Stone } from '@/lib/campaign-api';
import { BreastplateModal, StoneGem, StonePage } from '@/components/user/campaign/breastplate';
import { BadgeMark } from '@/components/game/player-look';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import { scenarioFallbackBackground, scenarioMapSrc, scenarioThemeVars } from '@/lib/campaign-theme';
import { playSfx } from '@/lib/sound/sfx';
import { rewardVisual } from '@/lib/reward-visual';
import { ChestIcon, ChestOpening } from '@/components/user/chest-opening';
import { DEFAULT_XP_BANDS, xpForLevel } from '@/components/game/game-ui';
import { getRarityLabel } from '@/lib/rarity-theme';
import HourglassTopRoundedIcon from '@mui/icons-material/HourglassTopRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
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

function RewardLines({ node, playerName, music }: { node: CampaignNode; playerName: string; music?: string | null }) {
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
      {node.avatar ? (
        <li data-rarity={node.avatar.rarity} className="rarity rarity-bg flex items-center gap-3 rounded-2xl p-3">
          <CosmeticPreview item={node.avatar} playerName={playerName} size="md" />
          <span className="font-display font-bold text-ink">Ícone de perfil do cenário</span>
        </li>
      ) : null}
      {music ? (
        <li className="flex items-center gap-3 rounded-2xl bg-violet/10 p-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet text-white">
            <MusicNoteRoundedIcon />
          </span>
          <span className="min-w-0">
            <span className="block font-display font-bold text-ink">Música do tema</span>
            <span className="block text-xs font-semibold text-muted">{music}: toca no quiz e no jogo quando você chega aqui</span>
          </span>
        </li>
      ) : null}
      {node.fragment ? (
        <li className="flex items-center gap-3 rounded-2xl bg-r-special/15 p-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-r-special text-white">
            <StarRoundedIcon />
          </span>
          <span className="font-display font-bold text-ink">1 fragmento da figurinha especial</span>
        </li>
      ) : null}
    </ul>
  );
}

const pageShell = 'relative flex h-full snap-start snap-always flex-col items-center overflow-y-auto bg-bg px-4 pb-6 pt-4';

/** Última página, no alto do caminho: aviso de que novos cenários vêm por aí. */
function SoonPage({ active }: { active: boolean }) {
  return (
    <section aria-label="Novos cenários em breve" aria-hidden={active ? undefined : true} className={cn(pageShell, 'justify-center text-center')}>
      <div className={cn('max-w-xs space-y-3 transition-all duration-700', active ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0')}>
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 text-primary-strong dark:text-primary">
          <HourglassTopRoundedIcon sx={{ fontSize: 44 }} />
        </span>
        <h3 className="font-display text-2xl font-bold text-ink">Novos cenários em breve!</h3>
        <p className="text-sm font-semibold text-muted">A jornada continua: a equipe está preparando as próximas paradas da campanha. Volte em breve para seguir adiante.</p>
      </div>
    </section>
  );
}

/** Depois de Jerusalém: o prêmio final, ainda bloqueado (Baú de Esmeralda e a figurinha especial). */
function FinalePage({ campaign, special, playerName, active }: { campaign: Campaign; special: NonNullable<Campaign['special']>; playerName: string; active: boolean }) {
  const chest = campaign.emeraldChest;
  const left = Math.max(special.totalFragments - special.fragments, 0);
  return (
    <section aria-label="Prêmio final da campanha" aria-hidden={active ? undefined : true} className={pageShell}>
      <div className={cn('my-auto w-full max-w-md space-y-4 transition-all duration-700', active ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0')}>
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-r-special">{special.owned ? 'Conquistado' : 'Prêmio final'}</p>
          <h3 className="font-display text-2xl font-bold text-ink">Figurinha especial de {special.character.name}</h3>
          <p className="mt-1 text-sm font-semibold text-muted">
            {special.owned ? 'Você juntou todos os fragmentos!' : `Junte os ${special.totalFragments} fragmentos espalhados pelas paradas (faltam ${left}) para abrir o baú e conquistar esta figurinha.`}
          </p>
        </div>

        <div className="flex items-center justify-center gap-5">
          <div className="w-32 shrink-0">
            <StickerCard name={special.character.name} rarity={special.character.rarity} imageUrl={special.character.imageUrl} owned={special.owned} size="sm" />
          </div>
          <div className="relative flex w-32 shrink-0 flex-col items-center">
            <ChestIcon tier="EMERALD" className={cn('h-28 w-32 drop-shadow-xl', special.owned ? '' : 'opacity-70 grayscale-[40%]')} />
            {special.owned ? null : (
              <span className="absolute right-2 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-surface-3 text-muted shadow">
                <LockRoundedIcon fontSize="small" />
              </span>
            )}
            <span className="mt-1 font-display text-sm font-bold text-ink">Baú de Esmeralda</span>
          </div>
        </div>
        {special.owned ? null : <ProgressBar className="h-3" value={(special.fragments / Math.max(special.totalFragments, 1)) * 100} color="var(--r-special)" />}

        <div className="panel space-y-2 p-4">
          <p className="flex items-center gap-2 font-display font-bold text-ink">
            <Inventory2RoundedIcon fontSize="small" className="text-r-special" /> O que vem no baú
          </p>
          <ul className="space-y-1.5 text-sm font-semibold text-ink">
            <li className="flex items-center gap-2">
              <CoinIcon className="h-5 w-5" /> {chest.coins.toLocaleString('pt-BR')} moedas
            </li>
            <li>{chest.helpers} ajudas sortidas</li>
            <li>1 figurinha {chest.stickerRarities.map((rarity) => getRarityLabel(rarity).toLowerCase()).join(' e 1 ')}</li>
            <li>A figurinha especial de {special.character.name}</li>
          </ul>
          {chest.cosmetics.length > 0 ? (
            <div className="space-y-1.5 pt-1">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Conjunto de itens visuais exclusivo</p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {chest.cosmetics.map((item) => (
                  <div key={item.id} data-rarity={item.rarity} className="rarity rarity-bg flex items-center gap-2 rounded-xl p-2">
                    <CosmeticPreview item={item} playerName={playerName} size="md" />
                    {item.type === 'TITLE' ? null : <span className="min-w-0 truncate text-xs font-bold text-ink">{item.name}</span>}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

type CampaignPage = { kind: 'soon' } | { kind: 'finale' } | { kind: 'stone'; stone: Stone } | { kind: 'scenario'; scenario: CampaignScenario };

type CampaignModalProps = {
  open: boolean;
  campaign: Campaign | null;
  /** XP total acumulado do jogador. */
  xp: number;
  playerName: string;
  onClose: () => void;
  onChanged: () => void;
  onUserUpdate: (user: UserProfile, achievements: UnlockedAchievement[]) => void;
};

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Campanha em tela cheia: cada cenário ocupa a tela inteira e o jogador sobe e desce arrastando
 * (ou pelos botões ▲ ▼), do primeiro cenário embaixo ao último em cima. A rolagem encaixa em cada mapa e a cor da tela acompanha o cenário.
 */
export function CampaignModal({ open, campaign, xp, playerName, onClose, onChanged, onUserUpdate }: CampaignModalProps) {
  const toast = useToast();
  const xpBands = campaign?.xpBands ?? DEFAULT_XP_BANDS;
  // Subida: o primeiro cenário fica embaixo e os seguintes vão aparecendo para cima.
  const scenarios = useMemo(() => [...(campaign?.scenarios ?? [])].reverse(), [campaign]);
  // Páginas de cima para baixo: aviso de novidades; depois, na ordem do caminho invertida, os cenários com o prêmio de Jesus
  // logo acima do último cenário de lançamento e a pedra do Peitoral logo acima do último cenário do grupo dela.
  const pages = useMemo<CampaignPage[]>(() => {
    const ascending = campaign?.scenarios ?? [];
    const withFragment = ascending.map((item, index) => (item.nodes.some((node) => node.fragment) ? index : -1)).filter((index) => index >= 0);
    const finaleAfter = campaign?.special && withFragment.length > 0 ? withFragment[withFragment.length - 1] : -1;
    const lastOfStone = new Map<number, number>();
    ascending.forEach((item, index) => {
      if (item.stoneId) lastOfStone.set(item.stoneId, index);
    });
    const built: CampaignPage[] = [];
    ascending.forEach((item, index) => {
      built.push({ kind: 'scenario', scenario: item });
      if (index === finaleAfter) built.push({ kind: 'finale' });
      const stone = item.stoneId && lastOfStone.get(item.stoneId) === index ? campaign?.breastplate.stones.find((entry) => entry.id === item.stoneId) : undefined;
      if (stone) built.push({ kind: 'stone', stone });
    });
    return [{ kind: 'soon' }, ...built.reverse()];
  }, [campaign]);
  const pageCount = pages.length;
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const positioned = useRef(false);
  const frame = useRef(0);
  const [active, setActive] = useState(0);
  const [selected, setSelected] = useState<CampaignNode | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [unlocked, setUnlocked] = useState<ClaimNodeResult | null>(null);
  // Baú de Esmeralda: abre primeiro; depois aparece o aviso da figurinha especial.
  const [emerald, setEmerald] = useState<ClaimNodeResult | null>(null);

  const special = campaign?.special ?? null;
  const activePage = pages[active];
  // Cor do tema da tela: do cenário (ou da pedra) da página em foco.
  const themeColor = activePage?.kind === 'scenario' ? activePage.scenario.color : activePage?.kind === 'stone' ? activePage.stone.color : (scenarios[0]?.color ?? null);
  const [stoneClaiming, setStoneClaiming] = useState<number | null>(null);
  const [stoneWon, setStoneWon] = useState<{ stone: Stone; result: ClaimStoneResult } | null>(null);
  const [peitoral, setPeitoral] = useState(false);
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
    const index = Math.max(0, pages.findIndex((page) => page.kind === 'scenario' && page.scenario.id === campaign.currentScenarioId));
    // 'instant' ignora o scroll-smooth do CSS; com 'auto' a abertura rolaria do topo até o cenário.
    scroller.scrollTo({ top: index * scroller.clientHeight, behavior: 'instant' });
    setActive(index);
  }, [open, campaign, pages]);

  // Whoosh a cada cenário que passa (arrastando ou pelas setas).
  const previousActive = useRef(active);
  useEffect(() => {
    if (open && previousActive.current !== active) playSfx('swipe');
    previousActive.current = active;
  }, [active, open]);

  const goTo = useCallback((index: number) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const target = Math.max(0, Math.min(index, pageCount - 1));
    scroller.scrollTo({ top: target * scroller.clientHeight, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [pageCount]);

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
      if (selected || unlocked || emerald) return;
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
  }, [open, selected, unlocked, emerald, active, goTo, onClose]);

  async function claim(node: CampaignNode) {
    setClaiming(true);
    try {
      const result = await claimCampaignNode(node.id);
      onUserUpdate(result.user, result.unlockedAchievements);
      onChanged();
      setSelected(null);
      if (result.specialUnlocked) {
        if (result.emeraldChest?.prizes.length) setEmerald(result);
        else setUnlocked(result);
      } else {
        toast.success(`${nodeTitle(node)} resgatada!`, {
          description: [
            result.coins ? `+${result.coins} moedas` : null,
            result.reward?.characterName ?? result.reward?.rewardName,
            result.cosmeticGranted ? result.cosmeticName : null,
            result.avatarGranted ? 'Ícone de perfil novo' : null,
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

  async function claimStoneAction(stone: Stone) {
    setStoneClaiming(stone.id);
    try {
      const result = await claimStone(stone.id);
      onUserUpdate(result.user, result.unlockedAchievements);
      onChanged();
      setPeitoral(false);
      setStoneWon({ stone, result });
    } catch (reason) {
      toast.error(errorMessage(reason));
    } finally {
      setStoneClaiming(null);
    }
  }

  const arrow = 'flex h-9 w-9 items-center justify-center rounded-full bg-primary text-on-primary shadow-[0_3px_0_var(--primary-strong)] transition active:translate-y-0.5 active:shadow-none disabled:opacity-40 disabled:shadow-none';

  return (
    <>
      {open ? (
        <div role="dialog" aria-modal="true" aria-label="Campanha" style={themeColor ? scenarioThemeVars(themeColor) : undefined} className="fixed inset-0 z-[60] flex flex-col bg-bg transition-colors duration-700">
          <header className="flex shrink-0 items-center gap-3 border-b border-edge bg-surface/80 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl transition-colors duration-700">
            <Tooltip content="Fechar a campanha" side="bottom">
              <button type="button" onClick={onClose} aria-label="Fechar a campanha" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-3 text-muted transition hover:text-ink">
                <CloseRoundedIcon />
              </button>
            </Tooltip>
            <h2 className="font-display text-xl font-bold text-ink">Campanha</h2>
            {campaign && campaign.breastplate.total > 0 ? (
              <Tooltip content="Peitoral do Sumo Sacerdote" side="bottom">
                <button type="button" onClick={() => setPeitoral(true)} aria-label={`Abrir o Peitoral: ${campaign.breastplate.claimed} de ${campaign.breastplate.total} pedras`} className="relative flex h-11 items-center gap-1.5 rounded-2xl bg-surface-3 px-3 text-sm font-bold text-ink transition hover:bg-surface-2">
                  <ShieldRoundedIcon fontSize="small" className="text-[#c99a1c]" />
                  {campaign.breastplate.claimed}/{campaign.breastplate.total}
                  {campaign.breastplate.stones.some((stone) => stone.state === 'available') ? <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-success ring-2 ring-surface" /> : null}
                </button>
              </Tooltip>
            ) : null}
            {special ? (
              <div data-rarity={special.character.rarity} className="rarity ml-auto flex min-w-0 max-w-[55%] items-center gap-2 rounded-2xl border-2 border-r-special/50 bg-r-special/10 px-3 py-1.5">
                <StarRoundedIcon className="shrink-0 text-r-special" fontSize="small" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold text-ink">{special.owned ? `${special.character.name} conquistado!` : `Figurinha ${special.character.name}`}</p>
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
                {pages.map((page, index) => {
                  if (page.kind === 'soon') return <SoonPage key="soon" active={active === index} />;
                  if (page.kind === 'finale' && campaign.special) return <FinalePage key="finale" campaign={campaign} special={campaign.special} playerName={playerName} active={active === index} />;
                  if (page.kind === 'stone') {
                    return <StonePage key={`stone-${page.stone.id}`} stone={page.stone} playerName={playerName} active={active === index} claiming={stoneClaiming === page.stone.id} onClaim={(stone) => void claimStoneAction(stone)} onOpenBreastplate={() => setPeitoral(true)} pageClass={pageShell} />;
                  }
                  if (page.kind !== 'scenario') return null;
                  const item = page.scenario;
                  return (
                  <section
                    key={item.id}
                    style={scenarioThemeVars(item.color)}
                    aria-label={item.name}
                    aria-hidden={index === active ? undefined : true}
                    className="relative flex h-full snap-start snap-always flex-col gap-2 overflow-hidden bg-bg px-2 pb-2 pt-2"
                  >
                    {/* O próprio mapa, desfocado, preenche as laterais quando a tela é mais larga que o mapa. */}
                    <img src={scenarioMapSrc(item)} alt="" aria-hidden="true" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-30 blur-2xl" onError={(event) => (event.currentTarget.style.display = 'none')} />
                    <div className={cn('relative flex shrink-0 items-center gap-3 px-1 transition-all duration-500 ease-out', index === active ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0')}>
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
                    <div className={cn('relative flex min-h-0 flex-1 items-center justify-center transition-all duration-700 ease-out [container-type:size]', index === active ? 'scale-100 opacity-100' : 'scale-95 opacity-40')}>
                      <ScenarioMap scenario={item} onOpenNode={setSelected} />
                    </div>
                  </section>
                  );
                })}
              </div>

              <nav aria-label="Navegar entre cenários" className="pointer-events-none absolute inset-y-0 right-1 flex flex-col items-center justify-center gap-2">
                <Tooltip content="Próximo cenário" side="bottom">
                  <button type="button" onClick={() => goTo(active - 1)} disabled={active <= 0} aria-label="Próximo cenário (para cima)" className={cn(arrow, 'pointer-events-auto')}>
                    <KeyboardArrowUpRoundedIcon fontSize="small" />
                  </button>
                </Tooltip>
                <ol className="pointer-events-auto flex flex-col items-center gap-1 rounded-full bg-surface/80 px-1 py-1.5 backdrop-blur">
                  {pages.map((page, index) => (
                    <li key={page.kind === 'scenario' ? `s-${page.scenario.id}` : page.kind === 'stone' ? `p-${page.stone.id}` : page.kind}>
                      <button
                        type="button"
                        onClick={() => goTo(index)}
                        aria-label={page.kind === 'scenario' ? `Ir para ${page.scenario.name}` : page.kind === 'stone' ? `Ir para a pedra ${page.stone.name}` : page.kind === 'finale' ? 'Ir para o prêmio final' : 'Ir para o aviso de novidades'}
                        aria-current={index === active ? 'true' : undefined}
                        className={cn(
                          'block rounded-full transition-all duration-300',
                          index === active ? 'h-4 w-2 bg-primary' : page.kind === 'scenario' ? (page.scenario.completed ? 'h-2 w-2 bg-success' : 'h-2 w-2 bg-edge-strong') : page.kind === 'stone' ? (page.stone.state === 'claimed' ? 'h-2.5 w-2.5 rotate-45 rounded-[2px] bg-success' : 'h-2.5 w-2.5 rotate-45 rounded-[2px] bg-[#e0b43a]') : 'h-2 w-2 bg-edge-strong/60',
                        )}
                      />
                    </li>
                  ))}
                </ol>
                <Tooltip content="Cenário anterior" side="top">
                  <button type="button" onClick={() => goTo(active + 1)} disabled={active >= pageCount - 1} aria-label="Cenário anterior (para baixo)" className={cn(arrow, 'pointer-events-auto')}>
                    <KeyboardArrowDownRoundedIcon fontSize="small" />
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
            <div className="space-y-1 rounded-2xl bg-violet/15 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-muted">XP total para chegar ao nível {liveSelected.level}</span>
                <span className="font-display text-lg font-bold text-violet-strong dark:text-violet">{xpForLevel(liveSelected.level, xpBands).toLocaleString('pt-BR')} XP</span>
              </div>
              <p className="text-xs font-semibold text-muted">
                {xp >= xpForLevel(liveSelected.level, xpBands)
                  ? `Você já passou desse ponto: tem ${xp.toLocaleString('pt-BR')} XP no total.`
                  : `Você tem ${xp.toLocaleString('pt-BR')} XP no total: faltam ${(xpForLevel(liveSelected.level, xpBands) - xp).toLocaleString('pt-BR')} XP. A barra do topo mostra só o XP do nível atual.`}
              </p>
            </div>
            {liveSelected.state === 'locked' ? <Alert tone="info">Chegue ao nível {liveSelected.level} para abrir esta parada.</Alert> : null}
            {liveSelected.state === 'claimed' ? <Alert tone="success">Você já resgatou esta parada.</Alert> : null}
            <RewardLines node={liveSelected} playerName={playerName} music={selectedScenario?.hasMusic && liveSelected.level === selectedScenario.startLevel ? selectedScenario.name : null} />
          </div>
        ) : null}
      </Modal>

      <BreastplateModal open={peitoral} breastplate={campaign?.breastplate ?? null} playerName={playerName} claimingId={stoneClaiming} onClaim={(stone) => void claimStoneAction(stone)} onClose={() => setPeitoral(false)} />

      <Modal open={stoneWon !== null} size="sm" title="Pedra conquistada!" onClose={() => setStoneWon(null)} footer={<Button onClick={() => setStoneWon(null)}>Continuar</Button>}>
        {stoneWon ? (
          <div className="space-y-4 text-center">
            <div className="animate-pop-in mx-auto w-fit">
              <StoneGem stone={{ ...stoneWon.stone, state: 'claimed' }} size={144} />
            </div>
            <p className="font-display text-xl font-semibold text-ink">{stoneWon.stone.name}</p>
            <ul className="space-y-1 text-sm font-semibold text-ink">
              {stoneWon.result.coins ? <li>+{stoneWon.result.coins.toLocaleString('pt-BR')} moedas</li> : null}
              {stoneWon.result.cosmeticGranted && stoneWon.stone.cosmetic ? <li>{stoneWon.stone.cosmetic.name}</li> : null}
              {stoneWon.result.badgeGranted && stoneWon.stone.badge ? (
                <li className="flex items-center justify-center gap-2">
                  <BadgeMark badge={{ name: stoneWon.stone.badge.name, imageUrl: stoneWon.stone.badge.imageUrl ?? null, color: stoneWon.stone.badge.color ?? null, style: stoneWon.stone.badge.style ?? null }} size="sm" /> {stoneWon.stone.badge.name}
                </li>
              ) : null}
            </ul>
            {stoneWon.result.completeReward ? (
              <Alert tone="success">
                Peitoral Completo! +{stoneWon.result.completeReward.coins.toLocaleString('pt-BR')} moedas, {stoneWon.result.completeReward.badgeName} e {stoneWon.result.completeReward.prestigeName}.
              </Alert>
            ) : null}
            <p className="text-xs text-muted">Equipe o brasão em Perfil → Itens visuais.</p>
          </div>
        ) : null}
      </Modal>

      {emerald?.emeraldChest ? (
        <ChestOpening
          tier="EMERALD"
          prizes={emerald.emeraldChest.prizes}
          onDone={() => {
            setUnlocked(emerald);
            setEmerald(null);
          }}
        />
      ) : null}

      <Modal
        open={unlocked !== null}
        size="sm"
        title="Figurinha especial conquistada!"
        onClose={() => setUnlocked(null)}
        footer={<Button onClick={() => setUnlocked(null)}>Continuar</Button>}
      >
        {unlocked?.special && special ? (
          <div className="space-y-4 text-center">
            <div className="animate-pop-in mx-auto w-48">
              <StickerCard name={unlocked.special.name} rarity={special.character.rarity} imageUrl={unlocked.special.imageUrl} owned size="lg" />
            </div>
            <p className="font-display text-lg font-semibold text-ink">Você juntou todos os fragmentos de {unlocked.special.name}!</p>
            <p className="text-sm text-muted">Esta figurinha é única: não pode ser trocada nem vendida.</p>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
