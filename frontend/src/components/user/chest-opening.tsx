import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import { Button } from '@/components/ui/button';
import { CoinIcon } from '@/components/game/game-ui';
import { StickerCard } from '@/components/game/sticker-card';
import type { StickerRarity } from '@/lib/admin-api';
import { cn } from '@/lib/cn';
import { getRarityLabel } from '@/lib/rarity-theme';
import { playSfx, type SfxName } from '@/lib/sound/sfx';
import { useChestDesigns, type ChestDesign } from '@/lib/chest-designs';
import type { ChestPrize, ChestTierName } from '@/lib/user-api';

export const CHEST_TIERS: Record<ChestTierName, { label: string; color: string; dark: string }> = {
  BRONZE: { label: 'Baú de Bronze', color: '#d98a4a', dark: '#8a4f1d' },
  SILVER: { label: 'Baú de Prata', color: '#cbd5e1', dark: '#64748b' },
  GOLD: { label: 'Baú de Ouro', color: '#fbbf24', dark: '#b45309' },
  DIAMOND: { label: 'Baú de Diamante', color: '#5ad1ff', dark: '#0e7bb0' },
};

type ChestLook = { label: string; color: string; dark: string; imageUrl: string | null; openImageUrl: string | null };

/** Som de cada nível de baú e de cada tipo de prêmio (também usados no teste de sons do painel). */
export const CHEST_SFX: Record<ChestTierName, SfxName> = { BRONZE: 'chestBronze', SILVER: 'chestSilver', GOLD: 'chestGold', DIAMOND: 'chestDiamond' };
const STICKER_SFX: SfxName[] = ['stickerCommon', 'stickerRare', 'stickerEpic', 'stickerLegendary'];
const SUSPENSE_SFX: SfxName[] = ['stickerCommon', 'suspenseRare', 'suspenseEpic', 'suspenseLegendary'];

function prizeSfx(prize: ChestPrize | undefined, level: number): SfxName {
  if (!prize) return 'success';
  if (prize.kind === 'COINS') return 'prizeCoins';
  if (prize.kind === 'HELPER') return 'prizeHelper';
  if (prize.kind === 'COSMETIC') return 'prizeCosmetic';
  return STICKER_SFX[Math.min(level, 3)];
}

/** Nome, cor e arte de um baú: o que o admin cadastrou, com o desenho padrão no que estiver vazio. */
export function chestLook(tier: ChestTierName, design?: Pick<ChestDesign, 'imageUrl' | 'openImageUrl' | 'name' | 'color'> | null): ChestLook {
  const base = CHEST_TIERS[tier];
  return { label: design?.name?.trim() || base.label, color: design?.color || base.color, dark: base.dark, imageUrl: design?.imageUrl || null, openImageUrl: design?.openImageUrl || null };
}

/** Visual cadastrado de um baú (hook: acompanha o que o admin salvar). */
export function useChestLook(tier: ChestTierName, override?: Pick<ChestDesign, 'imageUrl' | 'openImageUrl' | 'name' | 'color'> | null): ChestLook {
  const designs = useChestDesigns();
  return chestLook(tier, override ?? designs[tier]);
}

const RARITY_RANK: Record<string, number> = { COMMON: 0, RARE: 1, EPIC: 2, LEGENDARY: 3, SPECIAL: 4 };
const rank = (prize: ChestPrize) => (prize.kind === 'STICKER' ? RARITY_RANK[prize.rarity ?? 'COMMON'] ?? 0 : -1);
/** Quanto mais rara a figurinha, mais longo o carretel e o suspense antes de abrir. */
const REEL_MS = [1500, 1900, 2400, 3000];
const SUSPENSE_MS = [0, 500, 1100, 1900];
const PARTICLES = [10, 18, 36, 64];
const TILE_REM = 7;

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Moedas, ajudas e itens visuais primeiro; as figurinhas por último, da mais comum para a mais rara. */
function ordered(prizes: ChestPrize[]) {
  return [...prizes].sort((left, right) => rank(left) - rank(right));
}

