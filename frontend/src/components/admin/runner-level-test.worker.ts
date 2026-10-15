/// <reference lib="webworker" />
import { botInputs, TOUCH_DELAY } from '@runner/bots';
import { buildCampaignLevel, validateLevelDef, type CampaignLevelDef, type Scenario } from '@runner/campaign';
import { prepareLevel, simulate } from '@runner/engine';
import { TILES_PER_SECOND } from '@runner/journey';

/** Teste de uma fase no Painel, fora da tela principal (leva alguns segundos): monta a fase, joga com o bot perfeito e com o bot de toque atrasado (o dedo de verdade). */
export type LevelTestRequest = { def: CampaignLevelDef };
export type LevelTestResult =
  | { kind: 'progress'; step: 'build' | 'exact' | 'late' }
  | { kind: 'done'; ok: boolean; message: string; details: { seconds: number; words: number; wordsCollected: number; powers: number; forks: number } };

const scope = self as unknown as DedicatedWorkerGlobalScope;
const stub: Scenario = { id: 'teste', name: 'Teste', story: '', theme: { skyTop: '#000000', skyBottom: '#000000' }, levels: [] };

scope.onmessage = (event: MessageEvent<LevelTestRequest>) => {
  const { def } = event.data;
  const fail = (message: string) => scope.postMessage({ kind: 'done', ok: false, message, details: { seconds: 0, words: 0, wordsCollected: 0, powers: 0, forks: 0 } } satisfies LevelTestResult);
  const errors = validateLevelDef(def);
  if (Object.keys(errors).length > 0) return fail(Object.values(errors)[0]);
  scope.postMessage({ kind: 'progress', step: 'build' } satisfies LevelTestResult);
  let prepared;
  try {
    prepared = prepareLevel(buildCampaignLevel(stub, def));
  } catch (reason) {
    // O gerador avisa quando falta lugar para as palavras do versículo (versículo longo para a duração).
    return fail(`Não foi possível montar a fase: ${reason instanceof Error ? reason.message : 'erro desconhecido'}. Aumente a duração ou encurte o versículo.`);
  }
  const level = prepared.level;
  const forks = level.objects.filter((object) => object.kind === 'block' && object.y === 3 && object.w === 26).length;
  const details = { seconds: Math.round(level.length / TILES_PER_SECOND), words: prepared.wordCount, wordsCollected: 0, powers: prepared.powerCount, forks };
  scope.postMessage({ kind: 'progress', step: 'exact' } satisfies LevelTestResult);
  const exact = simulate(prepared, botInputs(prepared));
  details.wordsCollected = exact.collected.length;
  if (exact.status !== 'finished') return scope.postMessage({ kind: 'done', ok: false, message: `O bot perfeito não consegue terminar a fase (parou em ${Math.floor(exact.progress * 100)}%). Troque a semente ou a ordem das formas.`, details } satisfies LevelTestResult);
  if (exact.collected.length < prepared.wordCount) return scope.postMessage({ kind: 'done', ok: false, message: `O bot perfeito termina, mas pega só ${exact.collected.length} de ${prepared.wordCount} palavras. Troque a semente.`, details } satisfies LevelTestResult);
  scope.postMessage({ kind: 'progress', step: 'late' } satisfies LevelTestResult);
  const late = simulate(prepared, botInputs(prepared, { lag: TOUCH_DELAY }));
  if (late.status !== 'finished') return scope.postMessage({ kind: 'done', ok: false, message: `Com o toque atrasado (como um dedo de verdade) o bot cai em ${Math.floor(late.progress * 100)}%: a fase está apertada demais. Troque a semente.`, details } satisfies LevelTestResult);
  scope.postMessage({ kind: 'done', ok: true, message: 'Fase possível: o bot perfeito e o bot de toque atrasado terminam e pegam todas as palavras do versículo.', details } satisfies LevelTestResult);
};
