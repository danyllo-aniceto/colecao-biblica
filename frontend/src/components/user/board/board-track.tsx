import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { currentPlayer, isPawnImage, type BoardState, type HazardState, type ScenarioRules, type Tile, type TileKind } from '@board/engine';
import { BAND_HEIGHT, computeLayout, landmarkCenter, type BoardLayout, type Landmark, type PathStyle } from '@board/layout';
import { cn } from '@/lib/cn';
import { TILE_INFO, tileIcon } from '@/components/user/board/board-meta';

/** Peão: emoji ou imagem cadastrada no painel. O tamanho vem do `text-*` (a imagem acompanha: 1em). */
export function Pawn({ emoji, active = false, className }: { emoji: string; active?: boolean; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('inline-block leading-none drop-shadow-[0_2px_1px_rgba(0,0,0,0.45)]', active && 'animate-bounce motion-reduce:animate-none', className)}>
      {isPawnImage(emoji) ? <img src={emoji} alt="" draggable={false} className="inline-block h-[1.15em] w-[1.15em] object-contain align-middle" /> : emoji}
    </span>
  );
}

/** Raio de cada casa (em unidades do quadro de 360): as especiais são maiores para o ritmo do caminho aparecer. */
const RADIUS: Record<TileKind, number> = {
  START: 29,
  NORMAL: 22,
  SHELTER: 25,
  POWER: 26,
  TRIAL: 27,
  SHORTCUT: 25,
  FALL: 25,
  WALL: 27,
  FIRE: 27,
  DEN: 27,
  VIGIL: 27,
  GATE: 31,
  FINISH: 38,
};
const PAWN_SIZE = 25;
/** Quem divide a mesma casa se espalha em roda (e encolhe um pouco), para ninguém ficar escondido. */
function clusterSlot(index: number, total: number): { dx: number; dy: number; scale: number } {
  if (total <= 1) return { dx: 0, dy: 0, scale: 1 };
  const radius = total === 2 ? 11 : 16;
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total + (total === 2 ? Math.PI / 4 : 0);
  return { dx: Math.cos(angle) * radius, dy: Math.sin(angle) * radius, scale: total === 2 ? 0.8 : total === 3 ? 0.7 : 0.6 };
}
const STEP_MS = 150;
const MAX_WALK = 16;

export type CanvasPawn = { id: string; name: string; emoji: string; position: number };

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Posição mostrada de cada peão: quando ele avança, passa casa por casa (como num jogo de verdade);
 * recuos e saltos grandes deslizam direto. Sem animação (ou com "reduzir movimento"), vai direto.
 */
