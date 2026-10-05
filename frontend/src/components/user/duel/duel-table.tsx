import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import { describeDom } from '@duel/cards';
import type { DuelView, ViewCard, ViewLane } from '@duel/engine';
import type { Card } from '@duel/types';
import { TURNS } from '@duel/types';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Tooltip } from '@/components/ui/tooltip';
import { DuelCardDetail, DuelCardFace, type CardArt } from '@/components/user/duel/duel-card';
import { cn } from '@/lib/cn';
import { playSfx } from '@/lib/sound/sfx';

type TableProps = {
  view: DuelView;
  art: CardArt;
  opponentName: string;
  /** Imagem de fundo de cada coluna, pelo identificador do cenário. */
  laneImage: (scenarioId: string) => string | null;
  selectedUid: number | null;
  onSelect: (uid: number | null) => void;
  onStage: (uid: number, lane: number) => void;
  onUnstage: (uid: number) => void;
  onReady: () => void;
  onDouble: () => void;
  onRetreat: () => void;
  onExit: () => void;
  onHelp: () => void;
  /** Enquanto os acontecimentos do turno passam, a mesa fica travada. */
  busy: boolean;
  banner: string | null;
};

type Drag = { uid: number; x: number; y: number; lane: number | null };

/** Mesa do Duelo em retrato (como o Marvel Snap): rival em cima, três cenários, você embaixo, mão e botões no rodapé. */
export function DuelTable({ view, art, opponentName, laneImage, selectedUid, onSelect, onStage, onUnstage, onReady, onDouble, onRetreat, onExit, onHelp, busy, banner }: TableProps) {
  const [detail, setDetail] = useState<{ card: Card['def']; power?: number } | null>(null);
  const [laneInfo, setLaneInfo] = useState<ViewLane | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const press = useRef<{ uid: number; x: number; y: number; type: string } | null>(null);

  const foe = view.you === 0 ? 1 : 0;
  const stagedUids = useMemo(() => new Set(view.staged.map((play) => play.uid)), [view.staged]);
  const hand = view.hand.filter((card) => !stagedUids.has(card.uid));
  const selected = hand.find((card) => card.uid === selectedUid) ?? null;
  const locked = busy || view.ready || view.status !== 'playing';

  const canPlace = useCallback(
    (uid: number, lane: number) => {
      const card = view.hand.find((entry) => entry.uid === uid);
      const info = view.lanes[lane];
      if (!card || !info?.open) return false;
      const used = info.cards[view.you].length + view.staged.filter((play) => play.lane === lane).length;
      return used < info.slots && card.def.cost <= view.energyLeft;
    },
    [view],
  );

  function laneUnder(x: number, y: number): number | null {
    const element = document.elementsFromPoint(x, y).find((node) => (node as HTMLElement).dataset?.lane !== undefined) as HTMLElement | undefined;
    return element ? Number(element.dataset.lane) : null;
  }

  // Arrastar a carta da mão para um cenário (mouse: qualquer direção; dedo: para cima, para a rolagem da mão continuar livre).
  useEffect(() => {
    function move(event: PointerEvent) {
      const start = press.current;
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (!dragRef.current) {
        const far = Math.hypot(dx, dy) > 10;
        const upward = start.type === 'mouse' || (dy < -10 && Math.abs(dy) > Math.abs(dx));
        if (!far || !upward) return;
        playSfx('swipe');
        onSelect(start.uid);
      }
      const next: Drag = { uid: start.uid, x: event.clientX, y: event.clientY, lane: laneUnder(event.clientX, event.clientY) };
      dragRef.current = next;
      setDrag(next);
    }
    function up() {
      const current = dragRef.current;
      const start = press.current;
      press.current = null;
      dragRef.current = null;
      setDrag(null);
      // Tocar (sem arrastar) seleciona pela própria carta (onClick); aqui só soltar no cenário conta.
      if (current && start && current.lane !== null && canPlace(current.uid, current.lane)) onStage(current.uid, current.lane);
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [canPlace, onSelect, onStage]);

  const dragCard = drag ? view.hand.find((card) => card.uid === drag.uid) : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg" role="dialog" aria-modal="true" aria-label="Duelo de Cartas">
      <header className="flex shrink-0 items-center gap-2 border-b border-edge bg-surface/90 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
        <Tooltip content="Sair do duelo" side="bottom">
          <button type="button" onClick={onExit} aria-label="Sair do duelo" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-3 text-muted hover:text-ink">
            <CloseRoundedIcon />
          </button>
        </Tooltip>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-bold text-ink">{opponentName}</p>
          <p className="truncate text-xs font-semibold text-muted">
            Mão {view.opponent.handCount} · Baralho {view.opponent.deckCount} · {view.status === 'finished' ? 'fim' : view.opponent.ready ? '✓ pronto' : 'pensando...'}
          </p>
        </div>
        <span className={cn('flex h-10 min-w-10 items-center justify-center rounded-2xl px-2 font-display text-sm font-bold', view.stakes > 1 ? 'bg-danger text-white' : 'bg-surface-3 text-muted')} aria-label={`Aposta ${view.stakes}`}>
          ×{view.stakes}
        </span>
        <span className="flex h-10 items-center rounded-2xl bg-primary px-3 font-display text-base font-bold text-on-primary" aria-label={`Turno ${view.turn} de ${TURNS}`}>
          {view.turn}/{TURNS}
        </span>
        <Tooltip content="Como jogar" side="bottom">
          <button type="button" onClick={onHelp} aria-label="Como jogar" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-3 text-muted hover:text-ink">
            <HelpOutlineRoundedIcon />
          </button>
        </Tooltip>
      </header>

      <main className="relative grid min-h-0 flex-1 grid-cols-3 gap-1.5 px-1.5 py-1.5">
        {view.lanes.map((lane, index) => {
          const image = lane.scenario ? laneImage(lane.scenario.id) : null;
          const stagedHere = view.staged.filter((play) => play.lane === index).map((play) => view.hand.find((card) => card.uid === play.uid)).filter((card): card is Card => Boolean(card));
          const [theirs, mine] = [lane.power[foe], lane.power[view.you]];
          const droppable = drag ? canPlace(drag.uid, index) : false;
          const targetable = selected ? canPlace(selected.uid, index) && !locked : false;
          return (
            <section
              key={index}
              data-lane={index}
              aria-label={lane.scenario ? lane.scenario.name : `Cenário ${index + 1}, aparece no turno ${index + 1}`}
              onClick={() => {
                if (selected && !locked && canPlace(selected.uid, index)) onStage(selected.uid, index);
              }}
              className={cn(
                'relative flex min-h-0 flex-col overflow-hidden rounded-2xl border-2 bg-surface-2 transition',
                droppable && drag?.lane === index ? 'border-primary ring-4 ring-primary/40' : droppable || targetable ? 'border-primary/70' : 'border-edge',
                !lane.open && 'opacity-80',
              )}
            >
              {image && lane.open ? <img src={image} alt="" draggable={false} className="pointer-events-none absolute inset-0 -z-0 h-full w-full object-cover opacity-45" onError={(event) => (event.currentTarget.style.display = 'none')} /> : null}
              <button
                type="button"
                data-sound="soft"
                onClick={(event) => {
                  event.stopPropagation();
                  if (lane.scenario) setLaneInfo(lane);
                }}
                className="relative z-10 flex shrink-0 items-center justify-center gap-1 bg-surface/80 px-1 py-1 text-center font-display text-[11px] font-bold leading-tight text-ink"
              >
                {lane.scenario ? (
                  <>
                    <span aria-hidden="true">{lane.scenario.emoji}</span>
                    <span className="line-clamp-2">{lane.scenario.name}</span>
                  </>
                ) : (
                  <span className="text-muted">🔒 Turno {index + 1}</span>
                )}
              </button>

              <CardsArea cards={lane.cards[foe]} art={art} slots={lane.slots} onOpen={(card) => setDetail({ card: card.def, power: card.power })} side="foe" />
              <PowerRow theirs={theirs} mine={mine} open={lane.open} />
              <CardsArea
                cards={lane.cards[view.you]}
                staged={stagedHere}
                art={art}
                slots={lane.slots}
                onOpen={(card) => setDetail({ card: card.def, power: card.power })}
                onUnstage={locked ? undefined : onUnstage}
                side="me"
              />
            </section>
          );
        })}

        {banner ? (
          <div className="pointer-events-none absolute inset-x-3 top-1/2 z-20 -translate-y-1/2" aria-live="polite">
            <p key={banner} className="animate-pop-in mx-auto max-w-sm rounded-2xl border-2 border-primary bg-surface/95 px-4 py-3 text-center font-display text-base font-bold text-ink shadow-xl">
              {banner}
            </p>
          </div>
        ) : null}
      </main>

      <footer className="shrink-0 space-y-1.5 border-t border-edge bg-surface/90 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur">
        <p className="min-h-9 px-1 text-xs font-semibold leading-snug text-muted" aria-live="polite">
          {selected ? (
            <>
              <b className="text-ink">{selected.def.name}</b> · Vigor {selected.def.cost} · Influência {selected.def.power}. {describeDom(selected.def.dom)}
            </>
          ) : view.ready && view.status === 'playing' ? (
            'Pronto! Esperando o rival...'
          ) : (
            'Toque numa carta e depois num cenário, ou arraste a carta até ele.'
          )}
        </p>
        <div className="no-scrollbar flex items-end justify-start gap-1.5 overflow-x-auto px-1 pb-1 pt-3 sm:justify-center">
          {hand.length === 0 ? <p className="w-full px-2 py-6 text-center text-sm font-semibold text-muted">Mão vazia</p> : null}
          {hand.map((card) => {
            const affordable = card.def.cost <= view.energyLeft;
            return (
              <DuelCardFace
                key={card.uid}
                def={card.def}
                art={art}
                size="hand"
                power={card.def.power + card.bonus}
                selected={selectedUid === card.uid}
                dimmed={!affordable || locked}
                className={cn('cursor-pointer touch-pan-x', drag?.uid === card.uid && 'opacity-30')}
                onClick={() => {
                  if (!locked) onSelect(selectedUid === card.uid ? null : card.uid);
                }}
                onPointerDown={(event) => {
                  if (locked) return;
                  press.current = { uid: card.uid, x: event.clientX, y: event.clientY, type: event.pointerType };
                }}
              />
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={onRetreat} disabled={!view.canRetreat || busy || view.status !== 'playing'} className="text-danger">
            <FlagRoundedIcon fontSize="small" /> Desistir
          </Button>
          <span className="flex h-11 min-w-11 items-center justify-center rounded-full bg-info px-2 font-display text-lg font-bold text-white shadow-md" aria-label={`Vigor ${view.energyLeft} de ${view.energy}`}>
            {view.energyLeft}
            <span className="text-[10px] font-semibold opacity-80">/{view.energy}</span>
          </span>
          <span className="flex-1" />
          <Button size="sm" variant="secondary" onClick={onDouble} disabled={!view.canDouble || busy}>
            Dobrar
          </Button>
          <Button size="md" onClick={onReady} disabled={locked} aria-label={`Pronto, turno ${view.turn} de ${TURNS}`}>
            Pronto {view.turn}/{TURNS}
          </Button>
        </div>
      </footer>

      {drag && dragCard ? (
        <div className="pointer-events-none fixed z-[70]" style={{ left: drag.x, top: drag.y, transform: 'translate(-50%, -60%) scale(1.1) rotate(-4deg)' }}>
          <DuelCardFace def={dragCard.def} art={art} size="hand" power={dragCard.def.power + dragCard.bonus} />
        </div>
      ) : null}

      <Modal open={detail !== null} size="sm" title={detail?.card.name ?? ''} onClose={() => setDetail(null)} footer={<Button onClick={() => setDetail(null)}>Fechar</Button>}>
        {detail ? <DuelCardDetail def={detail.card} art={art} power={detail.power} /> : null}
      </Modal>

      <Modal open={laneInfo !== null} size="sm" title={laneInfo?.scenario ? `${laneInfo.scenario.emoji} ${laneInfo.scenario.name}` : ''} onClose={() => setLaneInfo(null)} footer={<Button onClick={() => setLaneInfo(null)}>Fechar</Button>}>
        {laneInfo?.scenario ? <p className="text-sm font-semibold text-ink">{laneInfo.scenario.text}</p> : null}
      </Modal>
    </div>
  );
}

function PowerRow({ theirs, mine, open }: { theirs: number; mine: number; open: boolean }) {
  if (!open) return <div className="relative z-10 h-8 shrink-0" />;
  return (
    <div className="relative z-10 flex shrink-0 items-center justify-between px-2 py-0.5" aria-label={`Rival ${theirs}, você ${mine}`}>
      <span className={cn('flex h-8 min-w-8 items-center justify-center rounded-lg border-2 px-1 font-display text-lg font-bold', theirs > mine ? 'border-danger bg-danger text-white' : 'border-edge-strong bg-surface text-ink')}>{theirs}</span>
      <span className={cn('flex h-8 min-w-8 items-center justify-center rounded-lg border-2 px-1 font-display text-lg font-bold', mine > theirs ? 'border-success bg-success text-white' : 'border-edge-strong bg-surface text-ink')}>{mine}</span>
    </div>
  );
}

function CardsArea({
  cards,
  staged = [],
  art,
  slots,
  side,
  onOpen,
  onUnstage,
}: {
  cards: ViewCard[];
  staged?: Card[];
  art: CardArt;
  slots: number;
  side: 'me' | 'foe';
  onOpen: (card: ViewCard) => void;
  onUnstage?: (uid: number) => void;
}) {
  return (
    <div className={cn('relative z-10 flex min-h-0 flex-1 flex-wrap content-start justify-center gap-1 p-1', side === 'foe' ? 'content-end' : 'content-start')}>
      {cards.map((card) => (
        <DuelCardFace key={card.uid} def={card.def} art={art} power={card.power} silenced={card.silenced} onClick={() => onOpen(card)} className="animate-pop-in" />
      ))}
      {staged.map((card) => (
        <DuelCardFace key={card.uid} def={card.def} art={art} className="opacity-70 ring-2 ring-primary" onClick={onUnstage ? () => onUnstage(card.uid) : undefined} />
      ))}
      {side === 'me' && cards.length + staged.length === 0 ? <span className="self-center text-[10px] font-semibold text-muted/70">{slots} espaços</span> : null}
    </div>
  );
}

