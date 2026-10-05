import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import FastForwardRoundedIcon from '@mui/icons-material/FastForwardRounded';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import SkipNextRoundedIcon from '@mui/icons-material/SkipNextRounded';
import { describeDom } from '@duel/cards';
import type { DuelView } from '@duel/engine';
import type { CardDef, DuelEvent, ScenarioDef, SnapCard, Snapshot } from '@duel/types';
import { TURNS } from '@duel/types';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { Tooltip } from '@/components/ui/tooltip';
import { AnimatedNumber, NeutralHex, PowerHex } from '@/components/user/duel/duel-anim';
import { DuelCardDetail, DuelCardFace, type CardArt } from '@/components/user/duel/duel-card';
import { cn } from '@/lib/cn';
import { playSfx } from '@/lib/sound/sfx';

/** Um passo do turno sendo mostrado: o que aconteceu e como o tabuleiro ficou. */
export type Stage = { event: DuelEvent; snap: Snapshot; prev: Snapshot | null; index: number; total: number };

export type DuelSpeed = 'normal' | 'rapido';

type TableProps = {
  view: DuelView;
  art: CardArt;
  opponentName: string;
  /** Imagem de fundo da arena, pelo identificador do cenário. */
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
  onHistory: () => void;
  /** Turno sendo repetido passo a passo (a mesa fica travada). */
  stage: Stage | null;
  onAdvance: () => void;
  onSkip: () => void;
  speed: DuelSpeed;
  onSpeed: () => void;
  /** Enquanto o bot pensa ou a rodada termina, a mesa fica travada. */
  busy: boolean;
};

type Drag = { uid: number; x: number; y: number; lane: number | null };

const EVENT_ICON: Partial<Record<DuelEvent['type'], string>> = {
  reveal: '🃏',
  power: '✨',
  destroy: '💥',
  move: '↔️',
  create: '🌱',
  draw: '📥',
  vanish: '💨',
  return: '↩️',
  silence: '🤫',
  scenario: '🗺️',
  turn: '⏱️',
  double: '🎲',
  retreat: '🏳️',
  win: '🏆',
  bounce: '↩️',
  discard: '🗑️',
  convert: '🤝',
  energy: '⚡',
};

type LaneCards = { foe: SnapCard[]; me: SnapCard[]; mine: number; theirs: number; open: boolean; scenario: ScenarioDef | null; slots: number };

