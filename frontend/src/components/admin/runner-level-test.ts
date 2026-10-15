import { useCallback, useEffect, useRef, useState } from 'react';
import type { CampaignLevelDef } from '@runner/campaign';
import type { LevelTestResult } from './runner-level-test.worker';

export type LevelTestOutcome = Extract<LevelTestResult, { kind: 'done' }>;
export type LevelTestStep = 'build' | 'exact' | 'late';

/** Roda o teste da fase (bot perfeito e bot de toque atrasado) num worker: a tela do Painel não trava durante os segundos que leva. */
export function useLevelTest() {
  const workerRef = useRef<Worker | null>(null);
  const [step, setStep] = useState<LevelTestStep | null>(null);

  const stop = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    setStep(null);
  }, []);
  useEffect(() => stop, [stop]);

  const run = useCallback(
    (def: CampaignLevelDef) =>
      new Promise<LevelTestOutcome>((resolve, reject) => {
        workerRef.current?.terminate();
        const worker = new Worker(new URL('./runner-level-test.worker.ts', import.meta.url), { type: 'module' });
        workerRef.current = worker;
        setStep('build');
        worker.onmessage = (event: MessageEvent<LevelTestResult>) => {
          if (event.data.kind === 'progress') {
            setStep(event.data.step);
            return;
          }
          worker.terminate();
          if (workerRef.current === worker) workerRef.current = null;
          setStep(null);
          resolve(event.data);
        };
        worker.onerror = () => {
          worker.terminate();
          if (workerRef.current === worker) workerRef.current = null;
          setStep(null);
          reject(new Error('O teste da fase falhou. Tente de novo.'));
        };
        worker.postMessage({ def });
      }),
    [],
  );

  return { run, step, running: step !== null, stop };
}
