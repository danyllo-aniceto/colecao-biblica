import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { CardDef, DuelEvent, SnapCard } from '@duel/types';
import { DuelCardFace, type CardArt } from '@/components/user/duel/duel-card';

/**
 * Movimento das figurinhas na mesa: cada mudança de lugar vira um voo de verdade (FLIP), para o jogador ver o que aconteceu.
 *  - mudou de arena ou de lado (empurrada, levada, convertida): voa do lugar antigo para o novo, com uma seta marcando o caminho;
 *  - entrou na mesa (revelada, criada): chega virando, da mão (suas) ou de cima (do rival);
 *  - saiu (afastada): treme e estoura; (devolvida à mão): voa até a mão do dono; (sumiu): sobe e desaparece;
 *  - mudou de Influência: o número "+3" ou "−2" sobe de cima da figurinha.
 */

type Zone = 'me' | 'foe' | 'staged';
type Entry = { rect: DOMRect; zone: Zone; lane: number };

export type Ghost = { id: number; card: SnapCard; rect: DOMRect; kind: 'destroy' | 'bounce' | 'vanish' | 'fade'; target: { x: number; y: number } | null };
export type Float = { id: number; x: number; y: number; text: string; tone: 'up' | 'down' | 'info' };
export type Trail = { id: number; from: { x: number; y: number }; to: { x: number; y: number }; tone: 'move' | 'convert' };

type Options = {
  /** Muda a cada arrumação da mesa (lugar de cada figurinha) e a cada passo da repetição. */
  layoutKey: string;
  /** Acontecimento do passo que está passando (null fora da repetição). */
  event: DuelEvent | null;
  /** Índice do passo (null fora da repetição): a troca para o primeiro passo não é animada. */
  stageIndex: number | null;
  /** Dados de uma figurinha pelo uid (para desenhar a que saiu da mesa). */
  lookup: (uid: number) => SnapCard | undefined;
  /** 1 = normal; menor = mais rápido. */
  pace: number;
};

let counter = 0;

const centerOf = (rect: DOMRect) => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });

