import { memo, useEffect, useMemo, useRef } from 'react';
import { currentPlayer, type BoardState } from '@board/engine';
import { cn } from '@/lib/cn';
import { TILE_INFO, tileIcon } from '@/components/user/board/board-meta';

const COLUMNS = 6;

/** Posição da casa na grade em serpente: a largada fica embaixo e a chegada em cima. */
function cellOf(index: number, rows: number) {
  const row = Math.floor(index / COLUMNS);
  const offset = index % COLUMNS;
  const column = row % 2 === 0 ? offset : COLUMNS - 1 - offset;
  return { gridRow: rows - row, gridColumn: column + 1 };
}

export function Pawn({ emoji, active = false, className }: { emoji: string; active?: boolean; className?: string }) {
  return (
    <span aria-hidden="true" className={cn('inline-block leading-none drop-shadow-[0_2px_1px_rgba(0,0,0,0.45)]', active && 'animate-bounce', className)}>
      {emoji}
    </span>
  );
}

type TrackProps = {
  state: BoardState;
  /** Casas em destaque (para onde o peão acabou de ir). */
  flash: number[];
};

/** O caminho do cenário: casas em serpente com os peões em cima. Acompanha o peão da vez. */
export const BoardTrack = memo(function BoardTrack({ state, flash }: TrackProps) {
  const { tiles, players, rules } = state;
  const rows = Math.ceil(tiles.length / COLUMNS);
  const active = state.phase === 'FINISHED' ? null : currentPlayer(state);
  const refs = useRef<Array<HTMLDivElement | null>>([]);

  const pawnsByTile = useMemo(() => {
    const map = new Map<number, typeof players>();
    for (const player of players) map.set(player.position, [...(map.get(player.position) ?? []), player]);
    return map;
  }, [players]);

  const followPosition = active?.position;
  useEffect(() => {
    if (followPosition === undefined) return;
    refs.current[followPosition]?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [followPosition, active?.id, state.phase]);

  return (
    <div className="mx-auto grid w-full max-w-xl gap-1.5 p-3" style={{ gridTemplateColumns: `repeat(${COLUMNS}, minmax(0, 1fr))` }}>
      {tiles.map((tile, index) => {
        const info = TILE_INFO[tile.kind];
        const here = pawnsByTile.get(index) ?? [];
        const label = `Casa ${index}, ${info.label.toLowerCase()}${tile.to !== undefined ? ` para a casa ${tile.to}` : ''}${here.length ? `, com ${here.map((player) => player.name).join(', ')}` : ''}`;
        return (
          <div
            key={index}
            ref={(node) => {
              refs.current[index] = node;
            }}
            role="img"
            aria-label={label}
            style={cellOf(index, rows)}
            className={cn(
              'relative aspect-square rounded-2xl border-2 transition-shadow',
              info.className,
              tile.kind === 'FINISH' && 'ring-2 ring-primary',
              flash.includes(index) && 'ring-4 ring-primary shadow-[0_0_14px_var(--primary)]',
            )}
          >
            <span className="absolute left-1.5 top-0.5 text-[10px] font-bold leading-none text-muted">{index > 0 && index < state.config.size ? index : ''}</span>
            <span className={cn('absolute inset-0 flex items-center justify-center text-xl', here.length > 0 && 'opacity-30')}>{tileIcon(tile, rules)}</span>
            {tile.to !== undefined ? (
              <span className="absolute bottom-0.5 right-1.5 text-[10px] font-bold leading-none text-ink">→{tile.to}</span>
            ) : null}
            {here.length > 0 ? (
              <span className="absolute inset-0 flex flex-wrap content-center items-center justify-center gap-0.5 p-0.5">
                {here.map((player) => (
                  <Pawn key={player.id} emoji={player.pawn} active={player.id === active?.id} className={here.length > 2 ? 'text-base' : 'text-2xl'} />
                ))}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
});
