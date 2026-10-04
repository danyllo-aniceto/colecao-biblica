import { useMemo, useState } from 'react';
import { DEFAULT_CONFIG, buildTiles } from '@board/engine';
import type { Landmark, PathStyle } from '@board/layout';
import { boardRulesFor } from '@board/scenarios';
import { Segmented } from '@/components/ui/segmented';
import { BoardCanvas, Pawn } from '@/components/user/board/board-track';
import { scenarioThemeVars } from '@/lib/campaign-theme';

const SAMPLE_SIZES = [25, 40, 60] as const;

/**
 * Prévia do tabuleiro de um cenário, desenhada pelo mesmo código do jogo: terreno (imagem repetida e espelhada), curvas
 * do caminho, casas e marcos. O que aparece aqui é exatamente o que o jogador vê.
 */
export function BoardImagePreview({
  imageUrl,
  color,
  slug,
  pathStyle,
  landmarks,
}: {
  imageUrl?: string | null;
  color?: string | null;
  slug: string;
  pathStyle?: PathStyle | null;
  landmarks?: Landmark[] | null;
}) {
  const [size, setSize] = useState<number>(25);
  const rules = useMemo(() => boardRulesFor(slug || 'preview'), [slug]);
  const tiles = useMemo(() => buildTiles({ ...DEFAULT_CONFIG, size }, rules, { s: { rng: 7 } }), [size, rules]);
  const pawns = useMemo(
    () => [
      { id: 'a', name: 'Jogador A', emoji: '🐑', position: 0 },
      { id: 'b', name: 'Jogador B', emoji: '🕊️', position: 0 },
      { id: 'c', name: 'Jogador C', emoji: '🐟', position: Math.round(size * 0.35) },
      { id: 'd', name: 'Jogador D', emoji: '🦁', position: Math.round(size * 0.72) },
    ],
    [size],
  );
  return (
    <div className="mx-auto w-full max-w-[17rem] space-y-2">
      <Segmented aria-label="Tamanho da prévia" value={String(size)} onChange={(value) => setSize(Number(value))} options={SAMPLE_SIZES.map((value) => ({ value: String(value), label: `${value} casas` }))} />
      <div className="contents" style={scenarioThemeVars(color ?? null)}>
        <div className="h-[30rem] overflow-y-auto rounded-[1.75rem] border-4 border-edge-strong bg-bg shadow-lg" tabIndex={0} aria-label="Prévia do tabuleiro (role para ver o caminho todo)">
          <BoardCanvas tiles={tiles} rules={rules} size={size} pawns={pawns} activeId="c" image={imageUrl} pathStyle={pathStyle} landmarks={landmarks} animate={false} />
        </div>
      </div>
      <p className="text-center text-xs font-semibold text-muted">Prévia do tabuleiro: role para ver o caminho todo</p>
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
