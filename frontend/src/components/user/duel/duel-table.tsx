import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
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
import { MotionLayer, useCardMotion } from '@/components/user/duel/use-card-motion';
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
  /** Muda uma figurinha já colocada para outra arena. */
  onRestage: (uid: number, lane: number) => void;
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
  /** O que a aposta vale nesta série ("2 pontos", "4 de dano"); vazio quando a aposta não vale nada. */
  stakesText?: string | null;
  /** Relógio do turno (só na sala online): segundos que restam e o total. */
  timer?: { remaining: number; total: number; waiting: boolean } | null;
  /** Extra no cabeçalho (sala online: código e placar da série). */
  extra?: ReactNode;
};

type Drag = { uid: number; x: number; y: number; lane: number | null; from: 'hand' | 'staged'; origin: number | null };
type Press = { uid: number; x: number; y: number; type: string; from: 'hand' | 'staged'; origin: number | null };

const EVENT_ICON: Partial<Record<DuelEvent['type'], string>> = {
  reveal: '🃏',
  dom: '✨',
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

/** A mesa do Duelo: o rival em cima, as arenas no meio (com o placar de cada lado) e a sua mão embaixo. */
export function DuelTable({ view, art, opponentName, laneImage, selectedUid, onSelect, onStage, onUnstage, onRestage, onReady, onDouble, onRetreat, onExit, onHelp, onHistory, stage, onAdvance, onSkip, speed, onSpeed, busy, stakesText, timer, extra }: TableProps) {
  const [detail, setDetail] = useState<{ def: CardDef; power?: number } | null>(null);
  const [arenaInfo, setArenaInfo] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const press = useRef<Press | null>(null);
  const justDragged = useRef(false);
  const boardRef = useRef<HTMLElement | null>(null);

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

  // Movimento das figurinhas: voos, entradas, saídas e números subindo (ver use-card-motion.tsx).
  const layoutKey = [lanes.map((lane) => `${lane.foe.map((card) => card.uid).join(',')}/${lane.me.map((card) => card.uid).join(',')}`).join('|'), view.staged.map((play) => `${play.uid}@${play.lane}`).join(','), stage ? `s${stage.index}` : 'n'].join('#');
  const lookup = useCallback(
    (uid: number) => {
      const fromSnap = (snap: Snapshot | null | undefined) => snap?.flatMap((lane) => [...lane.cards[0], ...lane.cards[1]]).find((card) => card.uid === uid);
      return fromSnap(stage?.prev) ?? fromSnap(stage?.snap) ?? view.lanes.flatMap((lane) => [...lane.cards[0], ...lane.cards[1]]).find((card) => card.uid === uid);
    },
    [stage, view.lanes],
  );
  const pace = speed === 'rapido' ? 0.5 : 1;
  const motion = useCardMotion(boardRef, { layoutKey, event: stage?.event ?? null, stageIndex: stage ? stage.index : null, lookup, pace });

  const canPlace = useCallback(
    (uid: number, lane: number, moving = false) => {
      const card = view.hand.find((entry) => entry.uid === uid);
      const info = view.lanes[lane];
      if (!card || !info) return false;
      // Dá para jogar numa arena que ainda não apareceu (às cegas); o espaço só é conferido de verdade na revelação.
      const used = info.cards[view.you].length + view.staged.filter((play) => play.lane === lane && play.uid !== uid).length;
      return used < info.slots && (moving || card.def.cost <= view.energyLeft);
    },
    [view],
  );

  function laneUnder(x: number, y: number): number | null {
    const element = document.elementsFromPoint(x, y).find((node) => (node as HTMLElement).dataset?.lane !== undefined && (node as HTMLElement).tagName === 'SECTION') as HTMLElement | undefined;
    return element ? Number(element.dataset.lane) : null;
  }

  // Arrastar uma figurinha: da mão para uma arena, ou de uma arena para outra (ou de volta à mão para tirar).
  // Mouse: qualquer direção. Dedo: da mão só para cima (a rolagem da mão continua livre); das arenas, qualquer direção.
  useEffect(() => {
    function move(event: PointerEvent) {
      const start = press.current;
      if (!start) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (!dragRef.current) {
        const far = Math.hypot(dx, dy) > 9;
        const upward = start.type === 'mouse' || start.from === 'staged' || (dy < -9 && Math.abs(dy) > Math.abs(dx) * 0.8);
        if (!far || !upward) return;
        playSfx('swipe');
        if (start.from === 'hand') onSelect(start.uid);
      }
      const next: Drag = { uid: start.uid, x: event.clientX, y: event.clientY, lane: laneUnder(event.clientX, event.clientY), from: start.from, origin: start.origin };
      dragRef.current = next;
      setDrag(next);
    }
    function up() {
      const current = dragRef.current;
      const start = press.current;
      press.current = null;
      dragRef.current = null;
      setDrag(null);
      if (!current || !start) return;
      // O toque que vem depois de arrastar não pode contar como clique.
      justDragged.current = true;
      window.setTimeout(() => (justDragged.current = false), 80);
      if (current.from === 'hand') {
        if (current.lane !== null && canPlace(current.uid, current.lane)) onStage(current.uid, current.lane);
      } else if (current.lane === null) {
        onUnstage(current.uid);
      } else if (current.lane !== current.origin && canPlace(current.uid, current.lane, true)) {
        onRestage(current.uid, current.lane);
      }
    }
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [canPlace, onSelect, onStage, onUnstage, onRestage]);

  const dragCard = drag ? view.hand.find((card) => card.uid === drag.uid) : null;
  const focusUid = stage?.event.uid;
  const focusLane = stage && focusUid === undefined ? stage.event.lane : undefined;
  const youCanDouble = view.stakesMatter && view.canDouble && !busy && !playing;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg" role="dialog" aria-modal="true" aria-label="Duelo de Figurinhas">
      <header className="flex shrink-0 items-center gap-2 border-b border-edge bg-surface/90 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
        <Tooltip content="Sair do duelo" side="bottom">
          <button type="button" onClick={onExit} aria-label="Sair do duelo" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-3 text-muted hover:text-ink">
            <CloseRoundedIcon />
          </button>
        </Tooltip>
        <div data-foe-zone className={cn('min-w-0 flex-1 rounded-2xl px-2 py-0.5 transition', view.priority === foe && 'bg-primary/20 ring-2 ring-primary/60')}>
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
      </header>

      <div className="flex shrink-0 flex-wrap items-center justify-center gap-2 border-b border-edge bg-surface-2/80 px-3 py-1.5">
        <StakesBadge stakes={view.stakes} matter={view.stakesMatter} text={stakesText} />
        {timer ? <TurnClock timer={timer} /> : null}
        {extra}
        {stage ? null : (
          <div className="ml-auto flex shrink-0 items-center gap-1">
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
            <Tooltip content={`Desistir da rodada (perde ×${view.retreatCost})`} side="top">
              <button type="button" onClick={onRetreat} disabled={!view.canRetreat || busy || view.status !== 'playing'} aria-label={`Desistir da rodada, perde ${view.retreatCost}`} className="flex h-8 w-8 items-center justify-center rounded-xl bg-danger/15 text-danger hover:bg-danger/25 disabled:opacity-40">
                <FlagRoundedIcon fontSize="small" />
              </button>
            </Tooltip>
          </div>
        )}
      </div>

      {timer ? (
        <div className="h-1.5 w-full shrink-0 bg-surface-3" aria-hidden="true">
          <div
            className={cn('h-full transition-[width] duration-500 ease-linear', timer.remaining <= 10 ? 'bg-danger' : timer.remaining / Math.max(timer.total, 1) < 0.5 ? 'bg-primary' : 'bg-success')}
            style={{ width: `${Math.max(0, Math.min(100, (timer.remaining / Math.max(timer.total, 1)) * 100))}%` }}
          />
        </div>
      ) : null}

      <main ref={boardRef} className="grid min-h-0 flex-1 grid-cols-3 gap-2 overflow-y-auto px-2 py-2" onClick={playing ? onAdvance : undefined}>
        {lanes.map((lane, index) => {
          const stagedHere = view.staged.filter((play) => play.lane === index).map((play) => view.hand.find((card) => card.uid === play.uid)).filter((card): card is NonNullable<typeof card> => Boolean(card));
          const droppable = drag ? (drag.from === 'staged' ? drag.origin !== index && canPlace(drag.uid, index, true) : canPlace(drag.uid, index)) : false;
          const targetable = selected && !locked ? canPlace(selected.uid, index) : false;
          return (
            <section
              key={index}
              data-lane={index}
              aria-label={lane.scenario ? lane.scenario.name : `Arena ${index + 1}, aparece no turno ${index + 1}`}
              onClick={() => {
                if (selected && !locked && canPlace(selected.uid, index)) onStage(selected.uid, index);
              }}
              className={cn('flex flex-col items-stretch rounded-2xl transition', (droppable || targetable) && 'bg-primary/10 ring-2 ring-primary/60', droppable && drag?.lane === index && 'bg-primary/25 ring-4')}
            >
              <CardsArea side="foe" lane={index} cards={lane.foe} art={art} focusUid={focusUid} onOpen={(card) => setDetail({ def: card.def, power: card.power })} />
              <Arena lane={lane} index={index} image={lane.scenario ? laneImage(lane.scenario.id) : null} focus={focusLane === index} dropHint={droppable && drag?.lane === index} blindHint={targetable || droppable} onInfo={() => setArenaInfo(index)} />
              <CardsArea
                side="me"
                lane={index}
                cards={lane.me}
                staged={playing ? [] : stagedHere}
                art={art}
                focusUid={focusUid}
                onOpen={(card) => setDetail({ def: card.def, power: card.power })}
                onUnstage={locked ? undefined : onUnstage}
                canDragStaged={!locked}
                suppressClick={justDragged}
                dragging={drag?.uid ?? null}
                onStagedPointerDown={(uid, event) => {
                  if (locked) return;
                  press.current = { uid, x: event.clientX, y: event.clientY, type: event.pointerType, from: 'staged', origin: index };
                }}
              />
            </section>
          );
        })}
      </main>

      <footer className="shrink-0 space-y-1.5 border-t border-edge bg-surface/90 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur">
        {view.foeDoubledNow && view.status === 'playing' && !playing ? (
          <FoeDoubledNotice key={`${view.turn}-${view.stakes}`} stakes={view.stakes} cost={view.retreatCost} canRetreat={view.canRetreat && !busy} onRetreat={onRetreat} />
        ) : null}
        <div className="flex min-h-[2.75rem] items-stretch gap-2 rounded-2xl bg-surface-2 px-3 py-1">
          <div className="min-w-0 flex-1" aria-live="polite">
            {stage ? (
              <Narration stage={stage} art={art} onSkip={onSkip} />
            ) : selected ? (
              <CardReadout def={selected.def} power={selected.def.power + selected.bonus} />
            ) : (
              <p className="flex h-full min-h-[2.5rem] items-center text-xs font-semibold leading-snug text-muted">
                {view.status !== 'playing'
                  ? 'Fim da rodada.'
                  : view.ready
                    ? 'Pronto! Esperando o rival...'
                    : busy
                      ? 'Aguarde...'
                      : 'Toque numa figurinha para ler o Dom; depois toque numa arena ou arraste até ela.'}
              </p>
            )}
          </div>
        </div>
        <div data-hand-zone className="no-scrollbar flex items-end justify-start gap-1.5 overflow-x-auto px-1 pb-1 pt-3 sm:justify-center">
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
                // pan-x: deslizar de lado rola a mão; para cima, o navegador não rola e o dedo arrasta a figurinha.
                style={{ touchAction: 'pan-x' }}
                className={cn('cursor-pointer', drag?.uid === card.uid && 'opacity-30')}
                onClick={() => {
                  if (justDragged.current) return;
                  if (!locked) onSelect(selectedUid === card.uid ? null : card.uid);
                }}
                onPointerDown={(event) => {
                  if (locked) return;
                  press.current = { uid: card.uid, x: event.clientX, y: event.clientY, type: event.pointerType, from: 'hand', origin: null };
                }}
              />
            );
          })}
        </div>
        <VigorPanel view={view} selectedCost={selected ? selected.def.cost : null} />
        <div className="flex items-center gap-2">
          {view.stakesMatter ? (
            <Button size="sm" variant="secondary" className="shrink-0" onClick={onDouble} disabled={!youCanDouble} aria-label={`Dobrar a aposta para ${view.stakes * 2}`}>
              Dobrar <b className="text-danger">×{Math.min(view.stakes * 2, 16)}</b>
            </Button>
          ) : null}
          <Button size="md" className="flex-1" onClick={onReady} disabled={locked} aria-label={`Pronto, turno ${view.turn} de ${TURNS}`}>
            Pronto {view.turn}/{TURNS}
          </Button>
        </div>
      </footer>

      <MotionLayer ghosts={motion.ghosts} floats={motion.floats} trail={motion.trail} art={art} pace={pace} onGhostDone={motion.dropGhost} />

      {drag && dragCard ? (
        <div className="pointer-events-none fixed z-[70]" style={{ left: drag.x, top: drag.y, transform: 'translate(-50%, -60%) scale(1.1) rotate(-4deg)' }}>
          <DuelCardFace def={dragCard.def} art={art} size="hand" power={dragCard.def.power + dragCard.bonus} className="shadow-2xl ring-4 ring-primary/60" />
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
            <p className="text-muted">Cabem {lanes[arenaInfo].slots} figurinhas de cada lado. Vence a arena quem tiver mais Influência nela.</p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

/** Quanto vale a rodada, bem à vista: o número da aposta e o que ele significa na série (pontos, dano). */
function StakesBadge({ stakes, matter, text }: { stakes: number; matter: boolean; text?: string | null }) {
  if (!matter) {
    return <span className="rounded-2xl bg-surface-3 px-3 py-1 text-xs font-bold text-muted">Sem aposta nesta partida</span>;
  }
  return (
    <div
      key={stakes}
      className={cn('flex items-center gap-2 rounded-2xl px-3 py-1 font-display shadow-sm', stakes > 1 ? 'animate-duel-stakes bg-danger text-white' : 'bg-surface-3 text-ink')}
      aria-label={`Esta rodada vale ${stakes}${text ? `: ${text}` : ''}`}
    >
      <span className="flex flex-col items-center leading-none">
        <span className="text-[9px] font-bold uppercase tracking-wider opacity-80">Vale</span>
        <span className="text-3xl font-black">×{stakes}</span>
      </span>
      {text ? <span className="max-w-[7rem] text-xs font-bold leading-tight">{text}</span> : null}
    </div>
  );
}

/** Relógio do turno (sala online): anel que esvazia, vermelho e pulsando nos últimos segundos. */
function TurnClock({ timer }: { timer: { remaining: number; total: number; waiting: boolean } }) {
  const { remaining, total, waiting } = timer;
  const fraction = Math.max(0, Math.min(1, remaining / Math.max(total, 1)));
  const urgent = remaining <= 10;
  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="flex items-center gap-2" role="timer" aria-label={`${remaining} segundos para o turno terminar`}>
      <span className={cn('relative flex h-12 w-12 items-center justify-center', urgent && remaining > 0 && 'animate-duel-tick')}>
        <svg viewBox="0 0 44 44" className="absolute inset-0 h-full w-full -rotate-90">
          <circle cx="22" cy="22" r={radius} fill="none" strokeWidth="5" className="stroke-surface-3" />
          <circle cx="22" cy="22" r={radius} fill="none" strokeWidth="5" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - fraction)} className={cn('transition-[stroke-dashoffset] duration-500 ease-linear', urgent ? 'stroke-danger' : fraction < 0.5 ? 'stroke-primary' : 'stroke-success')} />
        </svg>
        <span className={cn('relative font-display text-base font-black tabular-nums', urgent ? 'text-danger' : 'text-ink')}>{remaining}</span>
      </span>
      <span className="text-[11px] font-bold leading-tight text-muted">{waiting ? 'Esperando\no rival' : 'Tempo do\nturno'}</span>
    </div>
  );
}