export function ChestIcon({ tier, className, design, open = false }: { tier: ChestTierName; className?: string; design?: Pick<ChestDesign, 'imageUrl' | 'openImageUrl' | 'name' | 'color'> | null; open?: boolean }) {
  const { color, dark, imageUrl, openImageUrl } = useChestLook(tier, design);
  // Com a arte do baú aberto cadastrada, ela troca no instante da abertura.
  const art = open && openImageUrl ? openImageUrl : imageUrl;
  if (art) return <img src={art} alt="" draggable={false} className={cn('object-contain', className)} />;
  return (
    <svg viewBox="0 0 160 140" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`chest-${tier}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
      </defs>
      <ellipse cx="80" cy="130" rx="62" ry="8" fill="rgba(0,0,0,0.35)" />
      <rect x="18" y="62" width="124" height="64" rx="10" fill={`url(#chest-${tier})`} stroke={dark} strokeWidth="4" />
      <path d="M18 70c0-30 26-52 62-52s62 22 62 52z" fill={`url(#chest-${tier})`} stroke={dark} strokeWidth="4" />
      <rect x="18" y="62" width="124" height="12" fill={dark} opacity="0.45" />
      <rect x="68" y="54" width="24" height="34" rx="6" fill="#fff6" stroke={dark} strokeWidth="3" />
      <circle cx="80" cy="70" r="5" fill={dark} />
      {tier === 'DIAMOND' ? <path d="M80 6l12 14-12 14-12-14z" fill="#e6fbff" stroke={dark} strokeWidth="3" /> : null}
    </svg>
  );
}

/** Estouro de faíscas em volta do prêmio (quanto mais rara a figurinha, mais faíscas). */
function Burst({ count, color }: { count: number; color: string }) {
  const sparks = useMemo(
    () =>
      Array.from({ length: count }, () => {
        const angle = Math.random() * Math.PI * 2;
        const distance = 90 + Math.random() * 190;
        return { dx: Math.cos(angle) * distance, dy: Math.sin(angle) * distance, size: 5 + Math.random() * 9, dur: 0.7 + Math.random() * 0.9, rot: Math.random() * 360 };
      }),
    [count],
  );
  return (
    <div className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0" aria-hidden="true">
      {sparks.map((spark, index) => (
        <span
          key={index}
          className="animate-burst-out absolute rounded-sm"
          style={{ width: spark.size, height: spark.size, background: color, '--dx': `${spark.dx}px`, '--dy': `${spark.dy}px`, '--dur': `${spark.dur}s`, '--rot': `${spark.rot}deg` } as CSSProperties}
        />
      ))}
    </div>
  );
}

function PrizeFace({ prize, large = false }: { prize: ChestPrize; large?: boolean }) {
  if (prize.kind === 'STICKER') {
    return (
      <div className={cn('mx-auto', large ? 'w-44' : 'w-24')}>
        <StickerCard name={prize.name ?? 'Figurinha'} rarity={(prize.rarity ?? 'COMMON') as StickerRarity} imageUrl={prize.imageUrl} owned size={large ? 'lg' : 'sm'} />
      </div>
    );
  }
  const base = cn('mx-auto flex flex-col items-center justify-center gap-1 rounded-3xl border-2 border-edge bg-surface text-center', large ? 'h-44 w-44 p-4' : 'h-28 w-24 p-2');
  if (prize.kind === 'COINS') {
    return (
      <div className={base}>
        <CoinIcon className={large ? 'h-14 w-14' : 'h-9 w-9'} />
        <p className={cn('font-display font-bold text-ink', large ? 'text-3xl' : 'text-lg')}>+{prize.amount}</p>
        <p className="text-xs font-semibold text-muted">moedas</p>
      </div>
    );
  }
  const icon = prize.kind === 'COSMETIC' ? <PaletteRoundedIcon sx={{ fontSize: large ? 56 : 32 }} /> : <BoltRoundedIcon sx={{ fontSize: large ? 56 : 32 }} />;
  return (
    <div className={base}>
      <span className="text-primary-strong dark:text-primary">{icon}</span>
      <p className={cn('font-display font-bold text-ink', large ? 'text-lg' : 'text-xs')}>{prize.name}</p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">{prize.kind === 'COSMETIC' ? 'item visual' : 'ajuda'}</p>
    </div>
  );
}

/** Verso da figurinha no carretel: o personagem e a raridade só aparecem quando ela é revelada (nova ou repetida). */
function CardBack() {
  return (
    <div className="mx-auto flex aspect-[3/4] w-24 flex-col items-center justify-center gap-1 rounded-3xl border-4 border-white/70 bg-[linear-gradient(145deg,#7c3aed,#312e81)] shadow-lg">
      <span className="font-display text-5xl font-bold text-white/90">?</span>
      <AutoAwesomeRoundedIcon className="text-white/70" sx={{ fontSize: 18 }} />
    </div>
  );
}

const DECOYS: Array<() => ReactNode> = [
  () => <CoinIcon className="h-9 w-9" />,
  () => <BoltRoundedIcon className="text-primary" sx={{ fontSize: 36 }} />,
  () => <MenuBookRoundedIcon className="text-violet" sx={{ fontSize: 36 }} />,
  () => <AutoAwesomeRoundedIcon className="text-info" sx={{ fontSize: 36 }} />,
];

/** Carretel: itens passando rápido e desacelerando até parar no prêmio. */
function Reel({ prize, durationMs, onStop }: { prize: ChestPrize; durationMs: number; onStop: () => void }) {
  const finalIndex = prize.kind === 'STICKER' ? 38 : 24;
  const tiles = useMemo(() => {
    const items = Array.from({ length: finalIndex + 3 }, (_, index) => ({ index, decoy: Math.floor(Math.random() * DECOYS.length), tint: Math.floor(Math.random() * 4) }));
    return items;
  }, [finalIndex]);
  const [go, setGo] = useState(false);
  const stop = useRef(onStop);
  stop.current = onStop;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setGo(true));
    const timer = window.setTimeout(() => stop.current(), durationMs + 120);
    // Tique do carretel: começa rápido e vai espaçando até parar no prêmio.
    const ticks = Array.from({ length: 16 }, (_, index) => window.setTimeout(() => playSfx('reelTick'), durationMs * (1 - (1 - (index + 1) / 16) ** 2.4)));
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      ticks.forEach((tick) => window.clearTimeout(tick));
    };
  }, [durationMs]);

  const tint = (value: number) => ['bg-surface', 'bg-surface-2', 'bg-surface-3', 'bg-surface'][value];
  return (
    <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-3xl border-2 border-edge-strong bg-black/40 py-4" aria-hidden="true">
      <div
        className="flex"
        style={{
          transform: go ? `translateX(calc(50% - ${(finalIndex + 0.5) * TILE_REM}rem))` : 'translateX(0)',
          transition: go ? `transform ${durationMs}ms cubic-bezier(0.08, 0.7, 0.12, 1)` : 'none',
        }}
      >
        {tiles.map((tile) => (
          <div key={tile.index} className="flex shrink-0 items-center justify-center" style={{ width: `${TILE_REM}rem`, height: '8.5rem' }}>
            {tile.index === finalIndex ? (
              <CardBack />
            ) : (
              <div className={cn('flex h-24 w-20 items-center justify-center rounded-2xl border border-edge', tint(tile.tint))}>{DECOYS[tile.decoy]()}</div>
            )}
          </div>
        ))}
      </div>
      {/* Marcador do centro */}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-primary shadow-[0_0_14px_var(--primary)]" />
    </div>
  );
}

