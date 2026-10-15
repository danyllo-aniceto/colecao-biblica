import { lazy, Suspense, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { LoadingState } from '@/components/ui/spinner';
import { Alert } from '@/components/game/game-ui';
import { botInputs } from '@runner/bots';
import { prepareLevel } from '@runner/engine';
import { TILES_PER_SECOND } from '@runner/journey';
import { LEVELS } from '@runner/levels';
import type { Level } from '@runner/types';

const CorridaGame = lazy(() => import('@/components/user/corrida/corrida-game').then((m) => ({ default: m.CorridaGame })));

type Playing = { level: Level; replay?: number[] };

function formatDuration(seconds: number) {
  const total = Math.round(seconds);
  return total >= 60 ? `${Math.floor(total / 60)} min${total % 60 ? ` ${total % 60} s` : ''}` : `${total} s`;
}

const CONTROLS: Array<{ title: string; text: string }> = [
  { title: 'Corrida', text: 'Toque (ou segure) para pular. Toque de novo no ar para o pulo duplo.' },
  { title: 'Voo', text: 'Segure para subir e solte para descer.' },
  { title: 'Gravidade', text: 'Toque no chão ou no teto para inverter a gravidade.' },
];

/** Aba do modo Corrida (protótipo): fases em formas simples para testar o toque; arte, sons, campanha e multijogador vêm nas próximas etapas. */
export function CorridaHub() {
  const [playing, setPlaying] = useState<Playing | null>(null);
  const list = usePagination(LEVELS, 10);

  // Tenta tela cheia e travar na horizontal (só Android/PWA deixa; no iPhone a tela pede para girar o celular).
  const start = (next: Playing) => {
    try {
      void document.documentElement.requestFullscreen?.().then(() => (screen.orientation as ScreenOrientation & { lock?: (type: string) => Promise<void> }).lock?.('landscape')).catch(() => undefined);
    } catch {
      /* sem suporte: segue sem tela cheia */
    }
    setPlaying(next);
  };
  const exit = () => {
    try {
      if (document.fullscreenElement) void document.exitFullscreen();
    } catch {
      /* sem suporte */
    }
    setPlaying(null);
  };

  // O bot "pensa" a fase inteira antes do replay: numa fase de minutos leva alguns segundos, então mostra o carregamento.
  const [botLoading, setBotLoading] = useState<string | null>(null);
  const watchBot = (level: Level) => {
    setBotLoading(level.id);
    setTimeout(() => {
      const replay = botInputs(prepareLevel(level));
      setBotLoading(null);
      start({ level, replay });
    }, 50);
  };

  return (
    <section className="space-y-5" aria-label="Corrida">
      <Alert tone="info">Protótipo do novo modo: ainda sem arte, sons nem online. Use o celular deitado. No computador, use a barra de espaço.</Alert>
      <ul className="grid gap-3 sm:grid-cols-3">
        {CONTROLS.map((control) => (
          <li key={control.title} className="panel p-4">
            <p className="font-display text-base font-bold text-ink">{control.title}</p>
            <p className="mt-1 text-sm font-semibold text-muted">{control.text}</p>
          </li>
        ))}
      </ul>
      <ul className="space-y-3">
        {list.pageItems.map((level) => (
          <li key={level.id} className="panel flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <p className="font-display text-lg font-bold text-ink">{level.name}</p>
              <p className="text-sm font-semibold text-muted">
                Passa pelas 3 formas · {formatDuration(level.length / TILES_PER_SECOND)}
                {level.verse ? ` · versículo escondido (${level.verse.ref})` : ''}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" loading={botLoading === level.id} disabled={botLoading !== null} onClick={() => watchBot(level)}>
                Ver um bot jogar
              </Button>
              <Button onClick={() => start({ level })}>Jogar</Button>
            </div>
          </li>
        ))}
      </ul>
      <Pagination page={list.page} totalPages={list.totalPages} totalElements={list.totalElements} pageSize={list.pageSize} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} itemLabel="fases" />
      {playing ? (
        <Suspense fallback={<LoadingState />}>
          <CorridaGame level={playing.level} replay={playing.replay} onExit={exit} />
        </Suspense>
      ) : null}
    </section>
  );
}