/**
 * O Vigor do turno, bem à vista: quanto sobra agora (número grande), de onde veio (turno + guardado + bônus) e quanto
 * vai ficar guardado para o próximo turno. Cada raio é 1 de Vigor: cheio = ainda dá para gastar, vazio = já usado.
 */
function VigorPanel({ view, selectedCost }: { view: DuelView; selectedCost: number | null }) {
  const { turn, bonus, carry } = view.energyParts;
  const total = view.energy;
  const left = view.energyLeft;
  const spent = total - left;
  const [delta, setDelta] = useState<{ id: number; amount: number } | null>(null);
  const last = useRef(left);
  useEffect(() => {
    const change = left - last.current;
    last.current = left;
    if (change === 0) return;
    const id = Date.now();
    setDelta({ id, amount: change });
    const timer = window.setTimeout(() => setDelta((current) => (current?.id === id ? null : current)), 1300);
    return () => window.clearTimeout(timer);
  }, [left]);
  const preview = selectedCost !== null && selectedCost <= left ? left - selectedCost : null;
  const parts = [`turno ${turn}`, carry > 0 ? `+${carry} guardado` : null, bonus > 0 ? `+${bonus} de Dom` : null].filter(Boolean).join(' ');
  // Raios: primeiro os guardados (dourados), depois os do turno (azuis) e os de Dons (verdes); os usados ficam vazios.
  const pips = Array.from({ length: total }, (_, index) => {
    const origin = index < carry ? 'carry' : index < carry + turn ? 'turn' : 'bonus';
    return { origin, used: index >= left };
  });
  return (
    <div className="relative flex w-full items-center gap-3 rounded-2xl border-2 border-info/50 bg-info/10 px-2.5 py-1" role="group" aria-label={`Vigor: sobram ${left} de ${total}`}>
      <span className="relative flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full bg-info font-display leading-none text-white shadow-[0_3px_0_rgba(0,0,0,0.25),0_0_0_3px_rgba(255,255,255,0.3)_inset]">
        <span className="text-2xl font-black">
          <AnimatedNumber value={left} />
        </span>
        <span className="text-[8px] font-bold uppercase tracking-wide opacity-90">Vigor</span>
        {delta ? (
          <span key={delta.id} className={cn('animate-duel-float pointer-events-none absolute -top-2 left-1/2 font-display text-xl font-black drop-shadow', delta.amount < 0 ? 'text-danger' : 'text-success')} aria-hidden="true">
            {delta.amount > 0 ? '+' : '−'}
            {Math.abs(delta.amount)}
          </span>
        ) : null}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold leading-tight text-ink">
          {left} de {total} <span className="font-semibold text-muted">· {parts}</span>
        </p>
        <div className="mt-1 flex flex-wrap gap-[3px]" aria-hidden="true">
          {pips.map((pip, index) => (
            <span
              key={index}
              className={cn(
                'h-4 w-3 transition-all duration-300',
                pip.used ? 'scale-90 border border-edge-strong bg-transparent opacity-60' : pip.origin === 'carry' ? 'bg-amber-400' : pip.origin === 'turn' ? 'bg-info' : 'bg-success',
              )}
              style={{ clipPath: 'polygon(55% 0, 0 58%, 42% 58%, 30% 100%, 100% 38%, 55% 38%)' }}
            />
          ))}
        </div>
        <p className="mt-1 text-[11px] font-semibold leading-tight text-muted">
          {preview !== null ? `Jogando a escolhida (−${selectedCost}) sobram ${preview}` : spent > 0 ? `Gastou ${spent} · se parar agora guarda ${left} para o próximo turno` : left > 0 ? `O que não gastar fica guardado (${left})` : 'Sem Vigor: toque em Pronto'}
        </p>
      </div>
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

/** Leitura da figurinha escolhida na mão: nome, números, etiquetas e o texto do Dom por inteiro. */
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
function Arena({ lane, index, image, focus, dropHint, blindHint, onInfo }: { lane: LaneCards; index: number; image: string | null; focus: boolean; dropHint: boolean; blindHint: boolean; onInfo: () => void }) {
  return (
    <div className="relative my-4 shrink-0">
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
          'relative flex min-h-[9.5rem] w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border-[3px] bg-surface-3 px-1.5 pb-7 pt-7 text-center shadow-lg transition',
          lane.open ? 'border-primary-strong' : 'border-edge-strong',
          focus && 'animate-duel-focus',
          lane.open && 'animate-duel-arena',
          dropHint && 'scale-[1.03] border-primary',
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
          <>
            <span className="relative font-display text-sm font-bold text-white/90">🔒 Aparece no turno {index + 1}</span>
            <span className="relative text-[10px] font-semibold leading-tight text-white/80">{blindHint ? 'Solte aqui: jogada às cegas' : 'Dá para jogar aqui às cegas'}</span>
          </>
        )}
        {dropHint ? <span className="relative mt-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-on-primary">Soltar aqui</span> : null}
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
  lane,
  focusUid,
  dragging,
  canDragStaged,
  suppressClick,
  onOpen,
  onUnstage,
  onStagedPointerDown,
}: {
  cards: SnapCard[];
  staged?: Array<{ uid: number; def: CardDef }>;
  art: CardArt;
  side: 'me' | 'foe';
  lane: number;
  focusUid?: number;
  dragging?: number | null;
  canDragStaged?: boolean;
  suppressClick?: { current: boolean };
  onOpen: (card: SnapCard) => void;
  onUnstage?: (uid: number) => void;
  onStagedPointerDown?: (uid: number, event: ReactPointerEvent<HTMLElement>) => void;
}) {
  return (
    <div className={cn('flex min-h-[5.1rem] flex-1 flex-wrap content-start justify-center gap-1 px-0.5 py-1', side === 'foe' ? 'content-end' : 'content-start')}>
      {cards.map((card) => (
        <DuelCardFace key={card.uid} def={card.def} art={art} power={card.power} silenced={card.silenced} animate focus={focusUid === card.uid} data={{ 'card-uid': card.uid, zone: side, lane }} onClick={() => onOpen(card)} />
      ))}
      {staged.map((card) => (
        <DuelCardFace
          key={card.uid}
          def={card.def}
          art={art}
          data={{ 'card-uid': card.uid, zone: 'staged', lane }}
          className={cn('opacity-80 ring-2 ring-primary ring-offset-1', canDragStaged && 'cursor-grab touch-none', dragging === card.uid && 'opacity-25')}
          onClick={
            onUnstage
              ? () => {
                  if (suppressClick?.current) return;
                  onUnstage(card.uid);
                }
              : undefined
          }
          onPointerDown={canDragStaged && onStagedPointerDown ? (event) => onStagedPointerDown(card.uid, event) : undefined}
        >
          <span className="absolute -right-0.5 bottom-3 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-black leading-none text-white shadow" aria-hidden="true">
            ✕
          </span>
        </DuelCardFace>
      ))}
    </div>
  );
}