type Phase = 'closed' | 'shaking' | 'opened' | 'reel' | 'suspense' | 'reveal' | 'summary';

/**
 * Abertura do baú em tela cheia: o baú treme, os prêmios passam num carretel e cada um aparece com uma
 * animação; antes de abrir uma figurinha rara há um suspense que cresce com a raridade (lendária é o máximo).
 */
export function ChestOpening({ tier, prizes, onDone, preview = false, design }: { tier: ChestTierName; prizes: ChestPrize[]; onDone: () => void; preview?: boolean; design?: Pick<ChestDesign, 'imageUrl' | 'openImageUrl' | 'name' | 'color'> | null }) {
  const list = useMemo(() => ordered(prizes), [prizes]);
  const [phase, setPhase] = useState<Phase>('closed');
  const [index, setIndex] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const fast = reducedMotion() ? 0.1 : 1;
  const prize = list[index];
  const level = prize ? Math.max(0, rank(prize)) : 0;
  const isSticker = prize?.kind === 'STICKER';
  const info = useChestLook(tier, design);
  const rarityColor = ['#9ca3af', '#3b82f6', '#a855f7', '#fbbf24'][Math.min(level, 3)];

  const later = (callback: () => void, ms: number) => {
    timers.current.push(window.setTimeout(callback, ms * fast));
  };
  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  function open() {
    playSfx(CHEST_SFX[tier]);
    setPhase('shaking');
    later(() => {
      setFlash(info.color);
      if (list.length === 0) return setPhase('summary');
      // Com a arte do baú aberto, ela aparece por um instante antes dos prêmios começarem a passar.
      if (info.openImageUrl) {
        setPhase('opened');
        later(() => setPhase('reel'), 750);
      } else {
        setPhase('reel');
      }
    }, 950);
  }

  function reelStopped() {
    if (!isSticker || level === 0) return reveal();
    // Suspense antes de abrir a figurinha: cresce com a raridade.
    setPhase('suspense');
    playSfx(SUSPENSE_SFX[Math.min(level, 3)]);
    later(reveal, SUSPENSE_MS[Math.min(level, 3)]);
  }

  function reveal() {
    setPhase('reveal');
    setFlash(isSticker ? rarityColor : null);
    playSfx(prizeSfx(prize, level));
    // Moedas e ajudas passam sozinhas; figurinhas esperam o toque para o jogador curtir.
    if (!isSticker) later(next, 1100);
  }

  function next() {
    setFlash(null);
    if (index + 1 >= list.length) {
      setPhase('summary');
      return;
    }
    setIndex((value) => value + 1);
    setPhase('reel');
  }

  const reelMs = (isSticker ? REEL_MS[Math.min(level, 3)] : 1100) * fast;
  const shake = phase === 'reveal' && isSticker && level >= 2;

  return (
    <div
      className={cn('fixed inset-0 z-[90] flex flex-col items-center justify-center overflow-hidden bg-black/90 p-4 text-white', shake && 'animate-shake')}
      role="dialog"
      aria-modal="true"
      aria-label={info.label}
      style={{ backgroundImage: `radial-gradient(circle at 50% 45%, ${info.color}55, transparent 60%)` }}
    >
      {flash ? <div key={`${phase}-${index}-${flash}`} className="animate-screen-flash pointer-events-none absolute inset-0 z-10" style={{ background: flash }} /> : null}

      {phase !== 'summary' ? (
        <button type="button" onClick={() => setPhase('summary')} className="absolute right-4 top-4 z-20 rounded-full bg-white/15 px-4 py-2 text-sm font-bold hover:bg-white/25">
          Pular
        </button>
      ) : null}

      <div className="relative z-20 flex w-full max-w-xl flex-col items-center gap-5 text-center">
        <p className="font-display text-sm font-bold uppercase tracking-[0.3em]" style={{ color: info.color }}>
          {info.label}
          {preview ? ' · teste' : ''}
        </p>

        {phase === 'closed' || phase === 'shaking' || phase === 'opened' ? (
          <>
            <button type="button" onClick={open} disabled={phase !== 'closed'} className="group relative" aria-label="Abrir o baú">
              <span className="absolute inset-0 -z-10 rounded-full blur-3xl" style={{ background: `${info.color}66` }} />
              <ChestIcon tier={tier} design={design} open={phase === 'opened'} className={cn('h-52 w-60 drop-shadow-2xl', phase === 'shaking' ? 'animate-chest-shake' : phase === 'opened' ? 'animate-pop-in' : 'animate-chest-idle')} />
            </button>
            <Button size="xl" onClick={open} disabled={phase !== 'closed'}>
              {phase !== 'closed' ? 'Abrindo...' : 'Toque para abrir'}
            </Button>
          </>
        ) : null}

        {phase === 'reel' && prize ? (
          <>
            <p className="font-display text-lg font-bold text-white/80">
              Prêmio {index + 1} de {list.length}
            </p>
            <Reel key={index} prize={prize} durationMs={reelMs} onStop={reelStopped} />
          </>
        ) : null}

        {phase === 'suspense' ? (
          <div className="relative flex h-72 w-72 items-center justify-center">
            {level >= 2 ? (
              <div className="animate-rays-spin absolute inset-0 rounded-full opacity-70" style={{ background: `repeating-conic-gradient(from 0deg, ${rarityColor} 0 6deg, transparent 6deg 24deg)`, maskImage: 'radial-gradient(circle, black 30%, transparent 70%)', WebkitMaskImage: 'radial-gradient(circle, black 30%, transparent 70%)' }} />
            ) : null}
            <div
              className="animate-orb-charge relative h-40 w-40 rounded-full"
              style={{ '--charge': `${(SUSPENSE_MS[Math.min(level, 3)] || 500) * fast}ms`, background: `radial-gradient(circle at 35% 30%, #fff, ${rarityColor} 55%, transparent 72%)`, boxShadow: `0 0 80px ${rarityColor}` } as CSSProperties}
            />
            <p className="absolute -bottom-2 font-display text-xl font-bold" style={{ color: rarityColor }}>
              {level >= 3 ? 'É lendária!?' : level === 2 ? 'Algo épico...' : 'Opa...'}
            </p>
          </div>
        ) : null}

        {phase === 'reveal' && prize ? (
          <div className="relative flex flex-col items-center gap-4">
            {isSticker && level >= 3 ? (
              <div className="animate-rays-spin absolute -top-20 h-96 w-96 rounded-full opacity-60" style={{ background: 'repeating-conic-gradient(from 0deg, #fbbf24 0 5deg, transparent 5deg 20deg)', maskImage: 'radial-gradient(circle, black 25%, transparent 68%)', WebkitMaskImage: 'radial-gradient(circle, black 25%, transparent 68%)' }} />
            ) : null}
            {isSticker ? <span className="animate-ring-grow absolute top-16 h-40 w-40 rounded-full border-4" style={{ borderColor: rarityColor }} /> : null}
            {isSticker && level >= 2 ? <span className="animate-ring-grow absolute top-16 h-40 w-40 rounded-full border-4" style={{ borderColor: rarityColor, animationDelay: '0.25s' }} /> : null}
            <Burst count={isSticker ? PARTICLES[Math.min(level, 3)] : 8} color={isSticker ? rarityColor : info.color} />
            <div className="animate-reveal-card relative">
              <PrizeFace prize={prize} large />
            </div>
            {prize.kind === 'STICKER' ? (
              <div className="space-y-1">
                <p className="font-display text-3xl font-bold" style={{ color: rarityColor }}>
                  {prize.name}
                </p>
                <p className="font-display text-sm font-bold uppercase tracking-widest text-white/80">
                  Figurinha {getRarityLabel((prize.rarity ?? 'COMMON') as StickerRarity)}
                  {preview ? '' : prize.unlocked ? ' · nova!' : ' · repetida (foi para as repetidas)'}
                </p>
              </div>
            ) : null}
            {isSticker ? (
              <Button size="lg" onClick={next}>
                {index + 1 >= list.length ? 'Ver resumo' : 'Continuar'}
              </Button>
            ) : null}
          </div>
        ) : null}

        {phase === 'summary' ? (
          <div className="w-full space-y-5">
            <h2 className="font-display text-3xl font-bold">Você ganhou!</h2>
            <div className="flex flex-wrap items-start justify-center gap-3">
              {list.map((item, position) => (
                <div key={position} className="animate-pop-in" style={{ animationDelay: `${position * 80}ms` }}>
                  <PrizeFace prize={item} />
                  {item.kind === 'STICKER' ? <p className="mt-1 max-w-24 truncate text-xs font-bold text-white/80">{item.name}</p> : null}
                </div>
              ))}
            </div>
            <Button size="xl" onClick={onDone}>
              {preview ? 'Fechar teste' : 'Continuar'}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
