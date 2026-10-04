import { Pawn } from '@/components/user/board/board-track';
import { TILE_INFO } from '@/components/user/board/board-meta';
import { boardBackgroundStyle } from '@/lib/board-background';
import { scenarioThemeVars } from '@/lib/campaign-theme';
import { cn } from '@/lib/cn';

const SAMPLE: Array<keyof typeof TILE_INFO> = ['NORMAL', 'POWER', 'NORMAL', 'TRIAL', 'NORMAL', 'SHELTER', 'FALL', 'NORMAL', 'SHORTCUT', 'NORMAL', 'GATE', 'FINISH'];

/** Prévia do tabuleiro de um cenário com a imagem de fundo e a cor do tema (mesma película do jogo). */
export function BoardImagePreview({ imageUrl, color, pawn }: { imageUrl?: string | null; color?: string | null; pawn?: string }) {
  return (
    <div className="mx-auto w-full max-w-[15rem] space-y-2">
      <div className="contents" style={scenarioThemeVars(color ?? null)}>
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[1.75rem] border-4 border-edge-strong bg-bg p-2 shadow-lg" style={boardBackgroundStyle(imageUrl)}>
          <div className="grid h-full grid-cols-3 content-center gap-1.5">
            {SAMPLE.map((kind, index) => (
              <div key={index} className={cn('relative flex aspect-square items-center justify-center rounded-xl border-2 text-base', TILE_INFO[kind].className)}>
                <span className={index === 4 ? 'opacity-30' : undefined}>{TILE_INFO[kind].icon}</span>
                {index === 4 && pawn ? <Pawn emoji={pawn} className="absolute text-xl" /> : null}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="text-center text-xs font-semibold text-muted">Prévia do tabuleiro</p>
    </div>
  );
}

/** Prévia do peão sobre uma casa, nos tamanhos que ele aparece no jogo. */
export function PawnPreview({ pawn }: { pawn: string }) {
  if (!pawn) return <p className="text-sm text-muted">Escolha um emoji ou envie uma imagem para ver o peão.</p>;
  return (
    <div className="flex items-center gap-3 rounded-3xl bg-surface-2 p-4" aria-label="Prévia do peão">
      {(['text-2xl', 'text-4xl'] as const).map((size) => (
        <span key={size} className="flex aspect-square h-20 items-center justify-center rounded-2xl border-2 border-edge bg-surface">
          <Pawn emoji={pawn} className={size} />
        </span>
      ))}
      <span className="flex aspect-square h-20 items-center justify-center rounded-2xl border-2 border-primary bg-primary/20">
        <Pawn emoji={pawn} active className="text-2xl" />
      </span>
      <p className="text-xs font-semibold text-muted">Como o peão aparece no tabuleiro (e na vez dele).</p>
    </div>
  );
}