/** Aviso de que o rival dobrou: flutua sobre a mesa (não empurra nada), some sozinho em alguns segundos e pode ser fechado. */
function FoeDoubledNotice({ stakes, cost, canRetreat, onRetreat }: { stakes: number; cost: number; canRetreat: boolean; onRetreat: () => void }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const timer = window.setTimeout(() => setOpen(false), 6000);
    return () => window.clearTimeout(timer);
  }, []);
  if (!open) return null;
  return (
    <div className="pointer-events-none fixed inset-x-2 top-16 z-40 flex justify-center">
      <div className="animate-duel-narration pointer-events-auto flex max-w-md items-center gap-2 rounded-2xl border-2 border-danger bg-surface px-2.5 py-1.5 shadow-lg" role="alert">
        <span className="text-xl" aria-hidden="true">
          🎲
        </span>
        <p className="min-w-0 flex-1 text-xs font-bold leading-tight text-ink">
          O rival dobrou: vale <b className="text-danger">×{stakes}</b>. Siga jogando ou desista perdendo só <b>×{cost}</b>.
        </p>
        <Button size="sm" variant="secondary" className="shrink-0 text-danger" onClick={onRetreat} disabled={!canRetreat}>
          <FlagRoundedIcon fontSize="small" /> Desistir
        </Button>
        <button type="button" className="shrink-0 rounded-full p-1 text-muted hover:text-ink" aria-label="Fechar aviso" onClick={() => setOpen(false)}>
          ✕
        </button>
      </div>
    </div>
  );
}
