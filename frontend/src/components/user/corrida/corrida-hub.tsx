import { lazy, Suspense, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Pagination, usePagination } from '@/components/ui/pagination';
import { LoadingState } from '@/components/ui/spinner';
import { Alert } from '@/components/game/game-ui';
import { botInputs } from '@runner/bots';
import { prepareLevel } from '@runner/engine';
import { LEVELS } from '@runner/levels';
import type { Level } from '@runner/types';

const CorridaGame = lazy(() => import('@/components/user/corrida/corrida-game').then((m) => ({ default: m.CorridaGame })));

type Playing = { level: Level; replay?: number[] };

const CONTROLS: Array<{ title: string; text: string }> = [
  { title: 'Corrida', text: 'Toque (ou segure) para pular.' },
  { title: 'Voo', text: 'Segure para subir e solte para descer.' },
  { title: 'Gravidade', text: 'Toque no chão ou no teto para inverter a gravidade.' },
];

/** Aba do modo Corrida (protótipo): fases em formas simples para testar o toque; arte, sons, campanha e multijogador vêm nas próximas etapas. */
export function CorridaHub() {
  const [playing, setPlaying] = useState<Playing | null>(null);
  const list = usePagination(LEVELS, 10);

  const watchBot = useMemo(
    () => (level: Level) => {
      setPlaying({ level, replay: botInputs(prepareLevel(level)) });
    },
    [],
  );

  return (
    <section className="space-y-5" aria-label="Corrida">
      <Alert tone="info">Protótipo do novo modo: ainda sem arte, sons nem online. Teste o toque e diga o que achou. No computador, use a barra de espaço.</Alert>
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
              <p className="text-sm font-semibold text-muted">Passa pelas 3 formas · {Math.round(level.length / 8)} s</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => watchBot(level)}>
                Ver um bot jogar
              </Button>
              <Button onClick={() => setPlaying({ level })}>Jogar</Button>
            </div>
          </li>
        ))}
      </ul>
      <Pagination page={list.page} totalPages={list.totalPages} totalElements={list.totalElements} pageSize={list.pageSize} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} itemLabel="fases" />
      {playing ? (
        <Suspense fallback={<LoadingState />}>
          <CorridaGame level={playing.level} replay={playing.replay} onExit={() => setPlaying(null)} />
        </Suspense>
      ) : null}
    </section>
  );
}