export function useCardMotion(root: RefObject<HTMLElement | null>, { layoutKey, event, stageIndex, lookup, pace }: Options) {
  const before = useRef<Map<number, Entry>>(new Map());
  const first = useRef(true);
  const lastStage = useRef<number | null>(null);
  const [ghosts, setGhosts] = useState<Ghost[]>([]);
  const [floats, setFloats] = useState<Float[]>([]);
  const [trail, setTrail] = useState<Trail | null>(null);
  const eventRef = useRef(event);
  eventRef.current = event;
  const lookupRef = useRef(lookup);
  lookupRef.current = lookup;

  const dropGhost = useCallback((id: number) => setGhosts((list) => list.filter((ghost) => ghost.id !== id)), []);
  const dropFloat = useCallback((id: number) => setFloats((list) => list.filter((item) => item.id !== id)), []);

  useLayoutEffect(() => {
    const container = root.current;
    if (!container) return;
    const elements = new Map<number, HTMLElement>();
    const now = new Map<number, Entry>();
    container.querySelectorAll<HTMLElement>('[data-card-uid]').forEach((element) => {
      const uid = Number(element.dataset.cardUid);
      elements.set(uid, element);
      now.set(uid, { rect: element.getBoundingClientRect(), zone: element.dataset.zone as Zone, lane: Number(element.dataset.lane ?? -1) });
    });
    const old = before.current;
    before.current = now;

    // A primeira pintura, a entrada no primeiro passo da repetição e a volta à mesa final não são acontecimentos.
    const enteringStage = stageIndex === 0 && lastStage.current === null;
    const leavingStage = stageIndex === null && lastStage.current !== null;
    lastStage.current = stageIndex;
    const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (first.current) {
      first.current = false;
      return;
    }
    if (enteringStage || leavingStage || reduced) return;

    const ev = eventRef.current;
    const fly = (ms: number) => ms * pace;
    const handZone = container.parentElement?.querySelector<HTMLElement>('[data-hand-zone]') ?? document.querySelector<HTMLElement>('[data-hand-zone]');
    const foeZone = document.querySelector<HTMLElement>('[data-foe-zone]');
    const newGhosts: Ghost[] = [];

    // Quem estava na mesa e não está mais.
    old.forEach((entry, uid) => {
      if (now.has(uid) || entry.zone === 'staged') return;
      const card = lookupRef.current(uid);
      if (!card) return;
      const mine = ev?.uid === uid ? ev : null;
      const kind: Ghost['kind'] = mine?.type === 'destroy' ? 'destroy' : mine?.type === 'bounce' ? 'bounce' : mine?.type === 'vanish' ? 'vanish' : 'fade';
      const zone = entry.zone === 'me' ? handZone : foeZone;
      newGhosts.push({ id: ++counter, card, rect: entry.rect, kind, target: kind === 'bounce' && zone ? centerOf(zone.getBoundingClientRect()) : null });
    });
    if (newGhosts.length > 0) setGhosts((list) => [...list, ...newGhosts]);

    // Quem está na mesa agora.
    now.forEach((entry, uid) => {
      const element = elements.get(uid);
      if (!element) return;
      const was = old.get(uid);
      const isEventCard = ev?.uid === uid;
      if (!was) {
        if (entry.zone === 'staged') return;
        const fromHand = entry.zone === 'me' && handZone ? centerOf(handZone.getBoundingClientRect()) : null;
        const here = centerOf(entry.rect);
        const dx = fromHand ? fromHand.x - here.x : 0;
        const dy = fromHand ? fromHand.y - here.y : entry.zone === 'foe' ? -120 : 90;
        const create = ev?.type === 'create';
        element.animate(
          create
            ? [
                { transform: 'scale(0.2) rotate(-12deg)', opacity: 0, filter: 'brightness(2.2)' },
                { transform: 'scale(1.25) rotate(4deg)', opacity: 1, filter: 'brightness(1.6)', offset: 0.6 },
                { transform: 'none', opacity: 1, filter: 'none' },
              ]
            : [
                { transform: `translate(${dx}px, ${dy}px) rotateY(90deg) scale(0.7)`, opacity: 0.2 },
                { transform: 'translate(0, 0) rotateY(0deg) scale(1.18)', opacity: 1, offset: 0.7 },
                { transform: 'none', opacity: 1 },
              ],
          { duration: fly(create ? 800 : 750), easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'backwards' },
        );
        return;
      }
      const dx = was.rect.left - entry.rect.left;
      const dy = was.rect.top - entry.rect.top;
      const moved = Math.abs(dx) + Math.abs(dy) > 6;
      if (!moved) return;
      const traveling = isEventCard && (ev?.type === 'move' || ev?.type === 'convert');
      if (traveling) {
        // O voo que o jogador precisa ver: sobe, cruza a mesa e pousa, com a seta marcando o caminho.
        element.style.zIndex = '60';
        const glow = ev?.type === 'convert' ? 'drop-shadow(0 0 14px #fbbf24)' : 'drop-shadow(0 0 14px #38bdf8)';
        const animation = element.animate(
          [
            { transform: `translate(${dx}px, ${dy}px) scale(1)`, filter: 'none' },
            { transform: `translate(${dx * 0.85}px, ${dy * 0.85 - 18}px) scale(1.3) rotate(-6deg)`, filter: glow, offset: 0.25 },
            { transform: `translate(${dx * 0.1}px, ${dy * 0.1 - 18}px) scale(1.3) rotate(5deg)`, filter: glow, offset: 0.8 },
            { transform: 'none', filter: 'none' },
          ],
          { duration: fly(1300), easing: 'cubic-bezier(.45,.05,.25,1)' },
        );
        animation.onfinish = () => {
          element.style.zIndex = '';
        };
        setTrail({ id: ++counter, from: centerOf(was.rect), to: centerOf(entry.rect), tone: ev?.type === 'convert' ? 'convert' : 'move' });
        window.setTimeout(() => setTrail(null), fly(1700));
        return;
      }
      // Reacomodação normal (alguém saiu e as outras escorregam; da mão staged para a mesa).
      element.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: fly(520), easing: 'cubic-bezier(.25,.9,.3,1)' });
    });

    // Número subindo ou descendo sobre a figurinha.
    if (ev?.type === 'power' && ev.uid !== undefined && ev.amount) {
      const target = now.get(ev.uid);
      if (target) {
        const id = ++counter;
        const point = centerOf(target.rect);
        setFloats((list) => [...list, { id, x: point.x, y: target.rect.top, text: `${ev.amount! > 0 ? '+' : '−'}${Math.abs(ev.amount!)}`, tone: ev.amount! > 0 ? 'up' : 'down' }]);
        window.setTimeout(() => dropFloat(id), fly(1500));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey]);

  return { ghosts, floats, trail, dropGhost };
}

