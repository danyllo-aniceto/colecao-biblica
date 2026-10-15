import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import { Button } from '@/components/ui/button';
import { RunStars } from '@/components/user/corrida/corrida-stars';
import { cn } from '@/lib/cn';

/** Uma parada do mapa: a fase, em que pé está o jogador nela e o que ela dá. */
export type MapStop = {
  id: string;
  /** Posição da fase no cenário (1, 2, 3...). */
  number: number;
  name: string;
  info: string;
  result: string;
  unlocked: boolean;
  finished: boolean;
  /** Estrelas conquistadas (só com a fase concluída). */
  stars: { allWords: boolean; clean: boolean } | null;
  /** Personagens que esta fase abre. */
  prize: string[];
};

const LEFT = 14;
const RIGHT = 86;
/** Altura do nó (3,5 rem = 56 px): o centro dele fica a metade disso do topo da linha. */
const NODE = 56;

/**
 * Mapa de um cenário: uma trilha em zigue-zague ligando as fases, com a fase de cada parada ao lado do nó. O trecho já percorrido (fase concluída)
 * fica colorido; a próxima fase aberta ganha um anel; as fechadas mostram o cadeado. A trilha é do próprio app (nunca arte): o cenário só dá as cores.
 * Cada linha tem a altura do próprio cartão; a curva até a próxima parada é desenhada dentro da linha, do centro de um nó ao centro do seguinte.
 */
export function CampaignMap({ stops, accent, onPlay }: { stops: MapStop[]; accent: string; onPlay: (id: string) => void }) {
  if (stops.length === 0) return null;
  const nodeX = (index: number) => (index % 2 === 0 ? LEFT : RIGHT);
  const current = stops.findIndex((stop) => stop.unlocked && !stop.finished);
  return (
    <ol aria-label="Mapa do cenário">
      {stops.map((stop, index) => {
        const onLeft = nodeX(index) === LEFT;
        const isCurrent = index === current;
        const last = index === stops.length - 1;
        const from = nodeX(index);
        const to = nodeX(index + 1);
        return (
          <li key={stop.id} className="relative pb-4">
            {last ? null : (
              <svg className="pointer-events-none absolute left-0 w-full" style={{ top: NODE / 2, height: '100%' }} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <path
                  d={`M ${from} 0 C ${from} 50, ${to} 50, ${to} 100`}
                  fill="none"
                  strokeLinecap="round"
                  strokeWidth={stop.finished ? 7 : 5}
                  strokeDasharray={stop.finished ? undefined : '1 12'}
                  vectorEffect="non-scaling-stroke"
                  className={stop.finished ? undefined : 'stroke-muted'}
                  style={stop.finished ? { stroke: accent } : undefined}
                  opacity={stop.finished ? 0.9 : 0.55}
                />
              </svg>
            )}
            <span
              className={cn(
                'absolute top-0 z-10 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full border-4 border-surface font-display text-xl font-bold shadow-md',
                stop.unlocked ? 'bg-primary text-on-primary' : 'bg-surface-3 text-muted',
                isCurrent && 'ring-4 ring-primary/40',
              )}
              style={{ left: `${from}%` }}
            >
              {stop.finished ? <CheckRoundedIcon /> : stop.unlocked ? stop.number : <LockRoundedIcon fontSize="small" />}
            </span>
            <div className={cn('panel relative z-10 w-[calc(100%-5.5rem)] space-y-1 p-3', onLeft ? 'ml-auto' : 'mr-auto', !stop.unlocked && 'opacity-75')}>
              <p className="font-display text-base font-bold leading-tight text-ink">{stop.name}</p>
              <p className="text-xs font-semibold text-muted">{stop.info}</p>
              <p className="text-xs font-bold text-ink">{stop.unlocked ? stop.result : 'Conclua a fase anterior'}</p>
              {stop.stars ? <RunStars finished allWords={stop.stars.allWords} clean={stop.stars.clean} /> : null}
              {stop.prize.length > 0 ? (
                <p className="text-xs font-bold text-warning-strong dark:text-primary">
                  {stop.finished ? 'Abriu' : 'Abre'}: {stop.prize.join(', ')}
                </p>
              ) : null}
              <Button size="sm" disabled={!stop.unlocked} onClick={() => onPlay(stop.id)}>
                {stop.finished ? 'Jogar de novo' : 'Jogar'}
              </Button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