/** Mesa do Duelo em retrato (como o Marvel Snap): rival em cima, as arenas no meio com o placar, você embaixo. */
export function DuelTable({ view, art, opponentName, laneImage, selectedUid, onSelect, onStage, onUnstage, onReady, onDouble, onRetreat, onExit, onHelp, onHistory, stage, onAdvance, onSkip, speed, onSpeed, busy }: TableProps) {
  const [detail, setDetail] = useState<{ def: CardDef; power?: number } | null>(null);
  const [arenaInfo, setArenaInfo] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const press = useRef<{ uid: number; x: number; y: number; type: string } | null>(null);

  const foe = view.you === 0 ? 1 : 0;
  const stagedUids = useMemo(() => new Set(view.staged.map((play) => play.uid)), [view.staged]);
  const hand = view.hand.filter((card) => !stagedUids.has(card.uid));
  const selected = hand.find((card) => card.uid === selectedUid) ?? null;
  const playing = stage !== null;
  const locked = busy || playing || view.ready || view.status !== 'playing';

  // O que cada arena mostra: o passo do turno que está passando, ou a mesa de verdade.
  const lanes: LaneCards[] = view.lanes.map((lane, index) => {
    const snap = stage?.snap[index];
    if (snap) {
      return { foe: snap.cards[foe], me: snap.cards[view.you], mine: snap.power[view.you], theirs: snap.power[foe], open: snap.open, scenario: snap.open ? lane.scenario : null, slots: lane.slots };
    }
    const decorate = (side: 0 | 1): SnapCard[] => lane.cards[side].map((card) => ({ uid: card.uid, def: card.def, power: card.power, silenced: card.silenced }));
    return { foe: decorate(foe), me: decorate(view.you), mine: lane.power[view.you], theirs: lane.power[foe], open: lane.open, scenario: lane.scenario, slots: lane.slots };
  });

  // Carta saindo (afastada, devolvida ou que sumiu): aparece uma última vez, desaparecendo.
  const leaving = useMemo(() => {
    if (!stage || !['destroy', 'vanish', 'bounce'].includes(stage.event.type) || stage.event.uid === undefined) return null;
    const uid = stage.event.uid;
    for (let laneIndex = 0; laneIndex < (stage.prev?.length ?? 0); laneIndex += 1) {
      for (const side of [0, 1] as const) {
        const card = stage.prev![laneIndex].cards[side].find((entry) => entry.uid === uid);
        if (card) return { lane: laneIndex, side, card };
      }
    }
    return null;
  }, [stage]);

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

  // Arrastar a carta da mão para uma arena (mouse: qualquer direção; dedo: para cima, para a rolagem da mão continuar livre).
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
  const focusUid = stage?.event.uid;
  const focusLane = stage && focusUid === undefined ? stage.event.lane : undefined;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg" role="dialog" aria-modal="true" aria-label="Duelo de Cartas">
      <header className="flex shrink-0 items-center gap-2 border-b border-edge bg-surface/90 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
        <Tooltip content="Sair do duelo" side="bottom">
          <button type="button" onClick={onExit} aria-label="Sair do duelo" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-3 text-muted hover:text-ink">
            <CloseRoundedIcon />
          </button>
        </Tooltip>
        <div className={cn('min-w-0 flex-1 rounded-2xl px-2 py-0.5 transition', view.priority === foe && 'bg-primary/20 ring-2 ring-primary/60')}>
          <p className="truncate font-display text-base font-bold text-ink">{opponentName}</p>
          <p className="truncate text-xs font-semibold text-muted">
            Mão {view.opponent.handCount} · Baralho {view.opponent.deckCount} · {view.status === 'finished' ? 'fim' : view.opponent.ready ? '✓ pronto' : 'pensando...'}
            {view.priority === foe ? ' · revela primeiro' : ''}
          </p>
        </div>
        <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full bg-primary font-display leading-none text-on-primary shadow-[0_3px_0_var(--primary-strong)]" aria-label={`Turno ${view.turn} de ${TURNS}`}>
          <span className="text-lg font-bold">{view.turn}</span>
          <span className="text-[9px] font-bold opacity-70">de {TURNS}</span>
        </span>
        <span className={cn('flex h-10 min-w-10 items-center justify-center rounded-2xl px-2 font-display text-sm font-bold', view.stakes > 1 ? 'bg-danger text-white' : 'bg-surface-3 text-muted')} aria-label={`Aposta ${view.stakes}`}>
          ×{view.stakes}
        </span>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-3 gap-2 px-2 py-2" onClick={playing ? onAdvance : undefined}>
        {lanes.map((lane, index) => {
          const stagedHere = view.staged.filter((play) => play.lane === index).map((play) => view.hand.find((card) => card.uid === play.uid)).filter((card): card is NonNullable<typeof card> => Boolean(card));
          const droppable = drag ? canPlace(drag.uid, index) : false;
          const targetable = selected && !locked ? canPlace(selected.uid, index) : false;
          const leavingHere = leaving?.lane === index ? leaving : null;
          return (
            <section
              key={index}
              data-lane={index}
              aria-label={lane.scenario ? lane.scenario.name : `Arena ${index + 1}, aparece no turno ${index + 1}`}
              onClick={() => {
                if (selected && !locked && canPlace(selected.uid, index)) onStage(selected.uid, index);
              }}
              className={cn('flex min-h-0 flex-col items-stretch rounded-2xl transition', (droppable || targetable) && 'bg-primary/10 ring-2 ring-primary/60', droppable && drag?.lane === index && 'bg-primary/25 ring-4')}
            >
              <CardsArea side="foe" cards={lane.foe} art={art} focusUid={focusUid} leaving={leavingHere?.side === foe ? leavingHere.card : null} onOpen={(card) => setDetail({ def: card.def, power: card.power })} />
              <Arena lane={lane} index={index} image={lane.scenario ? laneImage(lane.scenario.id) : null} focus={focusLane === index} onInfo={() => setArenaInfo(index)} />
              <CardsArea
                side="me"
                cards={lane.me}
                staged={playing ? [] : stagedHere}
                art={art}
                focusUid={focusUid}
                leaving={leavingHere?.side === view.you ? leavingHere.card : null}
                onOpen={(card) => setDetail({ def: card.def, power: card.power })}
                onUnstage={locked ? undefined : onUnstage}
              />
            </section>
          );
        })}
      </main>

      <footer className="shrink-0 space-y-1.5 border-t border-edge bg-surface/90 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur">
        <div className="flex min-h-[5.25rem] items-stretch gap-2 rounded-2xl bg-surface-2 px-3 py-2">
          <div className="min-w-0 flex-1" aria-live="polite">
          {stage ? (
            <Narration stage={stage} art={art} onSkip={onSkip} />
          ) : selected ? (
            <CardReadout def={selected.def} power={selected.def.power + selected.bonus} />
          ) : (
            <p className="flex h-full min-h-[4.25rem] items-center text-sm font-semibold leading-snug text-muted">
              {view.status !== 'playing' ? 'Fim da rodada.' : view.ready ? 'Pronto! Esperando o rival...' : busy ? 'Aguarde...' : 'Toque numa carta da mão para ler o poder dela. Depois toque numa arena (ou arraste a carta até ela).'}
            </p>
          )}
          </div>
          {stage ? null : (
            <div className="flex shrink-0 flex-col justify-center gap-1">
              <Tooltip content={speed === 'normal' ? 'Animações normais (toque para acelerar)' : 'Animações rápidas (toque para voltar ao normal)'} side="top">
                <button type="button" onClick={onSpeed} aria-label="Velocidade das animações" aria-pressed={speed === 'rapido'} className={cn('flex h-8 w-8 items-center justify-center rounded-xl', speed === 'rapido' ? 'bg-primary text-on-primary' : 'bg-surface-3 text-muted hover:text-ink')}>
                  <FastForwardRoundedIcon fontSize="small" />
                </button>
              </Tooltip>
              <Tooltip content="O que aconteceu" side="top">
                <button type="button" onClick={onHistory} aria-label="O que aconteceu" className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-3 text-muted hover:text-ink">
                  <HistoryRoundedIcon fontSize="small" />
                </button>
              </Tooltip>
              <Tooltip content="Como jogar" side="top">
                <button type="button" onClick={onHelp} aria-label="Como jogar" className="flex h-8 w-8 items-center justify-center rounded-xl bg-surface-3 text-muted hover:text-ink">
                  <HelpOutlineRoundedIcon fontSize="small" />
                </button>
              </Tooltip>
            </div>
          )}
        </div>
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
          <Button size="sm" variant="ghost" onClick={onRetreat} disabled={!view.canRetreat || busy || playing || view.status !== 'playing'} className="text-danger">
            <FlagRoundedIcon fontSize="small" /> Desistir
          </Button>
          <span className="flex h-11 min-w-11 items-center justify-center rounded-full bg-info px-2 font-display text-lg font-bold text-white shadow-md" aria-label={`Vigor ${view.energyLeft} de ${view.energy}`}>
            <AnimatedNumber value={view.energyLeft} />
            <span className="text-[10px] font-semibold opacity-80">/{view.energy}</span>
          </span>
          <span className="flex-1" />
          <Button size="sm" variant="secondary" onClick={onDouble} disabled={!view.canDouble || busy || playing}>
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

      <Modal open={detail !== null} size="sm" title={detail?.def.name ?? ''} onClose={() => setDetail(null)} footer={<Button onClick={() => setDetail(null)}>Fechar</Button>}>
        {detail ? <DuelCardDetail def={detail.def} art={art} power={detail.power} /> : null}
      </Modal>

      <Modal
        open={arenaInfo !== null}
        size="sm"
        title={arenaInfo !== null && lanes[arenaInfo]?.scenario ? `${lanes[arenaInfo].scenario!.emoji} ${lanes[arenaInfo].scenario!.name}` : 'Arena'}
        onClose={() => setArenaInfo(null)}
        footer={<Button onClick={() => setArenaInfo(null)}>Fechar</Button>}
      >
        {arenaInfo !== null && lanes[arenaInfo]?.scenario ? (
          <div className="space-y-3 text-sm font-semibold text-ink">
            <p>{lanes[arenaInfo].scenario!.text}</p>
            <p className="text-muted">Cabem {lanes[arenaInfo].slots} cartas de cada lado. Vence a arena quem tiver mais Influência nela.</p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

/** Narração do passo atual: quem agiu, qual é o poder e o que mudou. */
function Narration({ stage, art, onSkip }: { stage: Stage; art: CardArt; onSkip: () => void }) {
  const event = stage.event;
  const card = event.snap?.flatMap((lane) => [...lane.cards[0], ...lane.cards[1]]).find((entry) => entry.uid === event.uid)?.def ?? stage.prev?.flatMap((lane) => [...lane.cards[0], ...lane.cards[1]]).find((entry) => entry.uid === event.uid)?.def;
  return (
    <div key={`${stage.index}-${event.type}`} className="animate-duel-narration flex items-center gap-3">
      {card ? <DuelCardFace def={card} art={art} /> : <span className="flex h-[4.6rem] w-[3.4rem] shrink-0 items-center justify-center rounded-lg bg-surface-3 text-3xl">{EVENT_ICON[event.type] ?? '✨'}</span>}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-snug text-ink">
          {EVENT_ICON[event.type]} {event.text}
        </p>
        {event.dom ? <p className="mt-0.5 text-xs font-semibold leading-snug text-muted">Dom: {event.dom}</p> : null}
        <p className="mt-0.5 text-[10px] font-semibold text-muted/80">
          Passo {stage.index + 1} de {stage.total} · toque na mesa para avançar
        </p>
      </div>
      <Button size="sm" variant="ghost" onClick={onSkip} aria-label="Pular o resto do turno">
        <SkipNextRoundedIcon fontSize="small" />
      </Button>
    </div>
  );
}

/** Leitura da carta escolhida na mão: nome, números, etiquetas e o texto do Dom por inteiro. */
function CardReadout({ def, power }: { def: CardDef; power: number }) {
  return (
    <div className="animate-duel-narration space-y-0.5">
      <p className="flex flex-wrap items-center gap-x-2 text-sm font-bold text-ink">
        {def.name}
        <span className="rounded-full bg-info px-2 py-0.5 text-[11px] text-white">Vigor {def.cost}</span>
        <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px]">Influência {power}</span>
        {def.tags.map((tag) => (
          <span key={tag} className="rounded-full bg-violet/15 px-2 py-0.5 text-[11px] text-violet-strong dark:text-violet">
            {tag}
          </span>
        ))}
      </p>
      <p className="text-sm font-semibold leading-snug text-ink">{def.dom ? `✨ ${describeDom(def.dom)}` : 'Sem Dom: só a Influência.'}</p>
    </div>
  );
}

/** A arena (centro da coluna): arte, nome, o que ela faz e o placar dos dois lados. */
function Arena({ lane, index, image, focus, onInfo }: { lane: LaneCards; index: number; image: string | null; focus: boolean; onInfo: () => void }) {
  return (
    <div className="relative my-3 shrink-0">
      <div className="absolute inset-x-0 -top-3.5 z-10 flex justify-center">
        {lane.open ? lane.theirs > lane.mine ? <PowerHex value={lane.theirs} tone="foe" /> : <NeutralHex value={lane.theirs} /> : null}
      </div>
      <button
        type="button"
        data-sound="soft"
        onClick={(event) => {
          event.stopPropagation();
          if (lane.scenario) onInfo();
        }}
        className={cn(
          'relative flex h-[8.5rem] w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border-[3px] bg-surface-3 px-1.5 py-4 text-center shadow-lg transition',
          lane.open ? 'border-primary-strong' : 'border-edge-strong',
          focus && 'animate-duel-focus',
          lane.open && 'animate-duel-arena',
        )}
        aria-label={lane.scenario ? `${lane.scenario.name}: ${lane.scenario.text}` : `Arena ${index + 1}, aparece no turno ${index + 1}`}
      >
        {image && lane.open ? <img src={image} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full object-cover" onError={(event) => (event.currentTarget.style.display = 'none')} /> : null}
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/70" />
        {lane.scenario ? (
          <>
            <span className="relative font-display text-[13px] font-bold leading-tight text-white drop-shadow">
              {lane.scenario.emoji} {lane.scenario.name}
            </span>
            <span className="relative text-[11px] font-semibold leading-tight text-white/95 drop-shadow">{lane.scenario.text}</span>
          </>
        ) : (
          <span className="relative font-display text-sm font-bold text-white/90">🔒 Aparece no turno {index + 1}</span>
        )}
      </button>
      <div className="absolute inset-x-0 -bottom-3.5 z-10 flex justify-center">
        {lane.open ? lane.mine > lane.theirs ? <PowerHex value={lane.mine} tone="me" /> : <NeutralHex value={lane.mine} /> : null}
      </div>
    </div>
  );
}

function CardsArea({
  cards,
  staged = [],
  art,
  side,
  focusUid,
  leaving,
  onOpen,
  onUnstage,
}: {
  cards: SnapCard[];
  staged?: Array<{ uid: number; def: CardDef }>;
  art: CardArt;
  side: 'me' | 'foe';
  focusUid?: number;
  leaving?: SnapCard | null;
  onOpen: (card: SnapCard) => void;
  onUnstage?: (uid: number) => void;
}) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-wrap content-start justify-center gap-1 px-0.5 py-1', side === 'foe' ? 'content-end' : 'content-start')}>
      {cards.map((card) => (
        <DuelCardFace key={card.uid} def={card.def} art={art} power={card.power} silenced={card.silenced} animate focus={focusUid === card.uid} onClick={() => onOpen(card)} className="animate-duel-in" />
      ))}
      {leaving ? <DuelCardFace key={`leaving-${leaving.uid}`} def={leaving.def} art={art} power={leaving.power} className="animate-duel-leave" /> : null}
      {staged.map((card) => (
        <DuelCardFace key={card.uid} def={card.def} art={art} className="opacity-70 ring-2 ring-primary" onClick={onUnstage ? () => onUnstage(card.uid) : undefined} />
      ))}
    </div>
  );
}