function useSteppedPositions(targets: Record<string, number>, animate: boolean) {
  const [shown, setShown] = useState(targets);
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const timers = useRef<Record<string, number>>({});
  const key = JSON.stringify(targets);

  useEffect(() => {
    for (const [id, target] of Object.entries(targets)) {
      const current = shownRef.current[id] ?? target;
      if (current === target) continue;
      window.clearInterval(timers.current[id]);
      if (!animate || reducedMotion() || target < current || target - current > MAX_WALK) {
        setShown((previous) => ({ ...previous, [id]: target }));
        continue;
      }
      timers.current[id] = window.setInterval(() => {
        setShown((previous) => {
          const now = previous[id] ?? target;
          if (now >= target) {
            window.clearInterval(timers.current[id]);
            return previous;
          }
          return { ...previous, [id]: now + 1 };
        });
      }, STEP_MS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, animate]);

  useEffect(
    () => () => {
      Object.values(timers.current).forEach((timer) => window.clearInterval(timer));
    },
    [],
  );

  return shown;
}

type CanvasProps = {
  tiles: Tile[];
  rules: ScenarioRules;
  /** Tamanho do tabuleiro (a casa `size` é a chegada). */
  size: number;
  pawns: CanvasPawn[];
  activeId: string | null;
  hazard?: HazardState | null;
  /** Casas em destaque (para onde o peão acabou de ir). */
  flash?: number[];
  image?: string | null;
  pathStyle?: PathStyle | null;
  landmarks?: Landmark[] | null;
  animate?: boolean;
  /** A tela acompanha o peão da vez. */
  follow?: boolean;
  /** Muda quando a área visível encolhe ou cresce (pergunta abrindo/fechando): a câmera volta ao peão. */
  focusKey?: string;
  minimap?: boolean;
  className?: string;
};

const pct = (value: number, total: number) => `${(value / total) * 100}%`;

/**
 * O tabuleiro desenhado: o terreno (imagem repetida e espelhada), os marcos do cenário, a estrada em curvas,
 * as casas e os peões. Serve ao jogo e à prévia do painel. Tudo escala com a largura (unidades `cqw`).
 */
export function BoardCanvas({ tiles, rules, size, pawns, activeId, hazard = null, flash = [], image, pathStyle, landmarks, animate = true, follow = false, focusKey, minimap = false, className }: CanvasProps) {
  const layout: BoardLayout = useMemo(() => computeLayout(tiles.length, pathStyle ?? 'MEDIUM'), [tiles.length, pathStyle]);
  const { width, height, points } = layout;
  const targets = useMemo(() => Object.fromEntries(pawns.map((pawn) => [pawn.id, pawn.position])), [pawns]);
  const shown = useSteppedPositions(targets, animate);
  const pawnRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const bands = Math.ceil(height / BAND_HEIGHT);

  // Quem divide a casa aparece lado a lado.
  const crowd = useMemo(() => {
    const byTile = new Map<number, string[]>();
    for (const pawn of pawns) {
      const at = shown[pawn.id] ?? pawn.position;
      byTile.set(at, [...(byTile.get(at) ?? []), pawn.id]);
    }
    return byTile;
  }, [pawns, shown]);

  const followAt = activeId ? shown[activeId] : undefined;
  useEffect(() => {
    if (!follow || !activeId || followAt === undefined) return;
    // Espera o layout assentar (a folha da pergunta muda o tamanho da área visível) e então centraliza o peão.
    const timer = window.setTimeout(() => pawnRefs.current[activeId]?.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' }), 60);
    return () => window.clearTimeout(timer);
  }, [follow, activeId, followAt, focusKey]);

  const connectors = tiles.flatMap((tile, index) => {
    if (tile.to === undefined || !points[tile.to]) return [];
    const from = points[index];
    const to = points[tile.to];
    // Curva para o lado oposto ao do caminho, para o atalho/queda não ficar em cima da estrada.
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy) || 1;
    const bend = index % 2 === 0 ? 1 : -1;
    const control = { x: (from.x + to.x) / 2 + (-dy / length) * 34 * bend, y: (from.y + to.y) / 2 + (dx / length) * 34 * bend };
    return [{ key: index, d: `M${from.x.toFixed(1)} ${from.y.toFixed(1)} Q${control.x.toFixed(1)} ${control.y.toFixed(1)} ${to.x.toFixed(1)} ${to.y.toFixed(1)}`, up: tile.kind === 'SHORTCUT', end: to }];
  });

  return (
    <div className={cn('relative mx-auto w-full max-w-xl', className)}>
      {minimap ? (
        <div className="sticky top-2 z-20 h-0">
          <div className="absolute right-1 top-0 h-[34dvh] w-5 rounded-full bg-surface/80 shadow-sm backdrop-blur-sm" aria-label="Progresso dos jogadores">
            {pawns.map((pawn) => (
              <button
                key={pawn.id}
                type="button"
                onClick={() => pawnRefs.current[pawn.id]?.scrollIntoView({ block: 'center', behavior: 'smooth' })}
                aria-label={`Ir para ${pawn.name}`}
                className={cn('absolute left-1/2 flex h-5 w-5 -translate-x-1/2 translate-y-1/2 items-center justify-center text-xs leading-none transition-[bottom] duration-300', pawn.id === activeId && 'z-10')}
                style={{ bottom: `${Math.min(100, (pawn.position / Math.max(size, 1)) * 100)}%` }}
              >
                <Pawn emoji={pawn.emoji} className="text-[13px]" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: `${width} / ${height}`, containerType: 'inline-size' }}
        role="group"
        aria-label="Tabuleiro"
      >
        {/* Terreno: a imagem se repete de cima para baixo, espelhada de duas em duas, e as emendas somem. */}
        {image
          ? Array.from({ length: bands }, (_, band) => (
              <div
                key={band}
                aria-hidden="true"
                className="absolute inset-x-0"
                style={{
                  top: pct(band * BAND_HEIGHT, height),
                  // 1 unidade a mais: a faixa seguinte cobre a emenda e não sobra fresta de subpixel.
                  height: pct(BAND_HEIGHT + 1, height),
                  backgroundImage: `url("${image.replace(/["\\()]/g, (char) => encodeURIComponent(char))}")`,
                  backgroundSize: '100% 100%',
                  transform: band % 2 === 1 ? 'scaleY(-1)' : undefined,
                }}
              />
            ))
          : null}
        <div aria-hidden="true" className="absolute inset-0" style={{ background: image ? 'color-mix(in srgb, var(--bg) 22%, transparent)' : 'color-mix(in srgb, var(--primary) 7%, transparent)' }} />

        {/* Marcos do cenário (por % do caminho, valem para qualquer tamanho de tabuleiro). */}
        {(landmarks ?? []).map((landmark, index) => {
          const center = landmarkCenter(layout, landmark);
          return (
            <div
              key={index}
              aria-hidden="true"
              className="pointer-events-none absolute flex items-center justify-center"
              style={{ left: pct(center.x, width), top: pct(center.y, height), width: pct(landmark.size, width), aspectRatio: '1', transform: 'translate(-50%, -50%)', fontSize: `${(landmark.size * 0.85) / width * 100}cqw` }}
            >
              {landmark.imageUrl ? <img src={landmark.imageUrl} alt="" draggable={false} className="h-full w-full object-contain drop-shadow-[0_3px_3px_rgba(0,0,0,0.25)]" /> : <span className="leading-none drop-shadow-[0_3px_3px_rgba(0,0,0,0.25)]">{landmark.emoji}</span>}
            </div>
          );
        })}

        {/* Estrada e atalhos/quedas. */}
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
          <path d={layout.roadPath} fill="none" stroke="var(--edge-strong)" strokeOpacity={0.6} strokeWidth={36} strokeLinecap="round" strokeLinejoin="round" />
          <path d={layout.roadPath} fill="none" stroke="var(--surface)" strokeOpacity={0.88} strokeWidth={28} strokeLinecap="round" strokeLinejoin="round" />
          <path d={layout.roadPath} fill="none" stroke="var(--edge-strong)" strokeWidth={2.5} strokeDasharray="2 10" strokeLinecap="round" strokeLinejoin="round" />
          {connectors.map((connector) => (
            <g key={connector.key}>
              <path d={connector.d} fill="none" stroke={connector.up ? 'var(--info)' : 'var(--danger)'} strokeWidth={3.5} strokeDasharray="6 7" strokeLinecap="round" opacity={0.9} />
              <circle cx={connector.end.x} cy={connector.end.y} r={5} fill={connector.up ? 'var(--info)' : 'var(--danger)'} />
            </g>
          ))}
        </svg>

        {/* Casas. */}
        {tiles.map((tile, index) => {
          const info = TILE_INFO[tile.kind];
          const radius = RADIUS[tile.kind];
          const point = points[index];
          const here = (crowd.get(index) ?? []).length > 0;
          const label = `Casa ${index}, ${info.label.toLowerCase()}${tile.to !== undefined ? ` para a casa ${tile.to}` : ''}${hazard?.tiles.includes(index) ? `, atingida: ${hazard.name}` : ''}`;
          return (
            <div
              key={index}
              role="img"
              aria-label={label}
              className={cn(
                'absolute flex items-center justify-center rounded-full border-2 shadow-[0_2px_0_var(--edge-strong)] transition-shadow',
                info.className,
                tile.kind === 'FINISH' && 'ring-2 ring-primary',
                hazard?.tiles.includes(index) && 'ring-2 ring-info',
                flash.includes(index) && 'ring-4 ring-primary shadow-[0_0_16px_var(--primary)]',
              )}
              style={{ left: pct(point.x, width), top: pct(point.y, height), width: pct(radius * 2, width), aspectRatio: '1', transform: 'translate(-50%, -50%)', fontSize: `${(radius * 1.05) / width * 100}cqw` }}
            >
              <span className={cn('leading-none', here && 'opacity-35')}>{tileIcon(tile, rules)}</span>
              {index > 0 && index < size ? (
                <span className="absolute -bottom-[0.15em] left-1/2 -translate-x-1/2 rounded-full bg-surface/90 px-[0.3em] font-display font-bold leading-tight text-muted" style={{ fontSize: `${(radius * 0.46) / width * 100}cqw` }}>
                  {index}
                </span>
              ) : null}
              {hazard?.tiles.includes(index) ? (
                <span className="absolute -right-[0.15em] -top-[0.25em] leading-none" style={{ fontSize: `${(radius * 0.8) / width * 100}cqw` }} aria-hidden="true">
                  {hazard.emoji}
                </span>
              ) : null}
            </div>
          );
        })}

        {/* Peões (andam casa a casa). */}
        {pawns.map((pawn) => {
          const at = shown[pawn.id] ?? pawn.position;
          const point = points[Math.min(at, points.length - 1)];
          const group = crowd.get(at) ?? [pawn.id];
          const { dx, dy, scale } = clusterSlot(Math.max(0, group.indexOf(pawn.id)), group.length);
          const active = pawn.id === activeId;
          return (
            <span
              key={pawn.id}
              ref={(node) => {
                pawnRefs.current[pawn.id] = node;
              }}
              className={cn('absolute z-10 flex items-center justify-center transition-[left,top] duration-150 ease-linear motion-reduce:transition-none', active && 'z-20')}
              style={{
                left: pct(point.x + dx, width),
                top: pct(point.y + dy - 4, height),
                width: pct(PAWN_SIZE * 1.6, width),
                aspectRatio: '1',
                transform: 'translate(-50%, -50%)',
                fontSize: `${(PAWN_SIZE * scale) / width * 100}cqw`,
              }}
              aria-label={pawn.name}
            >
              <Pawn emoji={pawn.emoji} active={active} />
            </span>
          );
        })}
      </div>
    </div>
  );
}

type TrackProps = {
  state: BoardState;
  flash: number[];
  image?: string | null;
  pathStyle?: PathStyle | null;
  landmarks?: Landmark[] | null;
};

/** O caminho da partida em andamento: o tabuleiro desenhado com os peões do estado do jogo. */
export const BoardTrack = memo(function BoardTrack({ state, flash, image, pathStyle, landmarks }: TrackProps) {
  const active = state.phase === 'FINISHED' ? null : currentPlayer(state).id;
  const pawns = useMemo(() => state.players.map((player) => ({ id: player.id, name: player.name, emoji: player.pawn, position: player.position })), [state.players]);
  return (
    <BoardCanvas
      tiles={state.tiles}
      rules={state.rules}
      size={state.config.size}
      pawns={pawns}
      activeId={active}
      hazard={state.hazard}
      flash={flash}
      image={image}
      pathStyle={pathStyle}
      landmarks={landmarks}
      follow
      focusKey={`${state.phase}:${state.pending?.questionId ?? 0}:${state.turn}`}
      minimap
    />
  );
});
