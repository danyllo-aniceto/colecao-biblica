import { useCallback, useEffect, useRef, useState } from 'react';
import type { PaginatedResponse } from '@/lib/admin-api';

/** Valor que só muda depois de `delay` ms sem alterações (busca enquanto digita). */
export function useDebouncedValue<T>(value: T, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/**
 * Lista paginada no servidor: guarda página e tamanho, recarrega quando os
 * filtros mudam (voltando à 1ª página) e expõe `reload` para depois de salvar.
 */
export function usePagedList<T, F extends Record<string, string | undefined>>(
  fetcher: (params: F & { page: number; size: number }) => Promise<PaginatedResponse<T>>,
  filters: F,
  initialSize = 10,
) {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(initialSize);
  const [data, setData] = useState<PaginatedResponse<T>>({ content: [], totalElements: 0, totalPages: 0, number: 0, size: initialSize });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const filtersKey = JSON.stringify(filters);
  const previousFilters = useRef(filtersKey);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    // Filtro novo: volta para a primeira página antes de buscar.
    if (previousFilters.current !== filtersKey) {
      previousFilters.current = filtersKey;
      if (page !== 0) {
        setPage(0);
        return;
      }
    }
    let ignore = false;
    setLoading(true);
    setError(null);
    fetcherRef
      .current({ ...(JSON.parse(filtersKey) as F), page, size })
      .then((response) => {
        if (ignore) return;
        // Página ficou vazia (ex.: excluiu o último item): volta uma.
        if (response.content.length === 0 && page > 0) {
          setPage(page - 1);
          return;
        }
        setData(response);
      })
      .catch((reason: unknown) => {
        if (!ignore) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar a lista.');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [filtersKey, page, size, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  return {
    items: data.content,
    totalElements: data.totalElements,
    totalPages: data.totalPages,
    page,
    size,
    loading,
    error,
    setPage,
    setSize: (next: number) => {
      setSize(next);
      setPage(0);
    },
    reload,
  };
}
