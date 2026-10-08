import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, CoinIcon } from '@/components/game/game-ui';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/spinner';
import { useToast, errorMessage } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { finishMiniGame, startMiniGame, type MiniGameInfo, type MiniGameResult } from '@/lib/minigames-api';

export const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** Letras sem acento e em maiúsculas, como o servidor confere ("João" → "JOAO"). */
export const baseLetters = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');

export type GameProps<P> = {
  puzzle: P;
  runId: string;
  /** Envia a resposta ao servidor; devolve o resultado (quem chama mostra o fim da partida). */
  submit: (answer: object) => Promise<void>;
  /** A partida acabou (resultado já conferido): para o relógio. */
  finished: boolean;
};

type Props<P> = {
  game: MiniGameInfo;
  onExit: () => void;
  onWallet: (wallet: { userCoins: number }) => void;
  /** Tela do jogo. Recebe o `report` para jogos que o servidor fecha sozinho (forca). */
  children: (props: GameProps<P> & { report: (result: MiniGameResult) => void }) => ReactNode;
};

/**
 * Moldura de todo mini game: começa a partida no servidor, mostra o relógio, recebe o resultado conferido e o exibe
 * (pontos, moedas e ranking) com "Jogar de novo".
 */
export function MiniGameFrame<P>({ game, onExit, onWallet, children }: Props<P>) {
  const toast = useToast();
  const [run, setRun] = useState<{ runId: string; puzzle: P } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MiniGameResult | null>(null);
  const [seconds, setSeconds] = useState(0);
  const startedAt = useRef(0);

  const begin = useCallback(() => {
    setRun(null);
    setResult(null);
    setError(null);
    setSeconds(0);
    startMiniGame<P>(game.id)
      .then((started) => {
        startedAt.current = Date.now();
        setRun({ runId: started.runId, puzzle: started.puzzle });
      })
      .catch((reason: unknown) => setError(errorMessage(reason)));
  }, [game.id]);

  useEffect(() => {
    begin();
  }, [begin]);

  useEffect(() => {
    if (!run || result) return undefined;
    const id = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000)), 500);
    return () => window.clearInterval(id);
  }, [run, result]);

  const report = useCallback(
    (done: MiniGameResult) => {
      setResult(done);
      if (done.userCoins !== null && done.coins > 0) onWallet({ userCoins: done.userCoins });
    },
    [onWallet],
  );

  const submit = useCallback(
    async (answer: object) => {
      if (!run) return;
      try {
        report(await finishMiniGame(run.runId, answer));
      } catch (reason) {
        toast.error(errorMessage(reason));
      }
    },
    [run, report, toast],
  );

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex min-w-0 items-center gap-2 font-display text-xl font-bold leading-tight text-ink">
          <span aria-hidden>{game.emoji}</span> {game.name}
        </h3>
        <div className="flex shrink-0 items-center gap-1">
          <span className="whitespace-nowrap rounded-full bg-surface-3 px-3 py-1 font-display text-sm font-bold tabular-nums text-ink" aria-label="Tempo de jogo">
            ⏱ {clock(seconds)}
          </span>
          {result ? null : (
            <Button size="sm" variant="ghost" onClick={onExit}>
              Sair
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <div className="space-y-3">
          <Alert tone="danger">{error}</Alert>
          <Button variant="secondary" onClick={onExit}>
            Voltar aos jogos
          </Button>
        </div>
      ) : !run ? (
        <LoadingState label="Preparando o jogo..." />
      ) : (
        children({ puzzle: run.puzzle, runId: run.runId, submit, finished: Boolean(result), report })
      )}

      {result ? <ResultCard result={result} onAgain={begin} onExit={onExit} /> : null}
    </div>
  );
}

function ResultCard({ result, onAgain, onExit }: { result: MiniGameResult; onAgain: () => void; onExit: () => void }) {
  const ref = useRef<HTMLElement | null>(null);
  // O jogo pode ser mais alto que a tela: leva o resultado para a vista.
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);
  return (
    <section ref={ref} aria-label="Resultado da partida" className={cn('panel animate-pop-in space-y-3 border-2 p-4 text-center', result.solved ? 'border-success' : 'border-edge')}>
      <p className="font-display text-2xl font-bold text-ink">{result.solved ? 'Muito bem!' : 'Não foi dessa vez'}</p>
      <p className="text-sm font-semibold text-muted">{result.detail}</p>
      {result.score > 0 ? (
        <p className="font-display text-4xl font-bold text-primary-strong dark:text-primary">
          {result.score.toLocaleString('pt-BR')} <span className="text-base text-muted">pontos</span>
        </p>
      ) : null}
      {result.coins > 0 ? (
        <p className="flex items-center justify-center gap-1.5 rounded-xl bg-primary/10 p-2 font-display font-bold text-ink">
          <CoinIcon className="h-5 w-5" /> +{result.coins} moedas pela primeira vitória do dia
        </p>
      ) : null}
      {result.rankingUnlocked ? (
        <p className="text-xs font-bold text-muted">{result.recorded ? 'Nova melhor da semana no ranking!' : `Sua melhor da semana neste jogo: ${result.best.toLocaleString('pt-BR')}`}</p>
      ) : result.score > 0 ? (
        <p className="text-xs font-semibold text-muted">Complete o Peitoral para entrar no ranking semanal.</p>
      ) : null}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={onAgain}>
          Jogar de novo
        </Button>
        <Button className="flex-1" variant="secondary" onClick={onExit}>
          Voltar
        </Button>
      </div>
    </section>
  );
}
