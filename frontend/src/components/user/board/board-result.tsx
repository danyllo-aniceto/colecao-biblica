import { useState } from 'react';
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded';
import { standings, type BoardState } from '@board/engine';
import { Button } from '@/components/ui/button';
import { errorMessage, useToast } from '@/components/ui/toast';
import { Pawn } from '@/components/user/board/board-track';
import { cn } from '@/lib/cn';

const PLACES = ['🥇', '🥈', '🥉', '4º', '5º', '6º'];

const count = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`;

/** Pódio da partida: quem venceu, a classificação e o resumo de cada jogador. */
export function BoardResult({ state, scenarioName, onExit, onRematch }: { state: BoardState; scenarioName: string; onExit: () => void; onRematch: () => Promise<void> }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const ranking = standings(state);
  const winner = ranking[0];

  async function rematch() {
    setLoading(true);
    try {
      await onRematch();
    } catch (error) {
      toast.error(errorMessage(error, 'Não foi possível começar a revanche.'));
      setLoading(false);
    }
  }

  return (
    <div className="absolute inset-0 z-10 overflow-y-auto bg-bg/95 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Fim da partida">
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-5 p-5">
        <div className="animate-pop-in space-y-2 text-center">
          <EmojiEventsRoundedIcon sx={{ fontSize: 56 }} className="text-primary" />
          <Pawn emoji={winner.pawn} className="block text-6xl" />
          <h2 className="font-display text-3xl font-bold text-ink">{winner.name} venceu!</h2>
          <p className="text-sm font-semibold text-muted">
            Chegou ao fim do caminho na rodada {state.round} · {scenarioName}
          </p>
        </div>

        <ol className="space-y-2">
          {ranking.map((player, index) => (
            <li key={player.id} className={cn('panel flex items-center gap-3 p-3', index === 0 && 'ring-2 ring-primary')}>
              <span className="w-8 text-center font-display text-xl font-bold text-ink">{PLACES[index]}</span>
              <Pawn emoji={player.pawn} className="text-3xl" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-base font-bold text-ink">
                  {player.name}
                  {player.bot ? ' 🤖' : ''}
                </p>
                <p className="text-xs font-semibold text-muted">
                  {count(player.stats.correct, 'acerto', 'acertos')} · {count(player.stats.wrong, 'erro', 'erros')} · sequência {player.stats.bestStreak}
                  {player.stats.pushes ? ` · ${count(player.stats.pushes, 'empurrão', 'empurrões')}` : ''}
                  {player.stats.trialsWon ? ` · ${count(player.stats.trialsWon, 'provação vencida', 'provações vencidas')}` : ''}
                </p>
              </div>
              <span className="text-sm font-bold text-muted">
                {player.id === state.winnerId ? 'Chegada' : `Casa ${player.position}`}
              </span>
            </li>
          ))}
        </ol>

        <p className="text-center text-xs font-semibold text-muted">Partida entre amigos: não rende XP, moedas nem figurinhas.</p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="lg" className="flex-1" onClick={() => void rematch()} loading={loading}>
            Revanche
          </Button>
          <Button size="lg" variant="secondary" className="flex-1" onClick={onExit} disabled={loading}>
            Voltar
          </Button>
        </div>
      </div>
    </div>
  );
}
