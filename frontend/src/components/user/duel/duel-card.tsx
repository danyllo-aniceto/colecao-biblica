import type { PointerEventHandler, ReactNode } from 'react';
import { describeDom } from '@duel/cards';
import type { CardDef } from '@duel/types';
import { AnimatedNumber } from '@/components/user/duel/duel-anim';
import { cn } from '@/lib/cn';

/** Imagens das figurinhas: pelo nome do personagem do álbum (sem acento nem maiúsculas). */
export type CardArt = Map<string, string>;

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function buildCardArt(characters: Array<{ name: string; imageUrl?: string | null }>): CardArt {
  const art: CardArt = new Map();
  for (const character of characters) if (character.imageUrl) art.set(normalize(character.name), character.imageUrl);
  return art;
}

export const artOf = (art: CardArt, def: CardDef) => def.imageUrl ?? art.get(normalize(def.name)) ?? null;

type FaceProps = {
  def: CardDef;
  art: CardArt;
  /** Influência atual (com bônus e Dons); sem isso, usa a base. */
  power?: number;
  size?: 'board' | 'hand' | 'big';
  selected?: boolean;
  dimmed?: boolean;
  silenced?: boolean;
  /** Destaque pulsando (a figurinha que está agindo agora). */
  focus?: boolean;
  /** Mostra o número mudando devagar (figurinhas na mesa). */
  animate?: boolean;
  className?: string;
  onClick?: () => void;
  onPointerDown?: PointerEventHandler<HTMLElement>;
  children?: ReactNode;
};

const SIZES = {
  board: 'h-[4.6rem] w-[3.4rem] text-[10px] rounded-lg',
  hand: 'h-[6.4rem] w-[4.6rem] text-[11px] rounded-xl',
  big: 'h-72 w-52 text-base rounded-3xl',
} as const;

/** Uma figurinha: arte, Vigor (azul), Influência (laranja; verde se subiu, vermelho se caiu) e nome. */
export function DuelCardFace({ def, art, power, size = 'board', selected, dimmed, silenced, focus, animate, className, onClick, onPointerDown, children }: FaceProps) {
  const image = artOf(art, def);
  const shown = power ?? def.power;
  const tone = shown > def.power ? 'text-success' : shown < def.power ? 'text-danger' : 'text-white';
  const badge = size === 'big' ? 'h-10 w-10 text-xl' : size === 'hand' ? 'h-7 w-7 text-sm' : 'h-5 w-5 text-[11px]';
  const Wrapper = onClick ? 'button' : 'div';
  return (
    <Wrapper
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      onPointerDown={onPointerDown}
      aria-label={`${def.name}, Vigor ${def.cost}, Influência ${shown}`}
      data-sound="off"
      className={cn(
        'relative isolate flex shrink-0 select-none touch-manipulation flex-col justify-end overflow-hidden border-2 bg-surface-3 shadow-md transition',
        SIZES[size],
        def.token ? 'border-dashed border-edge-strong' : 'border-edge-strong',
        selected && '-translate-y-2 border-primary ring-4 ring-primary/50',
        dimmed && 'opacity-45',
        focus && 'animate-duel-focus',
        className,
      )}
    >
      {image ? <img src={image} alt="" draggable={false} className="absolute inset-0 -z-10 h-full w-full object-cover" /> : <span className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/40 to-violet/50" />}
      {!image ? <span className="absolute inset-0 -z-10 flex items-center justify-center font-display text-3xl font-bold text-white/70">{def.name.slice(0, 1)}</span> : null}
      <span className="absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-gradient-to-t from-black/80 to-transparent" />
      <span className={cn('absolute left-0.5 top-0.5 flex items-center justify-center rounded-full bg-info font-display font-bold text-white shadow', badge)} aria-hidden="true">
        {def.cost}
      </span>
      <span className={cn('absolute right-0.5 top-0.5 flex items-center justify-center rounded-full bg-black/70 font-display font-bold shadow', badge, tone)} aria-hidden="true">
        {animate ? <AnimatedNumber value={shown} /> : shown}
      </span>
      {def.dom ? (
        <span className="absolute left-1/2 top-0.5 -translate-x-1/2 rounded-full bg-black/60 px-1 text-[9px] leading-4 text-primary" aria-hidden="true">
          ✨
        </span>
      ) : null}
      {silenced ? <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-black/60 text-center text-[9px] font-bold uppercase tracking-wide text-white/90">calado</span> : null}
      <span className="w-full truncate px-1 pb-0.5 text-center font-display font-bold leading-tight text-white drop-shadow">{def.name}</span>
      {children}
    </Wrapper>
  );
}

/** Detalhe da figurinha: cartão grande, etiquetas e o texto do Dom. */
export function DuelCardDetail({ def, art, power }: { def: CardDef; art: CardArt; power?: number }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <DuelCardFace def={def} art={art} power={power} size="big" />
      <div className="flex flex-wrap justify-center gap-1.5">
        {def.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-surface-3 px-2.5 py-0.5 text-xs font-bold text-muted">
            {tag}
          </span>
        ))}
      </div>
      <p className="max-w-xs text-sm font-semibold text-ink">{describeDom(def.dom)}</p>
      <p className="text-xs text-muted">
        Vigor {def.cost} · Influência {def.power}
      </p>
    </div>
  );
}
