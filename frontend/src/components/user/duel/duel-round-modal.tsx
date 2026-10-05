import type { ReactNode } from 'react';
import { damageFor, type Series } from '@duel/series';
import type { DuelResult, Side } from '@duel/types';
import { Modal } from '@/components/ui/modal';

type Props = {
  open: boolean;
  result: DuelResult | null;
  /** Nome da arena pelo número dela (0 a 2). */
  arenaName: (index: number) => string;
  /** Lado de quem está olhando (0 no treino; 0 ou 1 na sala online). */
  you: Side;
  series: Series;
  foeName?: string;
  footer: ReactNode;
};

/** Resumo de uma rodada: o resultado de cada arena, o placar da série e, se acabou, quem venceu o duelo. */
export function DuelRoundModal({ open, result, arenaName, you, series, foeName = 'rival', footer }: Props) {
  const foe: Side = you === 0 ? 1 : 0;
  const youWon = result?.winner === you;
  const lost = result?.winner === foe;
  const title = youWon ? 'Você venceu a rodada!' : lost ? (result?.retreated === you ? 'Você desistiu' : `${foeName === 'rival' ? 'O rival' : foeName} venceu a rodada`) : 'Empate';
  return (
    <Modal open={open && result !== null} size="sm" title={title} footer={footer}>
      {result ? (
        <div className="space-y-4">
          <ul className="space-y-2">
            {result.lanes.map((lane, index) => (
              <li key={index} className="flex items-center justify-between gap-2 rounded-2xl bg-surface-2 px-3 py-2 text-sm font-semibold text-ink">
                <span className="truncate">{arenaName(index)}</span>
                <span className={lane.winner === you ? 'font-bold text-success' : lane.winner === foe ? 'font-bold text-danger' : 'text-muted'}>
                  {lane.power[you]} × {lane.power[foe]}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-center text-sm font-semibold text-muted">
            {series.format === 'lives'
              ? `Vidas: você ${Math.max(series.lives[you], 0)} · ${foeName} ${Math.max(series.lives[foe], 0)}${result.winner !== null ? ` (dano ${damageFor(series.round - 1, result.stakes)})` : ''}`
              : series.format === 'bo3'
                ? `Rodadas vencidas: você ${series.wins[you]} · ${foeName} ${series.wins[foe]}`
                : null}
          </p>
          {series.over ? (
            <p className="text-center font-display text-lg font-bold text-ink">
              {series.winner === you ? '🏆 Você venceu o duelo!' : series.winner === foe ? `${foeName === 'rival' ? 'O rival' : foeName} venceu o duelo.` : 'Duelo empatado.'}
            </p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