/** Camada por cima da mesa: figurinhas saindo, números flutuando e a seta do caminho percorrido. */
export function MotionLayer({ ghosts, floats, trail, art, onGhostDone, pace }: { ghosts: Ghost[]; floats: Float[]; trail: Trail | null; art: CardArt; onGhostDone: (id: number) => void; pace: number }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-[65] overflow-hidden" aria-hidden="true">
      {trail ? <TrailArrow trail={trail} /> : null}
      {ghosts.map((ghost) => (
        <GhostCard key={ghost.id} ghost={ghost} art={art} pace={pace} onDone={() => onGhostDone(ghost.id)} />
      ))}
      {floats.map((item) => (
        <span
          key={item.id}
          className={`animate-duel-float absolute font-display text-3xl font-black drop-shadow-[0_2px_2px_rgba(0,0,0,.6)] ${item.tone === 'up' ? 'text-success' : item.tone === 'down' ? 'text-danger' : 'text-info'}`}
          style={{ left: item.x, top: item.y, transform: 'translateX(-50%)', animationDuration: `${1.4 * pace}s` }}
        >
          {item.text}
        </span>
      ))}
    </div>
  );
}

function TrailArrow({ trail }: { trail: Trail }) {
  const { from, to, tone } = trail;
  const color = tone === 'convert' ? '#fbbf24' : '#38bdf8';
  // Curva suave entre os dois pontos, com a ponta da seta no destino.
  const midX = (from.x + to.x) / 2;
  const midY = Math.min(from.y, to.y) - 40;
  const path = `M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`;
  const id = `arrow-${trail.id}`;
  return (
    <svg className="animate-duel-trail absolute inset-0 h-full w-full">
      <defs>
        <marker id={id} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
        </marker>
      </defs>
      <path d={path} fill="none" stroke="rgba(0,0,0,.35)" strokeWidth="8" strokeLinecap="round" strokeDasharray="2 14" />
      <path d={path} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray="2 14" markerEnd={`url(#${id})`} />
      <circle cx={from.x} cy={from.y} r="7" fill={color} />
    </svg>
  );
}

function GhostCard({ ghost, art, pace, onDone }: { ghost: Ghost; art: CardArt; pace: number; onDone: () => void }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const home = centerOf(ghost.rect);
    const toward = ghost.target ? { dx: ghost.target.x - home.x, dy: ghost.target.y - home.y } : { dx: 0, dy: 0 };
    const frames: Keyframe[] =
      ghost.kind === 'destroy'
        ? [
            { transform: 'none', filter: 'none', opacity: 1 },
            { transform: 'translateX(-5px) rotate(-5deg) scale(1.08)', filter: 'brightness(1.6)', offset: 0.15 },
            { transform: 'translateX(5px) rotate(5deg) scale(1.1)', filter: 'brightness(1.8)', offset: 0.3 },
            { transform: 'translateX(-4px) rotate(-4deg) scale(1.12)', filter: 'brightness(2)', offset: 0.45 },
            { transform: 'scale(1.5) rotate(18deg)', filter: 'brightness(3) blur(2px)', opacity: 0.8, offset: 0.7 },
            { transform: 'scale(0.1) rotate(40deg)', filter: 'brightness(3) blur(6px)', opacity: 0 },
          ]
        : ghost.kind === 'bounce'
          ? [
              { transform: 'none', opacity: 1 },
              { transform: 'translateY(-14px) scale(1.2)', opacity: 1, offset: 0.2 },
              { transform: `translate(${toward.dx}px, ${toward.dy}px) scale(0.35) rotate(${toward.dx > 0 ? 18 : -18}deg)`, opacity: 0.3 },
            ]
          : ghost.kind === 'vanish'
            ? [
                { transform: 'none', opacity: 1, filter: 'none' },
                { transform: 'translateY(-30px) scale(1.1)', opacity: 0.7, filter: 'blur(1px)', offset: 0.5 },
                { transform: 'translateY(-70px) scale(0.8)', opacity: 0, filter: 'blur(6px)' },
              ]
            : [
                { opacity: 1, transform: 'none' },
                { opacity: 0, transform: 'scale(0.8)' },
              ];
    const animation = element.animate(frames, { duration: (ghost.kind === 'destroy' ? 1100 : ghost.kind === 'bounce' ? 1000 : 800) * pace, easing: 'ease-in', fill: 'forwards' });
    animation.onfinish = onDone;
    return () => animation.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const icon = ghost.kind === 'destroy' ? '💥' : ghost.kind === 'vanish' ? '💨' : ghost.kind === 'bounce' ? '↩️' : null;
  return (
    <div ref={ref} className="absolute" style={{ left: ghost.rect.left, top: ghost.rect.top, width: ghost.rect.width, height: ghost.rect.height }}>
      <DuelCardFace def={ghost.card.def as CardDef} art={art} power={ghost.card.power} silenced={ghost.card.silenced} className="!h-full !w-full" />
      {icon ? <span className="animate-duel-burst absolute inset-0 flex items-center justify-center text-4xl">{icon}</span> : null}
    </div>
  );
}
