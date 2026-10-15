import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage, useToast } from '@/components/ui/toast';
import { isNetworkError } from '@/lib/http';
import { getRunnerProgress, postRunnerResult, type RunnerProgressDto } from '@/lib/runner-api';
import { mergeBest, type Best } from '@runner/records';
import type { RunSegment } from '@runner/verify';

/** Uma partida da campanha à espera de ser conferida pelo servidor (guardada no aparelho enquanto não há conexão). */
type Pending = { levelId: string; segments: RunSegment[]; best: Best };

const PENDING_KEY = 'colecao-biblica:corrida:pending';
const MAX_PENDING = 20;

function readPending(): Pending[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(PENDING_KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? (raw.filter((item) => item && typeof item === 'object' && typeof (item as Pending).levelId === 'string' && Array.isArray((item as Pending).segments)) as Pending[]) : [];
  } catch {
    return [];
  }
}

function writePending(list: Pending[]) {
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch {
    /* sem armazenamento: a partida só vale enquanto a tela estiver aberta */
  }
}

const asBest = (dto: RunnerProgressDto): Best => ({ progress: dto.progress, words: dto.words, finished: dto.finished, clean: dto.clean });

/**
 * Progresso da campanha na conta: o servidor guarda o melhor resultado de cada fase depois de **repetir os toques da partida** (a tela nunca manda
 * pontos). Sem internet, a partida fica numa fila no aparelho e é enviada quando a conexão volta; enquanto isso o melhor resultado aparece na tela
 * (e abre a fase seguinte) como se já estivesse confirmado.
 */
export function useRunnerProgress() {
  const toast = useToast();
  const [server, setServer] = useState<Record<string, RunnerProgressDto>>({});
  const [pending, setPending] = useState<Pending[]>(readPending);
  const [loading, setLoading] = useState(true);
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const flushing = useRef(false);

  const setQueue = useCallback((next: Pending[]) => {
    pendingRef.current = next;
    setPending(next);
    writePending(next);
  }, []);

  /** Envia a fila em ordem (a fase seguinte só abre depois da anterior). Falta de conexão para e guarda o resto; recusa do servidor descarta a partida. */
  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      while (pendingRef.current.length > 0) {
        const [item, ...rest] = pendingRef.current;
        try {
          const saved = await postRunnerResult(item.levelId, item.segments);
          setServer((current) => ({ ...current, [item.levelId]: saved }));
        } catch (reason) {
          if (isNetworkError(reason)) break;
          toast.error(errorMessage(reason));
        }
        setQueue(rest);
      }
    } finally {
      flushing.current = false;
    }
  }, [setQueue, toast]);

  // Carrega o progresso (o service worker guarda a última cópia para abrir offline) e envia o que ficou pendente.
  useEffect(() => {
    let alive = true;
    getRunnerProgress()
      .then((data) => {
        if (alive) setServer(data.levels);
      })
      .catch(() => undefined)
      .finally(() => {
        if (alive) setLoading(false);
        void flush();
      });
    const online = () => void flush();
    window.addEventListener('online', online);
    return () => {
      alive = false;
      window.removeEventListener('online', online);
    };
  }, [flush]);

  /** Guarda a partida na fila e tenta enviar já. */
  const submit = useCallback(
    (levelId: string, segments: RunSegment[], best: Best) => {
      // Tentativa velha da mesma fase que não terminou perde para a nova (a fila não cresce à toa).
      const kept = pendingRef.current.filter((item) => item.levelId !== levelId || item.best.finished);
      setQueue([...kept, { levelId, segments, best }].slice(-MAX_PENDING));
      void flush();
    },
    [flush, setQueue],
  );

  const bests = useMemo(() => {
    const merged: Record<string, Best> = {};
    for (const [levelId, dto] of Object.entries(server)) merged[levelId] = asBest(dto);
    for (const item of pending) merged[item.levelId] = mergeBest(merged[item.levelId] ?? null, item.best);
    return merged;
  }, [server, pending]);

  const finished = useMemo(() => new Set(Object.entries(bests).filter(([, best]) => best.finished).map(([levelId]) => levelId)), [bests]);

  return { bests, finished, submit, loading, pendingCount: pending.length };
}
